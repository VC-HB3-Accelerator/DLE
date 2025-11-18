const { execSshCommand } = require('./sshUtils');
const log = require('./logger');

/**
 * Очистка VDS сервера
 */
const cleanupVdsServer = async (options) => {
  log.info('Очистка VDS сервера...');
  
  // Проверяем наличие Docker перед попыткой очистки
  log.info('🔍 Проверка наличия Docker...');
  const dockerCheck = await execSshCommand('command -v docker >/dev/null 2>&1 && echo "docker installed" || echo "docker not installed"', options);
  
  // Если ошибка SSH подключения (код 255), пропускаем очистку Docker
  if (dockerCheck.code === 255) {
    log.warn('⚠️ Ошибка SSH подключения при проверке Docker, пропускаем очистку Docker');
    log.info('Продолжаем настройку сервера...');
  } else {
    const hasDocker = dockerCheck.stdout.trim().includes('docker installed');
    
    if (hasDocker) {
      log.info('Docker обнаружен, выполняем полную очистку...');
      
      // 1. Остановка всех Docker контейнеров (включая запущенные)
      log.info('🛑 Остановка всех Docker контейнеров...');
      const stopResult = await execSshCommand('docker ps -aq | xargs -r docker stop 2>/dev/null || true', options);
      if (stopResult.code !== 0 && stopResult.code !== 255) {
        log.warn(`Предупреждение при остановке контейнеров: ${stopResult.stderr}`);
      }
      
      // 2. Удаление всех контейнеров (включая остановленные)
      log.info('🗑️ Удаление всех Docker контейнеров...');
      // Удаляем все контейнеры (запущенные и остановленные)
      const rmResult = await execSshCommand('docker container ls -aq | xargs -r docker rm -f 2>/dev/null || true', options);
      if (rmResult.code !== 0 && rmResult.code !== 255) {
        log.warn(`Предупреждение при удалении контейнеров: ${rmResult.stderr}`);
      }
      // Дополнительная проверка и удаление любых оставшихся контейнеров
      await execSshCommand('docker ps -aq 2>/dev/null | xargs -r docker rm -f 2>/dev/null || true', options);
      
      // 3. Удаление всех volumes (включая именованные)
      log.info('🗑️ Удаление всех Docker volumes...');
      // Сначала получаем список всех volumes
      const allVolumesList = await execSshCommand('docker volume ls -q 2>/dev/null || true', options);
      if (allVolumesList.stdout.trim()) {
        const volumes = allVolumesList.stdout.trim().split('\n').filter(v => v);
        log.info(`Найдено ${volumes.length} volumes для удаления`);
        for (const volume of volumes) {
          // Принудительно удаляем каждый volume
          await execSshCommand(`docker volume rm -f "${volume}" 2>/dev/null || true`, options);
        }
        log.info(`Удалено ${volumes.length} volumes`);
      }
      
      // 4. Дополнительная очистка неиспользуемых volumes (на случай если что-то осталось)
      log.info('🧹 Финальная очистка volumes...');
      const volumePruneResult = await execSshCommand('docker volume prune -f 2>/dev/null || true', options);
      if (volumePruneResult.code !== 0 && volumePruneResult.code !== 255) {
        log.warn(`Предупреждение при финальной очистке volumes: ${volumePruneResult.stderr}`);
      }
      
      // 5. Удаление всех Docker образов приложения
      log.info('🗑️ Удаление старых Docker образов приложения...');
      const imagesList = await execSshCommand('docker images -q | xargs -r docker rmi -f 2>/dev/null || true', options);
      // Удаляем все образы, связанные с приложением
      await execSshCommand('docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "digital_legal_entity|dapp-" | xargs -r docker rmi -f 2>/dev/null || true', options);
      
      // 6. Полная очистка Docker системы (все образы, кэш, сети)
      log.info('🧹 Полная очистка Docker системы...');
      const pruneResult = await execSshCommand('docker system prune -af --volumes 2>/dev/null || true', options);
      if (pruneResult.code !== 0 && pruneResult.code !== 255) {
        log.warn(`Предупреждение при очистке Docker: ${pruneResult.stderr}`);
      }
      
      // 7. Удаление всех Docker сетей
      log.info('🗑️ Удаление всех Docker сетей...');
      const networkPruneResult = await execSshCommand('docker network prune -f 2>/dev/null || true', options);
      if (networkPruneResult.code !== 0 && networkPruneResult.code !== 255) {
        log.warn(`Предупреждение при очистке сетей: ${networkPruneResult.stderr}`);
      }
      
      log.success('✅ Docker полностью очищен');
    } else {
      log.info('ℹ️ Docker не установлен, пропускаем очистку Docker');
    }
  }
  
  // Удаление старых директорий приложения
  log.info('🗑️ Удаление старых директорий приложения...');
  await execSshCommand('find /home -maxdepth 3 -type d -name "dapp" -exec rm -rf {} + 2>/dev/null || true', options);
  await execSshCommand('find /home -maxdepth 3 -type d -name "digital_legal_entity" -exec rm -rf {} + 2>/dev/null || true', options);
  
  // Удаление старых docker-compose файлов
  log.info('🗑️ Удаление старых конфигурационных файлов...');
  await execSshCommand('find /home -name "docker-compose*.yml" -type f -delete 2>/dev/null || true', options);
  await execSshCommand('find /home -name ".env" -path "*/dapp/*" -type f -delete 2>/dev/null || true', options);
  await execSshCommand('find /home -name "import-images-and-data.sh" -type f -delete 2>/dev/null || true', options);
  await execSshCommand('find /home -name "renew-ssl.sh" -type f -delete 2>/dev/null || true', options);
  
  // Очистка старых cron задач, связанных с приложением
  log.info('🗑️ Очистка старых cron задач приложения...');
  const crontabBackup = await execSshCommand('crontab -l 2>/dev/null || echo ""', options);
  if (crontabBackup.stdout.trim()) {
    const cleanedCrontab = crontabBackup.stdout
      .split('\n')
      .filter(line => !line.includes('renew-ssl.sh') && !line.includes('dapp') && !line.includes('digital_legal_entity'))
      .join('\n');
    if (cleanedCrontab.trim()) {
      await execSshCommand(`echo '${cleanedCrontab.replace(/'/g, "'\\''")}' | crontab -`, options);
    } else {
      await execSshCommand('crontab -r 2>/dev/null || true', options);
    }
  }
  
  // Очистка старых SSL сертификатов (опционально, можно оставить для повторного использования)
  log.info('🧹 Проверка старых SSL сертификатов...');
  await execSshCommand('rm -rf /var/www/certbot/.well-known 2>/dev/null || true', options);
  
  // 🆕 Умная проверка и удаление системного nginx для избежания конфликтов портов
  log.info('🔍 Проверка наличия системного nginx...');
  const nginxCheck = await execSshCommand('systemctl list-units --type=service --state=active,inactive | grep nginx || echo "nginx not found"', options);
  
  if (nginxCheck.stdout.includes('nginx.service')) {
    log.info('⚠️ Обнаружен системный nginx - удаляем для освобождения портов 80/443...');
    
    // Полная остановка и удаление системного nginx
    await execSshCommand('systemctl stop nginx || true', options);
    await execSshCommand('systemctl disable nginx || true', options);
    await execSshCommand('systemctl mask nginx || true', options);
    await execSshCommand('pkill -f nginx || true', options);
    await execSshCommand('apt-get purge -y nginx nginx-common nginx-full || true', options);
    await execSshCommand('apt-get autoremove -y || true', options);
    
    log.success('✅ Системный nginx полностью удален, порты 80/443 освобождены для Docker nginx');
  } else {
    log.info('ℹ️ Системный nginx не обнаружен - порты 80/443 свободны для Docker nginx');
  }
  
  // Остановка других конфликтующих сервисов
  log.info('Остановка других конфликтующих сервисов...');
  await execSshCommand('systemctl stop apache2 2>/dev/null || true', options);
  await execSshCommand('systemctl disable apache2 2>/dev/null || true', options);
  await execSshCommand('systemctl mask apache2 2>/dev/null || true', options);
  
  // Очистка старых пакетов
  log.info('Очистка старых пакетов...');
  await execSshCommand('apt-get autoremove -y || true', options);
  await execSshCommand('apt-get autoclean || true', options);
  
  // Очистка временных файлов
  log.info('Очистка временных файлов...');
  await execSshCommand('rm -rf /tmp/* /var/tmp/* 2>/dev/null || true', options);
  
  log.success('VDS сервер очищен');
};

