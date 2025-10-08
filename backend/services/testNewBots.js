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

const logger = require('../utils/logger');
const botManager = require('./botManager');
const WebBot = require('./webBot');
const TelegramBot = require('./telegramBot');
const EmailBot = require('./emailBot');

/**
 * Тестовый скрипт для проверки новой архитектуры ботов
 * Используется для отладки и тестирования ботов
 */

/**
 * Тест Web Bot
 */
async function testWebBot() {
  console.log('\n=== ТЕСТ WEB BOT ===');
  
  try {
    const webBot = new WebBot();
    
    // Инициализация
    const initResult = await webBot.initialize();
    console.log('✓ Инициализация:', initResult);
    
    // Статус
    const status = webBot.getStatus();
    console.log('✓ Статус:', status);
    
    // Тестовое сообщение
    const testMessage = {
      userId: 1,
      content: 'Тестовое сообщение',
      channel: 'web'
    };
    
    console.log('✓ Web Bot тест пройден');
    return true;
    
  } catch (error) {
    console.error('✗ Ошибка Web Bot:', error.message);
    return false;
  }
}

/**
 * Тест Telegram Bot
 */
async function testTelegramBot() {
  console.log('\n=== ТЕСТ TELEGRAM BOT ===');
  
  try {
    const telegramBot = new TelegramBot();
    
    // Инициализация
    const initResult = await telegramBot.initialize();
    console.log('✓ Инициализация:', initResult);
    
    // Статус
    const status = telegramBot.getStatus ? telegramBot.getStatus() : {
      isInitialized: telegramBot.isInitialized,
      status: telegramBot.status
    };
    console.log('✓ Статус:', status);
    
    console.log('✓ Telegram Bot тест пройден');
    return true;
    
  } catch (error) {
    console.error('✗ Ошибка Telegram Bot:', error.message);
    return false;
  }
}

/**
 * Тест Email Bot
 */
async function testEmailBot() {
  console.log('\n=== ТЕСТ EMAIL BOT ===');
  
  try {
    const emailBot = new EmailBot();
    
    // Инициализация
    const initResult = await emailBot.initialize();
    console.log('✓ Инициализация:', initResult);
    
    // Статус
    const status = emailBot.getStatus ? emailBot.getStatus() : {
      isInitialized: emailBot.isInitialized,
      status: emailBot.status
    };
    console.log('✓ Статус:', status);
    
    console.log('✓ Email Bot тест пройден');
    return true;
    
  } catch (error) {
    console.error('✗ Ошибка Email Bot:', error.message);
    return false;
  }
}

/**
 * Тест Bot Manager
 */
async function testBotManager() {
  console.log('\n=== ТЕСТ BOT MANAGER ===');
  
  try {
    // Инициализация
    await botManager.initialize();
    console.log('✓ BotManager инициализирован');
    
    // Проверка готовности
    const isReady = botManager.isReady();
    console.log('✓ isReady:', isReady);
    
    // Получение статуса
    const status = botManager.getStatus();
    console.log('✓ Статус всех ботов:', status);
    
    // Получение конкретных ботов
    const webBot = botManager.getBot('web');
    const telegramBot = botManager.getBot('telegram');
    const emailBot = botManager.getBot('email');
    
    console.log('✓ Web Bot:', webBot ? 'OK' : 'NOT FOUND');
    console.log('✓ Telegram Bot:', telegramBot ? 'OK' : 'NOT FOUND');
    console.log('✓ Email Bot:', emailBot ? 'OK' : 'NOT FOUND');
    
    console.log('✓ Bot Manager тест пройден');
    return true;
    
  } catch (error) {
    console.error('✗ Ошибка Bot Manager:', error.message);
    return false;
  }
}

/**
 * Запустить все тесты
 */
async function runAllTests() {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   ТЕСТИРОВАНИЕ НОВОЙ АРХИТЕКТУРЫ БОТОВ   ║');
  console.log('╚═══════════════════════════════════════╝');
  
  const results = {
    webBot: false,
    telegramBot: false,
    emailBot: false,
    botManager: false
  };
  
  try {
    // Тестируем каждый компонент
    results.webBot = await testWebBot();
    results.telegramBot = await testTelegramBot();
    results.emailBot = await testEmailBot();
    results.botManager = await testBotManager();
    
    // Итоги
    console.log('\n╔═══════════════════════════════════════╗');
    console.log('║            ИТОГИ ТЕСТИРОВАНИЯ            ║');
    console.log('╚═══════════════════════════════════════╝');
    console.log('Web Bot:       ', results.webBot ? '✓ PASS' : '✗ FAIL');
    console.log('Telegram Bot:  ', results.telegramBot ? '✓ PASS' : '✗ FAIL');
    console.log('Email Bot:     ', results.emailBot ? '✓ PASS' : '✗ FAIL');
    console.log('Bot Manager:   ', results.botManager ? '✓ PASS' : '✗ FAIL');
    
    const allPassed = Object.values(results).every(r => r === true);
    console.log('\nОБЩИЙ РЕЗУЛЬТАТ:', allPassed ? '✓ ВСЕ ТЕСТЫ ПРОЙДЕНЫ' : '✗ ЕСТЬ ОШИБКИ');
    
    return allPassed;
    
  } catch (error) {
    logger.error('[TestNewBots] Критическая ошибка:', error);
    return false;
  }
}

// Если запущен напрямую как скрипт
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('КРИТИЧЕСКАЯ ОШИБКА:', error);
      process.exit(1);
    });
}

module.exports = {
  testWebBot,
  testTelegramBot,
  testEmailBot,
  testBotManager,
  runAllTests
};

