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

// Создаем экземпляр axios с базовым URL и таймаутами
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 10 * 60 * 1000, // 10 минут таймаут для деплоя
  headers: {
    'Content-Type': 'application/json',
  },
});

// Перехватчик запросов
api.interceptors.request.use(
  (config) => {
    config.withCredentials = true; // Важно для каждого запроса
    
    // DEBUG: логируем все исходящие запросы
    console.log('🌐 [AXIOS] Отправляем запрос:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: config.baseURL + config.url,
      data: config.data ? '[ДАННЫЕ]' : 'нет данных'
    });

    return config;
  },
  (error) => {
    console.error('🌐 [AXIOS] Ошибка перед отправкой:', error);
    return Promise.reject(error);
  }
);

// Добавляем перехватчик ответов для обработки ошибок
api.interceptors.response.use(
  (response) => {
    // DEBUG: логируем успешные ответы
    console.log('🌐 [AXIOS] Получен ответ:', {
      method: response.config.method?.toUpperCase(),
      url: response.config.url,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers['content-type']
    });
    
    // Проверяем, что ответ действительно JSON
    if (response.headers['content-type'] && 
        !response.headers['content-type'].includes('application/json')) {
      // console.warn('Server returned non-JSON response:', response.headers['content-type']);
      // Если это HTML, значит, запрос ушёл не туда
      if (response.headers['content-type'].includes('text/html')) {
        throw new Error('Server returned HTML instead of JSON. Check API endpoint.');
      }
    }
    return response;
  },
  (error) => {
    // DEBUG: логируем ошибки
    console.error('🌐 [AXIOS] Ошибка ответа:', {
      method: error.config?.method?.toUpperCase(),
      url: error.config?.url,
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText
    });
    
    // Если ошибка содержит HTML в response
    if (error.response && error.response.data && 
        typeof error.response.data === 'string' && 
        error.response.data.includes('<!DOCTYPE')) {
      // console.error('API Error: Server returned HTML instead of JSON');
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
    // console.error('Ошибка при отправке гостевого сообщения на сервер:', error);
  }
};

export default api;
