const express = require('express');
const cors = require('cors');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('./db');
const helmet = require('helmet');
const path = require('path');
const logger = require('./utils/logger');
const authService = require('./services/auth-service');

// Импорт маршрутов
const authRoutes = require('./routes/auth');
const accessRoutes = require('./routes/access');
const usersRoutes = require('./routes/users');
const contractsRoutes = require('./routes/contracts');
const rolesRoutes = require('./routes/roles');
const identitiesRoutes = require('./routes/identities');
// const conversationsRoutes = require('./routes/conversations');
const messagesRoutes = require('./routes/messages');
const chatRoutes = require('./routes/chat');
const healthRoutes = require('./routes/health');
const debugRoutes = require('./routes/debug');

const app = express();

// Настройка middleware для сессий
app.use(session({
  store: new pgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
  },
}));

// Настройка парсеров
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Настройка CORS
app.use(cors({
  origin: function(origin, callback) {
    // Разрешаем запросы с localhost и 127.0.0.1
    const allowedOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.CORS_ORIGIN
    ].filter(Boolean);
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Настройка безопасности
app.use(helmet({
  contentSecurityPolicy: false // Отключаем CSP для разработки
}));

// Логирование запросов
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Добавляем middleware для установки заголовков CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// Маршруты API
app.use('/api/auth', authRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/identities', identitiesRoutes);
// app.use('/api/conversations', conversationsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/health', healthRoutes);

// Маршруты для отладки (только в режиме разработки)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/debug', debugRoutes);
}

const nonceStore = new Map(); // или любая другая реализация хранилища nonce

console.log('SESSION_SECRET:', process.env.SESSION_SECRET);

module.exports = { app, nonceStore };
