/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Overlay видимости экранов/блоков по ролям ОС.
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
  SCREEN_ROLES,
  SCREEN_KEYS,
  roleKeyForScreens,
  normalizeScreensMap,
  cloneDefaultScreens,
  validateScreensMatrix,
  isScreenAllowedByMap
} = loadShared('roleScreenCaps');

/** Продуктовый минимум для user: свой контент + таблицы + приватные чаты. */
const USER_OWN_WORKSPACE_SCREENS = Object.freeze([
  '/content/create',
  '/content/store/product/new',
  '/content/store/product/:id',
  '/tables',
  '/tables/create',
  '/tables/:id',
  '/tables/:id/edit',
  '/tables/:id/delete',
  '/personal-messages',
  '/admin-chat/:adminId',
]);

function screensAreEmpty(screens) {
  return !screens || typeof screens !== 'object' || Array.isArray(screens) || Object.keys(screens).length === 0;
}

async function persistRoleScreens(role, screens) {
  await db.getQuery()(
    `INSERT INTO role_screen_capabilities (role_key, screens, updated_at, updated_by)
     VALUES ($1, $2::jsonb, NOW(), NULL)
     ON CONFLICT (role_key) DO UPDATE SET
       screens = EXCLUDED.screens,
       updated_at = NOW()`,
    [role, JSON.stringify(screens)]
  );
}

let ensuringDefaults = null;
async function ensureStoredDefaults() {
  if (ensuringDefaults) return ensuringDefaults;
  ensuringDefaults = (async () => {
    for (const role of SCREEN_ROLES) {
      const { rows } = await db.getQuery()(
        `SELECT screens FROM role_screen_capabilities WHERE role_key = $1`,
        [role]
      );
      if (!rows.length || screensAreEmpty(rows[0].screens)) {
        await persistRoleScreens(role, cloneDefaultScreens(role));
      }
    }

    // Старые сохранённые матрицы могли держать own-workspace=false у user
    const { rows: userRows } = await db.getQuery()(
      `SELECT screens FROM role_screen_capabilities WHERE role_key = 'user'`
    );
    if (userRows[0]?.screens) {
      const screens = normalizeScreensMap(userRows[0].screens, 'user');
      let changed = false;
      for (const path of USER_OWN_WORKSPACE_SCREENS) {
        if (screens[path] !== true) {
          screens[path] = true;
          changed = true;
        }
      }
      if (changed) {
        await persistRoleScreens('user', screens);
        logger.info('[roleScreenCaps] enabled own-workspace screens for role=user');
      }
    }
  })()
    .catch((err) => {
      logger.warn('[roleScreenCaps] ensure defaults:', err.message);
    })
    .finally(() => {
      ensuringDefaults = null;
    });
  return ensuringDefaults;
}

async function getScreens(role) {
  const key = roleKeyForScreens(role);
  await ensureStoredDefaults();
  const { rows } = await db.getQuery()(
    `SELECT role_key, screens FROM role_screen_capabilities WHERE role_key = $1`,
    [key]
  );
  return normalizeScreensMap(rows[0]?.screens, key);
}

async function getScreensForUi(role) {
  try {
    return await getScreens(role);
  } catch (err) {
    logger.warn('[roleScreenCaps] GET fallback defaults:', err.message);
    return cloneDefaultScreens(role);
  }
}

async function getMatrix() {
  await ensureStoredDefaults();
  const { rows } = await db.getQuery()(
    `SELECT role_key, screens FROM role_screen_capabilities WHERE role_key = ANY($1::text[])`,
    [SCREEN_ROLES]
  );
  const byKey = {};
  for (const row of rows) {
    byKey[row.role_key] = normalizeScreensMap(row.screens, row.role_key);
  }
  const data = {};
  for (const role of SCREEN_ROLES) {
    data[role] = byKey[role] || cloneDefaultScreens(role);
  }
  return data;
}

async function saveMatrix(body, updatedBy) {
  const checked = validateScreensMatrix(body);
  if (!checked.ok) {
    const err = new Error('INVALID_SCREEN_CAPS');
    err.code = 'INVALID_SCREEN_CAPS';
    throw err;
  }
  for (const role of SCREEN_ROLES) {
    const screens = checked.data[role];
    await db.getQuery()(
      `INSERT INTO role_screen_capabilities (role_key, screens, updated_at, updated_by)
       VALUES ($1, $2::jsonb, NOW(), $3)
       ON CONFLICT (role_key) DO UPDATE SET
         screens = EXCLUDED.screens,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [role, JSON.stringify(screens), updatedBy || null]
    );
  }
  return getMatrix();
}

function isPathAllowed(screensMap, path) {
  return isScreenAllowedByMap(screensMap, path);
}

module.exports = {
  getScreens,
  getScreensForUi,
  getMatrix,
  saveMatrix,
  isPathAllowed,
  roleKeyForScreens,
  SCREEN_KEYS,
  SCREEN_ROLES
};
