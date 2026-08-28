/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Overlay прав на действия по ролям ОС.
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
  ACTION_ROLES,
  ACTION_KEYS,
  roleKeyForActions,
  normalizeActionsMap,
  cloneDefaultActions,
  validateActionsMatrix,
  hasActionPermission
} = loadShared('roleActionCaps');

const { hasPermission: hasPermissionDefault } = loadShared('permissions');

let cacheMatrix = null;
let cacheAt = 0;
const CACHE_TTL_MS = 15000;

function invalidateCache() {
  cacheMatrix = null;
  cacheAt = 0;
}

async function getActions(role) {
  const key = roleKeyForActions(role);
  const { rows } = await db.getQuery()(
    `SELECT role_key, actions FROM role_action_capabilities WHERE role_key = $1`,
    [key]
  );
  return normalizeActionsMap(rows[0]?.actions, key);
}

async function getActionsForUi(role) {
  try {
    return await getActions(role);
  } catch (err) {
    logger.warn('[roleActionCaps] GET fallback defaults:', err.message);
    return cloneDefaultActions(role);
  }
}

async function getMatrix() {
  const { rows } = await db.getQuery()(
    `SELECT role_key, actions FROM role_action_capabilities WHERE role_key = ANY($1::text[])`,
    [ACTION_ROLES]
  );
  const byKey = {};
  for (const row of rows) {
    byKey[row.role_key] = normalizeActionsMap(row.actions, row.role_key);
  }
  const data = {};
  for (const role of ACTION_ROLES) {
    data[role] = byKey[role] || cloneDefaultActions(role);
  }
  return data;
}

async function getMatrixCached() {
  if (cacheMatrix && Date.now() - cacheAt < CACHE_TTL_MS) {
    return cacheMatrix;
  }
  try {
    cacheMatrix = await getMatrix();
    cacheAt = Date.now();
    return cacheMatrix;
  } catch (err) {
    logger.warn('[roleActionCaps] cache fallback defaults:', err.message);
    return buildFallbackMatrix();
  }
}

function buildFallbackMatrix() {
  const data = {};
  for (const role of ACTION_ROLES) data[role] = cloneDefaultActions(role);
  return data;
}

async function saveMatrix(body, updatedBy) {
  const checked = validateActionsMatrix(body);
  if (!checked.ok) {
    const err = new Error('INVALID_ACTION_CAPS');
    err.code = 'INVALID_ACTION_CAPS';
    throw err;
  }
  for (const role of ACTION_ROLES) {
    const actions = checked.data[role];
    await db.getQuery()(
      `INSERT INTO role_action_capabilities (role_key, actions, updated_at, updated_by)
       VALUES ($1, $2::jsonb, NOW(), $3)
       ON CONFLICT (role_key) DO UPDATE SET
         actions = EXCLUDED.actions,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [role, JSON.stringify(actions), updatedBy || null]
    );
  }
  invalidateCache();
  return getMatrix();
}

async function roleHasPermission(role, permission) {
  try {
    const matrix = await getMatrixCached();
    const key = roleKeyForActions(role);
    const map = matrix[key];
    if (map) return hasActionPermission(map, permission);
  } catch (err) {
    logger.warn('[roleActionCaps] roleHasPermission fallback:', err.message);
  }
  return hasPermissionDefault(role, permission);
}

module.exports = {
  getActions,
  getActionsForUi,
  getMatrix,
  getMatrixCached,
  saveMatrix,
  roleHasPermission,
  invalidateCache,
  roleKeyForActions,
  ACTION_KEYS,
  ACTION_ROLES
};
