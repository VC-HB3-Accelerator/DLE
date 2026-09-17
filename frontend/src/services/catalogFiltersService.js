/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

import api from '@/api/axios';

export async function fetchCatalogFilters(params = {}) {
  const { data } = await api.get('/catalog/filters', { params });
  return data;
}

export async function fetchCatalogSections(params = {}) {
  const { data } = await api.get('/catalog/sections', { params });
  return data?.sections || [];
}

export async function fetchCatalogAdminTaxonomy() {
  const { data } = await api.get('/catalog/admin/taxonomy');
  return data;
}

export async function createCatalogSection(payload) {
  const { data } = await api.post('/catalog/admin/sections', payload);
  return data;
}

export async function updateCatalogSection(id, payload) {
  const { data } = await api.put(`/catalog/admin/sections/${encodeURIComponent(id)}`, payload);
  return data;
}

export async function deleteCatalogSection(id, { hard = false } = {}) {
  const { data } = await api.delete(`/catalog/admin/sections/${encodeURIComponent(id)}`, {
    params: hard ? { hard: 1 } : {},
  });
  return data;
}

/** Выбор фильтров на ленте/витрине: section + динамические ключи */
export function emptyCatalogSelection() {
  return { section: '' };
}

/** Фильтры-справочники городов по регионам — в каскаде только если связаны через «+». */
export function isLinkTargetCityFilter(key) {
  return /^Города\s*[·:]\s*/.test(String(key || ''));
}

export function isFilterActiveInCascade(key, {
  filterKeys = [],
  filterLinks = {},
  selection = {},
} = {}) {
  if (!isLinkTargetCityFilter(key)) return true;
  for (const parentKey of filterKeys) {
    if (isLinkTargetCityFilter(parentKey)) continue;
    const parentVal = selection?.[parentKey];
    if (!parentVal) continue;
    if (filterLinks?.[parentKey]?.[parentVal]?.[key]) return true;
  }
  return false;
}

/**
 * Опции поля с учётом связей filter_links[parent][parentVal][child].
 * Если связь есть, а массив пуст — берём значения из filter_values[child].
 */
export function resolveCatalogOptions({
  key,
  filterKeys = [],
  filterValues = {},
  filterLinks = {},
  selection = {},
  fallbackOptions = [],
} = {}) {
  const keys = Array.isArray(filterKeys) ? filterKeys : [];
  const idx = keys.indexOf(key);
  if (idx > 0) {
    for (let i = idx - 1; i >= 0; i -= 1) {
      const parentKey = keys[i];
      const parentVal = selection?.[parentKey];
      const linked = filterLinks?.[parentKey]?.[parentVal]?.[key];
      if (Array.isArray(linked)) {
        const list = linked.length
          ? linked
          : (Array.isArray(filterValues?.[key]) ? filterValues[key] : []);
        return list.map((v) => (typeof v === 'object' ? v : { value: v, label: v }));
      }
    }
  }
  if (Array.isArray(fallbackOptions) && fallbackOptions.length) {
    return fallbackOptions.map((o) => (
      typeof o === 'object' ? o : { value: o, label: o }
    ));
  }
  const flat = filterValues?.[key];
  if (Array.isArray(flat)) return flat.map((v) => ({ value: v, label: v }));
  return [];
}

/**
 * @param {object} query
 * @param {{ sectionParam?: string }} [opts] — для витрины магазина: `catalog_section` (не путать с store_sections)
 */
export function catalogSelectionFromQuery(query = {}, opts = {}) {
  const sectionParam = opts.sectionParam || 'section';
  const out = { section: '' };
  if (typeof query[sectionParam] === 'string' && query[sectionParam]) out.section = query[sectionParam];
  else if (typeof query.section === 'string' && query.section && sectionParam === 'section') out.section = query.section;
  else if (typeof query.group === 'string' && query.group) out.section = query.group;
  const reserved = new Set([
    sectionParam, 'section', 'catalog_section', 'group', 'filter', 'page', 'q', 'sort',
    'only_used', 'scope', 'section_id', 'slug',
    'visibility', 'show_in_blog', 'showInBlog', 'owner', 'edit', 'subscribed', 'scroll',
  ]);
  for (const [k, v] of Object.entries(query || {})) {
    if (reserved.has(k)) continue;
    if (typeof v === 'string' && v) out[k] = v;
  }
  return out;
}

export function catalogSelectionToQuery(selection = {}, base = {}, opts = {}) {
  const sectionParam = opts.sectionParam || 'section';
  const query = { ...base };
  delete query.group;
  delete query.category;
  delete query.condition;
  delete query.country;
  delete query.region;
  delete query.city;
  if (sectionParam !== 'section') delete query.section;
  for (const key of Object.keys(base || {})) {
    if (['filter', 'page', 'q', 'sort', 'section_id', 'slug', sectionParam].includes(key)) continue;
    if (!(key in (selection || {})) || key === 'section') {
      if (key !== 'section') delete query[key];
    }
  }
  for (const [k, v] of Object.entries(selection || {})) {
    if (k === 'section') continue;
    if (v) query[k] = v;
    else delete query[k];
  }
  if (selection.section) query[sectionParam] = selection.section;
  else delete query[sectionParam];
  return query;
}

/** Каскад ленты → filters_json подписки (section + attrs). */
export function catalogSelectionToSubscribeFilters(selection = {}) {
  const section = String(selection?.section || '').trim() || null;
  const attrs = {};
  for (const [k, v] of Object.entries(selection || {})) {
    if (k === 'section') continue;
    const val = String(v || '').trim();
    if (val) attrs[k] = val;
  }
  return { section, attrs };
}

export function formatSubscribeFiltersLabel(filters = {}, wholeFeedLabel = 'Вся лента') {
  const parts = [];
  if (filters.section) parts.push(String(filters.section));
  for (const v of Object.values(filters.attrs || {})) {
    if (v) parts.push(String(v));
  }
  return parts.length ? parts.join(' · ') : wholeFeedLabel;
}

/** Payload сущности: раздел + attrs[{key,value}] */
export function catalogEntityPayloadFromEditor({ sectionId = null, attrs = [] } = {}) {
  return {
    catalog_section_id: sectionId || null,
    catalog_attrs: (attrs || [])
      .map((row, i) => ({
        key: String(row.key || '').trim(),
        value: String(row.value || '').trim(),
        sort_order: i,
      }))
      .filter((r) => r.key && r.value),
  };
}

export function editorStateFromCatalog(data = {}) {
  return {
    sectionId: data.catalog_section_id || data.catalog_section?.id || '',
    attrs: Array.isArray(data.catalog_attrs)
      ? data.catalog_attrs.map((a, i) => ({
          key: a.key || a.attr_key || '',
          value: a.value || a.attr_value || '',
          _key: `a-${i}-${a.key || ''}`,
        }))
      : [],
  };
}

/** @deprecated aliases */
export function catalogTermsPayloadFromSelection(selection = {}) {
  const { section, ...rest } = selection || {};
  return { section, ...rest };
}

export function selectionFromCatalogByKind() {
  return emptyCatalogSelection();
}
