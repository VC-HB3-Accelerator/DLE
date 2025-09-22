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

require('dotenv').config();
const { app, nonceStore } = require('./app');
const http = require('http');
const { initWSS } = require('./wsHub');
const logger = require('./utils/logger');
const { getBot } = require('./services/telegramBot');
const EmailBotService = require('./services/emailBot');
const { initDbPool, seedAIAssistantSettings } = require('./db');
const memoryMonitor = require('./utils/memoryMonitor');

const PORT = process.env.PORT || 8000;

// console.log('Начало выполнения server.js');
// console.log('Переменная окружения PORT:', process.env.PORT);
// console.log('Используемый порт:', process.env.PORT || 8000);

// Инициализация сервисов
async function initServices() {
  try {
    // console.log('Инициализация сервисов...');
          // console.log('[initServices] Запуск Email-бота...');
      // console.log('[initServices] Создаю экземпляр EmailBotService...');
    let emailBot;
    try {
      emailBot = new EmailBotService();
              // console.log('[initServices] Экземпляр EmailBotService создан');
    } catch (err) {
              // console.error('[initServices] Ошибка при создании экземпляра EmailBotService:', err);
      throw err;
    }
            // console.log('[initServices] Перед вызовом emailBot.start()');
    try {
      await emailBot.start();
              // console.log('[initServices] Email-бот успешно запущен');
    } catch (err) {
              // console.error('[initServices] Ошибка при запуске emailBot:', err);
    }
          // console.log('[initServices] Запуск Telegram-бота...');
    try {
      await getBot();
              // console.log('[initServices] Telegram-бот успешно запущен');
    } catch (err) {
              // console.error('[initServices] Ошибка при запуске Telegram-бота:', err);
    }
      } catch (error) {
      // console.error('Ошибка при инициализации сервисов:', error);
    }
}

const server = http.createServer(app);
initWSS(server);

// WebSocket уже инициализирован в wsHub.js

async function startServer() {
  await initDbPool(); // Дождаться пересоздания пула!
  
  // Инициализация AI ассистента В ФОНЕ (неблокирующая)
  seedAIAssistantSettings().catch(error => {
    console.warn('[Server] Ollama недоступен, AI ассистент будет инициализирован позже:', error.message);
  });
  
  // Разогрев модели Ollama
      // console.log('🔥 Запуск разогрева модели...');
  setTimeout(() => {
  }, 10000); // Задержка 10 секунд для полной инициализации
  
  // Запускаем сервисы в фоне (неблокирующе)
  initServices().catch(error => {
    console.warn('[Server] Ошибка инициализации сервисов:', error.message);
  });
  console.log(`✅ Server is running on port ${PORT}`);
}

server.listen(PORT, async () => {
  try {
    await startServer();
  } catch (error) {
    // console.error('Error starting server:', error);
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

// Запускаем мониторинг памяти в production
if (process.env.NODE_ENV === 'production') {
  memoryMonitor.start(300000); // Каждые 5 минут
  // logger.info('[Server] Мониторинг памяти запущен в production режиме'); // Убрано избыточное логирование
}

// Обработчики для корректного завершения
process.on('SIGINT', async () => {
  // logger.info('[Server] Получен сигнал SIGINT, завершаем работу...'); // Убрано избыточное логирование
  memoryMonitor.stop();
  await initDbPool().then(pool => pool.end()); // Use initDbPool to get the pool
  process.exit(0);
});

process.on('SIGTERM', async () => {
  // logger.info('[Server] Получен сигнал SIGTERM, завершаем работу...'); // Убрано избыточное логирование
  memoryMonitor.stop();
  await initDbPool().then(pool => pool.end()); // Use initDbPool to get the pool
  process.exit(0);
});

module.exports = app;
