/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Копирование bind-mount деревьев проекта на VDS (эталон — sync-to-vds.sh).
 */

const path = require('path');
const fs = require('fs-extra');
const { promisify } = require('util');
const { exec } = require('child_process');
const { execSshCommand, execScpCommand } = require('./sshUtils');
const log = require('./logger');

const execLocal = promisify(exec);

const TAR_EXCLUDES = [
  '.git',
  'node_modules',
  '*.log',
  '.env',
  'build',
  '.next',
  'coverage',
  '.nyc_output',
  'sessions',
  'temp',
  'tmp',
  '*.swp',
  '*.swo',
  '*~',
  '.DS_Store',
];

/**
 * Корень репозитория на хосте (монтируется в агент как /host-project).
 */
function resolveHostProjectRoot() {
  const candidates = [
    process.env.HOST_PROJECT_ROOT,
    '/host-project',
    path.resolve(__dirname, '..', '..'),
    path.resolve(__dirname, '..'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'backend')) && fs.existsSync(path.join(candidate, 'shared'))) {
      return candidate;
    }
  }

  throw new Error(
    'Не найден корень проекта (backend/ + shared/). '
    + 'Смонтируйте репозиторий в webssh-agent как /host-project или задайте HOST_PROJECT_ROOT.'
  );
}

function buildTarExcludeArgs(extraExcludes = []) {
  return [...TAR_EXCLUDES, ...extraExcludes]
    .map((pattern) => `--exclude='${pattern}'`)
    .join(' ');
}

/**
 * Упаковать каталог локально, SCP на VDS, распаковать в remoteDir.
 * @param {object} opts
 * @param {string} opts.localDir - абсолютный путь к каталогу
 * @param {string} opts.remoteDir - абсолютный путь на VDS (родитель, куда положить содержимое)
 * @param {string[]} [opts.extraExcludes]
 * @param {object} opts.sshOptions
 * @param {string} opts.dockerUser
 * @param {Function} [opts.sendWebSocketLog]
 */
async function transferDirectory({
  localDir,
  remoteDir,
  extraExcludes = [],
  sshOptions,
  dockerUser,
  sendWebSocketLog = () => {},
  label = path.basename(localDir),
}) {
  if (!(await fs.pathExists(localDir))) {
    const msg = `Каталог не найден, пропуск: ${localDir}`;
    log.warn(msg);
    sendWebSocketLog('warning', `⚠️ ${msg}`, 'overlay', null);
    return false;
  }

  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tarName = `overlay_${label.replace(/[^a-zA-Z0-9._-]/g, '_')}_${stamp}.tar.gz`;
  const localTar = path.join('/tmp', tarName);
  const parent = path.dirname(localDir);
  const base = path.basename(localDir);
  const excludes = buildTarExcludeArgs(extraExcludes);

  log.info(`📦 Упаковка ${label}: ${localDir}`);
  sendWebSocketLog('info', `📦 Упаковка ${label}…`, 'overlay', null);

  await execLocal(
    `tar -czf "${localTar}" ${excludes} -C "${parent}" "${base}"`,
    { maxBuffer: 1024 * 1024 * 200 }
  );

  try {
    await execSshCommand(`mkdir -p "${remoteDir}"`, sshOptions);
    await execScpCommand(localTar, `/tmp/${tarName}`, sshOptions);
    // strip-components=1: содержимое base/ → remoteDir/
    await execSshCommand(
      `mkdir -p "${remoteDir}" && tar -xzf /tmp/${tarName} -C "${remoteDir}" --strip-components=1 && rm -f /tmp/${tarName}`,
      sshOptions
    );
    await execSshCommand(`chown -R ${dockerUser}:${dockerUser} "${remoteDir}"`, sshOptions);
    log.success(`✅ ${label} передан → ${remoteDir}`);
    sendWebSocketLog('success', `✅ ${label} на VDS`, 'overlay', null);
    return true;
  } finally {
    await fs.remove(localTar).catch(() => {});
  }
}

/**
 * Передать на VDS деревья, нужные bind mounts prod compose.
 */
