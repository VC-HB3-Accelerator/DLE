<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div class="rag-vector-tab">
    <div class="settings-section panel">
      <h3>{{ $t('settings.ai.assistant.vectorSearchTitle') }}</h3>
      <p class="form-hint">{{ $t('settings.ai.rag.pgvectorHint') }}</p>
      <div v-if="runtime?.pgvector" class="embed-status">
        <p>
          {{ $t('settings.ai.rag.vectorHealth') }}:
          <strong>{{ runtime.pgvector.healthy === true ? 'OK' : runtime.pgvector.healthy === false ? 'FAIL' : '—' }}</strong>
          <span class="badge badge-ok">pgvector</span>
        </p>
        <p>
          {{ $t('settings.ai.rag.pgvectorChunks') }}:
          <code>{{ runtime.pgvector.chunks ?? '—' }}</code>
          (FAQ {{ runtime.pgvector.faq ?? '—' }} · docs {{ runtime.pgvector.documents ?? '—' }})
        </p>
        <p>
          {{ $t('settings.ai.rag.embedProvider') }}:
          <code>{{ runtime.embedding?.provider || runtime.pgvector.embedProvider || 'ollama' }}</code>
        </p>
        <p>
          {{ $t('settings.ai.rag.embedDb') }}:
          <code>{{ runtime.embedding?.model || runtime.pgvector.embedModelInDb || runtime.ollama?.embeddingModel || '—' }}</code>
        </p>
        <p>
          {{ $t('settings.ai.rag.embedDimension') }}:
          <code>{{ runtime.embedding?.dimension || runtime.pgvector.embedDimension || '—' }}</code>
          <span v-if="runtime.pgvector.columnDimension" class="badge badge-info">
            pgvector {{ runtime.pgvector.columnDimension }}
          </span>
        </p>
        <p>
          {{ $t('settings.ai.rag.embedEnv') }}:
          <code>{{ runtime.pgvector.embedModelInEnv || '—' }}</code>
          <span class="badge" :class="runtime.pgvector.modelsMatch ? 'badge-ok' : 'badge-warn'">
            {{ runtime.pgvector.modelsMatch ? $t('settings.ai.rag.match') : $t('settings.ai.rag.mismatch') }}
          </span>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  runtime: { type: Object, default: null },
  saving: { type: Boolean, default: false }
});
</script>

<style scoped>
.settings-section { margin-top: 0.5rem; padding: 1rem; }
.form-hint { color: var(--text-muted, #666); margin: 0.35rem 0 0.75rem; }
.embed-status p { margin: 0.35rem 0; }
.badge { font-size: 0.75rem; padding: 0.15rem 0.45rem; border-radius: 4px; margin-left: 0.35rem; }
.badge-ok { background: #dcfce7; color: #166534; }
.badge-warn { background: #fef3c7; color: #92400e; }
.badge-info { background: #e0e7ff; color: #3730a3; }
</style>
