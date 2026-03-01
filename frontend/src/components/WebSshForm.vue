<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <div>
    <!-- Статус подключения -->
    <div class="connection-status">
      <div class="status-indicator" :class="{ 'active': isConnected, 'inactive': !isConnected }"></div>
      <span class="status-text">{{ connectionStatus }}</span>
      <button v-if="isConnected" @click="resetConnection" class="disconnect-btn">Сбросить статус</button>
    </div>
    <!-- Форма настроек -->
    <form @submit.prevent="handleSubmit" class="vds-form">
      <div class="form-section">
        <h3>Настройки VDS</h3>
        <div class="form-group">
          <label for="domain">Домен *</label>
          <input id="domain" v-model="form.domain" type="text" placeholder="example.com" required :disabled="isConnected" @blur="checkDomainDNS" />
          <small class="form-help">Домен должен указывать на IP VDS сервера (A запись). IP адрес будет определен автоматически.</small>
          <div v-if="domainStatus" class="domain-status" :class="domainStatus.type">
            {{ domainStatus.message }}
          </div>
        </div>
        <div class="form-group">
          <label for="email">Email для SSL *</label>
          <input id="email" v-model="form.email" type="email" placeholder="admin@example.com" required :disabled="isConnected" />
          <small class="form-help">Email для получения SSL сертификата от Let's Encrypt</small>
        </div>
        <div class="form-group">
          <label for="ubuntuUser">Логин Ubuntu *</label>
          <input id="ubuntuUser" v-model="form.ubuntuUser" type="text" placeholder="ubuntu" required :disabled="isConnected" />
          <small class="form-help">Обычно: ubuntu, root, или ваш пользователь на VDS</small>
        </div>
        <!-- Пароль Ubuntu убран - доступ только через SSH ключи -->
        <div class="form-group">
          <label for="dockerUser">Логин Docker *</label>
          <input id="dockerUser" v-model="form.dockerUser" type="text" placeholder="docker" required :disabled="isConnected" />
          <small class="form-help">Пользователь для Docker (будет создан автоматически)</small>
        </div>
        <!-- Пароль Docker убран - доступ только через SSH ключи -->
        
        <div class="security-notice">
          <h4>🔐 Безопасность</h4>
          <p>Пользователи Ubuntu и Docker будут созданы <strong>без паролей</strong>. Доступ будет осуществляться только через SSH ключи, что обеспечивает максимальную безопасность.</p>
        </div>
      </div>
      <div class="form-section">
        <h3>SSH подключение к VDS</h3>
        <div class="form-group">
          <label for="sshHost">SSH хост *</label>
          <input id="sshHost" v-model="form.sshHost" type="text" placeholder="" required :disabled="isConnected" />
          <small class="form-help">SSH хост сервера (может отличаться от домена)</small>
        </div>
        <div class="form-group">
          <label for="sshPort">SSH порт *</label>
          <input id="sshPort" v-model="form.sshPort" type="number" placeholder="" required :disabled="isConnected" />
          <small class="form-help">SSH порт сервера (обычно 22, но может быть другой)</small>
        </div>
        <div class="form-group">
          <label for="sshUser">SSH пользователь *</label>
          <input id="sshUser" v-model="form.sshUser" type="text" placeholder="" required :disabled="isConnected" />
          <small class="form-help">Пользователь для SSH подключения к VDS</small>
        </div>
        <div class="form-group">
          <label for="sshPassword">SSH пароль *</label>
          <input id="sshPassword" v-model="form.sshPassword" type="password" placeholder="" required :disabled="isConnected" />
          <small class="form-help">Пароль для SSH подключения к VDS</small>
        </div>
      </div>
      <!-- Ключ шифрования убран - будет генерироваться автоматически на VDS -->
      <div class="form-actions">
        <button type="submit" :disabled="isLoading || isConnected" class="publish-btn">
          {{ isLoading ? 'Настройка...' : 'Опубликовать' }}
        </button>
        <button type="button" @click="resetForm" :disabled="isLoading || isConnected" class="reset-btn">Сбросить</button>
      </div>
    </form>
    <!-- Real-time лог операций WebSSH -->
    <div class="operation-log">
      <div class="log-header">
        <h3>Real-time лог операций WebSSH</h3>
        <div class="log-controls">
          <button 
            @click="startListening" 
            :disabled="isListening" 
            class="control-btn start-btn"
            title="Начать прослушивание"
          >
            ▶️ Начать
          </button>
          <button 
            @click="stopListening" 
            :disabled="!isListening" 
            class="control-btn stop-btn"
            title="Остановить прослушивание"
          >
            ⏹️ Остановить
          </button>
          <button 
            @click="clearLogs" 
            class="control-btn clear-btn"
            title="Очистить логи"
          >
            🗑️ Очистить
          </button>
          <span class="connection-status" :class="{ connected: isConnected }">
            {{ isConnected ? '🟢 Подключено' : '🔴 Отключено' }}
          </span>
        </div>
      </div>
      
      <div class="log-container" ref="logContainer">
        <div v-if="logs.length === 0" class="no-logs">
          <p>Нет логов. Нажмите "Начать" для прослушивания real-time логов WebSSH агента.</p>
        </div>
        <div v-else>
          <div 
            v-for="log in logs" 
            :key="log.id" 
            class="log-entry" 
            :class="log.type"
          >
            <span class="log-icon">{{ getLogIcon(log.type) }}</span>
            <span class="log-time">{{ formatTime(log.timestamp) }}</span>
            <span class="log-message" v-html="log.message"></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useWebSshService } from '../services/webSshService';
