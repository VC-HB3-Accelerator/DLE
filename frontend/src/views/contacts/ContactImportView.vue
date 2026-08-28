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
  <BaseLayout>
    <div class="import-page page-with-close">
      <PageCloseButton :on-navigate="goBack" />
      <div class="import-topbar">
        <div>
          <h1 class="import-title">{{ t('contacts.importModal.title') }}</h1>
          <p class="import-subtitle">{{ t('contacts.importModal.pageSubtitle') }}</p>
        </div>
      </div>

      <div v-if="step === 1" class="import-panel">
        <el-upload
          drag
          :auto-upload="false"
          :show-file-list="false"
          accept=".csv,.json"
          @change="handleFileChange"
          class="import-upload"
        >
          <el-icon class="el-icon--upload"><Upload /></el-icon>
          <div class="el-upload__text">
            {{ t('contacts.importModal.dragDrop') }}
            <em>{{ t('contacts.importModal.clickToSelect') }}</em>
          </div>
          <div class="el-upload__tip">{{ t('contacts.importModal.formats') }}</div>
        </el-upload>
      </div>

      <div v-else-if="step === 2" class="import-panel">
        <div class="import-section-label">{{ t('contacts.importModal.mapColumns') }}</div>
        <div class="import-multi-hint">{{ t('contacts.importModal.multiHint') }}</div>
        <el-table :data="previewRows" border class="import-preview-table">
          <el-table-column v-for="col in columns" :key="col" :label="col" min-width="140">
            <template #header>
              <el-select
                v-model="mapping[col]"
                :placeholder="t('contacts.importModal.selectField')"
                size="small"
              >
                <el-option
                  v-for="f in fields"
                  :key="f.value"
                  :label="f.label"
                  :value="f.value"
                />
              </el-select>
            </template>
            <template #default="scope">
              {{ scope.row[col] }}
            </template>
          </el-table-column>
          <el-table-column :label="t('contacts.importModal.remove')" width="80" fixed="right">
            <template #default="scope">
              <el-button type="danger" size="small" circle @click="removeRow(scope.$index)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="import-actions">
          <el-button @click="step = 1">{{ t('contacts.importModal.back') }}</el-button>
          <el-button type="primary" :loading="loading" @click="submitImport">
            {{ t('contacts.importModal.importBtn') }}
          </el-button>
        </div>
      </div>

      <div v-else-if="step === 'progress'" class="import-panel import-progress">
        <div class="import-progress__title">{{ t('contacts.importModal.progressTitle') }}</div>
        <el-progress
          :percentage="jobPercent"
          :status="progressBarStatus"
          :stroke-width="14"
        />
        <div class="import-progress__meta">
          {{ t('contacts.importModal.progressMeta', {
            processed: jobState.processed || 0,
            total: jobState.total || 0,
            added: jobState.added || 0,
            updated: jobState.updated || 0,
            status: jobStatusLabel
          }) }}
        </div>
        <div class="import-actions">
          <el-button
            v-if="jobRunning"
            type="danger"
            plain
            :loading="cancelLoading"
            @click="cancelImport"
          >
            {{ t('contacts.importModal.cancelBtn') }}
          </el-button>
          <el-button v-else type="primary" @click="finishAfterJob">
            {{ t('contacts.importModal.showResult') }}
          </el-button>
          <el-button @click="goBack">{{ t('contacts.importModal.backToList') }}</el-button>
        </div>
      </div>

      <div v-else-if="step === 3" class="import-panel">
        <div v-if="result.success" class="import-result import-result--ok">
          {{ t('contacts.importModal.importSuccess', { added: result.added, updated: result.updated }) }}
        </div>
        <div v-else-if="result.cancelled" class="import-result import-result--warn">
          {{ t('contacts.importModal.importCancelled', {
            added: result.added,
            updated: result.updated,
            processed: result.processed
          }) }}
        </div>
        <div v-else-if="result.failed" class="import-result import-result--err">
          {{ t('contacts.importModal.importFailed', { error: result.error_summary || '' }) }}
        </div>
        <div v-if="hardErrors.length" class="import-errors">
          {{ t('common.errors') }}
          <ul>
            <li v-for="err in hardErrors" :key="'e-' + err.row">
              {{ t('common.row', { row: err.row, error: err.error }) }}
            </li>
          </ul>
        </div>
        <div v-if="softWarnings.length" class="import-soft-warnings">
          {{ t('contacts.importModal.partialWarnings') }}
          <ul>
            <li v-for="err in softWarnings" :key="'w-' + err.row">
              {{ t('common.row', { row: err.row, error: err.warning }) }}
            </li>
          </ul>
        </div>
        <div class="import-actions">
          <el-button @click="resetLocalState">{{ t('contacts.importModal.importAgain') }}</el-button>
          <el-button type="primary" @click="goBack">{{ t('contacts.importModal.backToList') }}</el-button>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import Papa from 'papaparse';
