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
    <div class="dle-core-op-page page-with-close">
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

        <form @submit.prevent="submitForm">
          <VotingChainSelect
            v-model="votingChain"
            :chains="votingChains"
            :is-loading="isLoadingVotingChains"
          />

          <template v-if="op === 'updateQuorum'">
            <div class="form-group">
              <label class="form-label" for="quorum">{{ t('smartcontracts.dleCoreOp.quorumLabel') }}</label>
              <input id="quorum" v-model.number="formData.quorum" class="form-input" type="number" min="1" max="100" required>
            </div>
          </template>

          <template v-else-if="op === 'updateVotingDurations'">
            <div class="form-group">
              <label class="form-label" for="minDur">{{ t('smartcontracts.dleCoreOp.minDurationLabel') }}</label>
              <input id="minDur" v-model.number="formData.minDuration" class="form-input" type="number" min="1" required>
              <small class="form-help">{{ t('smartcontracts.dleCoreOp.durationHelp') }}</small>
            </div>
            <div class="form-group">
              <label class="form-label" for="maxDur">{{ t('smartcontracts.dleCoreOp.maxDurationLabel') }}</label>
              <input id="maxDur" v-model.number="formData.maxDuration" class="form-input" type="number" min="1" required>
            </div>
          </template>

          <template v-else-if="op === 'setLogoUri'">
            <div class="form-group">
              <label class="form-label" for="logoUri">{{ t('smartcontracts.dleCoreOp.logoUriLabel') }}</label>
              <input id="logoUri" v-model="formData.logoUri" class="form-input" type="text" required>
            </div>
          </template>

          <template v-else-if="op === 'setActive'">
            <div class="form-group">
              <label class="form-label" for="activeFlag">{{ t('smartcontracts.dleCoreOp.activeLabel') }}</label>
              <select id="activeFlag" v-model="formData.active" class="form-select" required>
                <option value="false">{{ t('smartcontracts.dleCoreOp.activeFalse') }}</option>
                <option value="true">{{ t('smartcontracts.dleCoreOp.activeTrue') }}</option>
              </select>
              <small class="form-help">{{ t('smartcontracts.dleCoreOp.activeHelp') }}</small>
            </div>
          </template>

          <template v-else-if="op === 'offchainAction'">
            <div class="form-group">
              <label class="form-label" for="actionId">{{ t('smartcontracts.dleCoreOp.actionIdLabel') }}</label>
              <input id="actionId" v-model="formData.actionId" class="form-input" type="text" :placeholder="t('smartcontracts.dleCoreOp.actionIdPlaceholder')">
            </div>
            <div class="form-group">
              <label class="form-label" for="kind">{{ t('smartcontracts.dleCoreOp.kindLabel') }}</label>
              <select id="kind" v-model="formData.kind" class="form-select" required>
                <option value="payment">payment</option>
                <option value="note">note</option>
                <option value="document">document</option>
                <option value="custom">custom</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="payload">{{ t('smartcontracts.dleCoreOp.payloadLabel') }}</label>
              <textarea id="payload" v-model="formData.payload" class="form-textarea" rows="3" required />
              <small class="form-help">{{ t('smartcontracts.dleCoreOp.payloadHelp') }}</small>
            </div>
          </template>

          <template v-else-if="op === 'updateDleInfo'">
            <div class="form-group">
              <label class="form-label" for="name">{{ t('smartcontracts.dleCoreOp.nameLabel') }}</label>
              <input id="name" v-model="formData.name" class="form-input" type="text" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="symbol">{{ t('smartcontracts.dleCoreOp.symbolLabel') }}</label>
              <input id="symbol" v-model="formData.symbol" class="form-input" type="text" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="location">{{ t('smartcontracts.dleCoreOp.locationLabel') }}</label>
              <input id="location" v-model="formData.location" class="form-input" type="text" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="coordinates">{{ t('smartcontracts.dleCoreOp.coordinatesLabel') }}</label>
              <input id="coordinates" v-model="formData.coordinates" class="form-input" type="text">
            </div>
            <div class="form-group">
              <label class="form-label" for="jurisdiction">{{ t('smartcontracts.dleCoreOp.jurisdictionLabel') }}</label>
              <input id="jurisdiction" v-model.number="formData.jurisdiction" class="form-input" type="number" min="1" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="okved">{{ t('smartcontracts.dleCoreOp.okvedLabel') }}</label>
              <input id="okved" v-model="formData.okvedCodes" class="form-input" type="text" :placeholder="t('smartcontracts.dleCoreOp.okvedPlaceholder')">
            </div>
            <div class="form-group">
              <label class="form-label" for="kpp">{{ t('smartcontracts.dleCoreOp.kppLabel') }}</label>
              <input id="kpp" v-model.number="formData.kpp" class="form-input" type="number" min="0">
            </div>
          </template>

          <div class="form-group">
            <label class="form-label" for="description">{{ t('smartcontracts.moduleBridgeOp.descriptionLabel') }}</label>
            <textarea id="description" v-model="formData.description" class="form-textarea" rows="3" required />
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

          <div class="form-actions">
            <button type="submit" class="btn-primary" :disabled="isSubmitting || !opReady || !hasVotingChain">
              {{ isSubmitting ? t('smartcontracts.transferTokens.creating') : t('smartcontracts.transferTokens.createProposal') }}
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
import { computed, defineEmits, defineProps, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ethers } from 'ethers';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import api from '@/api/axios';
import { createProposal, switchToVotingNetwork } from '@/utils/dle-contract';
import VotingChainSelect from '@/components/VotingChainSelect.vue';
import { useVotingChains } from '@/composables/useVotingChains.js';

