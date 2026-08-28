<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="remove-module-page page-with-close">
      <PageCloseButton :on-navigate="goBack" />

      <header class="remove-module-page__header">
        <p v-if="dleAddress" class="remove-module-page__addr">{{ dleAddress }}</p>
      </header>

      <div v-if="!isAuthenticated" class="remove-module-page__alert">
        {{ t('smartcontracts.createProposal.authRequiredHint') }}
      </div>
      <div v-else-if="!dleAddress" class="remove-module-page__alert">
        {{ t('smartcontracts.removeModule.missingDleAddress') }}
      </div>

      <form
        v-else
        class="remove-module-form"
        @submit.prevent="onSubmit"
      >
        <h1 class="remove-module-form__title">{{ t('smartcontracts.removeModule.title') }}</h1>
        <p class="remove-module-form__hint">{{ t('smartcontracts.removeModule.hint') }}</p>

        <VotingChainSelect
          v-model="votingChain"
          :chains="chains"
          :is-loading="isLoadingChains || loading"
        />

        <label class="remove-module-form__field">
          <span class="remove-module-form__label">{{ t('smartcontracts.removeModule.moduleTypeLabel') }}</span>
          <select v-model="form.moduleType" class="remove-module-form__control" required :disabled="loading || !hasVotingChain">
            <option disabled value="">{{ t('smartcontracts.removeModule.moduleTypePlaceholder') }}</option>
            <option
              v-for="m in bookedModules"
              :key="m.moduleType"
              :value="m.moduleType"
            >
              {{ displayName(m.moduleType) }} — {{ shortAddr(m.address) }}
            </option>
          </select>
        </label>

        <p v-if="loading" class="remove-module-form__muted">{{ t('common.loading') }}</p>
        <p v-else-if="hasVotingChain && !bookedModules.length" class="remove-module-form__warn">
          {{ t('smartcontracts.removeModule.empty') }}
        </p>

        <div v-if="selectedModule" class="remove-module-form__preview">
          <div class="remove-module-form__preview-row">
            <span class="remove-module-form__preview-label">{{ t('smartcontracts.removeModule.currentAddress') }}</span>
            <span class="remove-module-form__preview-value">{{ selectedModule.address }}</span>
          </div>
          <div class="remove-module-form__preview-row">
            <span class="remove-module-form__preview-label">{{ t('smartcontracts.removeModule.slotId') }}</span>
            <span class="remove-module-form__preview-value remove-module-form__preview-value--mono">{{ selectedModule.moduleId }}</span>
          </div>
        </div>

        <label class="remove-module-form__field">
          <span class="remove-module-form__label">{{ t('smartcontracts.removeModule.votingDurationLabel') }}</span>
          <input
            v-model.number="form.votingDuration"
            class="remove-module-form__control"
            type="number"
            min="1"
            max="365"
            required
          >
        </label>

        <label class="remove-module-form__field">
          <span class="remove-module-form__label">{{ t('smartcontracts.removeModule.descriptionLabel') }}</span>
          <textarea
            v-model="form.description"
            class="remove-module-form__control remove-module-form__textarea"
            rows="3"
            required
            maxlength="500"
          />
        </label>

        <p v-if="error" class="remove-module-form__error">{{ error }}</p>

        <div class="remove-module-form__actions">
          <button type="button" class="btn btn-secondary" @click="goBack">{{ t('common.cancel') }}</button>
          <button type="submit" class="btn btn-primary" :disabled="saving || !canSubmit">
            {{ saving ? t('smartcontracts.removeModule.creating') : t('smartcontracts.removeModule.submit') }}
          </button>
        </div>
      </form>
    </div>
  </BaseLayout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import { getAllModules } from '../../services/modulesService.js';
import { createRemoveModuleProposal, getCanonicalModuleId } from '../../utils/dle-contract.js';
import VotingChainSelect from '@/components/VotingChainSelect.vue';
import { useVotingChains } from '@/composables/useVotingChains.js';

defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});
defineEmits(['auth-action-completed']);

const { t, te } = useI18n();
const route = useRoute();
const router = useRouter();

const dleAddress = computed(() => route.query.address || '');
const {
  chains,
  votingChain,
  isLoading: isLoadingChains,
  hasVotingChain,
  hubQuery,
} = useVotingChains(dleAddress);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const allModulesRaw = ref([]);

const form = ref({
  moduleType: '',
  votingDuration: 7,
  description: '',
});

const bookedModules = computed(() => {
  const cid = Number(votingChain.value);
  if (!Number.isFinite(cid) || cid <= 0) return [];
  return allModulesRaw.value
    .map((m) => {
      if (String(m.id || '').endsWith('-pending')) return null;
      const rows = m.addresses || [];
      if (rows.length) {
        const row = rows.find((a) => Number(a.chainId) === cid);
        const address = (row && row.address) || '';
        if (!(row?.inBook && address)) return null;
        return {
          moduleType: m.moduleType,
          address,
          moduleId: m.moduleId,
        };
      }
      return null;
    })
    .filter((m) => m && m.moduleType);
});