import { ElMessage } from 'element-plus';
import { Upload, Delete } from '@element-plus/icons-vue';
import BaseLayout from '@/components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import contactsService from '@/services/contactsService';

const JOB_QUERY_KEY = 'job';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const step = ref(1);
const file = ref(null);
const rawRows = ref([]);
const columns = ref([]);
const previewRows = ref([]);
const mapping = reactive({});
const loading = ref(false);
const cancelLoading = ref(false);
const result = ref({});
const jobState = ref({});
const jobId = ref(null);
let pollTimer = null;

const hardErrors = computed(() =>
  (result.value.errors || []).filter((e) => e && e.error && !e.partial)
);
const softWarnings = computed(() =>
  (result.value.errors || []).filter((e) => e && e.partial && e.warning)
);

const jobRunning = computed(() => {
  const s = String(jobState.value.status || '');
  return s === 'pending' || s === 'running';
});

const jobPercent = computed(() => Number(jobState.value.percent) || 0);

const progressBarStatus = computed(() => {
  const s = String(jobState.value.status || '');
  if (s === 'done') return 'success';
  if (s === 'failed') return 'exception';
  if (s === 'cancelled') return 'warning';
  return undefined;
});

const jobStatusLabel = computed(() => {
  const s = String(jobState.value.status || '');
  if (s === 'pending') return t('contacts.importModal.statusPending');
  if (s === 'running') return t('contacts.importModal.statusRunning');
  if (s === 'done') return t('contacts.importModal.statusDone');
  if (s === 'cancelled') return t('contacts.importModal.statusCancelled');
  if (s === 'failed') return t('contacts.importModal.statusFailed');
  return s || '—';
});

const fields = computed(() => [
  { label: t('contacts.name'), value: 'name' },
  { label: t('contacts.email'), value: 'email' },
  { label: t('contacts.phone'), value: 'phone' },
  { label: t('contacts.website'), value: 'crm_link' },
  { label: t('contacts.telegram'), value: 'telegram' },
  { label: t('contacts.wallet'), value: 'wallet' },
  { label: t('contacts.comment'), value: 'crm_comment' }
]);

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function syncJobQuery(id) {
  const nextQuery = { ...route.query };
  if (id) nextQuery[JOB_QUERY_KEY] = String(id);
  else delete nextQuery[JOB_QUERY_KEY];
  router.replace({ query: nextQuery }).catch(() => {});
}

function applyFinishedJob(job) {
  stopPolling();
  jobState.value = job || {};
  const status = String(job?.status || '');
  result.value = {
    success: status === 'done',
    cancelled: status === 'cancelled',
    failed: status === 'failed',
    added: job?.added || 0,
    updated: job?.updated || 0,
    processed: job?.processed || 0,
    errors: job?.errors || [],
    errorsTotal: job?.errorsTotal || 0,
    error_summary: job?.error_summary || null
  };
  step.value = 3;
  if ((job?.errorsTotal || 0) > (job?.errors?.length || 0)) {
    ElMessage.warning(
      t('contacts.importModal.errorsTruncated', {
        shown: job.errors?.length || 0,
        total: job.errorsTotal
      })
    );
  }
}

