/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Единый apply: запрос на hub (HB3) → pack в папку приложения → update.sh → удаление pack.
 * Локал и VDS — один поток.
 */

const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const logger = require('../utils/logger');
const updatesService = require('./updatesService');

const jobs = new Map();
const COMPOSE_PLUGIN_URL =
  process.env.DOCKER_COMPOSE_PLUGIN_URL
  || 'https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64';

function getAppRoot() {
  const candidates = [
    process.env.DLE_APP_ROOT,
    process.env.HOST_PROJECT_ROOT,
    '/host-project',
    path.resolve(process.cwd(), '..'),
    path.resolve(__dirname, '../..'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, 'update.sh'))
      && (
        fs.existsSync(path.join(candidate, 'docker-compose.yml'))
        || fs.existsSync(path.join(candidate, 'docker-compose.prod.yml'))
      )
    ) {
      return candidate;
    }
  }
  return null;
}

function getComposeFile(appRoot) {
  if (process.env.DLE_COMPOSE_FILE) {
    return process.env.DLE_COMPOSE_FILE;
  }
  if (fs.existsSync(path.join(appRoot, 'docker-compose.prod.yml'))
    && process.env.NODE_ENV === 'production') {
    return 'docker-compose.prod.yml';
  }
  if (fs.existsSync(path.join(appRoot, 'docker-compose.yml'))) {
    return 'docker-compose.yml';
  }
  return 'docker-compose.prod.yml';
}

function inspectComposeContext() {
  const empty = { project: '', hostDir: '', image: '' };
  try {
    const project = execFileSync(
      'docker',
      ['inspect', '-f', '{{index .Config.Labels "com.docker.compose.project"}}', 'dapp-backend'],
      { encoding: 'utf8', timeout: 8000 }
    ).trim();
    const hostDir = execFileSync(
      'docker',
      ['inspect', '-f', '{{index .Config.Labels "com.docker.compose.project.working_dir"}}', 'dapp-backend'],
      { encoding: 'utf8', timeout: 8000 }
    ).trim();
    const image = execFileSync(
      'docker',
      ['inspect', '-f', '{{.Config.Image}}', 'dapp-backend'],
      { encoding: 'utf8', timeout: 8000 }
    ).trim();
    return { project, hostDir, image };
  } catch {
    return empty;
  }
}

function getHubBaseFromSettings(settings) {
  return require('./updatesHubSettingsService').resolveHubBase(settings);
}

async function getHubBase() {
  const settings = await require('./updatesHubSettingsService').getSettings();
  return getHubBaseFromSettings(settings);
}

