<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <BaseLayout
    :is-authenticated="props.isAuthenticated"
    :identities="props.identities"
    :token-balances="props.tokenBalances"
    :is-loading-tokens="props.isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="module-bridge-op-page page-with-close">
      <PageCloseButton :on-navigate="goBack" />

      <div v-if="!props.isAuthenticated" class="auth-notice">
        <div class="alert alert-info">
          <strong>{{ t('smartcontracts.createProposal.authRequiredTitle') }}</strong>
          <p>{{ t('smartcontracts.createProposal.authRequiredHint') }}</p>
        </div>
      </div>

      <div v-else class="op-form">
        <h2>{{ pageTitle }}</h2>
        <p class="op-blurb">{{ pageBlurb }}</p>
        <p class="bridge-hint">{{ formHint }}</p>

        <form @submit.prevent="submitForm">
          <VotingChainSelect
            v-model="votingChain"
            :chains="votingChains"
            :is-loading="isLoadingVotingChains"
          />

          <template v-if="needsAddress">
            <div class="form-group">
              <label class="form-label" for="targetAddress">{{ addressLabel }}</label>
              <input
                id="targetAddress"
                v-model="formData.targetAddress"
                class="form-input"
                type="text"
                :placeholder="t('smartcontracts.moduleBridgeOp.targetPlaceholder')"
                required
              >
              <small class="form-help">{{ targetHelp }}</small>
            </div>
          </template>

          <template v-if="isAddExternal">
            <div class="form-group">
              <label class="form-label" for="extName">{{ t('smartcontracts.moduleBridgeOp.extNameLabel') }}</label>
              <input id="extName" v-model="formData.name" class="form-input" type="text" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="extSymbol">{{ t('smartcontracts.moduleBridgeOp.extSymbolLabel') }}</label>
              <input id="extSymbol" v-model="formData.symbol" class="form-input" type="text" maxlength="20" required>
            </div>
          </template>

          <template v-if="!isFirstHvBridgeAttach">
            <div class="form-group">
              <label class="form-label" for="description">{{ t('smartcontracts.moduleBridgeOp.descriptionLabel') }}</label>
              <textarea
                id="description"
                v-model="formData.description"
                class="form-textarea"
                rows="3"
                :placeholder="t('smartcontracts.moduleBridgeOp.descriptionPlaceholder')"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="votingDuration">{{ t('smartcontracts.transferTokens.votingDurationLabel') }}</label>
              <select id="votingDuration" v-model="formData.votingDuration" class="form-select" required>
                <option value="">{{ t('smartcontracts.transferTokens.votingDurationPlaceholder') }}</option>
                <option value="3600">{{ t('smartcontracts.transferTokens.votingDuration.1h') }}</option>
                <option value="86400">{{ t('smartcontracts.transferTokens.votingDuration.1d') }}</option>
                <option value="259200">{{ t('smartcontracts.transferTokens.votingDuration.3d') }}</option>
                <option value="604800">{{ t('smartcontracts.transferTokens.votingDuration.7d') }}</option>
                <option value="1209600">{{ t('smartcontracts.transferTokens.votingDuration.14d') }}</option>
              </select>
            </div>
          </template>

          <div class="form-actions">
            <button type="submit" class="btn-primary" :disabled="isSubmitting || !opReady || !hasVotingChain">
              {{ submitLabel }}
            </button>
          </div>
        </form>

        <div v-if="proposalResult" class="proposal-result">
          <div class="alert" :class="proposalResult.success ? 'alert-success' : 'alert-danger'">
            <p>{{ proposalResult.message }}</p>
          </div>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { computed, defineEmits, defineProps, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ethers } from 'ethers';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import api from '@/api/axios';
import {
  attachHvBridgeByInitializer,
  createProposal,
  encodeModuleBridgeOperation,
  findBookedModuleId,
  getBookedModuleAddress,
  isModuleBridgeOp,
  readHvModuleBridge,
  switchToVotingNetwork,
} from '@/utils/dle-contract';
import { getAllModules } from '@/services/modulesService.js';
import { translateIfExists } from '@/utils/helpers.js';
import VotingChainSelect from '@/components/VotingChainSelect.vue';
import { useVotingChains } from '@/composables/useVotingChains.js';

const props = defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});

defineEmits(['auth-action-completed']);

const { t, locale, messages } = useI18n();
const router = useRouter();
const route = useRoute();

const dleAddress = computed(() => route.query.address || '');
const moduleType = computed(() => String(route.query.moduleType || ''));
const functionName = computed(() => String(route.query.op || ''));
const {
  chains: votingChains,
  votingChain,
  isLoading: isLoadingVotingChains,
  hasVotingChain,
  hubQuery,
} = useVotingChains(dleAddress);

const dleInfo = ref(null);
const isSubmitting = ref(false);
const proposalResult = ref(null);
const isFirstHvBridgeAttach = ref(false);
const hvModuleAddress = ref('');
const formData = ref({
  targetAddress: '',
  name: '',
  symbol: '',
  description: '',
  votingDuration: '604800',
});

