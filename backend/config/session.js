/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/HB3-ACCELERATOR
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
  return session({
    store: new pgSession({
      pool: db.getPool(),
      tableName: 'session',
    }),
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    name: 'sessionId',
    resave: true,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
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
