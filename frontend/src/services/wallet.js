/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/HB3-ACCELERATOR
 */

import { ethers } from 'ethers';
import axios from '../api/axios';
import { SiweMessage } from 'siwe';

export async function connectWithWallet() {
  // console.log('Starting wallet connection...');

  try {
    // Проверяем наличие MetaMask
    if (!window.ethereum) {
      throw new Error('MetaMask not detected. Please install MetaMask.');
    }

    // console.log('MetaMask detected, requesting accounts...');

    // Запрашиваем доступ к аккаунтам
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

    // console.log('Got accounts:', accounts);

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found. Please unlock MetaMask.');
    }

    // Берем первый аккаунт
    const address = ethers.getAddress(accounts[0]);
    // console.log('Normalized address:', address);

    // Запрашиваем nonce с сервера
    // console.log('Requesting nonce...');
    const nonceResponse = await axios.get(`/auth/nonce?address=${address}`);
    const nonce = nonceResponse.data.nonce;
    // console.log('Got nonce:', nonce);

    // Создаем сообщение для подписи
    const domain = window.location.host;
    const origin = window.location.origin;
    const statement = 'Sign in with Ethereum to the app.';

    const issuedAt = new Date().toISOString();
    const siweMessage = new SiweMessage({
      domain,
      address,
      statement,
      uri: origin,
      version: '1',
      chainId: 1,
      nonce,
      issuedAt,
      resources: [`${origin}/api/auth/verify`],
    });

    const message = siweMessage.prepareMessage();
    // console.log('SIWE message:', message);
    // console.log('SIWE message details:', {
    //   domain,
    //   address,
    //   statement,
    //   uri: origin,
    //   version: '1',
    //   chainId: 1,
    //   nonce,
    //   issuedAt,
    //   resources: [`${origin}/api/auth/verify`],
    // });

    // Запрашиваем подпись
    // console.log('Requesting signature...');
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, address.toLowerCase()],
    });

    // console.log('Got signature:', signature);

    // Отправляем подпись на сервер для верификации
    // console.log('Sending verification request...');
    const verificationResponse = await axios.post('/auth/verify', {
      signature,
      address,
      nonce,
      issuedAt,
    });

    // console.log('Verification response:', verificationResponse.data);

    // Обновляем состояние аутентификации
    if (verificationResponse.data.success) {
      // Обновляем состояние аутентификации в localStorage
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userId', verificationResponse.data.userId);
      localStorage.setItem('address', verificationResponse.data.address);
      localStorage.setItem('isAdmin', verificationResponse.data.isAdmin);
    }

    return verificationResponse.data;
  } catch (error) {
    // console.error('Error connecting wallet:', error);
    throw error;
  }
}
