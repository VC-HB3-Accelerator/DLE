<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  Разделы: поля + значения; у значения кнопка «+» — связать другой фильтр
  (например Регион → Город) со своим списком значений.
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
    <p class="taxonomy__intro taxonomy__intro--tight">{{ t('blog.feedSettings.linksIntro') }}</p>

    <p v-if="loadError" class="taxonomy__error">{{ loadError }}</p>
    <p v-if="loading" class="taxonomy__muted">{{ t('common.loading') }}</p>

    <div v-else-if="!sections.length && !creating" class="taxonomy__muted">
      {{ t('blog.feedSettings.noSections') }}
    </div>

    <div v-if="creating" class="taxonomy__card">
      <label class="taxonomy__field">
        <span>{{ t('blog.feedSettings.labelRu') }}</span>
        <input v-model="draft.label_ru" type="text" :disabled="saving" @keydown.enter.prevent="create" />
      </label>
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
          :class="{ 'taxonomy__tab--active': activeId === s.id }"
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

        <div
          v-for="(key, fi) in active.filter_keys"
          :key="`${active.id}-${key}`"
          class="taxonomy__field-block"
        >
          <div class="taxonomy__field-head">
            <div class="taxonomy__order">
              <button type="button" class="taxonomy__icon-btn" :disabled="saving || fi === 0" :title="t('blog.feedSettings.moveUp')" @click="moveField(fi, -1)">↑</button>
              <button type="button" class="taxonomy__icon-btn" :disabled="saving || fi >= active.filter_keys.length - 1" :title="t('blog.feedSettings.moveDown')" @click="moveField(fi, 1)">↓</button>
              <h4>
                {{ key }}
                <span class="taxonomy__count">({{ fieldValueCount(key) }})</span>
                <span v-if="incomingLinkParents(key).length" class="taxonomy__badge">
                  {{ t('blog.feedSettings.linkedFromBadge', { n: incomingLinkParents(key).length }) }}
                </span>
                <span v-else-if="outgoingLinkCount(key)" class="taxonomy__badge">
                  {{ t('blog.feedSettings.linksOutBadge', { n: outgoingLinkCount(key) }) }}
                </span>
              </h4>
            </div>
            <button type="button" class="btn btn-outline btn-sm" :disabled="saving" @click="removeField(key)">
              {{ t('blog.feedSettings.deleteField') }}
            </button>
          </div>

          <div class="taxonomy__value-row">
            <label class="taxonomy__field taxonomy__field--grow">
              <span>{{ t('blog.feedSettings.valuesList') }}</span>
              <select
                v-model="selectedValues[key]"
                class="taxonomy__select"
                :disabled="saving || !(active.filter_values[key] || []).length"
                @change="onSelectValue(key)"
              >
                <option value="">
                  {{ (active.filter_values[key] || []).length
                    ? t('blog.feedSettings.valuesCount', { n: active.filter_values[key].length })
                    : t('blog.feedSettings.noValues') }}
                </option>
                <option v-for="val in (active.filter_values[key] || [])" :key="val" :value="val">
                  {{ val }}
                </option>
              </select>
            </label>
            <div class="taxonomy__value-actions">
              <button type="button" class="taxonomy__icon-btn" :disabled="saving || !selectedValues[key]" :title="t('blog.feedSettings.moveUp')" @click="moveValue(key, -1)">↑</button>
              <button type="button" class="taxonomy__icon-btn" :disabled="saving || !selectedValues[key]" :title="t('blog.feedSettings.moveDown')" @click="moveValue(key, 1)">↓</button>
              <button type="button" class="btn btn-outline btn-sm" :disabled="saving || !selectedValues[key]" @click="removeSelectedValue(key)">
                {{ t('common.delete') }}
              </button>
              <button
                type="button"
                class="taxonomy__icon-btn taxonomy__icon-btn--plus"
                :disabled="saving || !selectedValues[key] || linkableFilters(key).length === 0"
                :title="t('blog.feedSettings.linkFilter')"
                @click="toggleLinkPicker(key)"
              >
                +
              </button>
            </div>
          </div>

          <div v-if="linkPickerOpen[key] && selectedValues[key]" class="taxonomy__link-pick">
            <label class="taxonomy__field taxonomy__field--grow">
              <span>{{ t('blog.feedSettings.linkPickFilter') }}</span>
              <select v-model="linkPickDraft[key]" class="taxonomy__select" :disabled="saving">
                <option value="">{{ t('blog.feedSettings.linkPickPlaceholder') }}</option>
                <option v-for="fk in linkableFilters(key)" :key="fk" :value="fk">{{ fk }}</option>
              </select>
            </label>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="saving || !linkPickDraft[key]"
              @click="addLink(key)"
            >
              {{ t('blog.feedSettings.linkAttach') }}
            </button>
          </div>

          <div
            v-if="selectedValues[key] && linkedChildKeys(key, selectedValues[key]).length"
            class="taxonomy__links"
          >
            <div
              v-for="childKey in linkedChildKeys(key, selectedValues[key])"
              :key="`${key}-${selectedValues[key]}-${childKey}`"
              class="taxonomy__link-card"
            >
              <div class="taxonomy__link-head">
                <strong>{{ t('blog.feedSettings.linkFor', { child: childKey, parent: selectedValues[key] }) }}</strong>
                <button
                  type="button"
                  class="btn btn-outline btn-sm"
                  :disabled="saving"
                  @click="removeLink(key, selectedValues[key], childKey)"
                >
                  {{ t('blog.feedSettings.unlinkFilter') }}
                </button>
              </div>

              <div class="taxonomy__value-row">
                <label class="taxonomy__field taxonomy__field--grow">
                  <span>{{ t('blog.feedSettings.valuesList') }}</span>
                  <select
                    v-model="selectedLinkedValues[linkStateKey(key, selectedValues[key], childKey)]"
                    class="taxonomy__select"
                    :disabled="saving || !linkedValues(key, selectedValues[key], childKey).length"
                  >
                    <option value="">
                      {{ linkedValues(key, selectedValues[key], childKey).length
                        ? t('blog.feedSettings.valuesCount', { n: linkedValues(key, selectedValues[key], childKey).length })
                        : t('blog.feedSettings.noValues') }}
                    </option>
                    <option
                      v-for="val in linkedValues(key, selectedValues[key], childKey)"
                      :key="val"
                      :value="val"
                    >
                      {{ val }}
                    </option>
                  </select>
                </label>
                <div class="taxonomy__value-actions">
                  <button
                    type="button"
                    class="btn btn-outline btn-sm"
                    :disabled="saving || !selectedLinkedValues[linkStateKey(key, selectedValues[key], childKey)]"
                    @click="removeLinkedValue(key, selectedValues[key], childKey)"
                  >
                    {{ t('common.delete') }}
                  </button>
                </div>
              </div>

              <ul
                v-if="linkedValues(key, selectedValues[key], childKey).length"
                class="taxonomy__value-list"
              >
                <li
                  v-for="val in linkedValues(key, selectedValues[key], childKey)"
                  :key="val"
                  class="taxonomy__value-chip"
                >
                  {{ val }}
                </li>
              </ul>

              <div class="taxonomy__value-row">
                <label class="taxonomy__field taxonomy__field--grow">
                  <span>{{ t('blog.feedSettings.valuePlaceholder') }}</span>
                  <input
                    v-model="linkValueDrafts[linkStateKey(key, selectedValues[key], childKey)]"
                    type="text"
                    :disabled="saving"
                    :placeholder="t('blog.feedSettings.valuePlaceholder')"
                    @keydown.enter.prevent="addLinkedValue(key, selectedValues[key], childKey)"
                  />
                </label>
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  :disabled="saving || !(linkValueDrafts[linkStateKey(key, selectedValues[key], childKey)] || '').trim()"
                  @click="addLinkedValue(key, selectedValues[key], childKey)"
                >
                  {{ t('common.save') }}
                </button>
              </div>
            </div>
          </div>

          <p
            v-else-if="!selectedValues[key] && outgoingLinkCount(key)"
            class="taxonomy__hint"
          >
            {{ t('blog.feedSettings.selectValueToSeeLinks', { n: outgoingLinkCount(key) }) }}
          </p>

          <!-- Входящие связи: у поля Город показать города по выбранному региону -->
          <div v-if="incomingLinkParents(key).length" class="taxonomy__incoming">
            <label class="taxonomy__field">
              <span>{{ t('blog.feedSettings.incomingLinksTitle', { field: key }) }}</span>
              <select
                v-model="incomingParentPick[key]"
                class="taxonomy__select"
                :disabled="saving"
              >
                <option value="">{{ t('blog.feedSettings.incomingPickParent') }}</option>
                <option
                  v-for="row in incomingLinkParents(key)"
                  :key="`${row.parentKey}:${row.parentVal}`"
                  :value="incomingPickValue(row)"
                >
                  {{ row.parentKey }}: {{ row.parentVal }} ({{ row.count }})
                </option>
              </select>
            </label>

            <div
              v-if="parsedIncomingPick(key)"
              class="taxonomy__link-card"
            >
              <div class="taxonomy__link-head">
                <strong>
                  {{ t('blog.feedSettings.linkFor', {
                    child: key,
                    parent: parsedIncomingPick(key).parentVal,
                  }) }}
                </strong>
              </div>
              <div class="taxonomy__value-row">
                <label class="taxonomy__field taxonomy__field--grow">
                  <span>{{ t('blog.feedSettings.valuesList') }}</span>
                  <select
                    v-model="selectedLinkedValues[linkStateKey(
                      parsedIncomingPick(key).parentKey,
                      parsedIncomingPick(key).parentVal,
                      key
                    )]"
                    class="taxonomy__select"
                    :disabled="saving || !linkedValues(
                      parsedIncomingPick(key).parentKey,
                      parsedIncomingPick(key).parentVal,
                      key
                    ).length"
                  >
                    <option value="">
                      {{ linkedValues(
                        parsedIncomingPick(key).parentKey,
                        parsedIncomingPick(key).parentVal,
                        key
                      ).length
                        ? t('blog.feedSettings.valuesCount', {
                          n: linkedValues(
                            parsedIncomingPick(key).parentKey,
                            parsedIncomingPick(key).parentVal,
                            key
                          ).length,
                        })
                        : t('blog.feedSettings.noValues') }}
                    </option>
                    <option
                      v-for="val in linkedValues(
                        parsedIncomingPick(key).parentKey,
                        parsedIncomingPick(key).parentVal,
                        key
                      )"
                      :key="val"
                      :value="val"
                    >
                      {{ val }}
                    </option>
                  </select>
                </label>
                <div class="taxonomy__value-actions">
                  <button
                    type="button"
                    class="btn btn-outline btn-sm"
                    :disabled="saving || !selectedLinkedValues[linkStateKey(
                      parsedIncomingPick(key).parentKey,
                      parsedIncomingPick(key).parentVal,
                      key
                    )]"
                    @click="removeLinkedValue(
                      parsedIncomingPick(key).parentKey,
                      parsedIncomingPick(key).parentVal,
                      key
                    )"
                  >
                    {{ t('common.delete') }}
                  </button>
                </div>
              </div>
              <div class="taxonomy__value-row">
                <label class="taxonomy__field taxonomy__field--grow">
                  <span>{{ t('blog.feedSettings.valuePlaceholder') }}</span>
                  <input
                    v-model="linkValueDrafts[linkStateKey(
                      parsedIncomingPick(key).parentKey,
                      parsedIncomingPick(key).parentVal,
                      key
                    )]"
                    type="text"
                    :disabled="saving"
                    :placeholder="t('blog.feedSettings.valuePlaceholder')"
                    @keydown.enter.prevent="addLinkedValue(
                      parsedIncomingPick(key).parentKey,
                      parsedIncomingPick(key).parentVal,
                      key
                    )"
                  />
                </label>
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  :disabled="saving || !(linkValueDrafts[linkStateKey(
                    parsedIncomingPick(key).parentKey,
                    parsedIncomingPick(key).parentVal,
                    key
                  )] || '').trim()"
                  @click="addLinkedValue(
                    parsedIncomingPick(key).parentKey,
                    parsedIncomingPick(key).parentVal,
                    key
                  )"
                >
                  {{ t('common.save') }}
                </button>
              </div>
            </div>
          </div>

          <div class="taxonomy__value-row">
            <label class="taxonomy__field taxonomy__field--grow">
              <span>{{ t('blog.feedSettings.valuePlaceholder') }}</span>
              <input
                v-model="valueDrafts[key]"
                type="text"
                :disabled="saving"
                :placeholder="t('blog.feedSettings.valuePlaceholder')"
                @keydown.enter.prevent="addValue(key)"
              />
            </label>
            <button type="button" class="btn btn-primary btn-sm" :disabled="saving || !(valueDrafts[key] || '').trim()" @click="addValue(key)">
              {{ t('common.save') }}
            </button>
          </div>
        </div>

        <div class="taxonomy__new-field">
          <input
            v-model="newFieldName"
            type="text"
            :placeholder="t('blog.feedSettings.newFieldPlaceholder')"
            :disabled="saving"
            @keydown.enter.prevent="addField"
          />
          <button type="button" class="btn btn-outline btn-sm" :disabled="saving || !newFieldName.trim()" @click="addField">
            {{ t('blog.feedSettings.addField') }}
          </button>
        </div>

        <div class="taxonomy__actions">
          <button type="button" class="btn btn-primary btn-sm" :disabled="saving" @click="save">
            {{ saving ? t('common.saving') : t('common.save') }}
          </button>
          <button type="button" class="btn btn-outline btn-sm taxonomy__delete-section" :disabled="saving" @click="remove">
            {{ t('blog.feedSettings.deleteSection') }}
          </button>
        </div>
        <p v-if="saveMsg" class="taxonomy__ok">{{ saveMsg }}</p>
        <p v-if="saveError" class="taxonomy__error">{{ saveError }}</p>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
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
const draft = ref({ label_ru: '' });
const newFieldName = ref('');
const valueDrafts = reactive({});
const selectedValues = reactive({});
const linkPickerOpen = reactive({});
const linkPickDraft = reactive({});
const linkValueDrafts = reactive({});
const selectedLinkedValues = reactive({});
const incomingParentPick = reactive({});

