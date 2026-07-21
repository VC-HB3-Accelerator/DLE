<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.

  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <div class="broadcast-section">
    <div class="broadcast-section-header">
      <h1>{{ t('contacts.broadcast.agent.title') }}</h1>
      <p>{{ t('contacts.broadcast.agent.description') }}</p>
    </div>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="agent-alert"
    >
      <template #title>
        {{ t('contacts.broadcast.agent.infoAlert') }}
      </template>
    </el-alert>

    <el-form v-loading="loading" class="agent-form" label-position="top" @submit.prevent>
      <el-form-item :label="t('contacts.broadcast.agent.enabled')">
        <el-switch
          v-model="form.enabled"
          :active-text="t('contacts.broadcast.agent.enabledOn')"
          :inactive-text="t('contacts.broadcast.agent.enabledOff')"
        />
      </el-form-item>

      <div class="settings-grid">
        <el-form-item :label="t('contacts.broadcast.agent.provider')">
          <el-select v-model="form.provider" style="width: 100%" @change="onProviderChange">
            <el-option
              v-for="item in providerOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item :label="t('contacts.broadcast.agent.model')">
          <el-select
            v-model="form.model"
            filterable
            allow-create
            clearable
            default-first-option
            style="width: 100%"
            :placeholder="t('contacts.broadcast.agent.modelPlaceholder')"
          >
            <el-option
              v-for="item in filteredModels"
              :key="`${item.provider}:${item.id}`"
              :label="`${item.id} (${item.provider})`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item :label="t('contacts.broadcast.agent.temperature')">
          <el-input-number
            v-model="form.temperature"
            :min="limits.temperatureMin"
            :max="limits.temperatureMax"
            :step="0.1"
          />
        </el-form-item>

        <el-form-item :label="t('contacts.broadcast.agent.maxTokens')">
          <el-input-number
            v-model="form.max_tokens"
            :min="limits.maxTokensMin"
            :max="limits.maxTokensMax"
            :step="50"
          />
          <div class="field-hint">{{ t('contacts.broadcast.agent.maxTokensHint') }}</div>
        </el-form-item>

        <el-form-item :label="t('contacts.broadcast.agent.timeoutMinutes')">
          <el-input-number
            v-model="form.timeout_minutes"
            :min="timeoutMinutesMin"
            :max="timeoutMinutesMax"
            :step="1"
          />
          <div class="field-hint">{{ t('contacts.broadcast.agent.timeoutHint') }}</div>
        </el-form-item>
      </div>

      <el-form-item :label="t('contacts.broadcast.agent.systemPrompt')">
        <el-input
          v-model="form.system_prompt"
          type="textarea"
          :rows="10"
          :placeholder="defaults.system_prompt || t('contacts.broadcast.agent.systemPromptPlaceholder')"
        />
        <div class="prompt-actions">
          <el-button link type="primary" @click="resetSystemPrompt">
            {{ t('contacts.broadcast.agent.resetPrompt') }}
          </el-button>
          <el-button link @click="resetAllDefaults">
            {{ t('contacts.broadcast.agent.resetDefaults') }}
          </el-button>
        </div>
      </el-form-item>

      <div class="form-actions">
        <el-button type="primary" :loading="saving" @click="saveSettings">
          {{ t('contacts.broadcast.agent.save') }}
        </el-button>
        <el-button :disabled="loading || saving" @click="loadSettings">
          {{ t('common.refresh') }}
        </el-button>
      </div>
    </el-form>

    <BroadcastAgentOllamaModels
      v-if="form.provider === 'ollama'"
      :selected-model="form.model"
      @use-model="onUseOllamaModel"
      @installed-change="onInstalledOllamaChange"
    />

    <el-divider />

    <section class="preview-section">
      <h2>{{ t('contacts.broadcast.agent.previewTitle') }}</h2>
      <p class="preview-hint">{{ t('contacts.broadcast.agent.previewHint') }}</p>

      <el-alert
        v-if="!selectedContactIds.length"
        type="warning"
        :closable="false"
        show-icon
        class="preview-alert"
      >
        <template #title>
          {{ t('contacts.broadcast.agent.previewNoContacts') }}
        </template>
      </el-alert>

      <el-form class="preview-form" label-position="top" @submit.prevent>
        <div class="settings-grid">
          <el-form-item :label="t('contacts.broadcast.agent.previewContact')" required>
            <el-select
              v-if="selectedContactIds.length"
              v-model="preview.userId"
              filterable
              style="width: 100%"
              :placeholder="t('contacts.broadcast.agent.previewContactPlaceholder')"
            >
              <el-option
                v-for="id in selectedContactIds"
                :key="id"
                :label="t('contacts.broadcast.agent.previewContactOption', { id })"
                :value="id"
              />
            </el-select>
            <el-input-number
              v-else
              v-model="preview.userId"
              :min="1"
              :step="1"
              controls-position="right"
            />
          </el-form-item>
        </div>

        <el-form-item :label="t('contacts.broadcast.subject')" required>
          <el-input v-model="preview.subject" maxlength="200" show-word-limit />
        </el-form-item>

        <el-form-item :label="t('contacts.broadcast.greeting')" required>
          <el-input v-model="preview.greeting" type="textarea" :rows="2" />
        </el-form-item>

        <el-form-item :label="t('contacts.broadcast.message')" required>
          <el-input v-model="preview.body" type="textarea" :rows="8" />
        </el-form-item>

        <el-form-item :label="t('contacts.broadcast.signature')">
          <el-input v-model="preview.signature" type="textarea" :rows="3" />
        </el-form-item>

        <el-form-item :label="t('contacts.broadcast.legalFooter')">
          <el-input v-model="preview.legalFooter" type="textarea" :rows="3" />
        </el-form-item>

        <el-button type="primary" :loading="previewLoading" :disabled="!canPreview" @click="runPreview">
          {{ t('contacts.broadcast.agent.runPreview') }}
        </el-button>
      </el-form>

      <div v-if="previewResult" class="preview-result">
        <h3>{{ t('contacts.broadcast.agent.previewResult') }}</h3>
        <p class="preview-meta">
          {{ t('contacts.broadcast.agent.previewMeta', {
            personalized: previewResult.personalized ? t('common.yes') : t('common.no'),
            reason: previewResult.reason || '—'
          }) }}
        </p>
        <div class="preview-block">
          <strong>{{ t('contacts.broadcast.subject') }}:</strong>
          <div>{{ previewResult.subject }}</div>
        </div>
        <div v-if="previewResult.greeting" class="preview-block">
          <strong>{{ t('contacts.broadcast.greeting') }}:</strong>
          <div>{{ previewResult.greeting }}</div>
        </div>
        <div class="preview-block">
          <strong>{{ t('contacts.broadcast.message') }}:</strong>
          <pre>{{ previewResult.body }}</pre>
        </div>
        <router-link
          v-if="preview.userId"
          class="history-link"
          :to="contactChatTarget(preview.userId)"
        >
          {{ t('contacts.broadcast.agent.openContactChat') }}
        </router-link>
      </div>

    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import messagesService from '@/services/messagesService.js';
