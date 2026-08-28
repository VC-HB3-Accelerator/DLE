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
    <div class="treasury-bridge-op-page page-with-close">
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
        <p class="bridge-hint">{{ t('smartcontracts.treasuryBridgeOp.bridgeHint') }}</p>

        <form @submit.prevent="submitForm">
          <VotingChainSelect
            v-model="votingChain"
            :chains="votingChains"
            :is-loading="isLoadingVotingChains"
          />

          <template v-if="isTransferFunds">
            <div class="form-group">
              <label class="form-label" for="tokenAddress">{{ t('smartcontracts.treasuryBridgeOp.tokenLabel') }}</label>
              <input id="tokenAddress" v-model="formData.tokenAddress" class="form-input" type="text" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="tokenDecimals">{{ t('smartcontracts.treasuryBridgeOp.decimalsLabel') }}</label>
              <input id="tokenDecimals" v-model.number="formData.tokenDecimals" class="form-input" type="number" min="0" max="18" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="recipient">{{ t('smartcontracts.treasuryBridgeOp.recipientLabel') }}</label>
              <input id="recipient" v-model="formData.recipient" class="form-input" type="text" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="amountHuman">{{ t('smartcontracts.treasuryBridgeOp.amountLabel') }}</label>
              <input id="amountHuman" v-model="formData.amountHuman" class="form-input" type="text" required>
              <small class="form-help">{{ t('smartcontracts.treasuryBridgeOp.amountHelp') }}</small>
            </div>
            <div class="form-group">
              <label class="form-label" for="proposalRef">{{ t('smartcontracts.treasuryBridgeOp.proposalRefLabel') }}</label>
              <input id="proposalRef" v-model="formData.proposalRef" class="form-input" type="text" :placeholder="t('smartcontracts.treasuryBridgeOp.proposalRefPlaceholder')">
              <small class="form-help">{{ t('smartcontracts.treasuryBridgeOp.proposalRefHelp') }}</small>
            </div>
          </template>

          <template v-else-if="isNftTransfer">
            <div class="form-group">
              <label class="form-label" for="nftContract">{{ t('smartcontracts.treasuryBridgeOp.nftContractLabel') }}</label>
              <input id="nftContract" v-model="formData.tokenAddress" class="form-input" type="text" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="nftRecipient">{{ t('smartcontracts.treasuryBridgeOp.recipientLabel') }}</label>
              <input id="nftRecipient" v-model="formData.recipient" class="form-input" type="text" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="tokenId">{{ t('smartcontracts.treasuryBridgeOp.tokenIdLabel') }}</label>
              <input id="tokenId" v-model="formData.tokenId" class="form-input" type="text" required>
            </div>
            <div v-if="isTransfer1155" class="form-group">
              <label class="form-label" for="nftAmount">{{ t('smartcontracts.treasuryBridgeOp.nftAmountLabel') }}</label>
              <input id="nftAmount" v-model="formData.amountHuman" class="form-input" type="text" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="proposalRefNft">{{ t('smartcontracts.treasuryBridgeOp.proposalRefLabel') }}</label>
              <input id="proposalRefNft" v-model="formData.proposalRef" class="form-input" type="text" :placeholder="t('smartcontracts.treasuryBridgeOp.proposalRefPlaceholder')">
              <small class="form-help">{{ t('smartcontracts.treasuryBridgeOp.proposalRefHelpNft') }}</small>
            </div>
          </template>

          <template v-else-if="isAddToken">
            <div class="form-group">
              <label class="form-label" for="tokenAddressAdd">{{ t('smartcontracts.treasuryBridgeOp.tokenLabel') }}</label>
              <input id="tokenAddressAdd" v-model="formData.tokenAddress" class="form-input" type="text" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="symbol">{{ t('smartcontracts.treasuryBridgeOp.symbolLabel') }}</label>
              <input id="symbol" v-model="formData.symbol" class="form-input" type="text" maxlength="20" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="decimalsAdd">{{ t('smartcontracts.treasuryBridgeOp.decimalsLabel') }}</label>
              <input id="decimalsAdd" v-model.number="formData.tokenDecimals" class="form-input" type="number" min="0" max="18" required>
            </div>
          </template>

          <template v-else-if="isRemoveToken">
            <div class="form-group">
              <label class="form-label" for="tokenAddressRemove">{{ t('smartcontracts.treasuryBridgeOp.tokenLabel') }}</label>
              <input id="tokenAddressRemove" v-model="formData.tokenAddress" class="form-input" type="text" required>
            </div>
          </template>

          <template v-else-if="isSetTokenStatus">
            <div class="form-group">
              <label class="form-label" for="tokenAddressStatus">{{ t('smartcontracts.treasuryBridgeOp.tokenLabel') }}</label>
              <input id="tokenAddressStatus" v-model="formData.tokenAddress" class="form-input" type="text" required>
            </div>
            <div class="form-group form-group--check">
              <label class="form-label" for="tokenIsActive">
                <input id="tokenIsActive" v-model="formData.isActive" type="checkbox">
                {{ t('smartcontracts.treasuryBridgeOp.tokenActiveLabel') }}
              </label>
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
import {
  createProposal,
  encodeTreasuryBridgeOperation,
  findBookedModuleId,
  isTreasuryFundsBridgeOp,
  switchToVotingNetwork,
} from '@/utils/dle-contract';
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
const moduleType = computed(() => String(route.query.moduleType || 'treasury'));
const functionName = computed(() => String(route.query.op || ''));
const {
  chains: votingChains,
  votingChain,
  isLoading: isLoadingVotingChains,
  hasVotingChain,
  hubQuery,
} = useVotingChains(dleAddress);

