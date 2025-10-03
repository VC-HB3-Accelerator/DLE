<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

<template>
  <div class="web-ssh-settings">
    <div class="settings-header">
      <h2>WEB SSH Туннель</h2>
      <p>Автоматическая публикация локального приложения в интернете через SSH-туннель и NGINX</p>
    </div>

    <div v-if="!agentAvailable" class="agent-instruction-block">
      <h3>Установка локального агента</h3>
      <ol>
        <li>
          <b>Windows:</b><br>
          Откройте <b>PowerShell</b> или <b>Командную строку</b> и выполните:
          <div class="copy-block" @click="copyToClipboard('wsl')">
            <pre><code>wsl</code></pre>
            <span class="copy-icon">
              <svg v-if="!copied" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="5" y="7" width="9" height="9" rx="2" stroke="#888" stroke-width="1.5"/><rect x="7" y="4" width="9" height="9" rx="2" stroke="#888" stroke-width="1.5"/></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 11.5L9 15L15 7" stroke="#27ae60" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </div>
          Затем в открывшемся терминале WSL выполните:
          <div class="copy-block" @click="copyToClipboard('cd ~/Digital_Legal_Entity(DLE)\nsudo bash webssh-agent/install.sh')">
            <pre><code>cd ~/Digital_Legal_Entity(DLE)
sudo bash webssh-agent/install.sh</code></pre>
            <span class="copy-icon">
              <svg v-if="!copied" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="5" y="7" width="9" height="9" rx="2" stroke="#888" stroke-width="1.5"/><rect x="7" y="4" width="9" height="9" rx="2" stroke="#888" stroke-width="1.5"/></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 11.5L9 15L15 7" stroke="#27ae60" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </div>
        </li>
        <li>
          <b>Linux:</b><br>
          Откройте терминал и выполните:
          <div class="copy-block" @click="copyToClipboard('cd ~/Digital_Legal_Entity(DLE)\nsudo bash webssh-agent/install.sh')">
            <pre><code>cd ~/Digital_Legal_Entity(DLE)
sudo bash webssh-agent/install.sh</code></pre>
            <span class="copy-icon">
              <svg v-if="!copied" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="5" y="7" width="9" height="9" rx="2" stroke="#888" stroke-width="1.5"/><rect x="7" y="4" width="9" height="9" rx="2" stroke="#888" stroke-width="1.5"/></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 11.5L9 15L15 7" stroke="#27ae60" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </div>
        </li>
      </ol>
      <button @click="checkAgent" class="check-btn">Проверить</button>
      <div v-if="copied" class="copied-indicator">Скопировано!</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useWebSshService } from '../../services/webSshService';

const router = useRouter();

const webSshService = useWebSshService();
const agentAvailable = ref(false);

// Реактивные данные
const isLoading = ref(false);
const isConnected = ref(false);
const connectionStatus = ref('Не подключено');
const logs = ref([]);

// Форма
const form = reactive({
  domain: '',
  email: '',
  sshHost: '',
  sshUser: '',
  sshKey: '',
  localPort: 5173,
  serverPort: 9000,
  sshPort: 22
});

const copied = ref(false);
let copyTimeout = null;

function copyToClipboard(text) {
  navigator.clipboard.writeText(text.replace(/\\n/g, '\n')).then(() => {
    copied.value = true;
    clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => copied.value = false, 1200);
  });
}

function validatePrivateKey(key) {
  if (!key) return false;
  const trimmed = key.trim();
  if (!trimmed.startsWith('-----BEGIN OPENSSH PRIVATE KEY-----')) {
    // console.error('Ключ не начинается с -----BEGIN OPENSSH PRIVATE KEY-----');
    return false;
  }
  if (!trimmed.endsWith('-----END OPENSSH PRIVATE KEY-----')) {
    // console.error('Ключ не заканчивается на -----END OPENSSH PRIVATE KEY-----');
    return false;
  }
  if (trimmed.split('\n').length < 3) {
    // console.error('Ключ слишком короткий или не содержит переносов строк');
    return false;
  }
  return true;
}

// Методы
const handleSubmit = async () => {
  if (!validateForm()) return;

  // Дополнительная валидация приватного ключа
  if (!validatePrivateKey(form.sshKey)) {
    addLog('error', 'Проверьте формат приватного ключа!');
    return;
  }

  // Логирование ключа (только для отладки!)
  // console.log('SSH ключ (начало):', form.sshKey.slice(0, 40));
  // console.log('SSH ключ (конец):', form.sshKey.slice(-40));
  // console.log('Длина ключа:', form.sshKey.length);

  // Логирование отправляемых данных (без самого ключа)
  // console.log('Данные для агента:', {
  //   ...form,
  //   sshKey: form.sshKey ? `[скрыто, длина: ${form.sshKey.length}]` : 'нет ключа'
  // });

  isLoading.value = true;
  addLog('info', 'Запуск публикации...');
  try {
    // Публикация через агента
    const result = await webSshService.setupVDS(form);
    if (result.success) {
      isConnected.value = true;
      connectionStatus.value = `Подключено к ${form.domain}`;
      addLog('success', 'VDS успешно настроена');
      addLog('info', `Ваше приложение будет доступно по адресу: https://${form.domain}`);
      
      // Перенаправляем на страницу VDS Mock через 3 секунды
      addLog('info', 'Перенаправление на страницу управления VDS через 3 секунды...');
      setTimeout(() => {
        router.push({ name: 'vds-mock' });
      }, 3000);
    } else {
      addLog('error', result.message || 'Ошибка при настройке VDS');
    }
  } catch (error) {
    addLog('error', `Ошибка: ${error.message}`);
  } finally {
    isLoading.value = false;
  }
};

