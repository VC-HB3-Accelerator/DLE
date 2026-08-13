<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div class="rag-reliability-tab">
    <div class="settings-section panel">
      <h3>{{ $t('settings.ai.assistant.dedupTitle') }}</h3>
      <label class="checkbox-label">
        <input type="checkbox" v-model="dedup.enabled" />
        {{ $t('settings.ai.assistant.enableDedup') }}
      </label>
      <label class="form-label">{{ $t('settings.ai.assistant.dedupTtl') }}</label>
      <input type="number" v-model.number="dedup.ttl" class="form-control form-control--narrow" min="1000" step="1000" />
    </div>

    <div class="settings-section panel">
      <h3>{{ $t('settings.ai.assistant.timeoutsTitle') }}</h3>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.timeoutOllamaChat') }}</label>
          <input type="number" v-model.number="timeoutsLocal.ollamaChat" class="form-control form-control--narrow" min="1000" step="1000" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.timeoutOllamaEmbedding') }}</label>
          <input type="number" v-model.number="timeoutsLocal.ollamaEmbedding" class="form-control form-control--narrow" min="1000" step="1000" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.timeoutVectorSearch') }}</label>
          <input type="number" v-model.number="timeoutsLocal.vectorSearch" class="form-control form-control--narrow" min="1000" step="1000" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.timeoutVectorUpsert') }}</label>
          <input type="number" v-model.number="timeoutsLocal.vectorUpsert" class="form-control form-control--narrow" min="1000" step="1000" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.timeoutVectorHealth') }}</label>
          <input type="number" v-model.number="timeoutsLocal.vectorHealth" class="form-control form-control--narrow" min="1000" step="1000" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.timeoutOllamaHealth') }}</label>
          <input type="number" v-model.number="timeoutsLocal.ollamaHealth" class="form-control form-control--narrow" min="1000" step="1000" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.timeoutOllamaTags') }}</label>
          <input type="number" v-model.number="timeoutsLocal.ollamaTags" class="form-control form-control--narrow" min="1000" step="1000" />
        </div>
      </div>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-primary" :disabled="saving" @click="onSave">{{ $t('common.save') }}</button>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue';

const props = defineProps({
  deduplicationSettings: { type: Object, required: true },
  timeouts: { type: Object, required: true },
  saving: { type: Boolean, default: false }
});
const emit = defineEmits(['save']);

const dedup = reactive({ enabled: true, ttl: 300000 });
const timeoutsLocal = reactive({
  ollamaChat: 600000,
  ollamaEmbedding: 90000,
  vectorSearch: 90000,
  vectorUpsert: 600000,
  vectorHealth: 5000,
  ollamaHealth: 5000,
  ollamaTags: 10000
});

watch(() => props.deduplicationSettings, (v) => { if (v) Object.assign(dedup, v); }, { immediate: true, deep: true });
watch(() => props.timeouts, (v) => { if (v) Object.assign(timeoutsLocal, v); }, { immediate: true, deep: true });

function onSave() {
  emit('save', {
    deduplication_settings: { ...dedup },
    timeouts: { ...timeoutsLocal }
  });
}
</script>

<style scoped>
.settings-section { padding: 1rem; margin-bottom: 1rem; }
.form-label { display: block; margin-top: 0.5rem; font-weight: 600; }
.form-control--narrow { max-width: 12rem; }
.form-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); gap: 0.75rem; }
.checkbox-label { display: flex; align-items: center; gap: 0.5rem; margin: 0.5rem 0; }
</style>
