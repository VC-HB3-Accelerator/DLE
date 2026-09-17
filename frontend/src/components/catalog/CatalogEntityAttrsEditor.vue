<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  Редактор: раздел + выбор значений из справочника полей раздела.
-->
<template>
  <div class="catalog-attrs">
    <label class="catalog-attrs__field">
      <span class="catalog-attrs__label">{{ t('catalogFilters.section') }}</span>
      <select
        class="catalog-attrs__select"
        :value="sectionId || ''"
        :disabled="disabled || loading"
        @change="onSection($event.target.value)"
      >
        <option value="">{{ t('catalogFilters.any') }}</option>
        <option v-for="s in sections" :key="s.id" :value="s.id">
          {{ sectionLabel(s) }}
        </option>
      </select>
    </label>

    <p v-if="sectionId && !fields.length" class="catalog-attrs__hint">
      {{ t('catalogFilters.noFieldsInSection') }}
    </p>

    <label
      v-for="field in fields"
      :key="field.key"
      class="catalog-attrs__field"
    >
      <span class="catalog-attrs__label">{{ field.key }}</span>
      <select
        class="catalog-attrs__select"
        :value="valueFor(field.key)"
        :disabled="disabled || loading"
        @change="onFieldValue(field.key, $event.target.value)"
      >
        <option value="">{{ t('catalogFilters.any') }}</option>
        <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
      </select>
    </label>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchCatalogSections, resolveCatalogOptions } from '@/services/catalogFiltersService';

const props = defineProps({
  sectionId: { type: String, default: '' },
  attrs: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:sectionId', 'update:attrs']);

const { t, locale } = useI18n();
const loading = ref(false);
const sections = ref([]);

const currentSection = computed(() =>
  sections.value.find((s) => s.id === props.sectionId) || null
);

const selectionMap = computed(() => {
  const map = {};
  for (const row of props.attrs || []) {
    if (row?.key && row?.value) map[row.key] = row.value;
  }
  return map;
});

const fields = computed(() => {
  const s = currentSection.value;
  if (!s) return [];
  const keys = s.filter_keys || [];
  const sel = selectionMap.value;
  return keys
    .filter((key) => {
      // 85 полей «Города · …» — только связанный с регионом или уже выбранный
      if (/^Города\s*[·:]\s*/.test(String(key || ''))) {
        if (sel[key]) return true;
        for (const [pk, pv] of Object.entries(sel)) {
          if (/^Города\s*[·:]\s*/.test(pk)) continue;
          if (s.filter_links?.[pk]?.[pv]?.[key]) return true;
        }
        return false;
      }
      return true;
    })
    .map((key) => {
      const resolved = resolveCatalogOptions({
        key,
        filterKeys: keys,
        filterValues: s.filter_values || {},
        filterLinks: s.filter_links || {},
        selection: sel,
        fallbackOptions: (s.filter_values && s.filter_values[key]) || [],
      });
      const opts = resolved.map((o) => o.value ?? o);
      const current = sel[key];
      if (current && !opts.includes(current)) opts.unshift(current);
      return { key, options: opts };
    });
});

function sectionLabel(s) {
  if (locale.value === 'en') return s.label_en || s.label_ru || s.slug;
  return s.label_ru || s.label_en || s.slug;
}

function valueFor(key) {
  const row = (props.attrs || []).find((a) => a.key === key);
  return row?.value || '';
}

function emitAttrs(map) {
  const list = fields.value
    .map((f) => ({ key: f.key, value: map[f.key] || '' }))
    .filter((r) => r.value);
  emit('update:attrs', list);
}

function onSection(id) {
  emit('update:sectionId', id || '');
  emit('update:attrs', []);
}

function onFieldValue(key, value) {
  const s = currentSection.value;
  const keys = s?.filter_keys || [];
  const map = {};
  for (const f of fields.value) {
    map[f.key] = f.key === key ? value : valueFor(f.key);
  }
  map[key] = value;
  const idx = keys.indexOf(key);
  if (idx >= 0) {
    for (let i = idx + 1; i < keys.length; i += 1) {
      const childKey = keys[i];
      const allowed = resolveCatalogOptions({
        key: childKey,
        filterKeys: keys,
        filterValues: s.filter_values || {},
        filterLinks: s.filter_links || {},
        selection: map,
        fallbackOptions: (s.filter_values && s.filter_values[childKey]) || [],
      }).map((o) => o.value ?? o);
      if (map[childKey] && !allowed.includes(map[childKey])) map[childKey] = '';
    }
  }
  emitAttrs(map);
}

async function loadSections() {
  loading.value = true;
  try {
    sections.value = await fetchCatalogSections({ all: 0 });
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.sectionId,
  () => {
    // при смене раздела снаружи синхронизация attrs остаётся на родителе
  }
);

onMounted(loadSections);
</script>

<style scoped>
.catalog-attrs { display: flex; flex-direction: column; gap: 10px; }
.catalog-attrs__field { display: flex; flex-direction: column; gap: 4px; }
.catalog-attrs__label { font-size: var(--font-size-sm); color: var(--color-grey-dark); }
.catalog-attrs__select {
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
}
.catalog-attrs__hint {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-grey-dark);
}
</style>
