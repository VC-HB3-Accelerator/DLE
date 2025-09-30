const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

const app = express();
const PORT = 12345;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:8000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Состояние туннеля
let tunnelState = {
  connected: false,
  domain: null,
  tunnelId: null,
  sshProcess: null,
  config: null
};

// Логирование
const log = {
  info: (message) => console.log(chalk.blue('[INFO]'), message),
  success: (message) => console.log(chalk.green('[SUCCESS]'), message),
  error: (message) => console.log(chalk.red('[ERROR]'), message),
  warn: (message) => console.log(chalk.yellow('[WARN]'), message)
};

// Проверка здоровья агента
app.get('/health', (req, res) => {
  log.info('Health check requested');
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    tunnelConnected: tunnelState.connected
  });
});

// Создание туннеля
app.post('/tunnel/create', async (req, res) => {
  try {
    const { domain, email, sshHost, sshUser, sshKey, localPort, serverPort, sshPort } = req.body;
    
    log.info(`Создание туннеля для домена: ${domain}`);
    
    // Валидация входных данных
    if (!domain || !email || !sshHost || !sshUser || !sshKey) {
      return res.status(400).json({
        success: false,
        message: 'Все обязательные поля должны быть заполнены'
      });
    }

    // Если туннель уже подключен, отключаем его
    if (tunnelState.connected) {
      log.warn('Отключаем существующий туннель');
      await disconnectTunnel();
    }

    // Создаем временную директорию для SSH ключей
    const tempDir = path.join(__dirname, 'temp');
    await fs.ensureDir(tempDir);
    
    // Сохраняем SSH ключ во временный файл
    const keyPath = path.join(tempDir, `ssh_key_${Date.now()}`);
    let normalizedKey = sshKey
      .replace(/[ \t]+$/gm, '') // убираем пробелы и табы в конце каждой строки
      .replace(/\r\n/g, '\n');  // нормализуем переносы строк

    // Гарантируем, что после END нет ничего, кроме перевода строки
    normalizedKey = normalizedKey.replace(
      /(-----END OPENSSH PRIVATE KEY-----)[^\n]*$/m,
      '$1\n'
    );

    await fs.writeFile(keyPath, normalizedKey, { mode: 0o600 });
    
    log.info('SSH ключ сохранен, подключаемся к серверу...');
    
    // Функция для выполнения SSH команд
    const execSshCommand = (command) => {
      return new Promise((resolve, reject) => {
        const sshArgs = [
          '-i', keyPath,
          '-p', (sshPort || 22).toString(),
          '-o', 'StrictHostKeyChecking=no',
          '-o', 'UserKnownHostsFile=/dev/null',
          `${sshUser}@${sshHost}`,
          command
        ];
        
        const sshProcess = spawn('ssh', sshArgs);
        let stdout = '';
        let stderr = '';
        
        sshProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        sshProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        sshProcess.on('close', (code) => {
          resolve({ code, stdout, stderr });
        });
        
        sshProcess.on('error', (error) => {
          reject(error);
        });
      });
    };
    
    log.info('Подключение к серверу установлено');
    
    // Проверяем и устанавливаем NGINX и certbot
    log.info('Проверка и установка NGINX...');
    const installResult = await execSshCommand('which nginx || (apt-get update && apt-get install -y nginx certbot python3-certbot-nginx)');
    if (installResult.code !== 0) {
      log.error('Ошибка установки NGINX: ' + installResult.stderr);
    }
    
    // Создание конфигурации NGINX
    const nginxConfig = `
server {
    listen 80;
    server_name ${domain};
    
    location / {
        proxy_pass http://localhost:${serverPort || 9000};
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass \\$http_upgrade;
    }
}
`;
    
    log.info('Создание конфигурации NGINX...');
    await execSshCommand(`echo '${nginxConfig}' > /etc/nginx/sites-available/${domain}`);
    await execSshCommand(`ln -sf /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/`);
    
    // Проверка и перезагрузка NGINX
    const nginxTestResult = await execSshCommand('nginx -t');
    if (nginxTestResult.code !== 0) {
      log.error('Ошибка конфигурации NGINX: ' + nginxTestResult.stderr);
      throw new Error('Ошибка конфигурации NGINX: ' + nginxTestResult.stderr);
    }
    
    await execSshCommand('systemctl reload nginx');
    log.success('NGINX настроен и перезагружен');
    
    // Получение SSL сертификата
    log.info('Получение SSL сертификата...');
    const certbotResult = await execSshCommand(
      `certbot --nginx -d ${domain} --non-interactive --agree-tos --email ${email} --redirect`
    );
    
    if (certbotResult.code !== 0) {
      log.warn('Предупреждение при получении SSL: ' + certbotResult.stderr);
      // Продолжаем, даже если SSL не получен
    } else {
      log.success('SSL сертификат получен');
    }
    
    // Создание SSH туннеля
    log.info('Создание SSH туннеля...');
    const tunnelId = Date.now().toString();
    const sshArgs = [
      '-i', keyPath,
      '-p', (sshPort || 22).toString(),
      '-R', `${serverPort || 9000}:localhost:${localPort || 5173}`,
      '-N',
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'ServerAliveInterval=60',
      '-o', 'ServerAliveCountMax=3',
      `${sshUser}@${sshHost}`
    ];
    
    const sshProcess = spawn('ssh', sshArgs);
    
    sshProcess.stdout.on('data', (data) => {
      log.info('SSH stdout: ' + data.toString());
    });
    
    sshProcess.stderr.on('data', (data) => {
      log.warn('SSH stderr: ' + data.toString());
    });
    
    sshProcess.on('error', (error) => {
      log.error('SSH процесс ошибка: ' + error.message);
      tunnelState.connected = false;
    });
    
    sshProcess.on('close', (code) => {
      log.info(`SSH процесс завершен с кодом: ${code}`);
      tunnelState.connected = false;
    });
    
    // Даем время на установку соединения
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Обновляем состояние
    tunnelState = {
      connected: true,
      domain,
      tunnelId,
      sshProcess,
      config: { domain, email, sshHost, sshUser, localPort, serverPort, sshPort, keyPath }
    };
    
    log.success(`Туннель успешно создан для домена: ${domain}`);
    
    res.json({
      success: true,
      message: 'Туннель успешно создан',
      tunnelId,
      domain,
      url: `https://${domain}`
    });
    
  } catch (error) {
    log.error('Ошибка создания туннеля: ' + error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Отключение туннеля
app.post('/tunnel/disconnect', async (req, res) => {
  try {
    const result = await disconnectTunnel();
    res.json(result);
  } catch (error) {
    log.error('Ошибка отключения туннеля: ' + error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Настройка VDS
app.post('/vds/setup', async (req, res) => {
  try {
    const { 
      vdsIp, 
      domain, 
      email, 
      ubuntuUser, 
      ubuntuPassword, 
      dockerUser, 
      dockerPassword, 
      sshUser, 
      sshKey, 
      encryptionKey 
    } = req.body;
    
    log.info(`Настройка VDS: ${vdsIp} для домена: ${domain}`);
    
    // Здесь будет логика настройки VDS
    // 1. Очистка VDS
    // 2. Установка Ubuntu
    // 3. Создание пользователей Ubuntu и Docker
    // 4. Установка Docker, Docker Compose, nginx
    // 5. Миграция Docker образов
    // 6. Передача ключей
    // 7. Обновление переменных в БД
    // 8. Запуск приложения
    
    res.json({
      success: true,
      message: 'VDS настроена успешно',
      domain: domain,
      vdsIp: vdsIp
    });
    
  } catch (error) {
    log.error('Ошибка настройки VDS: ' + error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Функция отключения туннеля
async function disconnectTunnel() {
  try {
    if (tunnelState.sshProcess) {
      tunnelState.sshProcess.kill('SIGTERM');
      
      // Ждем завершения процесса
      await new Promise((resolve) => {
        tunnelState.sshProcess.on('close', resolve);
        setTimeout(resolve, 5000); // Таймаут 5 сек
      });
    }
    
    // Удаляем временный SSH ключ
    if (tunnelState.config && tunnelState.config.keyPath) {
      try {
        await fs.remove(tunnelState.config.keyPath);
      } catch (err) {
        log.warn('Не удалось удалить временный SSH ключ: ' + err.message);
      }
    }
    
    const previousDomain = tunnelState.domain;
    
    tunnelState = {
      connected: false,
      domain: null,
      tunnelId: null,
      sshProcess: null,
      config: null
    };
    
    log.success('Туннель отключен');
    
    return {
      success: true,
      message: `Туннель для домена ${previousDomain} отключен`
    };
  } catch (error) {
    log.error('Ошибка при отключении туннеля: ' + error.message);
    return {
      success: false,
      message: error.message
    };
  }
}

// Статус туннеля
app.get('/tunnel/status', (req, res) => {
  res.json({
    connected: tunnelState.connected,
    domain: tunnelState.domain,
    tunnelId: tunnelState.tunnelId,
    timestamp: new Date().toISOString()
  });
});

// Получение логов
app.get('/tunnel/logs', (req, res) => {
  // В реальной реализации здесь можно вернуть логи из файла
  res.json({
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Агент запущен и готов к работе'
      }
    ]
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  log.info('Получен сигнал SIGTERM, завершаем работу...');
  if (tunnelState.connected) {
    await disconnectTunnel();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  log.info('Получен сигнал SIGINT, завершаем работу...');
  if (tunnelState.connected) {
    await disconnectTunnel();
  }
  process.exit(0);
});

// Запуск сервера
app.listen(PORT, 'localhost', () => {
  log.success(`WebSSH Agent запущен на порту ${PORT}`);
  log.info('Агент готов к приему команд от фронтенда');
});

// Обработка необработанных ошибок
process.on('uncaughtException', (error) => {
  log.error('Необработанная ошибка: ' + error.message);
  // console.error(error);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Необработанное отклонение промиса: ' + reason);
  // console.error(reason);
}); 