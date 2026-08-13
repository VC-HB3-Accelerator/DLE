<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div class="rag-models-tab">
    <div class="settings-section panel">
      <h3>{{ $t('settings.ai.assistant.llmParamsTitle') }}</h3>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.temperature') }}</label>
          <input type="number" v-model.number="llm.temperature" class="form-control form-control--narrow" min="0" max="2" step="0.1" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.maxTokens') }}</label>
          <input type="number" v-model.number="llm.maxTokens" class="form-control form-control--narrow" min="1" max="4000" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.topP') }}</label>
          <input type="number" v-model.number="llm.top_p" class="form-control form-control--narrow" min="0" max="1" step="0.01" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.topK') }}</label>
          <input type="number" v-model.number="llm.top_k" class="form-control form-control--narrow" min="1" max="100" />
        </div>
      </div>
      <label class="form-label">{{ $t('settings.ai.assistant.repeatPenalty') }}</label>
      <input type="number" v-model.number="llm.repeat_penalty" class="form-control form-control--narrow" min="1" max="2" step="0.1" />
    </div>

    <div class="settings-section panel">
      <h3>{{ $t('settings.ai.assistant.qwenParamsTitle') }}</h3>
      <label class="form-label">{{ $t('settings.ai.assistant.format') }}</label>
      <select v-model="qwen.format" class="form-control">
        <option :value="null">{{ $t('settings.ai.assistant.formatAuto') }}</option>
        <option value="json">{{ $t('settings.ai.assistant.formatJson') }}</option>
      </select>
    </div>

    <div class="settings-section panel">
      <h3>{{ $t('settings.ai.assistant.embeddingParamsTitle') }}</h3>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.batchSize') }}</label>
          <input type="number" v-model.number="embed.batch_size" class="form-control form-control--narrow" min="1" max="128" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.dimension') }}</label>
          <input type="number" v-model.number="embed.dimension" class="form-control form-control--narrow" min="0" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.pooling') }}</label>
          <select v-model="embed.pooling" class="form-control">
            <option value="mean">{{ $t('settings.ai.assistant.poolingMean') }}</option>
            <option value="max">{{ $t('settings.ai.assistant.poolingMax') }}</option>
            <option value="cls">{{ $t('settings.ai.assistant.poolingCls') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="embed.normalize" />
            {{ $t('settings.ai.assistant.normalizeVectors') }}
          </label>
        </div>
      </div>
      <p class="form-hint">{{ $t('settings.ai.rag.modelPickOnAssistant') }}</p>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-primary" :disabled="saving" @click="onSave">{{ $t('common.save') }}</button>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue';

const props = defineProps({
  llmParameters: { type: Object, required: true },
  qwenParameters: { type: Object, required: true },
  embeddingParameters: { type: Object, required: true },
  saving: { type: Boolean, default: false }
});
const emit = defineEmits(['save']);

const llm = reactive({ temperature: 0.3, maxTokens: 150, top_p: 0.9, top_k: 40, repeat_penalty: 1.1 });
const qwen = reactive({ format: null });
const embed = reactive({ batch_size: 32, normalize: true, dimension: null, pooling: 'mean' });

watch(() => props.llmParameters, (v) => { if (v) Object.assign(llm, v); }, { immediate: true, deep: true });
watch(() => props.qwenParameters, (v) => { if (v) Object.assign(qwen, v); }, { immediate: true, deep: true });
watch(() => props.embeddingParameters, (v) => { if (v) Object.assign(embed, v); }, { immediate: true, deep: true });

function onSave() {
  emit('save', {
    llm_parameters: { ...llm },
    qwen_specific_parameters: { ...qwen },
    embedding_parameters: { ...embed }
  });
}
</script>

<style scoped>
.settings-section { padding: 1rem; margin-bottom: 1rem; }
.form-label { display: block; margin-top: 0.5rem; font-weight: 600; }
.form-control { width: 100%; max-width: 20rem; }
.form-control--narrow { max-width: 10rem; }
.form-row { display: flex; flex-wrap: wrap; gap: 1rem; }
.form-group { flex: 1; min-width: 10rem; }
.checkbox-label { display: flex; align-items: center; gap: 0.5rem; margin-top: 1.5rem; }
.form-hint { color: var(--text-muted, #666); margin-top: 0.75rem; }
</style>
