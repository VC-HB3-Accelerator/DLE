<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="settings-management">
    <div class="management-blocks">
      <div class="blocks-column">
        <div class="management-block">
          <h3>{{ t('settings.index.ai.title') }}</h3>
          <p>{{ t('settings.index.ai.description') }}</p>
          <button class="details-btn" @click="$router.push('/settings/ai')">
            {{ t('common.details') }}
          </button>
        </div>

        <div class="management-block">
          <h3>{{ t('settings.index.blockchain.title') }}</h3>
          <p>{{ t('settings.index.blockchain.description') }}</p>
          <button class="details-btn" @click="$router.push('/settings/dle-v2-deploy')">
            {{ t('common.details') }}
          </button>
        </div>
      </div>

      <div class="blocks-column">
        <div class="management-block">
          <h3>{{ t('settings.index.security.title') }}</h3>
          <p>{{ t('settings.index.security.description') }}</p>
          <button class="details-btn" @click="$router.push('/settings/security')">
            {{ t('common.details') }}
          </button>
        </div>

        <div class="management-block">
          <h3>{{ t('settings.index.server.title') }}</h3>
          <p>{{ t('settings.index.server.description') }}</p>
          <button class="details-btn" @click="$router.push('/settings/interface')">
            {{ t('common.details') }}
          </button>
        </div>
      </div>

      <div class="blocks-column">
        <div class="management-block">
          <h3>{{ t('settings.index.regions.title') }}</h3>
          <p>{{ t('settings.index.regions.description') }}</p>
          <button class="details-btn" @click="goToRegions">
            {{ t('common.details') }}
          </button>
        </div>
      </div>
    </div>

    <NoAccessModal
      :show="showNoAccessModal"
      :title="t('settings.accessRestricted')"
      :message="t('settings.regions.adminOnly')"
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

async function goToRegions() {
  await checkAuth();
  if (isAuthenticated.value && address.value) {
    await checkUserAccessLevel(address.value);
  }

  if (!canManageSettings.value) {
    showNoAccessModal.value = true;
    return;
  }

  router.push('/settings/regions');
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
  gap: 2rem;
  flex-wrap: wrap;
}

.blocks-column {
  flex: 1;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.management-block {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid #e9ecef;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.management-block:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.management-block h3 {
  margin: 0 0 0.75rem 0;
  color: var(--color-primary);
  font-size: 1.25rem;
  font-weight: 600;
}

.management-block p {
  margin: 0 0 1.25rem 0;
  color: #6c757d;
  line-height: 1.5;
  font-size: 0.95rem;
}

.details-btn {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background-color 0.2s ease;
}

.details-btn:hover {
  background: var(--color-primary-dark, #0056b3);
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
