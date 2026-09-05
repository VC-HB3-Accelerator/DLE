/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Одноразовые WS-тикеты для Realtime конференции (ключ провайдера только на backend).
 */

const crypto = require('crypto');

const TICKET_TTL_MS = 10 * 60 * 1000;
const tickets = new Map();

function issueTicket(conferenceId, userId, role = 'primary') {
  const ticket = crypto.randomBytes(24).toString('hex');
  tickets.set(ticket, {
    conferenceId: Number(conferenceId),
    userId: Number(userId),
    role: role === 'host' ? 'host' : 'primary',
    expiresAt: Date.now() + TICKET_TTL_MS
  });
  return ticket;
}

function peekTicket(ticket) {
  const entry = tickets.get(String(ticket || ''));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tickets.delete(String(ticket));
    return null;
  }
  return { ...entry };
}

function consumeTicket(ticket) {
  const key = String(ticket || '');
  const entry = peekTicket(key);
  if (!entry) return null;
  tickets.delete(key);
  return entry;
}

function purgeExpired() {
  const now = Date.now();
  for (const [key, entry] of tickets.entries()) {
    if (now > entry.expiresAt) tickets.delete(key);
  }
}

module.exports = {
  TICKET_TTL_MS,
  issueTicket,
  peekTicket,
  consumeTicket,
  purgeExpired
};
