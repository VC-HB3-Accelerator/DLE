// Импортируем axios для перехвата запросов
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Создаем экземпляр MockAdapter
const mock = new MockAdapter(axios, { delayResponse: 1000 });

// Мокаем запрос к API для создания токена доступа
mock.onPost('/api/contracts/tokens').reply(200, {
  success: true,
  token: {
    id: Math.floor(Math.random() * 1000000).toString(),
    address: '0x' + Math.random().toString(16).substring(2, 42),
    role: 'user',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  }
});

// Мокаем запрос к API для получения списка токенов
mock.onGet('/api/contracts/tokens').reply(200, {
  tokens: [
    {
      id: '1',
      address: '0x1234567890abcdef1234567890abcdef12345678',
      role: 'admin',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '2',
      address: '0xabcdef1234567890abcdef1234567890abcdef12',
      role: 'user',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
    }
  ]
});

// Обрабатываем все остальные запросы к API смарт-контрактов
mock.onAny(/\/api\/contracts\/.*/).reply(200, {
  success: true,
  message: 'Операция выполнена успешно'
});

export default mock; 