import { useWebSshLogs } from '../composables/useWebSshLogs';
import axios from 'axios';

const router = useRouter();
const webSshService = useWebSshService();

const encodeDomainForRequest = (domain) => {
  if (!domain) return null;

  try {
    const normalized = domain.trim().toLowerCase();
    const url = new URL(`http://${normalized}`);
    return url.hostname;
  } catch (error) {
    console.warn('[WebSSH] Некорректное доменное имя:', domain, error.message);
    return null;
  }
};

// Используем композабл для real-time логов
const {
  logs,
  isConnected,
  isListening,
  addLog,
  startListening,
  stopListening,
  clearLogs,
  formatTime,
  getLogColor,
  getLogIcon
} = useWebSshLogs();

const isLoading = ref(false);
const connectionStatus = ref('Не подключено');
const showSshKey = ref(false);
const domainStatus = ref(null);
const form = reactive({
  domain: '',
  email: '',
  ubuntuUser: 'ubuntu',
  dockerUser: 'docker',
  sshHost: '',
  sshPort: '',
  sshUser: '',
  sshPassword: ''
});

// Ключ шифрования будет генерироваться автоматически на VDS
onMounted(async () => {
  // Инициализация компонента
});

// Функции переключения видимости ключей
const toggleSshKey = () => {
  showSshKey.value = !showSshKey.value;
};

// Функция переключения ключа шифрования убрана

// Функция проверки DNS для домена
const checkDomainDNS = async () => {
  if (!form.domain || form.domain.trim() === '') {
    domainStatus.value = null;
    return;
  }

  try {
    domainStatus.value = { type: 'loading', message: 'Проверка DNS...' };

    const asciiDomain = encodeDomainForRequest(form.domain);

    if (!asciiDomain) {
      domainStatus.value = {
        type: 'error',
        message: '❌ Некорректное доменное имя'
      };
      addLog('error', `DNS ошибка: Некорректное доменное имя (${form.domain})`);
      return;
    }

    const response = await fetch(`/api/dns-check/${encodeURIComponent(asciiDomain)}`);
    const data = await response.json();
    
    if (data.success) {
      domainStatus.value = { 
        type: 'success', 
        message: `✅ Домен найден: ${data.ip}` 
      };
      addLog('success', `DNS: ${form.domain} → ${data.ip}`);
    } else {
      domainStatus.value = { 
        type: 'error', 
        message: `❌ ${data.message}` 
      };
      addLog('error', `DNS ошибка: ${data.message}`);
    }
  } catch (error) {
    domainStatus.value = { 
      type: 'error', 
      message: `❌ Ошибка проверки DNS: ${error.message}` 
    };
    addLog('error', `DNS ошибка: ${error.message}`);
  }
};