const active = computed(() => sections.value.find((s) => s.id === activeId.value) || null);

function sectionLabel(s) {
  if (locale.value === 'en') return s.label_en || s.label_ru || s.slug;
  return s.label_ru || s.label_en || s.slug;
}

function dedupeList(list) {
  const out = [];
  const seen = new Set();
  for (const raw of list || []) {
    const v = String(raw || '').trim();
    if (!v) continue;
    const low = v.toLowerCase();
    if (seen.has(low)) continue;
    seen.add(low);
    out.push(v);
  }
  return out;
}

function ensureLinks(section) {
  if (!section.filter_links || typeof section.filter_links !== 'object') {
    section.filter_links = {};
  }
  return section.filter_links;
}

function linkStateKey(parentKey, parentVal, childKey) {
  return `${parentKey}::${parentVal}::${childKey}`;
}

function fieldValueCount(key) {
  const flat = (active.value?.filter_values?.[key] || []).length;
  const incoming = incomingLinkParents(key);
  if (incoming.length) {
    return incoming.reduce((sum, row) => sum + row.count, 0);
  }
  return flat;
}

function outgoingLinkCount(parentKey) {
  if (!active.value) return 0;
  const byVal = active.value.filter_links?.[parentKey] || {};
  return Object.keys(byVal).filter((pv) => Object.keys(byVal[pv] || {}).length > 0).length;
}