async function pollJobOnce() {
  if (!jobId.value) return;
  try {
    const data = await contactsService.getImportJob(jobId.value);
    const job = data?.job;
    if (!job) return;
    jobState.value = job;
    const status = String(job.status || '');
    if (status === 'done' || status === 'failed' || status === 'cancelled') {
      applyFinishedJob(job);
    }
  } catch {
    /* next tick */
  }
}

function startPolling(id) {
  stopPolling();
  jobId.value = id;
  step.value = 'progress';
  syncJobQuery(id);
  pollJobOnce();
  pollTimer = setInterval(pollJobOnce, 1500);
}

function handleFileChange(e) {
  const f = e.raw || (e.target && e.target.files && e.target.files[0]);
  if (!f) return;
  file.value = f;
  const reader = new FileReader();
  reader.onload = (evt) => {
    let data = [];
    if (f.name.endsWith('.csv')) {
      const parsed = Papa.parse(evt.target.result, { header: true });
      data = parsed.data.filter((r) => Object.values(r).some(Boolean));
    } else if (f.name.endsWith('.json')) {
      try {
        const parsed = JSON.parse(evt.target.result);
        const dataCandidate = Array.isArray(parsed) ? parsed : findFirstArray(parsed);
        if (!Array.isArray(dataCandidate)) {
          throw new Error(t('contacts.importModal.jsonArrayRequired'));
        }
        data = dataCandidate;
      } catch (err) {
        ElMessage.error(t('contacts.importModal.jsonParseError', { error: err.message }));
        return;
      }
    }
    if (!data.length) {
      ElMessage.error(t('contacts.importModal.emptyFile'));
      return;
    }
    rawRows.value = data;
    columns.value = Object.keys(data[0]);
    previewRows.value = data.slice(0, 10);
    for (const col of columns.value) {
      const lower = col.toLowerCase();
      if (lower.includes('mail')) mapping[col] = 'email';
      else if (lower.includes('telegram') || lower.includes('телег') || lower === 'tg') mapping[col] = 'telegram';
      else if (
        lower.includes('phone')
        || lower.includes('телефон')
        || lower.includes('мобил')
        || lower.includes('mobile')
        || lower === 'tel'
        || lower.startsWith('tel_')
        || lower.startsWith('tel-')
      ) mapping[col] = 'phone';
      else if (lower.includes('wallet') || lower.includes('кошел')) mapping[col] = 'wallet';
      else if (lower.includes('comment') || lower.includes('коммент')) mapping[col] = 'crm_comment';
      else if (
        lower.includes('link')
        || lower.includes('url')
        || lower.includes('site')
        || lower.includes('сайт')
        || lower.includes('ссыл')
        || lower.includes('website')
        || lower.includes('web')
      ) mapping[col] = 'crm_link';
      else if (
        lower.includes('name')
        || lower.includes('имя')
        || lower.includes('назван')
        || lower.includes('фамилия')
        || lower.includes('отчество')
        || lower.includes('firstname')
        || lower.includes('first_name')
        || lower.includes('lastname')
        || lower.includes('last_name')
        || lower.includes('middlename')
        || lower.includes('middle_name')
        || lower.includes('patronymic')
        || lower === 'фио'
        || lower === 'fio'
      ) mapping[col] = 'name';
      else mapping[col] = '';
    }
    step.value = 2;
  };
  reader.readAsText(f);
}

function removeRow(idx) {
  rawRows.value.splice(idx, 1);
  previewRows.value = rawRows.value.slice(0, 10);
}

