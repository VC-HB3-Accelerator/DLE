require('dotenv').config();
const { app, nonceStore } = require('./app');
const http = require('http');
const { initWSS } = require('./wsHub');
const logger = require('./utils/logger');
const { getBot } = require('./services/telegramBot');
const EmailBotService = require('./services/emailBot');

const PORT = process.env.PORT || 8000;

console.log('Начало выполнения server.js');
console.log('Переменная окружения PORT:', process.env.PORT);
console.log('Используемый порт:', process.env.PORT || 8000);

// Инициализация сервисов
async function initServices() {
  try {
    console.log('Инициализация сервисов...');
    console.log('[initServices] Запуск Email-бота...');
    console.log('[initServices] Создаю экземпляр EmailBotService...');
    let emailBot;
    try {
      emailBot = new EmailBotService();
      console.log('[initServices] Экземпляр EmailBotService создан');
    } catch (err) {
      console.error('[initServices] Ошибка при создании экземпляра EmailBotService:', err);
      throw err;
    }
    console.log('[initServices] Перед вызовом emailBot.start()');
    try {
      await emailBot.start();
      console.log('[initServices] Email-бот успешно запущен');
    } catch (err) {
      console.error('[initServices] Ошибка при запуске emailBot:', err);
    }
    console.log('[initServices] Запуск Telegram-бота...');
    await getBot();
    console.log('[initServices] Telegram-бот успешно запущен');
  } catch (error) {
    console.error('Ошибка при инициализации сервисов:', error);
  }
}

const server = http.createServer(app);
initWSS(server);

server.listen(PORT, async () => {
  try {
    await initServices();
    console.log(`Server is running on port ${PORT}`);
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
});

// Обработка ошибок
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
});

module.exports = app;
