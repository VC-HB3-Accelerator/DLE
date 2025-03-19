import axios from 'axios';
import { useAuthStore } from '../stores/auth';

// Создаем экземпляр axios с базовым URL
const api = axios.create({
  baseURL: '', // Убираем baseURL
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Перехватчик запросов
api.interceptors.request.use(
  (config) => {
    config.withCredentials = true; // Важно для каждого запроса
    
    const authStore = useAuthStore();
    if (authStore.isAuthenticated && authStore.address) {
      config.headers.Authorization = `Bearer ${authStore.address}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Добавляем перехватчик для обработки ответов
api.interceptors.response.use(
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

export default api;