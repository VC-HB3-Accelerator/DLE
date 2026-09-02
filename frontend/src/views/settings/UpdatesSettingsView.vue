<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <AdminPageShell
    :title="t('settings.updates.pageTitle')"
    :show-close="true"
    fallback="/settings"
  >
    <p class="updates-settings__intro">{{ t('settings.updates.intro') }}</p>

    <div v-if="loadError" class="alert alert-danger">{{ loadError }}</div>

    <section class="updates-settings__card panel">
      <h3>{{ t('settings.updates.versionsTitle') }}</h3>
      <dl class="updates-settings__meta">
        <div>
          <dt>{{ t('settings.updates.currentVersion') }}</dt>
          <dd>{{ status.currentVersion || t('settings.updates.unknown') }}</dd>
        </div>
        <div>
          <dt>{{ t('settings.updates.latestVersion') }}</dt>
          <dd>{{ latest?.version || t('settings.updates.noRelease') }}</dd>
        </div>
        <div v-if="latest?.minFrom">
          <dt>{{ t('settings.updates.minFrom') }}</dt>
          <dd>{{ latest.minFrom }}</dd>
        </div>
      </dl>
      <p v-if="latest?.changelog" class="updates-settings__changelog">{{ latest.changelog }}</p>
      <p v-if="status.hubUrl" class="form-hint">
        {{ t('settings.updates.hubLabel') }}: {{ status.hubUrl }}
      </p>
    </section>

    <section class="updates-settings__card panel">
      <h3>{{ t('settings.updates.applyTitle') }}</h3>
      <label class="updates-settings__field">
        <span class="form-label">{{ t('settings.updates.dleContract') }}</span>
        <input
          v-model="dleContract"
          type="text"
          class="form-control"
          :placeholder="t('settings.updates.dleContractPlaceholder')"
          :disabled="isApplying || applyPhase === 'ready'"
        />
      </label>
      <p class="form-hint">{{ t('settings.updates.dleContractHint') }}</p>
      <p class="form-hint">{{ t('settings.updates.applyHint') }}</p>
      <p v-if="!status.appRootReady" class="alert alert-warning">
        {{ t('settings.updates.appRootMissing') }}
      </p>
      <p v-if="applyError" class="alert alert-danger">{{ applyError }}</p>
      <p v-if="applySuccess && applyPhase === 'idle'" class="alert alert-success">{{ applySuccess }}</p>

      <div
        v-if="showApplyProgress"
        class="updates-settings__live"
        :aria-busy="applyPhase !== 'ready' ? 'true' : 'false'"
      >
        <div class="updates-settings__live-head">
          <div v-if="applyPhase !== 'ready'" class="updates-settings__spinner" aria-hidden="true" />
          <strong>{{ t('settings.updates.applyLiveTitle') }}</strong>
        </div>
        <ol class="updates-settings__steps">
          <li
            v-for="step in applySteps"
            :key="step.id"
            class="updates-settings__step"
            :class="stepClass(step.id)"
          >
            <span class="updates-settings__step-mark" aria-hidden="true" />
            <span>{{ t(step.labelKey) }}</span>
          </li>
        </ol>
        <p class="updates-settings__live-status" aria-live="polite">{{ liveStatusText }}</p>
        <p v-if="jobDetail" class="form-hint">{{ jobDetail }}</p>
      </div>

      <button
        v-if="applyPhase === 'ready'"
        type="button"
        class="btn btn-primary"
        @click="handleReloadPage"
      >
        {{ t('settings.updates.reloadPage') }}
      </button>
      <button
        v-else
        type="button"
        class="btn btn-primary"
        :disabled="isApplying || !latest || !status.appRootReady"
        @click="handleApplyHere"
      >
        {{ isApplying ? t('settings.updates.applying') : t('settings.updates.applyHere') }}
      </button>
    </section>

    <!-- Только раздающий hub (hub_url=self в БД). У клиентов блок скрыт — один код у всех. -->
    <section v-if="isAdmin && isHubInstance" class="updates-settings__card panel">
      <h3>{{ t('settings.updates.hubSettingsTitle') }}</h3>
      <p class="form-hint">{{ t('settings.updates.hubSettingsHint') }}</p>

      <label class="updates-settings__field">
        <span class="form-label">{{ t('settings.updates.hubUrl') }}</span>
        <input v-model="hubForm.hub_url" type="text" class="form-control" :disabled="isSavingHub" />
      </label>
      <label class="updates-settings__check">
        <input v-model="hubForm.stub_mode" type="checkbox" :disabled="isSavingHub" />
        <span>{{ t('settings.updates.stubMode') }}</span>
      </label>

      <label class="updates-settings__field">
        <span class="form-label">{{ t('settings.updates.hubServiceToken') }}</span>
        <input
          v-model="hubForm.hub_service_token"
          type="password"
          class="form-control"
          :placeholder="hubMeta.hub_service_token_set ? hubMeta.hub_service_token_hint : t('settings.updates.tokenPlaceholder')"
          :disabled="isSavingHub"
          autocomplete="new-password"
        />
      </label>
      <p class="form-hint">{{ t('settings.updates.hubServiceTokenHint') }}</p>

      <p class="form-hint">{{ t('settings.updates.giteaHubOnlyHint') }}</p>
      <label class="updates-settings__field">
        <span class="form-label">{{ t('settings.updates.giteaUrl') }}</span>
        <input v-model="hubForm.gitea_url" type="text" class="form-control" :disabled="isSavingHub" />
      </label>
      <label class="updates-settings__field">
        <span class="form-label">{{ t('settings.updates.giteaOrg') }}</span>
        <input v-model="hubForm.gitea_org" type="text" class="form-control" :disabled="isSavingHub" />
      </label>
      <label class="updates-settings__field">
        <span class="form-label">{{ t('settings.updates.giteaRepo') }}</span>
        <input v-model="hubForm.gitea_repo" type="text" class="form-control" :disabled="isSavingHub" />
      </label>
      <label class="updates-settings__field">
        <span class="form-label">{{ t('settings.updates.giteaAssetTemplate') }}</span>
        <input v-model="hubForm.gitea_asset_template" type="text" class="form-control" :disabled="isSavingHub" />
      </label>
      <label class="updates-settings__field">
        <span class="form-label">{{ t('settings.updates.giteaToken') }}</span>
        <input
          v-model="hubForm.gitea_token"
          type="password"
          class="form-control"
          :placeholder="hubMeta.gitea_token_set ? hubMeta.gitea_token_hint : t('settings.updates.tokenPlaceholder')"
          :disabled="isSavingHub"
          autocomplete="new-password"
        />
      </label>

      <p v-if="hubError" class="alert alert-danger">{{ hubError }}</p>
      <p v-if="hubSuccess" class="alert alert-success">{{ hubSuccess }}</p>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="isSavingHub"
        @click="handleSaveHubSettings"
      >
        {{ isSavingHub ? t('settings.updates.saving') : t('settings.updates.saveHubSettings') }}
      </button>
    </section>
  </AdminPageShell>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';
