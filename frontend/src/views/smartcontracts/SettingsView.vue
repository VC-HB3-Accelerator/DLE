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
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="settings-container page-with-close">
      <PageCloseButton :on-navigate="goBackToBlocks" />
      <!-- Основной контент -->
      <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div v-if="dleInfo?.address" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ dleInfo.address }}
        </div>
        <div v-else-if="address" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ address }}
        </div>
        <div v-else-if="isLoading" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ t('common.loading') }}
        </div>
      </div>
      <div v-if="dleInfo" class="main-content">
        <div class="settings-tabs" role="tablist">
          <button
            type="button"
            class="settings-tab"
            :class="{ 'settings-tab--active': activeTab === 'general' }"
            @click="activeTab = 'general'"
          >
            {{ t('smartcontracts.settings.tabGeneral') }}
          </button>
          <button
            type="button"
            class="settings-tab"
            :class="{ 'settings-tab--active': activeTab === 'modules' }"
            @click="openModulesTab"
          >
            {{ t('smartcontracts.settings.tabModuleDeploy') }}
          </button>
        </div>

        <template v-if="activeTab === 'general'">
        <!-- Отображение в футере -->
        <div v-if="canSetFooterDle" class="footer-card">
          <div class="footer-header">
            <h3>{{ t('smartcontracts.settings.footerDisplay') }}</h3>
          </div>
          <div class="footer-content">
            <p>{{ t('smartcontracts.settings.footerDescription') }}</p>
            <div v-if="isSelectedForFooter" class="selected-info">
              <UiGlyph name="check-circle" />
              <span>{{ t('smartcontracts.settings.selectedForFooter') }}</span>
            </div>
            <div v-else-if="hasFooterDle" class="other-selected-info">
              <UiGlyph name="info" />
              <span>{{ t('smartcontracts.settings.otherSelectedForFooter', { name: footerDle.value?.name, symbol: footerDle.value?.symbol }) }}</span>
            </div>
            <div class="footer-actions">
              <button 
                v-if="!isSelectedForFooter" 
                @click="setAsFooterDle" 
                class="btn-primary" 
                :disabled="isLoading"
              >
                <UiGlyph name="eye" />
                {{ t('smartcontracts.settings.showInFooter') }}
              </button>
              <button 
                v-if="isSelectedForFooter" 
                @click="removeFromFooter" 
                class="btn-danger" 
                :disabled="isLoading"
              >
                <UiGlyph name="trash" />
                {{ t('smartcontracts.settings.removeFromFooter') }}
              </button>
              <button 
                v-if="hasFooterDle && !isSelectedForFooter" 
                @click="removeFromFooter" 
                class="btn-danger btn-sm" 
                :disabled="isLoading"
              >
                <UiGlyph name="trash" />
                {{ t('smartcontracts.settings.removeFromFooter') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Снятие книги с ОС (после on-chain isActive=false) -->
        <div class="danger-card">
          <div class="danger-header">
            <h3>{{ t('smartcontracts.settings.deleteSection') }}</h3>
          </div>
          <div class="danger-content">
            <p>{{ t('smartcontracts.settings.deleteDescription') }}</p>
            <div class="warning-info">
              <h4>{{ t('smartcontracts.settings.important') }}</h4>
              <ul>
                <li>{{ t('smartcontracts.settings.warningStep1') }}</li>
                <li>{{ t('smartcontracts.settings.warningStep2') }}</li>
                <li>{{ t('smartcontracts.settings.warningContractLives') }}</li>
                <li>{{ t('smartcontracts.settings.warningHolders') }}</li>
              </ul>
            </div>
            <p v-if="chainActive === true" class="module-deploy-status">
              {{ t('smartcontracts.settings.statusActive') }}
            </p>
            <p v-else-if="chainActive === false" class="module-deploy-status">
              {{ t('smartcontracts.settings.statusInactive') }}
            </p>
            <p v-else-if="chainActiveError" class="module-deploy-status">
              {{ chainActiveError }}
            </p>
            <button
              v-if="chainActive !== false"
              type="button"
              class="btn-danger"
              :disabled="isLoading || isDelisting"
              @click="goDeactivateProposal"
            >
              {{ t('smartcontracts.settings.deactivateProposalBtn') }}
            </button>
            <button
              v-else
              type="button"
              class="btn-danger"
              :disabled="isLoading || isDelisting"
              @click="delistFromOs"
            >
              {{ isDelisting ? t('common.loading') : t('smartcontracts.settings.deleteDleBtn') }}
            </button>
          </div>
        </div>
        </template>

        <div v-if="activeTab === 'modules'" class="module-deploy-card">
          <div class="module-deploy-header">
            <h3>{{ t('smartcontracts.settings.moduleDeployTitle') }}</h3>
          </div>
          <div class="module-deploy-content">
            <p>{{ t('smartcontracts.settings.moduleDeployHint') }}</p>
            <p v-if="moduleDeployStatus.hasPrivateKey" class="module-deploy-status">
              {{ t('smartcontracts.settings.moduleDeployConfigured', {
                address: moduleDeployStatus.walletAddress || '—',
                scan: moduleDeployStatus.hasEtherscanKey
                  ? t('smartcontracts.settings.moduleDeployScanYes')
                  : t('smartcontracts.settings.moduleDeployScanNo'),
              }) }}
            </p>
            <div
              v-for="(_, rpcIndex) in moduleDeployForm.rpcUrls"
              :key="'rpc-' + rpcIndex"
              class="form-group"
            >
              <label class="form-label" :for="'module-rpc-url-' + rpcIndex">RPC_URL</label>
              <div class="rpc-url-row">
                <input
                  :id="'module-rpc-url-' + rpcIndex"
                  v-model="moduleDeployForm.rpcUrls[rpcIndex]"
                  class="form-control"
                  type="url"
                  autocomplete="off"
                  placeholder="https://"
                />
                <button
                  v-if="moduleDeployForm.rpcUrls.length > 1"
                  type="button"
                  class="btn-rpc-remove"
                  :aria-label="t('common.delete')"
                  @click="removeModuleRpcField(rpcIndex)"
                >
                  ×
                </button>
              </div>
            </div>
            <button type="button" class="btn-rpc-add" @click="addModuleRpcField">
              {{ t('smartcontracts.settings.moduleDeployAddRpc') }}
            </button>
            <div class="form-group">
              <label class="form-label" for="module-private-key">PRIVATE_KEY</label>
              <input
                id="module-private-key"
                v-model="moduleDeployForm.privateKey"
                class="form-control"
                type="password"
                autocomplete="new-password"
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="module-etherscan-key">ETHERSCAN_API_KEY</label>
              <input
                id="module-etherscan-key"
                v-model="moduleDeployForm.etherscanApiKey"
                class="form-control"
                type="password"
                autocomplete="new-password"
              />
            </div>
            <button
              type="button"
              class="btn-primary"
              :disabled="isSavingModuleDeploy || !canSetFooterDle"
              @click="saveModuleDeployer"
            >
              {{ isSavingModuleDeploy ? t('common.loading') : t('smartcontracts.settings.moduleDeploySave') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Сообщение если DLE не выбран -->
      <div v-if="!address" class="no-dle-card">
        <h3>{{ t('smartcontracts.settings.noDleSelected') }}</h3>
        <p>{{ t('smartcontracts.settings.noDleSelectedDesc') }}</p>

      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, defineProps, defineEmits, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useFooterDle } from '../../composables/useFooterDle';
import { usePermissions } from '../../composables/usePermissions';
import { ROLES } from '../../composables/permissions';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import api from '../../api/axios';
import UiGlyph from '../../components/UiGlyph.vue';

const { t } = useI18n();

// Определяем props
const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

// Определяем emits
const emit = defineEmits(['auth-action-completed']);

const router = useRouter();
const route = useRoute();

// Состояние
const dleAddress = ref('');
const dleInfo = ref(null);
const isLoading = ref(false);
const isDelisting = ref(false);
const chainActive = ref(null);
const chainActiveError = ref('');
const activeTab = ref('general');
const isSavingModuleDeploy = ref(false);
const moduleDeployForm = ref({ rpcUrls: [''], privateKey: '', etherscanApiKey: '' });
const moduleDeployStatus = ref({
  hasPrivateKey: false,
  hasRpcUrl: false,
  hasEtherscanKey: false,
  rpcUrl: '',
  rpcUrls: [],
  walletAddress: null,
});

// Получаем адрес DLE из URL параметров
const address = route.query.address || props.dleAddress;

// Функция возврата к блокам управления
const goBackToBlocks = () => {
  if (address) {
    router.push(`/management/dle-blocks?address=${address}`);
  } else {
    router.push('/management');
  }
};

// Используем composable для проверки прав доступа
const { currentRole } = usePermissions();

// Используем composable для выбранного DLE
const { footerDle, setFooterDle, clearFooterDle } = useFooterDle();

// Проверяем, может ли пользователь устанавливать DLE для футера (только редактор)
const canSetFooterDle = computed(() => {
  return currentRole.value === ROLES.EDITOR;
});

// Проверяем, выбран ли этот DLE для отображения в футере
const isSelectedForFooter = computed(() => {
  if (!address || !footerDle.value) return false;
  // Сравниваем адреса в нижнем регистре для надежности
  return footerDle.value.address && footerDle.value.address.toLowerCase() === address.toLowerCase();
});

// Проверяем, есть ли какой-либо DLE в футере
const hasFooterDle = computed(() => {
  return footerDle.value !== null && footerDle.value.address !== null;
});

// Устанавливает выбранный DLE для отображения в футере
const setAsFooterDle = async () => {
  // Проверяем права доступа (только редактор может устанавливать DLE для футера)
  if (!canSetFooterDle.value) {
    alert(t('smartcontracts.settings.alerts.editorOnlySetFooter'));
    return;
  }

  if (!dleInfo.value || !address) {
    alert(t('smartcontracts.settings.alerts.dleInfoNotLoaded'));
    return;
  }

  try {
    // Устанавливаем адрес, данные будут загружены из блокчейна
    await setFooterDle(address, dleInfo.value?.currentChainId ?? null);
    
    alert(t('smartcontracts.settings.alerts.footerSetSuccess', {
      name: dleInfo.value.name,
      symbol: dleInfo.value.symbol
    }));
  } catch (error) {
    console.error('Ошибка при установке выбранного DLE:', error);
    alert(t('smartcontracts.settings.alerts.footerSetFailed'));
  }
};

// Удаляет DLE из футера
const removeFromFooter = async () => {
  // Проверяем права доступа (только редактор может удалять DLE из футера)
  if (!canSetFooterDle.value) {
    alert(t('smartcontracts.settings.alerts.editorOnlyRemoveFooter'));
    return;
  }

  if (!confirm(t('smartcontracts.settings.alerts.confirmRemoveFooter'))) {
    return;
  }

  try {
    await clearFooterDle();
    alert(t('smartcontracts.settings.alerts.footerRemoved'));
  } catch (error) {
    console.error('Ошибка при удалении DLE из футера:', error);
    alert(t('smartcontracts.settings.alerts.footerRemoveFailed'));
  }
};

// Подписка + первичная загрузка
onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    dleInfo.value = null;
    chainActive.value = null;
  });

  window.addEventListener('refresh-application-data', () => {
    loadDLEInfo();
    refreshChainActive();
  });
  if (route.query.tab === 'modules') {
    activeTab.value = 'modules';
  }
  if (address) {
    dleAddress.value = address;
    loadDLEInfo();
    refreshChainActive();
  }
});

