import axios from 'axios';

// Создаем экземпляр axios с базовым URL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Перехватчик запросов
api.interceptors.request.use(
  (config) => {
    config.withCredentials = true; // Важно для каждого запроса
    
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
  async (error) => {
    // Проверяем, что это действительно ошибка авторизации
    if (error.response?.status === 401) {
      // Перенаправляем на страницу логина
      window.location.href = '/login';
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