/** Поле является целью связей (например Город ← Регион) */
function incomingLinkParents(childKey) {
  if (!active.value) return [];
  const links = active.value.filter_links || {};
  const out = [];
  for (const [parentKey, byVal] of Object.entries(links)) {
    for (const [parentVal, children] of Object.entries(byVal || {})) {
      const list = children?.[childKey];
      if (Array.isArray(list)) {
        out.push({ parentKey, parentVal, count: list.length });
      }
    }
  }
  return out.sort((a, b) => a.parentVal.localeCompare(b.parentVal, 'ru'));
}

function incomingPickValue(row) {
  return `${row.parentKey}\t${row.parentVal}`;
}

function parsedIncomingPick(childKey) {
  const raw = incomingParentPick[childKey] || '';
  if (!raw.includes('\t')) return null;
  const [parentKey, parentVal] = raw.split('\t');
  if (!parentKey || !parentVal) return null;
  return { parentKey, parentVal };
}

function linkableFilters(parentKey) {
  if (!active.value) return [];
  const parentVal = selectedValues[parentKey];
  const linked = parentVal
    ? Object.keys(active.value.filter_links?.[parentKey]?.[parentVal] || {})
    : [];
  return (active.value.filter_keys || []).filter(
    (k) => k !== parentKey && !linked.some((x) => x.toLowerCase() === k.toLowerCase())
  );
}

