const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const http = require('http');
const WebSocket = require('ws');

// Импорт утилит
const log = require('./utils/logger');
const { execSshCommand, execScpCommand } = require('./utils/sshUtils');
const { checkSystemRequirements, SYSTEM_REQUIREMENTS } = require('./utils/systemUtils');
const { exportDockerImages, transferDockerImages, importDockerImages, pullRemoteImages, cleanupLocalFiles } = require('./utils/dockerUtils');
const { createAllUsers } = require('./utils/userUtils');
const { cleanupVdsServer, setupRootSshKeys, disablePasswordAuth, setupFirewall } = require('./utils/cleanupUtils');
const { createSshKeys } = require('./utils/localUtils');
const { transferAppOverlay } = require('./utils/transferUtils');
const crypto = require('crypto');
const PUBLIC_KEY_PATH = path.join(os.homedir(), '.ssh', 'id_rsa.pub');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// WebSocket сервер
const wss = new WebSocket.Server({ 
  server,
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:8000',
      'http://localhost:9000',
      'https://localhost:9443',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:8000'
    ],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:8000',
    'http://localhost:9000',
    'https://localhost:9443',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8000'
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Middleware для логирования запросов
const logRequest = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;
  log.info(`[${timestamp}] ${req.method} ${req.url} from ${ip}`);
  next();
};

app.use(logRequest);

// Состояние VDS
let vdsState = {
  configured: false,
  domain: null,
  vdsIp: null
};

// Функция для отправки логов через WebSocket
const sendWebSocketLog = (type, message, stage = null, percentage = null) => {
  const logData = {
    type: 'webssh_log',
    logType: type,
    message,
    timestamp: new Date().toISOString()
  };
  
  if (stage) {
    logData.stage = stage;
  }
  
  if (percentage !== null) {
    logData.percentage = percentage;
  }
  
  broadcastToWebSocket(logData);
  
  // Также отправляем как прогресс, если есть stage
  if (stage) {
    broadcastToWebSocket({
      type: 'webssh_progress',
      stage,
      message,
      percentage,
      timestamp: new Date().toISOString()
    });
  }
};

// Функция для отправки статуса через WebSocket
const sendWebSocketStatus = (connected, message = null) => {
  broadcastToWebSocket({
    type: 'webssh_status',
    connected,
    status: connected ? 'connected' : 'disconnected',
    message,
    timestamp: new Date().toISOString()
  });
};

// Функция для отправки сообщения всем подключенным WebSocket клиентам
const broadcastToWebSocket = (data) => {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

// Проверка здоровья агента
app.get('/health', (req, res) => {
  log.info('Health check requested');
  let hostProjectRoot = null;
  let hostProjectReady = false;
  try {
    const { resolveHostProjectRoot } = require('./utils/transferUtils');
    hostProjectRoot = resolveHostProjectRoot();
    hostProjectReady = true;
  } catch (error) {
    hostProjectRoot = error.message;
  }
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.1.0',
    vdsConfigured: vdsState.configured,
    vdsDomain: vdsState.domain,
    hostProjectReady,
    hostProjectRoot: hostProjectReady ? hostProjectRoot : null,
    hostProjectError: hostProjectReady ? null : hostProjectRoot,
  });
});

