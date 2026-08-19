/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const crypto = require('crypto');
const db = require('../db');
const logger = require('../utils/logger');
const { ensureVoiceCallSchema } = require('./voiceCallSchema');
const settingsService = require('./voiceCallSettingsService');
const billing = require('./voiceCallBillingService');
const { ownerKey, assertOwner } = require('./voiceCallOwner');
const { isVoiceCallRealtimeModel } = require('./qwenRealtimeService');

const liveSessions = new Map();

function publicSession(row, extra = {}) {
  if (!row) return null;
  const remaining = remainingSeconds(row);
  return {
    id: row.id,
    status: row.status,
    package_id: row.package_id,
    minutes: Number(row.minutes),
    started_at: row.started_at,
    deadline_at: row.deadline_at,
    ended_at: row.ended_at,
    ended_reason: row.ended_reason,
    seconds_used: Number(row.seconds_used || 0),
    remaining_seconds: remaining,
    ticket: extra.includeTicket ? row.ticket : undefined,
    ws_path: extra.includeTicket ? `/ws?ticket=${encodeURIComponent(row.ticket)}` : undefined
  };
}

function remainingSeconds(row) {
  if (!row?.deadline_at || row.status !== 'live') {
    if (row?.status === 'ready' || row?.status === 'connecting') {
      return Number(row.minutes) * 60;
    }
    return 0;
  }
  return Math.max(0, Math.floor((new Date(row.deadline_at).getTime() - Date.now()) / 1000));
}

