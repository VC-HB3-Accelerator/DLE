<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <BaseLayout>
    <AdminPageShell :show-close="true" fallback="/settings/ai" variant="panel">
      <h2 class="rag-page-title">{{ $t('settings.ai.rag.pageTitle') }}</h2>
      <p class="page-desc">{{ $t('settings.ai.rag.pageDesc') }}</p>

      <div v-if="loading" class="form-hint">{{ $t('common.loading') }}…</div>
      <div v-if="error" class="error-banner">{{ error }}</div>
      <div v-if="saveOk" class="ok-banner">{{ $t('settings.ai.rag.saved') }}</div>

      <nav class="rag-tabs" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="rag-tab"
          :class="{ active: activeTab === tab.id }"
          role="tab"
          :aria-selected="activeTab === tab.id"
          @click="activeTab = tab.id"
        >
          {{ $t(tab.labelKey) }}
        </button>
      </nav>

      <div class="rag-tab-body">
        <RagOverviewTab
          v-if="activeTab === 'overview'"
          :runtime="runtime"
          :load-runtime="loadRuntime"
        />
        <RagSearchTab
          v-else-if="activeTab === 'search'"
          :rag-settings="config.rag_settings"
          :rag-behavior="config.rag_behavior"
          :saving="saving"
          @save="onSave"
        />
        <RagVectorTab
          v-else-if="activeTab === 'vector'"
          :vector-search-url="config.vector_search_url"
          :runtime="runtime"
          :saving="saving"
          @save="onSave"
        />
        <RagOllamaTab
          v-else-if="activeTab === 'ollama'"
          :ollama="{
            baseUrl: config.ollama_base_url,
            llmModel: config.ollama_llm_model,
            embeddingModel: config.ollama_embedding_model
          }"
          :runtime="runtime"
          :saving="saving"
          @save="onSave"
        />
        <RagModelsTab
          v-else-if="activeTab === 'models'"
          :llm-parameters="config.llm_parameters"
          :qwen-parameters="config.qwen_specific_parameters"
          :embedding-parameters="config.embedding_parameters"
          :saving="saving"
          @save="onSave"
        />
        <RagCacheQueueTab
          v-else-if="activeTab === 'cache'"
          :cache-settings="config.cache_settings"
          :queue-settings="config.queue_settings"
          :runtime="runtime"
          :saving="saving"
          @save="onSave"
        />
        <RagReliabilityTab
          v-else-if="activeTab === 'reliability'"
          :deduplication-settings="config.deduplication_settings"
          :timeouts="config.timeouts"
          :saving="saving"
          @save="onSave"
        />
        <RagDialogTab
          v-else-if="activeTab === 'dialog'"
          :dialog-settings="config.dialog_settings"
          :chunking-settings="config.chunking_settings"
          :saving="saving"
          @save="onSave"
        />
      </div>
    </AdminPageShell>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import BaseLayout from '@/components/BaseLayout.vue';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';
import { useAiConfig } from '@/composables/useAiConfig';
import RagOverviewTab from './rag/RagOverviewTab.vue';
import RagSearchTab from './rag/RagSearchTab.vue';
import RagVectorTab from './rag/RagVectorTab.vue';
import RagOllamaTab from './rag/RagOllamaTab.vue';
import RagModelsTab from './rag/RagModelsTab.vue';
import RagCacheQueueTab from './rag/RagCacheQueueTab.vue';
import RagReliabilityTab from './rag/RagReliabilityTab.vue';
import RagDialogTab from './rag/RagDialogTab.vue';

const { config, runtime, loading, saving, error, load, loadRuntime, save } = useAiConfig();
const activeTab = ref('overview');
const saveOk = ref(false);

const tabs = [
  { id: 'overview', labelKey: 'settings.ai.rag.tabOverview' },
  { id: 'search', labelKey: 'settings.ai.rag.tabSearch' },
  { id: 'vector', labelKey: 'settings.ai.rag.tabVector' },
  { id: 'ollama', labelKey: 'settings.ai.rag.tabOllama' },
  { id: 'models', labelKey: 'settings.ai.rag.tabModels' },
  { id: 'cache', labelKey: 'settings.ai.rag.tabCache' },
  { id: 'reliability', labelKey: 'settings.ai.rag.tabReliability' },
  { id: 'dialog', labelKey: 'settings.ai.rag.tabDialog' }
];

onMounted(() => {
  load().catch(() => {});
});

async function onSave(payload) {
  saveOk.value = false;
  try {
    await save(payload);
    saveOk.value = true;
    setTimeout(() => { saveOk.value = false; }, 2500);
  } catch (_) { /* error in composable */ }
}
</script>

<style scoped>
.rag-page-title {
  margin: 0 0 0.5rem 0;
  padding-right: 2.5rem;
  color: var(--color-dark);
  font-size: var(--font-size-xl);
  font-weight: 600;
}
.page-desc { color: var(--theme-text-muted, #666); margin-bottom: 1rem; }
.rag-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}
.rag-tab {
  border: 1px solid transparent;
  background: transparent;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  border-radius: 6px;
  font: inherit;
}
.rag-tab.active {
  background: var(--theme-surface, #f1f5f9);
  border-color: var(--color-border, #e5e7eb);
  font-weight: 600;
}
.error-banner { background: #fee2e2; color: #991b1b; padding: 0.5rem 0.75rem; border-radius: 6px; margin-bottom: 0.75rem; }
.ok-banner { background: #dcfce7; color: #166534; padding: 0.5rem 0.75rem; border-radius: 6px; margin-bottom: 0.75rem; }
.form-hint { color: var(--theme-text-muted, #666); }
</style>