// Предварительная проверка системных требований VDS
app.post('/vds/check-requirements', logRequest, async (req, res) => {
  try {
    const { 
      vdsIp, 
      ubuntuUser, 
      sshUser,
      sshHost,
      sshPort = 22,
      sshConnectUser,
      sshConnectPassword
    } = req.body;
    
    // Нормализуем значения (удаляем пробелы)
    const normalizedVdsIp = String(vdsIp || '').trim();
    const normalizedSshHost = sshHost ? String(sshHost).trim() : undefined;
    const normalizedSshConnectUser = String(sshConnectUser || sshUser || 'root').trim();
    const normalizedSshConnectPassword = sshConnectPassword ? String(sshConnectPassword).trim() : undefined;
    
    if (!normalizedVdsIp || !ubuntuUser || !normalizedSshConnectUser || !normalizedSshConnectPassword) {
      return res.status(400).json({
        success: false,
        message: 'Необходимы параметры: vdsIp, ubuntuUser, sshConnectUser, sshConnectPassword'
      });
    }
    
    log.info(`Проверка системных требований VDS: ${normalizedVdsIp}`);
    
    const options = {
      vdsIp: normalizedVdsIp,
      sshHost: normalizedSshHost,
      sshPort,
      sshConnectUser: normalizedSshConnectUser,
      sshConnectPassword: normalizedSshConnectPassword
    };
    
    const result = await checkSystemRequirements(options);
    
    res.json({
      success: result.isCompatible,
      message: result.isCompatible 
        ? (result.hasWarnings ? 'VDS соответствует минимальным требованиям, но есть предупреждения' : 'VDS полностью соответствует системным требованиям')
        : 'VDS не соответствует минимальным требованиям',
      systemInfo: result.systemInfo,
      requirements: SYSTEM_REQUIREMENTS,
      warnings: result.warnings,
      errors: result.errors,
      isCompatible: result.isCompatible,
      hasWarnings: result.hasWarnings
    });
    
  } catch (error) {
    log.error('Ошибка проверки системных требований: ' + error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Передача ключа шифрования на VDS
app.post('/vds/transfer-encryption-key', logRequest, async (req, res) => {
  try {
    const { 
      vdsIp, 
      dockerUser, 
      sshUser, 
      sshHost,
      sshPort = 22,
      sshConnectUser,
      sshConnectPassword
    } = req.body;
    
    // Нормализуем значения (удаляем пробелы)
    const normalizedVdsIp = String(vdsIp || '').trim();
    const normalizedSshHost = sshHost ? String(sshHost).trim() : undefined;
    const normalizedSshConnectUser = String(sshConnectUser || sshUser || 'root').trim();
    const normalizedSshConnectPassword = sshConnectPassword ? String(sshConnectPassword).trim() : undefined;
    
    if (!normalizedVdsIp || !dockerUser || !normalizedSshConnectUser || !normalizedSshConnectPassword) {
      return res.status(400).json({
        success: false,
        message: 'Необходимы параметры: vdsIp, dockerUser, sshConnectUser, sshConnectPassword'
      });
    }
    
    log.info(`🔐 Передача ключа шифрования на VDS: ${normalizedVdsIp}`);
    
    const options = {
      vdsIp: normalizedVdsIp,
      sshHost: normalizedSshHost,
      sshPort,
      sshConnectUser: normalizedSshConnectUser,
      sshConnectPassword: normalizedSshConnectPassword
    };
    
    // 1. Убеждаемся, что директория для ключа существует на VDS
    log.info('🔍 Подготовка директории для ключа шифрования на VDS...');
    const ensureDirResult = await execSshCommand(`mkdir -p /home/${dockerUser}/dapp/ssl/keys`, options);
    if (ensureDirResult.code !== 0) {
      log.error('❌ Не удалось подготовить директорию для ключа шифрования на VDS');
      return res.status(500).json({
        success: false,
        message: 'Не удалось подготовить директорию для ключа шифрования на VDS'
      });
    }
    
    // 2. Определяем путь к ключу шифрования
    let encryptionKeyPath = process.env.ENCRYPTION_KEY_PATH;
    
    if (!encryptionKeyPath) {
      // Пробуем несколько возможных путей
      const possiblePaths = [
        path.resolve(__dirname, '..', 'ssl', 'keys', 'full_db_encryption.key'),
        path.resolve(__dirname, 'ssl', 'keys', 'full_db_encryption.key'),
        '/app/ssl/keys/full_db_encryption.key',
        path.join(process.cwd(), 'ssl', 'keys', 'full_db_encryption.key')
      ];
      
      log.info(`🔍 Поиск ключа шифрования в возможных путях...`);
      for (const possiblePath of possiblePaths) {
        if (await fs.pathExists(possiblePath)) {
          encryptionKeyPath = possiblePath;
          log.info(`✅ Ключ найден по пути: ${encryptionKeyPath}`);
          break;
        }
      }
    }
    
    if (!encryptionKeyPath) {
      log.error('❌ Путь к ключу шифрования не указан и не найден в стандартных местах');
      return res.status(500).json({
        success: false,
        message: 'Путь к ключу шифрования не указан и не найден в стандартных местах'
      });
    }
    
    // Проверяем существование файла
    const keyExists = await fs.pathExists(encryptionKeyPath);
    if (!keyExists) {
      log.error(`❌ Файл ключа шифрования не найден: ${encryptionKeyPath}`);
      return res.status(500).json({
        success: false,
        message: `Файл ключа шифрования не найден: ${encryptionKeyPath}`
      });
    }
    
    log.info(`📖 Чтение ключа шифрования из: ${encryptionKeyPath}`);
    
    try {
      const encryptionKeyContent = await fs.readFile(encryptionKeyPath, 'utf8');
      
      if (!encryptionKeyContent || encryptionKeyContent.trim().length === 0) {
        throw new Error('Ключ шифрования пуст или не может быть прочитан');
      }
      
      log.success(`✅ Ключ шифрования прочитан с локальной машины (длина: ${encryptionKeyContent.length} символов)`);
      
      // 3. Передаем ключ на VDS через SSH
      log.info('📤 Передача ключа шифрования на VDS...');
      
      // Создаем временный файл с ключом
      const tempKeyPath = `/tmp/encryption_key_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.key`;
      log.info(`📝 Создание временного файла: ${tempKeyPath}`);
      await fs.writeFile(tempKeyPath, encryptionKeyContent, { mode: 0o600 });
      
      // Передаем файл на VDS через SCP в правильную директорию
      log.info(`📤 Передача ключа на VDS через SCP...`);
      const scpResult = await execScpCommand(
        tempKeyPath,
        `/home/${dockerUser}/dapp/ssl/keys/full_db_encryption.key`,
        options
      );
      
      // Проверяем результат SCP
      if (scpResult.code !== 0) {
        throw new Error(`SCP команда завершилась с ошибкой (код: ${scpResult.code}): ${scpResult.stderr || scpResult.stdout}`);
      }
      
      log.success('✅ Файл ключа успешно передан на VDS через SCP');
      
      // Удаляем временный файл
      try {
        await fs.remove(tempKeyPath);
        log.info(`🗑️ Временный файл удален: ${tempKeyPath}`);
      } catch (removeError) {
        log.warn(`⚠️ Не удалось удалить временный файл ${tempKeyPath}: ${removeError.message}`);
      }
      
      // 4. Устанавливаем правильные права доступа к ключу на VDS
      log.info('🔒 Настройка прав доступа к ключу шифрования...');
      const chownResult = await execSshCommand(`chown ${dockerUser}:${dockerUser} /home/${dockerUser}/dapp/ssl/keys/full_db_encryption.key`, options);
      if (chownResult.code !== 0) {
        log.warn(`⚠️ Не удалось изменить владельца ключа: ${chownResult.stderr}`);
      }
      
      // 🆕 Используем права 644 вместо 600, чтобы контейнеры могли читать ключ
      // Ключ должен быть читаемым для всех процессов в контейнерах
      const chmodResult = await execSshCommand(`chmod 644 /home/${dockerUser}/dapp/ssl/keys/full_db_encryption.key`, options);
      if (chmodResult.code !== 0) {
        log.warn(`⚠️ Не удалось изменить права доступа к ключу: ${chmodResult.stderr}`);
      } else {
        log.success('✅ Права доступа к ключу установлены (644 - читаемый для всех)');
      }
      
      // 5. Проверяем, что ключ успешно передан
      log.info('🔍 Проверка передачи ключа...');
      const verifyResult = await execSshCommand(`ls -la /home/${dockerUser}/dapp/ssl/keys/full_db_encryption.key`, options);
      
      if (verifyResult.code === 0) {
        log.success('✅ Ключ шифрования успешно передан и проверен на VDS');
        log.info(`📋 Информация о ключе на VDS: ${verifyResult.stdout.trim()}`);
        
        res.json({
          success: true,
          message: 'Ключ шифрования успешно передан на VDS',
          vdsIp: vdsIp,
          keyPath: `/home/${dockerUser}/dapp/ssl/keys/full_db_encryption.key`,
          nextSteps: [
            '✅ Ключ шифрования передан на VDS',
            '✅ Права доступа настроены',
            '✅ VDS готова для запуска приложения с шифрованием'
          ]
        });
      } else {
        throw new Error(`Не удалось проверить передачу ключа шифрования: ${verifyResult.stderr || verifyResult.stdout}`);
      }
      
    } catch (error) {
      log.error('❌ Ошибка передачи ключа шифрования: ' + error.message);
      log.error('📋 Детали ошибки:', error.stack);
      return res.status(500).json({
        success: false,
        message: `Ошибка передачи ключа шифрования: ${error.message}`
      });
    }
    
  } catch (error) {
    log.error('❌ Ошибка передачи ключа шифрования на VDS: ' + error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Настройка VDS
app.post('/vds/setup', logRequest, async (req, res) => {
  try {
    const { 
      vdsIp, 
      domain, 
      email, 
      ubuntuUser, 
      dockerUser, 
      sshUser, 
      sshHost,
      sshPort = 22,
      sshConnectUser,
      sshConnectPassword
    } = req.body;
    
    // Нормализуем значения (удаляем пробелы)
    const normalizedVdsIp = String(vdsIp || '').trim();
    const normalizedSshHost = sshHost ? String(sshHost).trim() : undefined;
    const normalizedSshConnectUser = String(sshConnectUser || sshUser || 'root').trim();
    const normalizedSshConnectPassword = sshConnectPassword ? String(sshConnectPassword).trim() : undefined;
    
    log.info(`Настройка VDS: ${normalizedVdsIp} для домена: ${domain}`);
    
    // Отправляем начальный статус через WebSocket
    sendWebSocketStatus(false, 'Начинаем настройку VDS...');
    sendWebSocketLog('info', `🚀 Начинаем настройку VDS: ${normalizedVdsIp} для домена: ${domain}`, 'init', 0);
    
    const options = {
      vdsIp: normalizedVdsIp,
      sshHost: normalizedSshHost,
      sshPort,
      sshConnectUser: normalizedSshConnectUser,
      sshConnectPassword: normalizedSshConnectPassword
    };
    
    // 0. Проверка системных требований
    sendWebSocketLog('info', '🔍 Проверка системных требований VDS...', 'requirements', 5);
    const systemResult = await checkSystemRequirements(options);
    const systemInfo = systemResult.systemInfo;
    sendWebSocketLog('success', '✅ Системные требования проверены', 'requirements', 10);
    
    // 1. Создание SSH ключей локально (на хосте)
    sendWebSocketLog('info', '🔑 Создание SSH ключей...', 'ssh_keys', 15);
    await createSshKeys(email);
    sendWebSocketLog('success', '✅ SSH ключи созданы', 'ssh_keys', 20);
    
    // Читаем созданный публичный ключ с хоста
    const publicKeyContent = await fs.readFile(PUBLIC_KEY_PATH, 'utf8');
    const publicKeyLine = publicKeyContent.trim();
    
    // 2. Настройка SSH ключей для root
    await setupRootSshKeys(publicKeyLine, options);
    
    // 3. Очистка VDS сервера
    sendWebSocketLog('info', '🧹 Очистка VDS сервера...', 'cleanup', 30);
    await cleanupVdsServer(options);
    sendWebSocketLog('success', '✅ VDS сервер очищен', 'cleanup', 35);
    
    // 4. Создание пользователей
    sendWebSocketLog('info', '👥 Создание пользователей...', 'users', 40);
    await createAllUsers(ubuntuUser, dockerUser, publicKeyLine, options);
    sendWebSocketLog('success', '✅ Пользователи созданы', 'users', 45);
    
    // 5. Установка Docker
    sendWebSocketLog('info', '🐳 Установка Docker...', 'docker', 50);
    log.info('Установка Docker...');
    await execSshCommand('curl -fsSL https://get.docker.com -o get-docker.sh', options);
    await execSshCommand('sh get-docker.sh', options);
    await execSshCommand(`usermod -aG docker ${dockerUser}`, options);
    sendWebSocketLog('success', '✅ Docker установлен', 'docker', 55);
    
    // 6. Установка Docker Compose
    await execSshCommand('curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose', options);
    await execSshCommand('chmod +x /usr/local/bin/docker-compose', options);
    
    // 7. Отключение парольной аутентификации
    await disablePasswordAuth(options);
    
    // 8. Настройка firewall
    await setupFirewall(options);
    
    // 8.1. Установка fail2ban для защиты от SSH атак
    log.info('Установка fail2ban для защиты от SSH атак...');
    await execSshCommand('apt-get install -y fail2ban', options);
    
    // Создание конфигурации fail2ban для SSH с увеличенными лимитами
    const fail2banConfig = `[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 50
bantime = 3600
findtime = 3600

        [nginx-http-auth]
        enabled = true
        filter = nginx-http-auth
        logpath = /var/lib/docker/containers/*/docker-nginx-*.log
        maxretry = 3
        bantime = 3600`;
    
    await execSshCommand(`echo '${fail2banConfig}' | tee /etc/fail2ban/jail.local`, options);
    await execSshCommand('systemctl enable fail2ban', options);
    await execSshCommand('systemctl start fail2ban', options);
    log.success('fail2ban настроен для защиты от SSH атак');
    
    // 9. Создание директории для ключей шифрования
    await execSshCommand(`mkdir -p /home/${dockerUser}/dapp/ssl/keys`, options);
    await execSshCommand(`chmod 700 /home/${dockerUser}/dapp/ssl/keys`, options);
    await execSshCommand(`chown ${dockerUser}:${dockerUser} /home/${dockerUser}/dapp/ssl/keys`, options);
    log.success('Директория для ключа шифрования подготовлена');
    
    // 9.1. Передача ключа шифрования на VDS
    // Прогресс после установки Docker (55%), двигаемся вперёд, а не назад
    sendWebSocketLog('info', '🔐 Передача ключа шифрования на VDS...', 'encryption_key', 56);
    log.info('🔐 Передача ключа шифрования на VDS...');
    
    try {
      // Определяем путь к ключу шифрования
      let encryptionKeyPath = process.env.ENCRYPTION_KEY_PATH;
      
      if (!encryptionKeyPath) {
        // Пробуем несколько возможных путей
        const possiblePaths = [
          path.resolve(__dirname, '..', 'ssl', 'keys', 'full_db_encryption.key'),
          path.resolve(__dirname, 'ssl', 'keys', 'full_db_encryption.key'),
          '/app/ssl/keys/full_db_encryption.key',
          path.join(process.cwd(), 'ssl', 'keys', 'full_db_encryption.key')
        ];
        
        log.info(`🔍 Поиск ключа шифрования в возможных путях...`);
        for (const possiblePath of possiblePaths) {
          if (await fs.pathExists(possiblePath)) {
            encryptionKeyPath = possiblePath;
            log.info(`✅ Ключ найден по пути: ${encryptionKeyPath}`);
            break;
          }
        }
      }
      
      if (!encryptionKeyPath) {
        throw new Error('Путь к ключу шифрования не указан и не найден в стандартных местах');
      }
      
      // Проверяем существование файла
      const keyExists = await fs.pathExists(encryptionKeyPath);
      if (!keyExists) {
        throw new Error(`Файл ключа шифрования не найден: ${encryptionKeyPath}`);
      }
      
      log.info(`📖 Чтение ключа шифрования из: ${encryptionKeyPath}`);
      
      // Читаем ключ шифрования с локальной машины
      const encryptionKeyContent = await fs.readFile(encryptionKeyPath, 'utf8');
      
      if (!encryptionKeyContent || encryptionKeyContent.trim().length === 0) {
        throw new Error('Ключ шифрования пуст или не может быть прочитан');
      }
      
      log.success(`✅ Ключ шифрования прочитан с локальной машины (длина: ${encryptionKeyContent.length} символов)`);
      
      // Создаем временный файл с ключом
      const tempKeyPath = `/tmp/encryption_key_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.key`;
      log.info(`📝 Создание временного файла: ${tempKeyPath}`);
      await fs.writeFile(tempKeyPath, encryptionKeyContent, { mode: 0o600 });
      
      // Передаем файл на VDS через SCP
      log.info(`📤 Передача ключа на VDS через SCP...`);
      const scpResult = await execScpCommand(
        tempKeyPath,
        `/home/${dockerUser}/dapp/ssl/keys/full_db_encryption.key`,
        options
      );
      
      // Проверяем результат SCP
      if (scpResult.code !== 0) {
        throw new Error(`SCP команда завершилась с ошибкой (код: ${scpResult.code}): ${scpResult.stderr || scpResult.stdout}`);
      }
      
      log.success('✅ Файл ключа успешно передан на VDS через SCP');
      
      // Удаляем временный файл
      try {
        await fs.remove(tempKeyPath);
        log.info(`🗑️ Временный файл удален: ${tempKeyPath}`);
      } catch (removeError) {
        log.warn(`⚠️ Не удалось удалить временный файл ${tempKeyPath}: ${removeError.message}`);
      }
      
      // Устанавливаем правильные права доступа к ключу на VDS
      log.info('🔒 Настройка прав доступа к ключу шифрования на VDS...');
      const chownResult = await execSshCommand(`chown ${dockerUser}:${dockerUser} /home/${dockerUser}/dapp/ssl/keys/full_db_encryption.key`, options);
      if (chownResult.code !== 0) {
        log.warn(`⚠️ Не удалось изменить владельца ключа: ${chownResult.stderr}`);
      }
      
      // 🆕 Используем права 644 вместо 600, чтобы контейнеры могли читать ключ
      // Ключ должен быть читаемым для всех процессов в контейнерах
      const chmodResult = await execSshCommand(`chmod 644 /home/${dockerUser}/dapp/ssl/keys/full_db_encryption.key`, options);
      if (chmodResult.code !== 0) {
        log.warn(`⚠️ Не удалось изменить права доступа к ключу: ${chmodResult.stderr}`);
      } else {
        log.success('✅ Права доступа к ключу установлены (644 - читаемый для всех)');
      }
      
      // Проверяем, что ключ успешно передан
      log.info('🔍 Проверка передачи ключа...');
      const verifyResult = await execSshCommand(`ls -la /home/${dockerUser}/dapp/ssl/keys/full_db_encryption.key`, options);
      
      if (verifyResult.code === 0) {
        log.success('✅ Ключ шифрования успешно передан на VDS');
        log.info(`📋 Информация о ключе на VDS: ${verifyResult.stdout.trim()}`);
        // Делаем прогресс строго больше предыдущего шага Docker (55%)
        sendWebSocketLog('success', '✅ Ключ шифрования передан на VDS', 'encryption_key', 57);
      } else {
        throw new Error(`Не удалось проверить передачу ключа шифрования: ${verifyResult.stderr || verifyResult.stdout}`);
      }
    } catch (error) {
      log.error('❌ Ошибка передачи ключа шифрования: ' + error.message);
      log.error('📋 Детали ошибки:', error.stack);
      // Даже при ошибке не откатываем прогресс назад относительно предыдущих шагов
      sendWebSocketLog('error', `❌ Ошибка передачи ключа шифрования: ${error.message}`, 'encryption_key', 57);
      // Продолжаем установку, но предупреждаем пользователя
      log.warn('⚠️ Внимание: ключ шифрования не передан. Backend может не запуститься без ключа.');
    }
    
    // 10. Проверка и удаление системного nginx для избежания конфликтов портов
    log.info('🔍 Проверка наличия системного nginx...');
    const nginxCheck = await execSshCommand('systemctl list-units --type=service --state=active,inactive | grep nginx || echo "nginx not found"', options);
    
    if (nginxCheck.stdout.includes('nginx.service')) {
      log.info('⚠️ Обнаружен системный nginx - удаляем для освобождения портов 80/443...');
      
      // Остановка и удаление системного nginx
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
    
    // 11. Создание временных SSL сертификатов для запуска frontend-nginx
    log.info('🔒 Создание временных SSL сертификатов...');
    await execSshCommand(`mkdir -p /etc/letsencrypt/live/${domain}`, options);
    await execSshCommand(`mkdir -p /var/www/certbot`, options);
    
    // Создаем временный самоподписанный сертификат
    const tempCertCommand = `openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/letsencrypt/live/${domain}/privkey.pem -out /etc/letsencrypt/live/${domain}/fullchain.pem -subj '/C=US/ST=State/L=City/O=Organization/CN=${domain}'`;
    await execSshCommand(tempCertCommand, options);
    log.success('Временный SSL сертификат создан');
    // Сообщаем о создании временного сертификата сразу после его генерации,
    // выставляя прогресс между шагами Docker (55%) и экспортом образов (60%),
    // чтобы индикатор прогресса не "откатывался" назад.
    log.info('ℹ️ Временный SSL сертификат создан. Для получения реального SSL сертификата используйте кнопку \"Получить / обновить SSL\" на странице /vds.');
    sendWebSocketLog(
      'info',
      'ℹ️ Временный SSL сертификат установлен. Для получения реального SSL нажмите \"Получить / обновить SSL\" в интерфейсе VDS.',
      'ssl_cert',
      58
    );
    
    // 12. Передача docker-compose.prod.yml на VDS
    log.info('Передача docker-compose.prod.yml на VDS...');
    await execScpCommand('/app/docker-compose.prod.yml', `/home/${dockerUser}/dapp/docker-compose.prod.yml`, options);

    // 12.1 Bind-mount деревья (backend/shared/dist/blanc-xray/scripts)
    await transferAppOverlay({
      sshOptions: options,
      dockerUser,
      sendWebSocketLog,
    });
    
    // 13. Nginx конфигурация встроена в Docker образ frontend-nginx
    log.info('Nginx конфигурация встроена в Docker образ frontend-nginx');
    
    if (!domain || !email) {
      log.error('Критическая ошибка: отсутствуют обязательные переменные DOMAIN или EMAIL для nginx');
      throw new Error('Необходимы переменные DOMAIN и EMAIL для настройки nginx');
    }
    log.success(`Nginx будет настроен для домена: ${domain} с email: ${email}`);
    
    // 14. Полный .env (LiveKit / Gitea / Ollama)
    const livekitApiKey = crypto.randomBytes(16).toString('hex');
    const livekitApiSecret = crypto.randomBytes(32).toString('hex');
    const giteaDbPassword = crypto.randomBytes(18).toString('base64url');

    const envContent = `# Основные настройки
DOMAIN=${domain}
BACKEND_CONTAINER=dapp-backend
EMAIL=${email}

# Настройки базы данных
DB_NAME=dapp_db
DB_USER=dapp_user
DB_PASSWORD=dapp_password

# Gitea (PostgreSQL)
GITEA_DB_PASSWORD=${giteaDbPassword}

# Настройки Node.js
NODE_ENV=production
PORT=8000

# Настройки Ollama
OLLAMA_MODEL=qwen2.5:1.5b
OLLAMA_EMBEDDINGS_MODEL=mxbai-embed-large:latest

# LiveKit (ИИ-конференция)
LIVEKIT_API_KEY=${livekitApiKey}
LIVEKIT_API_SECRET=${livekitApiSecret}
LIVEKIT_RTC_USE_EXTERNAL_IP=true
LIVEKIT_RTC_FORCE_TCP=false

# Настройки безопасности
SSL_CERT_PATH=/etc/ssl/certs
SSL_KEY_PATH=/etc/ssl/private

# WebSocket / nginx
WS_BACKEND_CONTAINER=dapp-backend
`;
    
    await fs.writeFile('/tmp/.env', envContent);
    await execScpCommand('/tmp/.env', `/home/${dockerUser}/dapp/.env`, options);
    await fs.remove('/tmp/.env');
    
    // 15. Экспорт / передача / импорт образов + pull публичных
    await exportDockerImages(sendWebSocketLog);
    await transferDockerImages({ ...options, dockerUser }, sendWebSocketLog);
    await importDockerImages({ ...options, dockerUser }, sendWebSocketLog);
    await pullRemoteImages({ ...options, dockerUser }, sendWebSocketLog);
    await cleanupLocalFiles();
    
    // 16. Запуск приложения
    log.info('Запуск приложения...');
    await execSshCommand(`cd /home/${dockerUser}/dapp && docker compose -f docker-compose.prod.yml up -d`, options);
    
    // SSL: временный сертификат уже создан; реальный — кнопка на /vds → /api/vds/ssl/renew
    
    // 16.2 Ожидание postgres
    log.info('Ожидание готовности базы данных...');
    let dbReady = false;
    let attempts = 0;
    const maxAttempts = 30;
    
    while (!dbReady && attempts < maxAttempts) {
      const dbCheckResult = await execSshCommand(`cd /home/${dockerUser}/dapp && docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U dapp_user -d dapp_db`, options);
      if (dbCheckResult.code === 0) {
        dbReady = true;
        log.success('База данных готова к работе');
      } else {
        attempts++;
        log.info(`Ожидание готовности БД... попытка ${attempts}/${maxAttempts}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (!dbReady) {
      log.error('База данных не готова после максимального количества попыток');
    }

    // 16.2.1 Gitea DB/role
    if (dbReady) {
      log.info('Создание БД/роли Gitea…');
      sendWebSocketLog('info', '🛠 Gitea database…', 'gitea_db', 93);
      const giteaSetup = await execSshCommand(
        `cd /home/${dockerUser}/dapp && GITEA_DB_PASSWORD='${giteaDbPassword}' COMPOSE_FILE=docker-compose.prod.yml POSTGRES_SERVICE=postgres bash scripts/setup-gitea-db.sh`,
        options
      );
      if (giteaSetup.code !== 0) {
        log.warn(`Gitea DB setup: ${giteaSetup.stderr || giteaSetup.stdout}`);
        sendWebSocketLog('warning', '⚠️ Gitea DB: см. логи SSH', 'gitea_db', 93);
      } else {
        log.success('Gitea DB готова');
        await execSshCommand(
          `cd /home/${dockerUser}/dapp && docker compose -f docker-compose.prod.yml up -d gitea`,
          options
        );
      }
    }
    
    // 16.2.2 Проверка таблиц
    log.info('Проверка целостности переданной базы данных...');
    const tableCheckResult = await execSshCommand(`cd /home/${dockerUser}/dapp && docker compose -f docker-compose.prod.yml exec -T postgres psql -U dapp_user -d dapp_db -c "\\dt"`, options);
    
    if (tableCheckResult.code === 0 && tableCheckResult.stdout.includes('email_settings')) {
      log.success('База данных содержит необходимые таблицы (email_settings найдена)');
      const tableCountResult = await execSshCommand(`cd /home/${dockerUser}/dapp && docker compose -f docker-compose.prod.yml exec -T postgres psql -U dapp_user -d dapp_db -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"`, options);
      if (tableCountResult.code === 0) {
        log.info(`Количество таблиц в базе данных: ${tableCountResult.stdout.trim()}`);
      }
    } else {
      log.warn('Предупреждение: база данных может быть пустой или неполной');
      log.info('Содержимое проверки таблиц: ' + tableCheckResult.stdout);
    }

    // 16.2.3 yarn install
    log.info('backend yarn install…');
    sendWebSocketLog('info', '📦 yarn install в backend…', 'yarn', 94);
    try {
      await execSshCommand(
        `cd /home/${dockerUser}/dapp && for i in 1 2 3 4 5 6; do
           if docker compose -f docker-compose.prod.yml exec -T backend yarn install --frozen-lockfile; then exit 0; fi
           sleep 5
         done; exit 1`,
        options
      );
    } catch (err) {
      log.warn(`yarn install: ${err.message}`);
      sendWebSocketLog('warning', '⚠️ yarn install не выполнен', 'yarn', 94);
    }

    // 16.2.4 migrations
    log.info('Запуск миграций…');
    sendWebSocketLog('info', '🗄️ Миграции БД…', 'migrations', 95);
    try {
      await execSshCommand(
        `cd /home/${dockerUser}/dapp && for i in 1 2 3 4 5 6; do
           if docker compose -f docker-compose.prod.yml exec -T backend node scripts/run-migrations.js; then exit 0; fi
           echo "backend ещё не готов, повтор $i/6"
           sleep 5
         done; exit 1`,
        options
      );
    } catch (err) {
      log.warn(`migrations: ${err.message}`);
      sendWebSocketLog('warning', '⚠️ Миграции не завершились', 'migrations', 95);
    }

    // 16.2.5 SEO prerender
    log.info('SEO pre-render…');
    sendWebSocketLog('info', '📰 SEO pre-render…', 'prerender', 96);
    try {
      await execSshCommand(
        `cd /home/${dockerUser}/dapp && for i in 1 2 3 4 5 6 7 8; do
           if docker compose -f docker-compose.prod.yml exec -T backend \
             node -e "require('http').get('http://127.0.0.1:8000/api/pages/blog/all',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"; then
             break
           fi
           sleep 5
           if [ "$i" -eq 8 ]; then exit 1; fi
         done
         docker compose -f docker-compose.prod.yml exec -T backend \
           node -e "require('http').get('http://127.0.0.1:8000/api/pages/public/sitemap.xml',r=>{r.resume();process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))" || true
         docker compose -f docker-compose.prod.yml exec -T backend node scripts/pre-render-blog.js`,
        options
      );
    } catch (err) {
      log.warn(`prerender: ${err.message}`);
      sendWebSocketLog('warning', '⚠️ pre-render пропущен', 'prerender', 96);
    }
    
    // 16.3 Ключ шифрования
    log.info('Проверка ключа шифрования в backend контейнере...');
    const keyCheckResult = await execSshCommand(`cd /home/${dockerUser}/dapp && docker compose -f docker-compose.prod.yml exec -T backend ls -la /app/ssl/keys/`, options);
    
    if (keyCheckResult.code === 0 && keyCheckResult.stdout.includes('full_db_encryption.key')) {
      log.success('Ключ шифрования найден в backend контейнере');
      const keyContentResult = await execSshCommand(`cd /home/${dockerUser}/dapp && docker compose -f docker-compose.prod.yml exec -T backend head -c 50 /app/ssl/keys/full_db_encryption.key`, options);
      if (keyContentResult.code === 0) {
        log.info('Ключ шифрования доступен для чтения в контейнере');
      }
    } else {
      log.error('Критическая ошибка: ключ шифрования не найден в backend контейнере');
      log.info('Содержимое /app/ssl/keys/: ' + keyCheckResult.stdout);
      await execSshCommand(`cd /home/${dockerUser}/dapp && docker compose -f docker-compose.prod.yml restart backend`, options);
      await new Promise(resolve => setTimeout(resolve, 5000));
      const retryKeyCheck = await execSshCommand(`cd /home/${dockerUser}/dapp && docker compose -f docker-compose.prod.yml exec -T backend ls -la /app/ssl/keys/`, options);
      if (retryKeyCheck.code === 0 && retryKeyCheck.stdout.includes('full_db_encryption.key')) {
        log.success('Ключ шифрования найден после перезапуска backend контейнера');
      } else {
        log.error('Ключ шифрования все еще недоступен после перезапуска');
      }
    }
    
    // 17. Статус контейнеров
    log.info('Проверка статуса контейнеров...');
    const containersResult = await execSshCommand('docker ps --format "table {{.Names}}\\t{{.Status}}"', options);
    log.info('Статус контейнеров:\\n' + containersResult.stdout);
    
    log.success('VDS настроена и приложение запущено');

    // Версия инстанса для update.sh
    try {
      const { resolveHostProjectRoot } = require('./utils/transferUtils');
      const root = resolveHostProjectRoot();
      const verPath = path.join(root, 'DLE_VERSION');
      let ver = 'v1.0.4';
      if (await fs.pathExists(verPath)) {
        ver = String(await fs.readFile(verPath, 'utf8')).trim() || ver;
      }
      await fs.writeFile('/tmp/DLE_VERSION', `${ver}\n`);
      await execScpCommand('/tmp/DLE_VERSION', `/home/${dockerUser}/dapp/DLE_VERSION`, options);
      await fs.remove('/tmp/DLE_VERSION').catch(() => {});
      await execSshCommand(`chown ${dockerUser}:${dockerUser} /home/${dockerUser}/dapp/DLE_VERSION`, options);
      log.success(`DLE_VERSION=${ver} записан на VDS`);
    } catch (verErr) {
      log.warn(`DLE_VERSION не записан: ${verErr.message}`);
    }
    
    sendWebSocketStatus(true, `VDS ${domain} успешно настроена`);
    sendWebSocketLog('success', `🎉 VDS настроена успешно! Приложение доступно по адресу: https://${domain}`, 'complete', 100);
    
    vdsState = {
      configured: true,
      domain: domain,
      vdsIp: vdsIp
    };
    
    res.json({
      success: true,
      message: 'VDS настроена успешно и приложение запущено',
      domain: domain,
      vdsIp: vdsIp,
      applicationUrl: `https://${domain}`,
      systemInfo: systemInfo,
      nextSteps: [
        '✅ Системные требования проверены',
        '✅ VDS настроена и готова к работе',
        'ℹ️ Временный SSL — получите реальный через кнопку на /vds',
        '✅ Docker контейнеры запущены',
        '✅ Bind mounts / LiveKit / Gitea / Blanc учтены',
        '✅ Приложение доступно по адресу: https://' + domain
      ]
    });
    
  } catch (error) {
    log.error('Ошибка настройки VDS: ' + error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Диагностика VDS
app.post('/vds/diagnostics', logRequest, async (req, res) => {
  try {
    const { 
      vdsIp, 
      sshUser,
      sshHost,
      sshPort = 22,
      sshConnectUser,
      sshConnectPassword
    } = req.body;
    
    // Нормализуем значения (удаляем пробелы)
    const normalizedVdsIp = String(vdsIp || '').trim();
    const normalizedSshHost = sshHost ? String(sshHost).trim() : undefined;
    const normalizedSshConnectUser = String(sshConnectUser || sshUser || 'root').trim();
    const normalizedSshConnectPassword = sshConnectPassword ? String(sshConnectPassword).trim() : undefined;
    
    if (!normalizedVdsIp || !normalizedSshConnectUser || !normalizedSshConnectPassword) {
      return res.status(400).json({
        success: false,
        message: 'Необходимы параметры: vdsIp, sshConnectUser, sshConnectPassword'
      });
    }
    
    log.info(`Диагностика VDS: ${normalizedVdsIp}`);
    
    const options = {
      vdsIp: normalizedVdsIp,
      sshHost: normalizedSshHost,
      sshPort,
      sshConnectUser: normalizedSshConnectUser,
      sshConnectPassword: normalizedSshConnectPassword
    };
    
    // 1. Проверка статуса системы
    const systemStatus = await execSshCommand('uptime && free -h && df -h', options);
    
    // 2. Проверка статуса Docker контейнеров
    const dockerStatus = await execSshCommand('docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"', options);
    
    // 3. Проверка портов
    const portsStatus = await execSshCommand('netstat -tlnp 2>/dev/null | grep -E ":(80|443|8000|9000|5432|11434|7880|7881|2223)" || ss -tlnp | grep -E ":(80|443|8000|9000|5432|11434|7880|7881|2223)" || true', options);
    
    // 4. Проверка Docker nginx контейнера
    const nginxStatus = await execSshCommand('docker ps --filter "name=dapp-frontend-nginx" --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}" || echo "Docker nginx контейнер не найден"', options);
    
    // 5. Проверка fail2ban статуса
    const fail2banStatus = await execSshCommand('fail2ban-client status sshd', options);
    
    // 6. Проверка SSL сертификата
    const sslStatus = await execSshCommand('certbot certificates', options);
    
    // 7. Проверка логов на ошибки
    const errorLogs = await execSshCommand('journalctl -u docker --since "1 hour ago" --no-pager | tail -20', options);
    
    res.json({
      success: true,
      message: 'Диагностика VDS завершена',
      vdsIp: vdsIp,
      diagnostics: {
        system: systemStatus.stdout,
        docker: dockerStatus.stdout,
        ports: portsStatus.stdout,
        nginx: nginxStatus.stdout,
        fail2ban: fail2banStatus.stdout,
        ssl: sslStatus.stdout,
        errors: errorLogs.stdout
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    log.error('Ошибка диагностики VDS: ' + error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Graceful shutdown

process.on('SIGTERM', async () => {
  log.info('Получен сигнал SIGTERM, завершаем работу...');
  if (server) {
    server.close(() => {
      log.info('Сервер закрыт');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', async () => {
  log.info('Получен сигнал SIGINT, завершаем работу...');
  if (server) {
    server.close(() => {
      log.info('Сервер закрыт');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// Обработка необработанных ошибок
process.on('uncaughtException', (error) => {
  log.error('Необработанная ошибка: ' + error.message);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Необработанное отклонение промиса: ' + reason);
});

// WebSocket обработчики
wss.on('connection', (ws) => {
  log.info(`🔌 WebSocket подключение`);
  
  // Отправляем текущий статус новому подключению
  ws.send(JSON.stringify({
    type: 'webssh_status',
    connected: vdsState.configured,
    status: vdsState.configured ? 'connected' : 'disconnected',
    message: vdsState.configured ? `VDS ${vdsState.domain} настроена` : 'VDS не настроена',
    timestamp: new Date().toISOString()
  }));
  
  ws.on('close', () => {
    log.info(`🔌 WebSocket отключение`);
  });
  
  ws.on('error', (error) => {
    log.error('WebSocket ошибка:', error);
  });
});

// Запуск сервера
async function startServer() {
  try {
    log.info('🚀 Запуск WebSSH Agent...');
    
    server.listen(PORT, '0.0.0.0', () => {
      log.info(`🚀 WebSSH Agent запущен на порту ${PORT}`);
      log.success('🛡️ Агент готов к работе');
      log.info('🔌 WebSocket сервер готов для real-time логов');
    });
  } catch (error) {
    log.error('❌ Критическая ошибка запуска сервера:', error);
    process.exit(1);
  }
}

startServer();
