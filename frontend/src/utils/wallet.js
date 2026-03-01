/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

// ВАЖНО: используем общий axios-инстанс с baseURL `/api`,
// чтобы все запросы шли через один и тот же API-слой
import api from '../api/axios';
import { ethers } from 'ethers';
import { SiweMessage } from 'siwe';

/**
 * Нормализует Ethereum адрес
 */
const normalizeAddress = (address) => {
  return ethers.getAddress(address);
};

/**
 * Получает актуальный адрес из кошелька
 * ВАЖНО: используем ethereum.selectedAddress, т.к. некоторые кошельки
 * могут подписывать сообщением активным аккаунтом, игнорируя список eth_accounts.
 * Если selectedAddress недоступен, падаем обратно на eth_accounts.
 */
const getCurrentAddress = async () => {
  if (!window.ethereum) {
    return null;
  }

  let rawAddress = null;

  // 1. Пробуем взять текущий активный аккаунт
  if (window.ethereum.selectedAddress) {
    rawAddress = window.ethereum.selectedAddress;
  } else {
    // 2. Фоллбек на eth_accounts
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      return null;
    }
    rawAddress = accounts[0];
  }

  return normalizeAddress(rawAddress);
};

/**
 * Формирует domain для SIWE сообщения (должен совпадать с бэкендом)
 */
const getDomain = () => {
  let domain = window.location.host;
  // Если порта нет, добавляем его для localhost или IP адресов
  if (!domain.includes(':')) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      domain = `${window.location.hostname}:${window.location.port || '9000'}`;
    } else if (/^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname)) {
      domain = `${window.location.hostname}:${window.location.port || '9000'}`;
    }
  }
  return domain;
};

/**
 * Формирует origin для SIWE сообщения (должен совпадать с бэкендом)
 * window.location.origin может не включать порт, поэтому формируем явно
 */
const getOrigin = () => {
  const protocol = window.location.protocol; // Уже содержит ':' (например, 'http:')
  const domain = getDomain(); // Используем domain, который уже содержит порт
  return `${protocol}//${domain}`; // Двойной слеш после протокола (http:// или https://)
};

