<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div class="rag-vector-tab">
    <div class="settings-section panel">
      <h3>{{ $t('settings.ai.assistant.vectorSearchTitle') }}</h3>
      <label class="form-label">{{ $t('settings.ai.assistant.vectorSearchUrl') }}</label>
      <input type="text" v-model="url" class="form-control" placeholder="http://vector-search:8001" />
      <small class="form-hint">{{ $t('settings.ai.assistant.vectorSearchUrlHelp') }}</small>

      <div v-if="runtime?.vectorSearch" class="embed-status">
        <p>
          <b>{{ $t('settings.ai.rag.embedDb') }}:</b>
          <code>{{ runtime.vectorSearch.embedModelInDb || '—' }}</code>
        </p>
        <p>
          <b>{{ $t('settings.ai.rag.embedEnv') }}:</b>
          <code>{{ runtime.vectorSearch.embedModelInVectorContainer || '—' }}</code>
          <span class="badge" :class="runtime.vectorSearch.modelsMatch ? 'badge-ok' : 'badge-warn'">
            {{ runtime.vectorSearch.modelsMatch ? $t('settings.ai.rag.match') : $t('settings.ai.rag.mismatch') }}
          </span>
        </p>
        <p v-if="!runtime.vectorSearch.modelsMatch" class="form-hint warn">
          {{ $t('settings.ai.rag.embedMismatchHint') }}
        </p>
        <p>
          <b>{{ $t('settings.ai.rag.vectorHealth') }}:</b>
          {{ runtime.vectorSearch.healthy === true ? 'OK' : runtime.vectorSearch.healthy === false ? 'FAIL' : '—' }}
        </p>
      </div>

      <router-link class="btn btn-outline btn-sm" to="/content/internal">{{ $t('settings.ai.rag.linkDocs') }}</router-link>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-primary" :disabled="saving" @click="$emit('save', { vector_search_url: url })">
        {{ $t('common.save') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  vectorSearchUrl: { type: String, default: '' },
  runtime: { type: Object, default: null },
  saving: { type: Boolean, default: false }
});
defineEmits(['save']);

const url = ref(props.vectorSearchUrl || '');
watch(() => props.vectorSearchUrl, (v) => { url.value = v || ''; });
</script>

<style scoped>
.settings-section { padding: 1rem; margin-bottom: 1rem; }
.form-label { display: block; margin-top: 0.5rem; font-weight: 600; }
.form-control { width: 100%; max-width: 36rem; }
.form-hint { color: var(--text-muted, #666); }
.form-hint.warn { color: #92400e; }
.embed-status { margin: 1rem 0; }
.badge { margin-left: 0.5rem; font-size: 0.75rem; padding: 0.15rem 0.45rem; border-radius: 4px; }
.badge-ok { background: #dcfce7; color: #166534; }
.badge-warn { background: #fef3c7; color: #92400e; }
</style>
