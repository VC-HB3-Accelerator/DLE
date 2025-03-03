// Импортируем axios для перехвата запросов
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Создаем экземпляр MockAdapter
const mock = new MockAdapter(axios, { delayResponse: 1000 });

// Мокаем запрос к API чата
mock.onPost('/api/chat/message').reply((config) => {
  const { message, userId, language } = JSON.parse(config.data);
  
  // Определяем язык ответа
  const isRussian = language === 'ru';
  
  // Простые ответы на разных языках
  const responses = {
    ru: [
      'Я могу помочь вам с различными задачами. Что именно вас интересует?',
      'Для полноценной работы рекомендую авторизоваться в системе.',
      'Это интересный вопрос! Давайте разберемся подробнее.',
      'Я ИИ-ассистент DApp for Business. Чем могу помочь?',
      'Для доступа к расширенным функциям необходимо подключить кошелек или авторизоваться другим способом.'
    ],
    en: [
      'I can help you with various tasks. What are you interested in?',
      'For full functionality, I recommend logging into the system.',
      'That\'s an interesting question! Let\'s explore it in more detail.',
      'I\'m the AI assistant for DApp for Business. How can I help?',
      'To access advanced features, you need to connect your wallet or authorize in another way.'
    ]
  };
  
  // Выбираем случайный ответ из соответствующего языка
  const randomIndex = Math.floor(Math.random() * responses[isRussian ? 'ru' : 'en'].length);
  const reply = responses[isRussian ? 'ru' : 'en'][randomIndex];
  
  return [200, { reply }];
});

export default mock; 