async function submitImport() {
  loading.value = true;
  const contacts = rawRows.value.map((row) => {
    const obj = {};
    const nameParts = [];
    for (const col of columns.value) {
      const field = mapping[col];
      if (!field) continue;
      const cell = row[col];
      if (cell == null || String(cell).trim() === '') continue;
      const text = String(cell).trim();
      if (field === 'name') {
        nameParts.push(text);
        continue;
      }
      if (field === 'crm_comment') {
        if (obj[field]) obj[field] = `${obj[field]}\n${text}`;
        else obj[field] = text;
        continue;
      }
      if (obj[field]) obj[field] = `${obj[field]}; ${text}`;
      else obj[field] = text;
    }
    if (nameParts.length) obj.name = nameParts.join(' ');
    return obj;
  });
  try {
    const data = await contactsService.createImportJob(contacts);
    const job = data?.job;
    if (!job?.id) {
      throw new Error(t('contacts.importModal.importError', { error: 'no job id' }));
    }
    jobState.value = job;
    startPolling(job.id);
  } catch (e) {
    ElMessage.error(t('contacts.importModal.importError', {
      error: e?.response?.data?.error?.message
        || e?.response?.data?.message
        || e?.response?.data?.error
        || e?.message
        || e
    }));
  } finally {
    loading.value = false;
  }
}

async function cancelImport() {
  if (!jobId.value || cancelLoading.value) return;
  cancelLoading.value = true;
  try {
    const data = await contactsService.cancelImportJob(jobId.value);
    if (data?.job) {
      jobState.value = data.job;
      if (['done', 'failed', 'cancelled'].includes(String(data.job.status))) {
        applyFinishedJob(data.job);
      }
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e?.message || String(e));
  } finally {
    cancelLoading.value = false;
  }
}

function finishAfterJob() {
  if (jobRunning.value) return;
  applyFinishedJob(jobState.value);
}

function resetLocalState() {
  stopPolling();
  step.value = 1;
  result.value = {};
  jobState.value = {};
  jobId.value = null;
  rawRows.value = [];
  columns.value = [];
  previewRows.value = [];
  file.value = null;
  Object.keys(mapping).forEach((k) => delete mapping[k]);
  loading.value = false;
  cancelLoading.value = false;
  syncJobQuery(null);
}

function goBack() {
  stopPolling();
  router.push({ name: 'contacts-list' });
}

function findFirstArray(obj) {
  if (Array.isArray(obj)) return obj;
  if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      const found = findFirstArray(obj[key]);
      if (found) return found;
    }
  }
  return null;
}

onMounted(async () => {
  const qJob = route.query[JOB_QUERY_KEY];
  if (qJob) {
    jobId.value = String(qJob);
    step.value = 'progress';
    try {
      const data = await contactsService.getImportJob(qJob);
      if (data?.job) {
        jobState.value = data.job;
        const status = String(data.job.status || '');
        if (status === 'done' || status === 'failed' || status === 'cancelled') {
          applyFinishedJob(data.job);
        } else {
          startPolling(data.job.id);
        }
      }
    } catch {
      ElMessage.warning(t('contacts.importModal.jobNotFound'));
      syncJobQuery(null);
      step.value = 1;
    }
  }
});

onUnmounted(() => {
  stopPolling();
});
</script>

<style scoped>
.import-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px;
  position: relative;
}

.import-topbar {
  margin-bottom: 20px;
  padding-right: 48px;
}

.import-title {
  margin: 0 0 6px;
  font-size: 1.5rem;
}

.import-subtitle {
  margin: 0;
  opacity: 0.8;
  line-height: 1.4;
}

.import-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.import-upload {
  width: 100%;
}

.import-section-label {
  font-weight: 600;
}

.import-multi-hint {
  font-size: 0.9em;
  opacity: 0.85;
  line-height: 1.35;
}

.import-preview-table {
  width: 100%;
}

.import-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.import-progress__title {
  font-weight: 600;
}

.import-progress__meta {
  font-size: 0.95em;
  opacity: 0.9;
  line-height: 1.4;
}

.import-result--ok {
  color: #1b7a3d;
}

.import-result--warn {
  color: #a15c00;
}

.import-result--err {
  color: #b42318;
}

.import-errors {
  color: #b42318;
  max-height: 180px;
  overflow: auto;
}

.import-soft-warnings {
  color: #a15c00;
  max-height: 180px;
  overflow: auto;
}

@media (max-width: 768px) {
  .import-page {
    padding: var(--block-padding-mobile, 16px);
  }

  .import-actions {
    flex-direction: column;
  }

  .import-actions :deep(.el-button) {
    width: 100%;
  }
}
</style>
