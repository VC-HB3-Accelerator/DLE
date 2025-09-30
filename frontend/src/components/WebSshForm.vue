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
  <div>
    <!-- Статус подключения -->
    <div class="connection-status">
      <div class="status-indicator" :class="{ 'active': isConnected, 'inactive': !isConnected }"></div>
      <span class="status-text">{{ connectionStatus }}</span>
      <button v-if="isConnected" @click="disconnectTunnel" class="disconnect-btn">Отключить</button>
    </div>
    <!-- Форма настроек -->
    <form @submit.prevent="handleSubmit" class="tunnel-form">
      <div class="form-section">
        <h3>Настройки VDS</h3>
        <div class="form-group">
          <label for="vdsIp">IP адрес VDS сервера *</label>
          <input id="vdsIp" v-model="form.vdsIp" type="text" placeholder="192.168.1.100" required :disabled="isConnected" />
        </div>
        <div class="form-group">
          <label for="domain">Домен *</label>
          <input id="domain" v-model="form.domain" type="text" placeholder="example.com" required :disabled="isConnected" />
          <small class="form-help">Домен должен указывать на IP VDS сервера (A запись)</small>
        </div>
        <div class="form-group">
          <label for="email">Email для SSL *</label>
          <input id="email" v-model="form.email" type="email" placeholder="admin@example.com" required :disabled="isConnected" />
        </div>
        <div class="form-group">
          <label for="ubuntuUser">Логин Ubuntu *</label>
          <input id="ubuntuUser" v-model="form.ubuntuUser" type="text" placeholder="ubuntu" required :disabled="isConnected" />
        </div>
        <div class="form-group">
          <label for="ubuntuPassword">Пароль Ubuntu *</label>
          <input id="ubuntuPassword" v-model="form.ubuntuPassword" type="password" placeholder="Введите пароль" required :disabled="isConnected" />
        </div>
        <div class="form-group">
          <label for="dockerUser">Логин Docker *</label>
          <input id="dockerUser" v-model="form.dockerUser" type="text" placeholder="docker" required :disabled="isConnected" />
        </div>
        <div class="form-group">
          <label for="dockerPassword">Пароль Docker *</label>
          <input id="dockerPassword" v-model="form.dockerPassword" type="password" placeholder="Введите пароль" required :disabled="isConnected" />
        </div>
      </div>
      <div class="form-section">
        <h3>Настройки SSH сервера</h3>
        <div class="form-group">
          <label for="sshUser">SSH Пользователь *</label>
          <input id="sshUser" v-model="form.sshUser" type="text" placeholder="root" required :disabled="isConnected" />
        </div>
        <div class="form-group">
          <label for="sshKey">SSH Приватный ключ *</label>
          <div class="key-container">
            <textarea id="sshKey" v-model="form.sshKey" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----" rows="6" required :disabled="isConnected" :type="showSshKey ? 'text' : 'password'"></textarea>
            <button type="button" @click="toggleSshKey" class="toggle-key-btn" :disabled="isConnected">
              {{ showSshKey ? 'Скрыть' : 'Показать' }}
            </button>
          </div>
        </div>
        <div class="form-group">
          <label for="encryptionKey">Ключ шифрования *</label>
          <div class="encryption-key-container">
            <textarea id="encryptionKey" v-model="form.encryptionKey" placeholder="Ключ шифрования будет загружен автоматически..." rows="4" required :disabled="isConnected" :type="showEncryptionKey ? 'text' : 'password'"></textarea>
            <button type="button" @click="toggleEncryptionKey" class="toggle-key-btn" :disabled="isConnected">
              {{ showEncryptionKey ? 'Скрыть' : 'Показать' }}
            </button>
          </div>
        </div>
      </div>
      <div class="form-section advanced-section">
        <h3>Дополнительные настройки</h3>
        <div class="form-row">
          <div class="form-group">
            <label for="localPort">Локальный порт</label>
            <input id="localPort" v-model="form.localPort" type="number" min="1" max="65535" :disabled="isConnected" />
          </div>
          <div class="form-group">
            <label for="serverPort">Порт сервера</label>
            <input id="serverPort" v-model="form.serverPort" type="number" min="1" max="65535" :disabled="isConnected" />
          </div>
          <div class="form-group">
            <label for="sshPort">SSH порт</label>
            <input id="sshPort" v-model="form.sshPort" type="number" min="1" max="65535" :disabled="isConnected" />
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button type="submit" :disabled="isLoading || isConnected" class="publish-btn">
          {{ isLoading ? 'Настройка...' : 'Опубликовать' }}
        </button>
        <button type="button" @click="resetForm" :disabled="isLoading || isConnected" class="reset-btn">Сбросить</button>
      </div>
    </form>
    <!-- Лог операций -->
    <div class="operation-log" v-if="logs.length > 0">
      <h3>Лог операций</h3>
      <div class="log-container">
        <div v-for="(log, index) in logs" :key="index" class="log-entry" :class="log.type">
          <span class="log-time">{{ formatTime(log.timestamp) }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useWebSshService } from '../services/webSshService';
