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
  <div class="parser-section">
    <el-alert type="info" :closable="false" show-icon class="parser-alert">
      <template #title>
        {{ t('contacts.parser.infoAlert') }}
      </template>
    </el-alert>

    <el-alert
      v-if="selectedContactIds.length"
      type="success"
      :closable="false"
      show-icon
      class="parser-alert"
    >
      <template #title>
        {{ t('contacts.parser.selectedInfo', { count: selectedContactIds.length }) }}
      </template>
    </el-alert>
    <el-alert
      v-else
      type="warning"
      :closable="false"
      show-icon
      class="parser-alert"
    >
      <template #title>
        {{ t('contacts.parser.noContacts') }}
      </template>
    </el-alert>

    <el-form v-loading="loading" class="parser-form" label-position="top" @submit.prevent>
      <el-form-item :label="t('contacts.parser.enabled')">
        <el-switch
          v-model="form.enabled"
          :active-text="t('contacts.parser.enabledOn')"
          :inactive-text="t('contacts.parser.enabledOff')"
        />
      </el-form-item>

      <el-form-item :label="t('contacts.parser.scheduleEnabled')">
        <el-switch v-model="form.schedule_enabled" />
      </el-form-item>

      <div class="settings-grid">
        <el-form-item :label="t('contacts.parser.intervalDays')">
          <el-input-number
            v-model="form.interval_days"
            :min="limits.intervalDaysMin"
            :max="limits.intervalDaysMax"
            :step="1"
          />
          <div class="field-hint">{{ t('contacts.parser.intervalHint') }}</div>
        </el-form-item>

        <el-form-item :label="t('contacts.parser.scheduleBatchSize')">
          <el-input-number
            v-model="form.schedule_batch_size"
            :min="limits.scheduleBatchSizeMin"
            :max="limits.scheduleBatchSizeMax"
            :step="1"
          />
        </el-form-item>

        <el-form-item :label="t('contacts.parser.maxPages')">
          <el-input-number
            v-model="form.max_pages"
            :min="limits.maxPagesMin"
            :max="limits.maxPagesMax"
            :step="1"
          />
        </el-form-item>

        <el-form-item :label="t('contacts.parser.maxBlogPages')">
          <el-input-number
            v-model="form.max_blog_pages"
            :min="limits.maxBlogPagesMin"
            :max="limits.maxBlogPagesMax"
            :step="1"
          />
        </el-form-item>

        <el-form-item :label="t('contacts.parser.provider')">
          <el-select v-model="form.provider" style="width: 100%" @change="onProviderChange">
            <el-option
              v-for="item in providerOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item :label="t('contacts.parser.model')">
          <el-select
            v-model="form.model"
            filterable
            allow-create
            clearable
            default-first-option
            style="width: 100%"
            :placeholder="t('contacts.parser.modelPlaceholder')"
          >
            <el-option
              v-for="item in filteredModels"
              :key="`${item.provider}:${item.id}`"
              :label="`${item.id} (${item.provider})`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item :label="t('contacts.parser.temperature')">
          <el-input-number
            v-model="form.temperature"
            :min="limits.temperatureMin"
            :max="limits.temperatureMax"
            :step="0.1"
          />
        </el-form-item>

        <el-form-item :label="t('contacts.parser.maxTokens')">
          <el-input-number
            v-model="form.max_tokens"
            :min="limits.maxTokensMin"
            :max="limits.maxTokensMax"
            :step="50"
          />
        </el-form-item>

        <el-form-item :label="t('contacts.parser.timeoutMinutes')">
          <el-input-number
            v-model="form.timeout_minutes"
            :min="timeoutMinutesMin"
            :max="timeoutMinutesMax"
            :step="1"
          />
        </el-form-item>

        <el-form-item :label="t('contacts.parser.fetchTimeoutSec')">
          <el-input-number
            v-model="form.fetch_timeout_sec"
            :min="fetchTimeoutSecMin"
            :max="fetchTimeoutSecMax"
            :step="1"
          />
        </el-form-item>
      </div>

      <el-form-item :label="t('contacts.parser.allowKeywords')">
        <el-input v-model="form.allow_path_keywords" type="textarea" :rows="2" />
        <div class="field-hint">{{ t('contacts.parser.keywordsHint') }}</div>
      </el-form-item>

      <el-form-item :label="t('contacts.parser.denyKeywords')">
        <el-input v-model="form.deny_path_keywords" type="textarea" :rows="2" />
      </el-form-item>

      <el-form-item :label="t('contacts.parser.emailFallback')">
        <el-switch v-model="form.use_email_domain_fallback" />
      </el-form-item>

      <el-form-item :label="t('contacts.parser.systemPrompt')">
        <el-input
          v-model="form.system_prompt"
          type="textarea"
          :rows="8"
          :placeholder="defaults.system_prompt || ''"
        />
        <div class="prompt-actions">
          <el-button link type="primary" @click="resetSystemPrompt">
            {{ t('contacts.parser.resetPrompt') }}
          </el-button>
          <el-button link @click="resetAllDefaults">
            {{ t('contacts.parser.resetDefaults') }}
          </el-button>
        </div>
      </el-form-item>

      <div class="form-actions">
        <el-button type="primary" :loading="saving" @click="saveSettings">
          {{ t('contacts.parser.save') }}
        </el-button>
        <el-button :disabled="loading || saving" @click="loadSettings">
          {{ t('common.refresh') }}
        </el-button>
      </div>
    </el-form>

    <el-divider />

    <section class="run-section">
      <h2>{{ t('contacts.parser.runTitle') }}</h2>
      <p class="run-hint">{{ t('contacts.parser.runHint') }}</p>
      <el-button
        type="primary"
        :loading="running"
        :disabled="!selectedContactIds.length || !form.enabled"
        @click="runNow"
      >
        {{ t('contacts.parser.runNow') }}
      </el-button>
    </section>

    <el-divider />

    <section class="jobs-section">
      <div class="jobs-header">
        <h2>{{ t('contacts.parser.jobsTitle') }}</h2>
        <el-button :loading="jobsLoading" @click="loadJobs">{{ t('contacts.parser.jobsRefresh') }}</el-button>
      </div>

      <p v-if="!jobs.length && !jobsLoading" class="jobs-empty">{{ t('contacts.parser.jobsEmpty') }}</p>

      <div v-for="job in jobs" :key="job.id" class="job-card">
        <div class="job-meta">
          {{ t('contacts.parser.jobMeta', {
            id: job.id,
            status: statusLabel(job.status),
            processed: job.processed,
            total: job.total,
            succeeded: job.succeeded,
            skipped: job.skipped,
            failed: job.failed
          }) }}
        </div>
        <div v-if="activeJobDetails?.id === job.id && activeJobDetails.results?.length" class="job-results">
          <div v-for="row in activeJobDetails.results" :key="row.id" class="job-result-row">
            <router-link
              v-if="row.user_id"
              class="job-contact-link"
              :to="{ name: 'contact-profile', params: { id: row.user_id } }"
            >
              {{ t('contacts.parser.openContact', { id: row.user_id }) }}
            </router-link>
            <span>{{ row.status }}</span>
            <span v-if="row.pages_fetched">· {{ row.pages_fetched }} стр.</span>
            <span v-if="row.error" class="job-error">· {{ row.error }}</span>
            <span v-else-if="row.summary_preview" class="job-preview">· {{ row.summary_preview }}</span>
          </div>
        </div>
        <el-button link type="primary" @click="inspectJob(job.id)">
          {{ activeJobDetails?.id === job.id ? t('common.refresh') : t('contacts.parser.jobsRefresh') }}
        </el-button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import contactSiteParserService from '@/services/contactSiteParserService.js';

