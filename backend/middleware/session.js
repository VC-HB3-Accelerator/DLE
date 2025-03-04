const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('../db');

const sessionMiddleware = session({
  store: new pgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // В production должно быть true
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 часа
    sameSite: 'none', // Для работы между разными доменами
  },
});

module.exports = sessionMiddleware;
