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

/**
 * Сервис для управления WEB SSH туннелем
 * Взаимодействует с локальным агентом на порту 3000
 */

const LOCAL_AGENT_URL = 'http://localhost:3000';
const API_BASE_PATH = '/api';

const normalizeDomainToAscii = (domain) => {
  if (!domain) return null;

  try {
    const normalized = domain.trim().toLowerCase();
    const url = new URL(`http://${normalized}`);
    return url.hostname;
  } catch (error) {
    console.warn('[WebSshService] Некорректное доменное имя:', domain, error.message);
    return null;
  }
};

// Функция для генерации nginx конфигурации
function getNginxConfig(domain, serverPort) {
  return `# Rate limiting для защиты от DDoS (отключено - лимиты убраны)
# limit_req_zone $binary_remote_addr zone=req_limit_per_ip:10m rate=10r/s;
# limit_req_zone $binary_remote_addr zone=api_limit_per_ip:10m rate=50r/s;

# Блокировка известных сканеров и вредоносных ботов (исключая легитимные поисковые боты)
map $http_user_agent $bad_bot {
    default 0;
    # Разрешаем легитимные поисковые боты
    ~*googlebot 0;
    ~*bingbot 0;
    ~*slurp 0;
    ~*duckduckbot 0;
    ~*baiduspider 0;
    ~*yandex 0;
    ~*sogou 0;
    ~*exabot 0;
    ~*facebot 0;
    ~*ia_archiver 0;
    # Блокируем вредоносные боты и сканеры
    ~*sqlmap 1;
    ~*nikto 1;
    ~*dirb 1;
    ~*gobuster 1;
    ~*wfuzz 1;
    ~*burp 1;
    ~*zap 1;
    ~*nessus 1;
    ~*openvas 1;
    ~*masscan 1;
    ~*nmap 1;
    ~*scanner 1;
}

server {
    listen 80;
    server_name ${domain};
    
    # Блокировка подозрительных ботов
    if ($bad_bot = 1) {
        return 403;
    }
    
    # Защита от path traversal
    if ($request_uri ~* "(\\\\.\\\\.|\\\\.\\\\./|\\\\.\\\\.\\\\.\\\\|\\\\.\\\\.%2f|\\\\.\\\\.%5c)") {
        return 404;
    }
    
    # Защита от опасных расширений
    location ~* \\\\.(zip|rar|7z|tar|gz|bz2|xz|sql|sqlite|db|bak|backup|old|csv|php|asp|aspx|jsp|cgi|pl|py|sh|bash|exe|bat|cmd|com|pif|scr|vbs|vbe|jar|war|ear|dll|so|dylib|bin|sys|ini|log|tmp|temp|swp|swo|~)$ {
        return 404;
    }
    
    # Защита от доступа к чувствительным файлам (исключаем robots.txt и sitemap.xml для SEO)
    location ~* /(\\\\.htaccess|\\\\.htpasswd|\\\\.env|\\\\.git|\\\\.svn|\\\\.DS_Store|Thumbs\\\\.db|web\\\\.config)$ {
        deny all;
        return 404;
    }
    
    # Разрешаем доступ к robots.txt и sitemap.xml для поисковых систем
    location = /robots.txt {
        proxy_pass http://localhost:8000/api/pages/public/robots.txt;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        add_header Content-Type text/plain;
    }
    
    location = /sitemap.xml {
        proxy_pass http://localhost:8000/api/pages/public/sitemap.xml;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        add_header Content-Type application/xml;
    }
    
    # Основной location для фронтенда
    location / {
        # Rate limiting для основных страниц (отключено)
        # limit_req zone=req_limit_per_ip burst=20 nodelay;
        
        proxy_pass http://localhost:${serverPort};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Базовые заголовки безопасности
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ws: wss:;" always;
        add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    }
    
    # API проксирование к backend через туннель
    location /api/ {
        # Rate limiting для API (отключено)
        # limit_req zone=api_limit_per_ip burst=100 nodelay;
        
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Заголовки безопасности для API
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }
    
    # WebSocket поддержка
    location /ws {
        proxy_pass http://localhost:8000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Скрытие информации о сервере
    server_tokens off;
}`;
}

