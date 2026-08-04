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
  <div class="security-settings page-with-close">
    <PageCloseButton fallback="/settings" />

    <div class="management-blocks">
      <div class="blocks-column">
        <div class="management-block">
          <h3>{{ $t('settings.rpc.title') }}</h3>
          <p>
            {{
              securitySettings.rpcConfigs.length > 0
                ? t('settings.security.providersConfigured', { count: securitySettings.rpcConfigs.length })
                : t('settings.security.providersNotConfigured')
            }}
          </p>
          <button type="button" class="details-btn" @click="handleRpcDetailsClick">
            {{ $t('common.details') }}
          </button>
        </div>
      </div>

      <div class="blocks-column">
        <div class="management-block">
          <h3>{{ $t('settings.security.authentication') }}</h3>
          <p>
            {{
              securitySettings.authTokens.length > 0
                ? t('settings.security.tokensConfigured', { count: securitySettings.authTokens.length })
                : t('settings.security.tokensNotConfigured')
            }}
          </p>
          <button type="button" class="details-btn" @click="goAuthDetails">
            {{ $t('common.details') }}
          </button>
        </div>
      </div>
    </div>

    <NoAccessModal
      :show="showNoAccessModal"
      :title="$t('settings.accessRestricted')"
      :message="t('settings.security.rpcAdminOnly')"
      @close="closeNoAccessModal"
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { reactive, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/api/axios';
import { usePermissions } from '@/composables/usePermissions';
import NoAccessModal from '@/components/NoAccessModal.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';

const { t } = useI18n();
const router = useRouter();
const { canManageSettings } = usePermissions();

const showNoAccessModal = ref(false);
const securitySettings = reactive({
  rpcConfigs: [],
  authTokens: [],
});

async function loadSettings() {
  try {
    const rpcResponse = await api.get('/settings/rpc');
    if (rpcResponse.data?.success) {
      securitySettings.rpcConfigs = (rpcResponse.data.data || []).map((rpc) => ({
        networkId: rpc.network_id,
        rpcUrl: rpc.rpc_url,
        rpcUrlDisplay: rpc.rpc_url_display,
        chainId: rpc.chain_id,
      }));
    }

    const authResponse = await api.get('/settings/auth-tokens');
    if (authResponse.data?.success) {
      securitySettings.authTokens = (authResponse.data.data || []).map((token) => ({
        name: token.name,
        address: token.address,
        network: token.network,
        minBalance: token.min_balance,
        readonlyThreshold: token.readonly_threshold ?? 1,
        editorThreshold: token.editor_threshold ?? 1,
      }));
    }
  } catch (error) {
    console.error('[SecuritySettingsView] Ошибка при загрузке настроек:', error);
    securitySettings.rpcConfigs = [];
    securitySettings.authTokens = [];
  }
}

function handleRpcDetailsClick() {
  if (canManageSettings.value) {
    router.push({ name: 'settings-security-rpc' });
    return;
  }
  showNoAccessModal.value = true;
}

function goAuthDetails() {
  router.push({ name: 'settings-security-auth' });
}

function closeNoAccessModal() {
  showNoAccessModal.value = false;
}

onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    securitySettings.rpcConfigs = [];
    securitySettings.authTokens = [];
  });
  window.addEventListener('refresh-application-data', loadSettings);
  loadSettings();
});
</script>

<style scoped>
.security-settings {
  position: relative;
}

.management-blocks {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2rem;
}

.blocks-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: stretch;
}

.management-block {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 250px;
}

.management-block:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
  border-color: var(--color-primary);
}

.management-block h3 {
  margin: 0 0 1rem 0;
  color: var(--color-primary);
  font-size: 1.5rem;
  font-weight: 600;
  flex-shrink: 0;
  white-space: nowrap;
}

.management-block p {
  margin: 0 0 1.5rem 0;
  color: #666;
  font-size: 1rem;
  line-height: 1.5;
  flex-grow: 1;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
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
  transition: all 0.2s;
  min-width: 120px;
  flex-shrink: 0;
  margin-top: auto;
  white-space: nowrap;
}

.details-btn:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.page-with-close {
  position: relative;
}

@media (max-width: 1024px) {
  .management-blocks {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .management-blocks {
    grid-template-columns: 1fr;
  }

  .management-block {
    height: auto;
    min-height: 0;
  }

  .security-settings {
    max-width: 100%;
    box-sizing: border-box;
  }
}
</style>
