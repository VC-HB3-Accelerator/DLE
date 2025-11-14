/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS } = require('../shared/permissions');
const db = require('../db');
const encryptedDb = require('../services/encryptedDatabaseService');

const execAsync = promisify(exec);

/**
 * Получить настройки VDS
 */
router.get('/settings', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const encryptionUtils = require('../utils/encryptionUtils');
    const encryptionKey = encryptionUtils.getEncryptionKey();
    
    const { rows } = await db.getQuery()(
      `SELECT 
        id, 
        decrypt_text(domain_encrypted, $1) as domain,
        decrypt_text(email_encrypted, $1) as email,
        decrypt_text(ubuntu_user_encrypted, $1) as ubuntu_user,
        decrypt_text(docker_user_encrypted, $1) as docker_user,
        decrypt_text(ssh_host_encrypted, $1) as ssh_host,
        ssh_port,
        decrypt_text(ssh_user_encrypted, $1) as ssh_user,
        decrypt_text(ssh_password_encrypted, $1) as ssh_password,
        created_at, 
        updated_at 
      FROM vds_settings 
      ORDER BY id DESC 
      LIMIT 1`,
      [encryptionKey]
    );
    
    if (rows.length === 0) {
      return res.json({ success: true, settings: null });
    }
    
    res.json({ 
      success: true, 
      settings: {
        domain: rows[0].domain,
        email: rows[0].email,
        ubuntuUser: rows[0].ubuntu_user,
        dockerUser: rows[0].docker_user,
        sshHost: rows[0].ssh_host,
        sshPort: rows[0].ssh_port,
        sshUser: rows[0].ssh_user
        // sshPassword не возвращаем по соображениям безопасности
      }
    });
  } catch (error) {
    logger.error('[VDS] Ошибка получения настроек:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Сохранить настройки VDS
 */
router.post('/settings', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { 
      domain, 
      email, 
      ubuntuUser, 
      dockerUser, 
      sshHost, 
      sshPort, 
      sshUser, 
      sshPassword 
    } = req.body;
    
    // Если передан только домен (для обратной совместимости)
    if (domain && !email && !sshHost) {
      const normalizedDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
      const existing = await encryptedDb.getData('vds_settings', {}, 1);
      
      const settings = {
        domain_encrypted: normalizedDomain, // encryptedDb автоматически зашифрует
        updated_at: new Date()
      };
      
      if (existing.length > 0) {
        await encryptedDb.saveData('vds_settings', settings, { id: existing[0].id });
      } else {
        await encryptedDb.saveData('vds_settings', {
          ...settings,
          created_at: new Date()
        });
      }
      
      process.env.BASE_URL = `https://${normalizedDomain}`;
      
      // Сбрасываем кэш домена в consentService
      const consentService = require('../services/consentService');
      consentService.clearDomainCache();
      
      logger.info(`[VDS] Домен сохранен: ${normalizedDomain}`);
      return res.json({ success: true, domain: normalizedDomain });
    }
    
    // Валидация обязательных полей (пароль опционален при обновлении)
    if (!domain || !email || !ubuntuUser || !dockerUser || !sshHost || !sshPort || !sshUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'Все поля обязательны для заполнения (кроме пароля при обновлении)' 
      });
    }
    
    // Нормализуем домен
    const normalizedDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // Проверяем существующие настройки
    const existing = await encryptedDb.getData('vds_settings', {}, 1);
    
    const encryptionUtils = require('../utils/encryptionUtils');
    const encryptionKey = encryptionUtils.getEncryptionKey();
    
    // Подготавливаем данные для сохранения с правильными именами полей для шифрования
    const settings = {
      domain_encrypted: normalizedDomain, // encryptedDb автоматически зашифрует поля с _encrypted
      email_encrypted: email.trim(),
      ubuntu_user_encrypted: ubuntuUser.trim(),
      docker_user_encrypted: dockerUser.trim(),
      ssh_host_encrypted: sshHost.trim(),
      ssh_port: parseInt(sshPort, 10),
      ssh_user_encrypted: sshUser.trim(),
      updated_at: new Date()
    };
    
    // Пароль добавляем только если он указан (при обновлении можно не менять)
    if (sshPassword !== undefined && sshPassword !== null && sshPassword.trim() !== '') {
      settings.ssh_password_encrypted = sshPassword;
    } else if (existing.length === 0) {
      // При создании пароль обязателен
      return res.status(400).json({ 
        success: false, 
        error: 'SSH пароль обязателен при первой настройке' 
      });
    }
    // Если пароль не указан (undefined/null/пустая строка) и настройки уже есть - не обновляем пароль
    
    if (existing.length > 0) {
      await encryptedDb.saveData('vds_settings', settings, { id: existing[0].id });
    } else {
      await encryptedDb.saveData('vds_settings', {
        ...settings,
        created_at: new Date()
      });
    }
    
    // Обновляем process.env.BASE_URL для текущего процесса
    process.env.BASE_URL = `https://${normalizedDomain}`;
    
    // Сбрасываем кэш домена в consentService
    const consentService = require('../services/consentService');
    consentService.clearDomainCache();
    
    logger.info(`[VDS] Настройки сохранены: ${normalizedDomain}`);
    res.json({ success: true, settings });
  } catch (error) {
    logger.error('[VDS] Ошибка сохранения настроек:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Проверка доступности Docker
 */
async function checkDockerAvailable() {
  try {
    await execAsync('docker --version');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Получить список контейнеров
 */
router.get('/containers', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const dockerAvailable = await checkDockerAvailable();
    if (!dockerAvailable) {
      return res.json({ success: true, containers: [], message: 'Docker недоступен (работает локально, не на VDS)' });
    }
    
    const { stdout } = await execAsync('docker ps -a --format "{{.Names}}|{{.Status}}|{{.Image}}"');
    const containers = stdout.trim().split('\n').filter(line => line.trim()).map(line => {
      const [name, status, image] = line.split('|');
      return { name, status, image };
    });
    
    res.json({ success: true, containers });
  } catch (error) {
    logger.error('[VDS] Ошибка получения списка контейнеров:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Перезапустить контейнер
 */
router.post('/containers/:name/restart', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { name } = req.params;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Имя контейнера обязательно' });
    }
    
    await execAsync(`docker restart ${name}`);
    logger.info(`[VDS] Контейнер ${name} перезапущен`);
    res.json({ success: true, message: `Контейнер ${name} перезапущен` });
  } catch (error) {
    logger.error(`[VDS] Ошибка перезапуска контейнера ${req.params.name}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Перезапустить все контейнеры
 */
router.post('/containers/restart-all', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { stdout } = await execAsync('docker ps -q');
    const containerIds = stdout.trim().split('\n').filter(id => id.trim());
    
    if (containerIds.length === 0) {
      return res.json({ success: true, message: 'Нет запущенных контейнеров', restarted: 0 });
    }
    
    await execAsync(`docker restart ${containerIds.join(' ')}`);
    logger.info(`[VDS] Перезапущено контейнеров: ${containerIds.length}`);
    res.json({ success: true, message: `Перезапущено контейнеров: ${containerIds.length}`, restarted: containerIds.length });
  } catch (error) {
    logger.error('[VDS] Ошибка перезапуска всех контейнеров:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Пересобрать контейнер
 */
router.post('/containers/:name/rebuild', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { name } = req.params;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Имя контейнера обязательно' });
    }
    
    // Получаем информацию о контейнере
    const { stdout: inspectOutput } = await execAsync(`docker inspect ${name} --format '{{.Config.Image}}'`);
    const imageName = inspectOutput.trim();
    
    if (!imageName) {
      return res.status(404).json({ success: false, error: 'Контейнер не найден' });
    }
    
    // Останавливаем контейнер
    await execAsync(`docker stop ${name}`).catch(() => {});
    
    // Удаляем контейнер
    await execAsync(`docker rm ${name}`).catch(() => {});
    
    // Пересобираем образ (если есть Dockerfile)
    // Для простоты просто пересоздаем контейнер из образа
    await execAsync(`docker run -d --name ${name} ${imageName}`).catch(() => {
      throw new Error('Не удалось пересоздать контейнер. Возможно, нужны дополнительные параметры запуска.');
    });
    
    logger.info(`[VDS] Контейнер ${name} пересобран`);
    res.json({ success: true, message: `Контейнер ${name} пересобран` });
  } catch (error) {
    logger.error(`[VDS] Ошибка пересборки контейнера ${req.params.name}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Получить статистику системы (CPU, RAM, трафик)
 */
router.get('/stats', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { period = '1h' } = req.query; // 1h, 6h, 24h, 7d
    
    // Получаем текущую статистику CPU и RAM
    let cpuUsage = 0;
    let ramUsage = 0;
    let totalTraffic = 0;
    let rxBytes = 0;
    let txBytes = 0;
    
    try {
      const { stdout: cpuRam } = await execAsync('top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk \'{print 100 - $1}\'');
      cpuUsage = parseFloat(cpuRam.trim()) || 0;
    } catch (error) {
      logger.warn('[VDS] Не удалось получить статистику CPU:', error.message);
    }
    
    try {
      const { stdout: memInfo } = await execAsync('free -m | awk \'NR==2{printf "%.2f", $3*100/$2}\'');
      ramUsage = parseFloat(memInfo.trim()) || 0;
    } catch (error) {
      logger.warn('[VDS] Не удалось получить статистику RAM:', error.message);
    }
    
    try {
      // Используем /host/proc если доступно, иначе /proc
      const procPath = require('fs').existsSync('/host/proc') ? '/host/proc' : '/proc';
      const { stdout: networkStats } = await execAsync(`cat ${procPath}/net/dev | awk 'NR>2 {rx+=$2; tx+=$10} END {print rx, tx}'`);
      [rxBytes, txBytes] = networkStats.trim().split(' ').map(Number);
      totalTraffic = (rxBytes + txBytes) / 1024 / 1024; // MB
    } catch (error) {
      logger.warn('[VDS] Не удалось получить статистику трафика:', error.message);
    }
    
    // Получаем статистику по контейнерам (если Docker доступен)
    let containers = [];
    const dockerAvailable = await checkDockerAvailable();
    if (dockerAvailable) {
      try {
        const { stdout: containerStats } = await execAsync('docker stats --no-stream --format "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}"');
        containers = containerStats.trim().split('\n').filter(line => line.trim()).map(line => {
          const [name, cpu, mem, net] = line.split('|');
          return { name, cpu, mem, net };
        });
      } catch (error) {
        logger.warn('[VDS] Не удалось получить статистику контейнеров:', error.message);
        // Продолжаем без статистики контейнеров
      }
    }
    
    res.json({
      success: true,
      stats: {
        cpu: {
          usage: cpuUsage,
          cores: require('os').cpus().length
        },
        ram: {
          usage: ramUsage,
          total: Math.round(require('os').totalmem() / 1024 / 1024), // MB
          used: Math.round(require('os').totalmem() / 1024 / 1024 * ramUsage / 100) // MB
        },
        traffic: {
          total: totalTraffic, // MB
          rx: rxBytes / 1024 / 1024, // MB
          tx: txBytes / 1024 / 1024 // MB
        },
        containers
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[VDS] Ошибка получения статистики:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Остановить контейнер
 */
router.post('/containers/:name/stop', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { name } = req.params;
    await execAsync(`docker stop ${name}`);
    logger.info(`[VDS] Контейнер ${name} остановлен`);
    res.json({ success: true, message: `Контейнер ${name} остановлен` });
  } catch (error) {
    logger.error(`[VDS] Ошибка остановки контейнера ${req.params.name}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Запустить контейнер
 */
router.post('/containers/:name/start', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { name } = req.params;
    await execAsync(`docker start ${name}`);
    logger.info(`[VDS] Контейнер ${name} запущен`);
    res.json({ success: true, message: `Контейнер ${name} запущен` });
  } catch (error) {
    logger.error(`[VDS] Ошибка запуска контейнера ${req.params.name}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Удалить контейнер
 */
router.delete('/containers/:name', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { name } = req.params;
    await execAsync(`docker stop ${name}`).catch(() => {});
    await execAsync(`docker rm ${name}`);
    logger.info(`[VDS] Контейнер ${name} удален`);
    res.json({ success: true, message: `Контейнер ${name} удален` });
  } catch (error) {
    logger.error(`[VDS] Ошибка удаления контейнера ${req.params.name}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Получить логи контейнера
 */
router.get('/containers/:name/logs', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { name } = req.params;
    const { tail = 100 } = req.query;
    const { stdout } = await execAsync(`docker logs --tail ${tail} ${name}`);
    res.json({ success: true, logs: stdout });
  } catch (error) {
    logger.error(`[VDS] Ошибка получения логов контейнера ${req.params.name}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Получить статистику контейнера
 */
router.get('/containers/:name/stats', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { name } = req.params;
    const { stdout } = await execAsync(`docker stats --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}|{{.BlockIO}}" ${name}`);
    const [cpu, mem, net, block] = stdout.trim().split('|');
    res.json({ success: true, stats: { cpu, mem, net, block } });
  } catch (error) {
    logger.error(`[VDS] Ошибка получения статистики контейнера ${req.params.name}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Очистить Docker (удалить неиспользуемые образы, контейнеры, сети)
 */
router.post('/docker/cleanup', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { type = 'all' } = req.body; // all, images, containers, volumes, networks
    
    let command;
    switch (type) {
      case 'images':
        command = 'docker image prune -a -f';
        break;
      case 'containers':
        command = 'docker container prune -f';
        break;
      case 'volumes':
        command = 'docker volume prune -f';
        break;
      case 'networks':
        command = 'docker network prune -f';
        break;
      default:
        command = 'docker system prune -a -f';
    }
    
    const { stdout } = await execAsync(command);
    logger.info(`[VDS] Docker очистка выполнена: ${type}`);
    res.json({ success: true, message: `Очистка Docker (${type}) выполнена`, output: stdout });
  } catch (error) {
    logger.error('[VDS] Ошибка очистки Docker:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Перезагрузить сервер
 */
router.post('/server/reboot', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    res.json({ success: true, message: 'Сервер будет перезагружен через 5 секунд' });
    setTimeout(() => {
      execAsync('reboot').catch(err => logger.error('[VDS] Ошибка перезагрузки:', err));
    }, 5000);
  } catch (error) {
    logger.error('[VDS] Ошибка перезагрузки сервера:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Выключить сервер
 */
router.post('/server/shutdown', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    res.json({ success: true, message: 'Сервер будет выключен через 5 секунд' });
    setTimeout(() => {
      execAsync('shutdown -h now').catch(err => logger.error('[VDS] Ошибка выключения:', err));
    }, 5000);
  } catch (error) {
    logger.error('[VDS] Ошибка выключения сервера:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Обновить систему
 */
router.post('/server/update', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { stdout } = await execAsync('apt update && apt upgrade -y');
    logger.info('[VDS] Система обновлена');
    res.json({ success: true, message: 'Система обновлена', output: stdout });
  } catch (error) {
    logger.error('[VDS] Ошибка обновления системы:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Получить системные логи
 */
router.get('/server/logs', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { type = 'syslog', lines = 100 } = req.query; // syslog, journalctl, auth
    let command;
    
    switch (type) {
      case 'journalctl':
        command = `journalctl -n ${lines} --no-pager`;
        break;
      case 'auth':
        command = `tail -n ${lines} /var/log/auth.log`;
        break;
      default:
        command = `tail -n ${lines} /var/log/syslog`;
    }
    
    const { stdout } = await execAsync(command);
    res.json({ success: true, logs: stdout, type });
  } catch (error) {
    logger.error('[VDS] Ошибка получения системных логов:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Получить информацию о диске
 */
router.get('/server/disk', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { stdout: df } = await execAsync('df -h');
    const { stdout: du } = await execAsync('du -sh / 2>/dev/null || echo "N/A"');
    res.json({ success: true, disk: { df, du } });
  } catch (error) {
    logger.error('[VDS] Ошибка получения информации о диске:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Получить список процессов
 */
router.get('/server/processes', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { stdout } = await execAsync('ps aux --sort=-%cpu | head -20');
    res.json({ success: true, processes: stdout });
  } catch (error) {
    logger.error('[VDS] Ошибка получения списка процессов:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Создать пользователя
 */
router.post('/users/create', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { username, password, addToDocker = false } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Имя пользователя и пароль обязательны' });
    }
    
    let command = `useradd -m -s /bin/bash ${username}`;
    if (addToDocker) {
      command += ` && usermod -aG docker ${username}`;
    }
    
    await execAsync(command);
    await execAsync(`echo "${username}:${password}" | chpasswd`);
    
    logger.info(`[VDS] Пользователь ${username} создан`);
    res.json({ success: true, message: `Пользователь ${username} создан` });
  } catch (error) {
    logger.error('[VDS] Ошибка создания пользователя:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Удалить пользователя
 */
router.delete('/users/:username', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { username } = req.params;
    const { removeHome = false } = req.query;
    
    const command = removeHome ? `userdel -r ${username}` : `userdel ${username}`;
    await execAsync(command);
    
    logger.info(`[VDS] Пользователь ${username} удален`);
    res.json({ success: true, message: `Пользователь ${username} удален` });
  } catch (error) {
    logger.error(`[VDS] Ошибка удаления пользователя ${req.params.username}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Изменить пароль пользователя
 */
router.post('/users/:username/password', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { username } = req.params;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ success: false, error: 'Пароль обязателен' });
    }
    
    await execAsync(`echo "${username}:${password}" | chpasswd`);
    logger.info(`[VDS] Пароль пользователя ${username} изменен`);
    res.json({ success: true, message: `Пароль пользователя ${username} изменен` });
  } catch (error) {
    logger.error(`[VDS] Ошибка изменения пароля пользователя ${req.params.username}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Получить список пользователей
 */
router.get('/users', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { stdout } = await execAsync('cat /etc/passwd | awk -F: \'{print $1, $3, $7}\'');
    const users = stdout.trim().split('\n').map(line => {
      const [username, uid, shell] = line.split(' ');
      return { username, uid, shell };
    });
    res.json({ success: true, users });
  } catch (error) {
    logger.error('[VDS] Ошибка получения списка пользователей:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Получить SSH ключи пользователя
 */
router.get('/users/:username/ssh-keys', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { username } = req.params;
    const { stdout } = await execAsync(`cat /home/${username}/.ssh/authorized_keys 2>/dev/null || echo ""`);
    const keys = stdout.trim().split('\n').filter(k => k.trim()).map((key, index) => ({
      id: index + 1,
      key: key.trim()
    }));
    res.json({ success: true, keys });
  } catch (error) {
    logger.error(`[VDS] Ошибка получения SSH ключей пользователя ${req.params.username}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Добавить SSH ключ пользователю
 */
router.post('/users/:username/ssh-keys', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { username } = req.params;
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({ success: false, error: 'SSH ключ обязателен' });
    }
    
    await execAsync(`mkdir -p /home/${username}/.ssh`);
    await execAsync(`chmod 700 /home/${username}/.ssh`);
    await execAsync(`echo "${key}" >> /home/${username}/.ssh/authorized_keys`);
    await execAsync(`chmod 600 /home/${username}/.ssh/authorized_keys`);
    await execAsync(`chown -R ${username}:${username} /home/${username}/.ssh`);
    
    logger.info(`[VDS] SSH ключ добавлен пользователю ${username}`);
    res.json({ success: true, message: `SSH ключ добавлен пользователю ${username}` });
  } catch (error) {
    logger.error(`[VDS] Ошибка добавления SSH ключа пользователю ${req.params.username}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Удалить SSH ключ пользователя
 */
router.delete('/users/:username/ssh-keys/:keyId', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { username, keyId } = req.params;
    const keyIndex = parseInt(keyId, 10) - 1;
    
    const { stdout } = await execAsync(`cat /home/${username}/.ssh/authorized_keys`);
    const keys = stdout.trim().split('\n').filter(k => k.trim());
    
    if (keyIndex < 0 || keyIndex >= keys.length) {
      return res.status(400).json({ success: false, error: 'Неверный ID ключа' });
    }
    
    keys.splice(keyIndex, 1);
    await execAsync(`echo "${keys.join('\n')}" > /home/${username}/.ssh/authorized_keys`);
    await execAsync(`chmod 600 /home/${username}/.ssh/authorized_keys`);
    
    logger.info(`[VDS] SSH ключ удален у пользователя ${username}`);
    res.json({ success: true, message: `SSH ключ удален у пользователя ${username}` });
  } catch (error) {
    logger.error(`[VDS] Ошибка удаления SSH ключа пользователя ${req.params.username}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Создать бэкап базы данных
 */
router.post('/backup/create', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `/tmp/backup-${timestamp}.sql`;
    
    // Получаем настройки БД из переменных окружения или конфига
    const dbName = process.env.DB_NAME || 'dapp_db';
    const dbUser = process.env.DB_USER || 'dapp_user';
    
    await execAsync(`PGPASSWORD=${process.env.DB_PASSWORD || ''} pg_dump -U ${dbUser} -d ${dbName} > ${backupFile}`);
    
    logger.info(`[VDS] Бэкап создан: ${backupFile}`);
    res.json({ success: true, message: 'Бэкап создан', file: backupFile });
  } catch (error) {
    logger.error('[VDS] Ошибка создания бэкапа:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Отправить бэкап на локальную машину
 */
router.post('/backup/send', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { file, localHost, localUser, localPath, sshKeyPath } = req.body;
    
    if (!file || !localHost || !localUser || !localPath) {
      return res.status(400).json({ 
        success: false, 
        error: 'Файл, локальный хост, пользователь и путь обязательны' 
      });
    }
    
    let command;
    if (sshKeyPath) {
      command = `scp -i ${sshKeyPath} ${file} ${localUser}@${localHost}:${localPath}`;
    } else {
      command = `scp ${file} ${localUser}@${localHost}:${localPath}`;
    }
    
    const { stdout } = await execAsync(command);
    logger.info(`[VDS] Бэкап отправлен на ${localHost}:${localPath}`);
    res.json({ success: true, message: 'Бэкап отправлен', output: stdout });
  } catch (error) {
    logger.error('[VDS] Ошибка отправки бэкапа:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Получить историю статистики (для графиков)
 */
router.get('/stats/history', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const { period = '1h' } = req.query; // 1h, 6h, 24h, 7d
    
    // Пока возвращаем пустую историю, так как нужно настроить сбор данных
    // В будущем можно использовать временную БД или файлы для хранения истории
    res.json({
      success: true,
      history: {
        cpu: [],
        ram: [],
        traffic: []
      },
      period
    });
  } catch (error) {
    logger.error('[VDS] Ошибка получения истории статистики:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