const handleSubmit = async () => {
  if (!validateForm()) return;
  
  isLoading.value = true;

  try {
    // 1. Сначала всегда сохраняем настройки в БД
    addLog('info', 'Сохранение настроек VDS на сервере...');
    try {
      // axios.defaults.baseURL = '/api', поэтому используем относительный путь
      // чтобы итоговый URL был /api/vds/settings, а не /api/api/vds/settings
      const response = await axios.post('/vds/settings', {
        domain: form.domain,
        email: form.email,
        ubuntuUser: form.ubuntuUser,
        dockerUser: form.dockerUser,
        sshHost: form.sshHost,
        sshPort: parseInt(form.sshPort, 10) || 22, // Преобразуем в число
        sshUser: form.sshUser,
        sshPassword: form.sshPassword
      });
      
      if (response.data && response.data.success) {
        addLog('success', '✅ Настройки VDS сохранены в базе данных');
      } else {
        addLog('error', `❌ Ошибка сохранения настроек: ${response.data?.error || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('[WebSSH] Ошибка сохранения настроек:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Неизвестная ошибка';
      addLog('error', `❌ Ошибка сохранения настроек на сервере: ${errorMessage}`);
      // Даже если сохранение настроек упало, продолжаем попытку настройки VDS через агента
    }

    // 2. Затем запускаем настройку VDS через агента
    addLog('info', 'Запуск настройки VDS через WebSSH Agent...');
    const result = await webSshService.setupVDS(form);

    if (result.success) {
      isConnected.value = true;
      connectionStatus.value = `VDS настроен: ${form.domain}`;
      addLog('success', 'VDS успешно настроена');
      addLog('info', `Ваше приложение будет доступно по адресу: https://${form.domain}`);
      
      // Сохраняем статус VDS как настроенного локально
      localStorage.setItem('vds-config', JSON.stringify({ 
        isConfigured: true,
        domain: form.domain 
      }));
      
      // Отправляем событие об изменении статуса VDS
      window.dispatchEvent(new CustomEvent('vds-status-changed', {
        detail: { isConfigured: true }
      }));
      
      // Перенаправляем на страницу управления VDS через 3 секунды
      addLog('info', 'Перенаправление на страницу управления VDS через 3 секунды...');
      setTimeout(() => {
        router.push({ name: 'vds-management' });
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
const resetConnection = async () => {
  isLoading.value = true;
  addLog('info', 'Сброс статуса подключения...');
  try {
    isConnected.value = false;
    connectionStatus.value = 'Не подключено';
    addLog('success', 'Статус сброшен');
    
    // Очищаем статус VDS
    localStorage.removeItem('vds-config');
    
    // Отправляем событие об изменении статуса VDS
    window.dispatchEvent(new CustomEvent('vds-status-changed', {
      detail: { isConfigured: false }
    }));
  } catch (error) {
    addLog('error', `Ошибка: ${error.message}`);
  } finally {
    isLoading.value = false;
  }
};
const validateForm = () => {
  if (!form.domain || !form.email || !form.ubuntuUser || !form.dockerUser || !form.sshHost || !form.sshPort || !form.sshUser || !form.sshPassword) {
    addLog('error', 'Заполните все обязательные поля');
    return false;
  }
  const asciiDomain = encodeDomainForRequest(form.domain);
  if (!asciiDomain) {
    addLog('error', 'Введите корректный домен (например: example.com)');
    return false;
  }
  const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
  if (!domainRegex.test(asciiDomain)) {
    addLog('error', 'Введите корректный домен (например: example.com)');
    return false;
  }

  form.domain = asciiDomain;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(form.email)) {
    addLog('error', 'Введите корректный email адрес');
    return false;
  }

  if (form.ubuntuUser.length < 3 || form.ubuntuUser.length > 32) {
    addLog('error', 'Логин Ubuntu должен быть от 3 до 32 символов');
    return false;
  }
  if (!/^[a-z][a-z0-9_-]*$/.test(form.ubuntuUser)) {
    addLog('error', 'Логин Ubuntu должен начинаться с буквы и содержать только строчные буквы, цифры, _ и -');
    return false;
  }

  if (form.dockerUser.length < 3 || form.dockerUser.length > 32) {
    addLog('error', 'Логин Docker должен быть от 3 до 32 символов');
    return false;
  }
  if (!/^[a-z][a-z0-9_-]*$/.test(form.dockerUser)) {
    addLog('error', 'Логин Docker должен начинаться с буквы и содержать только строчные буквы, цифры, _ и -');
    return false;
  }

  return true;
};
const resetForm = () => {
  Object.assign(form, {
    domain: '',
    email: '',
    ubuntuUser: 'ubuntu',
    dockerUser: 'docker',
    sshHost: '',
    sshPort: '',
    sshUser: '',
    sshPassword: ''
  });
  logs.value = [];
  showSshKey.value = false;
  domainStatus.value = null;
};
// Функции addLog и formatTime теперь предоставляются композаблом useWebSshLogs
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
.vds-form {
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

/* Заголовок логов с элементами управления */
.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.log-header h3 {
  margin: 0;
  color: var(--color-text);
  font-size: 1.1rem;
}

.log-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.control-btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-btn:hover:not(:disabled) {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.start-btn:hover:not(:disabled) {
  background: #27ae60;
  border-color: #27ae60;
}

.stop-btn:hover:not(:disabled) {
  background: #e74c3c;
  border-color: #e74c3c;
}

.clear-btn:hover:not(:disabled) {
  background: #f39c12;
  border-color: #f39c12;
}

.connection-status {
  font-size: 0.85rem;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: #e74c3c;
  color: white;
}

.connection-status.connected {
  background: #27ae60;
}

.log-container {
  max-height: 400px;
  overflow-y: auto;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
}

.no-logs {
  text-align: center;
  color: var(--color-text-secondary);
  font-style: italic;
  padding: 2rem;
}

.log-entry {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e9ecef;
  font-size: 0.9rem;
}

.log-icon {
  font-size: 0.8rem;
  min-width: 20px;
  text-align: center;
  flex-shrink: 0;
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

/* Статус проверки домена */
.domain-status {
  margin-top: 0.5rem;
  padding: 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.domain-status.loading {
  background: #e3f2fd;
  color: #1976d2;
  border: 1px solid #bbdefb;
}

.domain-status.success {
  background: #e8f5e8;
  color: #2e7d32;
  border: 1px solid #c8e6c9;
}

.domain-status.error {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
}

/* Информационный блок о безопасности */
.security-notice {
  background: #e8f5e8;
  border: 1px solid #4caf50;
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;
}

.security-notice h4 {
  margin: 0 0 0.5rem 0;
  color: #2e7d32;
  font-size: 1rem;
}

.security-notice p {
  margin: 0;
  color: #2e7d32;
  font-size: 0.9rem;
  line-height: 1.4;
}

.security-notice strong {
  color: #1b5e20;
}
</style> 