<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="pack-page page-with-close">
      <PageCloseButton :fallback="{ name: 'content-list' }" />

      <div class="pack-page__inner">
        <header class="pack-page__header">
          <h1>{{ t('content.settings.constructorTitle') }}</h1>
          <p class="pack-page__subtitle">{{ t('content.settings.constructorSubtitle') }}</p>
        </header>

        <div v-if="!canManageDocs" class="pack-page__alert">
          {{ t('content.settings.noPermission') }}
        </div>

        <template v-else>
          <section class="pack-block">
            <label class="pack-label" for="jurisdiction">{{ t('content.settings.countryLabel') }}</label>
            <select
              id="jurisdiction"
              v-model="jurisdiction"
              class="pack-input"
              :disabled="isLoadingCountries"
            >
              <option value="">
                {{ isLoadingCountries ? t('content.settings.countriesLoading') : t('content.settings.countryPlaceholder') }}
              </option>
              <option
                v-for="country in countriesOptions"
                :key="country.numeric"
                :value="country.numeric"
              >
                {{ country.title }} ({{ country.code }})
              </option>
            </select>
          </section>

          <div v-if="jurisdiction && !pack && !isLoadingPack" class="pack-page__alert">
            {{ t('content.settings.packMissing') }}
            <RouterLink class="pack-link" :to="{ name: 'content-templates' }">
              {{ t('content.settings.openTemplates') }}
            </RouterLink>
          </div>

          <div v-if="isLoadingPack" class="pack-page__muted">{{ t('content.settings.packLoading') }}</div>

          <template v-if="pack">
            <section class="pack-block pack-meta">
              <h2>{{ pack.title }}</h2>
              <p class="pack-page__muted">
                {{ pack.packId }} · v{{ pack.version }} ·
                {{ t('content.settings.docsCount', { count: pack.documents?.length || 0 }) }}
              </p>
            </section>

            <section class="pack-block">
              <div class="pack-docs-head">
                <h3>{{ t('content.settings.variablesTitle') }}</h3>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  :disabled="isSavingSettings"
                  @click="onSaveSettings"
                >
                  {{ isSavingSettings ? t('content.settings.savingSettings') : t('content.settings.saveSettings') }}
                </button>
              </div>
              <p class="pack-hint">{{ t('content.settings.domainHint') }}</p>
              <p class="pack-hint">{{ t('content.settings.autosaveHint') }}</p>
              <p v-if="settingsSavedAt" class="pack-hint">
                {{ t('content.settings.settingsSavedAt', { date: formatSavedAt(settingsSavedAt) }) }}
              </p>
              <p v-if="prefillNote" class="pack-hint">{{ prefillNote }}</p>
              <div class="pack-vars">
                <div
                  v-for="field in formFields"
                  :key="field.key"
                  class="pack-var"
                >
                  <label class="pack-label" :for="`var-${field.key}`">
                    {{ fieldLabel(field) }}
                    <span v-if="field.required" class="pack-req">*</span>
                  </label>
                  <input
                    :id="`var-${field.key}`"
                    v-model="formVars[field.key]"
                    type="text"
                    class="pack-input"
                    :required="field.required"
                  />
                </div>
              </div>
            </section>

            <section class="pack-block">
              <div class="pack-docs-head">
                <h3>{{ t('content.settings.documentsTitle') }}</h3>
                <div class="pack-docs-actions">
                  <button type="button" class="btn btn-secondary btn-sm" @click="selectAllDocs(true)">
                    {{ t('content.settings.selectAll') }}
                  </button>
                  <button type="button" class="btn btn-secondary btn-sm" @click="selectAllDocs(false)">
                    {{ t('content.settings.selectNone') }}
                  </button>
                </div>
              </div>
              <ul class="pack-docs">
                <li v-for="doc in pack.documents" :key="doc.id" class="pack-doc">
                  <label class="pack-doc__label">
                    <input v-model="selectedDocIds" type="checkbox" :value="doc.id" />
                    <span class="pack-doc__title">{{ doc.title }}</span>
                    <span class="pack-doc__badge">{{ doc.visibility }}</span>
                    <span v-if="doc.category" class="pack-doc__cat">{{ doc.category }}</span>
                  </label>
                </li>
              </ul>
            </section>

            <section class="pack-block">
              <label class="pack-label" for="gen-mode">{{ t('content.settings.modeLabel') }}</label>
              <select id="gen-mode" v-model="mode" class="pack-input">
                <option value="missing_only">{{ t('content.settings.modeMissing') }}</option>
                <option value="overwrite_selected">{{ t('content.settings.modeOverwrite') }}</option>
              </select>
              <p class="pack-hint">{{ t('content.settings.modeHint') }}</p>
            </section>

            <div class="pack-submit">
              <button
                type="button"
                class="btn btn-primary"
                :disabled="isGenerating || !selectedDocIds.length"
                @click="onGenerate"
              >
                {{ isGenerating ? t('content.settings.generating') : t('content.settings.generate') }}
              </button>
            </div>

            <section v-if="lastResult" class="pack-block pack-result">
              <h3>{{ t('content.settings.resultTitle') }}</h3>
              <p>
                {{ t('content.settings.resultCounts', lastResult.counts) }}
              </p>
              <div class="pack-result__links">
                <RouterLink
                  class="btn btn-secondary"
                  :to="{ name: 'content-published', query: { section: publishedSection } }"
                >
                  {{ t('content.settings.openPublished') }}
                </RouterLink>
                <RouterLink class="btn btn-secondary" :to="{ name: 'content-internal' }">
                  {{ t('content.settings.openInternal') }}
                </RouterLink>
              </div>
              <ul v-if="lastResult.results?.length" class="pack-result__list">
                <li
                  v-for="row in lastResult.results"
                  :key="row.id"
                  :class="['pack-result__item', `is-${row.action}`]"
                >
                  <strong>{{ row.id }}</strong>: {{ row.action }}
                  <span v-if="row.error"> — {{ row.error }}</span>
                  <span v-if="row.reason"> ({{ row.reason }})</span>
                </li>
              </ul>
            </section>
          </template>
        </template>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import api from '@/api/axios';
