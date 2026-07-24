/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const db = require('../db');
const dockerSocket = require('../utils/dockerSocket');
const logger = require('../utils/logger');

const GITEA_CONTAINER = process.env.GITEA_CONTAINER_NAME || 'dapp-gitea';

/** Известные опциональные кнопки (ядро chat/blog/management всегда видны). */
const KNOWN_BUTTONS = {
  repositories: false,
  // store: false — позже
};

/** Поддерживаемые языки UI (порядок отображения). */
const KNOWN_LOCALES = ['ru', 'en'];
const DEFAULT_LOCALES = [...KNOWN_LOCALES];

function normalizeButtons(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = { ...KNOWN_BUTTONS };
  for (const key of Object.keys(KNOWN_BUTTONS)) {
    if (Object.prototype.hasOwnProperty.call(src, key)) {
      out[key] = Boolean(src[key]);
    }
  }
  return out;
}

/**
 * Нормализация списка языков. Минимум один. Неизвестные коды отбрасываются.
 */
function normalizeLocales(raw) {
  let list = [];
  if (Array.isArray(raw)) {
    list = raw.map((item) => String(item || '').trim().toLowerCase());
  } else if (raw && typeof raw === 'object') {
    list = KNOWN_LOCALES.filter((code) => Boolean(raw[code]));
  }

  const seen = new Set();
  const out = [];
  for (const code of KNOWN_LOCALES) {
    if (list.includes(code) && !seen.has(code)) {
      seen.add(code);
      out.push(code);
    }
  }

  return out.length ? out : ['ru'];
}

async function getGiteaStatus() {
  try {
    if (!dockerSocket.isSocketAvailable()) {
      return { available: false, state: 'unavailable', detail: 'docker.sock недоступен' };
    }
    const containers = await dockerSocket.listContainers({ all: true });
    const match = containers.find((c) => c.name === GITEA_CONTAINER || c.name === 'gitea');
    if (!match) {
      return { available: true, state: 'missing', detail: `Контейнер ${GITEA_CONTAINER} не найден` };
    }
    return {
      available: true,
      state: String(match.state || '').toLowerCase() || 'unknown',
      status: match.status || '',
      name: match.name,
    };
  } catch (error) {
    logger.warn('[sidebarNav] gitea status:', error.message);
    return { available: false, state: 'error', detail: error.message };
  }
}

async function applyGiteaDesired(enabled) {
  if (!dockerSocket.isSocketAvailable()) {
    return {
      ok: false,
      skipped: true,
      message: 'Docker socket недоступен backend — Gitea не запущен/остановлен автоматически',
    };
  }

  try {
    if (enabled) {
      await dockerSocket.startContainer(GITEA_CONTAINER);
      return { ok: true, action: 'started', container: GITEA_CONTAINER };
    }
    await dockerSocket.stopContainer(GITEA_CONTAINER);
    return { ok: true, action: 'stopped', container: GITEA_CONTAINER };
  } catch (error) {
    logger.error('[sidebarNav] gitea apply:', error.message);
    return { ok: false, message: error.message };
  }
}

async function readRow() {
  const { rows } = await db.getQuery()(
    `SELECT buttons_json, locales_json, updated_at, updated_by
     FROM sidebar_nav_settings
     WHERE id = 1`
  );
  return rows[0] || null;
}

async function getSettings() {
  const row = await readRow();
  const buttons = normalizeButtons(row?.buttons_json);
  const locales = row?.locales_json != null
    ? normalizeLocales(row.locales_json)
    : [...DEFAULT_LOCALES];
  const gitea = await getGiteaStatus();

  return {
    buttons,
    locales,
    knownButtons: Object.keys(KNOWN_BUTTONS),
    knownLocales: [...KNOWN_LOCALES],
    gitea,
    updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
    updatedBy: row?.updated_by ?? null,
  };
}

async function setSettings({ buttons, locales, updatedBy = null } = {}) {
  const existing = await readRow();
  const normalizedButtons = buttons !== undefined
    ? normalizeButtons(buttons)
    : normalizeButtons(existing?.buttons_json);
  const normalizedLocales = locales !== undefined
    ? normalizeLocales(locales)
    : (existing?.locales_json != null
      ? normalizeLocales(existing.locales_json)
      : [...DEFAULT_LOCALES]);

  const userId = updatedBy != null && Number.isFinite(Number(updatedBy))
    ? Number(updatedBy)
    : null;

  const { rows } = await db.getQuery()(
    `INSERT INTO sidebar_nav_settings (id, buttons_json, locales_json, updated_at, updated_by)
     VALUES (1, $1::jsonb, $2::jsonb, NOW(), $3)
     ON CONFLICT (id) DO UPDATE SET
       buttons_json = EXCLUDED.buttons_json,
       locales_json = EXCLUDED.locales_json,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by
     RETURNING buttons_json, locales_json, updated_at, updated_by`,
    [JSON.stringify(normalizedButtons), JSON.stringify(normalizedLocales), userId]
  );

  const giteaAction = buttons !== undefined
    ? await applyGiteaDesired(normalizedButtons.repositories)
    : null;
  const gitea = await getGiteaStatus();

  return {
    buttons: normalizeButtons(rows[0].buttons_json),
    locales: normalizeLocales(rows[0].locales_json),
    knownButtons: Object.keys(KNOWN_BUTTONS),
    knownLocales: [...KNOWN_LOCALES],
    gitea,
    giteaAction,
    updatedAt: rows[0].updated_at ? new Date(rows[0].updated_at).toISOString() : null,
    updatedBy: rows[0].updated_by ?? null,
  };
}

module.exports = {
  getSettings,
  setSettings,
  normalizeButtons,
  normalizeLocales,
  KNOWN_BUTTONS,
  KNOWN_LOCALES,
  DEFAULT_LOCALES,
  GITEA_CONTAINER,
};