function httpJson(method, urlString, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const lib = url.protocol === 'http:' ? http : https;
    const payload = body ? JSON.stringify(body) : null;
    const req = lib.request(
      url,
      {
        method,
        headers: {
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(headers || {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let data = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch {
            data = { raw: text };
          }
  if (res.statusCode >= 400) {
            const err = new Error(data?.error || data?.message || `HTTP ${res.statusCode}`);
            err.status = res.statusCode;
            err.data = data;
            reject(err);
            return;
          }
          resolve({ status: res.statusCode, data });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function downloadToFile(urlString, destPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const lib = url.protocol === 'http:' ? http : https;
    const req = lib.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        downloadToFile(res.headers.location, destPath, headers).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Download HTTP ${res.statusCode}`));
        return;
      }
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const out = fs.createWriteStream(destPath);
      res.pipe(out);
      out.on('finish', () => resolve(destPath));
      out.on('error', reject);
    });
    req.on('error', reject);
  });
}

/** В образе backend есть docker.io, но часто без compose plugin — ставим при первом apply. */
function ensureDockerComposePlugin() {
  try {
    execFileSync('docker', ['compose', 'version'], { stdio: 'pipe' });
    return;
  } catch {
    // continue
  }

  const pluginDir = '/usr/local/lib/docker/cli-plugins';
  const pluginPath = path.join(pluginDir, 'docker-compose');
  fs.mkdirSync(pluginDir, { recursive: true });

  if (!fs.existsSync(pluginPath)) {
    logger.info('[updates/apply] downloading docker compose plugin…');
    execFileSync('curl', ['-fsSL', COMPOSE_PLUGIN_URL, '-o', pluginPath], { stdio: 'pipe' });
    fs.chmodSync(pluginPath, 0o755);
  }

  execFileSync('docker', ['compose', 'version'], { stdio: 'pipe' });
}

function setJob(jobId, patch) {
  const prev = jobs.get(jobId) || {};
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  jobs.set(jobId, next);
  return next;
}

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

async function authorizeFromHubOrLocal({ dleContract, fromVersion, walletAddress, userId, req }) {
  const hubSettings = await require('./updatesHubSettingsService').getSettings();
  const hub = getHubBaseFromSettings(hubSettings);
  if (!hub) {
    return updatesService.authorizeDownload({
      dleContract,
      userId,
      walletAddress,
      req,
    });
  }

  const token = hubSettings.hub_service_token || '';
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const result = await httpJson('POST', `${hub}/api/updates/authorize`, {
    body: { dleContract, fromVersion },
    headers,
  });
  if (!result.data?.success || !result.data?.data?.downloadUrl) {
    const err = new Error(result.data?.error || 'Hub authorize failed');
    err.status = 502;
    throw err;
  }
  return result.data.data;
}

async function fetchHubLatest() {
  const hub = await getHubBase();
  if (!hub) {
    return updatesService.getLatestRelease();
  }
  try {
    const result = await httpJson('GET', `${hub}/api/updates/latest`);
    const d = result.data?.data;
    if (!d) return null;
    return {
      version: d.version,
      min_from: d.minFrom,
      changelog: d.changelog,
      pack_sha256: d.packSha256,
      pack_size_bytes: d.packSizeBytes,
      published_at: d.publishedAt,
    };
  } catch (error) {
    logger.warn(`[updates/apply] hub latest: ${error.message}`);
    return updatesService.getLatestRelease();
  }
}

/**
 * Скачать pack в APP_ROOT/update-packs и запустить update.sh (detached).
 */
async function startApplyHere({ dleContract, fromVersion, walletAddress, userId, req }) {
  const appRoot = getAppRoot();
  if (!appRoot) {
    const err = new Error(
      'Не найден корень приложения (update.sh + compose). Смонтируйте репо как /host-project (DLE_APP_ROOT).'
    );
    err.status = 500;
    throw err;
  }

  const updateSh = path.join(appRoot, 'update.sh');
  if (!fs.existsSync(updateSh)) {
    const err = new Error('update.sh не найден в корне приложения');
    err.status = 500;
    throw err;
  }

  try {
    ensureDockerComposePlugin();
  } catch (error) {
    const err = new Error(
      `docker compose недоступен в backend: ${error.message}. Нужен docker.sock и compose plugin.`
    );
    err.status = 500;
    throw err;
  }

  const auth = await authorizeFromHubOrLocal({
    dleContract,
    fromVersion,
    walletAddress,
    userId,
    req,
  });

  const packsDir = path.join(appRoot, 'update-packs');
  fs.mkdirSync(packsDir, { recursive: true });
  const packPath = path.join(packsDir, `.incoming-${auth.version}-${Date.now()}.tar.gz`);

  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  setJob(jobId, {
    id: jobId,
    status: 'downloading',
    version: auth.version,
    packPath,
    appRoot,
    log: [],
  });

  (async () => {
    try {
      setJob(jobId, { status: 'downloading', message: 'Скачивание pack с hub…' });
      await downloadToFile(auth.downloadUrl, packPath);
      setJob(jobId, { status: 'applying', message: 'Запуск update.sh…' });

      const composeFile = getComposeFile(appRoot);
      const composeCtx = inspectComposeContext();
      const logPath = path.join(appRoot, 'backups', `apply-${jobId}.log`);
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      const logFd = fs.openSync(logPath, 'w');

      const child = spawn(
        'bash',
        [updateSh, `--pack=${packPath}`, `--app-dir=${appRoot}`, `--compose=${composeFile}`],
        {
          cwd: appRoot,
          detached: true,
          stdio: ['ignore', logFd, logFd],
          env: {
            ...process.env,
            // CLI из образа backend (/usr/local/bin/docker) должен быть первым — не docker.io 1.41
            PATH: `/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
            KEEP_PACK: '0',
            ...(composeCtx.project ? { COMPOSE_PROJECT_NAME: composeCtx.project } : {}),
            ...(composeCtx.hostDir ? { DLE_HOST_APP_DIR: composeCtx.hostDir } : {}),
            ...(composeCtx.image ? { DLE_COMPOSE_RUNNER_IMAGE: composeCtx.image } : {}),
          },
        }
      );
      child.unref();

      setJob(jobId, {
        status: 'started',
        message: 'update.sh запущен; после recreate обновите страницу',
        pid: child.pid,
        logPath,
      });
      logger.info(`[updates/apply] job=${jobId} pid=${child.pid} pack=${packPath}`);
    } catch (error) {
      logger.error(`[updates/apply] job=${jobId}: ${error.message}`);
      setJob(jobId, { status: 'error', message: error.message });
      try {
        if (fs.existsSync(packPath)) fs.unlinkSync(packPath);
      } catch {
        // ignore
      }
    }
  })();

  return getJob(jobId);
}

module.exports = {
  startApplyHere,
  getJob,
  getAppRoot,
  getHubBase,
  fetchHubLatest,
};