// Загружаем информацию о DLE
const loadDLEInfo = async () => {
  if (!address) {
    console.error('Адрес DLE не указан');
    return;
  }

  try {
    isLoading.value = true;
    
    // Загружаем данные DLE из блокчейна через API
    const response = await api.post('/blockchain/read-dle-info', {
      dleAddress: address
    });
    
    if (response.data.success) {
      const dleData = response.data.data;
      
      dleInfo.value = {
        name: dleData.name,           // Название DLE из блокчейна
        symbol: dleData.symbol,       // Символ DLE из блокчейна
        address: dleData.dleAddress || address,  // Адрес из API или из URL
        logoURI: dleData.logoURI || '', // URL логотипа
        currentChainId: Number(dleData.currentChainId) || null
      };
      await loadModuleDeployer();
    } else {
      console.error('Ошибка загрузки DLE:', response.data.error);
      throw new Error(response.data.error || t('smartcontracts.settings.alerts.dleLoadFailed'));
    }
    
  } catch (error) {
    console.error('Ошибка при загрузке информации о DLE:', error);
    // В случае ошибки НЕ устанавливаем fallback данные, оставляем null
    // чтобы не показывать некорректную информацию
    dleInfo.value = null;
  } finally {
    isLoading.value = false;
  }
};

async function loadModuleDeployer() {
  if (!address) return;
  try {
    const response = await api.get('/dle-v2/module-deployer', {
      params: { dleAddress: address },
    });
    const data = response.data?.data || {};
    const savedRpc = Array.isArray(data.rpcUrls) && data.rpcUrls.length
      ? data.rpcUrls
      : (data.rpcUrl ? [data.rpcUrl] : []);
    moduleDeployStatus.value = {
      hasPrivateKey: Boolean(data.hasPrivateKey),
      hasRpcUrl: Boolean(data.hasRpcUrl) || savedRpc.length > 0,
      hasEtherscanKey: Boolean(data.hasEtherscanKey),
      rpcUrl: savedRpc[0] || '',
      rpcUrls: savedRpc,
      walletAddress: data.walletAddress || null,
    };
    moduleDeployForm.value.rpcUrls = savedRpc.length ? [...savedRpc] : [''];
  } catch (error) {
    console.error('[SettingsView] module-deployer status:', error);
  }
}

