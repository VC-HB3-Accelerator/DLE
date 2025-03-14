import axios from '../api/axios';
import { useAuthStore } from '../stores/auth';

// Функция для подключения кошелька
async function connectWallet() {
  try {
    // Проверяем, доступен ли MetaMask
    if (!window.ethereum) {
      throw new Error('MetaMask не установлен');
    }
    
    // Запрашиваем доступ к аккаунтам
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const address = accounts[0];
    
    // Получаем nonce от сервера
    const nonceResponse = await axios.get(`/api/auth/nonce?address=${address}`, {
      withCredentials: true
    });
    const nonce = nonceResponse.data.nonce;
    
    // Создаем сообщение для подписи
    const message = `Подпишите это сообщение для аутентификации в DApp for Business. Nonce: ${nonce}`;
    
    // Запрашиваем подпись
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, address]
    });
    
    // Отправляем подпись на сервер для верификации
    const response = await axios.post('/api/auth/verify', {
      address,
      signature,
      message
    }, {
      withCredentials: true
    });

    console.log('Успешно подключен:', response.data);
    
    // Обновляем состояние в хранилище auth
    const authStore = useAuthStore();
    authStore.isAuthenticated = response.data.authenticated;
    authStore.user = { 
      id: response.data.userId,
      address: response.data.address 
    };
    authStore.isAdmin = response.data.isAdmin;
    authStore.authType = response.data.authType;
    
    // Сохраняем адрес кошелька в локальном хранилище
    localStorage.setItem('walletAddress', address);
    
    return {
      success: true,
      authenticated: response.data.authenticated,
      address: response.data.address,
      isAdmin: response.data.isAdmin,
      authType: response.data.authType
    };
  } catch (error) {
    console.error('Ошибка при подключении кошелька:', error);
    return { success: false, error: error.message || 'Ошибка подключения кошелька' };
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

export { connectWallet, disconnectWallet };
