/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Закрытая раздача update-pack (ТЗ §3.4).
 * Entitlement: license-токен из auth_tokens на балансе TreasuryModule
 * (см. updatesEntitlementService.js).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const logger = require('../utils/logger');

const PACK_DIR = process.env.UPDATES_PACK_DIR
  || path.resolve(process.cwd(), 'update-packs')
  || path.resolve(__dirname, '../../update-packs');

const DOWNLOAD_TTL_MS = Number(process.env.UPDATES_DOWNLOAD_TTL_MS || 60 * 60 * 1000);

function publicBaseUrl(req) {
  if (process.env.UPDATES_PUBLIC_BASE_URL) {
    return process.env.UPDATES_PUBLIC_BASE_URL.replace(/\/$/, '');
  }
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}`;
}

function readDleVersionFile() {
  const candidates = [
    process.env.DLE_VERSION_PATH,
    process.env.DLE_APP_ROOT ? path.join(process.env.DLE_APP_ROOT, 'DLE_VERSION') : null,
    '/host-project/DLE_VERSION',
    '/app/DLE_VERSION',
    path.resolve(process.cwd(), 'DLE_VERSION'),
    path.resolve(process.cwd(), '..', 'DLE_VERSION'),
    path.resolve(__dirname, '../../DLE_VERSION'),
    path.resolve(__dirname, '../../../DLE_VERSION'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        const version = String(fs.readFileSync(candidate, 'utf8')).trim();
        if (version) {
          return { version, path: candidate };
        }
      }
    } catch {
      // next
    }
  }
  return { version: null, path: null };
}

async function getInstanceStatus() {
  const local = readDleVersionFile();
  const latest = await getLatestRelease();
  const hubSettings = await require('./updatesHubSettingsService').getSettings();
  return {
    currentVersion: local.version,
    latestVersion: latest?.version || null,
    minFrom: latest?.min_from || null,
    updateAvailable: Boolean(
      latest?.version && local.version && latest.version !== local.version
    ),
    stubMode: Boolean(hubSettings.stub_mode),
  };
}

async function getLatestRelease() {
  const { rows } = await db.getQuery()(
    `SELECT version, min_from, changelog, pack_filename, pack_sha256, pack_size_bytes,
            published_at, created_at
     FROM update_releases
     WHERE is_published = true
     ORDER BY created_at DESC
     LIMIT 1`
  );
  return rows[0] || null;
}

/**
 * Entitlement: license ERC-20 из auth_tokens на балансе TreasuryModule.
 * stub_mode в updates_hub_settings — только отладка.
 */
async function assertEntitled({ dleContract, userId, walletAddress, requestId }) {
  return require('./updatesEntitlementService').assertEntitled({
    dleContract,
    userId,
    walletAddress,
    requestId,
  });
}

async function createDownloadToken({ releaseId, dleContract, userId, walletAddress }) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + DOWNLOAD_TTL_MS);
  await db.getQuery()(
    `INSERT INTO update_download_tokens
       (token, release_id, dle_contract, user_id, wallet_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [token, releaseId, dleContract, userId || null, walletAddress || null, expiresAt]
  );
  return { token, expiresAt };
}

async function authorizeDownload({ dleContract, userId, walletAddress, req, requestId }) {
  const release = await getLatestRelease();
  if (!release) {
    const err = new Error('No published update release');
    err.status = 404;
    throw err;
  }

  await assertEntitled({
    dleContract,
    userId,
    walletAddress,
    requestId: requestId || req?.id || req?.headers?.['x-request-id'] || null,
  });

  const { rows } = await db.getQuery()(
    `SELECT id FROM update_releases WHERE version = $1 LIMIT 1`,
    [release.version]
  );
  const releaseId = rows[0]?.id;
  if (!releaseId) {
    const err = new Error('Release row missing');
    err.status = 500;
    throw err;
  }

  const { token, expiresAt } = await createDownloadToken({
    releaseId,
    dleContract: String(dleContract).trim().toLowerCase(),
    userId,
    walletAddress,
  });

  const downloadUrl = `${publicBaseUrl(req)}/api/updates/download/${token}`;
  return {
    version: release.version,
    minFrom: release.min_from,
    changelog: release.changelog,
    packSha256: release.pack_sha256,
    expiresAt: expiresAt.toISOString(),
    downloadUrl,
  };
}

