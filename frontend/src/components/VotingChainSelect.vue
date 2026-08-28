<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div class="voting-chain-select">
    <label class="voting-chain-select__label" :for="selectId">
      {{ labelText }}
    </label>
    <select
      :id="selectId"
      class="voting-chain-select__control"
      :value="modelValue || ''"
      :disabled="disabled || isLoading || !chains.length"
      :required="required"
      @change="onChange"
    >
      <option value="">{{ placeholderText }}</option>
      <option
        v-for="chain in chains"
        :key="chain.chainId"
        :value="chain.chainId"
      >
        {{ chain.name }} ({{ chain.chainId }})
      </option>
    </select>
    <p class="voting-chain-select__hint">{{ hintText }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  modelValue: { type: [Number, String], default: 0 },
  chains: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  isLoading: { type: Boolean, default: false },
  required: { type: Boolean, default: true },
  hint: { type: String, default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  selectId: { type: String, default: 'votingChain' },
});

const emit = defineEmits(['update:modelValue']);
const { t } = useI18n();

const labelText = computed(
  () => props.label || t('smartcontracts.createProposal.votingChainLabel')
);
const placeholderText = computed(
  () => props.placeholder || t('smartcontracts.createProposal.votingChainPlaceholder')
);
const hintText = computed(
  () => props.hint || t('smartcontracts.createProposal.votingChainHint')
);

function onChange(event) {
  const raw = event.target.value;
  const n = Number(raw);
  emit('update:modelValue', Number.isFinite(n) && n > 0 ? n : 0);
}
</script>

<style scoped>
.voting-chain-select {
  margin-bottom: 16px;
}

.voting-chain-select__label {
  display: block;
  font-weight: 600;
  margin-bottom: 6px;
}

.voting-chain-select__control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-grey-light, #ccc);
  border-radius: var(--radius-md, 8px);
  background: var(--color-white, #fff);
}

.voting-chain-select__hint {
  margin: 6px 0 0;
  font-size: 0.85rem;
  color: var(--color-grey-dark, #555);
}
</style>
