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

const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const db = require('../db');
const crypto = require('crypto');

let onPoolChangeCallback = null;

function setPoolChangeCallback(cb) {
  onPoolChangeCallback = cb;
}

let sessionMiddleware = createSessionMiddleware();

function createSessionMiddleware() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return session({
    store: new pgSession({
      pool: db.getPool(),
      tableName: 'session',
      // Обработка ошибок подключения к БД для сессий
      errorLog: (err) => {
        // Логируем только как предупреждение, не как критическую ошибку
        // Таймауты подключения - это нормальная ситуация при перегрузке
        if (err && err.message && err.message.includes('timeout exceeded')) {
          console.warn('[session] Timeout подключения к БД для сессии (не критично):', err.message);
        } else if (err) {
          console.error('[session] Ошибка подключения к БД для сессии:', err.message);
        }
      },
    }),
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    name: 'sessionId',
    resave: true,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: false,  // false для локального Docker (HTTP)
      sameSite: 'lax',  // lax для локального Docker
      path: '/',
    },
  });
}

function reloadSessionMiddleware() {
  sessionMiddleware = createSessionMiddleware();
  if (onPoolChangeCallback) {
    onPoolChangeCallback();
  }
}

module.exports = {
  get sessionMiddleware() {
    return sessionMiddleware;
  },
  reloadSessionMiddleware,
  setPoolChangeCallback,
};
