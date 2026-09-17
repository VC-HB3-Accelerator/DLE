<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  Cascade: select+шестерёнка = ширина карточки; чипы с × под полем на ту же ширину.
-->
<template>
  <div class="blog-catalog-filters">
    <div v-if="hintVisible" class="blog-catalog-filters__hint" role="status">
      <p class="blog-catalog-filters__hint-text">{{ t('catalogFilters.cascadeHint') }}</p>
      <button
        type="button"
        class="blog-catalog-filters__hint-close"
        :title="t('catalogFilters.cascadeHintClose')"
        :aria-label="t('catalogFilters.cascadeHintClose')"
        @click="dismissHint"
      >
        ×
      </button>
    </div>

    <div class="blog-catalog-filters__bar">
      <!-- Пока грузим поля раздела — плейсхолдер в той же строке с шестерёнкой -->
      <label v-if="modelValue.section && loading" class="blog-catalog-filters__field">
        <select disabled :aria-label="t('common.loading')">
          <option>{{ t('common.loading') }}</option>
        </select>
      </label>

      <label v-else-if="!modelValue.section" class="blog-catalog-filters__field">
        <select
          value=""
          :disabled="loading"
          :aria-label="t('catalogFilters.section')"
          @change="onSection($event.target.value)"
        >
          <option value="">{{ t('catalogFilters.allSections') }}</option>
          <option v-for="s in sections" :key="s.id" :value="s.slug">
            {{ sectionLabel(s) }}
          </option>
        </select>
      </label>

      <label v-else-if="activeFilter" class="blog-catalog-filters__field">
        <select
          value=""
          :disabled="loading"
          :aria-label="activeFilter.label || activeFilter.key"
          @change="onAttr(activeFilter.key, $event.target.value)"
        >
          <option value="">{{ activeFilter.label || activeFilter.key }}</option>
          <option
            v-for="opt in (activeFilter.options || [])"
            :key="String(opt.value)"
            :value="opt.value"
          >
            {{ opt.label || opt.value }}
          </option>
        </select>
      </label>

      <!-- Поле | Новый пост | шестерёнка — всегда в одной строке -->
      <div
        v-if="$slots.default"
        class="blog-catalog-filters__create"
        :class="{ 'blog-catalog-filters__create--grow': cascadeComplete }"
      >
        <slot />
      </div>

      <button
        v-if="canManage"
        type="button"
        class="blog-catalog-filters__gear"
        :title="t('blog.feedSettings.open')"
        :aria-label="t('blog.feedSettings.open')"
        @click="$emit('open-settings')"
      >
        <UiGlyph name="settings" :size="18" />
      </button>
    </div>

    <div v-if="hasChips" class="blog-catalog-filters__chips">
      <button
        v-if="modelValue.section"
        type="button"
        class="blog-catalog-filters__chip"
        :title="t('catalogFilters.removeChip', { label: sectionChipLabel })"
        @click="clearFrom('section')"
      >
        <span class="blog-catalog-filters__chip-text">{{ sectionChipLabel }}</span>
        <span class="blog-catalog-filters__chip-x" aria-hidden="true">×</span>
      </button>

      <button
        v-for="chip in selectedChips"
        :key="chip.key"
        type="button"
        class="blog-catalog-filters__chip"
        :title="t('catalogFilters.removeChip', { label: chip.label })"
        @click="clearFrom(chip.key)"
      >
        <span class="blog-catalog-filters__chip-text">{{ chip.label }}</span>
        <span class="blog-catalog-filters__chip-x" aria-hidden="true">×</span>
      </button>
    </div>

    <p v-if="loadError" class="blog-catalog-filters__error">{{ loadError }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import UiGlyph from '@/components/UiGlyph.vue';
import { emptyCatalogSelection, fetchCatalogFilters, isFilterActiveInCascade, resolveCatalogOptions } from '@/services/catalogFiltersService';

const props = defineProps({
  modelValue: { type: Object, default: () => emptyCatalogSelection() },
  scope: { type: String, default: 'blog' },
  onlyUsed: { type: Boolean, default: true },
  canManage: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'change', 'open-settings']);

const HINT_STORAGE_KEY = 'catalog-filters-cascade-hint-dismissed';

const { t, locale } = useI18n();
const loading = ref(false);
const loadError = ref('');
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
  const sel = selection.value;
  for (const f of filters.value) {
    const key = f?.key;
    if (!key) continue;
    const v = sel[key];
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

/** Первый ключ без выбранного значения */
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

function emitSelection(next) {
  emit('update:modelValue', next);
  emit('change', next);
}

function onSection(slug) {
  emitSelection({ section: slug || '' });
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
  emitSelection(next);
}

function clearFrom(key) {
  if (key === 'section') {
    emitSelection(emptyCatalogSelection());
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
  emitSelection(next);
}

async function load() {
  loading.value = true;
  loadError.value = '';
  filtersReady.value = false;
  try {
    const params = {
      scope: props.scope,
      only_used: props.onlyUsed ? 1 : 0,
    };
    const section = selection.value.section || '';
    if (section) params.section = section;
    // не тащим динамические ключи в запрос справочника — только section
    const data = await fetchCatalogFilters(params);
    sections.value = Array.isArray(data?.sections) ? data.sections : [];
    filters.value = Array.isArray(data?.filters) ? data.filters.filter((f) => f && f.key) : [];
    filterLinks.value = data?.filter_links && typeof data.filter_links === 'object'
      ? data.filter_links
      : (data?.section?.filter_links || {});
    activeSectionMeta.value = data?.section || null;
  } catch (e) {
    console.error('[BlogCatalogFilters]', e);
    loadError.value = e.response?.data?.error || e.message || t('blog.loadErrorDefault');
    if (!selection.value.section) sections.value = [];
    filters.value = [];
  } finally {
    filtersReady.value = true;
    loading.value = false;
  }
}

watch(
  () => selection.value.section,
  () => {
    load();
  }
);

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
.blog-catalog-filters {
  /* как у .blog-feed-card */
  width: 100%;
  max-width: 560px;
  margin: 0 auto var(--spacing-md, 16px);
  box-sizing: border-box;
}

.blog-catalog-filters__hint {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
  margin: 0 0 8px;
  padding: 10px 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: var(--radius-lg, 8px);
  background: color-mix(in srgb, var(--color-light, #f3f4f6) 70%, white);
  color: var(--color-dark);
}

.blog-catalog-filters__hint-text {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.blog-catalog-filters__hint-close {
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

.blog-catalog-filters__hint-close:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--color-dark, #111) 8%, transparent);
}

.blog-catalog-filters__bar {
  display: flex;
  align-items: stretch;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
}

.blog-catalog-filters__field {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
}

.blog-catalog-filters__field select {
  box-sizing: border-box;
  width: 100%;
  height: 42px;
  padding: 0 14px;
  border: 1px solid var(--color-grey-light, var(--color-border, #d1d5db));
  border-radius: var(--radius-lg, 8px);
  background: var(--theme-bg, #fff);
  color: var(--color-dark);
  font-size: var(--font-size-sm);
}

.blog-catalog-filters__create {
  flex: 0 0 auto;
  display: flex;
  align-items: stretch;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.blog-catalog-filters__create--grow {
  flex: 1 1 auto;
  min-width: 0;
}

.blog-catalog-filters__create :deep(.blog-new-post),
.blog-catalog-filters__create :deep(.blog-my-subs) {
  height: 42px;
  box-sizing: border-box;
  white-space: nowrap;
  padding: 0 14px;
}

.blog-catalog-filters__create--grow :deep(.blog-new-post) {
  flex: 1 1 auto;
  min-width: 0;
}

.blog-catalog-filters__gear {
  flex: 0 0 42px;
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: var(--radius-lg, 8px);
  background: var(--color-white, #fff);
  color: var(--color-dark);
  cursor: pointer;
  padding: 0;
  box-sizing: border-box;
}

.blog-catalog-filters__gear:hover {
  background: color-mix(in srgb, var(--color-light, #f3f4f6) 55%, white);
}

.blog-catalog-filters__chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 100%;
  margin-top: 8px;
  box-sizing: border-box;
}

.blog-catalog-filters__chip {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  width: auto;
  max-width: 100%;
  box-sizing: border-box;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: var(--radius-lg, 8px);
  background: #f3f4f6;
  color: var(--color-dark);
  cursor: pointer;
  font-size: var(--font-size-sm);
  text-align: left;
}

.blog-catalog-filters__chip:hover {
  background: #e5e7eb;
}

.blog-catalog-filters__chip-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.blog-catalog-filters__chip-x {
  flex: 0 0 auto;
  font-size: 1.15rem;
  line-height: 1;
  opacity: 0.75;
}

.blog-catalog-filters__error {
  margin: 8px 0 0;
  color: var(--color-danger, #b91c1c);
  font-size: var(--font-size-sm);
}

@media (max-width: 480px) {
  .blog-catalog-filters {
    max-width: 100%;
  }
}
</style>
