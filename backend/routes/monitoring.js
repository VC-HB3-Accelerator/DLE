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

const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../db');
const aiAssistant = require('../services/ai-assistant');
const aiCache = require('../services/ai-cache');
const logger = require('../utils/logger');
const ollamaConfig = require('../services/ollamaConfig');

router.get('/', async (req, res) => {
  const results = {};
  // Backend
  results.backend = { status: 'ok' };

  // Vector Search
  try {
    const baseUrl = process.env.VECTOR_SEARCH_URL || 'http://vector-search:8001';
    const healthUrl = baseUrl.replace(/\/$/, '') + '/health';
    const vs = await axios.get(healthUrl, { timeout: 2000 });
    results.vectorSearch = { status: 'ok', ...vs.data };
  } catch (e) {
    console.log('Vector Search error:', e.message, 'Status:', e.response?.status);
    results.vectorSearch = { status: 'error', error: e.message };
  }

  // Ollama
  try {
    const ollamaConfig = require('../services/ollamaConfig');
    const ollama = await axios.get(ollamaConfig.getApiUrl('tags'), { timeout: 2000 });
    results.ollama = { status: 'ok', models: ollama.data.models?.length || 0 };
  } catch (e) {
    results.ollama = { status: 'error', error: e.message };
  }

  // PostgreSQL
  try {
    await db.query('SELECT 1');
    results.postgres = { status: 'ok' };
  } catch (e) {
    results.postgres = { status: 'error', error: e.message };
  }

  res.json({ status: 'ok', services: results, timestamp: new Date().toISOString() });
});

// GET /api/monitoring/ai-stats - статистика AI
router.get('/ai-stats', async (req, res) => {
  try {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      ai: {
        health: 'ok',
        model: ollamaConfig.getDefaultModel(),
        baseUrl: ollamaConfig.getBaseUrl()
      },
      cache: {
        size: 0,
        maxSize: 100,
        hitRate: 0
      },
      queue: {
        totalAdded: 0,
        totalProcessed: 0,
        totalFailed: 0,
        averageProcessingTime: 0,
        currentQueueSize: 0,
        lastProcessedAt: null,
        uptime: 0
      }
    });
  } catch (error) {
    logger.error('Error getting AI stats:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// POST /api/monitoring/ai-cache/clear - очистка кэша
router.post('/ai-cache/clear', async (req, res) => {
  try {
    aiCache.clear();
    res.json({
      status: 'ok',
      message: 'AI cache cleared successfully'
    });
  } catch (error) {
    logger.error('Error clearing AI cache:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// POST /api/monitoring/ai-queue/clear - очистка очереди
router.post('/ai-queue/clear', async (req, res) => {
  try {
    aiAssistant.aiQueue.clearQueue();
    res.json({
      status: 'ok',
      message: 'AI queue cleared successfully'
    });
  } catch (error) {
    logger.error('Error clearing AI queue:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

module.exports = router; 