const express = require('express');
const router = express.Router();

// Получение списка пользователей
router.get('/', (req, res) => {
  res.json({ message: 'Users API endpoint' });
});

// Получение информации о пользователе
router.get('/:address', (req, res) => {
  const { address } = req.params;
  res.json({ 
    address,
    message: 'User details endpoint' 
  });
});

module.exports = router; 