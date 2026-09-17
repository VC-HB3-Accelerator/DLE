const { exec } = require('child_process');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const log = require('./logger');

const sshDir = path.join(os.homedir(), '.ssh');
const privateKeyPath = path.join(sshDir, 'auto_lends_vds');
const publicKeyPath = `${privateKeyPath}.pub`;
const sshConfigPath = path.join(sshDir, 'config');

const COMMON_SSH_OPTS = [
  '-o', 'StrictHostKeyChecking=no',
  '-o', 'UserKnownHostsFile=/dev/null',
  '-o', 'LogLevel=ERROR',
  '-o', 'ConnectTimeout=20',
  '-o', 'NumberOfPasswordPrompts=1',
].join(' ');

function isTransientSshFailure(stderr, code) {
  const text = `${stderr || ''} ${code || ''}`;
  return /Connection closed by remote host|kex_exchange_identification|Connection reset|Connection timed out|Connection refused/i.test(text);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ensureSshPermissions = async () => {
  try {
    await fs.ensureDir(sshDir);
    await fs.chmod(sshDir, 0o700).catch(() => {});
    await fs.chmod(privateKeyPath, 0o600).catch(() => {});
    await fs.chmod(publicKeyPath, 0o644).catch(() => {});
    await fs.chmod(sshConfigPath, 0o600).catch(() => {});
  } catch (error) {
    log.warn('Не удалось скорректировать права доступа к SSH директории: ' + error.message);
  }
};

function posixSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function runExec(command, extraEnv = {}) {
  return new Promise((resolve) => {
    exec(command, { env: { ...process.env, ...extraEnv } }, (error, stdout, stderr) => {
      resolve({
        code: error ? error.code : 0,
        stdout: stdout || '',
        stderr: stderr || '',
      });
    });
  });
}

function buildPasswordSsh(user, host, port, remoteCommand) {
  return `sshpass -e ssh ${COMMON_SSH_OPTS} -o PreferredAuthentications=password -o PubkeyAuthentication=no -p ${port} ${user}@${host} ${posixSingleQuote(remoteCommand)}`;
}

function buildKeySsh(user, host, port, remoteCommand) {
  return `ssh -i ${posixSingleQuote(privateKeyPath)} ${COMMON_SSH_OPTS} -o IdentitiesOnly=yes -o PreferredAuthentications=publickey -p ${port} ${user}@${host} ${posixSingleQuote(remoteCommand)}`;
}

function buildPasswordScp(user, host, port, sourcePath, targetPath) {
  return `sshpass -e scp ${COMMON_SSH_OPTS} -o PreferredAuthentications=password -o PubkeyAuthentication=no -P ${port} ${posixSingleQuote(sourcePath)} ${user}@${host}:${posixSingleQuote(targetPath)}`;
}

function buildKeyScp(user, host, port, sourcePath, targetPath) {
  return `scp -i ${posixSingleQuote(privateKeyPath)} ${COMMON_SSH_OPTS} -o IdentitiesOnly=yes -o PreferredAuthentications=publickey -P ${port} ${posixSingleQuote(sourcePath)} ${user}@${host}:${posixSingleQuote(targetPath)}`;
}

const execSshCommand = async (command, options = {}) => {
  const {
    sshHost,
    sshPort = 22,
    sshConnectUser,
    sshConnectPassword,
    vdsIp,
  } = options;

  await ensureSshPermissions();

  const user = String(sshConnectUser || 'root').trim();
  const host = String((sshHost || vdsIp || '')).trim();
  const password = sshConnectPassword ? String(sshConnectPassword).trim() : '';
  const privateKeyExists = await fs.pathExists(privateKeyPath);

  if (!host) {
    throw new Error('Не указан хост для SSH подключения (sshHost или vdsIp)');
  }
  if (!user) {
    throw new Error('Не указан пользователь для SSH подключения (sshConnectUser)');
  }

  const attempts = [];
  if (password) {
    attempts.push({ kind: 'password', cmd: buildPasswordSsh(user, host, sshPort, command), env: { SSHPASS: password } });
  }
  if (privateKeyExists) {
    attempts.push({ kind: 'key', cmd: buildKeySsh(user, host, sshPort, command), env: {} });
  }
  if (!attempts.length) {
    throw new Error('Нет SSH пароля и нет ключа для подключения');
  }

  const maxRounds = 5;
  let last = { code: 255, stdout: '', stderr: 'SSH не выполнен' };

  for (let round = 1; round <= maxRounds; round += 1) {
    for (const attempt of attempts) {
      log.info(`🔍 SSH (${attempt.kind}) ${user}@${host}: ${command.slice(0, 180)}`);
      last = await runExec(attempt.cmd, attempt.env);
      log.info(`📤 SSH (${attempt.kind}) код=${last.code} stderr="${String(last.stderr).trim().slice(0, 240)}"`);
      if (last.code === 0) {
        return last;
      }
    }
    if (!isTransientSshFailure(last.stderr, last.code) || round === maxRounds) {
      return last;
    }
    const waitMs = 8000 * round;
    log.warn(`SSH оборван удалённым хостом (часто fail2ban). Ждём ${waitMs / 1000}с, попытка ${round + 1}/${maxRounds}…`);
    await sleep(waitMs);
  }

  return last;
};

const execScpCommand = async (sourcePath, targetPath, options = {}) => {
  const {
    sshHost,
    sshPort = 22,
    sshConnectUser,
    sshConnectPassword,
    vdsIp,
  } = options;

  await ensureSshPermissions();

  const user = String(sshConnectUser || 'root').trim();
  const host = String((sshHost || vdsIp || '')).trim();
  const password = sshConnectPassword ? String(sshConnectPassword).trim() : '';
  const privateKeyExists = await fs.pathExists(privateKeyPath);

  if (!host) {
    throw new Error('Не указан хост для SCP подключения (sshHost или vdsIp)');
  }
  if (!user) {
    throw new Error('Не указан пользователь для SCP подключения (sshConnectUser)');
  }

  const attempts = [];
  if (password) {
    attempts.push({
      kind: 'password',
      cmd: buildPasswordScp(user, host, sshPort, sourcePath, targetPath),
      env: { SSHPASS: password },
    });
  }
  if (privateKeyExists) {
    attempts.push({
      kind: 'key',
      cmd: buildKeyScp(user, host, sshPort, sourcePath, targetPath),
      env: {},
    });
  }

  log.info(`🔍 SCP ${sourcePath} -> ${user}@${host}:${targetPath}`);
  let last = { code: 255, stdout: '', stderr: 'SCP не выполнен' };
  for (const attempt of attempts) {
    last = await runExec(attempt.cmd, attempt.env);
    if (last.code === 0) {
      log.success('✅ SCP успешно выполнен');
      return last;
    }
    log.warn(`SCP (${attempt.kind}) код=${last.code}: ${String(last.stderr).trim().slice(0, 240)}`);
  }
  log.error(`❌ Ошибка SCP (код: ${last.code}): ${last.stderr}`);
  return last;
};

module.exports = {
  execSshCommand,
  execScpCommand,
  fixSshPermissions: ensureSshPermissions,
};
