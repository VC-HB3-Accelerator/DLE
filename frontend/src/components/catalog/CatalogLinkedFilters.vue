<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  Cascade-фильтры витрины: select в шапке; выбранные — компактные чипы с × (wrap).
-->
<template>
  <div
    class="catalog-filters"
    :class="{
      'catalog-filters--compact': compact,
      'catalog-filters--toolbar': hideLabels,
    }"
  >
    <div v-if="hintVisible" class="catalog-filters__hint" role="status">
      <p class="catalog-filters__hint-text">{{ t('catalogFilters.cascadeHint') }}</p>
      <button
        type="button"
        class="catalog-filters__hint-close"
        :title="t('catalogFilters.cascadeHintClose')"
        :aria-label="t('catalogFilters.cascadeHintClose')"
        @click="dismissHint"
      >
        ×
      </button>
    </div>

    <div class="catalog-filters__bar">
      <label v-if="modelValue?.section && loading" class="catalog-filters__field">
        <span v-if="!hideLabels" class="catalog-filters__label">{{ t('common.loading') }}</span>
        <select class="catalog-filters__select" disabled>
          <option>{{ t('common.loading') }}</option>
        </select>
      </label>

      <label v-else-if="!modelValue?.section" class="catalog-filters__field">
        <span v-if="!hideLabels" class="catalog-filters__label">{{ t('catalogFilters.section') }}</span>
        <span v-else class="visually-hidden">{{ t('catalogFilters.section') }}</span>
        <select
          class="catalog-filters__select"
          value=""
          :disabled="disabled || loading"
          :aria-label="t('catalogFilters.section')"
          @change="onSection($event.target.value)"
        >
          <option value="">{{ t('catalogFilters.allSections') }}</option>
          <option v-for="s in sections" :key="s.id" :value="s.slug">
            {{ sectionLabel(s) }}
          </option>
        </select>
      </label>

      <label v-else-if="activeFilter" class="catalog-filters__field">
        <span v-if="!hideLabels" class="catalog-filters__label">{{ activeFilter.label || activeFilter.key }}</span>
        <span v-else class="visually-hidden">{{ activeFilter.label || activeFilter.key }}</span>
        <select
          class="catalog-filters__select"
          value=""
          :disabled="disabled || loading"
          :aria-label="activeFilter.label || activeFilter.key"
          @change="onAttr(activeFilter.key, $event.target.value)"
        >
          <option value="">{{ t('catalogFilters.any') }}</option>
          <option
            v-for="opt in (activeFilter.options || [])"
            :key="String(opt.value)"
            :value="opt.value"
          >
            {{ opt.label || opt.value }}
          </option>
        </select>
      </label>

      <div v-else-if="cascadeComplete" class="catalog-filters__done">
        <slot />
      </div>

      <button
        v-if="showReset && modelValue?.section"
        type="button"
        class="catalog-filters__reset"
        :disabled="disabled"
        @click="reset"
      >
        {{ t('catalogFilters.reset') }}
      </button>
    </div>

    <div v-if="hasChips" class="catalog-filters__chips">
      <button
        v-if="modelValue?.section"
        type="button"
        class="catalog-filters__chip"
        :disabled="disabled"
        @click="clearFrom('section')"
      >
        <span>{{ sectionChipLabel }}</span>
        <span aria-hidden="true">×</span>
      </button>
      <button
        v-for="chip in selectedChips"
        :key="chip.key"
        type="button"
        class="catalog-filters__chip"
        :disabled="disabled"
        @click="clearFrom(chip.key)"
      >
        <span>{{ chip.label }}</span>
        <span aria-hidden="true">×</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { emptyCatalogSelection, fetchCatalogFilters, isFilterActiveInCascade, resolveCatalogOptions } from '@/services/catalogFiltersService';

const props = defineProps({
  modelValue: { type: Object, default: () => emptyCatalogSelection() },
  scope: { type: String, default: 'store' },
  compact: { type: Boolean, default: false },
  hideLabels: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  showReset: { type: Boolean, default: true },
  requireCascade: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'change']);

const { t, locale } = useI18n();
const HINT_STORAGE_KEY = 'catalog-filters-cascade-hint-dismissed';
const loading = ref(false);
const filtersReady = ref(false);
const sections = ref([]);
const filters = ref([]);
const filterLinks = ref({});
const activeSectionMeta = ref(null);
const hintVisible = ref(true);