/**
 * Настройка SSH ключей для root
 */
const setupRootSshKeys = async (publicKey, options) => {
  log.info('Настройка SSH ключей...');
  
  // Создание директории .ssh для root
  await execSshCommand('mkdir -p /root/.ssh', options);
  await execSshCommand('chmod 700 /root/.ssh', options);
  
  // Добавление публичного ключа в authorized_keys
  await execSshCommand(`echo "${publicKey}" >> /root/.ssh/authorized_keys`, options);
  await execSshCommand('chmod 600 /root/.ssh/authorized_keys', options);
  await execSshCommand('chown root:root /root/.ssh/authorized_keys', options);
  
  log.success('SSH ключи созданы и публичный ключ добавлен в authorized_keys');
};

/**
 * Отключение парольной аутентификации
 */
const disablePasswordAuth = async (options) => {
  log.info('Отключение парольной аутентификации...');
  await execSshCommand('sed -i "s/#PasswordAuthentication yes/PasswordAuthentication no/" /etc/ssh/sshd_config', options);
  await execSshCommand('sed -i "s/PasswordAuthentication yes/PasswordAuthentication no/" /etc/ssh/sshd_config', options);
  await execSshCommand('systemctl restart ssh', options);
  log.success('Парольная аутентификация отключена, доступ только через SSH ключи');
};

/**
 * Настройка firewall
 */
const setupFirewall = async (options) => {
  log.info('Настройка firewall...');
  await execSshCommand('ufw --force enable', options);
  await execSshCommand('ufw allow ssh', options);
  await execSshCommand('ufw allow 80', options);
  await execSshCommand('ufw allow 443', options);
  log.success('Firewall настроен');
};

module.exports = {
  cleanupVdsServer,
  setupRootSshKeys,
  disablePasswordAuth,
  setupFirewall
};
