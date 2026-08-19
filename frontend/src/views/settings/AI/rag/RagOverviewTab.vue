<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div class="rag-overview-tab">
    <SystemMonitoring />

    <div class="runtime-panel panel settings-section">
      <h3>{{ $t('settings.ai.rag.runtimeTitle') }}</h3>
      <button type="button" class="btn btn-outline btn-sm" :disabled="refreshing" @click="refresh">
        {{ $t('settings.ai.rag.refreshRuntime') }}
      </button>
      <div v-if="!runtime" class="form-hint">{{ $t('settings.ai.rag.runtimeUnavailable') }}</div>
      <template v-else>
        <div class="runtime-grid">
          <div class="runtime-item">
            <span class="runtime-label">{{ $t('settings.ai.rag.weightsEffective') }}</span>
            <code>{{ fmtWeights(runtime.rag?.effectiveHybridWeights) }}</code>
          </div>
          <div class="runtime-item">
            <span class="runtime-label">{{ $t('settings.ai.rag.weightsConfig') }}</span>
            <code>{{ fmtWeights(runtime.rag?.configHybridWeights) }}</code>
          </div>
          <div class="runtime-item">
            <span class="runtime-label">{{ $t('settings.ai.rag.embedProvider') }}</span>
            <code>{{ runtime.embedding?.provider || runtime.pgvector?.embedProvider || 'ollama' }}</code>
          </div>
          <div class="runtime-item">
            <span class="runtime-label">{{ $t('settings.ai.rag.embedDb') }}</span>
            <code>{{ runtime.embedding?.model || runtime.pgvector?.embedModelInDb || runtime.ollama?.embeddingModel || '—' }}</code>
          </div>
          <div class="runtime-item">
            <span class="runtime-label">{{ $t('settings.ai.rag.embedDimension') }}</span>
            <code>{{ runtime.embedding?.dimension || runtime.pgvector?.embedDimension || '—' }}</code>
            <span v-if="runtime.pgvector?.columnDimension" class="badge badge-info">
              pgvector {{ runtime.pgvector.columnDimension }}
            </span>
          </div>
          <div class="runtime-item">
            <span class="runtime-label">{{ $t('settings.ai.rag.embedEnv') }}</span>
            <code>{{ runtime.pgvector?.embedModelInEnv || '—' }}</code>
            <span
              class="badge"
              :class="runtime.pgvector?.modelsMatch ? 'badge-ok' : 'badge-warn'"
            >
              {{ runtime.pgvector?.modelsMatch ? $t('settings.ai.rag.match') : $t('settings.ai.rag.mismatch') }}
            </span>
          </div>
          <div class="runtime-item">
            <span class="runtime-label">{{ $t('settings.ai.rag.vectorHealth') }}</span>
            <code>{{ runtime.pgvector?.healthy === true ? 'OK' : runtime.pgvector?.healthy === false ? 'FAIL' : '—' }}</code>
            <span class="badge badge-ok">pgvector · {{ runtime.pgvector?.chunks ?? '—' }}</span>
          </div>
          <div class="runtime-item">
            <span class="runtime-label">USE_AI_CACHE</span>
            <code>{{ String(runtime.envOverrides?.USE_AI_CACHE) }}</code>
            <span class="badge badge-info">ENV</span>
          </div>
          <div class="runtime-item">
            <span class="runtime-label">USE_AI_QUEUE</span>
            <code>{{ String(runtime.envOverrides?.USE_AI_QUEUE) }}</code>
            <span class="badge badge-info">ENV</span>
          </div>
        </div>
      </template>
    </div>

    <div class="quick-links panel settings-section">
      <h3>{{ $t('settings.ai.rag.quickLinks') }}</h3>
      <div class="btn-row">
        <router-link class="btn btn-outline btn-sm" to="/tables">{{ $t('settings.ai.rag.linkTables') }}</router-link>
        <router-link class="btn btn-outline btn-sm" to="/content/internal">{{ $t('settings.ai.rag.linkDocs') }}</router-link>
        <router-link class="btn btn-outline btn-sm" to="/settings/ai/assistant">{{ $t('settings.ai.rag.linkAssistant') }}</router-link>
        <router-link class="btn btn-outline btn-sm" to="/settings/ai/ollama">{{ $t('settings.ai.rag.linkOllama') }}</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import SystemMonitoring from '@/components/ai-assistant/SystemMonitoring.vue';

const props = defineProps({
  runtime: { type: Object, default: null },
  loadRuntime: { type: Function, required: true }
});

const refreshing = ref(false);

function fmtWeights(w) {
  if (!w) return '—';
  const s = w.semantic;
  const k = w.keyword;
  if (s == null && k == null) return '—';
  const asPct = (n) => (Number(n) <= 1 ? Math.round(Number(n) * 100) : Number(n));
  return `sem ${asPct(s)} / kw ${asPct(k)}`;
}

async function refresh() {
  refreshing.value = true;
  try {
    await props.loadRuntime();
  } finally {
    refreshing.value = false;
  }
}
</script>

<style scoped>
.settings-section { margin-top: 1.25rem; padding: 1rem; }
.runtime-grid { display: grid; gap: 0.75rem; margin-top: 0.75rem; }
.runtime-item { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.runtime-label { min-width: 10rem; font-weight: 600; }
.badge { font-size: 0.75rem; padding: 0.15rem 0.45rem; border-radius: 4px; }
.badge-ok { background: #dcfce7; color: #166534; }
.badge-warn { background: #fef3c7; color: #92400e; }
.badge-info { background: #e0e7ff; color: #3730a3; }
.btn-row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
.form-hint { color: var(--text-muted, #666); margin-top: 0.5rem; }
</style>
