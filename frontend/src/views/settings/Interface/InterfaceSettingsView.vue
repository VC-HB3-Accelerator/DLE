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
  <div class="interface-settings settings-panel" style="position:relative;min-height:120px">
    <button class="close-btn" @click="goBack">×</button>
    <h2>Web3 Хостинг</h2>
    




    <!-- Akash Network -->
    <div class="web3-service-block">
      <div class="service-header">
        <h3>Akash Network</h3>
        <span class="service-badge akash">Децентрализованная облачная платформа</span>
      </div>
      <p>Разверните ваше приложение на децентрализованной облачной инфраструктуре Akash Network. Оплата токенами AKT.</p>
      <div class="service-features">
        <span class="feature">✓ Децентрализованный хостинг</span>
        <span class="feature">✓ Оплата в AKT</span>
        <span class="feature">✓ Полный контроль</span>
      </div>
      <button 
        class="btn-primary" 
        @click="canManageSettings ? goToAkashDetails() : null"
        :disabled="!canManageSettings"
      >
        Подробнее
      </button>
    </div>

    <!-- Flux -->
    <div class="web3-service-block">
      <div class="service-header">
        <h3>Flux</h3>
        <span class="service-badge flux">Web3 Cloud Infrastructure</span>
      </div>
      <p>Децентрализованная облачная платформа Flux для развертывания и управления Web3 приложениями с высокой производительностью.</p>
      <div class="service-features">
        <span class="feature">✓ Web3 Infrastructure</span>
        <span class="feature">✓ Высокая производительность</span>
        <span class="feature">✓ Глобальная сеть</span>
      </div>
      <button 
        class="btn-primary" 
        @click="canManageSettings ? goToFluxDetails() : null"
        :disabled="!canManageSettings"
      >
        Подробнее
      </button>
    </div>

    <!-- WEB SSH -->
    <div class="web3-service-block">
      <div class="service-header">
        <h3>VDS Сервер</h3>
        <span class="service-badge webssh">Публикация на VDS сервере</span>
      </div>
      <p>Автоматическая публикация приложения в интернете.</p>
      <div class="service-features">
        <span class="feature">✓ Быстрое подключение</span>
        <span class="feature">✓ Безопасно</span>
        <span class="feature">✓ Для локальных и VPS</span>
      </div>
      <button 
        class="btn-primary" 
        @click="canManageSettings ? goToWebSsh() : null"
        :disabled="!canManageSettings"
      >
        Подробнее
      </button>
    </div>

    <!-- Модальное окно с формой WEB SSH -->
    <NoAccessModal v-if="showWebSsh" @close="showWebSsh = false">
      <div style="padding:2rem;max-width:600px">
        <h3>WEB SSH Туннель (форма)</h3>
        <!-- Здесь будет компонент WebSshForm.vue -->
        <div style="color:#888">Здесь появится форма WEB SSH (будет вынесена из WebSshSettingsView.vue)</div>
        <button class="btn-primary" @click="showWebSsh = false" style="margin-top:1.5rem">Закрыть</button>
      </div>
    </NoAccessModal>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useAuthContext } from '@/composables/useAuth';
import { usePermissions } from '@/composables/usePermissions';
import NoAccessModal from '@/components/NoAccessModal.vue';
import { onMounted } from 'vue';

// Подписываемся на централизованные события очистки и обновления данных
onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    console.log('[InterfaceSettingsView] Clearing interface data');
    // Очищаем данные при выходе из системы
    // InterfaceSettingsView не нуждается в очистке данных
  });
  
  window.addEventListener('refresh-application-data', () => {
    console.log('[InterfaceSettingsView] Refreshing interface data');
    // InterfaceSettingsView не нуждается в обновлении данных
  });
});
import { ref } from 'vue';
const router = useRouter();
const { canManageSettings } = usePermissions();
const goBack = () => router.push('/settings');



const goToAkashDetails = () => {
  window.open('https://akash.network/', '_blank');
};

const goToFluxDetails = () => {
  window.open('https://runonflux.io/', '_blank');
};

const goToWebSsh = () => router.push('/settings/interface/webssh');

const showWebSsh = ref(false);
</script>

<style scoped>
.settings-panel {
  padding: var(--block-padding);
  background-color: var(--color-light);
  border-radius: var(--radius-md);
  margin-top: var(--spacing-lg);
  animation: fadeIn var(--transition-normal);
}

h2 {
  margin-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--color-grey-light);
  padding-bottom: var(--spacing-md);
  margin-top: 2rem;
}

h2:first-of-type {
  margin-top: 0;
}

.web3-service-block {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: flex-start;
  padding: 1.5rem;
  border: 1px solid var(--color-grey-light);
  border-radius: var(--radius-md);
  background: var(--color-white);
  transition: all 0.2s ease;
}

.web3-service-block:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.service-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
}

.service-header h3 {
  margin: 0;
  color: var(--color-text);
  font-size: 1.2rem;
}

.service-badge {
  background: var(--color-primary);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.service-badge.akash {
  background: linear-gradient(135deg, #ff6b6b, #ee5a52);
}

.service-badge.flux {
  background: linear-gradient(135deg, #4ecdc4, #44a08d);
}

.service-badge.webssh {
  background: linear-gradient(135deg, #6c757d, #343a40);
}

.service-features {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0.5rem 0;
}

.feature {
  background: var(--color-grey-lightest);
  color: var(--color-text-secondary);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.85rem;
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: all 0.2s;
  margin-top: 0.5rem;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  background: #e0e0e0 !important;
  color: #aaa !important;
  cursor: not-allowed !important;
  transform: none !important;
}

.close-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #bbb;
  transition: color 0.2s;
  z-index: 10;
}

.close-btn:hover {
  color: #333;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style> 