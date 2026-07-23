/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const db = require('../db');

const PRIVACY_PATH = '/content/published?section=' + encodeURIComponent('политика и согласия');
const MAX_BODY_LENGTH = 4000;

function normalizeBody(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, MAX_BODY_LENGTH);
}

async function getNotice() {
  const { rows } = await db.getQuery()(
    `SELECT body, updated_at, updated_by
     FROM sidebar_notice
     WHERE id = 1`
  );

  if (!rows.length) {
    return {
      body: '',
      privacyPath: PRIVACY_PATH,
      updatedAt: null,
      updatedBy: null,
    };
  }

  return {
    body: rows[0].body || '',
    privacyPath: PRIVACY_PATH,
    updatedAt: rows[0].updated_at ? new Date(rows[0].updated_at).toISOString() : null,
    updatedBy: rows[0].updated_by ?? null,
  };
}

async function setNotice({ body, updatedBy = null }) {
  const normalized = normalizeBody(body);
  const userId = updatedBy != null && Number.isFinite(Number(updatedBy))
    ? Number(updatedBy)
    : null;

  const { rows } = await db.getQuery()(
    `INSERT INTO sidebar_notice (id, body, updated_at, updated_by)
     VALUES (1, $1, NOW(), $2)
     ON CONFLICT (id) DO UPDATE SET
       body = EXCLUDED.body,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by
     RETURNING body, updated_at, updated_by`,
    [normalized, userId]
  );

  return {
    body: rows[0].body || '',
    privacyPath: PRIVACY_PATH,
    updatedAt: rows[0].updated_at ? new Date(rows[0].updated_at).toISOString() : null,
    updatedBy: rows[0].updated_by ?? null,
  };
}

module.exports = {
  getNotice,
  setNotice,
  PRIVACY_PATH,
  MAX_BODY_LENGTH,
};
