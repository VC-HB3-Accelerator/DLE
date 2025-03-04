import axios from 'axios';

async function connectWallet() {
  console.log('Начинаем подключение кошелька...');

  try {
    // Проверяем доступность MetaMask
    if (typeof window.ethereum === 'undefined') {
      throw new Error('MetaMask не установлен');
    }

    console.log('MetaMask доступен, запрашиваем аккаунты...');

    // Запрашиваем доступ к аккаунтам
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const address = accounts[0];

    if (!address) {
      throw new Error('Не удалось получить адрес кошелька');
    }

    console.log('Получен адрес кошелька:', address);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    console.log('API URL для nonce:', apiUrl);

    // Получаем nonce для подписи
    let nonce;
    
    // Пробуем прямой запрос к серверу
    try {
      const directNonceResponse = await axios.get(
        `${apiUrl}/api/auth/nonce?address=${address}`,
        {
          withCredentials: true,
        }
      );

      console.log('Прямой ответ сервера:', directNonceResponse.data);
      console.log('Cookies after direct request:', document.cookie);
      
      nonce = directNonceResponse.data.nonce;
    } catch (error) {
      console.error('Ошибка при получении nonce:', error);
      throw new Error('Не удалось получить nonce для подписи');
    }

    console.log('Получен nonce:', nonce);

    // Создаем сообщение для подписи
    const message = `Подтвердите вход в DApp for Business с nonce: ${nonce}`;

    try {
      // Запрашиваем подпись используя ethereum.request
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, address],
      });

      console.log('Получена подпись:', signature);

      // Отправляем подпись на сервер
      const verifyResponse = await axios.post(
        `${apiUrl}/api/auth/verify`,
        {
          address,
          signature,
          message,
          nonce,
        },
        {
          headers: {
            'X-Auth-Nonce': nonce,
          },
          withCredentials: true,
        }
      );

      console.log('Ответ сервера:', verifyResponse.data);

      // Сохраняем адрес в localStorage для восстановления сессии
      localStorage.setItem('walletAddress', address);

      // Возвращаем данные аутентификации
      return {
        address,
        authenticated: verifyResponse.data.authenticated,
        isAdmin: verifyResponse.data.isAdmin,
        authType: 'wallet',
      };
    } catch (signError) {
      console.error('Ошибка при подписи сообщения:', signError);

      if (signError.code === 4001) {
        throw new Error('Пользователь отклонил запрос на подпись');
      }

      throw new Error('Не удалось подписать сообщение');
    }
  } catch (error) {
    console.error('Ошибка при подключении кошелька:', error);
    throw error;
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
    
    // Удаляем адрес из localStorage
    localStorage.removeItem('walletAddress');

    return { success: true };
  } catch (error) {
    console.error('Ошибка при отключении кошелька:', error);
    throw error;
  }
}

export { connectWallet, disconnectWallet };
