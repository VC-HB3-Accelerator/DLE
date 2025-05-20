const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const authService = require('../services/auth-service');

// Получение балансов токенов пользователя по токенам из базы
router.get('/balances', async (req, res) => {
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
    res.status(500).json({ success: false, error: 'Failed to fetch token balances' });
  }
});

module.exports = router;
