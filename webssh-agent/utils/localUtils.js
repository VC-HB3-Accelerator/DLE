const { exec } = require('child_process');
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
  
  return new Promise((resolve) => {
    // Сначала исправляем права доступа к SSH конфигу
    exec(`mkdir -p "${sshDir}" && chmod 700 "${sshDir}" && chmod 600 "${sshConfigPath}" 2>/dev/null || true`, (configError) => {
      if (configError) {
        log.warn('Не удалось исправить права доступа к SSH конфигу: ' + configError.message);
      }
      
      // Создаем SSH ключи
      exec(`ssh-keygen -t rsa -b 4096 -C "${email}" -f "${privateKeyPath}" -N ""`, (error, stdout, stderr) => {
        if (error) {
          log.error('Ошибка создания SSH ключей: ' + error.message);
        } else {
          log.success('SSH ключи успешно созданы на хосте');
          
          // Устанавливаем правильные права доступа к созданным ключам
          exec(`chmod 600 "${privateKeyPath}" && chmod 644 "${publicKeyPath}"`, (permError) => {
            if (permError) {
              log.warn('Не удалось установить права доступа к SSH ключам: ' + permError.message);
            } else {
              log.success('Права доступа к SSH ключам установлены');
            }
            resolve();
          });
        }
        
        if (error) {
          resolve();
        }
      });
    });
  });
};

module.exports = {
  execLocalCommand,
  createSshKeys
};
