const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    // Логируем только медленные запросы (>1000ms) и ошибки
    if (duration > 1000 || res.statusCode >= 400) {
      logger.warn(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
    }
  });

  next();
};

module.exports = requestLogger;
