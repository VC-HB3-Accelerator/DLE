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
          :disabled="isApplying"
        />
      </label>
      <p class="form-hint">{{ t('settings.updates.dleContractHint') }}</p>
      <p class="form-hint">{{ t('settings.updates.applyHint') }}</p>
      <p v-if="!status.appRootReady" class="alert alert-warning">
        {{ t('settings.updates.appRootMissing') }}
      </p>
      <p v-if="applyError" class="alert alert-danger">{{ applyError }}</p>
      <p v-if="applySuccess" class="alert alert-success">{{ applySuccess }}</p>
      <button
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
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';
import { useAuthContext } from '@/composables/useAuth';
import { usePermissions } from '@/composables/usePermissions';
import { getAllDLEs } from '@/services/dleV2Service';
import {
  fetchUpdatesStatus,
  fetchLatestUpdate,
  applyUpdateHere,
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

async function handleApplyHere() {
  applyError.value = '';
  applySuccess.value = '';
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
  try {
    const job = await applyUpdateHere({
      dleContract: contract,
      fromVersion: status.value.currentVersion,
    });
    applySuccess.value = t('settings.updates.applyStarted', {
      version: job?.version || latest.value.version,
    });
  } catch (error) {
    const status = error.response?.status;
    if (status === 403) {
      applyError.value = t('settings.updates.notEntitled');
    } else {
      applyError.value = error.response?.data?.error
        || error.message
        || t('settings.updates.applyError');
    }
  } finally {
    isApplying.value = false;
  }
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

onMounted(loadPage);
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

@media (max-width: 768px) {
  .updates-settings__card {
    max-width: 100%;
  }
}
</style>
