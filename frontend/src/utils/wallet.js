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
import { i18n } from '@/locales/index.js';
import siweStatements from '@shared/siweStatements.json';

const t = (key, params) => i18n.global.t(key, params);

function getSiweStatement() {
  const locale = i18n.global.locale.value;
  return siweStatements[locale] || siweStatements.ru;
}

function getSiweLocale() {
  const locale = i18n.global.locale.value;
  return siweStatements[locale] ? locale : 'ru';
}

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
        error: t('auth.providerNotFound'),
      };
    }

    // Запрашиваем доступ к аккаунтам
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts || accounts.length === 0) {
      return {
        success: false,
        error: t('auth.accountsAccessDenied'),
      };
    }

    // КРИТИЧЕСКИ ВАЖНО: Получаем актуальный адрес ОДИН РАЗ и используем его везде
    // Это гарантирует, что весь процесс (nonce, сообщение, подпись) использует один и тот же адрес
    const walletAddress = await getCurrentAddress();
    if (!walletAddress) {
      return {
        success: false,
        error: t('auth.walletNotConnectedRetry'),
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
        error: t('auth.nonceFromServerFailed'),
      };
    }

    // КРИТИЧЕСКАЯ ПРОВЕРКА: Убеждаемся, что адрес не изменился перед подписанием
    // personal_sign всегда использует текущий активный аккаунт, поэтому адрес в сообщении
    // должен совпадать с адресом, который будет подписывать
    const addressBeforeSign = await getCurrentAddress();
    if (!addressBeforeSign) {
      return {
        success: false,
        error: t('auth.addressFetchFailed'),
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
        error: t('auth.addressChanged'),
      };
    }

    // Создаем SIWE сообщение с нормализованным адресом
    // ВАЖНО: адрес в сообщении должен совпадать с адресом, который подписывает
    const message = new SiweMessage({
      domain,
      address: normalizedAddressForMessage, // Используем нормализованный адрес
      statement: getSiweStatement(),
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
        error: t('auth.addressMismatch'),
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
        error: t('auth.signatureNotReceived'),
      };
    }

    // Отправляем верификацию на сервер
    // Используем нормализованный адрес из сообщения (должен совпадать с адресом, который подписал)
    const requestData = {
      address: normalizedMessageAddress, // Нормализованный адрес из сообщения (должен совпадать с адресом подписи)
      signature,
      nonce,
      issuedAt: issuedAt,
      siweLocale: getSiweLocale(),
    };
    
    const verifyResponse = await api.post('/auth/verify', requestData, {
      withCredentials: true,
    });

    // Обновляем интерфейс
    document.body.classList.add('wallet-connected');

    const authDisplayEl = document.getElementById('auth-display');
    if (authDisplayEl) {
      const shortAddress = `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
      authDisplayEl.innerHTML = t('auth.walletConnectedLabel', { address: shortAddress });
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
        error: verifyResponse.data.error || t('auth.verifyServerError'),
      };
    }
  } catch (error) {
    let errorMessage = t('auth.walletGenericError');

    if (error.message && error.message.includes('MetaMask extension not found')) {
      errorMessage = t('auth.metamaskNotFound');
    } else if (error.message && error.message.includes('Failed to connect to MetaMask')) {
      errorMessage = t('auth.metamaskConnectFailed');
    } else if (error.code === 4001) {
      errorMessage = t('auth.signatureRejected');
    } else if (error.message && error.message.includes('No accounts found')) {
      errorMessage = t('auth.accountsNotFoundUnlock');
    } else if (error.message && error.message.includes('MetaMask not detected')) {
      errorMessage = t('auth.metamaskNotDetected');
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
