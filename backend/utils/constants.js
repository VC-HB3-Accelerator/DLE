/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

// Типы идентификаторов
const IDENTITY_TYPES = {
  WALLET: 'wallet',
  EMAIL: 'email',
  TELEGRAM: 'telegram',
};

// Каналы сообщений
const MESSAGE_CHANNELS = {
  WEB: 'web',
  TELEGRAM: 'telegram',
  EMAIL: 'email',
};

// Коды ошибок
const ERROR_CODES = {
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  INTERNAL_ERROR: 'internal_error',
  BAD_REQUEST: 'bad_request',
};

// Настройки сессии
const SESSION_CONFIG = {
  COOKIE_MAX_AGE: 24 * 60 * 60 * 1000, // 24 часа
  COOKIE_SECURE: process.env.NODE_ENV === 'production',
  COOKIE_SAME_SITE: 'lax',
};

// Настройки API
const API_CONFIG = {
  RATE_LIMIT: 100, // запросов в минуту
  TIMEOUT: 30000, // 30 секунд
};

// Новые константы для ИИ-ассистента (без admin)
const AI_USER_TYPES = {
  REGULAR_USER: 'user',
  EDITOR: 'editor', 
  READONLY: 'readonly'
};

const AI_SENDER_TYPES = {
  USER: 'user',
  EDITOR: 'editor',
  READONLY: 'readonly',
  ASSISTANT: 'assistant'
};

module.exports = {
  IDENTITY_TYPES,
  MESSAGE_CHANNELS,
  ERROR_CODES,
  SESSION_CONFIG,
  API_CONFIG,
  // Константы для ИИ-ассистента
  AI_USER_TYPES,
  AI_SENDER_TYPES,
};
