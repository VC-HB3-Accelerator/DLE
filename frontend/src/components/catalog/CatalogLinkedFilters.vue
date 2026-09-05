<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  Фильтры витрины / компактный выбор раздела.
-->
<template>
  <div
    class="catalog-filters"
    :class="{
      'catalog-filters--compact': compact,
      'catalog-filters--toolbar': hideLabels,
    }"
  >
    <label class="catalog-filters__field">
      <span v-if="!hideLabels" class="catalog-filters__label">{{ t('catalogFilters.section') }}</span>
      <span v-else class="visually-hidden">{{ t('catalogFilters.section') }}</span>
      <select
        class="catalog-filters__select"
        :value="modelValue.section || ''"
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

    <label
      v-for="f in filters"
      :key="f.key"
      class="catalog-filters__field"
    >
      <span v-if="!hideLabels" class="catalog-filters__label">{{ f.label || f.key }}</span>
      <span v-else class="visually-hidden">{{ f.label || f.key }}</span>
      <select
        class="catalog-filters__select"
        :value="modelValue[f.key] || ''"
        :disabled="disabled || loading || !modelValue.section"
        :aria-label="f.label || f.key"
        @change="onAttr(f.key, $event.target.value)"
      >
        <option value="">{{ t('catalogFilters.any') }}</option>
        <option v-for="opt in f.options || []" :key="opt.value" :value="opt.value">
          {{ opt.label || opt.value }}
        </option>
      </select>
    </label>

    <button
      v-if="showReset"
      type="button"
      class="catalog-filters__reset"
      :disabled="disabled"
      @click="reset"
    >
      {{ t('catalogFilters.reset') }}
    </button>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { emptyCatalogSelection, fetchCatalogFilters } from '@/services/catalogFiltersService';

const props = defineProps({
  modelValue: { type: Object, default: () => emptyCatalogSelection() },
  scope: { type: String, default: 'store' },
  compact: { type: Boolean, default: false },
  /** Без видимых подписей — в одну линию с иконками шапки */
  hideLabels: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  showReset: { type: Boolean, default: true },
  requireCascade: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'change']);

const { t, locale } = useI18n();
const loading = ref(false);
const sections = ref([]);
const filters = ref([]);

function sectionLabel(s) {
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
  const next = { section: props.modelValue?.section || '' };
  for (const f of filters.value) {
    if (f.key === key) continue;
    const cur = props.modelValue?.[f.key];
    if (cur) next[f.key] = cur;
  }
  if (value) next[key] = value;
  emitNext(next);
}

function reset() {
  emitNext(emptyCatalogSelection());
}

async function load() {
  loading.value = true;
  try {
    const data = await fetchCatalogFilters({
      scope: props.scope,
      section: props.modelValue?.section || '',
      ...Object.fromEntries(
        Object.entries(props.modelValue || {}).filter(([k]) => k !== 'section')
      ),
    });
    sections.value = data.sections || [];
    filters.value = data.filters || [];
  } catch (e) {
    console.error('[CatalogLinkedFilters] load failed', e);
    sections.value = [];
    filters.value = [];
  } finally {
    loading.value = false;
  }
}

watch(() => props.modelValue?.section, () => load());
onMounted(load);
</script>

<style scoped>
.catalog-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-end;
}
.catalog-filters--toolbar {
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
}
.catalog-filters__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 0 0 auto;
  width: 200px;
  max-width: 100%;
  font-size: var(--font-size-sm);
}
.catalog-filters--toolbar .catalog-filters__field {
  width: min(200px, 42vw);
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
.catalog-filters--toolbar .catalog-filters__reset {
  height: 2.25rem;
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
    width: 100%;
  }
  .catalog-filters--toolbar .catalog-filters__field {
    width: 100%;
  }
}
</style>