const opReady = computed(() => isModuleBridgeOp(moduleType.value, functionName.value));
const isAddExternal = computed(() => functionName.value === 'addExternalDLE');
const needsAddress = computed(() => functionName.value !== 'updateAllExternalDLEBalances');

function i18nOp(suffix) {
  return `smartcontracts.createProposal.modules.${moduleType.value}.ops.${functionName.value}.${suffix}`;
}

const pageTitle = computed(() => {
  if (isFirstHvBridgeAttach.value) {
    return t('smartcontracts.moduleBridgeOp.firstAttachTitle');
  }
  return translateIfExists(
    t,
    i18nOp('title'),
    undefined,
    functionName.value,
    messages.value?.[locale.value] || messages.value?.en
  );
});

const pageBlurb = computed(() => {
  if (isFirstHvBridgeAttach.value) {
    return t('smartcontracts.moduleBridgeOp.firstAttachBlurb');
  }
  return translateIfExists(
    t,
    i18nOp('description'),
    undefined,
    '',
    messages.value?.[locale.value] || messages.value?.en
  );
});

const formHint = computed(() => (
  isFirstHvBridgeAttach.value
    ? t('smartcontracts.moduleBridgeOp.firstAttachHint')
    : t('smartcontracts.moduleBridgeOp.bridgeHint')
));

const submitLabel = computed(() => {
  if (isSubmitting.value) {
    return isFirstHvBridgeAttach.value
      ? t('smartcontracts.moduleBridgeOp.attaching')
      : t('smartcontracts.transferTokens.creating');
  }
  return isFirstHvBridgeAttach.value
    ? t('smartcontracts.moduleBridgeOp.firstAttachSubmit')
    : t('smartcontracts.transferTokens.createProposal');
});

const addressLabel = computed(() => {
  if (functionName.value === 'setFundsBridge' || functionName.value === 'setModuleBridge') {
    return t('smartcontracts.moduleBridgeOp.bridgeAddressLabel');
  }
  if (isAddExternal.value || functionName.value === 'removeExternalDLE' || functionName.value === 'updateExternalDLEBalance') {
    return t('smartcontracts.moduleBridgeOp.extDleLabel');
  }
  return t('smartcontracts.moduleBridgeOp.targetLabel');
});

const targetHelp = computed(() => {
  if (functionName.value === 'setFundsBridge' || functionName.value === 'setModuleBridge') {
    return t('smartcontracts.moduleBridgeOp.targetHelpBridge');
  }
  if (functionName.value === 'setHierarchicalVotingModule') {
    return t('smartcontracts.moduleBridgeOp.targetHelpTreasury');
  }
  if (functionName.value === 'setTreasuryModule') {
    return t('smartcontracts.moduleBridgeOp.targetHelpHv');
  }
  if (isAddExternal.value || functionName.value === 'removeExternalDLE' || functionName.value === 'updateExternalDLEBalance') {
    return t('smartcontracts.moduleBridgeOp.targetHelpExtDle');
  }
  return t('smartcontracts.moduleBridgeOp.targetHelpGeneric');
});

function goBack() {
  router.push({
    path: '/management/create-proposal',
    query: hubQuery(),
  });
}

function bookAddressFor(chainId) {
  const networks = dleInfo.value?.deployedNetworks || [];
  const net = networks.find((n) => Number(n.chainId) === Number(chainId));
  return net?.address || dleAddress.value;
}

async function refreshAttachMode() {
  isFirstHvBridgeAttach.value = false;
  hvModuleAddress.value = '';
  if (functionName.value !== 'setModuleBridge' || moduleType.value !== 'hierarchicalVoting') return;
  if (!hasVotingChain.value || !dleAddress.value) return;
  const chainId = Number(votingChain.value);
  const bookAddress = bookAddressFor(chainId);
  try {
    const hvAddr = await getBookedModuleAddress(bookAddress, 'hierarchicalVoting', chainId);
    if (!hvAddr) return;
    hvModuleAddress.value = hvAddr;
    const current = await readHvModuleBridge(hvAddr);
    const empty = !current || current === ethers.ZeroAddress;
    isFirstHvBridgeAttach.value = empty;
    if (empty && !formData.value.targetAddress) {
      const listing = await getAllModules(dleAddress.value);
      const mods = listing?.data?.modules || [];
      const hv = mods.find((m) => m.moduleType === 'hierarchicalVoting');
      const row = (hv?.addresses || []).find((a) => Number(a.chainId) === chainId);
      const prefill = row?.bridgeAddress || hv?.bridgeAddress || '';
      if (prefill) formData.value.targetAddress = prefill;
    }
  } catch (error) {
    console.warn('[ModuleBridgeOp] attach mode:', error.message);
  }
}

async function loadDleInfo() {
  if (!dleAddress.value) return;
  const response = await api.get('/dle-v2');
  if (!response.data.success) return;
  const allDles = response.data.data || [];
  for (const dle of allDles) {
    const networkMatch = dle.deployedNetworks?.find(
      (net) => net.address?.toLowerCase() === dleAddress.value.toLowerCase()
    );
    if (networkMatch) {
      dleInfo.value = { ...dle, deployedNetworks: dle.deployedNetworks || [] };
      return;
    }
  }
}