function openModulesTab() {
  activeTab.value = 'modules';
  loadModuleDeployer();
}

function addModuleRpcField() {
  moduleDeployForm.value.rpcUrls.push('');
}

function removeModuleRpcField(index) {
  if (moduleDeployForm.value.rpcUrls.length <= 1) return;
  moduleDeployForm.value.rpcUrls.splice(index, 1);
}

async function saveModuleDeployer() {
  if (!canSetFooterDle.value) {
    alert(t('smartcontracts.settings.alerts.editorOnlyModuleDeploy'));
    return;
  }
  if (!address) {
    alert(t('smartcontracts.settings.alerts.addressNotFound'));
    return;
  }
  const rpcUrls = (moduleDeployForm.value.rpcUrls || [])
    .map((url) => String(url || '').trim())
    .filter(Boolean);
  const privateKey = String(moduleDeployForm.value.privateKey || '').trim();
  const etherscanApiKey = String(moduleDeployForm.value.etherscanApiKey || '').trim();
  if (!rpcUrls.length && !privateKey && !etherscanApiKey) {
    alert(t('smartcontracts.settings.alerts.moduleDeployFieldsRequired'));
    return;
  }
  try {
    isSavingModuleDeploy.value = true;
    const payload = { dleAddress: address };
    if (rpcUrls.length) {
      payload.RPC_URL = rpcUrls[0];
      payload.RPC_URLS = rpcUrls;
    }
    if (privateKey) payload.PRIVATE_KEY = privateKey;
    if (etherscanApiKey) payload.ETHERSCAN_API_KEY = etherscanApiKey;
    const response = await api.put('/dle-v2/module-deployer', payload);
    if (!response.data?.success) {
      throw new Error(response.data?.message || t('smartcontracts.settings.alerts.moduleDeploySaveFailed'));
    }
    moduleDeployForm.value.privateKey = '';
    moduleDeployForm.value.etherscanApiKey = '';
    await loadModuleDeployer();
    alert(t('smartcontracts.settings.alerts.moduleDeploySaved', {
      address: response.data.data?.walletAddress || '',
    }));
  } catch (error) {
    alert(error.response?.data?.message || error.message || t('smartcontracts.settings.alerts.moduleDeploySaveFailed'));
  } finally {
    isSavingModuleDeploy.value = false;
  }
}

