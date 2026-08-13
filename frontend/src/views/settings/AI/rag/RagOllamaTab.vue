<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div class="rag-ollama-tab">
    <div class="settings-section panel">
      <h3>{{ $t('settings.ai.assistant.ollamaInfra') }}</h3>
      <p class="section-description">{{ $t('settings.ai.rag.ollamaRuntimeNote') }}</p>

      <label class="form-label">{{ $t('settings.ai.assistant.ollamaBaseUrl') }}</label>
      <input type="text" v-model="local.baseUrl" class="form-control" placeholder="http://ollama:11434" />
      <small class="form-hint">{{ $t('settings.ai.assistant.ollamaBaseUrlHelp') }}</small>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.llmModelDefault') }}</label>
          <input type="text" v-model="local.llmModel" class="form-control" placeholder="qwen2.5:1.5b" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.embeddingModelDefault') }}</label>
          <input type="text" v-model="local.embeddingModel" class="form-control" placeholder="mxbai-embed-large:latest" />
        </div>
      </div>

      <div v-if="runtime?.dockerHints" class="docker-hints">
        <h4>{{ $t('settings.ai.rag.dockerHints') }}</h4>
        <p class="form-hint">{{ $t('settings.ai.rag.dockerHintsReadonly') }}</p>
        <pre class="hints-pre">{{ JSON.stringify(runtime.dockerHints, null, 2) }}</pre>
      </div>

      <router-link class="btn btn-outline btn-sm" to="/settings/ai/ollama">
        {{ $t('settings.ai.rag.openOllamaPull') }}
      </router-link>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-primary" :disabled="saving" @click="onSave">{{ $t('common.save') }}</button>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue';

const props = defineProps({
  ollama: { type: Object, required: true },
  runtime: { type: Object, default: null },
  saving: { type: Boolean, default: false }
});
const emit = defineEmits(['save']);

const local = reactive({
  baseUrl: 'http://ollama:11434',
  llmModel: 'qwen2.5:1.5b',
  embeddingModel: 'mxbai-embed-large:latest'
});

watch(() => props.ollama, (v) => {
  if (!v) return;
  local.baseUrl = v.baseUrl || local.baseUrl;
  local.llmModel = v.llmModel || local.llmModel;
  local.embeddingModel = v.embeddingModel || local.embeddingModel;
}, { immediate: true, deep: true });

function onSave() {
  emit('save', {
    ollama_base_url: local.baseUrl,
    ollama_llm_model: local.llmModel,
    ollama_embedding_model: local.embeddingModel
  });
}
</script>

<style scoped>
.settings-section { padding: 1rem; margin-bottom: 1rem; }
.section-description { color: var(--text-muted, #666); }
.form-label { display: block; margin-top: 0.75rem; font-weight: 600; }
.form-control { width: 100%; max-width: 28rem; }
.form-row { display: flex; flex-wrap: wrap; gap: 1rem; }
.form-group { flex: 1; min-width: 12rem; }
.hints-pre { background: #f8fafc; padding: 0.75rem; overflow: auto; font-size: 0.8rem; }
.docker-hints { margin: 1rem 0; }
</style>