import legalPacksService from '../../services/legalPacksService';
import { usePermissions } from '../../composables/usePermissions';
import { PERMISSIONS } from '../../composables/permissions';

defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});
defineEmits(['auth-action-completed']);

const DEPLOY_STORAGE_KEY = 'dle_form_data';
const LEGACY_VAR_ALIASES = {
  legal_address: 'company_address',
  phone: 'privacy_phone',
  website: 'site',
  responsible_name: 'responsible_person',
};

const { t, locale } = useI18n();
const { hasPermission } = usePermissions();
const canManageDocs = computed(() => hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS));
const formFields = computed(() =>
  (pack.value?.variables || []).filter((v) => v.form !== false)
);
const publishedSection = computed(() =>
  pack.value?.publishedSection || 'политика и согласия'
);

const countriesOptions = ref([]);
const isLoadingCountries = ref(false);
const jurisdiction = ref('');
const pack = ref(null);
const isLoadingPack = ref(false);
const formVars = ref({});
const selectedDocIds = ref([]);
const mode = ref('missing_only');
const isGenerating = ref(false);
const lastResult = ref(null);
const savedSettings = ref(null);
const isSavingSettings = ref(false);
const settingsSavedAt = ref(null);
const prefillNote = ref('');
const hydrating = ref(false);
let autosaveTimer = null;
let syncSiteTimer = null;

function fieldLabel(field) {
  if (locale.value?.startsWith('en') && field.label_en) return field.label_en;
  return field.label_ru || field.key;
}

function formatSavedAt(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(locale.value?.startsWith('en') ? 'en-GB' : 'ru-RU');
  } catch {
    return String(iso);
  }
}

