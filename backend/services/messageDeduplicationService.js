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

const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Сервис дедупликации сообщений
 * Предотвращает обработку дублирующихся сообщений
 */

// Хранилище хешей обработанных сообщений (в памяти)
const processedMessages = new Map();

// Время жизни записи о сообщении (5 минут)
const MESSAGE_TTL = 5 * 60 * 1000;

/**
 * Создать хеш сообщения
 * @param {Object} messageData - Данные сообщения
 * @returns {string} Хеш сообщения
 */
function createMessageHash(messageData) {
  const hashData = {
    userId: messageData.userId || messageData.user_id,
    content: messageData.content,
    channel: messageData.channel,
    timestamp: Math.floor(Date.now() / 1000) // Округляем до секунд
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(hashData))
    .digest('hex');
}

/**
 * Проверить, было ли сообщение уже обработано
 * @param {Object} messageData - Данные сообщения
 * @returns {boolean} true если сообщение уже обрабатывалось
 */
function isDuplicate(messageData) {
  const hash = createMessageHash(messageData);
  
  if (processedMessages.has(hash)) {
    const entry = processedMessages.get(hash);
    const now = Date.now();
    
    // Проверяем, не истек ли TTL
    if (now - entry.timestamp < MESSAGE_TTL) {
      logger.warn('[MessageDeduplication] Обнаружено дублирующееся сообщение:', hash);
      return true;
    } else {
      // TTL истек, удаляем запись
      processedMessages.delete(hash);
    }
  }
  
  return false;
}

/**
 * Пометить сообщение как обработанное
 * @param {Object} messageData - Данные сообщения
 */
function markAsProcessed(messageData) {
  const hash = createMessageHash(messageData);
  
  processedMessages.set(hash, {
    timestamp: Date.now(),
    messageData: {
      userId: messageData.userId || messageData.user_id,
      channel: messageData.channel
    }
  });
  
  // Очищаем старые записи
  cleanupOldEntries();
}

/**
 * Очистить старые записи из хранилища
 */
function cleanupOldEntries() {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [hash, entry] of processedMessages.entries()) {
    if (now - entry.timestamp > MESSAGE_TTL) {
      processedMessages.delete(hash);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    logger.debug(`[MessageDeduplication] Очищено ${cleanedCount} старых записей`);
  }
}

/**
 * Получить статистику дедупликации
 * @returns {Object}
 */
function getStats() {
  return {
    totalTracked: processedMessages.size,
    ttl: MESSAGE_TTL
  };
}

/**
 * Очистить все записи (для тестов)
 */
function clear() {
  processedMessages.clear();
  logger.info('[MessageDeduplication] Хранилище очищено');
}

// Периодическая очистка старых записей (каждую минуту)
setInterval(cleanupOldEntries, 60 * 1000);

module.exports = {
  isDuplicate,
  markAsProcessed,
  getStats,
  clear,
  createMessageHash
};

