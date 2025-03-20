import { ethers } from 'ethers';
import axios from 'axios';

export async function connectWithWallet() {
  try {
    console.log('Starting wallet connection...');
    // Проверяем наличие MetaMask
    if (!window.ethereum) {
      throw new Error('MetaMask не установлен. Пожалуйста, установите MetaMask');
    }

    console.log('MetaMask detected, requesting accounts...');
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    });

    console.log('Got accounts:', accounts);
    if (!accounts || accounts.length === 0) {
      throw new Error('Нет доступных аккаунтов. Пожалуйста, разблокируйте MetaMask');
    }

    const address = ethers.getAddress(accounts[0]);
    console.log('Normalized address:', address);

    console.log('Requesting nonce...');
    const { data: { nonce } } = await axios.get('/api/auth/nonce', {
      params: { address }
    });
    console.log('Got nonce:', nonce);

    // Формируем сообщение в формате SIWE (Sign-In with Ethereum)
    const domain = window.location.host;
    const origin = window.location.origin;
    const statement = "Sign in with Ethereum to the app.";
    const message = [
      `${domain} wants you to sign in with your Ethereum account:`,
      address,
      "",
      statement,
      "",
      `URI: ${origin}`,
      "Version: 1",
      "Chain ID: 1",
      `Nonce: ${nonce}`,
      `Issued At: ${new Date().toISOString()}`,
      "Resources:",
      `- ${origin}/api/auth/verify`
    ].join("\n");

    console.log('SIWE message:', message);

    console.log('Requesting signature...');
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, address]
    });
    console.log('Got signature:', signature);

    console.log('Sending verification request...');
    const response = await axios.post('/api/auth/verify', {
      address,
      signature,
      message
    });
    console.log('Verification response:', response.data);

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    return { address, signer };
  } catch (error) {
    // Форматируем ошибку для пользователя
    const message = error.message || 'Ошибка подключения кошелька';
    console.error('Error connecting wallet:', message);
    throw new Error(message);
  }
} 