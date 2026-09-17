/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Валидация / экранирование аргументов перед shell/SSH (VDS).
 */

const { spawn } = require('child_process');

class ShellSafeError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ShellSafeError';
    this.status = status;
  }
}

/** Unix login: начинается с буквы/_; без shell-мета. */
function assertSafeUnixUsername(raw, label = 'username', { allowRoot = false } = {}) {
  const username = String(raw || '').trim();
  if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(username)) {
    throw new ShellSafeError(`Некорректное ${label}`);
  }
  if (!allowRoot && username === 'root') {
    throw new ShellSafeError('Операция с root запрещена');
  }
  return username;
}

/** Имя контейнера Docker / Compose. */
function assertSafeDockerName(raw) {
  const name = String(raw || '').trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(name)) {
    throw new ShellSafeError('Некорректное имя контейнера');
  }
  return name;
}

/** Хост: IPv4 или hostname. */
function assertSafeHost(raw, label = 'host') {
  const host = String(raw || '').trim();
  if (
    !/^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3})$/.test(host) &&
    !/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?$/.test(host)
  ) {
    throw new ShellSafeError(`Некорректный ${label}`);
  }
  return host;
}

/** Абсолютный путь без пробелов и shell-метасимволов. */
function assertSafeAbsPath(raw, label = 'path') {
  const p = String(raw || '').trim();
  if (!p.startsWith('/')) {
    throw new ShellSafeError(`${label} должен быть абсолютным`);
  }
  if (!/^\/[A-Za-z0-9._/-]+$/.test(p) || p.includes('..')) {
    throw new ShellSafeError(`Некорректный ${label}`);
  }
  return p;
}

/** Публичный SSH-ключ одной строкой. */
function assertSafeSshPublicKey(raw) {
  const key = String(raw || '').trim();
  if (!/^(ssh-(?:rsa|ed25519|dss)|ecdsa-sha2-nistp(?:256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com)\s+[A-Za-z0-9+/=]+(?:\s+\S+)?$/.test(key)) {
    throw new ShellSafeError('Некорректный формат SSH-ключа');
  }
  if (key.includes('\n') || key.includes('\r') || key.includes('"') || key.includes('`') || key.includes('$')) {
    throw new ShellSafeError('SSH-ключ содержит недопустимые символы');
  }
  return key;
}

function assertPositiveInt(raw, { min = 1, max = 5000, fallback = 100 } = {}) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/** POSIX single-quote для вставки в sh -c / ssh "…". */
function shellSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

/**
 * Локальный spawn без shell (argv).
 * @returns {Promise<{code:number, stdout:string, stderr:string}>}
 */
function spawnCapture(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      ...opts,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
    if (opts.stdin != null) {
      child.stdin.write(opts.stdin);
      child.stdin.end();
    } else {
      child.stdin.end();
    }
  });
}

async function chpasswdLocal(username, password) {
  const safeUser = assertSafeUnixUsername(username);
  if (typeof password !== 'string' || password.length < 1 || password.length > 256) {
    throw new ShellSafeError('Некорректный пароль');
  }
  if (/[\n\r]/.test(password)) {
    throw new ShellSafeError('Пароль содержит недопустимые символы');
  }
  const result = await spawnCapture('chpasswd', [], {
    stdin: `${safeUser}:${password}\n`,
  });
  if (result.code !== 0) {
    throw new ShellSafeError(result.stderr || 'chpasswd failed', 500);
  }
  return result;
}

module.exports = {
  ShellSafeError,
  assertSafeUnixUsername,
  assertSafeDockerName,
  assertSafeHost,
  assertSafeAbsPath,
  assertSafeSshPublicKey,
  assertPositiveInt,
  shellSingleQuote,
  spawnCapture,
  chpasswdLocal,
};