export const connectWallet = async () => {
  try {
    // Проверяем наличие MetaMask
    if (!window.ethereum) {
      return {
        success: false,
        error: 'Не найден кошелек MetaMask или другой Ethereum провайдер. Пожалуйста, установите расширение MetaMask.',
      };
    }

    // Запрашиваем доступ к аккаунтам
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts || accounts.length === 0) {
      return {
        success: false,
        error: 'Не удалось получить доступ к аккаунтам. Пожалуйста, разрешите доступ в MetaMask.',
      };
    }

    // КРИТИЧЕСКИ ВАЖНО: Получаем актуальный адрес ОДИН РАЗ и используем его везде
    // Это гарантирует, что весь процесс (nonce, сообщение, подпись) использует один и тот же адрес
    const walletAddress = await getCurrentAddress();
    if (!walletAddress) {
      return {
        success: false,
        error: 'Кошелек не подключен. Пожалуйста, подключите кошелек и попробуйте снова.',
      };
    }

    // Формируем domain и origin (должны совпадать с бэкендом)
    const domain = getDomain();
    const origin = getOrigin();

    // Получаем список документов для подписания
    // ВАЖНО: Пути должны точно совпадать с бэкендом для успешной верификации SIWE
    let resources = [`${origin}/api/auth/verify`];
    // Добавляем общую ссылку на страницу опубликованных документов
    resources.push(`${origin}/content/published`);
    try {
      const docsResponse = await api.get('/consent/documents');
      if (docsResponse.data && docsResponse.data.length > 0) {
        docsResponse.data.forEach(doc => {
          // Используем тот же путь, что и на бэкенде: /content/published/${doc.id}
          resources.push(`${origin}/content/published/${doc.id}`);
        });
      }
    } catch (error) {
      console.warn('Не удалось получить список документов для подписания:', error);
    }
    const issuedAt = new Date().toISOString();
    const sortedResources = [...resources].sort();

    // Запрашиваем nonce для адреса кошелька
    // ВАЖНО: Бэкенд сохраняет nonce для address.toLowerCase(), поэтому отправляем адрес в нижнем регистре
    const nonceResponse = await api.get(`/auth/nonce?address=${walletAddress.toLowerCase()}`);
    const nonce = nonceResponse.data.nonce;
    if (!nonce) {
      return {
        success: false,
        error: 'Не удалось получить nonce от сервера.',
      };
    }

    // КРИТИЧЕСКАЯ ПРОВЕРКА: Убеждаемся, что адрес не изменился перед подписанием
    // personal_sign всегда использует текущий активный аккаунт, поэтому адрес в сообщении
    // должен совпадать с адресом, который будет подписывать
    const addressBeforeSign = await getCurrentAddress();
    if (!addressBeforeSign) {
      return {
        success: false,
        error: 'Не удалось получить адрес кошелька. Пожалуйста, попробуйте снова.',
      };
    }

    // Нормализуем адрес для использования в сообщении
    // ВАЖНО: SiweMessage может нормализовать адрес, поэтому нормализуем его заранее
    const normalizedAddressForMessage = normalizeAddress(addressBeforeSign);
    
    // Проверяем, что адрес не изменился
    const normalizedWalletAddress = normalizeAddress(walletAddress);
    if (normalizedAddressForMessage !== normalizedWalletAddress) {
      console.error('❌ [Frontend] Адрес изменился перед подписанием!');
      console.error('  Ожидался (нормализован):', normalizedWalletAddress);
      console.error('  Получен (нормализован):', normalizedAddressForMessage);
      return {
        success: false,
        error: 'Адрес кошелька изменился. Пожалуйста, попробуйте снова.',
      };
    }

    // Создаем SIWE сообщение с нормализованным адресом
    // ВАЖНО: адрес в сообщении должен совпадать с адресом, который подписывает
    const message = new SiweMessage({
      domain,
      address: normalizedAddressForMessage, // Используем нормализованный адрес
      statement: 'Sign in with Ethereum to the app.\n\nПодписывая это сообщение, вы подтверждаете ознакомление с документами, указанными в Resources, и согласие на обработку персональных данных.',
      uri: origin,
      version: '1',
      chainId: 1,
      nonce: nonce,
      issuedAt: issuedAt,
      resources: sortedResources,
    });

    const messageToSign = message.prepareMessage();

    // КРИТИЧЕСКАЯ ПРОВЕРКА: Убеждаемся, что адрес в сообщении совпадает с адресом, который будет подписывать
    // SiweMessage может нормализовать адрес, поэтому проверяем после создания сообщения
    const messageAddress = message.address;
    const normalizedMessageAddress = normalizeAddress(messageAddress);
    const normalizedSignAddress = normalizeAddress(addressBeforeSign);
    
    if (normalizedMessageAddress !== normalizedSignAddress) {
      console.error('❌ [Frontend] КРИТИЧЕСКАЯ ОШИБКА: Адрес в сообщении не совпадает с адресом для подписи!');
      console.error('  Адрес в сообщении (исходный):', messageAddress);
      console.error('  Адрес в сообщении (нормализован):', normalizedMessageAddress);
      console.error('  Адрес для подписи (исходный):', addressBeforeSign);
      console.error('  Адрес для подписи (нормализован):', normalizedSignAddress);
      return {
        success: false,
        error: 'Несоответствие адресов в сообщении и подписи. Пожалуйста, попробуйте снова.',
      };
    }

    // Логируем для отладки
    console.log('🔐 [Frontend] Domain:', domain);
    console.log('🔐 [Frontend] Origin:', origin);
    console.log('🔐 [Frontend] Address in message (original):', messageAddress);
    console.log('🔐 [Frontend] Address in message (normalized):', normalizedMessageAddress);
    console.log('🔐 [Frontend] Address for sign (original):', addressBeforeSign);
    console.log('🔐 [Frontend] Address for sign (normalized):', normalizedSignAddress);
    console.log('🔐 [Frontend] Addresses match (normalized):', normalizedMessageAddress === normalizedSignAddress);
    console.log('🔐 [Frontend] Nonce:', nonce);
    console.log('🔐 [Frontend] IssuedAt:', issuedAt);
    console.log('🔐 [Frontend] Resources:', JSON.stringify(sortedResources));
    console.log('🔐 [Frontend] SIWE message to sign:', messageToSign);

    // Запрашиваем подпись
    // ВАЖНО: personal_sign может игнорировать второй параметр (адрес) и использовать текущий активный аккаунт
    // Поэтому мы должны убедиться, что адрес в сообщении совпадает с адресом, который будет подписывать
    // Используем нормализованный адрес для подписи
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [messageToSign, normalizedMessageAddress.toLowerCase()], // Используем нормализованный адрес из сообщения
    });

    if (!signature) {
      return {
        success: false,
        error: 'Подпись не была получена. Пожалуйста, подпишите сообщение в MetaMask.',
      };
    }

    // Отправляем верификацию на сервер
    // Используем нормализованный адрес из сообщения (должен совпадать с адресом, который подписал)
    const requestData = {
      address: normalizedMessageAddress, // Нормализованный адрес из сообщения (должен совпадать с адресом подписи)
      signature,
      nonce,
      issuedAt: issuedAt,
    };
    
    const verifyResponse = await api.post('/auth/verify', requestData, {
      withCredentials: true,
    });

    // Обновляем интерфейс
    document.body.classList.add('wallet-connected');

    const authDisplayEl = document.getElementById('auth-display');
    if (authDisplayEl) {
      const shortAddress = `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
      authDisplayEl.innerHTML = `Кошелек: <strong>${shortAddress}</strong>`;
      authDisplayEl.style.display = 'inline-block';
    }

    const authButtonsEl = document.getElementById('auth-buttons');
    const logoutButtonEl = document.getElementById('logout-button');
    if (authButtonsEl) authButtonsEl.style.display = 'none';
    if (logoutButtonEl) logoutButtonEl.style.display = 'inline-block';

    if (verifyResponse.data.success) {
      return {
        success: true,
        address: walletAddress,
        userId: verifyResponse.data.userId,
      };
    } else {
      return {
        success: false,
        error: verifyResponse.data.error || 'Ошибка верификации на сервере.',
      };
    }
  } catch (error) {
    let errorMessage = 'Произошла ошибка при подключении кошелька.';

    if (error.message && error.message.includes('MetaMask extension not found')) {
      errorMessage = 'Расширение MetaMask не найдено. Пожалуйста, установите MetaMask и обновите страницу.';
    } else if (error.message && error.message.includes('Failed to connect to MetaMask')) {
      errorMessage = 'Не удалось подключиться к MetaMask. Проверьте, что расширение установлено и активно.';
    } else if (error.code === 4001) {
      errorMessage = 'Вы отклонили запрос на подпись в MetaMask.';
    } else if (error.message && error.message.includes('No accounts found')) {
      errorMessage = 'Аккаунты не найдены. Пожалуйста, разблокируйте MetaMask и попробуйте снова.';
    } else if (error.message && error.message.includes('MetaMask not detected')) {
      errorMessage = 'MetaMask не обнаружен. Пожалуйста, установите расширение MetaMask.';
    } else if (error.response && error.response.data && error.response.data.error) {
      errorMessage = error.response.data.error;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
};
