const { exec } = require('child_process');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const log = require('./logger');

const sshDir = path.join(os.homedir(), '.ssh');
const privateKeyPath = path.join(sshDir, 'id_rsa');
const publicKeyPath = `${privateKeyPath}.pub`;
const sshConfigPath = path.join(sshDir, 'config');

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

const execSshCommand = async (command, options = {}) => {
  const {
    sshHost,
    sshPort = 22,
    sshConnectUser,
    sshConnectPassword,
    vdsIp
  } = options;

  await ensureSshPermissions();

  const privateKeyExists = await fs.pathExists(privateKeyPath);
  const escapedCommand = command.replace(/"/g, '\\"');

  // Удаляем пробелы и проверяем, что значения не пустые
  const user = String(sshConnectUser || 'root').trim();
  const host = String((sshHost || vdsIp || '')).trim();
  
  if (!host) {
    throw new Error('Не указан хост для SSH подключения (sshHost или vdsIp)');
  }
  
  if (!user) {
    throw new Error('Не указан пользователь для SSH подключения (sshConnectUser)');
  }

  let sshCommand = `ssh -p ${sshPort} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ${user}@${host} "${escapedCommand}"`;

  if (privateKeyExists) {
    sshCommand = `ssh -i "${privateKeyPath}" -p ${sshPort} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ${user}@${host} "${escapedCommand}"`;
  }

  log.info(`🔍 Выполняем SSH команду: ${sshCommand}`);

  return new Promise((resolve) => {
    exec(sshCommand, (error, stdout, stderr) => {
      log.info(`📤 SSH результат - код: ${error ? error.code : 0}, stdout: "${stdout}", stderr: "${stderr}"`);

      if (error && error.code === 255 && sshConnectPassword) {
        log.info('SSH ключи не сработали, пробуем с паролем...');
        const passwordCommand = `sshpass -p "${String(sshConnectPassword || '').trim()}" ssh -p ${sshPort} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ${user}@${host} "${escapedCommand}"`;

        exec(passwordCommand, (passwordError, passwordStdout, passwordStderr) => {
          log.info(`📤 SSH с паролем результат - код: ${passwordError ? passwordError.code : 0}, stdout: "${passwordStdout}", stderr: "${passwordStderr}"`);
          resolve({
            code: passwordError ? passwordError.code : 0,
            stdout: passwordStdout || '',
            stderr: passwordStderr || ''
          });
        });
      } else {
        resolve({
          code: error ? error.code : 0,
          stdout: stdout || '',
          stderr: stderr || ''
        });
      }
    });
  });
};

const execScpCommand = async (sourcePath, targetPath, options = {}) => {
  const {
    sshHost,
    sshPort = 22,
    sshConnectUser,
    sshConnectPassword,
    vdsIp
  } = options;

  await ensureSshPermissions();

  const privateKeyExists = await fs.pathExists(privateKeyPath);

  // Удаляем пробелы и проверяем, что значения не пустые
  const user = String(sshConnectUser || 'root').trim();
  const host = String((sshHost || vdsIp || '')).trim();
  
  if (!host) {
    throw new Error('Не указан хост для SCP подключения (sshHost или vdsIp)');
  }
  
  if (!user) {
    throw new Error('Не указан пользователь для SCP подключения (sshConnectUser)');
  }

  let scpCommand = `scp -P ${sshPort} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ${sourcePath} ${user}@${host}:${targetPath}`;

  if (privateKeyExists) {
    scpCommand = `scp -i "${privateKeyPath}" -P ${sshPort} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ${sourcePath} ${user}@${host}:${targetPath}`;
  }

  return new Promise((resolve) => {
    exec(scpCommand, (error, stdout, stderr) => {
      if (error && error.code === 255 && sshConnectPassword) {
        log.info('SCP с ключами не сработал, пробуем с паролем...');
        const passwordScpCommand = `sshpass -p "${String(sshConnectPassword || '').trim()}" scp -P ${sshPort} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ${sourcePath} ${user}@${host}:${targetPath}`;

        exec(passwordScpCommand, (passwordError, passwordStdout, passwordStderr) => {
          if (passwordError) {
            log.error('❌ Ошибка SCP: ' + passwordError.message);
          } else {
            log.success('✅ SCP успешно выполнен');
          }
          resolve({
            code: passwordError ? passwordError.code : 0,
            stdout: passwordStdout || '',
            stderr: passwordStderr || ''
          });
        });
      } else {
        if (error) {
          log.error('❌ Ошибка SCP: ' + error.message);
        } else {
          log.success('✅ SCP успешно выполнен');
        }
        resolve({
          code: error ? error.code : 0,
          stdout: stdout || '',
          stderr: stderr || ''
        });
      }
    });
  });
};

module.exports = {
  execSshCommand,
  execScpCommand,
  fixSshPermissions: ensureSshPermissions
};
