<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="conference-section" v-loading="loading">
    <div class="conference-section-header">
      <h2>{{ t('contacts.conference.agent.title') }}</h2>
      <p>{{ t('contacts.conference.agent.description') }}</p>
    </div>

    <el-alert type="info" :closable="false" show-icon class="agent-alert">
      <template #title>{{ t('contacts.conference.agent.infoAlert') }}</template>
    </el-alert>

    <el-alert
      :type="openai.configured ? 'success' : 'warning'"
      :closable="false"
      show-icon
      class="agent-alert"
    >
      <template #title>
        {{ openai.configured
          ? t('contacts.conference.agent.openaiConfigured')
          : t('contacts.conference.agent.openaiMissing') }}
      </template>
    </el-alert>

    <el-form class="agent-form" label-position="top" @submit.prevent>
      <el-form-item :label="t('contacts.conference.agent.enabled')">
        <el-switch
          v-model="form.enabled"
          :active-text="t('contacts.conference.agent.enabledOn')"
          :inactive-text="t('contacts.conference.agent.enabledOff')"
        />
      </el-form-item>

      <div class="settings-grid">
        <el-form-item :label="t('contacts.conference.agent.provider')">
          <el-select v-model="form.provider" style="width: 100%" @change="onProviderChange">
            <el-option label="OpenAI" value="openai" />
            <el-option label="Ollama" value="ollama" />
          </el-select>
        </el-form-item>

        <el-form-item :label="t('contacts.conference.agent.model')">
          <el-select
            v-model="form.model"
            filterable
            allow-create
            clearable
            default-first-option
            style="width: 100%"
            :placeholder="t('contacts.conference.agent.modelPlaceholder')"
          >
            <el-option
              v-for="item in models"
              :key="`${item.provider}:${item.id}`"
              :label="item.id"
              :value="item.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item :label="t('contacts.conference.agent.temperature')">
          <el-input-number
            v-model="form.temperature"
            :min="limits.temperatureMin"
            :max="limits.temperatureMax"
            :step="0.1"
          />
        </el-form-item>

        <el-form-item :label="t('contacts.conference.agent.maxTokens')">
          <el-input-number
            v-model="form.max_tokens"
            :min="limits.maxTokensMin"
            :max="limits.maxTokensMax"
            :step="50"
          />
        </el-form-item>

        <el-form-item :label="t('contacts.conference.agent.timeoutMs')">
          <el-input-number
            v-model="form.timeout_ms"
            :min="limits.timeoutMsMin"
            :max="limits.timeoutMsMax"
            :step="1000"
          />
        </el-form-item>
      </div>

      <el-form-item :label="t('contacts.conference.agent.ragTables')">
        <el-select
          v-model="form.rag_table_ids"
          multiple
          filterable
          clearable
          style="width: 100%"
          :placeholder="t('contacts.conference.agent.ragTablesPlaceholder')"
        >
          <el-option
            v-for="table in ragTables"
            :key="table.id"
            :label="table.name || `#${table.id}`"
            :value="table.id"
          />
        </el-select>
      </el-form-item>

      <div class="settings-grid">
        <el-form-item :label="t('contacts.conference.agent.searchRagFirst')">
          <el-switch v-model="form.search_rag_first" />
        </el-form-item>
        <el-form-item :label="t('contacts.conference.agent.generateIfNoRag')">
          <el-switch v-model="form.generate_if_no_rag" />
        </el-form-item>
      </div>

      <el-form-item :label="t('contacts.conference.agent.systemPrompt')">
        <el-input
          v-model="form.system_prompt"
          type="textarea"
          :rows="10"
          :placeholder="defaults.system_prompt"
        />
        <div class="prompt-actions">
          <el-button link type="primary" @click="resetSystemPrompt">
            {{ t('contacts.conference.agent.resetPrompt') }}
          </el-button>
        </div>
      </el-form-item>

      <div class="form-actions">
        <el-button type="primary" :loading="saving" @click="saveSettings">
          {{ t('contacts.conference.agent.save') }}
        </el-button>
        <el-button :disabled="loading || saving" @click="loadSettings">
          {{ t('common.refresh') }}
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import conferenceService from '@/services/conferenceService';
import { usePermissions } from '@/composables/usePermissions';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { isEditor } = usePermissions();

