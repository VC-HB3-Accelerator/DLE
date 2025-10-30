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

/**
 * Фильтр сообщений по языку
 * AI ассистент работает только на русском языке
 */

/**
 * Проверяет наличие кириллицы в тексте
 */
function hasCyrillic(text) {
  if (!text || typeof text !== 'string') return false;
  return /[а-яА-ЯЁё]/.test(text);
}

/**
 * Определяет процент кириллицы в тексте
 */
function getCyrillicPercentage(text) {
  if (!text) return 0;
  const cyrillicChars = (text.match(/[а-яА-ЯЁё]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  return totalChars > 0 ? (cyrillicChars / totalChars) * 100 : 0;
}

/**
 * Проверяет, является ли сообщение на русском языке
 * @param {string} message - текст сообщения
 * @param {number} minCyrillicPercent - минимальный % кириллицы (по умолчанию 10%)
 * @returns {boolean}
 */
function isRussianMessage(message, minCyrillicPercent = 10) {
  if (!message || typeof message !== 'string') return false;
  
  // Убираем пробелы и спецсимволы для точного подсчета
  const cleanText = message.trim();
  
  // Если сообщение очень короткое (например "Hi"), считаем русским
  if (cleanText.length < 10) {
    return hasCyrillic(cleanText);
  }
  
  // Для длинных сообщений проверяем процент кириллицы
  const cyrillicPercent = getCyrillicPercentage(cleanText);
  
  return cyrillicPercent >= minCyrillicPercent;
}

/**
 * Определяет, нужно ли обрабатывать сообщение AI
 * @param {string} message - текст сообщения
 * @returns {Object} { shouldProcess: boolean, reason: string }
 */
function shouldProcessWithAI(message) {
  if (!message || typeof message !== 'string') {
    return { shouldProcess: false, reason: 'Empty message' };
  }
  
  const cleanMessage = message.trim();
  
  // Проверка на русский язык
  if (!isRussianMessage(cleanMessage)) {
    return { 
      shouldProcess: false, 
      reason: 'Non-Russian message (AI works only with Russian)' 
    };
  }
  
  // Проверка на максимальный размер (опционально)
  const MAX_LENGTH = 10000;
  if (cleanMessage.length > MAX_LENGTH) {
    return { 
      shouldProcess: false, 
      reason: `Message too long (${cleanMessage.length} > ${MAX_LENGTH} chars)` 
    };
  }
  
  return { shouldProcess: true, reason: 'OK' };
}

module.exports = {
  hasCyrillic,
  getCyrillicPercentage,
  isRussianMessage,
  shouldProcessWithAI
};

