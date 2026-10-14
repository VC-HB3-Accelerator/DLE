/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const crypto = require('crypto');
const db = require('../db');
const { canTouchSession, sessionIdOf } = require('./orchOwnerGuard');

const MAX_SESSIONS = 24;
const MAX_MESSAGES = 40;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isServerSessionId(id) {
  return UUID_RE.test(String(id || ''));
}

function err(status, message, code) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}

function parseContactUserId(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw err(400, 'Некорректный contactId', 'BAD_CONTACT');
  }
  return n;
}

function slimMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-MAX_MESSAGES);
}

function rowToPublic(row) {
  return {
    id: row.id,
    title: row.title || '',
    skillId: row.skill_id || '',
    messages: Array.isArray(row.messages) ? row.messages : [],
    archived: Boolean(row.archived_at),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    contactUserId: row.contact_user_id == null ? null : Number(row.contact_user_id),
    ownerUserId: Number(row.owner_user_id),
  };
}

async function assertContactExists(contactUserId) {
  if (contactUserId == null) return;
  const { rows } = await db.getQuery()(
    'SELECT id FROM users WHERE id = $1 LIMIT 1',
    [contactUserId]
  );
  if (!rows[0]) throw err(404, 'Контакт не найден', 'CONTACT_NOT_FOUND');
}

async function listSessions({ ownerUserId, contactUserId }) {
  const me = sessionIdOf(ownerUserId);
  if (me == null) {
    throw err(400, 'Нужен владелец беседы', 'OWNER_REQUIRED');
  }
  const contact = parseContactUserId(contactUserId);
  if (contact != null) await assertContactExists(contact);
  await ensureLiveSession({ ownerUserId: me, contactUserId: contact });
  const { rows } = await db.getQuery()(
    `SELECT id, owner_user_id, contact_user_id, title, skill_id, messages, updated_at, archived_at
     FROM media_agent_sessions
     WHERE owner_user_id = $1
       AND deleted_at IS NULL
       AND ($2::int IS NULL OR contact_user_id = $2)
     ORDER BY (archived_at IS NULL) DESC, updated_at DESC
     LIMIT $3`,
    [me, contact, MAX_SESSIONS]
  );
  return rows.map(rowToPublic);
}

function canTouch(row, { ownerUserId } = {}) {
  return canTouchSession(row, ownerUserId);
}

async function getSession(id) {
  const { rows } = await db.getQuery()(
    `SELECT id, owner_user_id, contact_user_id, title, skill_id, messages, updated_at, archived_at
     FROM media_agent_sessions WHERE id = $1 LIMIT 1`,
    [String(id || '')]
  );
  return rows[0] || null;
}

async function findLiveSession(ownerUserId) {
  const me = sessionIdOf(ownerUserId);
  if (me == null) throw err(400, 'Нужен владелец беседы', 'OWNER_REQUIRED');
  const { rows } = await db.getQuery()(
    `SELECT id, owner_user_id, contact_user_id, title, skill_id, messages, updated_at
     FROM media_agent_sessions
     WHERE owner_user_id = $1 AND archived_at IS NULL AND deleted_at IS NULL
     ORDER BY updated_at DESC
     LIMIT 1`,
    [me]
  );
  return rows[0] || null;
}

async function withServerId(row, seen = 0) {
  if (!row) return null;
  if (isServerSessionId(row.id)) return row;
  if (seen > 2) throw err(500, 'Не удалось открыть беседу', 'SESSION_CREATE');
  const nextId = crypto.randomUUID();
  const { rows } = await db.getQuery()(
    `UPDATE media_agent_sessions
     SET id = $2
     WHERE id = $1 AND archived_at IS NULL
     RETURNING id, owner_user_id, contact_user_id, title, skill_id, messages, updated_at`,
    [row.id, nextId]
  );
  if (rows[0]) return rows[0];
  const again = await findLiveSession(row.owner_user_id);
  if (!again || again.id === row.id) {
    throw err(500, 'Не удалось открыть беседу', 'SESSION_CREATE');
  }
  return withServerId(again, seen + 1);
}

async function ensureLiveSession({ ownerUserId, contactUserId } = {}) {
  const me = sessionIdOf(ownerUserId);
  if (me == null) throw err(400, 'Нужен владелец беседы', 'OWNER_REQUIRED');
  const existing = await findLiveSession(me);
  if (existing) return rowToPublic(await withServerId(existing));
  const contact = contactUserId == null ? null : parseContactUserId(contactUserId);
  if (contact != null) await assertContactExists(contact);
  const id = crypto.randomUUID();
  try {
    const { rows } = await db.getQuery()(
      `INSERT INTO media_agent_sessions (
         id, owner_user_id, contact_user_id, title, skill_id, messages, updated_at
       ) VALUES ($1, $2, $3, '', '', '[]'::jsonb, NOW())
       RETURNING id, owner_user_id, contact_user_id, title, skill_id, messages, updated_at`,
      [id, me, contact]
    );
    if (rows[0]) return rowToPublic(rows[0]);
  } catch (error) {
    if (error.code !== '23505') throw error;
  }
  const again = await findLiveSession(me);
  if (!again) throw err(500, 'Не удалось открыть беседу', 'SESSION_CREATE');
  return rowToPublic(await withServerId(again));
}

