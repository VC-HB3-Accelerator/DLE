/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Сессии ИИ-конференции (настройки + участники).
 */

const db = require('../db');

const STATUSES = new Set(['draft', 'scheduled', 'live', 'ended', 'cancelled']);
const LANG_RE = /^[a-z]{2}(-[A-Za-z]{2})?$/;

function getEncryptionKey() {
  const encryptionUtils = require('../utils/encryptionUtils');
  return encryptionUtils.getEncryptionKey();
}

function parseContactUserId(raw) {
  if (typeof raw === 'string' && raw.startsWith('guest_')) {
    return null;
  }
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

function normalizeLanguage(value, fallback = 'ru') {
  const lang = String(value || '').trim();
  if (LANG_RE.test(lang)) return lang;
  return fallback;
}

function mapSessionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    contact_user_id: row.contact_user_id,
    created_by: row.created_by,
    title: row.title || null,
    notes: row.notes || null,
    presentation_outline: row.presentation_outline || null,
    scheduled_at: row.scheduled_at || null,
    notify_telegram: Boolean(row.notify_telegram),
    notify_email: Boolean(row.notify_email),
    guest_language: row.guest_language || 'ru',
    host_language: row.host_language || 'ru',
    agent_voice: row.agent_voice || null,
    status: row.status,
    room_id: row.room_id || null,
    started_at: row.started_at || null,
    ended_at: row.ended_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    analytics: row.analytics_json || null,
    is_multi: Boolean(row.is_multi),
    contact: row.contact_email || row.contact_name
      ? {
          id: row.contact_user_id,
          name: row.contact_name || null,
          email: row.contact_email || null,
          telegram: row.contact_telegram || null
        }
      : undefined
  };
}

/** Максимум участников с role=participant (без host). */
const MAX_PARTICIPANTS = 3;

async function assertRegisteredUser(userId) {
  const id = parseContactUserId(userId);
  if (!id) {
    const err = new Error('Конференция доступна только зарегистрированным пользователям');
    err.status = 403;
    err.code = 'GUEST_NOT_ALLOWED';
    throw err;
  }

  const { rows } = await db.getQuery()('SELECT id FROM users WHERE id = $1', [id]);
  if (!rows.length) {
    const err = new Error('Пользователь не найден');
    err.status = 404;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }
  return id;
}

async function getContactIdentities(userId) {
  const encryptionKey = getEncryptionKey();
  const userResult = await db.getQuery()(
    `SELECT
       CASE WHEN first_name_encrypted IS NULL OR first_name_encrypted = '' THEN NULL
            ELSE decrypt_text(first_name_encrypted, $2) END AS first_name,
       CASE WHEN last_name_encrypted IS NULL OR last_name_encrypted = '' THEN NULL
            ELSE decrypt_text(last_name_encrypted, $2) END AS last_name
     FROM users WHERE id = $1`,
    [userId, encryptionKey]
  );
  const user = userResult.rows[0] || {};
  const identities = await db.getQuery()(
    `SELECT
       decrypt_text(provider_encrypted, $2) AS provider,
       decrypt_text(provider_id_encrypted, $2) AS provider_id
     FROM user_identities WHERE user_id = $1`,
    [userId, encryptionKey]
  );

  const identityMap = {};
  for (const row of identities.rows) {
    if (row.provider && row.provider_id) {
      identityMap[row.provider] = row.provider_id;
    }
  }

  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || null;
  return {
    name,
    email: identityMap.email || null,
    telegram: identityMap.telegram || null,
    wallet: identityMap.wallet || null
  };
}

async function fetchSessionById(conferenceId) {
  const encryptionKey = getEncryptionKey();
  const { rows } = await db.getQuery()(
    `SELECT
       s.*,
       CASE WHEN s.notes_encrypted IS NULL OR s.notes_encrypted = '' THEN NULL
            ELSE decrypt_text(s.notes_encrypted, $2) END AS notes,
       CASE WHEN s.presentation_outline_encrypted IS NULL OR s.presentation_outline_encrypted = '' THEN NULL
            ELSE decrypt_text(s.presentation_outline_encrypted, $2) END AS presentation_outline
     FROM conference_sessions s
     WHERE s.id = $1`,
    [conferenceId, encryptionKey]
  );
  return mapSessionRow(rows[0] || null);
}

