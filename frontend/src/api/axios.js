import axios from 'axios';
import { useAuthStore } from '../stores/auth';

// Создаем экземпляр axios с базовым URL
const instance = axios.create({
  baseURL: '/',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Добавляем перехватчик для добавления заголовка авторизации
instance.interceptors.request.use(
  (config) => {
    console.log('Axios interceptor running');
    const authStore = useAuthStore();
    
    // Логируем параметры запроса
    console.log('Request parameters:', config);

    // Если уже есть заголовок Authorization, не перезаписываем его
    if (config.headers.Authorization) {
      return config;
    }

    // Если пользователь аутентифицирован и есть адрес кошелька
    if (authStore.isAuthenticated && authStore.address) {
      console.log('Adding Authorization header:', `Bearer ${authStore.address}`);
      config.headers.Authorization = `Bearer ${authStore.address}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Добавляем перехватчик для обработки ответов
instance.interceptors.response.use(
  (response) => {
    console.log('Response from server:', response.data);
    return response;
  },
  (error) => {
    // Проверяем, что это действительно ошибка авторизации
    if (error.response?.status === 401 && 
        !error.config.url.includes('/auth/') && 
        !error.config.url.includes('/verify') &&
        !error.config.url.includes('/chat/history')) { // Не очищаем при ошибке загрузки истории
      console.log('Auth error, clearing state');
      const auth = useAuthStore();
      auth.disconnect();
    }
    return Promise.reject(error);
  }
);

// Пример функции для отправки гостевого сообщения на сервер
const sendGuestMessageToServer = async (messageText) => {
  try {
    await axios.post('/api/chat/guest-message', {
      message: messageText,
      language: userLanguage.value
    });
  } catch (error) {
    console.error('Ошибка при отправке гостевого сообщения на сервер:', error);
  }
};

export default instance;