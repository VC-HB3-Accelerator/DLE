// Импортируем axios для перехвата запросов
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Создаем экземпляр MockAdapter
const mock = new MockAdapter(axios, { delayResponse: 1000 });

// Мокаем запрос к API для получения nonce
mock.onGet(/\/api\/auth\/nonce/).reply((config) => {
  const address = config.url.split('?address=')[1];
  
  if (!address) {
    return [400, { error: 'Address is required' }];
  }
  
  return [200, {
    message: `Sign this message to authenticate with DApp for Business: ${Math.floor(Math.random() * 1000000)}`,
    address
  }];
});

// Мокаем запрос к API для верификации подписи
mock.onPost('/api/auth/verify').reply((config) => {
  const { address } = JSON.parse(config.data);
  
  // Проверяем, является ли адрес администратором (для тестирования)
  const isAdmin = address.toLowerCase() === '0xf45aa4917b3775ba37f48aeb3dc1a943561e9e0b'.toLowerCase();
  
  return [200, {
    authenticated: true,
    address,
    isAdmin
  }];
});

// Мокаем запрос к API для аутентификации по email
mock.onPost('/api/auth/email').reply((config) => {
  const { email } = JSON.parse(config.data);
  
  // Проверяем формат email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return [400, { error: 'Invalid email format' }];
  }
  
  // Проверяем, является ли email администратором (для тестирования)
  const isAdmin = email.toLowerCase() === 'admin@example.com';
  
  return [200, {
    authenticated: true,
    address: email,
    isAdmin
  }];
});

// Мокаем запрос к API для проверки сессии
mock.onGet('/api/auth/check').reply(200, {
  authenticated: false,
  address: null,
  isAdmin: false
});

// Мокаем запрос к API для выхода
mock.onPost('/api/auth/logout').reply(200, {
  success: true
});

export default mock; 