const PARSER_IDS_STORAGE_KEY = 'contactSiteParserIds';

const { t } = useI18n();
const route = useRoute();

const loading = ref(false);
const saving = ref(false);
const running = ref(false);
const jobsLoading = ref(false);
const models = ref([]);
const jobs = ref([]);
const activeJobDetails = ref(null);
let pollTimer = null;

const form = reactive({
  enabled: false,
  schedule_enabled: false,
  interval_days: 7,
  schedule_batch_size: 10,
  max_pages: 5,
  max_blog_pages: 1,
  allow_path_keywords: '',
  deny_path_keywords: '',
  use_email_domain_fallback: true,
  provider: 'ollama',
  model: '',
  system_prompt: '',
  temperature: 0.2,
  max_tokens: 600,
  timeout_minutes: 7,
  fetch_timeout_sec: 10
});

const defaults = reactive({
  enabled: false,
  schedule_enabled: false,
  interval_days: 7,
  schedule_batch_size: 10,
  max_pages: 5,
  max_blog_pages: 1,
  allow_path_keywords: '',
  deny_path_keywords: '',
  use_email_domain_fallback: true,
  provider: 'ollama',
  model: null,
  system_prompt: '',
  temperature: 0.2,
  max_tokens: 600,
  timeout_ms: 420000,
  fetch_timeout_ms: 10000
});