const webSshService = useWebSshService();
const isLoading = ref(false);
const isConnected = ref(false);
const connectionStatus = ref('Не подключено');
const logs = ref([]);
const showSshKey = ref(false);
const showEncryptionKey = ref(false);
const form = reactive({
  vdsIp: '',
  domain: '',
  email: '',
  ubuntuUser: 'ubuntu',
  ubuntuPassword: '',
  dockerUser: 'docker',
  dockerPassword: '',
  sshUser: '',
  sshKey: '',
  encryptionKey: '',
  localPort: 5173,
  serverPort: 9000,
  sshPort: 22
});

// Автоматически загружаем SSH ключ и ключ шифрования при загрузке компонента
onMounted(async () => {
  try {
    // Пытаемся получить SSH ключ с хостового сервера
    const response = await fetch('http://localhost:3001/ssh-key');
    if (response.ok) {
      const data = await response.json();
      if (data.sshKey) {
        form.sshKey = data.sshKey;
        addLog('info', 'SSH ключ автоматически загружен');
      } else {
        addLog('error', 'SSH ключ не найден. Запустите ./setup.sh для создания ключей');
      }
    } else {
      addLog('error', 'SSH ключ не найден. Запустите ./setup.sh для создания ключей');
    }
  } catch (error) {
    addLog('error', 'SSH ключ не найден. Запустите ./setup.sh для создания ключей');
  }

  // Загружаем ключ шифрования
  try {
    const response = await fetch('http://localhost:3001/encryption-key');
    if (response.ok) {
      const data = await response.json();
      if (data.encryptionKey) {
        form.encryptionKey = data.encryptionKey;
        addLog('info', 'Ключ шифрования автоматически загружен');
      } else {
        addLog('error', 'Ключ шифрования не найден');
      }
    } else {
      addLog('error', 'Ключ шифрования не найден');
    }
  } catch (error) {
    addLog('error', 'Ошибка загрузки ключа шифрования');
  }
});