async function listSessionsForContact(contactUserId, { limit = 20 } = {}) {
  const userId = await assertRegisteredUser(contactUserId);
  const encryptionKey = getEncryptionKey();
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const { rows } = await db.getQuery()(
    `SELECT
       s.*,
       CASE WHEN s.notes_encrypted IS NULL OR s.notes_encrypted = '' THEN NULL
            ELSE decrypt_text(s.notes_encrypted, $2) END AS notes,
       CASE WHEN s.presentation_outline_encrypted IS NULL OR s.presentation_outline_encrypted = '' THEN NULL
            ELSE decrypt_text(s.presentation_outline_encrypted, $2) END AS presentation_outline
     FROM conference_sessions s
     WHERE s.contact_user_id = $1
     ORDER BY s.updated_at DESC
     LIMIT $3`,
    [userId, encryptionKey, safeLimit]
  );

  return rows.map(mapSessionRow);
}

async function getEditableSessionForContact(contactUserId) {
  const userId = await assertRegisteredUser(contactUserId);
  const encryptionKey = getEncryptionKey();

  const { rows } = await db.getQuery()(
    `SELECT
       s.*,
       CASE WHEN s.notes_encrypted IS NULL OR s.notes_encrypted = '' THEN NULL
            ELSE decrypt_text(s.notes_encrypted, $2) END AS notes,
       CASE WHEN s.presentation_outline_encrypted IS NULL OR s.presentation_outline_encrypted = '' THEN NULL
            ELSE decrypt_text(s.presentation_outline_encrypted, $2) END AS presentation_outline
     FROM conference_sessions s
     WHERE s.contact_user_id = $1
       AND s.status IN ('draft', 'scheduled')
     ORDER BY s.updated_at DESC
     LIMIT 1`,
    [userId, encryptionKey]
  );

  const session = mapSessionRow(rows[0] || null);
  const contact = await getContactIdentities(userId);
  return {
    session,
    contact,
    warnings: {
      missingEmail: !contact.email,
      missingTelegram: !contact.telegram
    }
  };
}

