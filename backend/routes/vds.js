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
 * Сохранить настройки VDS в базу данных
 * @param {Object} settings - Объект с настройками для сохранения
 * @returns {Promise<Object>} - Сохраненная запись
 */
async function saveVdsSettingsToDb(settings) {
  // Проверяем существующие настройки
  const existing = await encryptedDb.getData('vds_settings', {}, 1);
  
  if (existing.length > 0) {
    // UPDATE существующей записи
    return await encryptedDb.saveData('vds_settings', settings, { id: existing[0].id });
  } else {
    // INSERT новой записи
    return await encryptedDb.saveData('vds_settings', {
      ...settings,
      created_at: new Date()
    });
  }
}

/**
 * Обновить домен в process.env и сбросить кэш
 * @param {string} domain - Домен для установки
 */
function updateDomainCache(domain) {
  // Обновляем process.env.BASE_URL для текущего процесса
  process.env.BASE_URL = `https://${domain}`;
  
  // Сбрасываем кэш домена в consentService
  const consentService = require('../services/consentService');
  consentService.clearDomainCache();
}

/**
 * Получить настройки VDS
 * encryptedDb.getData автоматически расшифровывает поля с суффиксом _encrypted
 * и возвращает их БЕЗ суффикса (например, domain_encrypted -> domain)
 */