function validatePrivateKey(key) {
  if (!key) return false;
  const trimmed = key.trim();
  if (!trimmed.startsWith('-----BEGIN OPENSSH PRIVATE KEY-----')) return false;
  if (!trimmed.endsWith('-----END OPENSSH PRIVATE KEY-----')) return false;
  if (trimmed.split('\n').length < 3) return false;
  return true;
}
const handleSubmit = async () => {
  if (!validateForm()) return;
  if (!validatePrivateKey(form.sshKey)) {
    addLog('error', 'Проверьте формат приватного ключа!');
    return;
  }
  isLoading.value = true;
  addLog('info', 'Запуск публикации...');
  try {
    const result = await webSshService.createTunnel(form);
    if (result.success) {
      isConnected.value = true;
      connectionStatus.value = `Подключено к ${form.domain}`;
      addLog('success', 'SSH туннель успешно создан и настроен');
      addLog('info', `Ваше приложение доступно по адресу: https://${form.domain}`);
      
      // Сохраняем статус VDS как настроенного
      localStorage.setItem('vds-config', JSON.stringify({ isConfigured: true }));
      
      // Отправляем событие об изменении статуса VDS
      window.dispatchEvent(new CustomEvent('vds-status-changed', {
        detail: { isConfigured: true }
      }));
    } else {
      addLog('error', result.message || 'Ошибка при создании туннеля');
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
  if (!form.vdsIp || !form.domain || !form.email || !form.ubuntuUser || !form.ubuntuPassword || !form.dockerUser || !form.dockerPassword || !form.sshUser || !form.sshKey || !form.encryptionKey) {
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
    vdsIp: '',
    domain: '',
    email: '',
    ubuntuUser: 'ubuntu',
    ubuntuPassword: '',
    dockerUser: 'docker',
    dockerPassword: '',
    sshUser: '',
    sshKey: '',
    encryptionKey: '',
    localPort: 5173,
    serverPort: 9000,
    sshPort: 22
  });
  logs.value = [];
  showSshKey.value = false;
  showEncryptionKey.value = false;
};
const addLog = (type, message) => {
  logs.value.push({
    type,
    message,
    timestamp: new Date()
  });
};

// Методы для переключения видимости ключей
const toggleSshKey = () => {
  showSshKey.value = !showSshKey.value;
};

const toggleEncryptionKey = () => {
  showEncryptionKey.value = !showEncryptionKey.value;
};
const formatTime = (timestamp) => {
  return timestamp.toLocaleTimeString();
};
</script>

<style scoped>
/* Статус подключения */
.connection-status {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  transition: background-color 0.3s ease;
}

.status-indicator.active {
  background-color: #28a745;
  box-shadow: 0 0 8px rgba(40, 167, 69, 0.3);
}

.status-indicator.inactive {
  background-color: #dc3545;
}

.status-text {
  font-weight: 600;
  color: #333;
}

.disconnect-btn {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.disconnect-btn:hover {
  background: #c82333;
}

/* Форма */
.tunnel-form {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.form-section {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.form-section h3 {
  margin: 0 0 1.5rem 0;
  color: var(--color-primary);
  font-size: 1.25rem;
  font-weight: 600;
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 0.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #333;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: white;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.form-group input:disabled,
.form-group textarea:disabled {
  background: #f8f9fa;
  color: #6c757d;
  cursor: not-allowed;
}

.form-group textarea {
  resize: vertical;
  min-height: 120px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
}

/* Дополнительные настройки */
.advanced-section {
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

/* Кнопки */
.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-start;
  margin-top: 1rem;
}

.publish-btn {
  background: linear-gradient(135deg, var(--color-primary), #20c997);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 140px;
}

.publish-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #0056b3, #1ea085);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
}

.publish-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.reset-btn {
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.reset-btn:hover:not(:disabled) {
  background: #5a6268;
  transform: translateY(-1px);
}

.reset-btn:disabled {
  background: #adb5bd;
  cursor: not-allowed;
  transform: none;
}

/* Лог операций */
.operation-log {
  margin-top: 2rem;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.operation-log h3 {
  margin: 0 0 1rem 0;
  color: var(--color-primary);
  font-size: 1.25rem;
  font-weight: 600;
}

.log-container {
  max-height: 300px;
  overflow-y: auto;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
}

.log-entry {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e9ecef;
  font-size: 0.9rem;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  color: #6c757d;
  font-weight: 600;
  min-width: 80px;
  flex-shrink: 0;
}

.log-message {
  flex: 1;
}

.log-entry.success .log-message {
  color: #28a745;
  font-weight: 600;
}

.log-entry.error .log-message {
  color: #dc3545;
  font-weight: 600;
}

.log-entry.info .log-message {
  color: #17a2b8;
  font-weight: 600;
}

/* Стили для контейнера ключа шифрования */
.encryption-key-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}


/* Адаптивность */
@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .publish-btn,
  .reset-btn {
    width: 100%;
  }
  
  .connection-status {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
}

/* Маскировка приватных ключей */
textarea[type="password"] {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.2;
  letter-spacing: 0.5px;
  color: transparent;
  text-shadow: 0 0 8px #000;
  background: repeating-linear-gradient(
    0deg,
    #333 0px,
    #333 1px,
    #444 1px,
    #444 2px
  );
  border: 1px solid #555;
}

textarea[type="password"]:focus {
  color: transparent;
  text-shadow: 0 0 8px #000;
  background: repeating-linear-gradient(
    0deg,
    #333 0px,
    #333 1px,
    #444 1px,
    #444 2px
  );
}

/* Показывать содержимое при фокусе для редактирования */
textarea[type="password"]:focus::placeholder {
  color: #666;
  text-shadow: none;
}

/* Контейнеры для ключей */
.key-container {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toggle-key-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  cursor: pointer;
  margin-top: 0.5rem;
  align-self: flex-start;
}

.toggle-key-btn:hover {
  background: #0056b3;
}

.toggle-key-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}
</style> 