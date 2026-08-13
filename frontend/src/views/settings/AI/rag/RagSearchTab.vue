<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div class="rag-search-tab">
    <div class="settings-section panel">
      <h3>{{ $t('settings.ai.assistant.ragSearchTitle') }}</h3>

      <label class="form-label">{{ $t('settings.ai.assistant.ragThreshold') }}</label>
      <input type="number" v-model.number="local.threshold" class="form-control form-control--narrow" min="0" max="1000" step="10" />
      <small class="form-hint">{{ $t('settings.ai.assistant.ragThresholdHelp') }}</small>

      <label class="form-label">{{ $t('settings.ai.assistant.searchMethod') }}</label>
      <select v-model="local.searchMethod" class="form-control">
        <option value="semantic">{{ $t('settings.ai.assistant.searchSemantic') }}</option>
        <option value="keyword">{{ $t('settings.ai.assistant.searchKeyword') }}</option>
        <option value="hybrid">{{ $t('settings.ai.assistant.searchHybrid') }}</option>
      </select>

      <label class="form-label">{{ $t('settings.ai.assistant.maxResults') }}</label>
      <input type="number" v-model.number="local.maxResults" class="form-control form-control--narrow" min="1" max="20" />

      <div v-if="local.searchMethod === 'hybrid'" class="search-weights">
        <h4>{{ $t('settings.ai.assistant.searchWeights') }}</h4>
        <label class="form-label">{{ $t('settings.ai.assistant.semanticWeight', { value: local.searchWeights.semantic }) }}</label>
        <input type="range" v-model.number="local.searchWeights.semantic" min="0" max="100" @input="syncKeyword" />
        <label class="form-label">{{ $t('settings.ai.assistant.keywordWeight', { value: local.searchWeights.keyword }) }}</label>
        <input type="range" v-model.number="local.searchWeights.keyword" min="0" max="100" @input="syncSemantic" />
      </div>

      <details class="unused-fields">
        <summary>{{ $t('settings.ai.rag.unusedFields') }}</summary>
        <p class="form-hint">{{ $t('settings.ai.rag.unusedFieldsHint') }}</p>
      </details>
    </div>

    <div class="settings-section panel">
      <h3>{{ $t('settings.ai.assistant.ragBehaviorTitle') }}</h3>
      <label class="checkbox-label">
        <input type="checkbox" v-model="behavior.upsertOnQuery" />
        {{ $t('settings.ai.assistant.upsertOnQuery') }}
      </label>
      <label class="checkbox-label">
        <input type="checkbox" v-model="behavior.autoIndexOnTableChange" />
        {{ $t('settings.ai.assistant.autoIndexOnChange') }}
      </label>
      <label class="checkbox-label">
        <input type="checkbox" v-model="behavior.searchInDocuments" />
        {{ $t('settings.ai.rag.searchInDocuments') }}
      </label>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-primary" :disabled="saving" @click="onSave">{{ $t('common.save') }}</button>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue';

const props = defineProps({
  ragSettings: { type: Object, required: true },
  ragBehavior: { type: Object, required: true },
  saving: { type: Boolean, default: false }
});
const emit = defineEmits(['save']);

const local = reactive({
  threshold: 300,
  searchMethod: 'hybrid',
  maxResults: 3,
  searchWeights: { semantic: 70, keyword: 30 }
});
const behavior = reactive({
  upsertOnQuery: false,
  autoIndexOnTableChange: true,
  searchInDocuments: true
});

watch(() => props.ragSettings, (v) => {
  if (!v) return;
  local.threshold = v.threshold ?? 300;
  local.searchMethod = v.searchMethod || 'hybrid';
  local.maxResults = v.maxResults ?? 3;
  local.searchWeights = {
    semantic: v.searchWeights?.semantic ?? 70,
    keyword: v.searchWeights?.keyword ?? 30
  };
}, { immediate: true, deep: true });

watch(() => props.ragBehavior, (v) => {
  if (!v) return;
  behavior.upsertOnQuery = !!v.upsertOnQuery;
  behavior.autoIndexOnTableChange = v.autoIndexOnTableChange !== false;
  behavior.searchInDocuments = v.searchInDocuments !== false;
}, { immediate: true, deep: true });

function syncKeyword() {
  local.searchWeights.keyword = Math.max(0, 100 - Number(local.searchWeights.semantic || 0));
}
function syncSemantic() {
  local.searchWeights.semantic = Math.max(0, 100 - Number(local.searchWeights.keyword || 0));
}

function onSave() {
  emit('save', {
    rag_settings: {
      ...props.ragSettings,
      threshold: local.threshold,
      searchMethod: local.searchMethod,
      maxResults: local.maxResults,
      searchWeights: { ...local.searchWeights }
    },
    rag_behavior: { ...behavior }
  });
}
</script>

<style scoped>
.settings-section { margin-bottom: 1rem; padding: 1rem; }
.form-label { display: block; margin-top: 0.75rem; font-weight: 600; }
.form-control { width: 100%; max-width: 28rem; }
.form-control--narrow { max-width: 12rem; }
.form-hint { display: block; color: var(--text-muted, #666); font-size: 0.85rem; }
.checkbox-label { display: flex; align-items: center; gap: 0.5rem; margin: 0.5rem 0; }
.form-actions { margin-top: 1rem; }
.unused-fields { margin-top: 1rem; color: var(--text-muted, #666); }
</style>