import { useAuthContext } from '@/composables/useAuth';
import { usePermissions } from '@/composables/usePermissions';
import { getAllDLEs } from '@/services/dleV2Service';
import {
  fetchUpdatesStatus,
  fetchLatestUpdate,
  applyUpdateHere,
  fetchApplyJob,
  fetchInstanceHealth,
  fetchHubSettings,
  saveHubSettings,
} from '@/services/updatesService';

const { t } = useI18n();
const { checkAuth, checkUserAccessLevel, address, isAuthenticated } = useAuthContext();
const { canManageSettings } = usePermissions();

const isAdmin = computed(() => canManageSettings.value);

const status = ref({});
const latest = ref(null);
const dleContract = ref('');
const loadError = ref('');
const applyError = ref('');
const applySuccess = ref('');
const isApplying = ref(false);
const applyPhase = ref('idle');
const jobDetail = ref('');
const applyJobId = ref('');
const applyVersion = ref('');

const APPLY_STORAGE_KEY = 'dle-updates-apply-job';
const APPLY_STORAGE_MAX_MS = 45 * 60 * 1000;
const JOB_POLL_MS = 2000;
const HEALTH_POLL_MS = 3000;
const DOWN_STREAK_TO_REBUILD = 2;
const UP_STREAK_TO_READY = 2;

