const { exec } = require('child_process');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const log = require('./logger');

const sshDir = path.join(os.homedir(), '.ssh');
const privateKeyPath = path.join(sshDir, 'id_rsa');
const publicKeyPath = `${privateKeyPath}.pub`;
const sshConfigPath = path.join(sshDir, 'config');

/**
 * Выполнение команд локально (на хосте)
 */
const execLocalCommand = async (command) => {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      resolve({
        code: error ? error.code : 0,
        stdout: stdout || '',
        stderr: stderr || ''
      });
    });
  });
};

/**
 * Создание SSH ключей локально на хосте
 */
const createSshKeys = async (email) => {
  log.info('Создание SSH ключей на хосте...');

  await fs.ensureDir(sshDir);
  await execLocalCommand(`chmod 700 "${sshDir}" && chmod 600 "${sshConfigPath}" 2>/dev/null || true`);

  const privateExists = await fs.pathExists(privateKeyPath);
  const publicExists = await fs.pathExists(publicKeyPath);

  if (privateExists && publicExists) {
    log.info('SSH ключи уже существуют – используем текущую пару');
    await execLocalCommand(`chmod 600 "${privateKeyPath}" && chmod 644 "${publicKeyPath}"`);
    return;
  }

  await new Promise((resolve) => {
    exec(`ssh-keygen -q -t rsa -b 4096 -C "${email}" -f "${privateKeyPath}" -N ""`, (error) => {
      if (error) {
        log.error('Ошибка создания SSH ключей: ' + error.message);
        return resolve();
      }

      log.success('SSH ключи успешно созданы на хосте');

      exec(`chmod 600 "${privateKeyPath}" && chmod 644 "${publicKeyPath}"`, (permError) => {
        if (permError) {
          log.warn('Не удалось установить права доступа к SSH ключам: ' + permError.message);
        } else {
          log.success('Права доступа к SSH ключам установлены');
        }
        resolve();
      });
    });
  });
};

module.exports = {
  execLocalCommand,
  createSshKeys
};
