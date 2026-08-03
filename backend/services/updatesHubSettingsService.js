/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Настройки hub обновлений и Gitea-storage — в БД (updates_hub_settings), не в .env.
 */

const db = require('../db');
const logger = require('../utils/logger');

const DEFAULTS = {
  hub_url: 'https://hb3-accelerator.com',
  stub_mode: true,
  gitea_url: '',
  gitea_token: '',
  hub_service_token: '',
  gitea_asset_template: '',
  gitea_org: '',
  gitea_repo: '',
};

function getEncryptionKey() {
  const encryptionUtils = require('../utils/encryptionUtils');
  return encryptionUtils.getEncryptionKey();
}

function normalize(row = {}) {
  const hubUrl = String(row.hub_url ?? DEFAULTS.hub_url).trim() || DEFAULTS.hub_url;
  return {
    hub_url: hubUrl,
    stub_mode: row.stub_mode !== undefined && row.stub_mode !== null
      ? Boolean(row.stub_mode)
      : DEFAULTS.stub_mode,
    gitea_url: String(row.gitea_url || '').replace(/\/$/, ''),
    gitea_token: row.gitea_token || '',
    hub_service_token: row.hub_service_token || '',
    gitea_asset_template: String(row.gitea_asset_template || '').trim(),
    gitea_org: String(row.gitea_org || '').trim(),
    gitea_repo: String(row.gitea_repo || '').trim(),
    updated_at: row.updated_at || null,
    updated_by: row.updated_by || null,
  };
}

function maskSecret(value) {
  const token = value || '';
  return {
    set: Boolean(token),
    hint: token ? `…${token.slice(-8)}` : '',
  };
}

function toPublic(settings) {
  const gitea = maskSecret(settings.gitea_token);
  const hubTok = maskSecret(settings.hub_service_token);
  return {
    hub_url: settings.hub_url,
    stub_mode: settings.stub_mode,
    gitea_url: settings.gitea_url,
    gitea_org: settings.gitea_org,
    gitea_repo: settings.gitea_repo,
    gitea_asset_template: settings.gitea_asset_template,
    gitea_token_set: gitea.set,
    gitea_token_hint: gitea.hint,
    hub_service_token_set: hubTok.set,
    hub_service_token_hint: hubTok.hint,
    updated_at: settings.updated_at,
  };
}

function tableMissingError(error) {
  return error?.code === '42P01' || /updates_hub_settings/i.test(error?.message || '')
    && /does not exist/i.test(error?.message || '');
}

async function getSettings() {
  const encryptionKey = getEncryptionKey();
  try {
    const { rows } = await db.getQuery()(
      `SELECT
         id, hub_url, stub_mode, gitea_url, gitea_asset_template,
         gitea_org, gitea_repo, updated_at, updated_by,
         CASE
           WHEN gitea_token_encrypted IS NULL OR gitea_token_encrypted = '' THEN NULL
           ELSE decrypt_text(gitea_token_encrypted, $1)
         END AS gitea_token,
         CASE
           WHEN hub_service_token_encrypted IS NULL OR hub_service_token_encrypted = '' THEN NULL
           ELSE decrypt_text(hub_service_token_encrypted, $1)
         END AS hub_service_token
       FROM updates_hub_settings
       WHERE id = 1`,
      [encryptionKey]
    );
    if (!rows.length) {
      return normalize(DEFAULTS);
    }
    return normalize(rows[0]);
  } catch (error) {
    logger.warn(`[updates/hub-settings] read: ${error.message}`);
    if (tableMissingError(error)) {
      const err = new Error(
        'Таблица updates_hub_settings не найдена. Примените миграцию 126_updates_hub_settings.sql'
      );
      err.status = 500;
      throw err;
    }
    throw error;
  }
}

function resolveNextSecret(payloadKey, clearKey, payload, currentValue) {
  if (payload[clearKey]) return '';
  if (payload[payloadKey] !== undefined && String(payload[payloadKey]).trim() !== '') {
    return String(payload[payloadKey]).trim();
  }
  return currentValue || '';
}