import BroadcastAgentOllamaModels from './BroadcastAgentOllamaModels.vue';

const BROADCAST_IDS_STORAGE_KEY = 'broadcastRecipientIds';
const TEMPLATE_SUBJECT_KEY = 'broadcastTemplateSubject';
const TEMPLATE_GREETING_KEY = 'broadcastTemplateGreeting';
const TEMPLATE_BODY_KEY = 'broadcastTemplateBody';
const TEMPLATE_SIGNATURE_KEY = 'broadcastTemplateSignature';
const TEMPLATE_LEGAL_KEY = 'broadcastTemplateLegalFooter';
const CAMPAIGN_ID_KEY = 'broadcastActiveCampaignId';
const PREVIEW_HISTORY_KEY = 'broadcastPreviewHistory';

const { t } = useI18n();
const route = useRoute();

const loading = ref(false);
const saving = ref(false);
const previewLoading = ref(false);
const models = ref([]);
const installedOllamaModels = ref([]);
const previewResult = ref(null);
const activeCampaignId = ref(null);

const form = reactive({
  enabled: false,
  provider: 'ollama',
  model: '',
  system_prompt: '',
  temperature: 0.3,
  max_tokens: 800,
  timeout_minutes: 7
});

const defaults = reactive({
  enabled: false,
  provider: 'ollama',
  model: null,
  system_prompt: '',
  temperature: 0.3,
  max_tokens: 800,
  timeout_ms: 420000
});

const limits = reactive({
  temperatureMin: 0,
  temperatureMax: 2,
  maxTokensMin: 50,
  maxTokensMax: 8000,
  timeoutMsMin: 60000,
  timeoutMsMax: 1800000
});

const timeoutMinutesMin = computed(() => Math.max(1, Math.ceil(limits.timeoutMsMin / 60000)));
const timeoutMinutesMax = computed(() => Math.max(timeoutMinutesMin.value, Math.floor(limits.timeoutMsMax / 60000)));

const preview = reactive({
  userId: null,
  subject: '',
  greeting: 'Здравствуйте!',
  body: '',
  signature: '',
  legalFooter: ''
});

