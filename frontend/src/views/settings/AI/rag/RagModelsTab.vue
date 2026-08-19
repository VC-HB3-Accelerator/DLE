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
          <input type="number" v-model.number="llm.maxTokens" class="form-control form-control--narrow" min="1" max="8000" />
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
      <h3>{{ $t('settings.ai.rag.embedSectionTitle') }}</h3>
      <p class="form-hint">{{ $t('settings.ai.rag.embedCloudHint') }}</p>
      <button type="button" class="btn btn-outline btn-sm" @click="loadCatalog">
        {{ $t('settings.ai.rag.refreshEmbedModels') }}
      </button>

      <label class="form-label">{{ $t('settings.ai.rag.embedProvider') }}</label>
      <select v-model="embed.provider" class="form-control" @change="onProviderChange">
        <option
          v-for="p in providers"
          :key="p.id"
          :value="p.id"
          :disabled="p.available === false && p.id !== embed.provider"
        >
          {{ providerLabel(p.id) }}{{ p.available === false ? ` — ${$t('settings.ai.rag.providerNoKey')}` : '' }}
        </option>
      </select>
      <p v-if="embed.provider === 'qwencloud'" class="form-hint">
        <router-link to="/settings/ai/qwencloud">{{ $t('settings.ai.rag.openProviderKey') }}</router-link>
      </p>
      <p v-else-if="embed.provider === 'openai'" class="form-hint">
        <router-link to="/settings/ai/openai">{{ $t('settings.ai.rag.openProviderKey') }}</router-link>
      </p>
      <p v-else class="form-hint">
        <router-link to="/settings/ai/ollama">{{ $t('settings.ai.rag.openOllamaPull') }}</router-link>
      </p>

      <label class="form-label">{{ $t('settings.ai.rag.embedModel') }}</label>
      <select
        v-if="modelsForProvider.length"
        v-model="embed.model"
        class="form-control"
        @change="onModelChange"
      >
        <option v-for="m in modelsForProvider" :key="`${m.provider}:${m.id}`" :value="m.id">
          {{ m.id }}
        </option>
      </select>
      <input
        v-else
        v-model="embed.model"
        class="form-control"
        :placeholder="$t('settings.ai.rag.noEmbedModels')"
      />

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.rag.embedDimension') }}</label>
          <select v-model.number="embed.dimension" class="form-control">
            <option v-for="d in dimsForModel" :key="d" :value="d">{{ d }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.ai.assistant.batchSize') }}</label>
          <input type="number" v-model.number="embed.batch_size" class="form-control form-control--narrow" min="1" max="128" />
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
      <p v-if="runtime?.pgvector?.columnDimension" class="form-hint">
        {{ $t('settings.ai.rag.columnDimension') }}:
        <code>{{ runtime.pgvector.columnDimension }}</code>
      </p>
      <p class="form-hint">{{ $t('settings.ai.rag.rebuildHint') }}</p>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-primary" :disabled="saving || rebuilding" @click="onSave">
        {{ $t('common.save') }}
      </button>
      <button type="button" class="btn btn-outline" :disabled="saving || rebuilding" @click="onSaveAndRebuild">
        {{ rebuilding ? $t('settings.ai.rag.rebuildInProgress') : $t('settings.ai.rag.saveAndRebuild') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';

const props = defineProps({
  llmParameters: { type: Object, required: true },
  qwenParameters: { type: Object, required: true },
  embeddingParameters: { type: Object, required: true },
  runtime: { type: Object, default: null },
  saving: { type: Boolean, default: false },
  rebuilding: { type: Boolean, default: false }
});
const emit = defineEmits(['save', 'save-rebuild']);
const { t } = useI18n();

const llm = reactive({ temperature: 0.3, maxTokens: 8000, top_p: 0.9, top_k: 40, repeat_penalty: 1.1 });
const qwen = reactive({ format: null });
const embed = reactive({
  provider: 'ollama',
  model: '',
  batch_size: 32,
  normalize: true,
  dimension: 1024,
  pooling: 'mean'
});

const providers = ref([
  { id: 'ollama', available: true },
  { id: 'qwencloud', available: false },
  { id: 'openai', available: false }
]);
const models = ref([]);

watch(() => props.llmParameters, (v) => { if (v) Object.assign(llm, v); }, { immediate: true, deep: true });
watch(() => props.qwenParameters, (v) => { if (v) Object.assign(qwen, v); }, { immediate: true, deep: true });
watch(() => props.embeddingParameters, (v) => {
  if (!v) return;
  Object.assign(embed, v);
  if (!embed.provider) embed.provider = 'ollama';
  if (!embed.dimension) embed.dimension = 1024;
}, { immediate: true, deep: true });

const modelsForProvider = computed(() => (
  models.value.filter((m) => m.provider === embed.provider)
));

const dimsForModel = computed(() => {
  const found = modelsForProvider.value.find((m) => m.id === embed.model);
  if (found?.dims?.length) return found.dims;
  if (embed.provider === 'ollama') return [1024];
  return [512, 768, 1024, 1536, 2048, 3072];
});

function providerLabel(id) {
  const key = `settings.ai.rag.provider_${id}`;
  const label = t(key);
  return label === key ? id : label;
}

function sameModelId(a, b) {
  const n = (s) => String(s || '').replace(/:latest$/i, '').trim().toLowerCase();
  return n(a) === n(b) && n(a) !== '';
}

function pickModelForProvider() {
  const list = modelsForProvider.value;
  if (!list.length) return;
  if (!list.some((m) => sameModelId(m.id, embed.model))) {
    embed.model = list[0].id;
  }
  pickDimForModel();
}

function pickDimForModel() {
  const dims = dimsForModel.value;
  if (!dims.includes(Number(embed.dimension))) {
    embed.dimension = dims.includes(1024) ? 1024 : dims[0];
  }
}

function onProviderChange() {
  pickModelForProvider();
}

function onModelChange() {
  pickDimForModel();
}

async function loadCatalog() {
  try {
    const { data } = await axios.get('/settings/ai-config/embedding-catalog');
    if (data?.catalog?.providers?.length) providers.value = data.catalog.providers;
    if (data?.catalog?.models) models.value = data.catalog.models;
    pickModelForProvider();
  } catch (_) {
    models.value = [];
  }
}

function payload() {
  const out = {
    llm_parameters: { ...llm },
    qwen_specific_parameters: { ...qwen },
    embedding_parameters: { ...embed }
  };
  if (embed.provider === 'ollama' && embed.model) {
    out.ollama_embedding_model = embed.model;
  }
  return out;
}

function onSave() {
  emit('save', payload());
}

function onSaveAndRebuild() {
  emit('save-rebuild', payload());
}

onMounted(() => {
  loadCatalog();
});
</script>

<style scoped>
.settings-section { padding: 1rem; margin-bottom: 1rem; }
.form-label { display: block; margin-top: 0.5rem; font-weight: 600; }
.form-control { width: 100%; max-width: 28rem; }
.form-control--narrow { max-width: 10rem; }
.form-row { display: flex; flex-wrap: wrap; gap: 1rem; }
.form-group { flex: 1; min-width: 10rem; }
.checkbox-label { display: flex; align-items: center; gap: 0.5rem; margin-top: 1.5rem; }
.form-hint { color: var(--text-muted, #666); margin-top: 0.75rem; }
.form-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
</style>