async function transferAppOverlay({ sshOptions, dockerUser, sendWebSocketLog = () => {} }) {
  let root;
  try {
    root = resolveHostProjectRoot();
  } catch (error) {
    sendWebSocketLog(
      'error',
      '❌ Нет доступа к коду проекта в webssh-agent. Пересоздайте контейнер: docker compose up -d --force-recreate webssh-agent (нужен mount /host-project).',
      'overlay',
      59
    );
    throw error;
  }

  const remoteBase = `/home/${dockerUser}/dapp`;

  log.info(`Корень проекта для overlay: ${root}`);
  sendWebSocketLog('info', `📁 Копирование кода с ${root}…`, 'overlay', 59);

  await execSshCommand(`mkdir -p ${remoteBase}/docker ${remoteBase}/frontend/dist`, sshOptions);

  const backendOk = await transferDirectory({
    localDir: path.join(root, 'backend'),
    remoteDir: `${remoteBase}/backend`,
    sshOptions,
    dockerUser,
    sendWebSocketLog,
    label: 'backend',
  });
  if (!backendOk) {
    throw new Error('Не удалось скопировать backend/ — на VDS bind ./backend:/app будет пустым, setup остановлен');
  }

  const sharedOk = await transferDirectory({
    localDir: path.join(root, 'shared'),
    remoteDir: `${remoteBase}/shared`,
    sshOptions,
    dockerUser,
    sendWebSocketLog,
    label: 'shared',
  });
  if (!sharedOk) {
    throw new Error('Не удалось скопировать shared/ — setup остановлен');
  }

  // scripts — migrate/prerender/gitea-db (не критично для старта, но нужно для post-up)
  await transferDirectory({
    localDir: path.join(root, 'scripts'),
    remoteDir: `${remoteBase}/scripts`,
    sshOptions,
    dockerUser,
    sendWebSocketLog,
    label: 'scripts',
  });

  await transferDirectory({
    localDir: path.join(root, 'docker', 'blanc-xray'),
    remoteDir: `${remoteBase}/docker/blanc-xray`,
    sshOptions,
    dockerUser,
    sendWebSocketLog,
    label: 'blanc-xray',
  });

  // frontend/dist целиком (SEO blog + published); не исключаем dist
  const distDir = path.join(root, 'frontend', 'dist');
  if (await fs.pathExists(distDir)) {
    await transferDirectory({
      localDir: distDir,
      remoteDir: `${remoteBase}/frontend/dist`,
      extraExcludes: [],
      sshOptions,
      dockerUser,
      sendWebSocketLog,
      label: 'frontend-dist',
    });
  } else {
    log.warn('frontend/dist отсутствует — создаём пустые каталоги для SEO mounts');
    await execSshCommand(
      `mkdir -p ${remoteBase}/frontend/dist/blog ${remoteBase}/frontend/dist/content/published && chown -R ${dockerUser}:${dockerUser} ${remoteBase}/frontend`,
      sshOptions
    );
  }

  // Минимальные файлы для возможного rebuild nginx/frontend на VDS
  const smallFiles = [
    ['frontend/nginx.Dockerfile', 'frontend/nginx.Dockerfile'],
    ['frontend/nginx-simple.conf', 'frontend/nginx-simple.conf'],
    ['frontend/nginx-local.conf', 'frontend/nginx-local.conf'],
    ['frontend/docker-entrypoint.sh', 'frontend/docker-entrypoint.sh'],
    ['backend/Dockerfile', 'backend/Dockerfile'],
  ];
  for (const [rel, remoteRel] of smallFiles) {
    const localPath = path.join(root, rel);
    if (await fs.pathExists(localPath)) {
      await execSshCommand(`mkdir -p ${remoteBase}/${path.dirname(remoteRel)}`, sshOptions);
      await execScpCommand(localPath, `${remoteBase}/${remoteRel}`, sshOptions);
    }
  }

  // preload model file (как sync)
  const preload = path.join(root, 'shared', 'ollama_preload_model.txt');
  if (!(await fs.pathExists(preload))) {
    await execSshCommand(
      `mkdir -p ${remoteBase}/shared && printf 'qwen2.5:1.5b\\n' > ${remoteBase}/shared/ollama_preload_model.txt && chown ${dockerUser}:${dockerUser} ${remoteBase}/shared/ollama_preload_model.txt`,
      sshOptions
    );
  }

  sendWebSocketLog('success', '✅ Bind-mount деревья скопированы', 'overlay', 60);
  return root;
}

module.exports = {
  resolveHostProjectRoot,
  transferDirectory,
  transferAppOverlay,
  TAR_EXCLUDES,
};
