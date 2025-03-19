require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const EmailBotService = require('./services/emailBot');
const session = require('express-session');
const { app, nonceStore } = require('./app');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const identitiesRouter = require('./routes/identities');
const { pool } = require('./db');
const helmet = require('helmet');
const TelegramBotService = require('./services/telegramBot');
const pgSession = require('connect-pg-simple')(session);
const authService = require('./services/auth-service');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 8000;

console.log('Начало выполнения server.js');
console.log('Переменная окружения PORT:', process.env.PORT);
console.log('Используемый порт:', process.env.PORT || 8000);

// Инициализация сервисов
async function initServices() {
  try {
    console.log('Инициализация сервисов...');

    if (process.env.TELEGRAM_BOT_TOKEN) {
      const telegramBot = new TelegramBotService(process.env.TELEGRAM_BOT_TOKEN);
      global.telegramBot = telegramBot; // Сохраняем экземпляр глобально
      console.log('Telegram бот инициализирован');
    }

    console.log('Все сервисы успешно инициализированы');
  } catch (error) {
    console.error('Ошибка при инициализации сервисов:', error);
  }
}

// Настройка сессий
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET || 'hb3atoken',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 дней
  }
}));

// Маршруты API
app.use('/api/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/identities', identitiesRouter);

// Эндпоинт для проверки состояния сервера
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Запуск сервера
app.listen(PORT, async () => {
  try {
    await initServices();
    console.log('Server is running on port', PORT);
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
});

// Обработка ошибок
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
});

module.exports = app;
