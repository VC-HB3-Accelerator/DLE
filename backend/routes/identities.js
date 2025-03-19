const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const authService = require('../services/auth-service');
const logger = require('../utils/logger');

// Получение всех идентификаторов пользователя
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const identities = await authService.getUserIdentities(userId);
    res.json({ success: true, identities });
  } catch (error) {
    logger.error('Error getting identities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Связывание нового идентификатора
router.post('/link', requireAuth, async (req, res) => {
  try {
    const { type, value } = req.body;
    const userId = req.session.userId;

    await authService.linkIdentity(userId, type, value);

    // Обновляем сессию
    if (type === 'wallet') {
      req.session.address = value;
      req.session.isAdmin = await authService.checkTokensAndUpdateRole(value);
    } else if (type === 'telegram') {
      req.session.telegramId = value;
    } else if (type === 'email') {
      req.session.email = value;
    }

    res.json({ 
      success: true, 
      message: 'Identity linked successfully',
      isAdmin: req.session.isAdmin
    });
  } catch (error) {
    logger.error('Error linking identity:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

module.exports = router;