function dismissHint() {
  hintVisible.value = false;
  try {
    localStorage.setItem(HINT_STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

const selection = computed(() => props.modelValue || emptyCatalogSelection());

const sectionChipLabel = computed(() => {
  const slug = selection.value.section;
  const s = sections.value.find((x) => x.slug === slug || x.id === slug);
  return s ? sectionLabel(s) : (slug || '');
});

const selectedChips = computed(() => {
  const out = [];
  for (const f of filters.value) {
    const key = f?.key;
    if (!key) continue;
    const v = selection.value[key];
    if (v) out.push({ key, label: String(v) });
  }
  return out;
});

const hasChips = computed(() => Boolean(selection.value.section) || selectedChips.value.length > 0);

function optionsForFilter(f) {
  const key = f?.key;
  if (!key) return [];
  return resolveCatalogOptions({
    key,
    filterKeys: filters.value.map((x) => x.key),
    filterValues: activeSectionMeta.value?.filter_values || {},
    filterLinks: filterLinks.value,
    selection: selection.value,
    fallbackOptions: f.options || [],
  });
}

const activeFilter = computed(() => {
  if (!selection.value.section || loading.value) return null;
  const keys = filters.value.map((x) => x.key);
  for (const f of filters.value) {
    const key = f?.key;
    if (!key) continue;
    if (!isFilterActiveInCascade(key, {
      filterKeys: keys,
      filterLinks: filterLinks.value,
      selection: selection.value,
    })) continue;
    if (!selection.value[key]) {
      return { ...f, options: optionsForFilter(f) };
    }
  }
  return null;
});

const cascadeComplete = computed(() => {
  if (!selection.value.section) return false;
  if (loading.value || !filtersReady.value) return false;
  if (!filters.value.length) return true;
  const keys = filters.value.map((x) => x.key);
  return filters.value.every((f) => {
    const key = f?.key;
    if (!key) return true;
    if (!isFilterActiveInCascade(key, {
      filterKeys: keys,
      filterLinks: filterLinks.value,
      selection: selection.value,
    })) return true;
    return Boolean(selection.value[key]);
  });
});

function sectionLabel(s) {
  if (!s) return '';
  if (locale.value === 'en') return s.label_en || s.label_ru || s.slug;
  return s.label_ru || s.label_en || s.slug;
}

function emitNext(next) {
  emit('update:modelValue', next);
  emit('change', next);
}

function onSection(slug) {
  emitNext({ section: slug || '' });
}

function onAttr(key, value) {
  if (!key || !value) return;
  const next = { section: selection.value.section || '' };
  for (const f of filters.value) {
    const k = f?.key;
    if (!k) continue;
    const cur = selection.value[k];
    if (cur) next[k] = cur;
    if (k === key) {
      next[k] = value;
      break;
    }
  }
  emitNext(next);
}

function clearFrom(key) {
  if (key === 'section') {
    emitNext(emptyCatalogSelection());
    return;
  }
  const next = { section: selection.value.section || '' };
  for (const f of filters.value) {
    const k = f?.key;
    if (!k) continue;
    if (k === key) break;
    const cur = selection.value[k];
    if (cur) next[k] = cur;
  }
  emitNext(next);
}

function reset() {
  emitNext(emptyCatalogSelection());
}

async function load() {
  loading.value = true;
  filtersReady.value = false;
  try {
    const params = { scope: props.scope };
    if (selection.value.section) params.section = selection.value.section;
    const data = await fetchCatalogFilters(params);
    sections.value = Array.isArray(data?.sections) ? data.sections : [];
    filters.value = Array.isArray(data?.filters) ? data.filters.filter((f) => f && f.key) : [];
    filterLinks.value = data?.filter_links && typeof data.filter_links === 'object'
      ? data.filter_links
      : (data?.section?.filter_links || {});
    activeSectionMeta.value = data?.section || null;
  } catch (e) {
    console.error('[CatalogLinkedFilters] load failed', e);
    if (!selection.value.section) sections.value = [];
    filters.value = [];
  } finally {
    filtersReady.value = true;
    loading.value = false;
  }
}

watch(() => selection.value.section, () => load());
onMounted(() => {
  try {
    if (localStorage.getItem(HINT_STORAGE_KEY) === '1') hintVisible.value = false;
  } catch {
    /* ignore */
  }
  load();
});
</script>

<style scoped>
.catalog-filters {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.catalog-filters--toolbar {
  flex: 1 1 auto;
}
.catalog-filters__hint {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: var(--radius-lg, 8px);
  background: color-mix(in srgb, var(--color-light, #f3f4f6) 70%, white);
  color: var(--color-dark, #111);
}
.catalog-filters__hint-text {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: 1.4;
}
.catalog-filters__hint-close {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  margin: -2px -4px 0 0;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0.7;
}
.catalog-filters__hint-close:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--color-dark, #111) 8%, transparent);
}
.catalog-filters__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.catalog-filters__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 180px;
  min-width: 0;
  max-width: 100%;
  font-size: var(--font-size-sm);
}
.catalog-filters--toolbar .catalog-filters__field {
  flex: 1 1 160px;
}
.catalog-filters__label {
  color: var(--color-grey-dark, #666);
}
.catalog-filters__select {
  box-sizing: border-box;
  width: 100%;
  height: 42px;
  padding: 0 14px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: var(--radius-lg, 8px);
  background: var(--theme-bg, #fff);
}
.catalog-filters--toolbar .catalog-filters__select,
.catalog-filters--toolbar .catalog-filters__reset,
.catalog-filters--toolbar .catalog-filters__chip {
  height: 2.25rem;
}
.catalog-filters__done {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
}
.catalog-filters__done :deep(.btn) {
  width: 100%;
  height: 2.25rem;
  box-sizing: border-box;
}
.catalog-filters__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}
.catalog-filters__chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: auto;
  max-width: 100%;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 999px;
  background: #f3f4f6;
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: inherit;
}
.catalog-filters__chip:hover:not(:disabled) {
  background: #e5e7eb;
}
.catalog-filters__chip:disabled {
  opacity: 0.55;
  cursor: default;
}
.catalog-filters__reset {
  height: 42px;
  padding: 0 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: var(--radius-lg, 8px);
  background: #fff;
  cursor: pointer;
  flex: 0 0 auto;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@media (max-width: 480px) {
  .catalog-filters__field {
    flex: 1 1 100%;
  }
}
</style>
