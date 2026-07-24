<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="updates-settings settings-panel">
    <button class="close-btn" type="button" @click="router.push('/settings')">×</button>
    <h2>{{ t('settings.updates.pageTitle') }}</h2>
    <p class="updates-settings__intro">{{ t('settings.updates.intro') }}</p>

    <div v-if="loadError" class="updates-settings__error">{{ loadError }}</div>

    <section class="updates-settings__card">
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
      <p v-if="status.stubMode" class="updates-settings__hint">
        {{ t('settings.updates.stubHint') }}
      </p>
      <p v-if="status.hubUrl" class="updates-settings__hint">
        {{ t('settings.updates.hubLabel') }}: {{ status.hubUrl }}
      </p>
    </section>

    <section class="updates-settings__card">
      <h3>{{ t('settings.updates.applyTitle') }}</h3>
      <label class="updates-settings__field">
        <span>{{ t('settings.updates.dleContract') }}</span>
        <input
          v-model="dleContract"
          type="text"
          class="updates-settings__input"
          :placeholder="t('settings.updates.dleContractPlaceholder')"
          :disabled="isApplying"
        />
      </label>
      <p class="updates-settings__hint">{{ t('settings.updates.dleContractHint') }}</p>
      <p class="updates-settings__hint">{{ t('settings.updates.applyHint') }}</p>
      <p v-if="!status.appRootReady" class="updates-settings__error">
        {{ t('settings.updates.appRootMissing') }}
      </p>
      <p v-if="applyError" class="updates-settings__error">{{ applyError }}</p>
      <p v-if="applySuccess" class="updates-settings__success">{{ applySuccess }}</p>
      <button
        type="button"
        class="updates-settings__btn"
        :disabled="isApplying || !latest || !status.appRootReady"
        @click="handleApplyHere"
      >
        {{ isApplying ? t('settings.updates.applying') : t('settings.updates.applyHere') }}
      </button>
    </section>

    <!-- Только раздающий hub (hub_url=self в БД). У клиентов блок скрыт — один код у всех. -->
    <section v-if="isAdmin && isHubInstance" class="updates-settings__card">
      <h3>{{ t('settings.updates.hubSettingsTitle') }}</h3>
      <p class="updates-settings__hint">{{ t('settings.updates.hubSettingsHint') }}</p>

      <label class="updates-settings__field">
        <span>{{ t('settings.updates.hubUrl') }}</span>
        <input v-model="hubForm.hub_url" type="text" class="updates-settings__input" :disabled="isSavingHub" />
      </label>
      <label class="updates-settings__check">
        <input v-model="hubForm.stub_mode" type="checkbox" :disabled="isSavingHub" />
        <span>{{ t('settings.updates.stubMode') }}</span>
      </label>

      <label class="updates-settings__field">
        <span>{{ t('settings.updates.hubServiceToken') }}</span>
        <input
          v-model="hubForm.hub_service_token"
          type="password"
          class="updates-settings__input"
          :placeholder="hubMeta.hub_service_token_set ? hubMeta.hub_service_token_hint : t('settings.updates.tokenPlaceholder')"
          :disabled="isSavingHub"
          autocomplete="new-password"
        />
      </label>
      <p class="updates-settings__hint">{{ t('settings.updates.hubServiceTokenHint') }}</p>

      <p class="updates-settings__hint">{{ t('settings.updates.giteaHubOnlyHint') }}</p>
      <label class="updates-settings__field">
        <span>{{ t('settings.updates.giteaUrl') }}</span>
        <input v-model="hubForm.gitea_url" type="text" class="updates-settings__input" :disabled="isSavingHub" />
      </label>
      <label class="updates-settings__field">
        <span>{{ t('settings.updates.giteaOrg') }}</span>
        <input v-model="hubForm.gitea_org" type="text" class="updates-settings__input" :disabled="isSavingHub" />
      </label>
      <label class="updates-settings__field">
        <span>{{ t('settings.updates.giteaRepo') }}</span>
        <input v-model="hubForm.gitea_repo" type="text" class="updates-settings__input" :disabled="isSavingHub" />
      </label>
      <label class="updates-settings__field">
        <span>{{ t('settings.updates.giteaAssetTemplate') }}</span>
        <input v-model="hubForm.gitea_asset_template" type="text" class="updates-settings__input" :disabled="isSavingHub" />
      </label>
      <label class="updates-settings__field">
        <span>{{ t('settings.updates.giteaToken') }}</span>
        <input
          v-model="hubForm.gitea_token"
          type="password"
          class="updates-settings__input"
          :placeholder="hubMeta.gitea_token_set ? hubMeta.gitea_token_hint : t('settings.updates.tokenPlaceholder')"
          :disabled="isSavingHub"
          autocomplete="new-password"
        />
      </label>

      <p v-if="hubError" class="updates-settings__error">{{ hubError }}</p>
      <p v-if="hubSuccess" class="updates-settings__success">{{ hubSuccess }}</p>
      <button
        type="button"
        class="updates-settings__btn"
        :disabled="isSavingHub"
        @click="handleSaveHubSettings"
      >
        {{ isSavingHub ? t('settings.updates.saving') : t('settings.updates.saveHubSettings') }}
      </button>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
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
const router = useRouter();
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
    applyError.value = error.response?.data?.error
      || error.message
      || t('settings.updates.applyError');
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
.updates-settings {
  position: relative;
  padding: var(--block-padding, 1.5rem);
  background-color: var(--color-light, #f8f9fa);
  border-radius: var(--radius-md, 12px);
  margin-top: var(--spacing-lg, 1.5rem);
}

.updates-settings__intro {
  margin: 0 0 1.25rem;
  color: #6c757d;
  line-height: 1.5;
  max-width: 720px;
}

.updates-settings__card {
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1rem;
  max-width: 720px;
}

.updates-settings__card h3 {
  margin: 0 0 0.85rem;
  color: var(--color-primary);
  font-size: 1.1rem;
}

.updates-settings__meta {
  display: grid;
  gap: 0.75rem;
  margin: 0;
}

.updates-settings__meta dt {
  font-size: 0.8rem;
  color: #6c757d;
}

.updates-settings__meta dd {
  margin: 0.15rem 0 0;
  font-weight: 600;
  color: #343a40;
}

.updates-settings__changelog {
  margin: 1rem 0 0;
  color: #495057;
  line-height: 1.45;
}

.updates-settings__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
}

.updates-settings__field span {
  font-weight: 600;
  color: var(--color-primary);
}

.updates-settings__input {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 0.65rem 0.75rem;
  font-size: 0.95rem;
}

.updates-settings__hint {
  margin: 0 0 0.75rem;
  color: #6c757d;
  font-size: 0.9rem;
  line-height: 1.45;
}

.updates-settings__error {
  margin: 0 0 0.75rem;
  color: #c0392b;
}

.updates-settings__success {
  margin: 0 0 0.75rem;
  color: var(--color-primary-dark, #2e7d32);
}

.updates-settings__btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}

.updates-settings__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.updates-settings__check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.85rem;
  color: #343a40;
  font-weight: 500;
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: transparent;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: #6c757d;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #343a40;
}
</style>