function resolveUpdatedBy(updatedBy) {
  const n = Number(updatedBy);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function saveSettings(payload = {}, updatedBy = null) {
  const encryptionKey = getEncryptionKey();

  let current;
  try {
    current = await getSettings();
  } catch (error) {
    if (error.status === 500) throw error;
    const err = new Error(
      `Не удалось прочитать настройки перед сохранением: ${error.message}`
    );
    err.status = 500;
    throw err;
  }

  // если строки ещё нет — создаём
  try {
    await db.getQuery()(
      `INSERT INTO updates_hub_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`
    );
  } catch (error) {
    if (tableMissingError(error)) {
      const err = new Error(
        'Таблица updates_hub_settings не найдена. Примените миграцию 126_updates_hub_settings.sql'
      );
      err.status = 500;
      throw err;
    }
    throw error;
  }

  const hubUrl = payload.hub_url !== undefined
    ? String(payload.hub_url || '').trim() || DEFAULTS.hub_url
    : current.hub_url;
  const stubMode = payload.stub_mode !== undefined
    ? Boolean(payload.stub_mode)
    : current.stub_mode;
  const giteaUrl = payload.gitea_url !== undefined
    ? String(payload.gitea_url || '').trim().replace(/\/$/, '')
    : current.gitea_url;
  const giteaOrg = payload.gitea_org !== undefined
    ? String(payload.gitea_org || '').trim()
    : current.gitea_org;
  const giteaRepo = payload.gitea_repo !== undefined
    ? String(payload.gitea_repo || '').trim()
    : current.gitea_repo;
  const giteaTemplate = payload.gitea_asset_template !== undefined
    ? String(payload.gitea_asset_template || '').trim()
    : current.gitea_asset_template;

  const nextGiteaToken = resolveNextSecret(
    'gitea_token',
    'clear_gitea_token',
    payload,
    current.gitea_token
  );
  const nextHubToken = resolveNextSecret(
    'hub_service_token',
    'clear_hub_service_token',
    payload,
    current.hub_service_token
  );
  const actorId = resolveUpdatedBy(updatedBy);

  const params = [
    encryptionKey,
    hubUrl,
    stubMode,
    giteaUrl,
    nextGiteaToken,
    nextHubToken,
    giteaTemplate,
    giteaOrg,
    giteaRepo,
    actorId,
  ];

  try {
    await db.getQuery()(
      `UPDATE updates_hub_settings SET
         hub_url = $2,
         stub_mode = $3::boolean,
         gitea_url = $4,
         gitea_token_encrypted = CASE WHEN $5::text = '' THEN NULL ELSE encrypt_text($5::text, $1) END,
         hub_service_token_encrypted = CASE WHEN $6::text = '' THEN NULL ELSE encrypt_text($6::text, $1) END,
         gitea_asset_template = $7,
         gitea_org = $8,
         gitea_repo = $9,
         updated_at = NOW(),
         updated_by = $10
       WHERE id = 1`,
      params
    );
  } catch (error) {
    logger.error(`[updates/hub-settings] save: ${error.message}`);
    if (tableMissingError(error)) {
      const err = new Error(
        'Таблица updates_hub_settings не найдена. Примените миграцию 126_updates_hub_settings.sql'
      );
      err.status = 500;
      throw err;
    }
    // FK updated_by — сохраняем без него
    if (error.code === '23503') {
      await db.getQuery()(
        `UPDATE updates_hub_settings SET
           hub_url = $2,
           stub_mode = $3::boolean,
           gitea_url = $4,
           gitea_token_encrypted = CASE WHEN $5::text = '' THEN NULL ELSE encrypt_text($5::text, $1) END,
           hub_service_token_encrypted = CASE WHEN $6::text = '' THEN NULL ELSE encrypt_text($6::text, $1) END,
           gitea_asset_template = $7,
           gitea_org = $8,
           gitea_repo = $9,
           updated_at = NOW(),
           updated_by = NULL
         WHERE id = 1`,
        [
          encryptionKey,
          hubUrl,
          stubMode,
          giteaUrl,
          nextGiteaToken,
          nextHubToken,
          giteaTemplate,
          giteaOrg,
          giteaRepo,
        ]
      );
      try {
        require('./updatesEntitlementService').clearEntitlementCache();
      } catch {
        // ignore
      }
      return getSettings();
    }
    const err = new Error(`Ошибка сохранения: ${error.message}`);
    err.status = 500;
    throw err;
  }

  try {
    require('./updatesEntitlementService').clearEntitlementCache();
  } catch {
    // ignore
  }

  return getSettings();
}

function resolveHubBase(settings) {
  const raw = String(settings?.hub_url || 'self').replace(/\/$/, '');
  if (!raw || raw === 'self' || raw === 'local') {
    return null;
  }
  return raw;
}

module.exports = {
  DEFAULTS,
  getSettings,
  saveSettings,
  toPublic,
  resolveHubBase,
};