function linkedChildKeys(parentKey, parentVal) {
  if (!active.value || !parentVal) return [];
  return Object.keys(active.value.filter_links?.[parentKey]?.[parentVal] || {});
}

function linkedValues(parentKey, parentVal, childKey) {
  if (!active.value || !parentVal || !childKey) return [];
  return active.value.filter_links?.[parentKey]?.[parentVal]?.[childKey] || [];
}

function applyData(data) {
  sections.value = (data?.sections || [])
    .filter((s) => s.active !== false)
    .map((s) => {
      const keys = [...(s.filter_keys || [])];
      const values = {};
      for (const k of keys) {
        values[k] = dedupeList((s.filter_values && s.filter_values[k]) || []);
        if (!(k in valueDrafts)) valueDrafts[k] = '';
        if (!(k in selectedValues)) selectedValues[k] = '';
        if (!(k in linkPickerOpen)) linkPickerOpen[k] = false;
        if (!(k in linkPickDraft)) linkPickDraft[k] = '';
        if (!(k in incomingParentPick)) incomingParentPick[k] = '';
      }
      return {
        ...s,
        filter_keys: keys,
        filter_values: values,
        filter_links: s.filter_links && typeof s.filter_links === 'object' ? structuredClone(s.filter_links) : {},
      };
    });
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
  draft.value = { label_ru: '' };
}

