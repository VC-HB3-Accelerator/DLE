const { exec } = require('child_process');
const log = require('./logger');

/**
 * Исправление прав доступа к SSH конфигурации
 */
const fixSshPermissions = async () => {
  return new Promise((resolve) => {
    // Исправляем владельца и права доступа к SSH конфигу
    exec('chown root:root /root/.ssh/config 2>/dev/null || true && chmod 600 /root/.ssh/config 2>/dev/null || true', (error) => {
      if (error) {
        log.warn('Не удалось исправить права доступа к SSH конфигу: ' + error.message);
      } else {
        log.info('Права доступа к SSH конфигу исправлены');
      }
      resolve();
    });
  });
};

/**
 * Выполнение SSH команд с поддержкой ключей и пароля
 */
const execSshCommand = async (command, options = {}) => {
  const {
    sshHost,
    sshPort = 22,
    sshConnectUser,
    sshConnectPassword,
    vdsIp
  } = options;
  
  // Исправляем права доступа к SSH конфигу перед выполнением команды
  await fixSshPermissions();
  
  // Сначала пробуем подключиться с SSH ключами (без BatchMode для возможности fallback на пароль)
  let sshCommand = `ssh -p ${sshPort} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${sshConnectUser}@${sshHost || vdsIp} "${command.replace(/"/g, '\\"')}"`;
  
  log.info(`🔍 Выполняем SSH команду: ${sshCommand}`);
  
  return new Promise((resolve) => {
    exec(sshCommand, (error, stdout, stderr) => {
      log.info(`📤 SSH результат - код: ${error ? error.code : 0}, stdout: "${stdout}", stderr: "${stderr}"`);
      
      if (error && error.code === 255 && sshConnectPassword) {
        // Если подключение с ключами не удалось, пробуем с паролем
        log.info('SSH ключи не сработали, пробуем с паролем...');
        const passwordCommand = `sshpass -p "${sshConnectPassword}" ssh -p ${sshPort} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${sshConnectUser}@${sshHost || vdsIp} "${command.replace(/"/g, '\\"')}"`;
        
        log.info(`🔍 Выполняем SSH команду с паролем: ${passwordCommand}`);
        
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

/**
 * Выполнение SCP команд с поддержкой ключей и пароля
 */
const execScpCommand = async (sourcePath, targetPath, options = {}) => {
  const {
    sshHost,
    sshPort = 22,
    sshConnectUser,
    sshConnectPassword,
    vdsIp
  } = options;
  
  // Исправляем права доступа к SSH конфигу перед выполнением команды
  await fixSshPermissions();
  
  const scpCommand = `scp -P ${sshPort} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${sourcePath} ${sshConnectUser}@${sshHost || vdsIp}:${targetPath}`;
  
  return new Promise((resolve) => {
    exec(scpCommand, (error, stdout, stderr) => {
      if (error && error.code === 255 && sshConnectPassword) {
        // Если SCP с ключами не удался, пробуем с паролем
        log.info('SCP с ключами не сработал, пробуем с паролем...');
        const passwordScpCommand = `sshpass -p "${sshConnectPassword}" scp -P ${sshPort} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${sourcePath} ${sshConnectUser}@${sshHost || vdsIp}:${targetPath}`;
        
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
  fixSshPermissions
};
