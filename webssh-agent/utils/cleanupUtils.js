const { execSshCommand } = require('./sshUtils');
const log = require('./logger');

/**
 * Очистка VDS сервера
 */
const cleanupVdsServer = async (options) => {
  log.info('Очистка VDS сервера...');
  
  // Остановка и удаление существующих Docker контейнеров
  log.info('Остановка существующих Docker контейнеров...');
  await execSshCommand('sudo docker stop $(sudo docker ps -aq) 2>/dev/null || true', options);
  await execSshCommand('sudo docker rm $(sudo docker ps -aq) 2>/dev/null || true', options);
  
  // Удаление Docker образов и очистка системы
  log.info('Очистка Docker образов и системы...');
  await execSshCommand('sudo docker system prune -af || true', options);
  await execSshCommand('sudo docker volume prune -f || true', options);
  await execSshCommand('sudo docker network prune -f || true', options);
  
  // 🆕 Умная проверка и удаление системного nginx для избежания конфликтов портов
  log.info('🔍 Проверка наличия системного nginx...');
  const nginxCheck = await execSshCommand('systemctl list-units --type=service --state=active,inactive | grep nginx || echo "nginx not found"', options);
  
  if (nginxCheck.stdout.includes('nginx.service')) {
    log.info('⚠️ Обнаружен системный nginx - удаляем для освобождения портов 80/443...');
    
    // Полная остановка и удаление системного nginx
    await execSshCommand('sudo systemctl stop nginx || true', options);
    await execSshCommand('sudo systemctl disable nginx || true', options);
    await execSshCommand('sudo systemctl mask nginx || true', options);
    await execSshCommand('sudo pkill -f nginx || true', options);
    await execSshCommand('sudo apt-get purge -y nginx nginx-common nginx-full || true', options);
    await execSshCommand('sudo apt-get autoremove -y || true', options);
    
    log.success('✅ Системный nginx полностью удален, порты 80/443 освобождены для Docker nginx');
  } else {
    log.info('ℹ️ Системный nginx не обнаружен - порты 80/443 свободны для Docker nginx');
  }
  
  // Остановка других конфликтующих сервисов
  log.info('Остановка других конфликтующих сервисов...');
  await execSshCommand('sudo systemctl stop apache2 2>/dev/null || true', options);
  await execSshCommand('sudo systemctl disable apache2 2>/dev/null || true', options);
  await execSshCommand('sudo systemctl mask apache2 2>/dev/null || true', options);
  
  // Очистка старых пакетов
  log.info('Очистка старых пакетов...');
  await execSshCommand('sudo apt-get autoremove -y || true', options);
  await execSshCommand('sudo apt-get autoclean || true', options);
  
  // Очистка временных файлов
  log.info('Очистка временных файлов...');
  await execSshCommand('sudo rm -rf /tmp/* /var/tmp/* 2>/dev/null || true', options);
  
  log.success('VDS сервер очищен');
};

/**
 * Настройка SSH ключей для root
 */
const setupRootSshKeys = async (publicKey, options) => {
  log.info('Настройка SSH ключей...');
  
  // Создание директории .ssh для root
  await execSshCommand('sudo mkdir -p /root/.ssh', options);
  await execSshCommand('sudo chmod 700 /root/.ssh', options);
  
  // Добавление публичного ключа в authorized_keys
  await execSshCommand(`echo "${publicKey}" | sudo tee -a /root/.ssh/authorized_keys`, options);
  await execSshCommand('sudo chmod 600 /root/.ssh/authorized_keys', options);
  await execSshCommand('sudo chown root:root /root/.ssh/authorized_keys', options);
  
  log.success('SSH ключи созданы и публичный ключ добавлен в authorized_keys');
};

/**
 * Отключение парольной аутентификации
 */
const disablePasswordAuth = async (options) => {
  log.info('Отключение парольной аутентификации...');
  await execSshCommand('sudo sed -i "s/#PasswordAuthentication yes/PasswordAuthentication no/" /etc/ssh/sshd_config', options);
  await execSshCommand('sudo sed -i "s/PasswordAuthentication yes/PasswordAuthentication no/" /etc/ssh/sshd_config', options);
  await execSshCommand('sudo systemctl restart ssh', options);
  log.success('Парольная аутентификация отключена, доступ только через SSH ключи');
};

/**
 * Настройка firewall
 */
const setupFirewall = async (options) => {
  log.info('Настройка firewall...');
  await execSshCommand('sudo ufw --force enable', options);
  await execSshCommand('sudo ufw allow ssh', options);
  await execSshCommand('sudo ufw allow 80', options);
  await execSshCommand('sudo ufw allow 443', options);
  log.success('Firewall настроен');
};

module.exports = {
  cleanupVdsServer,
  setupRootSshKeys,
  disablePasswordAuth,
  setupFirewall
};