const selectedModule = computed(() =>
  bookedModules.value.find((m) => m.moduleType === form.value.moduleType) || null
);

const canSubmit = computed(() =>
  Boolean(
    form.value.moduleType
    && hasVotingChain.value
    && form.value.votingDuration >= 1
    && form.value.description.trim()
  )
);

function displayName(type) {
  const key = `smartcontracts.removeModule.types.${type}`;
  if (te(key)) return t(key);
  const addKey = `smartcontracts.addModule.moduleNames.${type}`;
  if (te(addKey)) return t(addKey);
  return type;
}

function shortAddr(addr) {
  const s = String(addr || '');
  if (s.length < 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function goBack() {
  router.push({
    path: '/management/create-proposal',
    query: hubQuery(),
  });
}

async function load() {
  if (!dleAddress.value) return;
  loading.value = true;
  error.value = '';
  try {
    const response = await getAllModules(dleAddress.value);
    const data = response?.data || response || {};
    allModulesRaw.value = data.modules || [];
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || t('smartcontracts.removeModule.loadError');
  } finally {
    loading.value = false;
  }
}

watch(() => form.value.moduleType, (type) => {
  if (!type) return;
  form.value.description = t('smartcontracts.removeModule.autoDescription', {
    moduleName: displayName(type),
  });
});

watch(votingChain, () => {
  if (form.value.moduleType && !bookedModules.value.some((m) => m.moduleType === form.value.moduleType)) {
    form.value.moduleType = '';
  }
});

async function onSubmit() {
  if (!canSubmit.value) return;
  saving.value = true;
  error.value = '';
  try {
    const moduleId = selectedModule.value?.moduleId || getCanonicalModuleId(form.value.moduleType);
    if (!moduleId) throw new Error(t('smartcontracts.removeModule.unknownType'));
    await createRemoveModuleProposal(
      dleAddress.value,
      form.value.description.trim(),
      Number(form.value.votingDuration) * 24 * 60 * 60,
      moduleId,
      Number(votingChain.value)
    );
    router.push(`/management/proposals?address=${dleAddress.value}`);
  } catch (e) {
    error.value = e?.response?.data?.error || e?.shortMessage || e?.reason || e?.message
      || t('smartcontracts.removeModule.createFailed');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.remove-module-page {
  max-width: 640px;
  margin: 0 auto;
  padding: 1.25rem 1.5rem 2.75rem;
}

.remove-module-page__header {
  margin-bottom: 1rem;
}

.remove-module-page__addr {
  margin: 0;
  opacity: 0.7;
  font-size: 0.88rem;
  word-break: break-all;
}

.remove-module-page__alert {
  padding: 0.9rem 1rem;
  border-radius: 10px;
  background: color-mix(in srgb, currentColor 8%, transparent);
  line-height: 1.45;
}

.remove-module-form {
  display: flex;
  flex-direction: column;
  gap: 0.95rem;
  padding: 1.15rem 1.2rem 1.35rem;
  border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, currentColor 3%, transparent);
}

.remove-module-form__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 650;
  line-height: 1.25;
}

.remove-module-form__hint {
  margin: 0;
  opacity: 0.78;
  font-size: 0.92rem;
  line-height: 1.45;
}

.remove-module-form__field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.remove-module-form__label {
  font-size: 0.88rem;
  opacity: 0.9;
}

.remove-module-form__control {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
  border-radius: 10px;
  padding: 0.55rem 0.75rem;
  background: var(--theme-surface, #fff);
  color: inherit;
  font: inherit;
}

.remove-module-form__textarea {
  resize: vertical;
  min-height: 5rem;
}

.remove-module-form__muted,
.remove-module-form__warn {
  margin: 0;
  opacity: 0.78;
  font-size: 0.9rem;
}

.remove-module-form__error {
  margin: 0;
  color: #b42318;
  font-size: 0.9rem;
  line-height: 1.4;
}

.remove-module-form__preview {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.85rem 0.95rem;
  border-radius: 10px;
  background: color-mix(in srgb, currentColor 6%, transparent);
  border: 1px solid color-mix(in srgb, currentColor 8%, transparent);
}

.remove-module-form__preview-row {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.remove-module-form__preview-label {
  font-size: 0.8rem;
  opacity: 0.7;
}

.remove-module-form__preview-value {
  font-size: 0.9rem;
  word-break: break-all;
}

.remove-module-form__preview-value--mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.78rem;
  opacity: 0.85;
}

.remove-module-form__actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 0.25rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  cursor: pointer;
  border-radius: 10px;
  padding: 0.55rem 1rem;
  font: inherit;
  min-height: 2.5rem;
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary, #1a5fff);
  color: #fff;
}

.btn-secondary {
  background: color-mix(in srgb, currentColor 10%, transparent);
  color: inherit;
}

@media (max-width: 640px) {
  .remove-module-page {
    padding: 1rem 1rem 2rem;
  }

  .remove-module-form {
    padding: 1rem;
  }

  .remove-module-form__actions {
    flex-direction: column-reverse;
  }

  .btn {
    width: 100%;
  }
}
</style>
