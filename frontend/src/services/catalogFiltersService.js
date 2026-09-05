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
