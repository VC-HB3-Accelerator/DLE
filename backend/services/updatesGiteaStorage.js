/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Приватный Gitea на HB3 как хранилище pack (клиент в Gitea не ходит).
 * URL/token берутся из updates_hub_settings (БД), не из .env.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const logger = require('../utils/logger');
const updatesHubSettingsService = require('./updatesHubSettingsService');

async function getGiteaConfig() {
  const settings = await updatesHubSettingsService.getSettings();
  return {
    giteaUrl: (settings.gitea_url || '').replace(/\/$/, ''),
    giteaToken: settings.gitea_token || '',
    assetTemplate: settings.gitea_asset_template || '',
    org: settings.gitea_org,
    repo: settings.gitea_repo,
  };
}

function isGiteaConfigured(config) {
  return Boolean(config?.giteaUrl && config?.giteaToken);
}

/**
 * Скачать asset из приватного Gitea в локальный файл.
 */
function fetchGiteaAssetToFile(assetUrl, destPath, giteaToken) {
  return new Promise((resolve, reject) => {
    if (!giteaToken) {
      reject(new Error('Gitea token not set in updates_hub_settings'));
      return;
    }

    let url;
    try {
      url = new URL(assetUrl);
    } catch (error) {
      reject(error);
      return;
    }

    const lib = url.protocol === 'http:' ? http : https;
    const req = lib.get(
      assetUrl,
      {
        headers: {
          Authorization: `token ${giteaToken}`,
          Accept: 'application/octet-stream',
          'User-Agent': 'dle-updates-hub',
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          fetchGiteaAssetToFile(res.headers.location, destPath, giteaToken).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`Gitea asset HTTP ${res.statusCode}`));
          return;
        }
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        const out = fs.createWriteStream(destPath);
        res.pipe(out);
        out.on('finish', () => resolve(destPath));
        out.on('error', reject);
      }
    );
    req.on('error', reject);
  });
}

function resolveGiteaAssetUrl({ version, packFilename, giteaAssetUrl, assetTemplate }) {
  if (giteaAssetUrl) {
    return giteaAssetUrl;
  }
  const template = assetTemplate || '';
  if (!template) {
    return null;
  }
  return template
    .replace(/\{version\}/g, encodeURIComponent(version || ''))
    .replace(/\{filename\}/g, encodeURIComponent(packFilename || ''));
}

async function ensureLocalPackFromGitea({ version, packFilename, giteaAssetUrl, packDir }) {
  const localPath = path.join(packDir, packFilename);
  if (fs.existsSync(localPath)) {
    return localPath;
  }

  const config = await getGiteaConfig();
  const assetUrl = resolveGiteaAssetUrl({
    version,
    packFilename,
    giteaAssetUrl,
    assetTemplate: config.assetTemplate,
  });
  if (!assetUrl) {
    return null;
  }
  if (!config.giteaToken) {
    logger.warn('[updates/gitea] pack missing locally and gitea_token not set in DB');
    return null;
  }

  logger.info(`[updates/gitea] fetch ${assetUrl} → ${localPath}`);
  await fetchGiteaAssetToFile(assetUrl, localPath, config.giteaToken);
  return localPath;
}

module.exports = {
  getGiteaConfig,
  isGiteaConfigured,
  fetchGiteaAssetToFile,
  resolveGiteaAssetUrl,
  ensureLocalPackFromGitea,
};
