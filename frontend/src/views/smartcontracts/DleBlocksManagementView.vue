<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="dle-blocks-management page-with-close">
      <PageCloseButton fallback="/management" />
      <div class="page-address-bar">
        <div v-if="dleAddress" class="page-address-bar__value">
          {{ dleAddress }}
        </div>
      </div>
      <div class="management-blocks">
        <!-- Столбец 1 -->
        <div class="blocks-column">
          <div v-if="canAccessPath('/management/create-proposal')" class="management-block">
            <h3>{{ t('smartcontracts.createProposal.title') }}</h3>
            <p>{{ t('smartcontracts.createProposal.description') }}</p>
            <button class="details-btn" @click="openCreateProposal">
              {{ t('common.details') }}
            </button>
          </div>
          
          <div v-if="canAccessPath('/management/modules')" class="management-block">
            <h3>{{ t('smartcontracts.modules.title') }}</h3>
            <p>{{ t('smartcontracts.modules.description') }}</p>
            <button class="details-btn" @click="openModules">{{ t('common.details') }}</button>
          </div>
        </div>

        <!-- Столбец 2 -->
        <div class="blocks-column">
          <div v-if="canAccessPath('/management/proposals')" class="management-block">
            <h3>{{ t('smartcontracts.proposals.title') }}</h3>
            <p>{{ t('smartcontracts.proposals.description') }}</p>
            <button class="details-btn" @click="openProposals">{{ t('common.details') }}</button>
          </div>
          
          <div v-if="canAccessPath('/management/analytics')" class="management-block">
            <h3>{{ t('smartcontracts.analytics.title') }}</h3>
            <p>{{ t('smartcontracts.analytics.description') }}</p>
            <button class="details-btn" @click="openAnalytics">{{ t('common.details') }}</button>
          </div>
        </div>

        <!-- Столбец 3 -->
        <div class="blocks-column">
          <div v-if="canAccessPath('/management/history')" class="management-block">
            <h3>{{ t('smartcontracts.history.title') }}</h3>
            <p>{{ t('smartcontracts.history.description') }}</p>
            <button class="details-btn" @click="openHistory">{{ t('common.details') }}</button>
          </div>
          
          <div v-if="canAccessPath('/management/settings')" class="management-block">
            <h3>{{ t('smartcontracts.settings.title') }}</h3>
            <p>{{ t('smartcontracts.settings.description') }}</p>
            <button class="details-btn" @click="openSettings">{{ t('common.details') }}</button>
          </div>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import { canAccessPath, ensureScreenAccessLoaded } from '@/composables/useScreenAccess.js';

const { t } = useI18n();

// Props
const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

const emit = defineEmits(['auth-action-completed']);

const router = useRouter();
const route = useRoute();

// Получаем адрес DLE из query параметров
const dleAddress = computed(() => route.query.address || null);

// Функции для открытия страниц управления
const openProposals = () => {
  if (dleAddress.value) {
    router.push(`/management/proposals?address=${dleAddress.value}`);
  } else {
    router.push('/management/proposals');
  }
};


const openModules = () => {
  if (dleAddress.value) {
    router.push(`/management/modules?address=${dleAddress.value}`);
  } else {
    router.push('/management/modules');
  }
};

const openAnalytics = () => {
  if (dleAddress.value) {
    router.push(`/management/analytics?address=${dleAddress.value}`);
  } else {
    router.push('/management/analytics');
  }
};

const openHistory = () => {
  if (dleAddress.value) {
    router.push(`/management/history?address=${dleAddress.value}`);
  } else {
    router.push('/management/history');
  }
};

const openSettings = () => {
  if (dleAddress.value) {
    router.push(`/management/settings?address=${dleAddress.value}`);
  } else {
    router.push('/management/settings');
  }
};

const openCreateProposal = () => {
  if (dleAddress.value) {
    router.push(`/management/create-proposal?address=${dleAddress.value}`);
  } else {
    router.push('/management/create-proposal');
  }
};

onMounted(() => {
  ensureScreenAccessLoaded();
  // Если нет адреса DLE, перенаправляем на главную страницу management
  if (!dleAddress.value) {
    router.push('/management');
  }
});
</script>

<style scoped>
.dle-blocks-management {
  position: relative;
  padding: var(--spacing-lg);
  background: transparent;
  border-radius: var(--radius-lg);
}

.management-block {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e9ecef;
  transition: box-shadow 0.3s ease, transform 0.3s ease, border-color 0.3s ease;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.75rem;
  /* min-height вместо height — длинный текст/кнопка не вылезают */
  min-height: 250px;
  height: auto;
}

@media (hover: hover) {
  .management-block:hover {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
    transform: translateY(-2px);
    border-color: var(--color-primary);
  }
}

.management-block h3 {
  margin: 0;
  color: var(--color-primary);
  font-size: 1.5rem;
  font-weight: 600;
  flex-shrink: 0;
}

.management-block p {
  margin: 0;
  color: #666;
  font-size: 1rem;
  line-height: 1.5;
  flex-grow: 1;
}

.details-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: background 0.2s, transform 0.2s;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  flex-shrink: 0;
  margin-top: auto;
  align-self: stretch;
}

@media (hover: hover) {
  .details-btn:hover {
    background: var(--color-primary-dark);
    transform: translateY(-1px);
  }
}
</style>