const props = defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});

defineEmits(['auth-action-completed']);

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const dleAddress = computed(() => route.query.address || '');
const op = computed(() => String(route.query.op || ''));
const {
  chains: votingChains,
  votingChain,
  isLoading: isLoadingVotingChains,
  hasVotingChain,
  hubQuery,
} = useVotingChains(dleAddress);
const opReady = computed(() => [
  'updateQuorum',
  'updateVotingDurations',
  'setLogoUri',
  'setActive',
  'offchainAction',
  'updateDleInfo',
].includes(op.value));

const opKey = computed(() => {
  const map = {
    updateQuorum: 'updateQuorum',
    updateVotingDurations: 'updateVotingDurations',
    setLogoUri: 'setLogoUri',
    setActive: 'setActive',
    offchainAction: 'offchainAction',
    updateDleInfo: 'updateDleInfo',
  };
  return map[op.value] || 'updateQuorum';
});

const pageTitle = computed(() => t(`smartcontracts.createProposal.operations.${opKey.value}.title`));
const pageBlurb = computed(() => t(`smartcontracts.createProposal.operations.${opKey.value}.description`));

const dleInfo = ref(null);
const isSubmitting = ref(false);
const proposalResult = ref(null);
const formData = ref({
  quorum: 51,
  minDuration: 3600,
  maxDuration: 2592000,
  logoUri: '',
  active: 'false',
  actionId: '',
  kind: 'note',
  payload: '',
  name: '',
  symbol: '',
  location: '',
  coordinates: '',
  jurisdiction: 784,
  okvedCodes: '',
  kpp: 0,
  description: '',
  votingDuration: '604800',
});

function goBack() {
  router.push({
    path: '/management/create-proposal',
    query: hubQuery(),
  });
}

function encodeOperation() {
  if (op.value === 'updateQuorum') {
    const iface = new ethers.Interface(['function _updateQuorumPercentage(uint256)']);
    return iface.encodeFunctionData('_updateQuorumPercentage', [Number(formData.value.quorum)]);
  }
  if (op.value === 'updateVotingDurations') {
    const iface = new ethers.Interface(['function _updateVotingDurations(uint256,uint256)']);
    return iface.encodeFunctionData('_updateVotingDurations', [
      Number(formData.value.minDuration),
      Number(formData.value.maxDuration),
    ]);
  }
  if (op.value === 'setLogoUri') {
    const iface = new ethers.Interface(['function _setLogoURI(string)']);
    return iface.encodeFunctionData('_setLogoURI', [String(formData.value.logoUri).trim()]);
  }
  if (op.value === 'setActive') {
    const iface = new ethers.Interface(['function _setActive(bool)']);
    return iface.encodeFunctionData('_setActive', [formData.value.active === 'true' || formData.value.active === true]);
  }
  if (op.value === 'offchainAction') {
    const actionRaw = String(formData.value.actionId || '').trim();
    const actionId = /^0x[0-9a-fA-F]{64}$/.test(actionRaw)
      ? actionRaw
      : ethers.keccak256(ethers.toUtf8Bytes(actionRaw || `action-${Date.now()}`));
    const payloadHash = ethers.keccak256(ethers.toUtf8Bytes(String(formData.value.payload || '')));
    const iface = new ethers.Interface(['function offchainAction(bytes32,string,bytes32)']);
    return iface.encodeFunctionData('offchainAction', [actionId, formData.value.kind, payloadHash]);
  }
  if (op.value === 'updateDleInfo') {
    const okved = String(formData.value.okvedCodes || '')
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const iface = new ethers.Interface([
      'function _updateDLEInfo(string,string,string,string,uint256,string[],uint256)',
    ]);
    return iface.encodeFunctionData('_updateDLEInfo', [
      String(formData.value.name).trim(),
      String(formData.value.symbol).trim(),
      String(formData.value.location).trim(),
      String(formData.value.coordinates || '').trim(),
      Number(formData.value.jurisdiction),
      okved,
      Number(formData.value.kpp || 0),
    ]);
  }
  throw new Error(t('smartcontracts.dleCoreOp.unsupportedOp'));
}

