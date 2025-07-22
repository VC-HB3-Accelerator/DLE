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
const { ragAnswer, generateLLMResponse } = require('../services/ragService');

router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'RAG service is running' });
});

router.post('/answer', async (req, res) => {
  const { tableId, question, product, systemPrompt, priority, date, rules, history, model, language } = req.body;
  try {
    const ragResult = await ragAnswer({ tableId, userQuestion: question, product });
    const llmResponse = await generateLLMResponse({
      userQuestion: question,
      context: ragResult.context,
      clarifyingAnswer: ragResult.clarifyingAnswer,
      objectionAnswer: ragResult.objectionAnswer,
      answer: ragResult.answer,
      systemPrompt,
      product,
      priority: priority || ragResult.priority,
      date: date || ragResult.date,
      rules,
      history,
      model,
      language
    });
    res.json({ ...ragResult, llmResponse });
  } catch (e) {
    console.error('[RAG] Error in /answer route:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router; 