async function consumeDownloadToken(token) {
  const { rows } = await db.getQuery()(
    `SELECT t.id, t.used_at, t.expires_at, r.pack_filename, r.version, r.pack_sha256,
            r.gitea_asset_url
     FROM update_download_tokens t
     JOIN update_releases r ON r.id = t.release_id
     WHERE t.token = $1
     LIMIT 1`,
    [token]
  );
  const row = rows[0];
  if (!row) {
    const err = new Error('Invalid download token');
    err.status = 404;
    throw err;
  }
  if (row.used_at) {
    const err = new Error('Download token already used');
    err.status = 410;
    throw err;
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    const err = new Error('Download token expired');
    err.status = 410;
    throw err;
  }

  await db.getQuery()(
    `UPDATE update_download_tokens SET used_at = NOW() WHERE id = $1 AND used_at IS NULL`,
    [row.id]
  );

  let filePath = path.join(PACK_DIR, row.pack_filename);
  if (!fs.existsSync(filePath)) {
    try {
      const gitea = require('./updatesGiteaStorage');
      const fetched = await gitea.ensureLocalPackFromGitea({
        version: row.version,
        packFilename: row.pack_filename,
        giteaAssetUrl: row.gitea_asset_url,
        packDir: PACK_DIR,
      });
      if (fetched) {
        filePath = fetched;
      }
    } catch (error) {
      logger.error(`[updates] gitea fetch failed: ${error.message}`);
    }
  }

  if (!fs.existsSync(filePath)) {
    logger.error(`[updates] pack file missing: ${filePath}`);
    const err = new Error('Pack file not found on server');
    err.status = 500;
    throw err;
  }

  return {
    filePath,
    filename: row.pack_filename,
    version: row.version,
    sha256: row.pack_sha256,
  };
}

/**
 * Регистрация локального pack (админ / выпуск). Не публикует в GitHub.
 */
async function registerRelease({
  version,
  minFrom,
  changelog,
  packFilename,
  packSha256,
  packSizeBytes,
  publish = false,
  giteaAssetUrl = null,
}) {
  const { rows } = await db.getQuery()(
    `INSERT INTO update_releases
       (version, min_from, changelog, pack_filename, pack_sha256, pack_size_bytes,
        gitea_asset_url, is_published, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $8 THEN NOW() ELSE NULL END)
     ON CONFLICT (version) DO UPDATE SET
       min_from = EXCLUDED.min_from,
       changelog = EXCLUDED.changelog,
       pack_filename = EXCLUDED.pack_filename,
       pack_sha256 = EXCLUDED.pack_sha256,
       pack_size_bytes = EXCLUDED.pack_size_bytes,
       gitea_asset_url = COALESCE(EXCLUDED.gitea_asset_url, update_releases.gitea_asset_url),
       is_published = EXCLUDED.is_published,
       published_at = CASE WHEN EXCLUDED.is_published THEN NOW() ELSE update_releases.published_at END
     RETURNING *`,
    [
      version,
      minFrom || null,
      changelog || null,
      packFilename,
      packSha256 || null,
      packSizeBytes || null,
      giteaAssetUrl || null,
      Boolean(publish),
    ]
  );
  return rows[0];
}

async function listLocalPacks() {
  if (!fs.existsSync(PACK_DIR)) {
    return [];
  }
  return fs.readdirSync(PACK_DIR)
    .filter((name) => name.endsWith('.tar.gz') && !name.startsWith('.'))
    .map((name) => {
      const full = path.join(PACK_DIR, name);
      const stat = fs.statSync(full);
      return {
        filename: name,
        sizeBytes: stat.size,
        mtime: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => String(b.mtime).localeCompare(String(a.mtime)));
}

async function resolveLocalPackFile(filename) {
  const safe = path.basename(String(filename || ''));
  if (!safe || safe !== filename || !safe.endsWith('.tar.gz')) {
    const err = new Error('Invalid pack filename');
    err.status = 400;
    throw err;
  }
  const filePath = path.join(PACK_DIR, safe);
  if (!fs.existsSync(filePath)) {
    const err = new Error('Pack file not found');
    err.status = 404;
    throw err;
  }
  return { filePath, filename: safe };
}

module.exports = {
  getLatestRelease,
  getInstanceStatus,
  authorizeDownload,
  consumeDownloadToken,
  registerRelease,
  listLocalPacks,
  resolveLocalPackFile,
  assertEntitled,
  PACK_DIR,
};
