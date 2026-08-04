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
  <div class="interface-settings settings-panel page-with-close">
    <PageCloseButton fallback="/settings" />
    <h2>{{ $t('settings.interface.web3Hosting') }}</h2>
    




    <!-- Akash Network -->
    <div class="web3-service-block">
      <div class="service-header">
        <h3>Akash Network</h3>
        <span class="service-badge">{{ $t('settings.interface.akash.badge') }}</span>
      </div>
      <p>{{ $t('settings.interface.akash.description') }}</p>
      <div class="service-features">
        <span class="feature">{{ $t('settings.interface.akash.feature1') }}</span>
        <span class="feature">{{ $t('settings.interface.akash.feature2') }}</span>
        <span class="feature">{{ $t('settings.interface.akash.feature3') }}</span>
      </div>
      <button 
        type="button"
        class="btn btn-primary" 
        @click="canManageSettings ? goToAkashDetails() : null"
        :disabled="!canManageSettings"
      >
        {{ $t('common.details') }}
      </button>
    </div>

    <!-- Flux -->
    <div class="web3-service-block">
      <div class="service-header">
        <h3>Flux</h3>
        <span class="service-badge">Web3 Cloud Infrastructure</span>
      </div>
      <p>{{ $t('settings.interface.flux.description') }}</p>
      <div class="service-features">
        <span class="feature">Web3 Infrastructure</span>
        <span class="feature">{{ $t('settings.interface.flux.feature2') }}</span>
        <span class="feature">{{ $t('settings.interface.flux.feature3') }}</span>
      </div>
      <button 
        type="button"
        class="btn btn-primary" 
        @click="canManageSettings ? goToFluxDetails() : null"
        :disabled="!canManageSettings"
      >
        {{ $t('common.details') }}
      </button>
    </div>

    <!-- WEB SSH -->
    <div class="web3-service-block">
      <div class="service-header">
        <h3>{{ $t('settings.interface.vds.title') }}</h3>
        <span class="service-badge">{{ $t('settings.interface.vds.badge') }}</span>
      </div>
      <p>{{ $t('settings.interface.vds.description') }}</p>
      <div class="service-features">
        <span class="feature">{{ $t('settings.interface.vds.feature1') }}</span>
        <span class="feature">{{ $t('settings.interface.vds.feature2') }}</span>
        <span class="feature">{{ $t('settings.interface.vds.feature3') }}</span>
      </div>
      <button 
        type="button"
        class="btn btn-primary" 
        @click="canManageSettings ? goToWebSsh() : null"
        :disabled="!canManageSettings"
      >
        {{ $t('common.details') }}
      </button>
    </div>

    <!-- Модальное окно с формой WEB SSH -->
    <NoAccessModal v-if="showWebSsh" @close="showWebSsh = false">
      <div style="padding:2rem;max-width:600px">
        <h3>{{ $t('settings.interface.websshModalTitle') }}</h3>
        <!-- Здесь будет компонент WebSshForm.vue -->
        <div style="color:var(--color-text-light)">{{ $t('settings.interface.websshModalPlaceholder') }}</div>
        <button type="button" class="btn btn-outline" @click="showWebSsh = false" style="margin-top:1.5rem">{{ $t('common.close') }}</button>
      </div>
    </NoAccessModal>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { useRouter } from 'vue-router';
import { useAuthContext } from '@/composables/useAuth';
import { usePermissions } from '@/composables/usePermissions';
import NoAccessModal from '@/components/NoAccessModal.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
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
  border-color: var(--color-grey);
  box-shadow: var(--shadow-sm);
}

.service-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  width: 100%;
}

.service-header h3 {
  margin: 0;
  color: var(--color-text);
  font-size: var(--font-size-lg);
}

.service-badge {
  background: var(--color-light);
  color: var(--color-text-light);
  border: 1px solid var(--color-border);
  padding: 0.2rem 0.65rem;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.service-features {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin: var(--spacing-xs) 0;
}

.feature {
  background: var(--color-light);
  color: var(--color-text-light);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  border: 1px solid var(--color-border);
}

.page-with-close {
  position: relative;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* TZ package S */
@media (max-width: 768px) {
  .interface-settings.settings-panel,
  .settings-panel {
    max-width: 100%;
    box-sizing: border-box;
  }
  .row, .form-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style> 