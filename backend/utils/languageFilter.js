/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
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
 * Фильтр сообщений по языку.
 * AI принимает русский и английский (кириллица или латиница).
 */

function hasCyrillic(text) {
  if (!text || typeof text !== 'string') return false;
  return /[а-яА-ЯЁё]/.test(text);
}

function hasLatin(text) {
  if (!text || typeof text !== 'string') return false;
  return /[a-zA-Z]/.test(text);
}

function getCyrillicPercentage(text) {
  if (!text) return 0;
  const cyrillicChars = (text.match(/[а-яА-ЯЁё]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  return totalChars > 0 ? (cyrillicChars / totalChars) * 100 : 0;
}

function getLatinPercentage(text) {
  if (!text) return 0;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  return totalChars > 0 ? (latinChars / totalChars) * 100 : 0;
}

/**
 * @param {string} message
 * @param {number} minCyrillicPercent
 * @returns {boolean}
 */
function isRussianMessage(message, minCyrillicPercent = 10) {
  if (!message || typeof message !== 'string') return false;
  const cleanText = message.trim();
  if (cleanText.length < 10) {
    return hasCyrillic(cleanText);
  }
  return getCyrillicPercentage(cleanText) >= minCyrillicPercent;
}

/**
 * Английский / латиница. Порог тот же, что minCyrillicPercent в настройках диалога.
 * @param {string} message
 * @param {number} minLatinPercent
 * @returns {boolean}
 */
function isEnglishMessage(message, minLatinPercent = 10) {
  if (!message || typeof message !== 'string') return false;
  const cleanText = message.trim();
  if (cleanText.length < 10) {
    return hasLatin(cleanText);
  }
  return getLatinPercentage(cleanText) >= minLatinPercent;
}

function isAllowedChatLanguage(message, minLetterPercent = 10) {
  return isRussianMessage(message, minLetterPercent)
    || isEnglishMessage(message, minLetterPercent);
}

/**
 * @param {string} message
 * @returns {Promise<{ shouldProcess: boolean, reason: string }>}
 */
async function shouldProcessWithAI(message, options = {}) {
  const hasMedia = Boolean(options.hasMedia);
  const cleanMessage = typeof message === 'string' ? message.trim() : '';

  if (hasMedia && (!cleanMessage || /^\[(audio|video|video_note|image|file)\]$/i.test(cleanMessage))) {
    return { shouldProcess: true, reason: 'media_only' };
  }

  if (!message || typeof message !== 'string') {
    return { shouldProcess: false, reason: 'Empty message' };
  }

  let minLetterPercent = 10;
  let maxMessageLength = 10000;
  try {
    const aiConfigService = require('../services/aiConfigService');
    const dialog = await aiConfigService.getDialogSettings();
    if (dialog) {
      if (Number(dialog.minCyrillicPercent) >= 0) minLetterPercent = Number(dialog.minCyrillicPercent);
      if (Number(dialog.maxMessageLength) > 0) maxMessageLength = Number(dialog.maxMessageLength);
    }
  } catch (_) { /* defaults */ }

  if (!isAllowedChatLanguage(cleanMessage, minLetterPercent)) {
    return {
      shouldProcess: false,
      reason: 'Unsupported language (AI accepts Russian or English)'
    };
  }

  if (cleanMessage.length > maxMessageLength) {
    return {
      shouldProcess: false,
      reason: `Message too long (${cleanMessage.length} > ${maxMessageLength} chars)`
    };
  }

  return { shouldProcess: true, reason: 'OK' };
}

module.exports = {
  hasCyrillic,
  hasLatin,
  getCyrillicPercentage,
  getLatinPercentage,
  isRussianMessage,
  isEnglishMessage,
  isAllowedChatLanguage,
  shouldProcessWithAI
};
