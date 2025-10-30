<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="vds-mock-container">
      <div class="mock-header">
        <h1 v-if="vdsConfigured">VDS Сервер - Настроен</h1>
        <h1 v-else>VDS Сервер - Не настроен</h1>
        <div class="mock-status">
          <div class="status-indicator" :class="vdsConfigured ? 'online' : 'offline'"></div>
          <span v-if="vdsConfigured">Онлайн</span>
          <span v-else>Офлайн</span>
        </div>
      </div>

      <!-- Информация о домене -->
      <div v-if="vdsConfigured && vdsDomain" class="domain-info">
        <h3>🌐 Ваше приложение доступно по адресу:</h3>
        <a :href="`https://${vdsDomain}`" target="_blank" class="domain-link">
          https://{{ vdsDomain }}
        </a>
      </div>

      <!-- Мок интерфейс -->
      <div class="mock-content">
        <div class="mock-card">
          <h2>Статус сервера</h2>
          <div class="mock-metrics">
            <div class="mock-metric">
              <span class="label">CPU:</span>
              <span class="value mock">--%</span>
            </div>
            <div class="mock-metric">
              <span class="label">RAM:</span>
              <span class="value mock">--%</span>
            </div>
            <div class="mock-metric">
              <span class="label">Диск:</span>
              <span class="value mock">--%</span>
            </div>
            <div class="mock-metric">
              <span class="label">Uptime:</span>
              <span class="value mock">--</span>
            </div>
          </div>
        </div>

        <div class="mock-card">
          <h2>Управление сервисами</h2>
          <div class="mock-services">
            <div class="mock-service">
              <span class="service-name">DLE Application</span>
              <span class="service-status mock">Недоступно</span>
            </div>
            <div class="mock-service">
              <span class="service-name">PostgreSQL</span>
              <span class="service-status mock">Недоступно</span>
            </div>
            <div class="mock-service">
              <span class="service-name">Nginx</span>
              <span class="service-status mock">Недоступно</span>
            </div>
            <div class="mock-service">
              <span class="service-name">Docker</span>
              <span class="service-status mock">Недоступно</span>
            </div>
          </div>
        </div>

        <div class="mock-card">
          <h2>Логи системы</h2>
          <div class="mock-logs">
            <pre>VDS сервер не настроен
Для активации перейдите в настройки и настройте VDS сервер</pre>
          </div>
        </div>

        <div class="mock-card">
          <h2>Деплой приложения</h2>
          <div class="mock-deploy">
            <p>Деплой недоступен - VDS сервер не настроен</p>
            <button class="mock-btn" disabled>Деплой недоступен</button>
          </div>
        </div>

        <div class="mock-card">
          <h2>Управление бэкапами</h2>
          <div class="mock-backups">
            <p>Бэкапы недоступны - VDS сервер не настроен</p>
            <div class="mock-backup-list">
              <div class="mock-backup-item">
                <span class="backup-name">Нет бэкапов</span>
                <span class="backup-date">--</span>
                <span class="backup-size">--</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Призыв к действию -->
        <div class="call-to-action">
          <h2>Настройте VDS сервер</h2>
          <p>Для использования всех функций управления VDS сервером необходимо его настроить.</p>
          <button 
            class="setup-btn" 
            @click="canManageSettings ? goToSetup() : null"
            :disabled="!canManageSettings"
          >
            Перейти к настройке VDS
          </button>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { defineProps, defineEmits, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import BaseLayout from '../components/BaseLayout.vue';
import { usePermissions } from '@/composables/usePermissions';

// Props
const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

// Emits
const emit = defineEmits(['auth-action-completed']);

const router = useRouter();
const { canManageSettings } = usePermissions();

// Состояние VDS
const vdsConfigured = ref(false);
const vdsDomain = ref(null);

// Проверка статуса VDS
const checkVdsStatus = () => {
  try {
    const vdsConfig = localStorage.getItem('vds-config');
    if (vdsConfig) {
      const config = JSON.parse(vdsConfig);
      vdsConfigured.value = config.isConfigured || false;
      vdsDomain.value = config.domain || null;
    }
  } catch (error) {
    console.error('Ошибка при проверке статуса VDS:', error);
  }
};

const goToSetup = () => {
  router.push({ name: 'webssh-settings' });
};

// Жизненный цикл
onMounted(() => {
  checkVdsStatus();
});
</script>

<style scoped>
.vds-mock-container {
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
  margin-bottom: 20px;
  opacity: 0.7;
}

.mock-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.mock-header h1 {
  margin: 0;
  color: #6c757d;
  font-size: 2rem;
  font-weight: 600;
}

.mock-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 600;
  background: #f8d7da;
  color: #721c24;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.status-indicator.offline {
  background: #dc3545;
}

