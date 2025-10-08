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

/**
 * Утилиты для работы с шифрованием
 * Предоставляет единую точку доступа к ключу шифрования
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Кэш ключа шифрования
let cachedKey = null;

/**
 * Получить ключ шифрования из файла или переменной окружения
 * @returns {string} Ключ шифрования
 */
function getEncryptionKey() {
  // Если ключ уже закэширован, возвращаем его
  if (cachedKey) {
    return cachedKey;
  }

  // Сначала пробуем прочитать из файла (приоритет)
  // В Docker контейнере путь /app/ssl/keys/full_db_encryption.key
  // В локальной разработке ../../ssl/keys/full_db_encryption.key
  const keyPath = fs.existsSync('/app/ssl/keys/full_db_encryption.key') 
    ? '/app/ssl/keys/full_db_encryption.key'
    : path.join(__dirname, '../../ssl/keys/full_db_encryption.key');
  
  if (fs.existsSync(keyPath)) {
    try {
      cachedKey = fs.readFileSync(keyPath, 'utf8').trim();
      logger.info('[EncryptionUtils] Ключ шифрования загружен из файла');
      return cachedKey;
    } catch (error) {
      logger.error('[EncryptionUtils] Ошибка чтения ключа из файла:', error);
    }
  }

  // Если файла нет, пробуем переменную окружения
  if (process.env.ENCRYPTION_KEY) {
    cachedKey = process.env.ENCRYPTION_KEY;
    logger.info('[EncryptionUtils] Ключ шифрования загружен из переменной окружения');
    return cachedKey;
  }

  // Если ничего не найдено, бросаем ошибку
  logger.error('[EncryptionUtils] Ключ шифрования не найден ни в файле, ни в переменной окружения!');
  throw new Error('Encryption key not found');
}

/**
 * Проверить, включено ли шифрование
 * @returns {boolean}
 */
function isEnabled() {
  try {
    getEncryptionKey();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Очистить кэш ключа (для тестов)
 */
function clearCache() {
  cachedKey = null;
}

module.exports = {
  getEncryptionKey,
  isEnabled,
  clearCache
};