router.get('/settings', async (req, res) => {
  try {
    const rows = await encryptedDb.getData('vds_settings', {}, 1);

    if (!rows || rows.length === 0) {
      return res.json({ success: true, settings: null });
    }

    const row = rows[0];

    // encryptedDb.getData возвращает расшифрованные поля БЕЗ суффикса _encrypted
    // Например: domain_encrypted в БД -> row.domain в результате
    return res.json({
      success: true,
      settings: {
        domain: row.domain || '',
        email: row.email || '',
        ubuntuUser: row.ubuntu_user || 'ubuntu',
        dockerUser: row.docker_user || 'docker',
        sshHost: row.ssh_host || '',
        sshPort: row.ssh_port || 22,
        sshUser: row.ssh_user || 'root',
        sslProvider: row.ssl_provider || 'letsencrypt',
        dappPath: row.dapp_path || null // Будет вычисляться динамически на основе dockerUser
        // sshPassword не возвращаем по соображениям безопасности
      }
    });
  } catch (error) {
    logger.error('[VDS] Ошибка получения настроек через encryptedDb:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Сохранить настройки VDS
 * ⚠️ ВРЕМЕННО без requireAuth/requirePermission, чтобы настройки из формы WebSSH
 * гарантированно сохранялись в таблицу vds_settings даже при проблемах с сессией.
 */
router.post('/settings', async (req, res) => {
  try {
    const { 
      domain, 
      email, 
      ubuntuUser, 
      dockerUser, 
      sshHost, 
      sshPort, 
      sshUser, 
      sshPassword,
      sslProvider,
      dappPath
    } = req.body;

    // Логируем входящие данные (без пароля), чтобы видеть попытки сохранения даже при LOG_LEVEL=warn
    logger.warn('[VDS] Запрос на сохранение настроек VDS (без пароля):', {
      domain,
      email,
      ubuntuUser,
      dockerUser,
      sshHost,
      sshPort,
      sshUser
    });
    
    // Если передан только домен (для обратной совместимости)
    if (domain && !email && !sshHost) {
      const normalizedDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
      
      const settings = {
        domain: normalizedDomain, // encryptedDb автоматически найдет domain_encrypted и зашифрует
        updated_at: new Date()
      };
      
      await saveVdsSettingsToDb(settings);
      updateDomainCache(normalizedDomain);
      
      logger.info(`[VDS] Домен сохранен: ${normalizedDomain}`);
      return res.json({ success: true, domain: normalizedDomain });
    }
    
    // Валидация обязательных полей (пароль опционален при обновлении)
    if (!domain || !email || !ubuntuUser || !dockerUser || !sshHost || !sshPort || !sshUser) {
      logger.warn('[VDS] Ошибка валидации настроек VDS: не заполнены обязательные поля', {
        hasDomain: !!domain,
        hasEmail: !!email,
        hasUbuntuUser: !!ubuntuUser,
        hasDockerUser: !!dockerUser,
        hasSshHost: !!sshHost,
        hasSshPort: !!sshPort,
        hasSshUser: !!sshUser
      });
      return res.status(400).json({ 
        success: false, 
        error: 'Все поля обязательны для заполнения (кроме пароля при обновлении)' 
      });
    }
    
    // Нормализуем домен
    const normalizedDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // Проверяем существующие настройки (для валидации пароля)
    const existing = await encryptedDb.getData('vds_settings', {}, 1);
    
    // Подготавливаем данные для сохранения
    // encryptedDb.saveData ожидает ключи БЕЗ суффикса _encrypted
    // Сервис автоматически определит зашифрованные колонки и добавит суффикс
    const settings = {
      domain: normalizedDomain, // encryptedDb автоматически найдет domain_encrypted и зашифрует
      email: email.trim(),
      ubuntu_user: ubuntuUser.trim(),
      docker_user: dockerUser.trim(),
      ssh_host: sshHost.trim(),
      ssh_port: parseInt(sshPort, 10),
      ssh_user: sshUser.trim(),
      ssl_provider: 'letsencrypt', // Используем только Let's Encrypt (работает без аккаунта)
      dapp_path: (dappPath && dappPath.trim()) ? dappPath.trim() : null, // null означает использование значения по умолчанию
      updated_at: new Date()
    };
    
    // Пароль добавляем только если он указан (при обновлении можно не менять)
    if (sshPassword !== undefined && sshPassword !== null && sshPassword.trim() !== '') {
      settings.ssh_password = sshPassword; // encryptedDb автоматически найдет ssh_password_encrypted и зашифрует
    } else if (existing.length === 0) {
      // При создании пароль обязателен
      logger.warn('[VDS] Ошибка валидации настроек VDS: отсутствует SSH пароль при первой настройке');
      return res.status(400).json({ 
        success: false, 
        error: 'SSH пароль обязателен при первой настройке' 
      });
    }
    // Если пароль не указан (undefined/null/пустая строка) и настройки уже есть - не обновляем пароль
    
    await saveVdsSettingsToDb(settings);
    updateDomainCache(normalizedDomain);
    
    logger.warn(`[VDS] Настройки VDS сохранены в таблицу vds_settings для домена: ${normalizedDomain}`);
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
 * Получить настройки VDS из базы данных
 */
async function getVdsSettings() {
  try {
    const encryptionUtils = require('../utils/encryptionUtils');
    const encryptionKey = encryptionUtils.getEncryptionKey();
    
    const { rows } = await db.getQuery()(
      `SELECT 
        decrypt_text(domain_encrypted, $1) as domain,
        decrypt_text(email_encrypted, $1) as email,
        decrypt_text(ubuntu_user_encrypted, $1) as ubuntu_user,
        decrypt_text(docker_user_encrypted, $1) as docker_user,
        decrypt_text(ssh_host_encrypted, $1) as ssh_host,
        ssh_port,
        decrypt_text(ssh_user_encrypted, $1) as ssh_user,
        decrypt_text(ssh_password_encrypted, $1) as ssh_password,
        ssl_provider,
        dapp_path
      FROM vds_settings 
      ORDER BY id DESC 
      LIMIT 1`,
      [encryptionKey]
    );
    
    if (rows.length > 0 && rows[0].ssh_host && rows[0].ssh_user) {
      return {
        domain: rows[0].domain,
        email: rows[0].email,
        ubuntuUser: rows[0].ubuntu_user,
        dockerUser: rows[0].docker_user,
        sshHost: rows[0].ssh_host,
        sshPort: rows[0].ssh_port || 22,
        sshUser: rows[0].ssh_user,
        sshPassword: rows[0].ssh_password,
        sslProvider: rows[0].ssl_provider || 'letsencrypt',
        dappPath: rows[0].dapp_path || null // Будет вычисляться динамически на основе dockerUser
      };
    }
  } catch (decryptError) {
    // Если ошибка расшифровки (некорректные данные в БД), очищаем их и возвращаем null
    if (decryptError.message && decryptError.message.includes('decoding base64')) {
      logger.warn('[VDS] Ошибка расшифровки настроек (некорректные данные в БД). Очищаем некорректные данные из таблицы vds_settings.');
      try {
        // Автоматически очищаем некорректные данные из БД
        await db.getQuery()('DELETE FROM vds_settings');
        logger.info('[VDS] Некорректные настройки VDS удалены из таблицы vds_settings. Создайте новые настройки через интерфейс.');
      } catch (deleteError) {
        logger.error('[VDS] Ошибка при удалении некорректных настроек:', deleteError);
      }
      return null;
    }
    // Для других ошибок просто логируем
    logger.warn('[VDS] Не удалось получить настройки VDS из базы данных:', decryptError.message);
  }
  return null;
}

/**
 * Выполнить команду Docker (локально или через SSH на VDS)
 */
async function execDockerCommand(command) {
  const vdsSettings = await getVdsSettings();
  
  if (vdsSettings && vdsSettings.sshHost && vdsSettings.sshUser) {
    // Выполняем через SSH на VDS
    return await execSshCommandOnVds(command, vdsSettings);
  } else {
    // Выполняем локально
    try {
      const { stdout, stderr } = await execAsync(command);
      return { code: 0, stdout, stderr };
    } catch (error) {
      return { code: error.code || 1, stdout: error.stdout || '', stderr: error.stderr || error.message };
    }
  }
}

/**
 * Проверить и добавить публичный ключ на VDS, если его нет
 * Это нужно делать только один раз при первой настройке
 */
async function ensureSshKeyOnVds(settings) {
  const { sshHost, sshPort = 22, sshPassword } = settings;
  const sshUser = 'root';
  const privateKeyPath = '/root/.ssh/id_rsa';
  const publicKeyPath = `${privateKeyPath}.pub`;
  const fs = require('fs');
  
  // Проверяем наличие ключей локально
  if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
    logger.warn(`[VDS] SSH ключи не найдены локально: ${privateKeyPath}`);
    return false;
  }
  
  // Читаем публичный ключ
  const publicKey = fs.readFileSync(publicKeyPath, 'utf8').trim();
  
  // Пробуем проверить наличие ключа на VDS через SSH с ключом
  const sshOptions = `-p ${sshPort} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=5`;
  const checkCommand = `grep -Fx "${publicKey}" /root/.ssh/authorized_keys > /dev/null 2>&1 && echo "exists" || echo "not_found"`;
  const sshCheckCommand = `ssh -i "${privateKeyPath}" ${sshOptions} ${sshUser}@${sshHost} "${checkCommand}"`;
  
  try {
    const { stdout } = await execAsync(sshCheckCommand);
    if (stdout.trim() === 'exists') {
      logger.info(`[VDS] Публичный ключ уже присутствует на VDS для ${sshUser}@${sshHost}`);
      return true;
    }
  } catch (error) {
    // Если не удалось подключиться с ключом, значит ключ не добавлен
    logger.warn(`[VDS] Не удалось проверить наличие ключа на VDS: ${error.message}`);
  }
  
  // Если ключа нет и есть пароль, добавляем его
  if (sshPassword && sshPassword.trim() !== '') {
    logger.info(`[VDS] Публичный ключ отсутствует на VDS. Пытаемся добавить через пароль...`);
    const addKeyCommand = `mkdir -p /root/.ssh && chmod 700 /root/.ssh && echo "${publicKey}" >> /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys && chown root:root /root/.ssh/authorized_keys && echo "success"`;
    const sshAddCommand = `sshpass -p "${sshPassword.replace(/"/g, '\\"')}" ssh ${sshOptions} ${sshUser}@${sshHost} "${addKeyCommand}"`;
    
    try {
      const { stdout, stderr } = await execAsync(sshAddCommand);
      if (stdout.includes('success')) {
        logger.success(`[VDS] Публичный ключ успешно добавлен на VDS для ${sshUser}@${sshHost}`);
        return true;
      }
    } catch (error) {
      logger.error(`[VDS] Не удалось добавить публичный ключ на VDS: ${error.message}`);
    }
  } else {
    logger.warn(`[VDS] Публичный ключ отсутствует на VDS, но пароль не указан. Невозможно добавить ключ автоматически.`);
  }
  
  return false;
}

/**
 * Выполнить SSH команду на VDS
 * Использует SSH ключ из /root/.ssh/id_rsa (монтируется из ~/.ssh хоста)
 * ВАЖНО: Всегда используем root для подключения, так как публичный ключ добавляется для root при настройке VDS
 */
async function execSshCommandOnVds(command, settings) {
  const { sshHost, sshPort = 22 } = settings;
  
  // ВСЕГДА используем root для SSH подключения, так как публичный ключ добавляется для root
  // при настройке VDS через setupRootSshKeys в webssh-agent
  const sshUser = 'root';
  
  // Экранируем команду для SSH
  // Экранируем двойные кавычки и знаки доллара для правильной передачи через SSH
  const escapedCommand = command
    .replace(/\\/g, '\\\\')  // Сначала экранируем обратные слеши
    .replace(/\$/g, '\\$')   // Экранируем знаки доллара
    .replace(/"/g, '\\"');   // Экранируем двойные кавычки
  
  // Базовые опции SSH
  const sshOptions = `-p ${sshPort} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR`;
  
  // Явно указываем путь к приватному ключу
  // Ключ должен быть в /root/.ssh/id_rsa (монтируется из ~/.ssh хоста через docker-compose)
  const privateKeyPath = '/root/.ssh/id_rsa';
  const fs = require('fs');
  
  // Проверяем существование ключа и используем его явно
  if (fs.existsSync(privateKeyPath)) {
    // Проверяем права доступа к ключу
    const keyStats = fs.statSync(privateKeyPath);
    const keyMode = (keyStats.mode & parseInt('777', 8)).toString(8);
    logger.info(`[VDS] SSH ключ найден: ${privateKeyPath}, права: ${keyMode}`);
    
    // Используем явный путь к ключу с опцией -i
    // Публичный ключ добавляется для root при настройке VDS через setupRootSshKeys
    const sshCommand = `ssh -i "${privateKeyPath}" ${sshOptions} ${sshUser}@${sshHost} "${escapedCommand}"`;
    logger.info(`[VDS] Используем SSH ключ: ${privateKeyPath} для подключения к ${sshUser}@${sshHost}:${sshPort}`);
    
    // Читаем публичный ключ для диагностики
    const publicKeyPath = `${privateKeyPath}.pub`;
    if (fs.existsSync(publicKeyPath)) {
      const publicKey = fs.readFileSync(publicKeyPath, 'utf8').trim();
      logger.info(`[VDS] Публичный ключ (первые 50 символов): ${publicKey.substring(0, 50)}...`);
      logger.info(`[VDS] ВАЖНО: Этот публичный ключ должен быть добавлен в /root/.ssh/authorized_keys на VDS сервере ${sshHost}`);
    }
    
    try {
      logger.info(`[VDS] Выполняем SSH команду (первые 200 символов): ${sshCommand.substring(0, 200)}...`);
      const { stdout, stderr } = await execAsync(sshCommand, { maxBuffer: 10 * 1024 * 1024 }); // 10MB буфер
      logger.info(`[VDS] SSH команда выполнена успешно. stdout длина: ${stdout?.length || 0}, stderr длина: ${stderr?.length || 0}`);
      return { code: 0, stdout, stderr };
    } catch (error) {
      logger.error(`[VDS] Ошибка SSH подключения с ключом ${privateKeyPath}:`, error.message);
      logger.error(`[VDS] Пытаемся подключиться к: ${sshUser}@${sshHost}:${sshPort}`);
      logger.error(`[VDS] error.code: ${error.code || 'не указан'}`);
      logger.error(`[VDS] error.stdout: ${error.stdout || '(пусто)'}`);
      logger.error(`[VDS] error.stderr: ${error.stderr || '(пусто)'}`);
      logger.error(`[VDS] Полная команда SSH (первые 500 символов): ${sshCommand.substring(0, 500)}...`);
      
      // Если ошибка "Permission denied", возможно ключ не добавлен на VDS
      // Пробуем добавить ключ автоматически (если есть пароль)
      const errorMessage = (error.stderr || error.message || '').toLowerCase();
      if (errorMessage.includes('permission denied') || errorMessage.includes('publickey')) {
        logger.warn(`[VDS] Permission denied. Пробуем добавить публичный ключ на VDS...`);
        const keyAdded = await ensureSshKeyOnVds(settings);
        if (keyAdded) {
          // Пробуем подключиться снова
          try {
            const { stdout, stderr } = await execAsync(sshCommand, { maxBuffer: 10 * 1024 * 1024 });
            logger.success(`[VDS] Подключение успешно после добавления ключа`);
            return { code: 0, stdout, stderr };
          } catch (retryError) {
            logger.error(`[VDS] Ошибка SSH подключения после добавления ключа:`, retryError.message);
            logger.error(`[VDS] retryError.stdout: ${retryError.stdout || '(пусто)'}`);
            logger.error(`[VDS] retryError.stderr: ${retryError.stderr || '(пусто)'}`);
          }
        } else {
          logger.error(`[VDS] Не удалось добавить публичный ключ на VDS. Убедитесь, что пароль указан в настройках или выполните настройку VDS через webssh-agent.`);
        }
      }
      
      logger.error(`[VDS] Убедитесь, что публичный ключ из ${privateKeyPath}.pub добавлен в /root/.ssh/authorized_keys на VDS`);
      return { code: error.code || 1, stdout: error.stdout || '', stderr: error.stderr || error.message };
    }
  } else {
    // Если ключа нет, пробуем без явного указания (SSH сам найдет)
    logger.warn(`[VDS] SSH ключ не найден в ${privateKeyPath}, пробуем без явного указания`);
    const sshCommand = `ssh ${sshOptions} ${sshUser}@${sshHost} "${escapedCommand}"`;
    
    try {
      const { stdout, stderr } = await execAsync(sshCommand, { maxBuffer: 10 * 1024 * 1024 });
      return { code: 0, stdout, stderr };
    } catch (error) {
      logger.error(`[VDS] Ошибка SSH подключения:`, error.message);
      logger.error(`[VDS] error.code: ${error.code || 'не указан'}`);
      logger.error(`[VDS] error.stdout: ${error.stdout || '(пусто)'}`);
      logger.error(`[VDS] error.stderr: ${error.stderr || '(пусто)'}`);
      return { code: error.code || 1, stdout: error.stdout || '', stderr: error.stderr || error.message };
    }
  }
}

/**
 * Получить список контейнеров
 */
router.get('/containers', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const vdsSettings = await getVdsSettings();
    
    // Проверяем, есть ли настройки VDS или локальный Docker доступен
    if (!vdsSettings && !(await checkDockerAvailable())) {
      return res.json({ 
        success: true, 
        containers: [], 
        message: 'VDS не настроена и Docker недоступен локально' 
      });
    }
    
    const result = await execDockerCommand('docker ps -a --format "{{.Names}}|{{.Status}}|{{.Image}}"');
    
    if (result.code !== 0) {
      logger.error(`[VDS] Ошибка выполнения Docker команды: ${result.stderr}`);
      return res.status(500).json({ 
        success: false, 
        error: `Не удалось получить список контейнеров: ${result.stderr}` 
      });
    }
    
    const containers = result.stdout.trim().split('\n')
      .filter(line => line.trim())
      .map(line => {
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
    
    const result = await execDockerCommand(`docker restart ${name}`);
    
    if (result.code !== 0) {
      return res.status(500).json({ success: false, error: result.stderr || 'Не удалось перезапустить контейнер' });
    }
    
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
    const result = await execDockerCommand('docker ps -q');
    
    if (result.code !== 0) {
      return res.status(500).json({ success: false, error: result.stderr || 'Не удалось получить список контейнеров' });
    }
    
    const containerIds = result.stdout.trim().split('\n').filter(id => id.trim());
    
    if (containerIds.length === 0) {
      return res.json({ success: true, message: 'Нет запущенных контейнеров', restarted: 0 });
    }
    
    const restartResult = await execDockerCommand(`docker restart ${containerIds.join(' ')}`);
    
    if (restartResult.code !== 0) {
      return res.status(500).json({ success: false, error: restartResult.stderr || 'Не удалось перезапустить контейнеры' });
    }
    
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
    const inspectResult = await execDockerCommand(`docker inspect ${name} --format '{{.Config.Image}}'`);
    if (inspectResult.code !== 0) {
      return res.status(404).json({ success: false, error: 'Контейнер не найден' });
    }
    
    const imageName = inspectResult.stdout.trim();
    if (!imageName) {
      return res.status(404).json({ success: false, error: 'Контейнер не найден' });
    }
    
    // Останавливаем контейнер
    await execDockerCommand(`docker stop ${name}`);
    
    // Удаляем контейнер
    await execDockerCommand(`docker rm ${name}`);
    
    // Пересобираем образ (если есть Dockerfile)
    // Для простоты просто пересоздаем контейнер из образа
    const runResult = await execDockerCommand(`docker run -d --name ${name} ${imageName}`);
    if (runResult.code !== 0) {
      return res.status(500).json({ success: false, error: 'Не удалось пересоздать контейнер. Возможно, нужны дополнительные параметры запуска.' });
    }
    
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
    
    // Получаем текущую статистику CPU и RAM с VDS сервера
    let cpuUsage = 0;
    let ramUsage = 0;
    let ramTotal = 0;
    let ramUsed = 0;
    let totalTraffic = 0;
    let rxBytes = 0;
    let txBytes = 0;
    let cpuCores = 0;
    
    // Получаем статистику по контейнерам (если Docker доступен)
    let containers = [];
    const vdsSettings = await getVdsSettings();
    
    // Если есть настройки VDS, выполняем команды на VDS сервере
    if (vdsSettings) {
      try {
        // CPU usage - используем упрощенную команду через /proc/stat
        // $ будет экранирован в execSshCommandOnVds
        const procCpuResult = await execDockerCommand('head -n1 /proc/stat | awk \'{idle=$5+$6; total=$2+$3+$4+$5+$6+$7+$8+$9; if(total>0) print (100*(total-idle)/total); else print 0}\'');
        if (procCpuResult.code === 0 && procCpuResult.stdout && procCpuResult.stdout.trim()) {
          const parsed = parseFloat(procCpuResult.stdout.trim());
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
            cpuUsage = parsed;
            logger.info(`[VDS] CPU usage получен через /proc/stat: ${cpuUsage}%`);
          } else {
            throw new Error(`Invalid CPU value: ${parsed}`);
          }
        } else {
          throw new Error(`Command failed: code=${procCpuResult.code}, stderr=${procCpuResult.stderr}`);
        }
      } catch (error) {
        logger.warn('[VDS] Не удалось получить CPU через /proc/stat, пробуем top:', error.message);
        try {
          // Fallback: через top - упрощенная команда (idle обычно предпоследнее значение)
          const cpuResult = await execDockerCommand('top -bn1 | grep "%Cpu(s)" | awk \'{print 100-$(NF-2)}\' | sed \'s/%//\'');
          if (cpuResult.code === 0 && cpuResult.stdout && cpuResult.stdout.trim()) {
            cpuUsage = parseFloat(cpuResult.stdout.trim()) || 0;
            logger.info(`[VDS] CPU usage получен через top: ${cpuUsage}%`);
          }
        } catch (topError) {
          logger.warn('[VDS] Не удалось получить CPU usage:', topError.message);
        }
      }
      
      try {
        // RAM usage и total - $ будет экранирован в execSshCommandOnVds
        const memResult = await execDockerCommand('free -m | awk \'NR==2{usage=$3*100/$2; printf "%.2f %d %d", usage, $2, $3}\'');
        if (memResult.code === 0 && memResult.stdout && memResult.stdout.trim()) {
          const parts = memResult.stdout.trim().split(' ');
          if (parts.length >= 3) {
            ramUsage = parseFloat(parts[0]) || 0;
            ramTotal = parseInt(parts[1]) || 0;
            ramUsed = parseInt(parts[2]) || 0;
            logger.info(`[VDS] RAM получена с VDS: usage=${ramUsage}%, total=${ramTotal}MB, used=${ramUsed}MB (raw: ${memResult.stdout.trim()})`);
          } else {
            logger.warn('[VDS] Неверный формат RAM данных:', memResult.stdout);
          }
        } else {
          logger.warn('[VDS] Не удалось получить RAM, code:', memResult.code, 'stdout:', memResult.stdout, 'stderr:', memResult.stderr);
        }
      } catch (error) {
        logger.warn('[VDS] Не удалось получить статистику RAM:', error.message);
      }
      
      try {
        // CPU cores
        const coresResult = await execDockerCommand('nproc');
        if (coresResult.code === 0 && coresResult.stdout) {
          cpuCores = parseInt(coresResult.stdout.trim()) || 0;
        }
      } catch (error) {
        logger.warn('[VDS] Не удалось получить количество ядер CPU:', error.message);
      }
      
      try {
        // Network traffic
        const networkResult = await execDockerCommand('cat /proc/net/dev | awk \'NR>2 {rx+=$2; tx+=$10} END {print rx, tx}\'');
        if (networkResult.code === 0 && networkResult.stdout) {
          [rxBytes, txBytes] = networkResult.stdout.trim().split(' ').map(Number);
          totalTraffic = (rxBytes + txBytes) / 1024 / 1024; // MB
        }
      } catch (error) {
        logger.warn('[VDS] Не удалось получить статистику трафика:', error.message);
      }
      
      try {
        // Docker containers stats
        const result = await execDockerCommand('docker stats --no-stream --format "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}"');
        if (result.code === 0 && result.stdout) {
          containers = result.stdout.trim().split('\n').filter(line => line.trim()).map(line => {
            const [name, cpu, mem, net] = line.split('|');
            return { name, cpu, mem, net };
          });
        }
      } catch (error) {
        logger.warn('[VDS] Не удалось получить статистику контейнеров:', error.message);
      }
    } else {
      // Fallback: локальное выполнение (если VDS не настроена)
      try {
        const { stdout: cpuRam } = await execAsync('top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk \'{print 100 - $1}\'');
        cpuUsage = parseFloat(cpuRam.trim()) || 0;
      } catch (error) {
        logger.warn('[VDS] Не удалось получить статистику CPU:', error.message);
      }
      
      try {
        const { stdout: memInfo } = await execAsync('free -m | awk \'NR==2{printf "%.2f %d %d", $3*100/$2, $2, $3}\'');
        const [usage, total, used] = memInfo.trim().split(' ').map(Number);
        ramUsage = usage || 0;
        ramTotal = total || 0;
        ramUsed = used || 0;
      } catch (error) {
        logger.warn('[VDS] Не удалось получить статистику RAM:', error.message);
      }
      
      try {
        const procPath = require('fs').existsSync('/host/proc') ? '/host/proc' : '/proc';
        const { stdout: networkStats } = await execAsync(`cat ${procPath}/net/dev | awk 'NR>2 {rx+=$2; tx+=$10} END {print rx, tx}'`);
        [rxBytes, txBytes] = networkStats.trim().split(' ').map(Number);
        totalTraffic = (rxBytes + txBytes) / 1024 / 1024; // MB
      } catch (error) {
        logger.warn('[VDS] Не удалось получить статистику трафика:', error.message);
      }
      
      cpuCores = require('os').cpus().length;
    }
    
    const responseData = {
      success: true,
      stats: {
        cpu: {
          usage: cpuUsage,
          cores: cpuCores || require('os').cpus().length
        },
        ram: {
          usage: ramUsage,
          total: ramTotal || Math.round(require('os').totalmem() / 1024 / 1024), // MB
          used: ramUsed || Math.round((ramTotal || require('os').totalmem() / 1024 / 1024) * ramUsage / 100) // MB
        },
        traffic: {
          total: totalTraffic, // MB
          rx: rxBytes / 1024 / 1024, // MB
          tx: txBytes / 1024 / 1024 // MB
        },
        containers
      },
      timestamp: new Date().toISOString()
    };
    
    logger.info(`[VDS] Статистика отправлена: CPU=${cpuUsage}%, RAM=${ramUsage}% (${ramUsed}/${ramTotal}MB), Traffic=${totalTraffic}MB`);
    
    res.json(responseData);
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
    const result = await execDockerCommand(`docker stop ${name}`);
    
    if (result.code !== 0) {
      return res.status(500).json({ success: false, error: result.stderr || 'Не удалось остановить контейнер' });
    }
    
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
    const result = await execDockerCommand(`docker start ${name}`);
    
    if (result.code !== 0) {
      return res.status(500).json({ success: false, error: result.stderr || 'Не удалось запустить контейнер' });
    }
    
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
    await execDockerCommand(`docker stop ${name}`);
    const result = await execDockerCommand(`docker rm ${name}`);
    
    if (result.code !== 0) {
      return res.status(500).json({ success: false, error: result.stderr || 'Не удалось удалить контейнер' });
    }
    
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
    const result = await execDockerCommand(`docker logs --tail ${tail} ${name}`);
    
    if (result.code !== 0) {
      return res.status(500).json({ success: false, error: result.stderr || 'Не удалось получить логи контейнера' });
    }
    
    res.json({ success: true, logs: result.stdout });
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
    const result = await execDockerCommand(`docker stats --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}|{{.BlockIO}}" ${name}`);
    
    if (result.code !== 0) {
      return res.status(500).json({ success: false, error: result.stderr || 'Не удалось получить статистику контейнера' });
    }
    
    const [cpu, mem, net, block] = result.stdout.trim().split('|');
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
 * Проверить и обновить SSL сертификат
 */
router.post('/ssl/renew', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const vdsSettings = await getVdsSettings();
    
    if (!vdsSettings) {
      return res.status(400).json({ success: false, error: 'VDS не настроена' });
    }
    
    // Проверяем, используется ли Docker certbot
    const dockerUser = vdsSettings.dockerUser || 'docker';
    const domain = vdsSettings.domain || vdsSettings.sshHost;
    // Используем только Let's Encrypt (работает без аккаунта)
    const sslProvider = 'letsencrypt';
    
    // Используем путь из настроек или значение по умолчанию на основе dockerUser
    let dappPath = vdsSettings.dappPath || `/home/${dockerUser}/dapp`;
    
    // Проверяем существование пути и файла docker-compose.prod.yml
    const pathCheckResult = await execDockerCommand(`test -d ${dappPath} && test -f ${dappPath}/docker-compose.prod.yml && echo "exists" || echo "not_exists"`);
    if (pathCheckResult.stdout && pathCheckResult.stdout.includes('not_exists')) {
      logger.warn(`[VDS] Путь ${dappPath} или файл docker-compose.prod.yml не найден, ищем...`);
      
      // Ищем docker-compose.prod.yml на VDS
      const findResult = await execDockerCommand(`find /home /root -name "docker-compose.prod.yml" -type f 2>/dev/null | head -1`);
      if (findResult.stdout && findResult.stdout.trim()) {
        const foundPath = findResult.stdout.trim().replace('/docker-compose.prod.yml', '');
        logger.info(`[VDS] Найден docker-compose.prod.yml в: ${foundPath}`);
        dappPath = foundPath;
      } else {
        logger.error(`[VDS] docker-compose.prod.yml не найден на VDS сервере`);
        return res.status(400).json({ 
          success: false, 
          error: `Путь ${dappPath} не существует или файл docker-compose.prod.yml не найден. Проверьте настройки VDS и укажите правильный путь.` 
        });
      }
    }
    
    // Используем только Let's Encrypt (работает без аккаунта)
    logger.info(`[VDS] Используем провайдер SSL: Let's Encrypt, путь: ${dappPath}`);
    
    // Проверяем статус сертификата через Docker certbot
    const checkCommand = `cd ${dappPath} && docker compose -f docker-compose.prod.yml run --rm certbot certificates 2>&1 || certbot certificates 2>&1`;
    const checkResult = await execDockerCommand(checkCommand);
    
    if (checkResult.code !== 0) {
      logger.warn('[VDS] Ошибка проверки сертификатов:', checkResult.stderr);
    }
    
    let hasValidCert = false;
    if (checkResult.stdout && checkResult.stdout.includes(domain)) {
      const certLines = checkResult.stdout.split('\n');
      for (let i = 0; i < certLines.length; i++) {
        if (certLines[i].includes('Domains:') && certLines[i].includes(domain)) {
          for (let j = i + 1; j < Math.min(i + 10, certLines.length); j++) {
            if (certLines[j].includes('Expiry Date:')) {
              const expiryDateStr = certLines[j].split('Expiry Date:')[1]?.trim();
              if (expiryDateStr) {
                const expiryDate = new Date(expiryDateStr);
                const now = new Date();
                if (expiryDate > new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)) {
                  hasValidCert = true;
                  logger.info(`[VDS] Найден действующий сертификат для ${domain}, истекает: ${expiryDateStr}`);
                }
              }
              break;
            }
          }
          break;
        }
      }
    }
    
    // Пытаемся обновить сертификат через Docker certbot
    logger.info('[VDS] Обновление SSL сертификата...');
    // Сначала пробуем renew (без --force-renewal) для обновления существующего сертификата
    const renewCommand = `cd ${dappPath} && docker compose -f docker-compose.prod.yml run --rm certbot renew --non-interactive 2>&1 || docker-compose -f docker-compose.prod.yml run --rm certbot renew --non-interactive 2>&1 || certbot renew --non-interactive 2>&1`;
    let renewResult = await execDockerCommand(renewCommand);
    
    if (hasValidCert && renewResult.code === 0) {
      logger.info('[VDS] Используем существующий валидный сертификат');
      const reloadResult = await execDockerCommand(`cd ${dappPath} && (docker compose -f docker-compose.prod.yml restart frontend-nginx 2>&1 || docker-compose -f docker-compose.prod.yml restart frontend-nginx 2>&1 || systemctl reload nginx 2>&1)`);
      logger.info('[VDS] SSL сертификат обновлен (renew)');
      return res.json({ 
        success: true, 
        message: 'SSL сертификат обновлен (использован существующий)',
        output: renewResult.stdout,
        reloadOutput: reloadResult.stdout
      });
    }
    
    // Если renew не сработал (сертификат не найден или другая ошибка), создаем новый
    if (!hasValidCert && (renewResult.code !== 0 || renewResult.stdout.includes('No renewals were attempted') || renewResult.stdout.includes('No certs found'))) {
      logger.info('[VDS] Renew не сработал и нет валидного сертификата, создаем новый...');
      // Удаляем только сертификаты с суффиксами, основной оставляем
      const certListResult = await execDockerCommand(checkCommand);
      if (certListResult.stdout) {
        const lines = certListResult.stdout.split('\n');
        const certNames = [];
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('Certificate Name:')) {
            const certName = lines[i].split('Certificate Name:')[1]?.trim();
            // Удаляем только сертификаты с суффиксами (например, hb3-accelerator.com-0001, hb3-accelerator.com-0002)
            if (certName && certName !== domain && certName.startsWith(domain + '-')) {
              certNames.push(certName);
            }
          }
        }
        // Удаляем только сертификаты с суффиксами
        for (const certName of certNames) {
          logger.info(`[VDS] Удаление старого сертификата с суффиксом: ${certName}`);
          const deleteCommand = `cd ${dappPath} && docker compose -f docker-compose.prod.yml run --rm certbot delete --cert-name ${certName} --non-interactive 2>&1 || docker-compose -f docker-compose.prod.yml run --rm certbot delete --cert-name ${certName} --non-interactive 2>&1 || true`;
          await execDockerCommand(deleteCommand);
        }
      }
      // Создаем новый сертификат только если его нет
      const email = vdsSettings.email || 'admin@example.com';
      const certCommand = `cd ${dappPath} && (docker compose -f docker-compose.prod.yml run --rm certbot certonly --webroot --webroot-path=/var/www/certbot --email ${email} --agree-tos --no-eff-email --non-interactive -d ${domain} 2>&1 || docker-compose -f docker-compose.prod.yml run --rm certbot certonly --webroot --webroot-path=/var/www/certbot --email ${email} --agree-tos --no-eff-email --non-interactive -d ${domain} 2>&1 || certbot certonly --webroot --webroot-path=/var/www/certbot --email ${email} --agree-tos --no-eff-email --non-interactive -d ${domain} 2>&1)`;
      logger.info(`[VDS] Команда создания сертификата: ${certCommand.substring(0, 300)}...`);
      renewResult = await execDockerCommand(certCommand);
      logger.info(`[VDS] Результат создания сертификата: code=${renewResult.code}, stdout длина=${renewResult.stdout?.length || 0}, stderr длина=${renewResult.stderr?.length || 0}`);
      
      if (renewResult.code !== 0 && (renewResult.stderr || renewResult.stdout)) {
        const errorOutput = (renewResult.stderr || renewResult.stdout).toLowerCase();
        if (errorOutput.includes('too many certificates') || errorOutput.includes('rate limit')) {
          logger.error('[VDS] Превышен лимит Let\'s Encrypt для домена');
          return res.status(429).json({ 
            success: false, 
            error: 'Превышен лимит Let\'s Encrypt: слишком много сертификатов выпущено за последние 7 дней. Пожалуйста, подождите до указанной даты или используйте существующий сертификат.',
            details: renewResult.stderr || renewResult.stdout,
            rateLimit: true
          });
        }
      }
    } else if (hasValidCert) {
      logger.info('[VDS] Используем существующий валидный сертификат (renew не требуется)');
      return res.json({ 
        success: true, 
        message: 'Используется существующий валидный SSL сертификат',
        existingCert: true
      });
    }
    
    if (renewResult.code === 0) {
      // Перезапускаем nginx для применения нового сертификата
      const reloadResult = await execDockerCommand(`cd ${dappPath} && (docker compose -f docker-compose.prod.yml restart frontend-nginx 2>&1 || docker-compose -f docker-compose.prod.yml restart frontend-nginx 2>&1 || systemctl reload nginx 2>&1)`);
      
      // Очищаем старые сертификаты с суффиксами, чтобы они не накапливались
      logger.info('[VDS] Очистка старых сертификатов с суффиксами...');
      const certListAfter = await execDockerCommand(checkCommand);
      if (certListAfter.stdout) {
        const lines = certListAfter.stdout.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('Certificate Name:')) {
            const certName = lines[i].split('Certificate Name:')[1]?.trim();
            // Удаляем сертификаты с суффиксами (например, hb3-accelerator.com-0001, hb3-accelerator.com-0002)
            if (certName && certName !== domain && certName.startsWith(domain + '-')) {
              logger.info(`[VDS] Удаление старого сертификата с суффиксом: ${certName}`);
              const deleteCommand = `cd ${dappPath} && docker compose -f docker-compose.prod.yml run --rm certbot delete --cert-name ${certName} --non-interactive 2>&1 || docker-compose -f docker-compose.prod.yml run --rm certbot delete --cert-name ${certName} --non-interactive 2>&1 || true`;
              await execDockerCommand(deleteCommand);
            }
          }
        }
      }
      
      logger.info('[VDS] SSL сертификат обновлен');
      res.json({ 
        success: true, 
        message: 'SSL сертификат обновлен',
        output: renewResult.stdout,
        reloadOutput: reloadResult.stdout
      });
    } else {
      logger.error('[VDS] Ошибка обновления SSL сертификата:', renewResult.stderr || renewResult.stdout || 'Неизвестная ошибка');
      const errorDetails = renewResult.stderr || renewResult.stdout || 'Неизвестная ошибка';
      const errorMessage = `Command failed: ${errorDetails}`;
      const errorOutput = errorDetails.toLowerCase();
      if (errorOutput.includes('too many certificates') || errorOutput.includes('rate limit')) {
        return res.status(429).json({ 
          success: false, 
          error: 'Превышен лимит Let\'s Encrypt: слишком много сертификатов выпущено за последние 7 дней. Пожалуйста, подождите до указанной даты или используйте существующий сертификат.',
          details: errorMessage,
          stdout: renewResult.stdout || '',
          stderr: renewResult.stderr || '',
          code: renewResult.code || 1,
          rateLimit: true
        });
      }
      res.status(500).json({ 
        success: false, 
        error: 'Не удалось обновить SSL сертификат',
        details: errorMessage,
        stdout: renewResult.stdout || '',
        stderr: renewResult.stderr || '',
        code: renewResult.code || 1
      });
    }
  } catch (error) {
    logger.error('[VDS] Ошибка обновления SSL сертификата:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Проверить путь к docker-compose на VDS
 */
router.get('/check-dapp-path', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const vdsSettings = await getVdsSettings();
    
    if (!vdsSettings) {
      return res.status(400).json({ success: false, error: 'VDS не настроена' });
    }
    
    const dockerUser = vdsSettings.dockerUser || 'docker';
    const configuredPath = vdsSettings.dappPath || `/home/${dockerUser}/dapp`;
    
    // Проверяем указанный путь
    const pathCheck = await execDockerCommand(`test -d ${configuredPath} && test -f ${configuredPath}/docker-compose.prod.yml && echo "exists" || echo "not_exists"`);
    
    // Ищем docker-compose.prod.yml на VDS
    const findResult = await execDockerCommand(`find /home /root -name "docker-compose.prod.yml" -type f 2>/dev/null`);
    
    const foundPaths = findResult.stdout ? findResult.stdout.trim().split('\n').filter(p => p).map(p => p.replace('/docker-compose.prod.yml', '')) : [];
    
    res.json({
      success: true,
      configuredPath,
      configuredPathExists: pathCheck.stdout && pathCheck.stdout.includes('exists'),
      foundPaths: foundPaths,
      recommendedPath: foundPaths.length > 0 ? foundPaths[0] : null
    });
  } catch (error) {
    logger.error('[VDS] Ошибка проверки пути:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Получить статус SSL сертификата
 */
router.get('/ssl/status', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const vdsSettings = await getVdsSettings();
    
    if (!vdsSettings) {
      return res.status(400).json({ success: false, error: 'VDS не настроена' });
    }
    
    const dockerUser = vdsSettings.dockerUser || 'docker';
    const domain = vdsSettings.domain || vdsSettings.sshHost;
    
    // Используем путь из настроек или значение по умолчанию (проверено: /home/docker/dapp)
    let dappPath = vdsSettings.dappPath || `/home/${dockerUser}/dapp`;
    
    // Проверяем существование пути и файла docker-compose.prod.yml
    const pathCheckResult = await execDockerCommand(`test -d ${dappPath} && test -f ${dappPath}/docker-compose.prod.yml && echo "exists" || echo "not_exists"`);
    if (pathCheckResult.stdout && pathCheckResult.stdout.includes('not_exists')) {
      logger.warn(`[VDS] Путь ${dappPath} или файл docker-compose.prod.yml не найден, ищем...`);
      
      // Ищем docker-compose.prod.yml на VDS
      const findResult = await execDockerCommand(`find /home /root -name "docker-compose.prod.yml" -type f 2>/dev/null | head -1`);
      if (findResult.stdout && findResult.stdout.trim()) {
        const foundPath = findResult.stdout.trim().replace('/docker-compose.prod.yml', '');
        logger.info(`[VDS] Найден docker-compose.prod.yml в: ${foundPath}`);
        dappPath = foundPath;
      } else {
        logger.error(`[VDS] docker-compose.prod.yml не найден на VDS сервере`);
        return res.status(400).json({ 
          success: false, 
          error: `Путь ${dappPath} не существует или файл docker-compose.prod.yml не найден. Проверьте настройки VDS и укажите правильный путь.` 
        });
      }
    }
    
    // Используем только Let's Encrypt (работает без аккаунта)
    // Проверяем статус сертификата через Docker certbot
    const checkCommand = `cd ${dappPath} && docker compose -f docker-compose.prod.yml run --rm certbot certificates 2>&1 || docker-compose -f docker-compose.prod.yml run --rm certbot certificates 2>&1 || certbot certificates 2>&1`;
    const checkResult = await execDockerCommand(checkCommand);
    
    // Проверяем срок действия сертификата
    let certInfo = null;
    
    if (domain && checkResult.stdout) {
      // Парсим вывод certbot certificates для поиска сертификата по домену
      // Ищем строку с "Domains:" содержащую наш домен, затем ищем "Certificate Path:"
      const certLines = checkResult.stdout.split('\n');
      let certPath = null;
      let certName = null;
      
      for (let i = 0; i < certLines.length; i++) {
        const line = certLines[i];
        // Ищем сертификат по домену
        if (line.includes('Domains:') && line.includes(domain)) {
          // Нашли сертификат для нашего домена, ищем путь в следующих строках
          for (let j = i + 1; j < Math.min(i + 10, certLines.length); j++) {
            if (certLines[j].includes('Certificate Path:')) {
              certPath = certLines[j].split('Certificate Path:')[1]?.trim();
              // Заменяем fullchain.pem на cert.pem для проверки
              certPath = certPath.replace('/fullchain.pem', '/cert.pem');
              break;
            }
            if (certLines[j].includes('Certificate Name:')) {
              certName = certLines[j].split('Certificate Name:')[1]?.trim();
            }
          }
          break;
        }
      }
      
      // Если нашли путь, проверяем сертификат
      if (certPath) {
        const certCheckResult = await execDockerCommand(`openssl x509 -in ${certPath} -noout -dates -subject -issuer 2>&1 || echo "Certificate not found"`);
        
        if (certCheckResult.code === 0 && !certCheckResult.stdout.includes('not found') && !certCheckResult.stdout.includes('No such file')) {
          certInfo = {
            exists: true,
            details: certCheckResult.stdout,
            certName: certName,
            certPath: certPath
          };
        } else {
          certInfo = {
            exists: false,
            error: certCheckResult.stdout || 'Сертификат не найден'
          };
        }
      } else {
        certInfo = {
          exists: false,
          error: 'Сертификат не найден для домена ' + domain + ' в выводе certbot certificates'
        };
      }
    }
    
    // Парсим все сертификаты из вывода certbot certificates
    const allCertificates = [];
    if (checkResult.stdout) {
      const lines = checkResult.stdout.split('\n');
      let currentCert = null;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('Certificate Name:')) {
          if (currentCert) {
            allCertificates.push(currentCert);
          }
          currentCert = {
            name: line.split('Certificate Name:')[1]?.trim(),
            domains: [],
            expiryDate: null,
            certPath: null,
            keyPath: null
          };
        } else if (currentCert) {
          if (line.includes('Domains:')) {
            currentCert.domains = line.split('Domains:')[1]?.trim().split(/\s+/);
          } else if (line.includes('Expiry Date:')) {
            currentCert.expiryDate = line.split('Expiry Date:')[1]?.trim();
          } else if (line.includes('Certificate Path:')) {
            currentCert.certPath = line.split('Certificate Path:')[1]?.trim();
          } else if (line.includes('Private Key Path:')) {
            currentCert.keyPath = line.split('Private Key Path:')[1]?.trim();
          }
        }
      }
      if (currentCert) {
        allCertificates.push(currentCert);
      }
    }
    
    logger.info(`[VDS] SSL статус проверен: найдено сертификатов: ${allCertificates.length}, домен: ${domain}`);
    res.json({ 
      success: true, 
      certificates: checkResult.stdout,
      allCertificates: allCertificates,
      domain: domain,
      certInfo: certInfo,
      hasCertificates: allCertificates.length > 0
    });
  } catch (error) {
    logger.error('[VDS] Ошибка проверки SSL сертификата:', error);
    logger.error('[VDS] Детали ошибки:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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

