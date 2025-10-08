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
const deploymentWebSocketService = require('./services/deploymentWebSocketService');
const logger = require('./utils/logger');
// systemReadinessService удален - теперь используется WebSocket endpoint
const { initDbPool, seedAIAssistantSettings } = require('./db');
const memoryMonitor = require('./utils/memoryMonitor');

const PORT = process.env.PORT || 8000;

// console.log('Начало выполнения server.js');
// console.log('Переменная окружения PORT:', process.env.PORT);
// console.log('Используемый порт:', process.env.PORT || 8000);

const server = http.createServer(app);
initWSS(server);

async function startServer() {
  await initDbPool();
  
  // Инициализация AI ассистента В ФОНЕ (неблокирующая)
  seedAIAssistantSettings().catch(error => {
    console.warn('[Server] Ollama недоступен, AI ассистент будет инициализирован позже:', error.message);
  });
  
  // Инициализация ботов сразу при старте (не ждем Ollama)
  console.log('[Server] ▶️ Импортируем BotManager...');
  const botManager = require('./services/botManager');
  console.log('[Server] ▶️ Вызываем botManager.initialize()...');
  botManager.initialize()
    .then(() => console.log('[Server] ✅ botManager.initialize() завершен'))
    .catch(error => {
      console.error('[Server] ❌ Ошибка botManager.initialize():', error.message);
      logger.error('[Server] Ошибка инициализации ботов:', error);
    });
  
  console.log(`✅ Server is running on port ${PORT}`);
}

server.listen(PORT, '0.0.0.0', async () => {
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
  console.log('[Server] Получен SIGINT, завершаем работу...');
  try {
    // Останавливаем боты
    const botManager = require('./services/botManager');
    if (botManager.isInitialized) {
      console.log('[Server] Останавливаем боты...');
      await botManager.stop();
    }
    memoryMonitor.stop();
    await initDbPool().then(pool => pool.end());
  } catch (error) {
    console.error('[Server] Ошибка при завершении:', error);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[Server] Получен SIGTERM, завершаем работу...');
  try {
    // Останавливаем боты
    const botManager = require('./services/botManager');
    if (botManager.isInitialized) {
      console.log('[Server] Останавливаем боты...');
      await botManager.stop();
    }
    memoryMonitor.stop();
    await initDbPool().then(pool => pool.end());
  } catch (error) {
    console.error('[Server] Ошибка при завершении:', error);
  }
  process.exit(0);
});

module.exports = app;
