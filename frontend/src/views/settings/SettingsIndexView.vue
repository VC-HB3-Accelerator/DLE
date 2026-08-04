<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="settings-management">
    <div class="management-blocks">
      <div class="blocks-column">
        <div class="management-block panel">
          <h3>{{ t('settings.index.ai.title') }}</h3>
          <p>{{ t('settings.index.ai.description') }}</p>
          <button type="button" class="btn btn-primary" @click="$router.push('/settings/ai')">
            {{ t('common.details') }}
          </button>
        </div>

        <div class="management-block panel">
          <h3>{{ t('settings.index.blockchain.title') }}</h3>
          <p>{{ t('settings.index.blockchain.description') }}</p>
          <button type="button" class="btn btn-primary" @click="$router.push('/settings/dle-v2-deploy')">
            {{ t('common.details') }}
          </button>
        </div>
      </div>

      <div class="blocks-column">
        <div class="management-block panel">
          <h3>{{ t('settings.index.security.title') }}</h3>
          <p>{{ t('settings.index.security.description') }}</p>
          <button type="button" class="btn btn-primary" @click="$router.push('/settings/security')">
            {{ t('common.details') }}
          </button>
        </div>

        <div class="management-block panel">
          <h3>{{ t('settings.index.server.title') }}</h3>
          <p>{{ t('settings.index.server.description') }}</p>
          <button type="button" class="btn btn-primary" @click="$router.push('/settings/interface')">
            {{ t('common.details') }}
          </button>
        </div>
      </div>

      <div class="blocks-column">
        <div class="management-block panel">
          <h3>{{ t('settings.index.sidebar.title') }}</h3>
          <p>{{ t('settings.index.sidebar.description') }}</p>
          <button type="button" class="btn btn-primary" @click="goToSidebar">
            {{ t('common.details') }}
          </button>
        </div>

        <div class="management-block panel">
          <h3>{{ t('settings.index.updates.title') }}</h3>
          <p>{{ t('settings.index.updates.description') }}</p>
          <button type="button" class="btn btn-primary" @click="goToUpdates">
            {{ t('common.details') }}
          </button>
        </div>
      </div>
    </div>

    <NoAccessModal
      :show="showNoAccessModal"
      :title="t('settings.accessRestricted')"
      :message="noAccessMessage"
      @close="showNoAccessModal = false"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { usePermissions } from '@/composables/usePermissions';
import { useAuthContext } from '@/composables/useAuth';
import NoAccessModal from '@/components/NoAccessModal.vue';

const { t } = useI18n();
const router = useRouter();
const { canManageSettings } = usePermissions();
const { checkAuth, checkUserAccessLevel, address, isAuthenticated } = useAuthContext();
const showNoAccessModal = ref(false);
const noAccessMessage = ref('');

async function ensureCanManageSettings(deniedMessageKey) {
  await checkAuth();
  if (isAuthenticated.value && address.value) {
    await checkUserAccessLevel(address.value);
  }

  if (!canManageSettings.value) {
    noAccessMessage.value = t(deniedMessageKey);
    showNoAccessModal.value = true;
    return false;
  }

  return true;
}

async function goToSidebar() {
  if (!(await ensureCanManageSettings('settings.sidebar.adminOnly'))) return;
  router.push({ name: 'settings-sidebar' });
}

async function goToUpdates() {
  if (!(await ensureCanManageSettings('settings.updates.adminOnly'))) return;
  router.push({ name: 'settings-updates' });
}
</script>

<style scoped>
.settings-management {
  padding: 0;
  background-color: transparent;
  border-radius: 0;
  min-height: auto;
}

.management-blocks {
  display: flex;
  gap: var(--spacing-xl);
  flex-wrap: wrap;
}

.blocks-column {
  flex: 1;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.management-block {
  margin-bottom: 0;
  box-shadow: none;
  transition: border-color var(--transition-fast);
}

.management-block:hover {
  border-color: var(--color-grey);
}

.management-block h3 {
  margin: 0 0 var(--spacing-sm) 0;
  color: var(--color-dark);
  font-size: var(--font-size-xl);
  font-weight: 600;
}

.management-block p {
  margin: 0 0 var(--spacing-lg) 0;
  color: var(--color-text-light);
  line-height: 1.5;
  font-size: var(--font-size-md);
}

@media (max-width: 768px) {
  .management-blocks {
    flex-direction: column;
  }

  .blocks-column {
    min-width: 100%;
  }
}
</style>