function selectAllDocs(on) {
  if (!pack.value) return;
  selectedDocIds.value = on ? pack.value.documents.map((d) => d.id) : [];
}

function isBlank(v) {
  return v == null || String(v).trim() === '';
}

function normalizeSavedVariables(raw) {
  const src = raw && typeof raw === 'object' ? { ...raw } : {};
  for (const [legacy, next] of Object.entries(LEGACY_VAR_ALIASES)) {
    if (!isBlank(src[legacy]) && isBlank(src[next])) {
      src[next] = src[legacy];
    }
  }
  return src;
}

function parseSiteUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  try {
    const rawHost = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split('/')[0].split('?')[0];
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`);
    if (!u.hostname) return null;
    const href = `${u.protocol}//${u.host}${u.pathname === '/' ? '' : u.pathname}`.replace(/\/$/, '');
    const displayHost = /[^\x00-\x7F]/.test(rawHost) ? rawHost : u.host;
    return { href, host: displayHost, hostname: displayHost };
  } catch {
    return null;
  }
}

function applySiteDerivedFields(target, { overwriteHost = true } = {}) {
  const parsed = parseSiteUrl(target.site);
  if (!parsed) return;
  target.site = parsed.href;
  if (overwriteHost || isBlank(target.site_host)) {
    target.site_host = parsed.host;
  }
  if (overwriteHost || isBlank(target.site_idn)) {
    target.site_idn = parsed.host;
  }
}

function shortenFio(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  const surname = parts[0];
  const initials = parts.slice(1).map((p) => `${p.charAt(0).toUpperCase()}.`).join('');
  return `${surname} ${initials}`.trim();
}

function applyResponsibleDerived(target) {
  if (isBlank(target.responsible_person)) return;
  if (isBlank(target.responsible_person_genitive)) {
    target.responsible_person_genitive = String(target.responsible_person).trim();
  }
  target.responsible_person_short = shortenFio(target.responsible_person);
}