const isTransferFunds = computed(() => functionName.value === 'transferFunds');
const isTransfer721 = computed(() => functionName.value === 'transferERC721');
const isTransfer1155 = computed(() => functionName.value === 'transferERC1155');
const isNftTransfer = computed(() => isTransfer721.value || isTransfer1155.value);
const isAddToken = computed(() => functionName.value === 'addToken');
const isRemoveToken = computed(() => functionName.value === 'removeToken');
const isSetTokenStatus = computed(() => functionName.value === 'setTokenStatus');
const opReady = computed(() => isTreasuryFundsBridgeOp(moduleType.value, functionName.value));

const dleInfo = ref(null);
const isSubmitting = ref(false);
const proposalResult = ref(null);
const formData = ref({
  tokenAddress: String(route.query.token || ''),
  tokenDecimals: Number(route.query.decimals || 18),
  recipient: String(route.query.recipient || ''),
  amountHuman: String(route.query.amount || ''),
  tokenId: String(route.query.tokenId || ''),
  proposalRef: String(route.query.proposalRef || ''),
  symbol: String(route.query.symbol || ''),
  isActive: String(route.query.isActive || 'true').toLowerCase() !== 'false',
  description: String(route.query.description || ''),
  votingDuration: '604800',
});

function i18nOp(suffix) {
  return `smartcontracts.createProposal.modules.treasury.ops.${functionName.value}.${suffix}`;
}

const pageTitle = computed(() => translateIfExists(
  t,
  i18nOp('title'),
  undefined,
  functionName.value,
  messages.value?.[locale.value] || messages.value?.en
));

const pageBlurb = computed(() => translateIfExists(
  t,
  i18nOp('description'),
  undefined,
  '',
  messages.value?.[locale.value] || messages.value?.en
));

function goBack() {
  if (route.query.returnTo) {
    router.push(String(route.query.returnTo));
    return;
  }
  router.push({
    path: '/management/create-proposal',
    query: hubQuery(),
  });
}

