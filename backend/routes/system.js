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
 * Системные endpoints для управления готовностью системы
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * HTTP fallback endpoint для Ollama контейнера
 * Используется когда WebSocket недоступен
 */
router.post('/ollama-ready', async (req, res) => {
  try {
    logger.info('[System] 🔌 Ollama готов к работе');
    res.json({
      success: true,
      message: 'Ollama готов'
    });
  } catch (error) {
    logger.error('[System] ❌ Ошибка:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Endpoint для проверки статуса системы
 */
router.get('/status', (req, res) => {
  try {
    const botManager = require('../services/botManager');
    res.json({
      systemReady: true, // Система всегда готова после запуска
      botsInitialized: botManager.isInitialized,
      bots: botManager.getStatus(),
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('[System] Ошибка получения статуса:', error);
    
    res.status(500).json({
      error: error.message,
      timestamp: Date.now()
    });
  }
});

module.exports = router;