function readDeployDraft() {
  try {
    const raw = localStorage.getItem(DEPLOY_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

function applyDeployPrefill(next) {
  const draft = readDeployDraft();
  if (!draft) return 0;
  let filled = 0;
  const setIfEmpty = (key, value) => {
    if (isBlank(next[key]) && !isBlank(value)) {
      next[key] = String(value).trim();
      filled += 1;
    }
  };
  setIfEmpty('company_name', draft.name);
  setIfEmpty('company_full', draft.name);
  setIfEmpty('kpp', draft.kppCode);
  const addr = draft.addressData?.fullAddress
    || [
      draft.addressData?.postalCode,
      draft.addressData?.region,
      draft.addressData?.city,
      draft.addressData?.street,
      draft.addressData?.building,
      draft.addressData?.apartment,
    ].filter(Boolean).join(', ');
  setIfEmpty('company_address', addr);
  return filled;
}

function initFormFromPack(p) {
  hydrating.value = true;
  prefillNote.value = '';
  const savedVars = normalizeSavedVariables(savedSettings.value?.variables || {});
  const next = {};
  for (const v of p.variables || []) {
    const fromSaved = savedVars[v.key];
    if (!isBlank(fromSaved)) {
      next[v.key] = String(fromSaved);
    } else if (v.default != null) {
      next[v.key] = String(v.default);
    } else {
      next[v.key] = formVars.value[v.key] || '';
    }
  }
  const prefilled = applyDeployPrefill(next);
  if (prefilled > 0) {
    prefillNote.value = t('content.settings.prefillDeployNote', { count: prefilled });
  }
  if (isBlank(next.jurisdiction_name)) {
    const country = countriesOptions.value.find((c) => String(c.numeric) === String(jurisdiction.value));
    if (country?.title) next.jurisdiction_name = String(country.title);
    else if (p.locale === 'en') next.jurisdiction_name = 'International';
  }
  applySiteDerivedFields(next);
  applyResponsibleDerived(next);
  if (!next.date) {
    const d = new Date();
    next.date = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  }
  formVars.value = next;
  selectedDocIds.value = (p.documents || []).filter((d) => d.required !== false).map((d) => d.id);
  lastResult.value = null;
  queueMicrotask(() => {
    hydrating.value = false;
  });
}

watch(jurisdiction, async (code) => {
  pack.value = null;
  if (!code) return;
  isLoadingPack.value = true;
  try {
    pack.value = await legalPacksService.getByJurisdiction(code);
    initFormFromPack(pack.value);
  } catch (e) {
    if (e.response?.status !== 404) {
      console.error(e);
    }
    pack.value = null;
  } finally {
    isLoadingPack.value = false;
  }
});

async function loadCountries() {
  isLoadingCountries.value = true;
  try {
    const response = await api.get('/countries');
    if (response.data && response.data.success) {
      countriesOptions.value = Array.isArray(response.data.data) ? response.data.data : [];
    } else {
      countriesOptions.value = Array.isArray(response.data?.data) ? response.data.data : [];
    }
  } catch (e) {
    console.error('[content-settings] countries', e);
    countriesOptions.value = [];
  } finally {
    isLoadingCountries.value = false;
  }
}

async function loadOperatorSettings() {
  try {
    const saved = await legalPacksService.getOperatorSettings();
    savedSettings.value = {
      ...saved,
      variables: normalizeSavedVariables(saved?.variables || {}),
    };
    settingsSavedAt.value = saved?.updatedAt || null;
    if (saved?.jurisdiction && !jurisdiction.value) {
      jurisdiction.value = String(saved.jurisdiction);
    } else if (!jurisdiction.value) {
      const draft = readDeployDraft();
      if (draft?.jurisdiction) {
        jurisdiction.value = String(draft.jurisdiction);
      }
    }
  } catch (e) {
    console.error('[content-settings] operator-settings', e);
  }
}

watch(
  canManageDocs,
  (ok) => {
    if (!ok) return;
    if (countriesOptions.value.length === 0) loadCountries();
    if (!savedSettings.value) loadOperatorSettings();
  },
  { immediate: true }
);

onMounted(() => {
  if (canManageDocs.value) {
    loadCountries();
    loadOperatorSettings();
  }
});

async function persistSettings({ silent = false } = {}) {
  if (!pack.value || !jurisdiction.value) return null;
  if (!silent) isSavingSettings.value = true;
  try {
    const vars = { ...formVars.value };
    applySiteDerivedFields(vars);
    applyResponsibleDerived(vars);
    formVars.value = vars;
    const saved = await legalPacksService.saveOperatorSettings({
      jurisdiction: jurisdiction.value,
      packId: pack.value?.packId || '',
      variables: vars,
    });
    savedSettings.value = {
      ...saved,
      variables: normalizeSavedVariables(saved?.variables || {}),
    };
    settingsSavedAt.value = saved.updatedAt;
    return saved;
  } catch (e) {
    if (!silent) {
      alert(e.response?.data?.error || e.message || t('common.unknownError'));
    } else {
      console.warn('[content-settings] autosave failed', e);
    }
    return null;
  } finally {
    if (!silent) isSavingSettings.value = false;
  }
}

function scheduleAutosave() {
  if (hydrating.value || !pack.value || !canManageDocs.value) return;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    persistSettings({ silent: true });
  }, 1000);
}

watch(
  formVars,
  () => {
    if (hydrating.value) return;
    if (syncSiteTimer) clearTimeout(syncSiteTimer);
    syncSiteTimer = setTimeout(() => {
      const vars = { ...formVars.value };
      const before = `${vars.site}|${vars.site_host}|${vars.site_idn}`;
      applySiteDerivedFields(vars);
      const after = `${vars.site}|${vars.site_host}|${vars.site_idn}`;
      if (before !== after) {
        hydrating.value = true;
        formVars.value = vars;
        queueMicrotask(() => {
          hydrating.value = false;
        });
      }
    }, 300);
    scheduleAutosave();
  },
  { deep: true }
);

watch(jurisdiction, () => {
  scheduleAutosave();
});

onBeforeUnmount(() => {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  if (syncSiteTimer) clearTimeout(syncSiteTimer);
  if (pack.value && jurisdiction.value && !hydrating.value) {
    persistSettings({ silent: true });
  }
});

async function onSaveSettings() {
  await persistSettings({ silent: false });
}

async function onGenerate() {
  if (!pack.value || !selectedDocIds.value.length) return;
  if (mode.value === 'overwrite_selected') {
    if (!confirm(t('content.settings.overwriteConfirm'))) return;
  }
  isGenerating.value = true;
  lastResult.value = null;
  try {
    const vars = { ...formVars.value };
    applySiteDerivedFields(vars);
    applyResponsibleDerived(vars);
    formVars.value = vars;
    const result = await legalPacksService.generate(pack.value.packId, {
      variables: vars,
      documentIds: [...selectedDocIds.value],
      mode: mode.value,
      jurisdiction: jurisdiction.value,
    });
    lastResult.value = result;
    await loadOperatorSettings();
  } catch (e) {
    const msg = e.response?.data?.error || e.message || t('common.unknownError');
    const missing = e.response?.data?.missing;
    alert(missing?.length ? `${msg}: ${missing.join(', ')}` : msg);
  } finally {
    isGenerating.value = false;
  }
}
</script>

<style scoped>
.pack-page {
  position: relative;
  min-height: calc(100vh - 40px);
  background: #fafafa;
}

.pack-page__inner {
  max-width: 920px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  box-sizing: border-box;
}

.pack-page__header h1 {
  margin: 0 0 8px;
  font-size: 1.75rem;
  color: var(--color-primary);
}

.pack-page__subtitle {
  margin: 0 0 20px;
  color: #6c757d;
}

.pack-block {
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 16px 18px;
  margin-bottom: 14px;
}

.pack-block h2,
.pack-block h3 {
  margin: 0 0 12px;
  font-size: 1.1rem;
}

.pack-label {
  display: block;
  font-weight: 500;
  margin-bottom: 6px;
  color: #343a40;
}

.pack-input {
  width: 100%;
  box-sizing: border-box;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font: inherit;
  background: #fff;
}

.pack-vars {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.pack-var {
  width: 100%;
}

.pack-req {
  color: #c0392b;
}

.pack-hint,
.pack-page__muted {
  color: #6c757d;
  font-size: 0.9rem;
  margin: 8px 0 0;
}

.pack-page__alert {
  background: #fff8e6;
  border: 1px solid #ffe08a;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 14px;
}

.pack-link {
  margin-left: 8px;
  color: var(--color-primary);
}

.pack-docs-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  margin-bottom: 8px;
}

.pack-docs-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.pack-docs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 360px;
  overflow: auto;
}

.pack-doc {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 8px 10px;
}

.pack-doc__label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.pack-doc__title {
  flex: 1;
  min-width: 160px;
  font-weight: 500;
}

.pack-doc__badge {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef2ff;
  color: #3b4cca;
}

.pack-doc__cat {
  font-size: 0.8rem;
  color: #909399;
}

.pack-submit {
  margin: 8px 0 16px;
}

.pack-result__links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}

.pack-result__list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.88rem;
}

.pack-result__item {
  padding: 4px 0;
  border-bottom: 1px solid #f0f0f0;
}

.pack-result__item.is-error {
  color: #c0392b;
}

.pack-result__item.is-skipped {
  color: #6c757d;
}

.btn {
  border: none;
  border-radius: 8px;
  padding: 0.55rem 1rem;
  cursor: pointer;
  font-weight: 500;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.btn-sm {
  padding: 0.35rem 0.7rem;
  font-size: 0.85rem;
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
}

.btn-secondary {
  background: #e9ecef;
  color: #343a40;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .pack-page__inner {
    padding: 16px 12px 40px;
  }
}
</style>
