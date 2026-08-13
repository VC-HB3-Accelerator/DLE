/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Overlay прав ролей на типы сообщений чата.
 */

const db = require('../db');
const logger = require('../utils/logger');

function loadShared(name) {
  try {
    return require(`/app/shared/${name}`);
  } catch (_) {
    return require(`../../shared/${name}`);
  }
}

const {
  cloneDefaultCaps,
  roleKeyForChatCaps,
  normalizeCapRow,
  assertChatCap,
  validateCapsMatrix,
  payloadFromUpload,
  CHAT_CAP_ROLES,
  CHAT_CAP_KEYS
} = loadShared('chatRoleCaps');

async function getCaps(role) {
  const key = roleKeyForChatCaps(role);
  const { rows } = await db.getQuery()(
    `SELECT role_key, send_text, send_file, send_video, send_audio, send_call
     FROM chat_role_capabilities WHERE role_key = $1`,
    [key]
  );
  return normalizeCapRow(rows[0]);
}

async function getCapsForUi(role) {
  try {
    return await getCaps(role);
  } catch (err) {
    logger.warn('[chatRoleCaps] GET fallback defaults:', err.message);
    return cloneDefaultCaps();
  }
}

async function getMatrix() {
  const { rows } = await db.getQuery()(
    `SELECT role_key, send_text, send_file, send_video, send_audio, send_call
     FROM chat_role_capabilities WHERE role_key = ANY($1::text[])`,
    [CHAT_CAP_ROLES]
  );
  const byKey = {};
  for (const row of rows) byKey[row.role_key] = normalizeCapRow(row);
  const data = {};
  for (const role of CHAT_CAP_ROLES) {
    data[role] = byKey[role] || cloneDefaultCaps();
  }
  return data;
}

async function saveMatrix(body, updatedBy) {
  const checked = validateCapsMatrix(body);
  if (!checked.ok) {
    const err = new Error('INVALID_CHAT_CAPS');
    err.code = 'INVALID_CHAT_CAPS';
    throw err;
  }
  for (const role of CHAT_CAP_ROLES) {
    const caps = checked.data[role];
    await db.getQuery()(
      `INSERT INTO chat_role_capabilities
         (role_key, send_text, send_file, send_video, send_audio, send_call, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
       ON CONFLICT (role_key) DO UPDATE SET
         send_text = EXCLUDED.send_text,
         send_file = EXCLUDED.send_file,
         send_video = EXCLUDED.send_video,
         send_audio = EXCLUDED.send_audio,
         send_call = EXCLUDED.send_call,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [role, caps.send_text, caps.send_file, caps.send_video, caps.send_audio, caps.send_call, updatedBy || null]
    );
  }
  return getMatrix();
}

function deniedPayload(cap) {
  return {
    success: false,
    error: 'Недостаточно прав для этого типа сообщения',
    code: 'CHAT_CAP_DENIED',
    cap
  };
}

async function rejectIfChatCapDenied(res, role, payload) {
  let caps;
  try {
    caps = await getCaps(role);
  } catch (err) {
    logger.error('[chatRoleCaps] POST caps unavailable:', err.message);
    res.status(503).json({
      success: false,
      error: 'Права чата временно недоступны',
      code: 'CHAT_CAPS_UNAVAILABLE'
    });
    return true;
  }
  const check = assertChatCap(caps, payload);
  if (!check.ok) {
    res.status(403).json(deniedPayload(check.cap));
    return true;
  }
  return false;
}

module.exports = {
  getCaps,
  getCapsForUi,
  getMatrix,
  saveMatrix,
  rejectIfChatCapDenied,
  payloadFromUpload,
  assertChatCap,
  deniedPayload,
  roleKeyForChatCaps,
  CHAT_CAP_KEYS,
  CHAT_CAP_ROLES
};