function onSelectValue(key) {
  linkPickerOpen[key] = false;
  linkPickDraft[key] = '';
}

function toggleLinkPicker(key) {
  linkPickerOpen[key] = !linkPickerOpen[key];
  if (!linkPickerOpen[key]) linkPickDraft[key] = '';
}

async function persist(extraMsg = '') {
  if (!active.value) return false;
  saving.value = true;
  saveMsg.value = '';
  saveError.value = '';
  try {
    const s = active.value;
    const filter_values = {};
    for (const k of s.filter_keys) {
      filter_values[k] = dedupeList(s.filter_values[k] || []);
      s.filter_values[k] = filter_values[k];
    }
    const filter_links = ensureLinks(s);
    const data = await updateCatalogSection(s.id, {
      label_ru: s.label_ru,
      label_en: s.label_en,
      active: true,
      filter_keys: s.filter_keys,
      filter_values,
      filter_links,
      sort_order: s.sort_order,
    });
    const keepId = s.id;
    const keepSelected = { ...selectedValues };
    applyData(data);
    activeId.value = keepId;
    for (const [k, v] of Object.entries(keepSelected)) {
      if (v) selectedValues[k] = v;
    }
    saveMsg.value = extraMsg || t('blog.feedSettings.taxonomySaveSuccess');
    return true;
  } catch (e) {
    saveError.value = e.response?.data?.error || e.message || t('blog.feedSettings.taxonomySaveError');
    return false;
  } finally {
    saving.value = false;
  }
}

function addField() {
  if (!active.value) return;
  const name = newFieldName.value.trim();
  if (!name) return;
  if (active.value.filter_keys.some((k) => k.toLowerCase() === name.toLowerCase())) {
    saveError.value = t('blog.feedSettings.fieldExists');
    return;
  }
  active.value.filter_keys.push(name);
  active.value.filter_values[name] = [];
  valueDrafts[name] = '';
  selectedValues[name] = '';
  linkPickerOpen[name] = false;
  linkPickDraft[name] = '';
  newFieldName.value = '';
  saveError.value = '';
  persist();
}

function removeField(key) {
  if (!active.value) return;
  if (!confirm(t('blog.feedSettings.confirmDeleteField', { name: key }))) return;
  active.value.filter_keys = active.value.filter_keys.filter((k) => k !== key);
  delete active.value.filter_values[key];
  delete valueDrafts[key];
  delete selectedValues[key];
  const links = ensureLinks(active.value);
  delete links[key];
  for (const parentKey of Object.keys(links)) {
    for (const parentVal of Object.keys(links[parentKey] || {})) {
      if (links[parentKey][parentVal]?.[key]) delete links[parentKey][parentVal][key];
      if (!Object.keys(links[parentKey][parentVal] || {}).length) delete links[parentKey][parentVal];
    }
    if (!Object.keys(links[parentKey] || {}).length) delete links[parentKey];
  }
  persist();
}