async function getRow(id) {
  const { rows } = await db.getQuery()(`SELECT * FROM ai_call_sessions WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function findActive(owner) {
  const { rows } = await db.getQuery()(
    `SELECT * FROM ai_call_sessions
     WHERE status IN ('ready','connecting','live')
       AND (
         (owner_type = 'user' AND owner_user_id = $1)
         OR (owner_type = 'guest' AND owner_guest_id = $2)
       )
     ORDER BY created_at DESC
     LIMIT 1`,
    [owner.ownerUserId, owner.ownerGuestId]
  );
  return rows[0] || null;
}

async function createSession(owner, { packageId, invoiceId } = {}) {
  await ensureVoiceCallSchema();
  const settings = await settingsService.getSettings();
  if (!settings.enabled) {
    const err = new Error('Звонки выключены');
    err.status = 403;
    err.code = 'CALLS_DISABLED';
    throw err;
  }
  if (!settings.model_call || !isVoiceCallRealtimeModel(settings.model_call)) {
    const err = new Error('Для звонка укажите Omni realtime-модель, не перевод и не TTS');
    err.status = 400;
    err.code = 'MODEL_CALL_REQUIRED';
    throw err;
  }

  const active = await findActive(owner);
  if (active) {
    const err = new Error('Уже есть активный звонок');
    err.status = 409;
    err.code = 'CALL_ALREADY_ACTIVE';
    err.session = publicSession(active, { includeTicket: true });
    throw err;
  }

  const pkg = settingsService.findPackage(settings, packageId) || settings.packages[0];
  if (!pkg) {
    const err = new Error('Нет пакетов для звонка');
    err.status = 400;
    throw err;
  }

  const needSeconds = Number(pkg.minutes) * 60;
  const paid = settingsService.packageNeedsPayment(settings, pkg);
  const credits = await billing.getCredits(owner);
  if (paid) {
    if (credits.seconds_remaining < needSeconds) {
      const err = new Error('Сначала оплатите пакет');
      err.status = 403;
      err.code = 'CALL_PAYMENT_REQUIRED';
      throw err;
    }
  } else if (credits.seconds_remaining < needSeconds) {
    await billing.grantFreePackage(owner, pkg.minutes);
  }

  const id = crypto.randomUUID();
  const ticket = crypto.randomBytes(24).toString('hex');
  const { rows } = await db.getQuery()(
    `INSERT INTO ai_call_sessions (
       id, owner_type, owner_user_id, owner_guest_id, invoice_id,
       package_id, minutes, model_call, status, ticket
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ready',$9)
     RETURNING *`,
    [
      id,
      owner.ownerType,
      owner.ownerUserId,
      owner.ownerGuestId,
      invoiceId || null,
      pkg.id,
      pkg.minutes,
      settings.model_call,
      ticket
    ]
  );
  return publicSession(rows[0], { includeTicket: true });
}

async function assertOwned(id, owner) {
  const row = await getRow(id);
  if (!row) {
    const err = new Error('Сессия не найдена');
    err.status = 404;
    throw err;
  }
  if (!assertOwner(row, owner)) {
    const err = new Error('Нет доступа к звонку');
    err.status = 403;
    throw err;
  }
  return row;
}

async function consumeMicReady(sessionId, owner) {
  const row = await assertOwned(sessionId, owner);
  if (row.credit_debited && (row.status === 'live' || row.status === 'connecting')) {
    return row;
  }
  if (!['ready', 'connecting'].includes(row.status)) {
    const err = new Error('Сессию нельзя начать');
    err.status = 409;
    err.code = 'CALL_NOT_READY';
    throw err;
  }
  const need = Number(row.minutes) * 60;
  await billing.debitCredit(owner, need);
  const { rows } = await db.getQuery()(
    `UPDATE ai_call_sessions
     SET status = 'live',
         credit_debited = TRUE,
         started_at = NOW(),
         deadline_at = NOW() + ($2 || ' seconds')::interval,
         updated_at = NOW()
     WHERE id = $1 AND credit_debited = FALSE AND status IN ('ready','connecting')
     RETURNING *`,
    [sessionId, String(need)]
  );
  if (!rows[0]) {
    return getRow(sessionId);
  }
  return rows[0];
}

async function extendSession(sessionId, owner, packageId) {
  const row = await assertOwned(sessionId, owner);
  if (row.status !== 'live') {
    const err = new Error('Продлить можно только текущий звонок');
    err.status = 409;
    throw err;
  }
  const settings = await settingsService.getSettings();
  const pkg = settingsService.findPackage(settings, packageId);
  if (!pkg) {
    const err = new Error('Пакет не найден');
    err.status = 400;
    throw err;
  }
  const need = Number(pkg.minutes) * 60;
  if (settingsService.packageNeedsPayment(settings, pkg)) {
    const credits = await billing.getCredits(owner);
    if (credits.seconds_remaining < need) {
      const err = new Error('Сначала оплатите продление');
      err.status = 403;
      err.code = 'CALL_PAYMENT_REQUIRED';
      throw err;
    }
    await billing.debitCredit(owner, need);
  }
  const { rows } = await db.getQuery()(
    `UPDATE ai_call_sessions
     SET minutes = minutes + $2,
         deadline_at = COALESCE(deadline_at, NOW()) + ($3 || ' seconds')::interval,
         updated_at = NOW()
     WHERE id = $1 AND status = 'live'
     RETURNING *`,
    [sessionId, pkg.minutes, String(need)]
  );
  return publicSession(rows[0]);
}

async function hangup(sessionId, owner, reason = 'user') {
  const row = owner ? await assertOwned(sessionId, owner) : await getRow(sessionId);
  if (!row) return null;
  if (['ended', 'time_up'].includes(row.status)) return publicSession(row);
  const used = row.started_at
    ? Math.max(0, Math.floor((Date.now() - new Date(row.started_at).getTime()) / 1000))
    : 0;
  const finalReason = reason === 'timeout' ? 'timeout' : reason;
  const status = finalReason === 'timeout' ? 'time_up' : 'ended';
  const { rows } = await db.getQuery()(
    `UPDATE ai_call_sessions
     SET status = $2, ended_reason = $3, ended_at = NOW(), seconds_used = $4, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [sessionId, status, finalReason, used]
  );
  const live = liveSessions.get(sessionId);
  if (live?.close) {
    try { live.close(finalReason); } catch (_) { /* ignore */ }
  }
  liveSessions.delete(sessionId);
  const ended = rows[0];
  const { writeCallStubSafe } = require('./voiceCallChatStubService');
  await writeCallStubSafe(ended);
  return publicSession(ended);
}

async function sessionByTicket(ticket) {
  if (!ticket) return null;
  const { rows } = await db.getQuery()(
    `SELECT * FROM ai_call_sessions WHERE ticket = $1`,
    [String(ticket)]
  );
  return rows[0] || null;
}

function registerLive(sessionId, handle) {
  liveSessions.set(sessionId, handle);
}

function getLive(sessionId) {
  return liveSessions.get(sessionId) || null;
}

async function hardStopExpired() {
  const settings = await settingsService.getSettings();
  if (!settingsService.isHardStopEnabled(settings)) return;
  const { rows } = await db.getQuery()(
    `SELECT id FROM ai_call_sessions
     WHERE status = 'live' AND deadline_at IS NOT NULL AND deadline_at <= NOW()`
  );
  for (const row of rows) {
    try {
      await hangup(row.id, null, 'timeout');
    } catch (error) {
      logger.warn('[voiceCall] hard-stop:', error.message);
    }
  }
}

let timer = null;
function startWatchdog() {
  if (timer) return;
  timer = setInterval(() => {
    hardStopExpired().catch(() => {});
  }, 1000);
  if (typeof timer.unref === 'function') timer.unref();
}

module.exports = {
  publicSession,
  remainingSeconds,
  createSession,
  consumeMicReady,
  extendSession,
  hangup,
  assertOwned,
  getRow,
  findActive,
  sessionByTicket,
  registerLive,
  getLive,
  hardStopExpired,
  startWatchdog,
  ownerKey
};
