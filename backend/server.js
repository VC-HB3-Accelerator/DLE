require('dotenv').config();
const { app, nonceStore } = require('./app');
const http = require('http');
const { initWSS } = require('./wsHub');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 8000;

console.log('Начало выполнения server.js');
console.log('Переменная окружения PORT:', process.env.PORT);
console.log('Используемый порт:', process.env.PORT || 8000);

// Инициализация сервисов
async function initServices() {
  try {
    console.log('Инициализация сервисов...');
    // Здесь может быть инициализация ботов, email-сервисов и т.д.
    // ...
    console.log('Все сервисы успешно инициализированы');
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
