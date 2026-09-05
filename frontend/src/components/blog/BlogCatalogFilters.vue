<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  Публичные фильтры: раздел + динамические ключи из настроек раздела.
-->
<template>
  <div class="blog-catalog-filters">
    <div class="blog-catalog-filters__row">
      <label class="blog-catalog-filters__field">
        <select
          :value="modelValue.section || ''"
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

      <label
        v-for="f in filters"
        :key="f.key"
        class="blog-catalog-filters__field"
      >
        <select
          :value="modelValue[f.key] || ''"
          :disabled="loading || !modelValue.section"
          :aria-label="f.label || f.key"
          @change="onAttr(f.key, $event.target.value)"
        >
          <option value="">{{ t('catalogFilters.any') }}</option>
          <option v-for="opt in f.options || []" :key="opt.value" :value="opt.value">
            {{ opt.label || opt.value }}
          </option>
        </select>
      </label>

      <slot />

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
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import UiGlyph from '@/components/UiGlyph.vue';
import { emptyCatalogSelection, fetchCatalogFilters } from '@/services/catalogFiltersService';

const props = defineProps({
  modelValue: { type: Object, default: () => emptyCatalogSelection() },
  scope: { type: String, default: 'blog' },
  onlyUsed: { type: Boolean, default: true },
  canManage: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'change', 'open-settings']);

const { t, locale } = useI18n();
const loading = ref(false);
const sections = ref([]);
const filters = ref([]);

function sectionLabel(s) {
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
  const next = { section: props.modelValue?.section || '' };
  for (const f of filters.value) {
    if (f.key === key) continue;
    const cur = props.modelValue?.[f.key];
    if (cur) next[f.key] = cur;
  }
  if (value) next[key] = value;
  emitSelection(next);
}

async function load() {
  loading.value = true;
  try {
    const data = await fetchCatalogFilters({
      scope: props.scope,
      only_used: props.onlyUsed ? 1 : 0,
      section: props.modelValue?.section || '',
      ...Object.fromEntries(
        Object.entries(props.modelValue || {}).filter(([k]) => k !== 'section')
      ),
    });
    sections.value = data.sections || [];
    filters.value = data.filters || [];
  } catch (e) {
    console.error('[BlogCatalogFilters]', e);
    sections.value = [];
    filters.value = [];
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.modelValue?.section,
  () => load()
);

onMounted(load);
</script>

<style scoped>
.blog-catalog-filters {
  width: 100%;
  max-width: 100%;
  margin: 0 0 var(--spacing-md, 16px);
  box-sizing: border-box;
}

.blog-catalog-filters__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.blog-catalog-filters__field {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  width: 200px;
  max-width: 100%;
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

.blog-catalog-filters__gear {
  flex-shrink: 0;
  height: 42px;
  width: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: var(--radius-lg, 8px);
  background: var(--color-white, #fff);
  color: var(--color-dark);
  cursor: pointer;
  padding: 0;
}

.blog-catalog-filters__gear:hover {
  background: color-mix(in srgb, var(--color-light, #f3f4f6) 55%, white);
}

@media (max-width: 480px) {
  .blog-catalog-filters__field {
    width: 100%;
  }
}
</style>
