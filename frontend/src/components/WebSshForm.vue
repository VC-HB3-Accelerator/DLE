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
        <h3>Настройки домена</h3>
        <div class="form-group">
          <label for="domain">Домен *</label>
          <input id="domain" v-model="form.domain" type="text" placeholder="example.com" required :disabled="isConnected" />
        </div>
        <div class="form-group">
          <label for="email">Email для SSL *</label>
          <input id="email" v-model="form.email" type="email" placeholder="admin@example.com" required :disabled="isConnected" />
        </div>
      </div>
      <div class="form-section">
        <h3>Настройки SSH сервера</h3>
        <div class="form-group">
          <label for="sshHost">SSH Host/IP *</label>
          <input id="sshHost" v-model="form.sshHost" type="text" placeholder="192.168.1.100 или server.example.com" required :disabled="isConnected" />
        </div>
        <div class="form-group">
          <label for="sshUser">SSH Пользователь *</label>
          <input id="sshUser" v-model="form.sshUser" type="text" placeholder="root" required :disabled="isConnected" />
        </div>
        <div class="form-group">
          <label for="sshKey">SSH Приватный ключ *</label>
          <textarea id="sshKey" v-model="form.sshKey" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----" rows="6" required :disabled="isConnected"></textarea>
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
import { ref, reactive } from 'vue';
import { useWebSshService } from '../services/webSshService';
const webSshService = useWebSshService();
const isLoading = ref(false);
const isConnected = ref(false);
const connectionStatus = ref('Не подключено');
const logs = ref([]);
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
</script>

<style scoped>
/* Ваши стили для формы */
</style> 