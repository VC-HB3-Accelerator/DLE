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
    const ollama = await axios.get(process.env.OLLAMA_BASE_URL ? process.env.OLLAMA_BASE_URL + '/api/tags' : 'http://ollama:11434/api/tags', { timeout: 2000 });
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

module.exports = router; 