// Методы
async function refreshChainActive() {
  chainActive.value = null;
  chainActiveError.value = '';
  if (!address) return;
  try {
    const response = await api.post('/blockchain/is-active', { dleAddress: address });
    if (response.data?.success) {
      chainActive.value = Boolean(response.data.data?.isActive);
    } else {
      chainActiveError.value = response.data?.error || t('smartcontracts.settings.alerts.activeCheckFailed');
    }
  } catch (e) {
    chainActiveError.value = e?.response?.data?.error || e.message || t('smartcontracts.settings.alerts.activeCheckFailed');
  }
}

function goDeactivateProposal() {
  if (!address) {
    alert(t('smartcontracts.settings.alerts.addressNotFound'));
    return;
  }
  router.push({
    path: '/management/dle-core-op',
    query: { address, op: 'setActive' },
  });
}

async function delistFromOs() {
  if (!address) {
    alert(t('smartcontracts.settings.alerts.addressNotFound'));
    return;
  }
  if (!props.isAuthenticated) {
    alert(t('smartcontracts.settings.alerts.authRequired'));
    return;
  }
  const dleName = dleInfo.value?.name || address;
  if (!confirm(t('smartcontracts.settings.alerts.confirmDelist', { name: dleName }))) {
    return;
  }
  try {
    isDelisting.value = true;
    const chainId = dleInfo.value?.currentChainId ?? null;
    const response = await api.post(`/dle-v2/${address}/delist`, chainId != null ? { chainId } : {});
    if (!response.data?.success) {
      throw new Error(response.data?.message || t('smartcontracts.settings.alerts.delistFailed'));
    }
    alert(t('smartcontracts.settings.alerts.delistSuccess', { name: dleName }));
    router.push('/management');
  } catch (error) {
    console.error('Ошибка delist DLE:', error);
    const code = error?.response?.data?.code;
    if (code === 'still_active') {
      alert(t('smartcontracts.settings.alerts.stillActiveNeedProposal'));
      await refreshChainActive();
      return;
    }
    alert(
      error?.response?.data?.message
      || error.message
      || t('smartcontracts.settings.alerts.delistFailed')
    );
  } finally {
    isDelisting.value = false;
  }
}
</script>

