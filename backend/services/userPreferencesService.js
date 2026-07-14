/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 *
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const db = require('../db');

const ALLOWED_KEYS = new Set(['contacts_filters']);
const MAX_KEY_LENGTH = 50;

class PreferenceValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PreferenceValidationError';
    this.status = 400;
  }
}

function assertValidKey(key) {
  const preferenceKey = String(key || '').trim();
  if (!preferenceKey) {
    throw new PreferenceValidationError('preference_key is required');
  }
  if (preferenceKey.length > MAX_KEY_LENGTH) {
    throw new PreferenceValidationError(`preference_key must be <= ${MAX_KEY_LENGTH} characters`);
  }
  if (!ALLOWED_KEYS.has(preferenceKey)) {
    throw new PreferenceValidationError(`Unsupported preference_key: ${preferenceKey}`);
  }
  return preferenceKey;
}

function serializeValue(value) {
  if (value === undefined) {
    throw new PreferenceValidationError('value is required');
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    throw new PreferenceValidationError('value is not serializable');
  }
}

function parseStoredValue(raw) {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  if (typeof raw !== 'string') {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function getPreference(userId, key) {
  const preferenceKey = assertValidKey(key);
  const uid = Number(userId);
  if (!Number.isInteger(uid) || uid <= 0) {
    throw new PreferenceValidationError('Invalid user id');
  }

  const { rows } = await db.getQuery()(
    `SELECT preference_key, preference_value, metadata, updated_at
     FROM user_preferences
     WHERE user_id = $1 AND preference_key = $2
     LIMIT 1`,
    [uid, preferenceKey]
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    key: row.preference_key,
    value: parseStoredValue(row.preference_value),
    metadata: row.metadata || {},
    updatedAt: row.updated_at || null
  };
}

async function setPreference(userId, key, value, metadata = {}) {
  const preferenceKey = assertValidKey(key);
  const uid = Number(userId);
  if (!Number.isInteger(uid) || uid <= 0) {
    throw new PreferenceValidationError('Invalid user id');
  }

  const preferenceValue = serializeValue(value);
  const meta = metadata && typeof metadata === 'object' ? metadata : {};

  const { rows } = await db.getQuery()(
    `INSERT INTO user_preferences (user_id, preference_key, preference_value, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW())
     ON CONFLICT (user_id, preference_key)
     DO UPDATE SET
       preference_value = EXCLUDED.preference_value,
       metadata = EXCLUDED.metadata,
       updated_at = NOW()
     RETURNING preference_key, preference_value, metadata, updated_at`,
    [uid, preferenceKey, preferenceValue, JSON.stringify(meta)]
  );

  const row = rows[0];
  return {
    key: row.preference_key,
    value: parseStoredValue(row.preference_value),
    metadata: row.metadata || {},
    updatedAt: row.updated_at || null
  };
}

module.exports = {
  ALLOWED_KEYS,
  PreferenceValidationError,
  getPreference,
  setPreference
};
