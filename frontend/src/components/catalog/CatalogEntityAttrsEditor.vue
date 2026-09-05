<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  Редактор: раздел каталога + динамические поля ключ/значение (как теги, но свободный ввод).
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

    <p class="catalog-attrs__hint">{{ t('catalogFilters.attrsHint') }}</p>

    <div v-for="(row, index) in localAttrs" :key="row._key" class="catalog-attrs__row">
      <input
        v-model="row.key"
        type="text"
        class="catalog-attrs__input"
        :placeholder="t('catalogFilters.attrKey')"
        :disabled="disabled"
        list="catalog-attr-keys"
        @change="emitChange"
      />
      <input
        v-model="row.value"
        type="text"
        class="catalog-attrs__input"
        :placeholder="t('catalogFilters.attrValue')"
        :disabled="disabled"
        @change="emitChange"
      />
      <button type="button" class="btn btn-outline btn-sm" :disabled="disabled" @click="removeRow(index)">
        {{ t('common.delete') }}
      </button>
    </div>

    <datalist id="catalog-attr-keys">
      <option v-for="k in suggestedKeys" :key="k" :value="k" />
    </datalist>

    <button type="button" class="btn btn-outline btn-sm" :disabled="disabled" @click="addRow">
      {{ t('catalogFilters.addAttr') }}
    </button>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchCatalogSections, fetchCatalogAdminTaxonomy } from '@/services/catalogFiltersService';

const props = defineProps({
  sectionId: { type: String, default: '' },
  attrs: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:sectionId', 'update:attrs']);

const { t, locale } = useI18n();
const loading = ref(false);
const sections = ref([]);
const knownBySection = ref({});
const localAttrs = ref([]);

const suggestedKeys = computed(() => {
  const fromSection = knownBySection.value[props.sectionId] || [];
  const fromRows = localAttrs.value.map((r) => r.key).filter(Boolean);
  return [...new Set([...fromSection, ...fromRows])];
});

function sectionLabel(s) {
  if (locale.value === 'en') return s.label_en || s.label_ru || s.slug;
  return s.label_ru || s.label_en || s.slug;
}

function makeKey() {
  return `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function syncFromProps() {
  localAttrs.value = (props.attrs || []).map((a, i) => ({
    key: a.key || '',
    value: a.value || '',
    _key: a._key || `p-${i}-${a.key || makeKey()}`,
  }));
}

function emitChange() {
  emit(
    'update:attrs',
    localAttrs.value.map(({ key, value }) => ({ key, value }))
  );
}

function onSection(id) {
  emit('update:sectionId', id || '');
}

function addRow() {
  localAttrs.value.push({ key: '', value: '', _key: makeKey() });
  emitChange();
}

function removeRow(index) {
  localAttrs.value.splice(index, 1);
  emitChange();
}

async function loadSections() {
  loading.value = true;
  try {
    sections.value = await fetchCatalogSections({ all: 0 });
    try {
      const admin = await fetchCatalogAdminTaxonomy();
      const map = {};
      for (const s of admin.sections || []) {
        map[s.id] = [...new Set([...(s.filter_keys || []), ...(s.known_keys || [])])];
      }
      knownBySection.value = map;
    } catch {
      // editor without taxonomy rights — sections list is enough
    }
  } finally {
    loading.value = false;
  }
}

watch(() => props.attrs, syncFromProps, { deep: true, immediate: true });
onMounted(loadSections);
</script>

<style scoped>
.catalog-attrs { display: flex; flex-direction: column; gap: 10px; }
.catalog-attrs__field { display: flex; flex-direction: column; gap: 4px; }
.catalog-attrs__label { font-size: var(--font-size-sm); color: var(--color-grey-dark); }
.catalog-attrs__select,
.catalog-attrs__input {
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
.catalog-attrs__row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
  align-items: center;
}
@media (max-width: 640px) {
  .catalog-attrs__row { grid-template-columns: 1fr; }
}
</style>
