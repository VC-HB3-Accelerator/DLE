<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  Разделы каталога: создать / переименовать / выключить; отметить ключи полей как фильтры.
-->
<template>
  <section class="taxonomy">
    <div class="taxonomy__header">
      <h3>{{ t('blog.feedSettings.sectionsTitle') }}</h3>
      <button type="button" class="btn btn-outline btn-sm" :disabled="saving" @click="startCreate">
        {{ t('blog.feedSettings.addSection') }}
      </button>
    </div>
    <p class="taxonomy__intro">{{ t('blog.feedSettings.sectionsIntro') }}</p>

    <p v-if="loadError" class="taxonomy__error">{{ loadError }}</p>
    <p v-if="loading" class="taxonomy__muted">{{ t('common.loading') }}</p>

    <div v-else-if="!sections.length && !creating" class="taxonomy__muted">
      {{ t('blog.feedSettings.noSections') }}
    </div>

    <div v-if="creating" class="taxonomy__card">
      <div class="taxonomy__grid">
        <label class="taxonomy__field">
          <span>{{ t('blog.feedSettings.labelRu') }}</span>
          <input v-model="draft.label_ru" type="text" :disabled="saving" />
        </label>
        <label class="taxonomy__field">
          <span>{{ t('blog.feedSettings.labelEn') }}</span>
          <input v-model="draft.label_en" type="text" :disabled="saving" />
        </label>
      </div>
      <div class="taxonomy__actions">
        <button type="button" class="btn btn-primary btn-sm" :disabled="saving || !draft.label_ru.trim()" @click="create">
          {{ saving ? t('common.saving') : t('common.create') }}
        </button>
        <button type="button" class="btn btn-outline btn-sm" :disabled="saving" @click="creating = false">
          {{ t('common.cancel') }}
        </button>
      </div>
    </div>

    <template v-if="sections.length">
      <div class="taxonomy__tabs" role="tablist">
        <button
          v-for="s in sections"
          :key="s.id"
          type="button"
          role="tab"
          class="taxonomy__tab"
          :class="{
            'taxonomy__tab--active': activeId === s.id,
            'taxonomy__tab--off': !s.active,
          }"
          @click="selectSection(s.id)"
        >
          {{ sectionLabel(s) }}
        </button>
      </div>

      <div v-if="active" class="taxonomy__card">
        <div class="taxonomy__grid">
          <label class="taxonomy__field">
            <span>{{ t('blog.feedSettings.labelRu') }}</span>
            <input v-model="active.label_ru" type="text" :disabled="saving" />
          </label>
          <label class="taxonomy__field">
            <span>{{ t('blog.feedSettings.labelEn') }}</span>
            <input v-model="active.label_en" type="text" :disabled="saving" />
          </label>
        </div>

        <label class="taxonomy__row-check">
          <input v-model="active.active" type="checkbox" :disabled="saving" />
          {{ t('blog.feedSettings.active') }}
        </label>

        <div class="taxonomy__cats-header">
          <h4>{{ t('blog.feedSettings.filterKeysTitle') }}</h4>
        </div>
        <p class="taxonomy__hint">{{ t('blog.feedSettings.filterKeysHint') }}</p>

        <div v-if="knownKeys.length" class="taxonomy__facets">
          <label v-for="key in knownKeys" :key="key" class="taxonomy__row-check">
            <input
              type="checkbox"
              :checked="active.filter_keys.includes(key)"
              :disabled="saving"
              @change="toggleFilterKey(key, $event.target.checked)"
            />
            {{ key }}
          </label>
        </div>
        <p v-else class="taxonomy__muted">{{ t('blog.feedSettings.noKnownKeys') }}</p>

        <div class="taxonomy__add-key">
          <input
            v-model="newFilterKey"
            type="text"
            :placeholder="t('blog.feedSettings.filterKeyPlaceholder')"
            :disabled="saving"
            @keydown.enter.prevent="addFilterKey"
          />
          <button type="button" class="btn btn-outline btn-sm" :disabled="saving || !newFilterKey.trim()" @click="addFilterKey">
            {{ t('blog.feedSettings.addFilterKey') }}
          </button>
        </div>

        <div v-if="active.filter_keys.length" class="taxonomy__chips">
          <span v-for="key in active.filter_keys" :key="key" class="taxonomy__chip">
            {{ key }}
            <button type="button" :disabled="saving" @click="toggleFilterKey(key, false)">×</button>
          </span>
        </div>

        <div class="taxonomy__actions">
          <button type="button" class="btn btn-primary btn-sm" :disabled="saving" @click="save">
            {{ saving ? t('common.saving') : t('common.save') }}
          </button>
          <button type="button" class="btn btn-danger btn-sm" :disabled="saving" @click="remove">
            {{ t('common.delete') }}
          </button>
        </div>
        <p v-if="saveMsg" class="taxonomy__ok">{{ saveMsg }}</p>
        <p v-if="saveError" class="taxonomy__error">{{ saveError }}</p>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  fetchCatalogAdminTaxonomy,
  createCatalogSection,
  updateCatalogSection,
  deleteCatalogSection,
} from '@/services/catalogFiltersService';

const { t, locale } = useI18n();