.status-indicator.online {
  background: #28a745;
}

.domain-info {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 12px;
  margin: 20px 0;
  text-align: center;
}

.domain-info h3 {
  margin: 0 0 15px 0;
  font-size: 1.2rem;
  font-weight: 600;
}

.domain-link {
  color: white;
  text-decoration: none;
  font-size: 1.1rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.2);
  padding: 12px 24px;
  border-radius: 8px;
  display: inline-block;
  transition: all 0.3s ease;
}

.domain-link:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.mock-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.mock-card {
  background: #f5f5f5;
  border-radius: 10px;
  padding: 24px;
  border: 2px solid #dee2e6;
}

.mock-card h2 {
  margin: 0 0 20px 0;
  font-size: 1.4rem;
  font-weight: 600;
  color: #6c757d;
}

.mock-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.mock-metric {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: #e9ecef;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.mock-metric .label {
  font-weight: 600;
  color: #6c757d;
}

.mock-metric .value.mock {
  font-weight: 700;
  color: #6c757d;
}

.mock-services {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mock-service {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #e9ecef;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.service-name {
  font-weight: 600;
  color: #6c757d;
}

.service-status.mock {
  font-size: 0.9rem;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 12px;
  background: #f8d7da;
  color: #721c24;
}

.mock-logs {
  background: #2d3748;
  color: #6c757d;
  padding: 16px;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #dee2e6;
}

.mock-deploy {
  text-align: center;
  padding: 20px;
}

.mock-deploy p {
  color: #6c757d;
  margin-bottom: 16px;
}

.mock-btn {
  padding: 12px 24px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: not-allowed;
  font-size: 1rem;
  font-weight: 600;
  opacity: 0.6;
}

.mock-backups {
  text-align: center;
  padding: 20px;
}

.mock-backups p {
  color: #6c757d;
  margin-bottom: 16px;
}

.mock-backup-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mock-backup-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #e9ecef;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.backup-name {
  font-weight: 600;
  color: #6c757d;
}

.backup-date, .backup-size {
  font-size: 0.9rem;
  color: #6c757d;
}

.call-to-action {
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  border-radius: 10px;
  padding: 32px;
  text-align: center;
  border: 2px solid #bbdefb;
}

.call-to-action h2 {
  margin: 0 0 16px 0;
  color: var(--color-primary);
  font-size: 1.6rem;
  font-weight: 600;
}

.call-to-action p {
  color: #6c757d;
  margin-bottom: 24px;
  font-size: 1.1rem;
}

.setup-btn {
  padding: 16px 32px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: 600;
  transition: all 0.3s ease;
}

.setup-btn:hover:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
}

.setup-btn:disabled {
  background: #e0e0e0 !important;
  color: #aaa !important;
  cursor: not-allowed !important;
  transform: none !important;
  box-shadow: none !important;
}

/* Адаптивность */
@media (max-width: 768px) {
  .mock-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .mock-metrics {
    grid-template-columns: 1fr;
  }
  
  .mock-service, .mock-backup-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