async function loadDleInfo() {
  if (!dleAddress.value) return;
  const response = await api.get('/dle-v2');
  if (!response.data.success) return;
  for (const dle of response.data.data || []) {
    const networkMatch = dle.deployedNetworks?.find(
      (net) => net.address?.toLowerCase() === dleAddress.value.toLowerCase()
    );
    if (networkMatch) {
      dleInfo.value = { ...dle, deployedNetworks: dle.deployedNetworks || [] };
      formData.value.name = dle.name || dle.dleName || formData.value.name;
      formData.value.symbol = dle.symbol || dle.dleSymbol || formData.value.symbol;
      formData.value.location = dle.location || formData.value.location;
      formData.value.coordinates = dle.coordinates || formData.value.coordinates;
      formData.value.jurisdiction = Number(dle.jurisdiction || formData.value.jurisdiction);
      if (Array.isArray(dle.okvedCodes)) formData.value.okvedCodes = dle.okvedCodes.join(', ');
      formData.value.kpp = Number(dle.kpp || 0);
      return;
    }
  }
}

async function submitForm() {
  proposalResult.value = null;
  try {
    if (!opReady.value) throw new Error(t('smartcontracts.dleCoreOp.unsupportedOp'));
    if (!dleAddress.value) throw new Error(t('smartcontracts.moduleBridgeOp.noDle'));
    if (!formData.value.description.trim()) {
      throw new Error(t('smartcontracts.moduleBridgeOp.descriptionRequired'));
    }
    if (op.value === 'updateQuorum') {
      const q = Number(formData.value.quorum);
      if (!Number.isInteger(q) || q < 1 || q > 100) throw new Error(t('smartcontracts.dleCoreOp.invalidQuorum'));
    }
    if (op.value === 'updateVotingDurations') {
      const min = Number(formData.value.minDuration);
      const max = Number(formData.value.maxDuration);
      if (!(min > 0 && max >= min)) throw new Error(t('smartcontracts.dleCoreOp.invalidDurations'));
    }
    if (!hasVotingChain.value) {
      throw new Error(t('smartcontracts.createProposal.votingChainRequired'));
    }

    const chainId = Number(votingChain.value);
    const networks = dleInfo.value?.deployedNetworks || [];
    const net = networks.find((n) => Number(n.chainId) === chainId);
    const bookAddress = net?.address || dleAddress.value;

    isSubmitting.value = true;
    const operation = encodeOperation();

    const switched = await switchToVotingNetwork(chainId);
    if (!switched) {
      throw new Error(t('smartcontracts.moduleBridgeOp.networkSwitchFailed', { chainId }));
    }
    await new Promise((r) => setTimeout(r, 800));
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
      message: t('smartcontracts.dleCoreOp.successMessage', { id: result.proposalId || '—' }),
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
  if (op.value === 'setActive' && !String(formData.value.description || '').trim()) {
    formData.value.description = t('smartcontracts.dleCoreOp.activeDefaultDescription');
  }
});
</script>

<style scoped>
.dle-core-op-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 1rem;
}
.op-form h2 { margin: 0 0 0.5rem; font-size: 1.25rem; }
.op-blurb {
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