<style scoped>
.settings-container {
  position: relative;
  padding: 20px;
  background: transparent;
  border-radius: var(--radius-lg);
  box-shadow: none;
  margin-top: 20px;
  margin-bottom: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 15px;
  border-bottom: 1px solid #f0f0f0;
}

.header-content {
  flex-grow: 1;
}

.page-header h1 {
  color: var(--color-primary);
  font-size: 2rem;
  margin: 0 0 5px 0;
}

.page-header p {
  color: var(--color-grey-dark);
  font-size: 1rem;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
  flex-shrink: 0;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

/* Основной контент */
.main-content {
  display: grid;
  gap: 20px;
}

.settings-tabs {
  display: flex;
  gap: 8px;
}

.settings-tab {
  border: 1px solid #e9ecef;
  background: #f8f9fa;
  border-radius: var(--radius-sm);
  padding: 8px 16px;
  cursor: pointer;
  font-weight: 600;
  color: var(--color-grey-dark);
}

.settings-tab--active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.module-deploy-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.module-deploy-header {
  background: #f0f7ff;
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
}

.module-deploy-header h3 {
  color: var(--color-primary);
  margin: 0;
  font-size: 1.2rem;
}

.module-deploy-content {
  padding: 20px;
}

.module-deploy-content p {
  color: var(--color-grey-dark);
  margin-bottom: 15px;
  line-height: 1.5;
}

.module-deploy-status {
  background: #e6f7e6;
  border: 1px solid #b3e5b3;
  border-radius: 6px;
  padding: 10px 15px;
}

.form-group {
  margin-bottom: 16px;
}

.rpc-url-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.rpc-url-row .form-control {
  flex: 1;
}

.btn-rpc-add,
.btn-rpc-remove {
  border: 1px solid #e9ecef;
  background: #f8f9fa;
  color: var(--color-grey-dark, #4a5568);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.btn-rpc-add {
  display: inline-block;
  margin: 0 0 16px;
  padding: 8px 14px;
  font-size: 0.9rem;
  font-weight: 600;
}

.btn-rpc-remove {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  font-size: 1.2rem;
  line-height: 1;
}

.form-label {
  display: block;
  font-weight: 600;
  margin-bottom: 6px;
}

.form-control {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-sm);
}

/* Карточки */
.footer-card,
.danger-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.footer-header {
  background: #f0f7ff;
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
}

.footer-header h3 {
  color: var(--color-primary);
  margin: 0;
  font-size: 1.2rem;
}

.footer-content {
  padding: 20px;
}

.footer-content p {
  color: var(--color-grey-dark);
  margin-bottom: 15px;
  line-height: 1.5;
}

.footer-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.selected-info {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #e6f7e6;
  border: 1px solid #b3e5b3;
  border-radius: 6px;
  padding: 10px 15px;
  margin-bottom: 15px;
  color: #2d5a2d;
  font-weight: 500;
}

.selected-info i {
  color: #28a745;
  font-size: 1.1rem;
}

.other-selected-info {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  padding: 10px 15px;
  margin-bottom: 15px;
  color: #856404;
  font-weight: 500;
}

.other-selected-info i {
  color: #ffc107;
  font-size: 1.1rem;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 0.875rem;
}

.danger-header {
  background: #f8f9fa;
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
}

.danger-header h3 {
  color: #c53030;
  margin: 0;
  font-size: 1.2rem;
}

.danger-content {
  padding: 20px;
}

/* Кнопки */
.btn-primary,
.btn-danger {
  border: none;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.btn-danger {
  background: #e53e3e;
  color: white;
}

.btn-danger:hover {
  background: #c53030;
  transform: translateY(-1px);
}

.btn-primary:active,
.btn-danger:active {
  transform: translateY(0);
}

/* Сообщение если DLE не выбран */
.no-dle-card {
  background: #fff5f5;
  border: 2px solid #fed7d7;
  border-radius: var(--radius-lg);
  padding: 30px;
  text-align: center;
}

.no-dle-card h3 {
  color: #c53030;
  margin-bottom: 10px;
  font-size: 1.2rem;
}

.no-dle-card p {
  color: #4a5568;
  margin-bottom: 15px;
  line-height: 1.5;
  font-size: 0.9rem;
}

/* Стили для блока предупреждения */
.warning-info {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  padding: 15px;
  margin: 15px 0;
}

.warning-info h4 {
  color: #856404;
  margin: 0 0 10px 0;
  font-size: 1rem;
}

.warning-info ul {
  margin: 0;
  padding-left: 20px;
  color: #856404;
}

.warning-info li {
  margin-bottom: 5px;
  font-size: 0.9rem;
  line-height: 1.4;
}


/* TZ package G/SC */
@media (max-width: 768px) {
  .page, .panel, .view, .container, .modal, [class*="container"], [class*="panel"], [class*="wrapper"], [class*="form"] {
    max-width: 100%;
    box-sizing: border-box;
  }
  .form-row, .row, .actions, .toolbar, .header-row, .filters {
    flex-wrap: wrap;
  }
  [class*="grid"], .form-row {
    grid-template-columns: 1fr !important;
  }
}
</style> 