async function ensureParticipants(conferenceId, hostUserId, participantUserId) {
  await db.getQuery()(
    `INSERT INTO conference_participants (conference_id, user_id, role)
     VALUES ($1, $2, 'host')
     ON CONFLICT (conference_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [conferenceId, hostUserId]
  );
  await db.getQuery()(
    `INSERT INTO conference_participants (conference_id, user_id, role)
     VALUES ($1, $2, 'participant')
     ON CONFLICT (conference_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [conferenceId, participantUserId]
  );
}

async function countParticipants(conferenceId) {
  const { rows } = await db.getQuery()(
    `SELECT COUNT(*)::int AS cnt
     FROM conference_participants
     WHERE conference_id = $1 AND role = 'participant'`,
    [conferenceId]
  );
  return rows[0]?.cnt || 0;
}

async function listParticipants(conferenceId) {
  const id = Number(conferenceId);
  const session = await fetchSessionById(id);
  if (!session) {
    const err = new Error('Конференция не найдена');
    err.status = 404;
    throw err;
  }

  const { rows } = await db.getQuery()(
    `SELECT conference_id, user_id, role, notified_via, joined_at, created_at
     FROM conference_participants
     WHERE conference_id = $1
     ORDER BY
       CASE WHEN role = 'host' THEN 0 ELSE 1 END,
       created_at ASC`,
    [id]
  );

  const participants = [];
  for (const row of rows) {
    const identity = await getContactIdentities(row.user_id);
    participants.push({
      user_id: row.user_id,
      role: row.role,
      notified_via: row.notified_via,
      joined_at: row.joined_at,
      created_at: row.created_at,
      is_primary: row.user_id === session.contact_user_id,
      name: identity.name,
      email: identity.email,
      telegram: identity.telegram
    });
  }

  return {
    session,
    participants,
    maxParticipants: MAX_PARTICIPANTS,
    participantCount: participants.filter((p) => p.role === 'participant').length
  };
}

async function addParticipant(conferenceId, userId, actorId = null) {
  const id = Number(conferenceId);
  const session = await fetchSessionById(id);
  if (!session) {
    const err = new Error('Конференция не найдена');
    err.status = 404;
    throw err;
  }
  if (!['draft', 'scheduled', 'live'].includes(session.status)) {
    const err = new Error('Нельзя добавить участника в завершённую конференцию');
    err.status = 400;
    throw err;
  }

  const uid = await assertRegisteredUser(userId);
  if (uid === session.created_by) {
    const err = new Error('Редактор уже host этой конференции');
    err.status = 400;
    err.code = 'IS_HOST';
    throw err;
  }

  const existing = await db.getQuery()(
    `SELECT role FROM conference_participants WHERE conference_id = $1 AND user_id = $2`,
    [id, uid]
  );
  if (existing.rows.length) {
    return listParticipants(id);
  }

  const cnt = await countParticipants(id);
  if (cnt >= MAX_PARTICIPANTS) {
    const err = new Error(`Максимум ${MAX_PARTICIPANTS} участников`);
    err.status = 400;
    err.code = 'MAX_PARTICIPANTS';
    throw err;
  }

  if (session.created_by || actorId) {
    await db.getQuery()(
      `INSERT INTO conference_participants (conference_id, user_id, role)
       VALUES ($1, $2, 'host')
       ON CONFLICT (conference_id, user_id) DO NOTHING`,
      [id, session.created_by || actorId]
    );
  }

  await db.getQuery()(
    `INSERT INTO conference_participants (conference_id, user_id, role)
     VALUES ($1, $2, 'participant')
     ON CONFLICT (conference_id, user_id) DO NOTHING`,
    [id, uid]
  );

  return listParticipants(id);
}

async function removeParticipant(conferenceId, userId) {
  const id = Number(conferenceId);
  const session = await fetchSessionById(id);
  if (!session) {
    const err = new Error('Конференция не найдена');
    err.status = 404;
    throw err;
  }

  const uid = Number(userId);
  if (uid === session.contact_user_id) {
    const err = new Error('Нельзя удалить основного участника (контакт конференции)');
    err.status = 400;
    err.code = 'PRIMARY_REQUIRED';
    throw err;
  }
  if (uid === session.created_by) {
    const err = new Error('Нельзя удалить host');
    err.status = 400;
    throw err;
  }

  await db.getQuery()(
    `DELETE FROM conference_participants
     WHERE conference_id = $1 AND user_id = $2 AND role = 'participant'`,
    [id, uid]
  );

  return listParticipants(id);
}

async function buildSessionAnalytics(conferenceId) {
  const id = Number(conferenceId);
  const session = await fetchSessionById(id);
  if (!session) return null;

  const { rows: roleRows } = await db.getQuery()(
    `SELECT role, COUNT(*)::int AS cnt
     FROM conference_transcript_items
     WHERE conference_id = $1
     GROUP BY role`,
    [id]
  );
  const byRole = {};
  for (const r of roleRows) byRole[r.role] = r.cnt;

  const { rows: coachRows } = await db.getQuery()(
    `SELECT COUNT(*)::int AS cnt FROM conference_coach_rules WHERE conference_id = $1`,
    [id]
  );
  const { rows: partRows } = await db.getQuery()(
    `SELECT COUNT(*)::int AS cnt FROM conference_participants
     WHERE conference_id = $1 AND role = 'participant'`,
    [id]
  );

  const started = session.started_at ? new Date(session.started_at).getTime() : null;
  const ended = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
  const durationSec =
    started && ended && ended >= started ? Math.round((ended - started) / 1000) : null;

  return {
    conference_id: id,
    status: session.status,
    duration_sec: durationSec,
    participant_count: partRows[0]?.cnt || 0,
    coach_rules: coachRows[0]?.cnt || 0,
    transcript_by_role: byRole,
    started_at: session.started_at,
    ended_at: session.ended_at || null
  };
}

async function upsertSessionForContact(contactUserId, payload = {}, actorId = null) {
  const userId = await assertRegisteredUser(contactUserId);
  const encryptionKey = getEncryptionKey();

  let current = {};
  let sessionId = null;

  if (payload.create_new) {
    sessionId = null;
    current = {};
  } else if (payload.session_id) {
    const sid = Number(payload.session_id);
    const existingById = await fetchSessionById(sid);
    if (!existingById || existingById.contact_user_id !== userId) {
      const err = new Error('Конференция не найдена');
      err.status = 404;
      throw err;
    }
    if (!['draft', 'scheduled'].includes(existingById.status)) {
      const err = new Error('Редактировать можно только черновик или запланированную конференцию');
      err.status = 400;
      throw err;
    }
    sessionId = sid;
    current = existingById;
  } else {
    const existing = await getEditableSessionForContact(userId);
    current = existing.session || {};
    sessionId = current.id || null;
  }

  const title = payload.title !== undefined
    ? (String(payload.title || '').trim().slice(0, 200) || null)
    : (current.title || null);
  const notes = payload.notes !== undefined
    ? String(payload.notes || '').trim().slice(0, 2000) || null
    : (current.notes || null);
  const presentationOutline = payload.presentation_outline !== undefined
    ? String(payload.presentation_outline || '').trim().slice(0, 10000) || null
    : (current.presentation_outline || null);
  const notifyTelegram = payload.notify_telegram !== undefined
    ? Boolean(payload.notify_telegram)
    : Boolean(current.notify_telegram);
  const notifyEmail = payload.notify_email !== undefined
    ? Boolean(payload.notify_email)
    : Boolean(current.notify_email);
  const guestLanguage = payload.guest_language !== undefined
    ? normalizeLanguage(payload.guest_language, current.guest_language || 'ru')
    : (current.guest_language || 'ru');
  const hostLanguage = payload.host_language !== undefined
    ? normalizeLanguage(payload.host_language, current.host_language || 'ru')
    : (current.host_language || 'ru');
  const agentVoice = payload.agent_voice !== undefined
    ? (payload.agent_voice ? String(payload.agent_voice).trim().slice(0, 64) : null)
    : (current.agent_voice || null);

  let scheduledAt = current.scheduled_at || null;
  if (payload.scheduled_at !== undefined) {
    if (!payload.scheduled_at) {
      scheduledAt = null;
    } else {
      const dt = new Date(payload.scheduled_at);
      if (Number.isNaN(dt.getTime())) {
        const err = new Error('Некорректная дата конференции');
        err.status = 400;
        throw err;
      }
      scheduledAt = dt.toISOString();
    }
  }

  let status = current.status || 'draft';
  if (payload.status) {
    const next = String(payload.status);
    if (!STATUSES.has(next)) {
      const err = new Error('Некорректный статус');
      err.status = 400;
      throw err;
    }
    status = next;
  } else if (payload.schedule === true) {
    if (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now()) {
      const err = new Error('Для планирования укажите дату в будущем');
      err.status = 400;
      throw err;
    }
    status = 'scheduled';
  } else if (payload.create_new) {
    status = 'draft';
  }

  if (sessionId) {
    await db.getQuery()(
      `UPDATE conference_sessions SET
         title = $2,
         notes_encrypted = CASE WHEN $3::text IS NULL THEN NULL ELSE encrypt_text($3, $12) END,
         presentation_outline_encrypted = CASE WHEN $4::text IS NULL THEN NULL ELSE encrypt_text($4, $12) END,
         scheduled_at = $5,
         notify_telegram = $6,
         notify_email = $7,
         guest_language = $8,
         host_language = $9,
         agent_voice = $10,
         status = $11,
         updated_at = NOW()
       WHERE id = $1`,
      [
        sessionId,
        title,
        notes,
        presentationOutline,
        scheduledAt,
        notifyTelegram,
        notifyEmail,
        guestLanguage,
        hostLanguage,
        agentVoice,
        status,
        encryptionKey
      ]
    );
  } else {
    const hostId = actorId || null;
    const { rows } = await db.getQuery()(
      `INSERT INTO conference_sessions (
         contact_user_id, created_by, title,
         notes_encrypted, presentation_outline_encrypted,
         scheduled_at, notify_telegram, notify_email,
         guest_language, host_language, agent_voice, status
       ) VALUES (
         $1, $2, $3,
         CASE WHEN $4::text IS NULL THEN NULL ELSE encrypt_text($4, $12) END,
         CASE WHEN $5::text IS NULL THEN NULL ELSE encrypt_text($5, $12) END,
         $6, $7, $8, $9, $10, $11, $13
       )
       RETURNING id`,
      [
        userId,
        hostId,
        title,
        notes,
        presentationOutline,
        scheduledAt,
        notifyTelegram,
        notifyEmail,
        guestLanguage,
        hostLanguage,
        agentVoice,
        encryptionKey,
        status
      ]
    );
    sessionId = rows[0].id;
    if (hostId) {
      await ensureParticipants(sessionId, hostId, userId);
    } else {
      await db.getQuery()(
        `INSERT INTO conference_participants (conference_id, user_id, role)
         VALUES ($1, $2, 'participant')
         ON CONFLICT (conference_id, user_id) DO NOTHING`,
        [sessionId, userId]
      );
    }
  }

  if (actorId) {
    await ensureParticipants(sessionId, actorId, userId);
  }

  const session = await fetchSessionById(sessionId);
  const contact = await getContactIdentities(userId);

  let notificationsQueued = false;
  let notificationResult = null;
  if (payload.schedule === true && (notifyEmail || notifyTelegram)) {
    try {
      const conferenceMagicLinkService = require('./conferenceMagicLinkService');
      notificationResult = await conferenceMagicLinkService.sendMagicLinkNotifications(sessionId, {
        channels: {
          email: Boolean(notifyEmail && contact.email),
          telegram: Boolean(notifyTelegram && contact.telegram)
        }
      });
      notificationsQueued = Boolean(
        notificationResult?.emailed || notificationResult?.telegramSent
      );
    } catch (e) {
      notificationResult = {
        emailed: false,
        telegramSent: false,
        emailError: e.message || String(e)
      };
    }
  }

  return {
    session,
    contact,
    warnings: {
      missingEmail: notifyEmail && !contact.email,
      missingTelegram: notifyTelegram && !contact.telegram
    },
    notificationsQueued,
    notificationResult
  };
}

async function startSession(conferenceId, actorId = null) {
  const id = Number(conferenceId);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('Некорректный id конференции');
    err.status = 400;
    throw err;
  }

  const session = await fetchSessionById(id);
  if (!session) {
    const err = new Error('Конференция не найдена');
    err.status = 404;
    throw err;
  }
  if (!['draft', 'scheduled', 'live'].includes(session.status)) {
    const err = new Error('Нельзя подключиться к завершённой или отменённой конференции');
    err.status = 400;
    throw err;
  }

  if (session.status !== 'live') {
    await db.getQuery()(
      `UPDATE conference_sessions
       SET status = 'live',
           started_at = COALESCE(started_at, NOW()),
           room_id = COALESCE(room_id, $2),
           updated_at = NOW()
       WHERE id = $1`,
      [id, `conference-${id}`]
    );
  } else if (!session.room_id) {
    await db.getQuery()(
      `UPDATE conference_sessions SET room_id = $2, updated_at = NOW() WHERE id = $1`,
      [id, `conference-${id}`]
    );
  }

  const hostId = session.created_by || actorId;
  if (hostId && session.contact_user_id) {
    await ensureParticipants(id, hostId, session.contact_user_id);
  }

  const updated = await fetchSessionById(id);
  const contact = await getContactIdentities(session.contact_user_id);
  return { session: updated, contact };
}

