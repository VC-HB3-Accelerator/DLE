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

// Функция для настройки NO_PROXY на основе RPC провайдеров из базы данных
async function configureNoProxyFromRpcProviders() {
  try {
    const rpcService = require('./services/rpcProviderService');
    const providers = await rpcService.getAllRpcProviders();
    
    const rpcDomains = providers
      .map(provider => provider.rpc_url)
      .filter(url => url && url.startsWith('http'))
      .map(url => {
        try {
          const urlObj = new URL(url);
          return urlObj.hostname;
        } catch (e) {
          return null;
        }
      })
      .filter(hostname => hostname)
      .filter((hostname, index, array) => array.indexOf(hostname) === index); // убираем дубликаты
    
    if (rpcDomains.length > 0) {
      const existingNoProxy = process.env.NO_PROXY || '';
      
      // Добавляем RPC домены к существующему NO_PROXY
      const newDomains = rpcDomains.filter(domain => !existingNoProxy.includes(domain));
      
      if (newDomains.length > 0) {
        process.env.NO_PROXY = existingNoProxy ? `${existingNoProxy},${newDomains.join(',')}` : newDomains.join(',');
        console.log('[Server] ✅ Добавлены RPC домены в NO_PROXY:', newDomains.join(', '));
        console.log('[Server] 📋 Обновленный NO_PROXY:', process.env.NO_PROXY);
      } else {
        console.log('[Server] ℹ️ Все RPC домены уже в NO_PROXY');
      }
    } else {
      console.warn('[Server] ⚠️ Не найдено RPC провайдеров для настройки NO_PROXY');
    }
  } catch (error) {
    console.warn('[Server] ❌ Не удалось загрузить RPC провайдеры для NO_PROXY:', error.message);
  }
}

// Экспортируем функцию для использования в других модулях
module.exports.configureNoProxyFromRpcProviders = configureNoProxyFromRpcProviders;

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
  
  // Настройка NO_PROXY для RPC провайдеров из базы данных
  await configureNoProxyFromRpcProviders();
  
  // Инициализация AI ассистента В ФОНЕ (неблокирующая)
  seedAIAssistantSettings().catch(error => {
    console.warn('[Server] Ollama недоступен, AI ассистент будет инициализирован позже:', error.message);
  });
  
  // ⏳ НОВОЕ: Ожидание готовности Ollama перед запуском ботов
  const { waitForOllama } = require('./utils/waitForOllama');
  
  // Запускаем ожидание Ollama в фоне (не блокируем старт сервера)
  waitForOllama({
    maxWaitTime: 4 * 60 * 1000,  // 4 минуты
    retryInterval: 5000,          // 5 секунд между попытками
    required: false               // Не обязательно - запустим боты даже без Ollama
  })
    .then((ollamaReady) => {
      if (ollamaReady) {
        console.log('[Server] ✅ Ollama готов к работе');
      } else {
        console.warn('[Server] ⚠️ Ollama не готов, боты будут работать с ограниченным функционалом AI');
      }
      
      // Инициализация ботов ПОСЛЕ ожидания Ollama
      console.log('[Server] ▶️ Импортируем BotManager...');
      const botManager = require('./services/botManager');
      console.log('[Server] ▶️ Вызываем botManager.initialize()...');
      
      return botManager.initialize();
    })
    .then(() => {
      console.log('[Server] ✅ botManager.initialize() завершен');
      
      // ✨ Запускаем AI Queue Worker после инициализации ботов
      if (process.env.USE_AI_QUEUE !== 'false') {
        const ragService = require('./services/ragService');
        ragService.startQueueWorker();
        console.log('[Server] ✅ AI Queue Worker запущен');
      }
    })
    .catch(error => {
      console.error('[Server] ❌ Ошибка инициализации:', error.message);
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
    // ✨ Останавливаем AI Queue Worker
    if (process.env.USE_AI_QUEUE !== 'false') {
      const ragService = require('./services/ragService');
      ragService.stopQueueWorker();
      console.log('[Server] ✅ AI Queue Worker остановлен');
    }
    
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
    // ✨ Останавливаем AI Queue Worker
    if (process.env.USE_AI_QUEUE !== 'false') {
      const ragService = require('./services/ragService');
      ragService.stopQueueWorker();
      console.log('[Server] ✅ AI Queue Worker остановлен');
    }
    
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