function moveField(index, delta) {
  if (!active.value) return;
  const to = index + delta;
  const keys = active.value.filter_keys;
  if (to < 0 || to >= keys.length) return;
  const copy = [...keys];
  const [item] = copy.splice(index, 1);
  copy.splice(to, 0, item);
  active.value.filter_keys = copy;
  persist();
}

function addValue(key) {
  if (!active.value) return;
  const val = String(valueDrafts[key] || '').trim();
  if (!val) return;
  if (!active.value.filter_values[key]) active.value.filter_values[key] = [];
  if (active.value.filter_values[key].some((v) => v.toLowerCase() === val.toLowerCase())) {
    valueDrafts[key] = '';
    saveError.value = t('blog.feedSettings.valueExists');
    return;
  }
  active.value.filter_values[key].push(val);
  valueDrafts[key] = '';
  selectedValues[key] = val;
  saveError.value = '';
  persist();
}

function removeSelectedValue(key) {
  if (!active.value) return;
  const val = selectedValues[key];
  if (!val) return;
  active.value.filter_values[key] = (active.value.filter_values[key] || []).filter((v) => v !== val);
  const links = ensureLinks(active.value);
  if (links[key]?.[val]) delete links[key][val];
  if (links[key] && !Object.keys(links[key]).length) delete links[key];
  selectedValues[key] = '';
  linkPickerOpen[key] = false;
  persist();
}

function moveValue(key, delta) {
  if (!active.value) return;
  const list = [...(active.value.filter_values[key] || [])];
  const val = selectedValues[key];
  const index = list.indexOf(val);
  if (index < 0) return;
  const to = index + delta;
  if (to < 0 || to >= list.length) return;
  const [item] = list.splice(index, 1);
  list.splice(to, 0, item);
  active.value.filter_values[key] = list;
  persist();
}

function addLink(parentKey) {
  if (!active.value) return;
  const parentVal = selectedValues[parentKey];
  const childKey = String(linkPickDraft[parentKey] || '').trim();
  if (!parentVal || !childKey) return;
  const links = ensureLinks(active.value);
  if (!links[parentKey]) links[parentKey] = {};
  if (!links[parentKey][parentVal]) links[parentKey][parentVal] = {};
  // значения уже лежат в выбранном фильтре — копируем в связь
  const fromField = dedupeList(active.value.filter_values?.[childKey] || []);
  links[parentKey][parentVal][childKey] = fromField;
  linkPickDraft[parentKey] = '';
  linkPickerOpen[parentKey] = false;
  saveError.value = '';
  persist(t('blog.feedSettings.linkAttached', { child: childKey, parent: parentVal }));
}

function removeLink(parentKey, parentVal, childKey) {
  if (!active.value) return;
  if (!confirm(t('blog.feedSettings.confirmUnlink', { child: childKey, parent: parentVal }))) return;
  const links = ensureLinks(active.value);
  if (links[parentKey]?.[parentVal]?.[childKey]) delete links[parentKey][parentVal][childKey];
  if (links[parentKey]?.[parentVal] && !Object.keys(links[parentKey][parentVal]).length) {
    delete links[parentKey][parentVal];
  }
  if (links[parentKey] && !Object.keys(links[parentKey]).length) delete links[parentKey];
  persist();
}

function addLinkedValue(parentKey, parentVal, childKey) {
  if (!active.value) return;
  const sk = linkStateKey(parentKey, parentVal, childKey);
  const val = String(linkValueDrafts[sk] || '').trim();
  if (!val) return;
  const links = ensureLinks(active.value);
  if (!links[parentKey]) links[parentKey] = {};
  if (!links[parentKey][parentVal]) links[parentKey][parentVal] = {};
  if (!links[parentKey][parentVal][childKey]) links[parentKey][parentVal][childKey] = [];
  const list = links[parentKey][parentVal][childKey];
  if (list.some((v) => v.toLowerCase() === val.toLowerCase())) {
    linkValueDrafts[sk] = '';
    saveError.value = t('blog.feedSettings.valueExists');
    return;
  }
  list.push(val);
  linkValueDrafts[sk] = '';
  selectedLinkedValues[sk] = val;
  saveError.value = '';
  persist();
}