const loading = ref(false);
const saving = ref(false);
const models = ref([]);
const ragTables = ref([]);
const openai = reactive({ configured: false, selected_model: null });

const form = reactive({
  enabled: false,
  provider: 'openai',
  model: '',
  system_prompt: '',
  temperature: 0.3,
  max_tokens: 1200,
  timeout_ms: 120000,
  rag_table_ids: [],
  search_rag_first: true,
  generate_if_no_rag: false
});

const defaults = reactive({
  system_prompt: ''
});

const limits = reactive({
  temperatureMin: 0,
  temperatureMax: 2,
  maxTokensMin: 100,
  maxTokensMax: 8000,
  timeoutMsMin: 10000,
  timeoutMsMax: 600000
});

function applySettings(settings, defs, openaiStatus) {
  if (defs) {
    defaults.system_prompt = defs.system_prompt || '';
    if (defs.limits) Object.assign(limits, defs.limits);
  }
  if (openaiStatus) {
    openai.configured = Boolean(openaiStatus.configured);
    openai.selected_model = openaiStatus.selected_model || null;
  }
  if (!settings) return;
  form.enabled = Boolean(settings.enabled);
  form.provider = settings.provider || 'openai';
  form.model = settings.model || '';
  form.system_prompt = settings.system_prompt || defaults.system_prompt;
  form.temperature = Number(settings.temperature ?? 0.3);
  form.max_tokens = Number(settings.max_tokens ?? 1200);
  form.timeout_ms = Number(settings.timeout_ms ?? 120000);
  form.rag_table_ids = Array.isArray(settings.rag_table_ids) ? [...settings.rag_table_ids] : [];
  form.search_rag_first = settings.search_rag_first !== false;
  form.generate_if_no_rag = Boolean(settings.generate_if_no_rag);
}

async function loadModels() {
  try {
    const data = await conferenceService.getAgentModels(form.provider);
    models.value = data.models || [];
    if (!models.value.length && form.provider === 'openai' && openai.configured) {
      ElMessage.warning(t('contacts.conference.agent.modelsEmpty'));
    }
  } catch (e) {
    models.value = [];
    ElMessage.warning(e?.response?.data?.error || t('contacts.conference.agent.modelsLoadError'));
  }
}

async function loadRagTables() {
  try {
    const data = await conferenceService.getRagTables();
    ragTables.value = data.tables || [];
  } catch {
    ragTables.value = [];
  }
}

async function loadSettings() {
  loading.value = true;
  try {
    const data = await conferenceService.getAgentSettings();
    applySettings(data.settings, data.defaults, data.openai);
    await Promise.all([loadModels(), loadRagTables()]);
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.agent.loadError'));
  } finally {
    loading.value = false;
  }
}

async function onProviderChange() {
  await loadModels();
}

function resetSystemPrompt() {
  form.system_prompt = defaults.system_prompt || '';
}

async function saveSettings() {
  saving.value = true;
  try {
    const data = await conferenceService.saveAgentSettings({
      enabled: form.enabled,
      provider: form.provider,
      model: form.model || null,
      system_prompt: form.system_prompt,
      temperature: form.temperature,
      max_tokens: form.max_tokens,
      timeout_ms: form.timeout_ms,
      rag_table_ids: form.rag_table_ids,
      search_rag_first: form.search_rag_first,
      generate_if_no_rag: form.generate_if_no_rag
    });
    applySettings(data.settings, data.defaults, data.openai);
    ElMessage.success(t('contacts.conference.agent.saved'));
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.agent.saveError'));
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  if (!isEditor.value) {
    if (route.params.sessionId) {
      router.replace({ name: 'hub-conference', params: { sessionId: route.params.sessionId } });
    } else {
      router.replace({ name: 'contact-conference', params: { id: route.params.id } });
    }
    return;
  }
  loadSettings();
});
</script>

<style scoped>
.conference-section-header h2 {
  margin: 0 0 6px;
}

.conference-section-header p {
  margin: 0 0 16px;
  color: var(--color-grey, #606266);
}

.agent-alert {
  margin-bottom: 14px;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.prompt-actions {
  margin-top: 6px;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 700px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
