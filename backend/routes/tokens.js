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

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const authService = require('../services/auth-service');

// Получение балансов токенов пользователя по токенам из базы
router.get('/balances', async (req, res, next) => {
  try {
    const address = req.query.address;
    if (!address) {
      return res.status(400).json({ success: false, error: 'Не указан адрес кошелька' });
    }
    logger.info(`Fetching token balances for address: ${address}`);
    const balances = await authService.getUserTokenBalances(address);
    res.json({ success: true, data: balances });
  } catch (error) {
    logger.error('Error fetching token balances:', error);
    next(error);
  }
});

module.exports = router;