const loading = ref(true);
const saving = ref(false);
const loadError = ref('');
const saveMsg = ref('');
const saveError = ref('');
const sections = ref([]);
const activeId = ref('');
const creating = ref(false);
const draft = ref({ label_ru: '', label_en: '' });
const newFilterKey = ref('');

const active = computed(() => sections.value.find((s) => s.id === activeId.value) || null);
const knownKeys = computed(() => {
  const s = active.value;
  if (!s) return [];
  const set = new Set([...(s.known_keys || []), ...(s.filter_keys || [])]);
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
});

function sectionLabel(s) {
  if (locale.value === 'en') return s.label_en || s.label_ru || s.slug;
  return s.label_ru || s.label_en || s.slug;
}

function applyData(data) {
  sections.value = (data?.sections || []).map((s) => ({
    ...s,
    filter_keys: [...(s.filter_keys || [])],
    known_keys: [...(s.known_keys || [])],
  }));
  if (!activeId.value || !sections.value.some((s) => s.id === activeId.value)) {
    activeId.value = sections.value[0]?.id || '';
  }
}

function selectSection(id) {
  activeId.value = id;
  saveMsg.value = '';
  saveError.value = '';
}

function startCreate() {
  creating.value = true;
  draft.value = { label_ru: '', label_en: '' };
}

function toggleFilterKey(key, on) {
  if (!active.value) return;
  const list = active.value.filter_keys;
  const i = list.indexOf(key);
  if (on && i < 0) list.push(key);
  if (!on && i >= 0) list.splice(i, 1);
}

function addFilterKey() {
  const key = newFilterKey.value.trim();
  if (!key || !active.value) return;
  if (!active.value.filter_keys.includes(key)) active.value.filter_keys.push(key);
  newFilterKey.value = '';
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    applyData(await fetchCatalogAdminTaxonomy());
  } catch (e) {
    loadError.value = e.response?.data?.error || e.message || t('blog.feedSettings.taxonomyLoadError');
  } finally {
    loading.value = false;
  }
}

async function create() {
  saving.value = true;
  saveError.value = '';
  try {
    const data = await createCatalogSection({ ...draft.value });
    applyData(data);
    creating.value = false;
    if (data.section?.id) activeId.value = data.section.id;
    saveMsg.value = t('blog.feedSettings.taxonomySaveSuccess');
  } catch (e) {
    saveError.value = e.response?.data?.error || e.message || t('blog.feedSettings.taxonomySaveError');
  } finally {
    saving.value = false;
  }
}

async function save() {
  if (!active.value) return;
  saving.value = true;
  saveMsg.value = '';
  saveError.value = '';
  try {
    const s = active.value;
    const data = await updateCatalogSection(s.id, {
      label_ru: s.label_ru,
      label_en: s.label_en,
      active: s.active,
      filter_keys: s.filter_keys,
      sort_order: s.sort_order,
    });
    applyData(data);
    saveMsg.value = t('blog.feedSettings.taxonomySaveSuccess');
  } catch (e) {
    saveError.value = e.response?.data?.error || e.message || t('blog.feedSettings.taxonomySaveError');
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!active.value) return;
  if (!confirm(t('blog.feedSettings.confirmDeleteSection', { name: sectionLabel(active.value) }))) return;
  saving.value = true;
  try {
    const data = await deleteCatalogSection(active.value.id);
    activeId.value = '';
    applyData(data);
    saveMsg.value = t('blog.feedSettings.taxonomySaveSuccess');
  } catch (e) {
    saveError.value = e.response?.data?.error || e.message || t('blog.feedSettings.taxonomySaveError');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.taxonomy { margin-bottom: 28px; }
.taxonomy__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.taxonomy__header h3 { margin: 0; font-size: 1.1rem; color: var(--color-dark); }
.taxonomy__intro, .taxonomy__hint, .taxonomy__muted {
  margin: 0 0 14px;
  color: var(--color-grey-dark);
  font-size: var(--font-size-sm);
}
.taxonomy__error { color: var(--color-danger, #b91c1c); }
.taxonomy__ok { color: var(--color-success, #15803d); font-size: var(--font-size-sm); }
.taxonomy__tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.taxonomy__tab {
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}
.taxonomy__tab--active { border-color: var(--color-primary, #2563eb); background: #eff6ff; }
.taxonomy__tab--off { opacity: 0.55; }
.taxonomy__card {
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  padding: 16px;
  background: #fff;
}
.taxonomy__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.taxonomy__field { display: flex; flex-direction: column; gap: 4px; font-size: var(--font-size-sm); }
.taxonomy__field input {
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
}
.taxonomy__facets { display: flex; flex-wrap: wrap; gap: 10px 16px; margin-bottom: 12px; }
.taxonomy__row-check { display: inline-flex; align-items: center; gap: 6px; font-size: var(--font-size-sm); }
.taxonomy__cats-header h4 { margin: 12px 0 6px; font-size: 1rem; }
.taxonomy__add-key { display: flex; gap: 8px; margin: 8px 0 12px; flex-wrap: wrap; }
.taxonomy__add-key input {
  flex: 1 1 180px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
}
.taxonomy__chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.taxonomy__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  background: #f3f4f6;
  font-size: var(--font-size-sm);
}
.taxonomy__chip button {
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}
.taxonomy__actions { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
