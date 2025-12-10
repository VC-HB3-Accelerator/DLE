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

const { AppError, ErrorTypes } = require('../utils/error');
const logger = require('../utils/logger');
const { ERROR_CODES } = require('../utils/constants');

/**
 * Middleware для обработки ошибок
 */
const errorHandler = (err, req, res, next) => {
  // console.log('errorHandler called, arguments:', arguments);
  // console.log('typeof res:', typeof res, 'isFunction:', typeof res === 'function');
  // console.error('errorHandler: err =', err);
  // console.error('errorHandler: typeof err =', typeof err);
  // console.error('errorHandler: stack =', err && err.stack);
  // Логируем ошибку
  logger.error(`Error: ${err.message}`, {
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.session?.userId,
  });

  // Определяем тип ошибки
  let statusCode = 500;
  let errorCode = ERROR_CODES.INTERNAL_ERROR;
  let errorMessage = 'Внутренняя ошибка сервера';

  // Обрабатываем разные типы ошибок
  if (err.name === 'UnauthorizedError' || err.status === 401) {
    statusCode = 401;
    errorCode = ERROR_CODES.UNAUTHORIZED;
    errorMessage = 'Требуется аутентификация';
  } else if (err.status === 403) {
    statusCode = 403;
    errorCode = ERROR_CODES.FORBIDDEN;
    errorMessage = 'Доступ запрещен';
  } else if (err.status === 404) {
    statusCode = 404;
    errorCode = ERROR_CODES.NOT_FOUND;
    errorMessage = 'Ресурс не найден';
  } else if (err.status === 400) {
    statusCode = 400;
    errorCode = ERROR_CODES.BAD_REQUEST;
    errorMessage = err.message || 'Некорректный запрос';
  }

  // В режиме разработки возвращаем стек ошибки
  const devError = process.env.NODE_ENV === 'development' ? { stack: err.stack } : {};

  // Проверяем, что ответ еще не был отправлен и соединение не закрыто
  if (res.headersSent || res.destroyed) {
    console.error('[errorHandler] Ответ уже отправлен или соединение закрыто, пропускаем обработку ошибки');
    return;
  }

  // Для ошибок подключения к БД возвращаем понятное сообщение
  if (err.message && err.message.includes('timeout exceeded when trying to connect')) {
    errorMessage = 'Ошибка подключения к базе данных. Попробуйте позже.';
    statusCode = 503; // Service Unavailable
  }

  // Проверяем еще раз перед отправкой (может измениться состояние)
  if (res.headersSent || res.destroyed) {
    console.error('[errorHandler] Состояние изменилось, пропускаем отправку ответа');
    return;
  }

  // Отправляем ответ клиенту
  // Используем формат, совместимый с frontend (success: false, message: string)
  try {
    // Финальная проверка перед отправкой - состояние могло измениться
    if (res.headersSent || res.destroyed || res.finished || !res.writable) {
      console.error('[errorHandler] Финальная проверка: ответ уже отправлен, соединение закрыто или завершено');
      return;
    }
    
    // Проверяем writableEnded - новый флаг в Node.js
    if (res.writableEnded) {
      console.error('[errorHandler] Ответ уже завершен (writableEnded)');
      return;
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: {
        code: errorCode,
        message: errorMessage,
        ...devError,
      },
    });
  } catch (sendErr) {
    // Если произошла ошибка при отправке (например, соединение закрыто), просто логируем
    // Игнорируем ошибки, связанные с уже отправленными заголовками или закрытым соединением
    if (sendErr.code !== 'ERR_HTTP_HEADERS_SENT' && 
        sendErr.code !== 'ECONNRESET' && 
        sendErr.code !== 'EPIPE' &&
        !sendErr.message?.includes('Cannot set headers after they are sent')) {
      console.error('[errorHandler] Ошибка при отправке ответа:', sendErr.message);
    }
  }
}

/**
 * Функция для создания ошибок с определенным статусом
 * @param {string} message - Сообщение об ошибке
 * @param {number} status - HTTP-статус ошибки
 * @returns {Error} - Объект ошибки
 */
function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = errorHandler;
// Если нужен createError для других файлов:
// module.exports.createError = createError;
