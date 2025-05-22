const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const db = require('../db');

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
    secret: process.env.SESSION_SECRET || 'hb3atoken',
    name: 'sessionId',
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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