function resolveProposalIdBytes32() {
  const raw = String(formData.value.proposalRef || '').trim();
  if (!raw) return ethers.ZeroHash;
  if (/^0x[0-9a-fA-F]{64}$/.test(raw)) return raw;
  return ethers.keccak256(ethers.toUtf8Bytes(raw));
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
    if (!formData.value.description.trim()) {
      throw new Error(t('smartcontracts.moduleBridgeOp.descriptionRequired'));
    }
    if (!formData.value.votingDuration) {
      throw new Error(t('smartcontracts.moduleBridgeOp.durationRequired'));
    }

    let args;
    if (isTransferFunds.value) {
      if (!ethers.isAddress(formData.value.tokenAddress)) {
        throw new Error(t('smartcontracts.treasuryBridgeOp.invalidToken'));
      }
      if (!ethers.isAddress(formData.value.recipient) || formData.value.recipient === ethers.ZeroAddress) {
        throw new Error(t('smartcontracts.treasuryBridgeOp.invalidRecipient'));
      }
      const decimals = Number(formData.value.tokenDecimals);
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
        throw new Error(t('smartcontracts.treasuryBridgeOp.invalidDecimals'));
      }
      const amountUnits = ethers.parseUnits(String(formData.value.amountHuman).trim(), decimals);
      if (amountUnits <= 0n) throw new Error(t('smartcontracts.treasuryBridgeOp.invalidAmount'));
      args = {
        tokenAddress: formData.value.tokenAddress,
        recipient: formData.value.recipient,
        amountUnits,
        proposalIdBytes32: resolveProposalIdBytes32(),
      };
    } else if (isNftTransfer.value) {
      if (!ethers.isAddress(formData.value.tokenAddress)) {
        throw new Error(t('smartcontracts.treasuryBridgeOp.invalidToken'));
      }
      if (!ethers.isAddress(formData.value.recipient) || formData.value.recipient === ethers.ZeroAddress) {
        throw new Error(t('smartcontracts.treasuryBridgeOp.invalidRecipient'));
      }
      let tokenId;
      try {
        tokenId = BigInt(String(formData.value.tokenId).trim());
      } catch {
        throw new Error(t('smartcontracts.treasuryBridgeOp.invalidTokenId'));
      }
      if (tokenId < 0n) throw new Error(t('smartcontracts.treasuryBridgeOp.invalidTokenId'));
      if (isTransfer721.value) {
        args = {
          tokenAddress: formData.value.tokenAddress,
          recipient: formData.value.recipient,
          tokenId,
          proposalIdBytes32: resolveProposalIdBytes32(),
        };
      } else {
        let amountUnits;
        try {
          amountUnits = BigInt(String(formData.value.amountHuman).trim());
        } catch {
          throw new Error(t('smartcontracts.treasuryBridgeOp.invalidAmount'));
        }
        if (amountUnits <= 0n) throw new Error(t('smartcontracts.treasuryBridgeOp.invalidAmount'));
        args = {
          tokenAddress: formData.value.tokenAddress,
          recipient: formData.value.recipient,
          tokenId,
          amountUnits,
          proposalIdBytes32: resolveProposalIdBytes32(),
        };
      }
    } else if (isAddToken.value) {
      if (!ethers.isAddress(formData.value.tokenAddress) && formData.value.tokenAddress !== ethers.ZeroAddress) {
        if (!ethers.isAddress(formData.value.tokenAddress)) {
          throw new Error(t('smartcontracts.treasuryBridgeOp.invalidToken'));
        }
      }
      const symbol = String(formData.value.symbol || '').trim();
      if (!symbol || symbol.length > 20) throw new Error(t('smartcontracts.treasuryBridgeOp.invalidSymbol'));
      const decimals = Number(formData.value.tokenDecimals);
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
        throw new Error(t('smartcontracts.treasuryBridgeOp.invalidDecimals'));
      }
      args = {
        tokenAddress: formData.value.tokenAddress,
        symbol,
        decimals,
      };
    } else if (isRemoveToken.value) {
      if (!ethers.isAddress(formData.value.tokenAddress)) {
        throw new Error(t('smartcontracts.treasuryBridgeOp.invalidToken'));
      }
      args = { tokenAddress: formData.value.tokenAddress };
    } else if (isSetTokenStatus.value) {
      if (!ethers.isAddress(formData.value.tokenAddress)) {
        throw new Error(t('smartcontracts.treasuryBridgeOp.invalidToken'));
      }
      args = {
        tokenAddress: formData.value.tokenAddress,
        isActive: Boolean(formData.value.isActive),
      };
    } else {
      throw new Error(t('smartcontracts.moduleBridgeOp.unsupportedOp'));
    }

    if (!hasVotingChain.value) {
      throw new Error(t('smartcontracts.createProposal.votingChainRequired'));
    }

    const chainId = Number(votingChain.value);
    const networks = dleInfo.value?.deployedNetworks || [];
    const net = networks.find((n) => Number(n.chainId) === chainId);
    const bookAddress = net?.address || dleAddress.value;

    isSubmitting.value = true;
    const switched = await switchToVotingNetwork(chainId);
    if (!switched) {
      throw new Error(t('smartcontracts.moduleBridgeOp.networkSwitchFailed', { chainId }));
    }
    await new Promise((r) => setTimeout(r, 800));
    const moduleId = await findBookedModuleId(bookAddress, 'treasury', chainId);
    if (!moduleId) throw new Error(t('smartcontracts.moduleBridgeOp.moduleNotInBook'));

    const operation = encodeTreasuryBridgeOperation(functionName.value, moduleId, args);
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
      message: t('smartcontracts.treasuryBridgeOp.successMessage', {
        id: result.proposalId || '—',
      }),
      proposalId: result.proposalId,
    };

    if (route.query.returnTo) {
      router.push({
        path: String(route.query.returnTo),
        query: {
          proposalId: result.proposalId || undefined,
          orderId: route.query.orderId || undefined,
        },
      });
    } else {
      router.push(`/management/proposals?address=${dleAddress.value}`);
    }
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
});
</script>

<style scoped>
.treasury-bridge-op-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 1rem;
}
.op-form h2 { margin: 0 0 0.5rem; font-size: 1.25rem; }
.op-blurb, .bridge-hint {
  color: var(--color-text-light, #6c757d);
  font-size: 0.9rem;
  margin: 0 0 0.75rem;
}
.form-group { margin-bottom: 1rem; }
.form-group--check .form-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}
.form-label { display: block; font-weight: 600; margin-bottom: 0.35rem; }
.form-input, .form-textarea, .form-select {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--color-border, #dee2e6);
  border-radius: var(--radius-md, 6px);
  box-sizing: border-box;
}
.form-help { display: block; color: var(--color-text-light, #6c757d); font-size: 0.8rem; margin-top: 0.25rem; }
.form-actions { margin-top: 1.25rem; }
.proposal-result { margin-top: 1rem; }
</style>