class WebSshService {
  constructor() {
    this.isAgentRunning = false;
    this.connectionStatus = {
      connected: false,
      domain: null,
      vdsConfigured: false
    };
  }

  /**
   * Проверка доступности локального агента
   */
  async checkAgentStatus() {
    try {
      const response = await fetch(`${LOCAL_AGENT_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        this.isAgentRunning = true;
        return { running: true };
      }
      
      this.isAgentRunning = false;
      return { running: false };
    } catch (error) {
              // console.error('Агент не доступен:', error);
      this.isAgentRunning = false;
      return { running: false, error: error.message };
    }
  }

  /**
   * Автоматическая установка и запуск агента
   * В новой архитектуре агент всегда запускается в Docker (dapp-webssh-agent),
   * поэтому здесь просто проверяем его доступность.
   */
  async installAndStartAgent() {
      const status = await this.checkAgentStatus();
      if (status.running) {
        return { success: true, message: 'Агент уже запущен' };
      }

      return {
        success: false,
      message: 'WebSSH Agent не запущен. Убедитесь, что контейнер dapp-webssh-agent работает (docker compose up -d webssh-agent).'
    };
  }

  /**
   * Получение IP адреса из DNS записей домена через backend API
   */
  async getDomainIP(domain) {
    try {
      console.log(`Получение IP адреса для домена ${domain}...`);
      
      // Используем backend API для проверки DNS
      const asciiDomain = normalizeDomainToAscii(domain);
      if (!asciiDomain) {
        return { success: false, error: 'Некорректное доменное имя' };
      }

      const response = await fetch(`${API_BASE_PATH}/dns-check/${encodeURIComponent(asciiDomain)}`);
      const data = await response.json();
      
      if (data.success) {
        console.log(`DNS запись найдена: ${domain} → ${data.ip}`);
        return { success: true, ip: data.ip };
      } else {
        console.log(`DNS запись для домена ${domain} не найдена: ${data.message}`);
        return { success: false, error: data.message };
      }
    } catch (error) {
      console.warn(`Не удалось получить IP из DNS: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Настройка существующей VDS для туннелей
   */
  async setupVDS(config) {
    try {
      // Получаем IP адрес из DNS записей домена
      if (config.domain) {
        const dnsResult = await this.getDomainIP(config.domain);
        if (!dnsResult.success) {
          return {
            success: false,
            message: `Домен ${config.domain} не настроен или недоступен: ${dnsResult.error}`
          };
        }
        // Добавляем полученный IP в конфигурацию
        config.vdsIp = dnsResult.ip;
      }

      // Проверяем, что агент запущен (в Docker)
      const agentStatus = await this.checkAgentStatus();
      if (!agentStatus.running) {
        const installResult = await this.installAndStartAgent();
        if (!installResult.success) {
          return installResult;
        }
      }

      // API ключ больше не нужен - агент защищен сетевым доступом

      // Отправляем конфигурацию VDS агенту
      const response = await fetch(`${LOCAL_AGENT_URL}/vds/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vdsIp: config.vdsIp,
          domain: config.domain,
          email: config.email,
          ubuntuUser: config.ubuntuUser,
          dockerUser: config.dockerUser,
          sshUser: 'root', // SSH пользователь для настройки ключей (root)
          sshHost: config.sshHost, // SSH хост для подключения
          sshPort: config.sshPort, // SSH порт для подключения
          sshConnectUser: config.sshUser, // SSH пользователь для подключения
          sshConnectPassword: config.sshPassword // SSH пароль для подключения
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          this.connectionStatus = {
            connected: true,
            domain: config.domain,
            vdsIp: config.vdsIp
          };
        }
        
        return result;
      } else {
        const error = await response.json();
        return {
          success: false,
          message: error.message || 'Ошибка при настройке VDS'
        };
      }
    } catch (error) {
              // console.error('Ошибка при настройке VDS:', error);
      return {
        success: false,
        message: `Ошибка подключения к агенту: ${error.message}`
      };
    }
  }



  /**
   * Настройка почтового сервера
   */
  async setupMailServer(ssh, config, domain) {
    const mailDomain = config.mailDomain || `mail.${domain}`;
    const adminEmail = config.adminEmail || config.email;
    const adminPassword = config.adminPassword || 'Admin123!';
    
    // Настройка Postfix
    const postfixConfig = `
# Основные настройки
myhostname = ${mailDomain}
mydomain = ${domain}
myorigin = $mydomain
inet_interfaces = all
inet_protocols = ipv4
mydestination = $myhostname, localhost.$mydomain, localhost, $mydomain
relayhost = 
mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128
mailbox_size_limit = 0
recipient_delimiter = +
inet_interfaces = all
home_mailbox = Maildir/

# SSL настройки
smtpd_use_tls = yes
smtpd_tls_cert_file = /etc/letsencrypt/live/${domain}/fullchain.pem
smtpd_tls_key_file = /etc/letsencrypt/live/${domain}/privkey.pem
smtpd_tls_security_level = may
smtpd_tls_auth_only = no
smtp_tls_security_level = may
smtp_tls_CAfile = /etc/ssl/certs/ca-certificates.crt
smtpd_tls_received_header = yes
smtpd_tls_session_cache_timeout = 3600s
tls_random_source = dev:/dev/urandom

# Аутентификация
smtpd_sasl_type = dovecot
smtpd_sasl_path = private/auth
smtpd_sasl_auth_enable = yes
smtpd_sasl_security_options = noanonymous
smtpd_sasl_local_domain = $myhostname
smtpd_recipient_restrictions = permit_sasl_authenticated,permit_mynetworks,reject_unauth_destination
`;
    
    await ssh.execCommand(`echo '${postfixConfig}' > /etc/postfix/main.cf`);
    
    // Настройка Dovecot
    const dovecotConfig = `
# Основные настройки
protocols = imap pop3 lmtp
mail_location = maildir:~/Maildir
namespace inbox {
  inbox = yes
}
passdb {
  driver = pam
}
userdb {
  driver = passwd
}
service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0666
    user = postfix
    group = postfix
  }
}
ssl = required
ssl_cert = </etc/letsencrypt/live/${domain}/fullchain.pem
ssl_key = </etc/letsencrypt/live/${domain}/privkey.pem
`;
    
    await ssh.execCommand(`echo '${dovecotConfig}' > /etc/dovecot/dovecot.conf`);
    
    // Создание пользователя для почты
    await ssh.execCommand(`useradd -m -s /bin/bash ${adminEmail.split('@')[0]}`);
    await ssh.execCommand(`echo '${adminEmail.split('@')[0]}:${adminPassword}' | chpasswd`);
    
    // Настройка Roundcube если включен
    if (config.enableWebmail) {
      const roundcubeConfig = `
server {
    listen 80;
    server_name ${mailDomain};
    
    location / {
        proxy_pass http://localhost/roundcube/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;
      
      await ssh.execCommand(`echo '${roundcubeConfig}' > /etc/nginx/sites-available/${mailDomain}`);
      await ssh.execCommand(`ln -sf /etc/nginx/sites-available/${mailDomain} /etc/nginx/sites-enabled/`);
    }
    
    // Получение SSL для почтового домена
    await ssh.execCommand(`certbot --nginx -d ${mailDomain} --non-interactive --agree-tos --email ${adminEmail}`);
    
    // Запуск сервисов
    await ssh.execCommand('systemctl enable postfix dovecot');
    await ssh.execCommand('systemctl restart postfix dovecot nginx');
    
    // Создание DNS записей
    const dnsRecords = `
# Добавьте эти DNS записи в ваш домен:
# MX запись: ${domain} -> ${mailDomain} (приоритет 10)
# A запись: ${mailDomain} -> IP вашего сервера
# SPF запись: v=spf1 mx a ip4:IP_СЕРВЕРА ~all
# DKIM запись: (будет создан автоматически)
`;
    
    console.log('DNS записи для настройки:', dnsRecords);
  }

  /**
   * Получение кода агента для установки
   */
  getAgentCode() {
    return `
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { NodeSSH } = require('node-ssh');

const app = express();
const PORT = 12345;

// Middleware
app.use(cors());
app.use(express.json());

// Состояние туннеля
let tunnelState = {
  connected: false,
  domain: null,
  tunnelId: null,
  sshProcess: null
};

// Здоровье агента
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Создание туннеля
app.post('/tunnel/create', async (req, res) => {
  try {
    const { domain, email, sshHost, sshUser, sshKey, localPort, serverPort, sshPort } = req.body;
    
          // console.log('Создание туннеля для домена:', domain);
    
    // Сохраняем SSH ключ во временный файл
    const keyPath = path.join(__dirname, 'temp_ssh_key');
    fs.writeFileSync(keyPath, sshKey, { mode: 0o600 });
    
    // Подключаемся к серверу и настраиваем NGINX
    const ssh = new NodeSSH();
    await ssh.connect({
      host: sshHost,
      username: sshUser,
      privateKey: sshKey,
      port: sshPort
    });
    
    // Установка NGINX, certbot и почтовых сервисов
    const installPackages = 'apt-get update && apt-get install -y nginx certbot python3-certbot-nginx';
    const mailPackages = config.enableMail ? 'postfix dovecot-core dovecot-imapd dovecot-pop3d dovecot-lmtpd dovecot-managesieved dovecot-sieve dovecot-mysql mysql-server roundcube roundcube-mysql' : '';
    await ssh.execCommand(\`\${installPackages} \${mailPackages}\`);
    
    // Создание конфигурации NGINX с полной защитой
    const nginxConfig = \`# Rate limiting для защиты от DDoS (отключено - лимиты убраны)
# limit_req_zone $binary_remote_addr zone=req_limit_per_ip:10m rate=10r/s;
# limit_req_zone $binary_remote_addr zone=api_limit_per_ip:10m rate=50r/s;

# Блокировка известных сканеров и вредоносных ботов (исключая легитимные поисковые боты)
map $http_user_agent $bad_bot {
    default 0;
    # Разрешаем легитимные поисковые боты
    ~*googlebot 0;
    ~*bingbot 0;
    ~*slurp 0;
    ~*duckduckbot 0;
    ~*baiduspider 0;
    ~*yandex 0;
    ~*sogou 0;
    ~*exabot 0;
    ~*facebot 0;
    ~*ia_archiver 0;
    # Блокируем вредоносные боты и сканеры
    ~*sqlmap 1;
    ~*nikto 1;
    ~*dirb 1;
    ~*gobuster 1;
    ~*wfuzz 1;
    ~*burp 1;
    ~*zap 1;
    ~*nessus 1;
    ~*openvas 1;
    ~*masscan 1;
    ~*nmap 1;
    ~*scanner 1;
}

server {
    listen 80;
    server_name \${domain};
    
    # Блокировка подозрительных ботов
    if ($bad_bot = 1) {
        return 403;
    }
    
    # Защита от path traversal
    if ($request_uri ~* "(\\\\.\\\\.|\\\\.\\\\./|\\\\.\\\\.\\\\.\\\\|\\\\.\\\\.%2f|\\\\.\\\\.%5c)") {
        return 404;
    }
    
    # Защита от опасных расширений
    location ~* \\\\.(zip|rar|7z|tar|gz|bz2|xz|sql|sqlite|db|bak|backup|old|csv|php|asp|aspx|jsp|cgi|pl|py|sh|bash|exe|bat|cmd|com|pif|scr|vbs|vbe|jar|war|ear|dll|so|dylib|bin|sys|ini|log|tmp|temp|swp|swo|~)$ {
        return 404;
    }
    
    # Защита от доступа к чувствительным файлам (исключаем robots.txt и sitemap.xml для SEO)
    location ~* /(\\\\.htaccess|\\\\.htpasswd|\\\\.env|\\\\.git|\\\\.svn|\\\\.DS_Store|Thumbs\\\\.db|web\\\\.config)$ {
        deny all;
        return 404;
    }
    
    # Разрешаем доступ к robots.txt и sitemap.xml для поисковых систем
    location = /robots.txt {
        proxy_pass http://localhost:8000/api/pages/public/robots.txt;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        add_header Content-Type text/plain;
    }
    
    location = /sitemap.xml {
        proxy_pass http://localhost:8000/api/pages/public/sitemap.xml;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        add_header Content-Type application/xml;
    }
    
    # Основной location для фронтенда
    location / {
        # Rate limiting для основных страниц (отключено)
        # limit_req zone=req_limit_per_ip burst=20 nodelay;
        
        proxy_pass http://localhost:\${serverPort};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Базовые заголовки безопасности
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ws: wss:;" always;
        add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    }
    
    # API проксирование к backend через туннель
    location /api/ {
        # Rate limiting для API (отключено)
        # limit_req zone=api_limit_per_ip burst=100 nodelay;
        
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Заголовки безопасности для API
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }
    
    # WebSocket поддержка
    location /ws {
        proxy_pass http://localhost:8000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Скрытие информации о сервере
    server_tokens off;
}\`;
    
    await ssh.execCommand(\`echo '\${nginxConfig}' > /etc/nginx/sites-available/\${domain}\`);
    await ssh.execCommand(\`ln -sf /etc/nginx/sites-available/\${domain} /etc/nginx/sites-enabled/\`);
    await ssh.execCommand('nginx -t && systemctl reload nginx');
    
    // Получение SSL сертификата
    await ssh.execCommand(\`certbot --nginx -d \${domain} --non-interactive --agree-tos --email \${email}\`);
    
    // Настройка почты если включена
    if (config.enableMail) {
      await setupMailServer(ssh, config, domain);
    }
    
    ssh.dispose();
    
    // Создание SSH туннелей для frontend и backend
    const tunnelId = Date.now().toString();
    
    // SSH туннель для frontend (порт 9000)
    const frontendSshArgs = [
      '-i', keyPath,
      '-p', sshPort.toString(),
      '-R', \`\${serverPort}:localhost:\${localPort}\`,
      '-N',
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'ServerAliveInterval=60',
      '-o', 'ServerAliveCountMax=3',
      \`\${sshUser}@\${sshHost}\`
    ];
    
    // SSH туннель для backend (порт 8000)
    const backendSshArgs = [
      '-i', keyPath,
      '-p', sshPort.toString(),
      '-R', '8000:localhost:8000',
      '-N',
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'ServerAliveInterval=60',
      '-o', 'ServerAliveCountMax=3',
      \`\${sshUser}@\${sshHost}\`
    ];
    
    // Запускаем оба SSH туннеля
    const frontendSshProcess = spawn('ssh', frontendSshArgs);
    const backendSshProcess = spawn('ssh', backendSshArgs);
    
    frontendSshProcess.on('error', (error) => {
              // console.error('Frontend SSH процесс ошибка:', error);
    });
    
    backendSshProcess.on('error', (error) => {
              // console.error('Backend SSH процесс ошибка:', error);
    });
    
    frontendSshProcess.on('close', (code) => {
              // console.log('Frontend SSH процесс завершен с кодом:', code);
      tunnelState.connected = false;
    });
    
    backendSshProcess.on('close', (code) => {
              // console.log('Backend SSH процесс завершен с кодом:', code);
      tunnelState.connected = false;
    });
    
    // Обновляем состояние
    tunnelState = {
      connected: true,
      domain,
      tunnelId,
      frontendSshProcess,
      backendSshProcess
    };
    
    res.json({
      success: true,
      message: 'Туннель успешно создан',
      tunnelId,
      domain
    });
    
  } catch (error) {
            // console.error('Ошибка создания туннеля:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Отключение туннелей
app.post('/tunnel/disconnect', (req, res) => {
  try {
    if (tunnelState.frontendSshProcess) {
      tunnelState.frontendSshProcess.kill();
    }
    if (tunnelState.backendSshProcess) {
      tunnelState.backendSshProcess.kill();
    }
    
    tunnelState = {
      connected: false,
      domain: null,
      tunnelId: null,
      frontendSshProcess: null,
      backendSshProcess: null
    };
    
    res.json({
      success: true,
      message: 'Туннель отключен'
    });
  } catch (error) {
            // console.error('Ошибка отключения туннеля:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Статус туннеля
app.get('/tunnel/status', (req, res) => {
  res.json({
    connected: tunnelState.connected,
    domain: tunnelState.domain,
    tunnelId: tunnelState.tunnelId
  });
});

// Запуск сервера
app.listen(PORT, 'localhost', () => {
  // console.log(\`WebSSH Agent запущен на порту \${PORT}\`);
});
`;
  }
}

// Создаем композабл для использования в компонентах
export function useWebSshService() {
  const service = new WebSshService();
  
  return {
    checkAgentStatus: () => service.checkAgentStatus(),
    installAndStartAgent: () => service.installAndStartAgent(),
    setupVDS: (config) => service.setupVDS(config)
  };
}

export default WebSshService; 