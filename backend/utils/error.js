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
 * Создает объект ошибки с указанным сообщением и кодом статуса
 * @param {string} message - Сообщение об ошибке
 * @param {number} statusCode - HTTP-код статуса (по умолчанию 500)
 * @returns {Error} Объект ошибки с дополнительными свойствами
 */
function createError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = { createError };
