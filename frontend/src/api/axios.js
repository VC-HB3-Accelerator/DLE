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

import axios from 'axios';

// Создаем экземпляр axios с базовым URL
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Перехватчик запросов
api.interceptors.request.use(
  (config) => {
    config.withCredentials = true; // Важно для каждого запроса

    return config;
  },
  (error) => Promise.reject(error)
);

// Добавляем перехватчик ответов для обработки ошибок
api.interceptors.response.use(
  (response) => {
    // Проверяем, что ответ действительно JSON
    if (response.headers['content-type'] && 
        !response.headers['content-type'].includes('application/json')) {
      console.warn('Server returned non-JSON response:', response.headers['content-type']);
      // Если это HTML, значит, запрос ушёл не туда
      if (response.headers['content-type'].includes('text/html')) {
        throw new Error('Server returned HTML instead of JSON. Check API endpoint.');
      }
    }
    return response;
  },
  (error) => {
    // Если ошибка содержит HTML в response
    if (error.response && error.response.data && 
        typeof error.response.data === 'string' && 
        error.response.data.includes('<!DOCTYPE')) {
      console.error('API Error: Server returned HTML instead of JSON');
      error.message = 'Ошибка: сервер вернул HTML вместо JSON. Проверьте подключение к API.';
    }
    return Promise.reject(error);
  }
);

// Пример функции для отправки гостевого сообщения на сервер
const sendGuestMessageToServer = async (messageText) => {
  try {
    await axios.post('/chat/guest-message', {
      message: messageText,
      // language: userLanguage.value, // TODO: Реализовать получение языка пользователя
    }, { withCredentials: true });
  } catch (error) {
    console.error('Ошибка при отправке гостевого сообщения на сервер:', error);
  }
};

export default api;