const providerOptions = [
  { value: 'ollama', label: 'Ollama' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' }
];

const selectedContactIds = computed(() => {
  const raw = route.query.ids || sessionStorage.getItem(BROADCAST_IDS_STORAGE_KEY) || '';
  return [...new Set(
    String(raw)
      .split(',')
      .map((id) => Number(String(id).trim()))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];
});

const filteredModels = computed(() => {
  if (form.provider === 'ollama') {
    const fromSettings = models.value
      .filter((item) => item.provider === 'ollama')
      .map((item) => ({ id: item.id, provider: 'ollama' }));
    const fromInstalled = installedOllamaModels.value.map((item) => ({
      id: item.name,
      provider: 'ollama'
    }));
    const map = new Map();
    [...fromInstalled, ...fromSettings].forEach((item) => {
      if (item.id) map.set(item.id, item);
    });
    if (form.model) {
      map.set(form.model, { id: form.model, provider: 'ollama' });
    }
    return [...map.values()];
  }

  return models.value.filter((item) => item.provider === form.provider);
});

function onInstalledOllamaChange(list) {
  installedOllamaModels.value = Array.isArray(list) ? list : [];
}

function onUseOllamaModel({ provider, model }) {
  form.provider = provider || 'ollama';
  form.model = model || '';
  form.enabled = true;
  ElMessage.info(t('contacts.broadcast.agent.models.selectedNeedSave', { model: model || '' }));
}

const canPreview = computed(() => {
  return Number(preview.userId) > 0
    && preview.subject.trim()
    && preview.greeting.trim()
    && preview.body.trim()
    && !previewLoading.value;
});

function resolveActiveCampaignId() {
  const fromRef = Number(activeCampaignId.value);
  if (Number.isInteger(fromRef) && fromRef > 0) return fromRef;
  const fromSession = Number(sessionStorage.getItem(CAMPAIGN_ID_KEY));
  if (Number.isInteger(fromSession) && fromSession > 0) {
    activeCampaignId.value = fromSession;
    return fromSession;
  }
  return null;
}

function contactChatTarget(userId, campaignId = resolveActiveCampaignId()) {
  const query = {};
  const cid = Number(campaignId);
  if (Number.isInteger(cid) && cid > 0) {
    query.broadcastCampaignId = String(cid);
  }
  return {
    name: 'contact-details',
    params: { id: String(userId) },
    query
  };
}

function asFiniteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function applyDefaults(payload = {}) {
  Object.assign(defaults, {
    enabled: Boolean(payload.enabled),
    provider: payload.provider || 'ollama',
    model: payload.model || null,
    system_prompt: payload.system_prompt || '',
    temperature: asFiniteNumber(payload.temperature, 0.3),
    max_tokens: asFiniteNumber(payload.max_tokens, 800),
    timeout_ms: asFiniteNumber(payload.timeout_ms, 420000)
  });
  if (payload.limits) {
    Object.assign(limits, payload.limits);
  }
}

function applySettings(settings) {
  form.enabled = Boolean(settings?.enabled);
  form.provider = settings?.provider || defaults.provider || 'ollama';
  form.model = settings?.model || '';
  form.system_prompt = settings?.system_prompt || defaults.system_prompt || '';
  form.temperature = asFiniteNumber(settings?.temperature ?? defaults.temperature, 0.3);
  form.max_tokens = asFiniteNumber(settings?.max_tokens ?? defaults.max_tokens, 800);
  const timeoutMs = asFiniteNumber(settings?.timeout_ms ?? defaults.timeout_ms, 420000);
  form.timeout_minutes = Math.max(
    timeoutMinutesMin.value,
    Math.min(timeoutMinutesMax.value, Math.round(timeoutMs / 60000))
  );
}

function resetSystemPrompt() {
  form.system_prompt = defaults.system_prompt || '';
}

function resetAllDefaults() {
  form.enabled = Boolean(defaults.enabled);
  form.provider = defaults.provider || 'ollama';
  form.temperature = asFiniteNumber(defaults.temperature, 0.3);
  form.max_tokens = asFiniteNumber(defaults.max_tokens, 800);
  form.timeout_minutes = Math.round(asFiniteNumber(defaults.timeout_ms, 420000) / 60000);
  form.system_prompt = defaults.system_prompt || '';
  // модель не сбрасываем принудительно — выбор пользователя
  onProviderChange();
}

function loadTemplateFromStorage() {
  preview.subject = sessionStorage.getItem(TEMPLATE_SUBJECT_KEY) || preview.subject;
  preview.greeting = sessionStorage.getItem(TEMPLATE_GREETING_KEY) || preview.greeting;
  preview.body = sessionStorage.getItem(TEMPLATE_BODY_KEY) || preview.body;
  preview.signature = sessionStorage.getItem(TEMPLATE_SIGNATURE_KEY) || preview.signature;
  preview.legalFooter = sessionStorage.getItem(TEMPLATE_LEGAL_KEY) || preview.legalFooter;
  const campaignId = Number(sessionStorage.getItem(CAMPAIGN_ID_KEY));
  activeCampaignId.value = Number.isInteger(campaignId) && campaignId > 0 ? campaignId : null;

  if (!preview.userId && selectedContactIds.value.length) {
    preview.userId = selectedContactIds.value[0];
  }
}

function readLocalPreviewHistory() {
  try {
    const raw = sessionStorage.getItem(PREVIEW_HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (error) {
    return [];
  }
}

function writeLocalPreviewHistory(list) {
  sessionStorage.setItem(PREVIEW_HISTORY_KEY, JSON.stringify(list.slice(0, 50)));
}

async function loadModels() {
  try {
    const response = await messagesService.getBroadcastAiAgentModels();
    models.value = response?.models || [];
  } catch (error) {
    models.value = [];
  }
}

async function loadSettings() {
  loading.value = true;
  try {
    const [settingsResponse] = await Promise.all([
      messagesService.getBroadcastAiAgentSettings(),
      loadModels()
    ]);
    applyDefaults(settingsResponse?.defaults || {});
    applySettings(settingsResponse?.settings);
    loadTemplateFromStorage();
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.broadcast.agent.loadError'));
  } finally {
    loading.value = false;
  }
}

function onProviderChange() {
  const stillValid = filteredModels.value.some((item) => item.id === form.model);
  if (!stillValid) {
    form.model = filteredModels.value[0]?.id || '';
  }
}

async function saveSettings() {
  saving.value = true;
  try {
    const response = await messagesService.saveBroadcastAiAgentSettings({
      enabled: form.enabled,
      provider: form.provider,
      model: form.model || null,
      system_prompt: form.system_prompt,
      temperature: form.temperature,
      max_tokens: form.max_tokens,
      timeout_ms: Math.round(Number(form.timeout_minutes) || 7) * 60000
    });
    applyDefaults(response?.defaults || {});
    applySettings(response?.settings);
    ElMessage.success(t('contacts.broadcast.agent.saved'));
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.broadcast.agent.saveError'));
  } finally {
    saving.value = false;
  }
}

async function runPreview() {
  if (!canPreview.value) return;

  const campaignId = resolveActiveCampaignId();
  previewLoading.value = true;
  previewResult.value = null;
  try {
    const response = await messagesService.previewBroadcastAiAgent({
      userId: Number(preview.userId),
      subject: preview.subject.trim(),
      greeting: preview.greeting.trim(),
      body: preview.body.trim(),
      signature: preview.signature.trim(),
      legalFooter: preview.legalFooter.trim()
    });
    previewResult.value = response?.result || null;

    if (previewResult.value?.subject && previewResult.value?.body) {
      const historyEntry = {
        userId: Number(preview.userId),
        campaignId,
        subject: previewResult.value.subject,
        body: previewResult.value.body,
        status: 'preview',
        at: Date.now()
      };
      const next = [historyEntry, ...readLocalPreviewHistory().filter((item) => Number(item.userId) !== historyEntry.userId)];
      writeLocalPreviewHistory(next);

      if (campaignId) {
        try {
          await messagesService.saveBroadcastDraft(campaignId, historyEntry.userId, {
            subject: historyEntry.subject,
            body: historyEntry.body
          });
        } catch (error) {
          // превью всё равно показываем
        }
      }
    }
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.broadcast.agent.previewError'));
  } finally {
    previewLoading.value = false;
  }
}

onMounted(loadSettings);
</script>

<style scoped>
.broadcast-section-header h1 {
  margin: 0 0 8px;
  font-size: 1.8rem;
}

.broadcast-section-header p {
  margin: 0;
  color: #606266;
}

.agent-alert {
  margin: 16px 0;
}

.agent-form,
.preview-form {
  max-width: 920px;
}

.field-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
  line-height: 1.35;
}

.prompt-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px 20px;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preview-section h2 {
  margin: 0 0 8px;
  font-size: 1.25rem;
}

.preview-hint {
  margin: 0 0 16px;
  color: #606266;
}

.preview-alert {
  margin-bottom: 16px;
}

.preview-result {
  margin-top: 20px;
  padding: 16px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fafafa;
}

.preview-result h3 {
  margin: 0 0 8px;
  font-size: 1.05rem;
}

.preview-meta {
  margin: 0 0 12px;
  color: #909399;
  font-size: 0.9rem;
}

.preview-block {
  margin-bottom: 12px;
}

.preview-block pre {
  margin: 8px 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  line-height: 1.45;
}

.history-link {
  display: inline-block;
  margin-top: 8px;
  color: #409eff;
  text-decoration: none;
  font-size: 0.95rem;
}

.history-link:hover {
  text-decoration: underline;
}
</style>