const applySteps = [
  { id: 'downloading', labelKey: 'settings.updates.phaseDownloading' },
  { id: 'applying', labelKey: 'settings.updates.phaseUpdateSh' },
  { id: 'rebuilding', labelKey: 'settings.updates.phaseRebuild' },
];

const showApplyProgress = computed(() => (
  applyPhase.value !== 'idle' && applyPhase.value !== 'error'
));

const liveStatusText = computed(() => {
  switch (applyPhase.value) {
    case 'downloading':
      return t('settings.updates.phaseDownloadingHint');
    case 'applying':
      return t('settings.updates.phaseUpdateShHint');
    case 'started':
      return t('settings.updates.phaseUpdateShHint');
    case 'rebuilding':
      return t('settings.updates.phaseWaitingSite');
    case 'ready':
      return t('settings.updates.phaseSiteReady');
    default:
      return '';
  }
});

let pollTimer = null;
let pollCancelled = false;
let downStreak = 0;
let upStreak = 0;

const hubMeta = ref({});
const hubSettingsLoaded = ref(false);
const hubForm = ref({
  hub_url: '',
  stub_mode: true,
  gitea_url: '',
  gitea_org: '',
  gitea_repo: '',
  gitea_asset_template: '',
  gitea_token: '',
  hub_service_token: '',
});
const hubError = ref('');
const hubSuccess = ref('');
const isSavingHub = ref(false);

/**
 * Раздающий hub (HB3): в БД hub_url = self|local.
 * Один код у всех; у клиентов блок скрыт. После обновления инстанса видимость
 * не меняется — смотрим только значение в БД этого инстанса.
 */
const isHubInstance = computed(() => {
  if (!hubSettingsLoaded.value) return false;
  const raw = String(hubForm.value.hub_url || status.value.hubUrl || '')
    .trim()
    .toLowerCase();
  return raw === 'self' || raw === 'local';
});

function applyHubToForm(data) {
  hubMeta.value = data || {};
  hubForm.value = {
    hub_url: data?.hub_url || '',
    stub_mode: Boolean(data?.stub_mode),
    gitea_url: data?.gitea_url || '',
    gitea_org: data?.gitea_org || '',
    gitea_repo: data?.gitea_repo || '',
    gitea_asset_template: data?.gitea_asset_template || '',
    gitea_token: '',
    hub_service_token: '',
  };
  hubSettingsLoaded.value = true;
}

async function loadPage() {
  loadError.value = '';
  try {
    await checkAuth();
    if (isAuthenticated.value && address.value) {
      await checkUserAccessLevel(address.value);
    }

    status.value = await fetchUpdatesStatus();
    latest.value = await fetchLatestUpdate();

    try {
      const dles = await getAllDLEs();
      const list = dles?.data || dles || [];
      const first = Array.isArray(list) ? list[0] : null;
      const addr = first?.dleAddress
        || first?.deployedNetworks?.[0]?.address
        || '';
      if (addr && !dleContract.value) {
        dleContract.value = addr;
      }
    } catch {
      // DLE список опционален
    }

    if (isAdmin.value) {
      try {
        applyHubToForm(await fetchHubSettings());
      } catch {
        // нет прав / таблица ещё не смигрирована — блок hub не показываем
        hubSettingsLoaded.value = true;
      }
    }
  } catch (error) {
    loadError.value = error.response?.data?.error || error.message || t('settings.updates.loadError');
  }
}

