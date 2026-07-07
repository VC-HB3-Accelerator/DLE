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
const logger = require('../utils/logger');
const emailTrackingService = require('../services/emailTrackingService');

router.get('/track/:token', async (req, res) => {
  const token = String(req.params.token || '').replace(/\.gif$/i, '');

  try {
    const result = await emailTrackingService.recordOpen(token, {
      userAgent: req.get('user-agent'),
      ip: req.ip
    });
    if (!result) {
      logger.warn(`[EmailTracking] Unknown tracking token requested: ${token.slice(0, 8)}...`);
    }
  } catch (error) {
    logger.warn('[EmailTracking] Failed to record open:', error.message);
  }

  res.set({
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
    Expires: '0'
  });
  res.status(200).send(emailTrackingService.TRANSPARENT_GIF);
});

module.exports = router;
