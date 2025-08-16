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

const logger = require('./logger');

class MemoryMonitor {
  constructor() {
    this.monitoring = false;
    this.interval = null;
    this.lastMemoryUsage = null;
  }

  start(intervalMs = 60000) { // По умолчанию каждую минуту
    if (this.monitoring) {
      logger.warn('[MemoryMonitor] Мониторинг уже запущен');
      return;
    }

    this.monitoring = true;
    this.interval = setInterval(() => {
      this.checkMemoryUsage();
    }, intervalMs);

    logger.info('[MemoryMonitor] Мониторинг памяти запущен');
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.monitoring = false;
    logger.info('[MemoryMonitor] Мониторинг памяти остановлен');
  }

  checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024)
    };

    // Проверяем рост памяти
    if (this.lastMemoryUsage) {
      const growth = {
        rss: memUsageMB.rss - this.lastMemoryUsage.rss,
        heapUsed: memUsageMB.heapUsed - this.lastMemoryUsage.heapUsed
      };

      // Логируем если есть значительный рост
      if (growth.rss > 50 || growth.heapUsed > 20) {
        logger.warn('[MemoryMonitor] Обнаружен рост памяти:', {
          current: memUsageMB,
          growth: growth
        });
      }
    }

    this.lastMemoryUsage = memUsageMB;

    // Логируем текущее использование памяти
    logger.info('[MemoryMonitor] Использование памяти:', memUsageMB);
  }

  getMemoryUsage() {
    const memUsage = process.memoryUsage();
    return {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024)
    };
  }

  // Проверка утечек в EventEmitter
  checkEventEmitterLeaks() {
    const eventEmitter = require('events');
    const defaultMaxListeners = eventEmitter.defaultMaxListeners;
    
    logger.info('[MemoryMonitor] EventEmitter defaultMaxListeners:', defaultMaxListeners);
    
    // Можно добавить дополнительную логику для проверки конкретных EventEmitter'ов
  }
}

module.exports = new MemoryMonitor();