async function upsertSession({
  id,
  ownerUserId,
  contactUserId,
  title,
  skillId,
  messages,
}) {
  const rawId = String(id || '').trim();
  const contact = parseContactUserId(contactUserId);
  await assertContactExists(contact);

  let sessionId = rawId;
  if (!isServerSessionId(sessionId)) {
    const live = await ensureLiveSession({ ownerUserId, contactUserId: contact });
    sessionId = live.id;
  }

  const existing = await getSession(sessionId);
  if (existing && !canTouch(existing, { ownerUserId })) {
    throw err(404, 'Сессия не найдена', 'NOT_FOUND');
  }
  if (existing && contact != null && existing.contact_user_id != null
    && Number(existing.contact_user_id) !== contact) {
    throw err(409, 'Сессия принадлежит другому контакту', 'CONTACT_MISMATCH');
  }
  if (existing && contact == null && existing.contact_user_id != null) {
    throw err(409, 'Сессия привязана к контакту', 'CONTACT_MISMATCH');
  }

  const msgs = slimMessages(messages);
  if (!msgs.length) {
    throw err(400, 'Пустую сессию не сохраняем', 'EMPTY');
  }

  const safeTitle = String(title || '').slice(0, 200);
  const safeSkill = String(skillId || '').slice(0, 120);

  const { rows } = await db.getQuery()(
    `INSERT INTO media_agent_sessions (
       id, owner_user_id, contact_user_id, title, skill_id, messages, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       skill_id = EXCLUDED.skill_id,
       messages = EXCLUDED.messages,
       updated_at = NOW()
     RETURNING id, owner_user_id, contact_user_id, title, skill_id, messages, updated_at`,
    [
      sessionId,
      existing ? existing.owner_user_id : ownerUserId,
      existing ? existing.contact_user_id : contact,
      safeTitle,
      safeSkill,
      JSON.stringify(msgs),
    ]
  );
  return rowToPublic(rows[0]);
}

async function bindOpenCardsToSession(ownerUserId, sessionId) {
  const me = sessionIdOf(ownerUserId);
  if (me == null || !isServerSessionId(sessionId)) return;
  await db.getQuery()(
    `UPDATE orchestrator_jobs
     SET payload = jsonb_set(
           COALESCE(payload, '{}'::jsonb),
           '{plan,session_id}',
           to_jsonb($2::text),
           true
         ),
         updated_at = NOW()
     WHERE owner_user_id = $1
       AND status = 'waiting_human'
       AND COALESCE(payload->'plan'->>'session_id', '') = ''
       AND payload->'cursor'->>'phase' = 'card_brief'`,
    [me, String(sessionId)]
  );
}

async function startFreshSession({ ownerUserId, contactUserId } = {}) {
  const me = sessionIdOf(ownerUserId);
  if (me == null) throw err(400, 'Нужен владелец беседы', 'OWNER_REQUIRED');
  const contact = contactUserId == null ? null : parseContactUserId(contactUserId);
  const existing = await findLiveSession(me);
  const messages = Array.isArray(existing?.messages) ? existing.messages : [];
  if (!existing || !messages.length) {
    return ensureLiveSession({ ownerUserId: me, contactUserId: contact });
  }
  await bindOpenCardsToSession(me, existing.id);
  await db.getQuery()(
    'UPDATE media_agent_sessions SET archived_at = NOW(), updated_at = NOW() WHERE id = $1',
    [existing.id]
  );
  return ensureLiveSession({ ownerUserId: me, contactUserId: contact ?? existing.contact_user_id });
}

async function resumeSession({ id, ownerUserId }) {
  const existing = await getSession(id);
  if (!existing || !canTouch(existing, { ownerUserId })) {
    throw err(404, 'Сессия не найдена', 'NOT_FOUND');
  }
  if (!existing.archived_at) return rowToPublic(existing);
  const me = sessionIdOf(ownerUserId);
  const live = await findLiveSession(me);
  if (live && live.id !== existing.id) {
    const liveMessages = Array.isArray(live.messages) ? live.messages : [];
    if (liveMessages.length) await bindOpenCardsToSession(me, live.id);
    await db.getQuery()(
      'UPDATE media_agent_sessions SET archived_at = NOW(), updated_at = NOW() WHERE id = $1 AND archived_at IS NULL',
      [live.id]
    );
  }
  const { rows } = await db.getQuery()(
    `UPDATE media_agent_sessions
     SET archived_at = NULL, updated_at = NOW()
     WHERE id = $1
     RETURNING id, owner_user_id, contact_user_id, title, skill_id, messages, updated_at, archived_at`,
    [existing.id]
  );
  if (!rows[0]) throw err(500, 'Не удалось открыть беседу', 'SESSION_CREATE');
  return rowToPublic(rows[0]);
}

async function deleteSession({ id, ownerUserId }) {
  const existing = await getSession(id);
  if (!existing) return { deleted: false };
  if (!canTouch(existing, { ownerUserId })) {
    throw err(404, 'Сессия не найдена', 'NOT_FOUND');
  }
  await db.getQuery()(
    `UPDATE media_agent_sessions
     SET archived_at = COALESCE(archived_at, NOW()),
         deleted_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [String(id)]
  );
  const next = await ensureLiveSession({
    ownerUserId,
    contactUserId: existing.contact_user_id,
  });
  return { deleted: true, session: next };
}

module.exports = {
  listSessions,
  upsertSession,
  deleteSession,
  ensureLiveSession,
  startFreshSession,
  resumeSession,
  isServerSessionId,
  parseContactUserId,
  assertContactExists,
  canTouch,
};