const disconnectTunnel = async () => {
  isLoading.value = true;
  addLog('info', 'Отключаю SSH туннель...');

  try {
    const result = await webSshService.disconnectTunnel();
    
    if (result.success) {
      isConnected.value = false;
      connectionStatus.value = 'Не подключено';
      addLog('success', 'SSH туннель отключен');
    } else {
      addLog('error', result.message || 'Ошибка при отключении туннеля');
    }
  } catch (error) {
    addLog('error', `Ошибка: ${error.message}`);
  } finally {
    isLoading.value = false;
  }
};

const validateForm = () => {
  if (!form.domain || !form.email || !form.sshHost || !form.sshUser || !form.sshKey) {
    addLog('error', 'Заполните все обязательные поля');
    return false;
  }
  
  if (!form.email.includes('@')) {
    addLog('error', 'Введите корректный email');
    return false;
  }
  
  if (!form.sshKey.includes('-----BEGIN') || !form.sshKey.includes('-----END')) {
    addLog('error', 'SSH ключ должен быть в формате OpenSSH');
    return false;
  }
  
  return true;
};

const resetForm = () => {
  Object.assign(form, {
    domain: '',
    email: '',
    sshHost: '',
    sshUser: '',
    sshKey: '',
    localPort: 5173,
    serverPort: 9000,
    sshPort: 22
  });
  logs.value = [];
};

const addLog = (type, message) => {
  logs.value.push({
    type,
    message,
    timestamp: new Date()
  });
};

const formatTime = (timestamp) => {
  return timestamp.toLocaleTimeString();
};

const checkConnectionStatus = async () => {
  try {
    const status = await webSshService.getStatus();
    isConnected.value = status.connected;
    connectionStatus.value = status.connected 
      ? `Подключено к ${status.domain}` 
      : 'Не подключено';
  } catch (error) {
    // console.error('Ошибка проверки статуса:', error);
  }
};

const checkAgent = async () => {
  const status = await webSshService.checkAgentStatus();
  agentAvailable.value = status.running;
};

// Жизненный цикл
onMounted(() => {
  checkAgent();
  checkConnectionStatus();
  
  // Проверяем статус каждые 30 секунд
  const interval = setInterval(checkConnectionStatus, 30000);
  
  onUnmounted(() => {
    clearInterval(interval);
  });
});
</script>

<style scoped>
.web-ssh-settings {
  max-width: 800px;
  margin: 0 auto;
}

.settings-header {
  margin-bottom: 2rem;
}

.settings-header h2 {
  color: var(--color-primary);
  margin-bottom: 0.5rem;
}

.settings-header p {
  color: var(--color-text-secondary);
  font-size: 0.95rem;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--color-background);
  border-radius: 8px;
  margin-bottom: 2rem;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  transition: background-color 0.3s;
}

.status-indicator.active {
  background-color: var(--color-success);
}

.status-indicator.inactive {
  background-color: var(--color-text-secondary);
}

.status-text {
  font-weight: 500;
  flex: 1;
}

.disconnect-btn {
  background: var(--color-danger);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.disconnect-btn:hover {
  background: var(--color-danger-dark);
}

.tunnel-form {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  padding: 2rem;
  margin-bottom: 2rem;
}

.form-section {
  margin-bottom: 2rem;
}

.form-section h3 {
  color: var(--color-primary);
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--color-text);
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-group input:disabled,
.form-group textarea:disabled {
  background-color: var(--color-background);
  cursor: not-allowed;
}

.form-group textarea {
  resize: vertical;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
}

.advanced-section {
  border-top: 1px solid var(--color-border);
  padding-top: 2rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
}

.publish-btn {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: background-color 0.2s;
}

.publish-btn:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.publish-btn:disabled {
  background: var(--color-text-secondary);
  cursor: not-allowed;
}

.reset-btn {
  background: var(--color-background);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  padding: 0.75rem 2rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;
}

.reset-btn:hover:not(:disabled) {
  background: var(--color-border);
}

.reset-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.operation-log {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  padding: 2rem;
}

.operation-log h3 {
  color: var(--color-primary);
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

.log-container {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 1rem;
  background: var(--color-background);
}

.log-entry {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.log-entry:last-child {
  margin-bottom: 0;
}

.log-time {
  color: var(--color-text-secondary);
  font-family: 'Courier New', monospace;
  min-width: 80px;
}

.log-message {
  flex: 1;
}

.log-entry.info .log-message {
  color: var(--color-text);
}

.log-entry.success .log-message {
  color: var(--color-success);
}

.log-entry.error .log-message {
  color: var(--color-danger);
}

/* Адаптивный дизайн */
@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .connection-status {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}

.agent-instruction-block {
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 8px;
  padding: 1.5rem 2rem;
  margin-bottom: 2rem;
  text-align: left;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.check-btn {
  margin-top: 1rem;
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 0.5rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
}

pre {
  background: #f5f5f5;
  border-radius: 4px;
  padding: 0.5em 1em;
  margin: 0.5em 0;
  font-size: 1em;
  user-select: all;
  white-space: pre-line;
}

.copy-block {
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-bottom: 0.5em;
}
.copy-icon {
  margin-left: 0.5em;
  font-size: 1.2em;
  color: #888;
  transition: color 0.2s;
  display: flex;
  align-items: center;
}
.copy-block:hover .copy-icon svg {
  stroke: var(--color-primary);
}
.copied-indicator {
  color: var(--color-success, #27ae60);
  font-weight: 500;
  margin-top: 0.5em;
  text-align: right;
}
</style> 