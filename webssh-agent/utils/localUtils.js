const { exec } = require('child_process');
const log = require('./logger');

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
    exec('chmod 600 /root/.ssh/config 2>/dev/null || true', (configError) => {
      if (configError) {
        log.warn('Не удалось исправить права доступа к SSH конфигу: ' + configError.message);
      }
      
      // Создаем SSH ключи
      exec(`ssh-keygen -t rsa -b 4096 -C "${email}" -f ~/.ssh/id_rsa -N ""`, (error, stdout, stderr) => {
        if (error) {
          log.error('Ошибка создания SSH ключей: ' + error.message);
        } else {
          log.success('SSH ключи успешно созданы на хосте');
          
          // Устанавливаем правильные права доступа к созданным ключам
          exec('chmod 600 /root/.ssh/id_rsa && chmod 644 /root/.ssh/id_rsa.pub', (permError) => {
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