function stepIndex(phase) {
  if (phase === 'downloading') return 0;
  if (phase === 'applying') return 1;
  if (phase === 'started' || phase === 'rebuilding') return 2;
  if (phase === 'ready') return 3;
  return -1;
}

function stepClass(stepId) {
  const order = { downloading: 0, applying: 1, rebuilding: 2 };
  const current = stepIndex(applyPhase.value);
  const idx = order[stepId];
  if (current > idx) return 'updates-settings__step--done';
  if (current === idx) return 'updates-settings__step--active';
  return '';
}

function stopPolling() {
  pollCancelled = true;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function schedulePoll(delayMs) {
  if (pollCancelled) return;
  pollTimer = setTimeout(() => {
    pollTimer = null;
    tickApplyProgress();
  }, delayMs);
}

function persistApplyJob(phaseOverride) {
  if (!applyJobId.value) return;
  try {
    sessionStorage.setItem(APPLY_STORAGE_KEY, JSON.stringify({
      jobId: applyJobId.value,
      version: applyVersion.value,
      phase: phaseOverride || applyPhase.value,
      startedAt: Date.now(),
    }));
  } catch {
    // private mode / quota
  }
}

function clearPersistedApplyJob() {
  try {
    sessionStorage.removeItem(APPLY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function readPersistedApplyJob() {
  try {
    const raw = sessionStorage.getItem(APPLY_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.jobId || !data?.startedAt) return null;
    if (Date.now() - Number(data.startedAt) > APPLY_STORAGE_MAX_MS) {
      sessionStorage.removeItem(APPLY_STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function isUnavailableError(error) {
  const status = error.response?.status;
  if (status === 502 || status === 503 || status === 504) return true;
  if (!error.response) return true;
  const code = error.code || '';
  return code === 'ECONNABORTED'
    || code === 'ERR_NETWORK'
    || code === 'ERR_CANCELED'
    || code === 'ECONNRESET';
}

function applyJobStatusToPhase(status) {
  if (status === 'downloading') return 'downloading';
  if (status === 'applying') return 'applying';
  if (status === 'started') return 'started';
  if (status === 'error') return 'error';
  return applyPhase.value === 'idle' ? 'downloading' : applyPhase.value;
}

function markReady() {
  applyPhase.value = 'ready';
  isApplying.value = false;
  jobDetail.value = '';
  applySuccess.value = applyVersion.value
    ? t('settings.updates.applyStarted', { version: applyVersion.value })
    : '';
  persistApplyJob('ready');
  stopPolling();
}

async function probeSiteUntilReady() {
  if (pollCancelled) return;
  const ok = await fetchInstanceHealth();
  if (pollCancelled) return;
  if (ok) {
    upStreak += 1;
    downStreak = 0;
    if (upStreak >= UP_STREAK_TO_READY) {
      markReady();
      return;
    }
  } else {
    upStreak = 0;
    applyPhase.value = 'rebuilding';
  }
  schedulePoll(HEALTH_POLL_MS);
}

async function tickApplyProgress() {
  if (pollCancelled) return;

  if (applyPhase.value === 'rebuilding' || applyPhase.value === 'ready') {
    if (applyPhase.value === 'ready') return;
    await probeSiteUntilReady();
    return;
  }

  const jobId = applyJobId.value;
  if (!jobId) {
    await probeSiteUntilReady();
    return;
  }

  try {
    const job = await fetchApplyJob(jobId);
    downStreak = 0;
    jobDetail.value = job?.message || '';
    const nextPhase = applyJobStatusToPhase(job?.status);
    if (nextPhase === 'error') {
      applyPhase.value = 'error';
      isApplying.value = false;
      applyError.value = job?.message || t('settings.updates.applyError');
      clearPersistedApplyJob();
      stopPolling();
      return;
    }
    applyPhase.value = nextPhase;
    persistApplyJob();
    schedulePoll(JOB_POLL_MS);
  } catch (error) {
    const status = error.response?.status;
    if (status === 404 || status === 401) {
      const progressed = applyPhase.value === 'applying'
        || applyPhase.value === 'started'
        || applyPhase.value === 'rebuilding';
      if (status === 404 && !progressed) {
        const siteUp = await fetchInstanceHealth();
        if (pollCancelled) return;
        if (siteUp) {
          applyPhase.value = 'error';
          isApplying.value = false;
          applyError.value = error.response?.data?.error
            || t('settings.updates.applyError');
          clearPersistedApplyJob();
          stopPolling();
          return;
        }
      }
      applyPhase.value = 'rebuilding';
      jobDetail.value = '';
      persistApplyJob('rebuilding');
      await probeSiteUntilReady();
      return;
    }
    if (isUnavailableError(error)) {
      downStreak += 1;
      if (downStreak >= DOWN_STREAK_TO_REBUILD) {
        applyPhase.value = 'rebuilding';
        jobDetail.value = '';
        persistApplyJob('rebuilding');
        await probeSiteUntilReady();
        return;
      }
      schedulePoll(JOB_POLL_MS);
      return;
    }
    applyPhase.value = 'error';
    isApplying.value = false;
    applyError.value = error.response?.data?.error
      || error.message
      || t('settings.updates.applyError');
    stopPolling();
  }
}

function startApplyPolling(jobId, version) {
  stopPolling();
  pollCancelled = false;
  downStreak = 0;
  upStreak = 0;
  applyJobId.value = jobId;
  applyVersion.value = version || '';
  persistApplyJob();
  schedulePoll(400);
}

async function resumeApplyIfNeeded() {
  const stored = readPersistedApplyJob();
  if (!stored?.jobId) return;
  applyJobId.value = stored.jobId;
  applyVersion.value = stored.version || latest.value?.version || '';
  applyError.value = '';
  applySuccess.value = '';
  if (stored.phase === 'ready') {
    applyPhase.value = 'ready';
    isApplying.value = false;
    return;
  }
  applyPhase.value = stored.phase || 'started';
  isApplying.value = true;
  startApplyPolling(stored.jobId, applyVersion.value);
}

async function handleApplyHere() {
  applyError.value = '';
  applySuccess.value = '';
  jobDetail.value = '';
  const contract = String(dleContract.value || '').trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(contract)) {
    applyError.value = t('settings.updates.invalidContract');
    return;
  }
  if (!latest.value?.version) {
    applyError.value = t('settings.updates.noRelease');
    return;
  }

  isApplying.value = true;
  applyPhase.value = 'downloading';
  try {
    const job = await applyUpdateHere({
      dleContract: contract,
      fromVersion: status.value.currentVersion,
    });
    const version = job?.version || latest.value.version;
    applyPhase.value = applyJobStatusToPhase(job?.status) || 'downloading';
    jobDetail.value = job?.message || '';
    if (applyPhase.value === 'error') {
      isApplying.value = false;
      applyError.value = job?.message || t('settings.updates.applyError');
      return;
    }
    if (!job?.id) {
      isApplying.value = false;
      applyPhase.value = 'error';
      applyError.value = t('settings.updates.applyError');
      return;
    }
    startApplyPolling(job.id, version);
  } catch (error) {
    isApplying.value = false;
    applyPhase.value = 'error';
    const httpStatus = error.response?.status;
    if (httpStatus === 403) {
      applyError.value = t('settings.updates.notEntitled');
    } else {
      applyError.value = error.response?.data?.error
        || error.message
        || t('settings.updates.applyError');
    }
  }
}

function handleReloadPage() {
  clearPersistedApplyJob();
  window.location.reload();
}

async function handleSaveHubSettings() {
  hubError.value = '';
  hubSuccess.value = '';
  isSavingHub.value = true;
  try {
    const payload = {
      hub_url: hubForm.value.hub_url,
      stub_mode: hubForm.value.stub_mode,
      gitea_url: hubForm.value.gitea_url,
      gitea_org: hubForm.value.gitea_org,
      gitea_repo: hubForm.value.gitea_repo,
      gitea_asset_template: hubForm.value.gitea_asset_template,
    };
    if (String(hubForm.value.hub_service_token || '').trim()) {
      payload.hub_service_token = String(hubForm.value.hub_service_token).trim();
    }
    if (String(hubForm.value.gitea_token || '').trim()) {
      payload.gitea_token = String(hubForm.value.gitea_token).trim();
    }
    applyHubToForm(await saveHubSettings(payload));
    hubSuccess.value = t('settings.updates.hubSaved');
    status.value = await fetchUpdatesStatus();
  } catch (error) {
    hubError.value = error.response?.data?.error || error.message || t('settings.updates.hubSaveError');
  } finally {
    isSavingHub.value = false;
  }
}

watch(isAuthenticated, (ok) => {
  if (ok) loadPage();
});

onMounted(async () => {
  await loadPage();
  await resumeApplyIfNeeded();
});

onUnmounted(() => {
  stopPolling();
});
</script>

<style scoped>
.updates-settings__intro {
  margin: 0 0 var(--spacing-lg);
  color: var(--theme-text-muted);
  line-height: 1.5;
  max-width: 720px;
}

.updates-settings__card {
  max-width: 720px;
  margin-bottom: var(--spacing-md);
  background: var(--color-white);
}

.updates-settings__card h3 {
  margin: 0 0 var(--spacing-md);
  color: var(--color-dark);
  font-size: var(--font-size-lg);
}

.updates-settings__meta {
  display: grid;
  gap: var(--spacing-md);
  margin: 0;
}

.updates-settings__meta dt {
  font-size: var(--font-size-xs);
  color: var(--theme-text-muted);
}

.updates-settings__meta dd {
  margin: var(--spacing-xs) 0 0;
  font-weight: 600;
  color: var(--color-text);
}

.updates-settings__changelog {
  margin: var(--spacing-md) 0 0;
  color: var(--color-text);
  line-height: 1.45;
}

.updates-settings__field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-md);
}

.updates-settings__check {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin: 0 0 var(--spacing-md);
  color: var(--color-text);
  font-weight: 500;
}

.updates-settings__live {
  margin: 0 0 var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid var(--color-grey-light, #e5e7eb);
  border-radius: var(--block-radius, 8px);
  background: color-mix(in srgb, var(--color-primary) 6%, white);
}

.updates-settings__live-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
  color: var(--color-dark);
}

.updates-settings__spinner {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border: 3px solid var(--color-grey-light, #e5e7eb);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: updates-spin 0.8s linear infinite;
}

@keyframes updates-spin {
  to { transform: rotate(360deg); }
}

.updates-settings__steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--spacing-sm);
}

.updates-settings__step {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--theme-text-muted);
}

.updates-settings__step--done,
.updates-settings__step--active {
  color: var(--color-text);
}

.updates-settings__step--active {
  font-weight: 600;
}

.updates-settings__step-mark {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-grey-light, #d1d5db);
}

.updates-settings__step--done .updates-settings__step-mark,
.updates-settings__step--active .updates-settings__step-mark {
  background: var(--color-primary);
}

.updates-settings__step--active .updates-settings__step-mark {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 25%, transparent);
}

.updates-settings__live-status {
  margin: var(--spacing-md) 0 0;
  color: var(--color-text);
  line-height: 1.45;
}

@media (max-width: 768px) {
  .updates-settings__card {
    max-width: 100%;
  }
}
</style>