async function endSession(conferenceId, actorId = null) {
  const id = Number(conferenceId);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('Некорректный id конференции');
    err.status = 400;
    throw err;
  }

  const session = await fetchSessionById(id);
  if (!session) {
    const err = new Error('Конференция не найдена');
    err.status = 404;
    throw err;
  }
  if (session.status === 'ended' || session.status === 'cancelled') {
    return { session, contact: await getContactIdentities(session.contact_user_id) };
  }

  await db.getQuery()(
    `UPDATE conference_sessions
     SET status = 'ended', ended_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [id]
  );

  if (actorId && session.created_by && session.contact_user_id) {
    await ensureParticipants(id, session.created_by, session.contact_user_id);
  }

  // ended_at уже в БД — перечитаем для duration
  let analytics = await buildSessionAnalytics(id);
  if (analytics) {
    analytics = { ...analytics, status: 'ended', ended_at: analytics.ended_at || new Date().toISOString() };
    await db.getQuery()(
      `UPDATE conference_sessions SET analytics_json = $2::jsonb WHERE id = $1`,
      [id, JSON.stringify(analytics)]
    );
  }

  const updated = await fetchSessionById(id);
  const contact = await getContactIdentities(session.contact_user_id);
  return { session: updated, contact, analytics: updated.analytics || analytics };
}

async function createMultiSession(userIdsRaw, payload = {}, actorId = null) {
  const rawIds = Array.isArray(userIdsRaw) ? userIdsRaw : [];
  const unique = [];
  const seen = new Set();
  for (const raw of rawIds) {
    const id = await assertRegisteredUser(raw);
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }

  if (unique.length < 2 || unique.length > MAX_PARTICIPANTS) {
    const err = new Error(`Multi-конференция: выберите от 2 до ${MAX_PARTICIPANTS} registered участников`);
    err.status = 400;
    err.code = 'MULTI_COUNT';
    throw err;
  }

  if (actorId && unique.includes(Number(actorId))) {
    const err = new Error('Редактор (host) не должен быть в списке участников');
    err.status = 400;
    err.code = 'HOST_IN_PARTICIPANTS';
    throw err;
  }

  const primaryId = unique[0];
  const title = payload.title !== undefined
    ? (String(payload.title || '').trim().slice(0, 200) || null)
    : `Конференция (${unique.length})`;
  const guestLanguage = normalizeLanguage(payload.guest_language, 'en');
  const hostLanguage = normalizeLanguage(payload.host_language, 'ru');
  const notifyEmail = payload.notify_email !== undefined ? Boolean(payload.notify_email) : true;
  const notifyTelegram = payload.notify_telegram !== undefined ? Boolean(payload.notify_telegram) : false;

  const { rows } = await db.getQuery()(
    `INSERT INTO conference_sessions (
       contact_user_id, created_by, title,
       notes_encrypted, presentation_outline_encrypted,
       scheduled_at, notify_telegram, notify_email,
       guest_language, host_language, agent_voice, status, is_multi
     ) VALUES (
       $1, $2, $3,
       NULL, NULL,
       NULL, $6, $7,
       $4, $5, NULL, 'draft', true
     )
     RETURNING id`,
    [primaryId, actorId || null, title, guestLanguage, hostLanguage, notifyTelegram, notifyEmail]
  );

  const conferenceId = rows[0].id;
  if (actorId) {
    await db.getQuery()(
      `INSERT INTO conference_participants (conference_id, user_id, role)
       VALUES ($1, $2, 'host')
       ON CONFLICT (conference_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [conferenceId, actorId]
    );
  }
  for (const uid of unique) {
    await db.getQuery()(
      `INSERT INTO conference_participants (conference_id, user_id, role)
       VALUES ($1, $2, 'participant')
       ON CONFLICT (conference_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [conferenceId, uid]
    );
  }

  const session = await fetchSessionById(conferenceId);
  const participantsData = await listParticipants(conferenceId);
  const contact = await getContactIdentities(primaryId);

  let notifications = null;
  try {
    const conferenceMagicLinkService = require('./conferenceMagicLinkService');
    notifications = await conferenceMagicLinkService.notifyMultiParticipants(conferenceId);
  } catch (e) {
    notifications = { notified: 0, error: e.message || String(e) };
  }

  return {
    session,
    ...participantsData,
    contact,
    notifications
  };
}

async function listMultiSessionsForEditor(actorId, { limit = 30 } = {}) {
  const hostId = Number(actorId);
  if (!Number.isInteger(hostId) || hostId <= 0) {
    const err = new Error('Нужна авторизация редактора');
    err.status = 401;
    throw err;
  }
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const encryptionKey = getEncryptionKey();
  const { rows } = await db.getQuery()(
    `SELECT
       s.*,
       CASE WHEN s.notes_encrypted IS NULL OR s.notes_encrypted = '' THEN NULL
            ELSE decrypt_text(s.notes_encrypted, $2) END AS notes,
       CASE WHEN s.presentation_outline_encrypted IS NULL OR s.presentation_outline_encrypted = '' THEN NULL
            ELSE decrypt_text(s.presentation_outline_encrypted, $2) END AS presentation_outline,
       (
         SELECT COUNT(*)::int FROM conference_participants cp
         WHERE cp.conference_id = s.id AND cp.role = 'participant'
       ) AS participant_count
     FROM conference_sessions s
     WHERE s.is_multi = true
       AND s.created_by = $1
     ORDER BY s.updated_at DESC
     LIMIT $3`,
    [hostId, encryptionKey, safeLimit]
  );

  return rows.map((row) => ({
    ...mapSessionRow(row),
    participant_count: row.participant_count || 0
  }));
}

async function updateSessionById(conferenceId, payload = {}, actorId = null) {
  const id = Number(conferenceId);
  const current = await fetchSessionById(id);
  if (!current) {
    const err = new Error('Конференция не найдена');
    err.status = 404;
    throw err;
  }
  if (actorId && current.created_by && Number(current.created_by) !== Number(actorId)) {
    const err = new Error('Только создатель конференции может менять настройки');
    err.status = 403;
    throw err;
  }
  if (!['draft', 'scheduled'].includes(current.status)) {
    const err = new Error('Редактировать можно только черновик или запланированную конференцию');
    err.status = 400;
    throw err;
  }

  // Переиспользуем upsert-логику через contact, но с session_id
  return upsertSessionForContact(current.contact_user_id, {
    ...payload,
    session_id: id,
    create_new: false
  }, actorId);
}

async function listInvitesForUser(userId) {
  const uid = await assertRegisteredUser(userId);
  const encryptionKey = getEncryptionKey();
  const { rows } = await db.getQuery()(
    `SELECT
       s.*,
       CASE WHEN s.notes_encrypted IS NULL OR s.notes_encrypted = '' THEN NULL
            ELSE decrypt_text(s.notes_encrypted, $2) END AS notes,
       CASE WHEN s.presentation_outline_encrypted IS NULL OR s.presentation_outline_encrypted = '' THEN NULL
            ELSE decrypt_text(s.presentation_outline_encrypted, $2) END AS presentation_outline
     FROM conference_sessions s
     INNER JOIN conference_participants cp
       ON cp.conference_id = s.id AND cp.user_id = $1 AND cp.role = 'participant'
     WHERE s.status IN ('draft', 'scheduled', 'live')
     ORDER BY s.updated_at DESC
     LIMIT 20`,
    [uid, encryptionKey]
  );
  return rows.map((row) => ({
    ...mapSessionRow(row),
    host_id: row.created_by
  }));
}

async function getSession(conferenceId) {
  const id = Number(conferenceId);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('Некорректный id конференции');
    err.status = 400;
    throw err;
  }
  const session = await fetchSessionById(id);
  if (!session) {
    const err = new Error('Конференция не найдена');
    err.status = 404;
    throw err;
  }
  const contact = await getContactIdentities(session.contact_user_id);
  return { session, contact };
}

module.exports = {
  parseContactUserId,
  assertRegisteredUser,
  getContactIdentities,
  listSessionsForContact,
  getEditableSessionForContact,
  upsertSessionForContact,
  startSession,
  endSession,
  getSession,
  listParticipants,
  addParticipant,
  removeParticipant,
  buildSessionAnalytics,
  createMultiSession,
  listMultiSessionsForEditor,
  updateSessionById,
  listInvitesForUser,
  MAX_PARTICIPANTS,
  STATUSES
};
