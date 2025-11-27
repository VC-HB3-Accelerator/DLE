/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

import axios from 'axios';
import { ethers } from 'ethers';
import { SiweMessage } from 'siwe';

export const connectWallet = async () => {
  try {
    // console.log('Starting wallet connection...');

    // Проверяем наличие MetaMask или другого Ethereum провайдера
    if (!window.ethereum) {
      // console.error('No Ethereum provider (like MetaMask) detected!');
      return {
        success: false,
        error:
          'Не найден кошелек MetaMask или другой Ethereum провайдер. Пожалуйста, установите расширение MetaMask.',
      };
    }

    // console.log('MetaMask detected, requesting accounts...');

    // Запрашиваем доступ к аккаунтам
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    // console.log('Got accounts:', accounts);

    if (!accounts || accounts.length === 0) {
      return {
        success: false,
        error: 'Не удалось получить доступ к аккаунтам. Пожалуйста, разрешите доступ в MetaMask.',
      };
    }

    // Берем первый аккаунт в списке
    const address = accounts[0];
    // Нормализуем адрес (используем getAddress для совместимости)
    // Проверяем версию ethers - если v6, используем ethers.getAddress, иначе ethers.utils.getAddress
    const normalizedAddress = ethers.getAddress ? ethers.getAddress(address) : ethers.utils.getAddress(address);
    // console.log('Normalized address:', normalizedAddress);

    // ВАЖНО: Получаем актуальный адрес ПЕРЕД запросом nonce, чтобы избежать проблем с переключением кошелька
    const currentAccounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (!currentAccounts || currentAccounts.length === 0) {
      return {
        success: false,
        error: 'Кошелек не подключен. Пожалуйста, подключите кошелек и попробуйте снова.',
      };
    }
    
    // Используем актуальный адрес из кошелька
    const currentAddress = ethers.getAddress ? ethers.getAddress(currentAccounts[0]) : ethers.utils.getAddress(currentAccounts[0]);
    
    // Проверяем, что адрес совпадает с изначальным
    if (ethers.getAddress(currentAddress) !== ethers.getAddress(normalizedAddress)) {
      console.warn('⚠️ [Frontend] Адрес кошелька изменился с момента подключения! Используем актуальный адрес:', currentAddress);
    }

    // Запрашиваем nonce с сервера для АКТУАЛЬНОГО адреса
    // console.log('Requesting nonce...');
    const nonceResponse = await axios.get(`/auth/nonce?address=${currentAddress}`);
    const nonce = nonceResponse.data.nonce;
    // console.log('Got nonce:', nonce);

    if (!nonce) {
      return {
        success: false,
        error: 'Не удалось получить nonce от сервера.',
      };
    }

    // Для SIWE используем personal_sign напрямую через window.ethereum
    // Не используем ethers signer, так как он добавляет префикс, который нарушает SIWE формат

    // Получаем список документов для подписания
    let resources = [`${window.location.origin}/api/auth/verify`];
    try {
      const docsResponse = await axios.get('/consent/documents');
      if (docsResponse.data && docsResponse.data.length > 0) {
        docsResponse.data.forEach(doc => {
          resources.push(`${window.location.origin}/public/page/${doc.id}`);
        });
      }
    } catch (error) {
      // Если не удалось получить документы, продолжаем без них
      console.warn('Не удалось получить список документов для подписания:', error);
    }

    // Создаем сообщение для подписи
    // Важно: domain должен быть hostname без протокола и порта (если порт стандартный)
    const domain = window.location.hostname === 'localhost' ? 
      `localhost:${window.location.port}` : 
      window.location.hostname;
    const origin = window.location.origin;
    
    // Создаем issuedAt один раз, чтобы использовать одинаковый в сообщении и запросе
    const issuedAt = new Date().toISOString();

    // Создаем копию resources и сортируем (не мутируем исходный массив)
    const sortedResources = [...resources].sort();
    
    // Создаем SIWE сообщение с документами в resources, используя АКТУАЛЬНЫЙ адрес
    const message = new SiweMessage({
      domain,
      address: currentAddress, // Используем актуальный адрес из кошелька
      statement: 'Sign in with Ethereum to the app.\n\nПодписывая это сообщение, вы подтверждаете ознакомление с документами, указанными в Resources, и согласие на обработку персональных данных.',
      uri: origin,
      version: '1',
      chainId: 1, // Ethereum mainnet
      nonce: nonce,
      issuedAt: issuedAt,
      resources: sortedResources,
    });
    
    // Получаем строку сообщения для подписи (после возможного обновления адреса)
    const messageToSign = message.prepareMessage();
    
    // Логируем для отладки
    console.log('🔐 [Frontend] Domain:', domain);
    console.log('🔐 [Frontend] Origin:', origin);
    console.log('🔐 [Frontend] Address:', currentAddress);
    console.log('🔐 [Frontend] Nonce:', nonce);
    console.log('🔐 [Frontend] IssuedAt:', issuedAt);
    console.log('🔐 [Frontend] Resources:', JSON.stringify(sortedResources));
    console.log('🔐 [Frontend] SIWE message to sign:', messageToSign);
    console.log('🔐 [Frontend] Message length:', messageToSign.length);

    // Запрашиваем подпись через personal_sign (правильный способ для SIWE)
    // personal_sign подписывает сообщение С префиксом "\x19Ethereum Signed Message:\n"
    // ethers.verifyMessage() также добавляет этот префикс, поэтому они совместимы
    // Параметры: [message, address] - MetaMask принимает строку напрямую
    // ВАЖНО: Используем currentAddress, чтобы подпись была от актуального кошелька
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [messageToSign, currentAddress.toLowerCase()],
    });

    if (!signature) {
      return {
        success: false,
        error: 'Подпись не была получена. Пожалуйста, подпишите сообщение в MetaMask.',
      };
    }

    // console.log('Got signature:', signature);

    // КРИТИЧЕСКАЯ ПРОВЕРКА: Убеждаемся, что адрес не изменился после подписи
    const finalAccounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (!finalAccounts || finalAccounts.length === 0) {
      return {
        success: false,
        error: 'Кошелек отключен. Пожалуйста, подключите кошелек и попробуйте снова.',
      };
    }
    
    const finalAddress = ethers.getAddress ? ethers.getAddress(finalAccounts[0]) : ethers.utils.getAddress(finalAccounts[0]);
    
    // Проверяем, что адрес совпадает с тем, который использовался для подписи
    if (ethers.getAddress(finalAddress) !== ethers.getAddress(currentAddress)) {
      console.error('❌ [Frontend] КРИТИЧЕСКАЯ ОШИБКА: Адрес кошелька изменился после подписи!');
      console.error('  Адрес при подписи:', currentAddress);
      console.error('  Текущий адрес:', finalAddress);
      return {
        success: false,
        error: 'Адрес кошелька изменился после подписи. Пожалуйста, попробуйте снова.',
      };
    }
    
    // Проверяем, что адрес в сообщении совпадает с адресом, который подписывает
    const messageAddress = message.address;
    if (ethers.getAddress(messageAddress) !== ethers.getAddress(currentAddress)) {
      console.error('❌ [Frontend] КРИТИЧЕСКАЯ ОШИБКА: Адрес в сообщении не совпадает с адресом подписи!');
      console.error('  Адрес в сообщении:', messageAddress);
      console.error('  Адрес подписи:', currentAddress);
      return {
        success: false,
        error: 'Несоответствие адресов в сообщении и подписи. Пожалуйста, попробуйте снова.',
      };
    }

    // Отправляем верификацию на сервер
    // console.log('Sending verification request...');
    const requestData = {
      address: currentAddress, // Используем актуальный адрес из кошелька
      signature,
      nonce,
      issuedAt: issuedAt, // Используем тот же issuedAt, что и в сообщении
    };
    // console.log('Request data:', requestData);
    
    const verifyResponse = await axios.post('/auth/verify', requestData, {
      withCredentials: true,
    });

    // Обновляем интерфейс для отображения подключенного состояния
    document.body.classList.add('wallet-connected');

    // Обновляем отображение адреса кошелька в UI
    const authDisplayEl = document.getElementById('auth-display');
    if (authDisplayEl) {
      const shortAddress = `${normalizedAddress.substring(0, 6)}...${normalizedAddress.substring(normalizedAddress.length - 4)}`;
      authDisplayEl.innerHTML = `Кошелек: <strong>${shortAddress}</strong>`;
      authDisplayEl.style.display = 'inline-block';
    }

    // Скрываем кнопки авторизации и показываем кнопку выхода
    const authButtonsEl = document.getElementById('auth-buttons');
    const logoutButtonEl = document.getElementById('logout-button');

    if (authButtonsEl) authButtonsEl.style.display = 'none';
    if (logoutButtonEl) logoutButtonEl.style.display = 'inline-block';

    // console.log('Verification response:', verifyResponse.data);

    if (verifyResponse.data.success) {
      return {
        success: true,
        address: normalizedAddress,
        userId: verifyResponse.data.userId,
      };
    } else {
      return {
        success: false,
        error: verifyResponse.data.error || 'Ошибка верификации на сервере.',
      };
    }
  } catch (error) {
    // console.error('Error connecting wallet:', error);

    // Формируем понятное сообщение об ошибке
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