async function submitForm() {
  proposalResult.value = null;
  try {
    if (!opReady.value) throw new Error(t('smartcontracts.moduleBridgeOp.unsupportedOp'));
    if (!dleAddress.value) throw new Error(t('smartcontracts.moduleBridgeOp.noDle'));
    if (needsAddress.value) {
      if (!ethers.isAddress(formData.value.targetAddress)) {
        throw new Error(t('smartcontracts.moduleBridgeOp.invalidAddress'));
      }
      if (formData.value.targetAddress === ethers.ZeroAddress) {
        throw new Error(t('smartcontracts.moduleBridgeOp.zeroAddress'));
      }
    }
    if (isAddExternal.value) {
      if (!String(formData.value.name || '').trim() || !String(formData.value.symbol || '').trim()) {
        throw new Error(t('smartcontracts.moduleBridgeOp.extMetaRequired'));
      }
    }
    if (!isFirstHvBridgeAttach.value && !formData.value.description.trim()) {
      throw new Error(t('smartcontracts.moduleBridgeOp.descriptionRequired'));
    }
    if (!isFirstHvBridgeAttach.value && !formData.value.votingDuration) {
      throw new Error(t('smartcontracts.moduleBridgeOp.durationRequired'));
    }
    if (!hasVotingChain.value) {
      throw new Error(t('smartcontracts.createProposal.votingChainRequired'));
    }

    const chainId = Number(votingChain.value);
    const bookAddress = bookAddressFor(chainId);

    isSubmitting.value = true;
    const switched = await switchToVotingNetwork(chainId);
    if (!switched) {
      throw new Error(t('smartcontracts.moduleBridgeOp.networkSwitchFailed', { chainId }));
    }
    await new Promise((r) => setTimeout(r, 800));

    if (isFirstHvBridgeAttach.value) {
      const hvAddr = hvModuleAddress.value || await getBookedModuleAddress(
        bookAddress,
        moduleType.value,
        chainId
      );
      if (!hvAddr) throw new Error(t('smartcontracts.moduleBridgeOp.moduleNotInBook'));
      const result = await attachHvBridgeByInitializer(
        bookAddress,
        hvAddr,
        formData.value.targetAddress
      );
      proposalResult.value = {
        success: true,
        message: t('smartcontracts.moduleBridgeOp.attachSuccess', { txHash: result.txHash }),
      };
      isFirstHvBridgeAttach.value = false;
      return;
    }

    const moduleId = await findBookedModuleId(bookAddress, moduleType.value, chainId);
    if (!moduleId) throw new Error(t('smartcontracts.moduleBridgeOp.moduleNotInBook'));

    const operation = encodeModuleBridgeOperation(moduleType.value, functionName.value, moduleId, {
      targetAddress: formData.value.targetAddress,
      dleAddress: formData.value.targetAddress,
      name: formData.value.name,
      symbol: formData.value.symbol,
    });

    const result = await createProposal(bookAddress, {
      description: formData.value.description.trim(),
      duration: parseInt(formData.value.votingDuration, 10),
      operation,
      targetChains: [chainId],
      timelockDelay: 0,
    });
    if (!result.success) {
      throw new Error(result.error || t('smartcontracts.moduleBridgeOp.allFailed'));
    }

    proposalResult.value = {
      success: true,
      message: t('smartcontracts.moduleBridgeOp.successMessage', {
        success: 1,
        total: 1,
      }),
    };
    router.push(`/management/proposals?address=${dleAddress.value}`);
  } catch (error) {
    proposalResult.value = {
      success: false,
      message: error.message || t('smartcontracts.moduleBridgeOp.allFailed'),
    };
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(async () => {
  if (dleAddress.value) await loadDleInfo();
  await refreshAttachMode();
});

watch([votingChain, hasVotingChain], () => {
  refreshAttachMode();
});
</script>

<style scoped>
.module-bridge-op-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 1rem;
}
.op-form h2 { margin: 0 0 0.5rem; font-size: 1.25rem; }
.op-blurb, .bridge-hint {
  color: var(--color-grey-dark, #6c757d);
  font-size: 0.9rem;
  margin: 0 0 0.75rem;
}
.form-group { margin-bottom: 1rem; }
.form-label { display: block; font-weight: 600; margin-bottom: 0.35rem; }
.form-input, .form-textarea, .form-select {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  box-sizing: border-box;
}
.form-help { display: block; color: #6c757d; font-size: 0.8rem; margin-top: 0.25rem; }
.form-actions { display: flex; justify-content: flex-end; margin-top: 1.5rem; }
.btn-primary {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.auth-notice, .proposal-result { margin: 1rem 0; }
.alert { padding: 0.75rem 1rem; border-radius: 6px; }
.alert-info { background: #e7f1ff; }
.alert-success { background: #d4edda; }
.alert-danger { background: #f8d7da; }
</style>