function removeLinkedValue(parentKey, parentVal, childKey) {
  if (!active.value) return;
  const sk = linkStateKey(parentKey, parentVal, childKey);
  const val = selectedLinkedValues[sk];
  if (!val) return;
  const links = ensureLinks(active.value);
  const list = links[parentKey]?.[parentVal]?.[childKey] || [];
  links[parentKey][parentVal][childKey] = list.filter((v) => v !== val);
  selectedLinkedValues[sk] = '';
  persist();
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
  await persist();
}

async function remove() {
  if (!active.value) return;
  if (!confirm(t('blog.feedSettings.confirmDeleteSection', { name: sectionLabel(active.value) }))) return;
  saving.value = true;
  saveError.value = '';
  try {
    const data = await deleteCatalogSection(active.value.id, { hard: true });
    activeId.value = '';
    applyData(data);
    saveMsg.value = t('blog.feedSettings.sectionDeleted');
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
.taxonomy__intro, .taxonomy__muted {
  margin: 0 0 14px;
  color: var(--color-grey-dark);
  font-size: var(--font-size-sm);
}
.taxonomy__intro--tight { margin-top: -8px; }
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
.taxonomy__card {
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  padding: 16px;
  background: #fff;
  max-width: 720px;
}
.taxonomy__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.taxonomy__field { display: flex; flex-direction: column; gap: 4px; font-size: var(--font-size-sm); }
.taxonomy__field--grow { flex: 1 1 auto; min-width: 0; }
.taxonomy__field input,
.taxonomy__select,
.taxonomy__new-field input {
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  width: 100%;
  box-sizing: border-box;
  background: #fff;
}
.taxonomy__field-block {
  margin: 14px 0;
  padding: 12px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
  background: #fafafa;
}
.taxonomy__field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.taxonomy__order {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.taxonomy__order h4 {
  margin: 0;
  font-size: 1rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.taxonomy__count {
  color: var(--color-grey-dark);
  font-weight: 400;
  font-size: var(--font-size-sm);
}
.taxonomy__badge {
  margin-left: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #e0e7ff;
  color: #3730a3;
  font-size: 0.75rem;
  font-weight: 500;
}
.taxonomy__hint {
  margin: 0 0 10px;
  font-size: var(--font-size-sm);
  color: var(--color-grey-dark);
}
.taxonomy__incoming {
  margin: 0 0 12px;
  padding: 10px;
  border-radius: 8px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.taxonomy__icon-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  flex: 0 0 auto;
  font-size: 1.1rem;
  line-height: 1;
}
.taxonomy__icon-btn--plus {
  font-weight: 700;
  color: var(--color-dark);
}
.taxonomy__icon-btn:disabled { opacity: 0.4; cursor: default; }
.taxonomy__value-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.taxonomy__value-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  padding-bottom: 1px;
}
.taxonomy__value-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 10px;
  padding: 0;
  list-style: none;
  max-height: 160px;
  overflow: auto;
}
.taxonomy__value-chip {
  padding: 4px 10px;
  border-radius: 999px;
  background: #e5e7eb;
  color: var(--color-dark);
  font-size: var(--font-size-sm);
  cursor: pointer;
}
.taxonomy__value-chip--active {
  background: #c7d2fe;
  border: 1px solid #6366f1;
}
.taxonomy__link-pick {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin: 0 0 10px;
  flex-wrap: wrap;
  padding: 10px;
  border-radius: 8px;
  background: #eef2ff;
}
.taxonomy__links { display: flex; flex-direction: column; gap: 10px; margin: 0 0 10px; }
.taxonomy__link-card {
  padding: 10px;
  border: 1px dashed var(--color-border, #cbd5e1);
  border-radius: 8px;
  background: #fff;
}
.taxonomy__link-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.taxonomy__link-head strong { font-size: var(--font-size-sm); }
.taxonomy__new-field {
  display: flex;
  gap: 8px;
  margin: 12px 0;
  flex-wrap: wrap;
}
.taxonomy__new-field input { flex: 1 1 180px; }
.taxonomy__actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.taxonomy__delete-section { color: var(--color-danger, #b91c1c); border-color: #fecaca; }
</style>
