require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const session = require('express-session');
const { app, nonceStore } = require('./app');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const identitiesRouter = require('./routes/identities');
const chatRouter = require('./routes/chat');
const { pool } = require('./db');
const helmet = require('helmet');
const { getBot, stopBot } = require('./services/telegramBot');
const pgSession = require('connect-pg-simple')(session);
const authService = require('./services/auth-service');
const logger = require('./utils/logger');
const EmailBotService = require('./services/emailBot.js');

const PORT = process.env.PORT || 8000;

console.log('Начало выполнения server.js');
console.log('Переменная окружения PORT:', process.env.PORT);
console.log('Используемый порт:', process.env.PORT || 8000);

// Инициализация сервисов
async function initServices() {
  try {
    console.log('Инициализация сервисов...');

    // Останавливаем предыдущий экземпляр бота
    console.log('Перед stopBot');
    await stopBot();
    console.log('После stopBot, перед getBot');
    getBot();
    console.log('После getBot, перед созданием EmailBotService');

    // Добавляем обработку ошибок при запуске бота
    try {
      console.log('Пробуем создать экземпляр EmailBotService');

      // Запуск email-бота
      console.log('Создаём экземпляр EmailBotService');
      // const emailBot = new EmailBotService();
      // await emailBot.start();

      // Добавляем graceful shutdown
      process.once('SIGINT', async () => {
        await stopBot();
        process.exit(0);
      });
      process.once('SIGTERM', async () => {
        await stopBot();
        process.exit(0);
      });
    } catch (error) {
      if (error.code === 409) {
        logger.warn(
          'Another instance of Telegram bot is running. This is normal during development with nodemon'
        );
        // Просто логируем ошибку и продолжаем работу
        // Бот будет запущен при следующем перезапуске
      } else {
        logger.error('Error launching Telegram bot:', error);
        console.error('Ошибка при запуске Telegram-бота:', error);
      }
    }

    console.log('Все сервисы успешно инициализированы');
  } catch (error) {
    console.error('Ошибка при инициализации сервисов:', error);
  }
}

// Настройка сессий
app.use(
  session({
    store: new pgSession({
      pool: pool,
      tableName: 'session',
    }),
    secret: process.env.SESSION_SECRET || 'hb3atoken',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
    },
  })
);

// Маршруты API
app.use('/api/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/identities', identitiesRouter);
app.use('/api/chat', chatRouter);

// Эндпоинт для проверки состояния сервера
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Для отладки
// const host = app.get('host');
// console.log('host:', host);
app.listen(PORT, async () => {
  try {
    await initServices();
    console.log(`Server is running on port ${PORT}`);
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
