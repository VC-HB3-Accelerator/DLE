import { ethers } from 'ethers';
import axios from '../api/axios';
import { useAuthStore } from '../stores/auth';

// Переименовываем функцию для соответствия импорту
export async function connectWithWallet() {
  try {
    // Проверяем, доступен ли MetaMask
    if (!window.ethereum) {
      throw new Error('MetaMask не установлен');
    }
    
    // Запрашиваем доступ к кошельку
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    // Получаем nonce для подписи
    const nonceResponse = await axios.get(`/api/auth/nonce?address=${address}`);
    const nonce = nonceResponse.data.nonce;

    // Формируем сообщение для подписи
    const message = `Подпишите это сообщение для аутентификации в DApp for Business. Nonce: ${nonce}`;

    // Подписываем сообщение
    const signature = await signer.signMessage(message);

    // Верифицируем подпись на сервере
    const response = await axios.post('/api/auth/verify', {
      address,
      signature,
      message: nonce
    });

    console.log('Wallet verification response:', response.data);
    
    // Обновляем состояние в хранилище auth
    const authStore = useAuthStore();
    authStore.isAuthenticated = response.data.authenticated;
    authStore.user = { 
      id: response.data.userId,
      address: response.data.address 
    };
    authStore.isAdmin = response.data.isAdmin;
    authStore.authType = 'wallet';
    
    // Сохраняем адрес кошелька в локальном хранилище
    localStorage.setItem('walletAddress', address);
    
    return {
      success: true,
      authenticated: response.data.authenticated,
      userId: response.data.userId,
      address: response.data.address,
      isAdmin: response.data.isAdmin,
      authType: 'wallet'
    };
  } catch (error) {
    console.error('Error connecting wallet:', error);
    return { success: false, error: error.message };
  }
}

async function disconnectWallet() {
  try {
    // Отправляем запрос на выход
    await axios.post(
      '/api/auth/logout',
      {},
      {
        withCredentials: true,
      }
    );
    
    // Удаляем адрес кошелька из локального хранилища
    localStorage.removeItem('walletAddress');
    
    // Обновляем состояние в хранилище auth
    const authStore = useAuthStore();
    authStore.isAuthenticated = false;
    authStore.user = null;
    authStore.isAdmin = false;
    authStore.authType = null;

    return { success: true };
  } catch (error) {
    console.error('Ошибка при отключении кошелька:', error);
    throw error;
  }
}
