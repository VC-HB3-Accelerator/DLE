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

const db = require('../db');

// Функция для создания задержки
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Функция для валидации email адреса
function isValidEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

// Генерация кода подтверждения
function generateVerificationCode(length = 6) {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length)
    .toUpperCase();
}

// Проверка существования идентификатора пользователя
async function checkUserIdentity(userId, provider, providerId) {
  const result = await db.getQuery()(
    'SELECT * FROM user_identities WHERE user_id = $1 AND provider = $2 AND provider_id = $3',
    [userId, provider, providerId]
  );
  return result.rows.length > 0;
}

// Добавление новой идентификации
async function addUserIdentity(userId, provider, providerId) {
  try {
    await db.getQuery()(
      'INSERT INTO user_identities (user_id, provider, provider_id) VALUES ($1, $2, $3)',
      [userId, provider, providerId]
    );
    return true;
  } catch (error) {
    if (error.code === '23505') {
      // Уникальное ограничение нарушено
      return false;
    }
    throw error;
  }
}

module.exports = {
  sleep,
  isValidEmail,
  generateVerificationCode,
  checkUserIdentity,
  addUserIdentity,
};
