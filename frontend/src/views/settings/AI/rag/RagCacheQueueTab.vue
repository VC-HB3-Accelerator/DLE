<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div class="rag-cache-queue-tab">
    <div class="settings-section panel">
      <h3>{{ $t('settings.ai.assistant.cacheTitle') }}</h3>
      <span class="badge badge-info">ENV USE_AI_CACHE={{ String(runtime?.envOverrides?.USE_AI_CACHE) }}</span>
      <p class="form-hint">{{ $t('settings.ai.rag.envKillSwitchHint') }}</p>
      <label class="checkbox-label">
        <input type="checkbox" v-model="cache.enabled" />
        {{ $t('settings.ai.assistant.enableCache') }}
      </label>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.llmTtl') }}</label>
          <input type="number" v-model.number="cache.llmTTL" class="form-control form-control--narrow" min="0" step="1000" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.ragTtl') }}</label>
          <input type="number" v-model.number="cache.ragTTL" class="form-control form-control--narrow" min="0" step="1000" />
        </div>
      </div>
      <label class="form-label">{{ $t('settings.ai.assistant.cacheMaxSize') }}</label>
      <input type="number" v-model.number="cache.maxSize" class="form-control form-control--narrow" min="1" max="10000" />
    </div>

    <div class="settings-section panel">
      <h3>{{ $t('settings.ai.assistant.queueTitle') }}</h3>
      <span class="badge badge-info">ENV USE_AI_QUEUE={{ String(runtime?.envOverrides?.USE_AI_QUEUE) }}</span>
      <label class="checkbox-label">
        <input type="checkbox" v-model="queue.enabled" />
        {{ $t('settings.ai.assistant.enableQueue') }}
      </label>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.queueTimeout') }}</label>
          <input type="number" v-model.number="queue.timeout" class="form-control form-control--narrow" min="1000" step="1000" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.queueMaxSize') }}</label>
          <input type="number" v-model.number="queue.maxSize" class="form-control form-control--narrow" min="1" max="1000" />
        </div>
      </div>
      <label class="form-label">{{ $t('settings.ai.assistant.queueInterval') }}</label>
      <input type="number" v-model.number="queue.interval" class="form-control form-control--narrow" min="10" step="10" />
      <div v-if="runtime?.queue?.priorities" class="priorities">
        <h4>{{ $t('settings.ai.rag.queuePriorities') }}</h4>
        <pre class="hints-pre">{{ JSON.stringify(runtime.queue.priorities, null, 2) }}</pre>
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
  cacheSettings: { type: Object, required: true },
  queueSettings: { type: Object, required: true },
  runtime: { type: Object, default: null },
  saving: { type: Boolean, default: false }
});
const emit = defineEmits(['save']);

const cache = reactive({ enabled: true, llmTTL: 86400000, ragTTL: 300000, maxSize: 1000 });
const queue = reactive({ enabled: true, timeout: 180000, maxSize: 100, interval: 100 });

watch(() => props.cacheSettings, (v) => { if (v) Object.assign(cache, v); }, { immediate: true, deep: true });
watch(() => props.queueSettings, (v) => { if (v) Object.assign(queue, v); }, { immediate: true, deep: true });

function onSave() {
  emit('save', {
    cache_settings: { ...cache },
    queue_settings: { ...queue }
  });
}
</script>

<style scoped>
.settings-section { padding: 1rem; margin-bottom: 1rem; }
.form-label { display: block; margin-top: 0.5rem; font-weight: 600; }
.form-control--narrow { max-width: 12rem; }
.form-row { display: flex; flex-wrap: wrap; gap: 1rem; }
.checkbox-label { display: flex; align-items: center; gap: 0.5rem; margin: 0.5rem 0; }
.badge-info { display: inline-block; background: #e0e7ff; color: #3730a3; font-size: 0.75rem; padding: 0.15rem 0.45rem; border-radius: 4px; }
.form-hint { color: var(--text-muted, #666); }
.hints-pre { background: #f8fafc; padding: 0.75rem; font-size: 0.8rem; overflow: auto; }
</style>
