/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Prefs медиа-агента на контакте (режим AI вкл/выкл).
 */

const db = require('../db');

function err(status, message, code) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}

function parseContactUserId(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw err(400, 'Некорректный contactId', 'BAD_CONTACT');
  }
  return n;
}

async function getPrefs({ ownerUserId, contactUserId }) {
  const contact = parseContactUserId(contactUserId);
  const { rows } = await db.getQuery()(
    `SELECT contact_user_id, owner_user_id, ai_enabled, updated_at
     FROM media_agent_contact_prefs
     WHERE contact_user_id = $1 AND owner_user_id = $2
     LIMIT 1`,
    [contact, ownerUserId]
  );
  if (!rows[0]) {
    return {
      contactUserId: contact,
      ownerUserId: Number(ownerUserId),
      aiEnabled: false,
      updatedAt: null,
    };
  }
  return {
    contactUserId: Number(rows[0].contact_user_id),
    ownerUserId: Number(rows[0].owner_user_id),
    aiEnabled: Boolean(rows[0].ai_enabled),
    updatedAt: rows[0].updated_at ? new Date(rows[0].updated_at).getTime() : null,
  };
}

async function setAiEnabled({ ownerUserId, contactUserId, aiEnabled }) {
  const contact = parseContactUserId(contactUserId);
  const enabled = Boolean(aiEnabled);
  const { rows } = await db.getQuery()(
    `INSERT INTO media_agent_contact_prefs (contact_user_id, owner_user_id, ai_enabled, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (contact_user_id, owner_user_id) DO UPDATE SET
       ai_enabled = EXCLUDED.ai_enabled,
       updated_at = NOW()
     RETURNING contact_user_id, owner_user_id, ai_enabled, updated_at`,
    [contact, ownerUserId, enabled]
  );
  return {
    contactUserId: Number(rows[0].contact_user_id),
    ownerUserId: Number(rows[0].owner_user_id),
    aiEnabled: Boolean(rows[0].ai_enabled),
    updatedAt: rows[0].updated_at ? new Date(rows[0].updated_at).getTime() : null,
  };
}

module.exports = {
  getPrefs,
  setAiEnabled,
};
