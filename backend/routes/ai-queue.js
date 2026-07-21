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

const express = require('express');
const router = express.Router();
const aiQueueService = require('../services/ai-queue');
const { requireAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

// Получение статистики очереди
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const stats = aiQueueService.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('[AIQueue] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get queue statistics'
    });
  }
});

// Добавление задачи в очередь
router.post('/task', requireAuth, async (req, res) => {
  try {
    const { ROLES } = require('/app/shared/permissions');
    const { message, language, history, systemPrompt, rules, type = 'chat' } = req.body;
    const userId = req.session.userId;
    const userAccessLevel = req.session.userAccessLevel || { level: ROLES.USER, tokenCount: 0, hasAccess: false };
    const userRole = userAccessLevel.level;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    if (Array.isArray(history)) {
      for (const h of history.slice(-8)) {
        if (h?.role && h?.content) messages.push({ role: h.role, content: h.content });
      }
    }
    messages.push({ role: 'user', content: message });

    const { PRIORITY } = require('../services/ai-queue');
    const responseText = await aiQueueService.addTask({
      messages,
      type,
      userId,
      userRole,
      language: language || null,
      rules: rules || null,
      returnFullResponse: false,
      priority: PRIORITY.CHAT
    });

    res.json({
      success: true,
      data: {
        response: responseText,
        status: 'completed',
        estimatedWaitTime: aiQueueService.getStats().currentQueueSize * 30
      }
    });

  } catch (error) {
    logger.error('[AIQueue] Error adding task:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add task to queue'
    });
  }
});

// Получение статуса задачи
router.get('/task/:taskId', requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const stats = aiQueueService.getStats();
    
    // Простая реализация - в реальном проекте нужно хранить статусы задач
    res.json({
      success: true,
      data: {
        taskId,
        status: 'processing', // Упрощенная реализация
        queuePosition: stats.currentQueueSize,
        estimatedWaitTime: stats.currentQueueSize * 30
      }
    });
  } catch (error) {
    logger.error('[AIQueue] Error getting task status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get task status'
    });
  }
});

// Управление очередью (только для администраторов)
router.post('/control', requireAuth, async (req, res) => {
  try {
    const { action } = req.body;
    
    if (!req.session.userAccessLevel?.hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    switch (action) {
      case 'pause':
        aiQueueService.pause();
        res.json({
          success: true,
          message: 'Queue paused'
        });
        break;
        
      case 'resume':
        aiQueueService.resume();
        res.json({
          success: true,
          message: 'Queue resumed'
        });
        break;
        
      case 'clear':
        aiQueueService.clear();
        res.json({
          success: true,
          message: 'Queue cleared'
        });
        break;
        
      default:
        res.status(400).json({
          success: false,
          error: 'Invalid action. Use: pause, resume, or clear'
        });
    }
  } catch (error) {
    logger.error('[AIQueue] Error controlling queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to control queue'
    });
  }
});

// Получение информации о производительности
router.get('/performance', requireAuth, async (req, res) => {
  try {
    const stats = aiQueueService.getStats();
    
    const performance = {
      successRate: stats.totalProcessed > 0 ? 
        ((stats.totalProcessed - stats.totalFailed) / stats.totalProcessed * 100).toFixed(2) : 0,
      averageProcessingTime: Math.round(stats.averageProcessingTime),
      totalProcessed: stats.totalProcessed,
      totalFailed: stats.totalFailed,
      currentQueueSize: stats.currentQueueSize,
      runningTasks: stats.runningTasks,
      lastProcessedAt: stats.lastProcessedAt
    };

    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    logger.error('[AIQueue] Error getting performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get performance data'
    });
  }
});

module.exports = router; 