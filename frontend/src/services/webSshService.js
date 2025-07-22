/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/HB3-ACCELERATOR
 */

/**
 * Сервис для управления WEB SSH туннелем
 * Взаимодействует с локальным агентом на порту 12345
 */

const LOCAL_AGENT_URL = 'http://localhost:12345';

class WebSshService {
  constructor() {
    this.isAgentRunning = false;
    this.connectionStatus = {
      connected: false,
      domain: null,
      tunnelId: null
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
      console.error('Агент не доступен:', error);
      this.isAgentRunning = false;
      return { running: false, error: error.message };
    }
  }

  /**
   * Автоматическая установка и запуск агента
   */
  async installAndStartAgent() {
    try {
      // Сначала проверяем, может агент уже запущен
      const status = await this.checkAgentStatus();
      if (status.running) {
        return { success: true, message: 'Агент уже запущен' };
      }

      // Пытаемся запустить агент через системный вызов
      const response = await fetch(`${LOCAL_AGENT_URL}/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'install_and_start'
        })
      });

      if (response.ok) {
        const result = await response.json();
        this.isAgentRunning = true;
        return { success: true, message: 'Агент успешно установлен и запущен' };
      } else {
        // Если агент не отвечает, пытаемся скачать и установить его
        return await this.downloadAndInstallAgent();
      }
    } catch (error) {
      console.error('Ошибка при установке агента:', error);
      return await this.downloadAndInstallAgent();
    }
  }

  /**
   * Скачивание и установка агента
   */
  async downloadAndInstallAgent() {
    try {
      // Создаем скрипт для скачивания и установки агента
      const installScript = `
        #!/bin/bash
        
        # Создаем директорию для агента
        mkdir -p ~/.webssh-agent
        cd ~/.webssh-agent
        
        # Скачиваем агент (пока создаем локально)
        cat > agent.js << 'EOF'
${this.getAgentCode()}
EOF
        
        # Скачиваем package.json
        cat > package.json << 'EOF'
{
  "name": "webssh-agent",
  "version": "1.0.0",
  "description": "Local SSH tunnel agent",
  "main": "agent.js",
  "scripts": {
    "start": "node agent.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "ssh2": "^1.14.0",
    "node-ssh": "^13.1.0"
  }
}
EOF
        
        # Устанавливаем зависимости
        npm install
        
        # Запускаем агент в фоне
        nohup node agent.js > agent.log 2>&1 &
        
        echo "Агент установлен и запущен"
      `;

      // Создаем Blob со скриптом
      const blob = new Blob([installScript], { type: 'application/x-sh' });
      const url = URL.createObjectURL(blob);
      
      // Создаем ссылку для скачивания
      const a = document.createElement('a');
      a.href = url;
      a.download = 'install-webssh-agent.sh';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return {
        success: false,
        message: 'Скачайте и запустите скрипт install-webssh-agent.sh для установки агента',
        requiresManualInstall: true
      };
    } catch (error) {
      console.error('Ошибка при создании установочного скрипта:', error);
      return {
        success: false,
        message: 'Ошибка при подготовке установки агента',
        error: error.message
      };
    }
  }

  /**
   * Создание SSH туннеля
   */
  async createTunnel(config) {
    try {
      // Проверяем, что агент запущен
      const agentStatus = await this.checkAgentStatus();
      if (!agentStatus.running) {
        // Пытаемся установить и запустить агент
        const installResult = await this.installAndStartAgent();
        if (!installResult.success) {
          return installResult;
        }
      }

      // Отправляем конфигурацию туннеля агенту
      const response = await fetch(`${LOCAL_AGENT_URL}/tunnel/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          domain: config.domain,
          email: config.email,
          sshHost: config.sshHost,
          sshUser: config.sshUser,
          sshKey: config.sshKey,
          localPort: config.localPort || 5173,
          serverPort: config.serverPort || 9000,
          sshPort: config.sshPort || 22
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          this.connectionStatus = {
            connected: true,
            domain: config.domain,
            tunnelId: result.tunnelId
          };
        }
        
        return result;
      } else {
        const error = await response.json();
        return {
          success: false,
          message: error.message || 'Ошибка при создании туннеля'
        };
      }
    } catch (error) {
      console.error('Ошибка при создании туннеля:', error);
      return {
        success: false,
        message: `Ошибка подключения к агенту: ${error.message}`
      };
    }
  }

  /**
   * Отключение туннеля
   */
  async disconnectTunnel() {
    try {
      const response = await fetch(`${LOCAL_AGENT_URL}/tunnel/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tunnelId: this.connectionStatus.tunnelId
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          this.connectionStatus = {
            connected: false,
            domain: null,
            tunnelId: null
          };
        }
        
        return result;
      } else {
        const error = await response.json();
        return {
          success: false,
          message: error.message || 'Ошибка при отключении туннеля'
        };
      }
    } catch (error) {
      console.error('Ошибка при отключении туннеля:', error);
      return {
        success: false,
        message: `Ошибка подключения к агенту: ${error.message}`
      };
    }
  }

  /**
   * Получение статуса подключения
   */
  async getStatus() {
    try {
      const response = await fetch(`${LOCAL_AGENT_URL}/tunnel/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        this.connectionStatus = result;
        return result;
      } else {
        return {
          connected: false,
          domain: null,
          tunnelId: null
        };
      }
    } catch (error) {
      console.error('Ошибка при получении статуса:', error);
      return {
        connected: false,
        domain: null,
        tunnelId: null
      };
    }
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
    
    console.log('Создание туннеля для домена:', domain);
    
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
    
    // Установка NGINX и certbot
    await ssh.execCommand('apt-get update && apt-get install -y nginx certbot python3-certbot-nginx');
    
    // Создание конфигурации NGINX
    const nginxConfig = \`
server {
    listen 80;
    server_name \${domain};
    
    location / {
        proxy_pass http://localhost:\${serverPort};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
\`;
    
    await ssh.execCommand(\`echo '\${nginxConfig}' > /etc/nginx/sites-available/\${domain}\`);
    await ssh.execCommand(\`ln -sf /etc/nginx/sites-available/\${domain} /etc/nginx/sites-enabled/\`);
    await ssh.execCommand('nginx -t && systemctl reload nginx');
    
    // Получение SSL сертификата
    await ssh.execCommand(\`certbot --nginx -d \${domain} --non-interactive --agree-tos --email \${email}\`);
    
    ssh.dispose();
    
    // Создание SSH туннеля
    const tunnelId = Date.now().toString();
    const sshArgs = [
      '-i', keyPath,
      '-p', sshPort.toString(),
      '-R', \`\${serverPort}:localhost:\${localPort}\`,
      '-N',
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      \`\${sshUser}@\${sshHost}\`
    ];
    
    const sshProcess = spawn('ssh', sshArgs);
    
    sshProcess.on('error', (error) => {
      console.error('SSH процесс ошибка:', error);
    });
    
    sshProcess.on('close', (code) => {
      console.log('SSH процесс завершен с кодом:', code);
      tunnelState.connected = false;
    });
    
    // Обновляем состояние
    tunnelState = {
      connected: true,
      domain,
      tunnelId,
      sshProcess
    };
    
    res.json({
      success: true,
      message: 'Туннель успешно создан',
      tunnelId,
      domain
    });
    
  } catch (error) {
    console.error('Ошибка создания туннеля:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Отключение туннеля
app.post('/tunnel/disconnect', (req, res) => {
  try {
    if (tunnelState.sshProcess) {
      tunnelState.sshProcess.kill();
    }
    
    tunnelState = {
      connected: false,
      domain: null,
      tunnelId: null,
      sshProcess: null
    };
    
    res.json({
      success: true,
      message: 'Туннель отключен'
    });
  } catch (error) {
    console.error('Ошибка отключения туннеля:', error);
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
  console.log(\`WebSSH Agent запущен на порту \${PORT}\`);
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
    createTunnel: (config) => service.createTunnel(config),
    disconnectTunnel: () => service.disconnectTunnel(),
    getStatus: () => service.getStatus()
  };
}

export default WebSshService; 