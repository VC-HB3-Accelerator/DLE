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
const memoryMonitor = require('../utils/memoryMonitor');
const logger = require('../utils/logger');
const { checkAdminRole } = require('../services/admin-role');

// Middleware для проверки прав администратора
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    const isAdmin = await checkAdminRole(req.session.userId);
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    
    next();
  } catch (error) {
    logger.error('Error checking admin role:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// GET /api/system/memory - Получить информацию о памяти
router.get('/memory', requireAdmin, (req, res) => {
  try {
    const memoryUsage = memoryMonitor.getMemoryUsage();
    res.json({
      success: true,
      data: {
        memory: memoryUsage,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error getting memory usage:', error);
    res.status(500).json({ success: false, error: 'Failed to get memory usage' });
  }
});

// POST /api/system/memory/start - Запустить мониторинг памяти
router.post('/memory/start', requireAdmin, (req, res) => {
  try {
    const { interval } = req.body;
    memoryMonitor.start(interval || 60000);
    res.json({ success: true, message: 'Memory monitoring started' });
  } catch (error) {
    logger.error('Error starting memory monitoring:', error);
    res.status(500).json({ success: false, error: 'Failed to start memory monitoring' });
  }
});

// POST /api/system/memory/stop - Остановить мониторинг памяти
router.post('/memory/stop', requireAdmin, (req, res) => {
  try {
    memoryMonitor.stop();
    res.json({ success: true, message: 'Memory monitoring stopped' });
  } catch (error) {
    logger.error('Error stopping memory monitoring:', error);
    res.status(500).json({ success: false, error: 'Failed to stop memory monitoring' });
  }
});

// GET /api/system/health - Проверка здоровья системы
router.get('/health', (req, res) => {
  try {
    const memoryUsage = memoryMonitor.getMemoryUsage();
    const uptime = process.uptime();
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        uptime: Math.round(uptime),
        memory: memoryUsage,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error getting system health:', error);
    res.status(500).json({ success: false, error: 'Failed to get system health' });
  }
});

module.exports = router;