const limits = reactive({
  temperatureMin: 0,
  temperatureMax: 2,
  maxTokensMin: 50,
  maxTokensMax: 4000,
  intervalDaysMin: 1,
  intervalDaysMax: 90,
  maxPagesMin: 1,
  maxPagesMax: 10,
  maxBlogPagesMin: 0,
  maxBlogPagesMax: 3,
  scheduleBatchSizeMin: 1,
  scheduleBatchSizeMax: 50
});

const providerOptions = [
  { value: 'ollama', label: 'Ollama' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' }
];

const timeoutMinutesMin = 1;
const timeoutMinutesMax = 30;
const fetchTimeoutSecMin = 3;
const fetchTimeoutSecMax = 30;

const selectedContactIds = computed(() => {
  const parseIds = (raw) => [...new Set(String(raw || '').split(',').map((id) => Number(id.trim())).filter((id) => Number.isInteger(id) && id > 0))];
  const fromQuery = parseIds(route.query.ids);
  const fromStorage = parseIds(sessionStorage.getItem(PARSER_IDS_STORAGE_KEY));
  // sessionStorage надёжнее длинного ?ids= (URL может обрезаться)
  if (fromStorage.length >= fromQuery.length && fromStorage.length > 0) return fromStorage;
  return fromQuery;
});

const filteredModels = computed(() => {
  const provider = form.provider;
  return (models.value || []).filter((item) => !provider || item.provider === provider);
});

function applySettings(settings = {}, defaultsPayload = {}) {
  Object.assign(defaults, defaultsPayload);
  if (defaultsPayload.limits) Object.assign(limits, defaultsPayload.limits);

  form.enabled = Boolean(settings.enabled);
  form.schedule_enabled = Boolean(settings.schedule_enabled);
  form.interval_days = Number(settings.interval_days) || defaults.interval_days;
  form.schedule_batch_size = Number(settings.schedule_batch_size) || defaults.schedule_batch_size;
  form.max_pages = Number(settings.max_pages) || defaults.max_pages;
  form.max_blog_pages = Number(settings.max_blog_pages) ?? defaults.max_blog_pages;
  form.allow_path_keywords = settings.allow_path_keywords || defaults.allow_path_keywords || '';
  form.deny_path_keywords = settings.deny_path_keywords || defaults.deny_path_keywords || '';
  form.use_email_domain_fallback = settings.use_email_domain_fallback !== false;
  form.provider = settings.provider || 'ollama';
  form.model = settings.model || '';
  form.system_prompt = settings.system_prompt || defaults.system_prompt || '';
  form.temperature = Number(settings.temperature) || 0.2;
  form.max_tokens = Number(settings.max_tokens) || 600;
  form.timeout_minutes = Math.round((Number(settings.timeout_ms) || defaults.timeout_ms || 420000) / 60000);
  form.fetch_timeout_sec = Math.round((Number(settings.fetch_timeout_ms) || defaults.fetch_timeout_ms || 10000) / 1000);
}

async function loadSettings() {
  loading.value = true;
  try {
    const data = await contactSiteParserService.getSettings();
    applySettings(data.settings || {}, data.defaults || {});
    await loadModels();
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.parser.loadError'));
  } finally {
    loading.value = false;
  }
}

async function loadModels() {
  try {
    const data = await contactSiteParserService.getModels(form.provider);
    models.value = data.models || [];
  } catch {
    models.value = [];
  }
}

async function onProviderChange() {
  form.model = '';
  await loadModels();
}

function resetSystemPrompt() {
  form.system_prompt = defaults.system_prompt || '';
}

function resetAllDefaults() {
  applySettings(defaults, { ...defaults, limits: { ...limits } });
}

async function saveSettings() {
  saving.value = true;
  try {
    const payload = {
      enabled: form.enabled,
      schedule_enabled: form.schedule_enabled,
      interval_days: form.interval_days,
      schedule_batch_size: form.schedule_batch_size,
      max_pages: form.max_pages,
      max_blog_pages: form.max_blog_pages,
      allow_path_keywords: form.allow_path_keywords,
      deny_path_keywords: form.deny_path_keywords,
      use_email_domain_fallback: form.use_email_domain_fallback,
      provider: form.provider,
      model: form.model || null,
      system_prompt: form.system_prompt,
      temperature: form.temperature,
      max_tokens: form.max_tokens,
      timeout_ms: Math.round(form.timeout_minutes * 60000),
      fetch_timeout_ms: Math.round(form.fetch_timeout_sec * 1000)
    };
    const data = await contactSiteParserService.saveSettings(payload);
    applySettings(data.settings || {}, data.defaults || {});
    ElMessage.success(t('contacts.parser.saved'));
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.parser.saveError'));
  } finally {
    saving.value = false;
  }
}

function statusLabel(status) {
  const map = {
    pending: t('contacts.parser.statusPending'),
    running: t('contacts.parser.statusRunning'),
    done: t('contacts.parser.statusDone'),
    failed: t('contacts.parser.statusFailed')
  };
  return map[status] || status;
}

async function loadJobs() {
  jobsLoading.value = true;
  try {
    const data = await contactSiteParserService.listJobs({ limit: 10 });
    jobs.value = data.jobs || [];
  } catch {
    jobs.value = [];
  } finally {
    jobsLoading.value = false;
  }
}

async function inspectJob(jobId) {
  try {
    const data = await contactSiteParserService.getJob(jobId);
    activeJobDetails.value = data.job || null;
    await loadJobs();
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.parser.loadError'));
  }
}

async function runNow() {
  if (!selectedContactIds.value.length) return;
  running.value = true;
  try {
    const data = await contactSiteParserService.startJob({
      userIds: selectedContactIds.value,
      force: true
    });
    const jobId = data.job?.id;
    ElMessage.success(t('contacts.parser.runStarted', { id: jobId }));
    await loadJobs();
    if (jobId) {
      await inspectJob(jobId);
      startPolling(jobId);
    }
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.parser.runError'));
  } finally {
    running.value = false;
  }
}

function startPolling(jobId) {
  stopPolling();
  pollTimer = setInterval(async () => {
    try {
      const data = await contactSiteParserService.getJob(jobId);
      activeJobDetails.value = data.job || null;
      await loadJobs();
      const status = data.job?.status;
      if (status === 'done' || status === 'failed') {
        stopPolling();
      }
    } catch {
      stopPolling();
    }
  }, 3000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

onMounted(async () => {
  await loadSettings();
  await loadJobs();
});

onUnmounted(() => {
  stopPolling();
});
</script>

<style scoped>
.parser-alert {
  margin-bottom: 16px;
}

.parser-form {
  margin-top: 8px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
}

.field-hint {
  margin-top: 4px;
  font-size: 0.85rem;
  color: #909399;
}

.prompt-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.run-section h2,
.jobs-section h2 {
  margin: 0 0 8px;
  font-size: 1.15rem;
}

.run-hint {
  margin: 0 0 12px;
  color: #606266;
}

.jobs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.jobs-empty {
  color: #909399;
}

.job-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
  background: #fff;
}

.job-meta {
  font-size: 0.95rem;
  margin-bottom: 8px;
}

.job-results {
  margin: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.job-result-row {
  font-size: 0.9rem;
  color: #606266;
}

.job-contact-link {
  margin-right: 8px;
  color: #409eff;
  text-decoration: none;
}

.job-error {
  color: #f56c6c;
}

.job-preview {
  color: #67c23a;
}

@media (max-width: 700px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
