/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Разделы каталога + динамические атрибуты (ключ/значение) на страницах и товарах.
 * Фильтры ленты/витрины — по filter_keys раздела и значениям атрибутов.
 * Паттерн как у тегов: справочник (раздел) + связи (атрибуты) + фильтр по выбранным.
 */

const db = require('../db');

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'e')
    .replace(/[^a-z0-9а-я_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || `s-${Date.now()}`;
}

function normalizeKey(raw) {
  return String(raw || '').trim().slice(0, 120);
}

function normalizeValue(raw) {
  return String(raw || '').trim().slice(0, 500);
}

function normalizeAttrs(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  list.forEach((row, i) => {
    const attr_key = normalizeKey(row?.key ?? row?.attr_key);
    const attr_value = normalizeValue(row?.value ?? row?.attr_value);
    if (!attr_key || !attr_value) return;
    const id = `${attr_key.toLowerCase()}::${attr_value.toLowerCase()}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ attr_key, attr_value, sort_order: Number.isFinite(row?.sort_order) ? row.sort_order : i });
  });
  return out;
}

function normalizeFilterKeys(keys) {
  if (!Array.isArray(keys)) return [];
  const out = [];
  const seen = new Set();
  for (const k of keys) {
    const key = normalizeKey(k);
    if (!key) continue;
    const low = key.toLowerCase();
    if (seen.has(low)) continue;
    seen.add(low);
    out.push(key);
  }
  return out;
}

async function listSections({ activeOnly = true } = {}) {
  const sql = activeOnly
    ? `SELECT * FROM catalog_sections WHERE active = TRUE ORDER BY sort_order ASC, label_ru ASC`
    : `SELECT * FROM catalog_sections ORDER BY sort_order ASC, label_ru ASC`;
  const { rows } = await db.getQuery()(sql);
  return rows.map(mapSection);
}

function mapSection(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    label_ru: row.label_ru,
    label_en: row.label_en || '',
    sort_order: row.sort_order,
    active: row.active !== false,
    filter_keys: Array.isArray(row.filter_keys) ? row.filter_keys : [],
  };
}

async function getSectionByIdOrSlug(idOrSlug) {
  if (!idOrSlug) return null;
  const { rows } = await db.getQuery()(
    `SELECT * FROM catalog_sections
     WHERE id::text = $1 OR slug = $1
     LIMIT 1`,
    [String(idOrSlug)]
  );
  return mapSection(rows[0]);
}

async function createSection({ label_ru, label_en = '', slug, filter_keys = [], sort_order = 0, active = true } = {}) {
  const name = String(label_ru || '').trim();
  if (!name) {
    const err = new Error('Укажите название раздела');
    err.status = 400;
    throw err;
  }
  let s = slugify(slug || name);
  const { rows: clash } = await db.getQuery()(
    `SELECT id FROM catalog_sections WHERE slug = $1 LIMIT 1`,
    [s]
  );
  if (clash[0]) s = `${s}-${Date.now().toString(36).slice(-4)}`;

  const { rows } = await db.getQuery()(
    `INSERT INTO catalog_sections (slug, label_ru, label_en, sort_order, active, filter_keys)
     VALUES ($1, $2, $3, $4, $5, $6::text[])
     RETURNING *`,
    [s, name, String(label_en || ''), Number(sort_order) || 0, active !== false, normalizeFilterKeys(filter_keys)]
  );
  return mapSection(rows[0]);
}

async function updateSection(id, payload = {}) {
  const current = await getSectionByIdOrSlug(id);
  if (!current) {
    const err = new Error('Раздел не найден');
    err.status = 404;
    throw err;
  }
  const label_ru = payload.label_ru != null ? String(payload.label_ru).trim() : current.label_ru;
  if (!label_ru) {
    const err = new Error('Укажите название раздела');
    err.status = 400;
    throw err;
  }
  const label_en = payload.label_en != null ? String(payload.label_en) : current.label_en;
  const sort_order = payload.sort_order != null ? Number(payload.sort_order) || 0 : current.sort_order;
  const active = payload.active != null ? Boolean(payload.active) : current.active;
  const filter_keys = payload.filter_keys != null
    ? normalizeFilterKeys(payload.filter_keys)
    : current.filter_keys;
  let slug = current.slug;
  if (payload.slug != null && String(payload.slug).trim()) {
    slug = slugify(payload.slug);
  }

  const { rows } = await db.getQuery()(
    `UPDATE catalog_sections
     SET slug = $2, label_ru = $3, label_en = $4, sort_order = $5, active = $6,
         filter_keys = $7::text[], updated_at = NOW()
     WHERE id = $1::uuid
     RETURNING *`,
    [current.id, slug, label_ru, label_en, sort_order, active, filter_keys]
  );
  return mapSection(rows[0]);
}

async function deleteSection(id, { hard = false } = {}) {
  const current = await getSectionByIdOrSlug(id);
  if (!current) {
    const err = new Error('Раздел не найден');
    err.status = 404;
    throw err;
  }
  if (hard) {
    await db.getQuery()(`DELETE FROM catalog_sections WHERE id = $1::uuid`, [current.id]);
    return { deleted: true, id: current.id };
  }
  await db.getQuery()(
    `UPDATE catalog_sections SET active = FALSE, updated_at = NOW() WHERE id = $1::uuid`,
    [current.id]
  );
  return { deleted: false, deactivated: true, id: current.id };
}

async function setEntityAttrs(linkTable, idColumn, entityId, attrs) {
  const normalized = normalizeAttrs(attrs);
  await db.getQuery()(`DELETE FROM ${linkTable} WHERE ${idColumn} = $1`, [entityId]);
  for (const row of normalized) {
    await db.getQuery()(
      `INSERT INTO ${linkTable} (${idColumn}, attr_key, attr_value, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [entityId, row.attr_key, row.attr_value, row.sort_order]
    );
  }
  return getEntityAttrs(linkTable, idColumn, entityId);
}

async function getEntityAttrs(linkTable, idColumn, entityId) {
  const { rows } = await db.getQuery()(
    `SELECT attr_key, attr_value, sort_order
     FROM ${linkTable}
     WHERE ${idColumn} = $1
     ORDER BY sort_order ASC, attr_key ASC, attr_value ASC`,
    [entityId]
  );
  return rows.map((r) => ({
    key: r.attr_key,
    value: r.attr_value,
    sort_order: r.sort_order,
  }));
}

async function setPageCatalog(pageId, { catalog_section_id = null, catalog_attrs = [] } = {}) {
  const raw = catalog_section_id != null && String(catalog_section_id).trim() !== ''
    ? String(catalog_section_id).trim()
    : null;
  const section = raw ? await getSectionByIdOrSlug(raw) : null;
  await db.getQuery()(
    `UPDATE admin_pages_simple SET catalog_section_id = $2 WHERE id = $1`,
    [pageId, section?.id || null]
  );
  const attrs = await setEntityAttrs('page_catalog_attrs', 'page_id', pageId, catalog_attrs);
  return {
    catalog_section_id: section?.id || null,
    catalog_section: section,
    catalog_attrs: attrs,
  };
}

async function setProductCatalog(productId, { catalog_section_id = null, catalog_attrs = [] } = {}) {
  const raw = catalog_section_id != null && String(catalog_section_id).trim() !== ''
    ? String(catalog_section_id).trim()
    : null;
  const section = raw ? await getSectionByIdOrSlug(raw) : null;
  await db.getQuery()(
    `UPDATE store_products SET catalog_section_id = $2 WHERE id = $1::uuid`,
    [productId, section?.id || null]
  );
  const attrs = await setEntityAttrs('store_product_attrs', 'product_id', productId, catalog_attrs);
  return {
    catalog_section_id: section?.id || null,
    catalog_section: section,
    catalog_attrs: attrs,
  };
}

async function getPageCatalog(pageId) {
  const { rows } = await db.getQuery()(
    `SELECT catalog_section_id FROM admin_pages_simple WHERE id = $1 LIMIT 1`,
    [pageId]
  );
  const sectionId = rows[0]?.catalog_section_id || null;
  const section = sectionId ? await getSectionByIdOrSlug(sectionId) : null;
  const attrs = await getEntityAttrs('page_catalog_attrs', 'page_id', pageId).catch(() => []);
  return { catalog_section_id: section?.id || null, catalog_section: section, catalog_attrs: attrs };
}

async function getProductCatalog(productId) {
  const { rows } = await db.getQuery()(
    `SELECT catalog_section_id FROM store_products WHERE id = $1::uuid LIMIT 1`,
    [productId]
  );
  const sectionId = rows[0]?.catalog_section_id || null;
  const section = sectionId ? await getSectionByIdOrSlug(sectionId) : null;
  const attrs = await getEntityAttrs('store_product_attrs', 'product_id', productId).catch(() => []);
  return { catalog_section_id: section?.id || null, catalog_section: section, catalog_attrs: attrs };
}

/**
 * Payload с формы: catalog_section_id + catalog_attrs[{key,value}]
 * (старые catalog_terms игнорируем)
 */
async function applyEntityCatalogPayload(kind, entityId, payload = {}) {
  const sectionId = payload.catalog_section_id ?? payload.section_id ?? null;
  const attrs = payload.catalog_attrs ?? payload.attrs ?? [];
  if (kind === 'page') return setPageCatalog(entityId, { catalog_section_id: sectionId, catalog_attrs: attrs });
  if (kind === 'product') return setProductCatalog(entityId, { catalog_section_id: sectionId, catalog_attrs: attrs });
  throw new Error(`Unknown catalog entity kind: ${kind}`);
}

async function listKnownKeysForSection(sectionId, scope = 'both') {
  const params = [sectionId];
  const parts = [];
  if (scope === 'blog' || scope === 'both') {
    parts.push(
      `SELECT DISTINCT a.attr_key AS key
       FROM page_catalog_attrs a
       INNER JOIN admin_pages_simple p ON p.id = a.page_id
       WHERE p.catalog_section_id = $1`
    );
  }
  if (scope === 'store' || scope === 'both') {
    parts.push(
      `SELECT DISTINCT a.attr_key AS key
       FROM store_product_attrs a
       INNER JOIN store_products p ON p.id = a.product_id
       WHERE p.catalog_section_id = $1`
    );
  }
  if (!parts.length) return [];
  const { rows } = await db.getQuery()(parts.join(' UNION '), params);
  return rows.map((r) => r.key).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ru'));
}

async function listValuesForKey({ sectionId, key, scope = 'both', q = '', limit = 500 } = {}) {
  const attrKey = normalizeKey(key);
  if (!sectionId || !attrKey) return [];
  const params = [sectionId, attrKey];
  const parts = [];
  if (scope === 'blog' || scope === 'both') {
    parts.push(
      `SELECT DISTINCT a.attr_value AS value
       FROM page_catalog_attrs a
       INNER JOIN admin_pages_simple p ON p.id = a.page_id
       WHERE p.catalog_section_id = $1 AND a.attr_key = $2`
    );
  }
  if (scope === 'store' || scope === 'both') {
    parts.push(
      `SELECT DISTINCT a.attr_value AS value
       FROM store_product_attrs a
       INNER JOIN store_products p ON p.id = a.product_id
       WHERE p.catalog_section_id = $1 AND a.attr_key = $2`
    );
  }
  let sql = `SELECT DISTINCT value FROM (${parts.join(' UNION ')}) u`;
  if (q) {
    params.push(`%${String(q).trim()}%`);
    sql += ` WHERE value ILIKE $${params.length}`;
  }
  sql += ` ORDER BY value ASC LIMIT ${Math.min(Math.max(Number(limit) || 500, 1), 2000)}`;
  const { rows } = await db.getQuery()(sql, params);
  return rows.map((r) => ({ value: r.value, label: r.value }));
}

/**
 * Публичные фильтры: разделы + опции значений по filter_keys выбранного раздела.
 * selection: { section, [attrKey]: value }
 */
async function getLinkedFiltersPayload({
  facets = {},
  scope = 'both',
  onlyUsed = false,
} = {}) {
  const sections = await listSections({ activeOnly: true });
  const sectionSlugOrId = facets.section || facets.group || null;
  let section = null;
  if (sectionSlugOrId) {
    section = sections.find((s) => s.slug === sectionSlugOrId || s.id === sectionSlugOrId)
      || await getSectionByIdOrSlug(sectionSlugOrId);
  }

  const filters = [];
  if (section) {
    const keys = section.filter_keys || [];
    for (const key of keys) {
      let values = await listValuesForKey({ sectionId: section.id, key, scope });
      if (onlyUsed) {
        // already from used attrs
      }
      filters.push({
        key,
        label: key,
        options: values,
      });
    }
  }

  return {
    sections,
    section: section || null,
    filters,
    selection: {
      section: section?.slug || '',
      ...Object.fromEntries(
        (section?.filter_keys || []).map((k) => [k, facets[k] || facets[`attr_${k}`] || ''])
      ),
    },
  };
}

async function filterEntityIdsByAttrs({
  entity = 'page',
  sectionId = null,
  attrs = {},
} = {}) {
  const entries = Object.entries(attrs || {})
    .map(([k, v]) => [normalizeKey(k), normalizeValue(v)])
    .filter(([k, v]) => k && v && k !== 'section' && k !== 'group');

  if (!sectionId && !entries.length) return null;

  const link = entity === 'product'
    ? { table: 'store_product_attrs', idCol: 'product_id', parent: 'store_products', parentId: 'id' }
    : { table: 'page_catalog_attrs', idCol: 'page_id', parent: 'admin_pages_simple', parentId: 'id' };

  const params = [];
  let sql = `SELECT p.${link.parentId} AS id FROM ${link.parent} p WHERE 1=1`;
  if (sectionId) {
    params.push(sectionId);
    sql += ` AND p.catalog_section_id = $${params.length}`;
  }
  for (const [key, value] of entries) {
    params.push(key, value);
    const iKey = params.length - 1;
    const iVal = params.length;
    sql += ` AND EXISTS (
      SELECT 1 FROM ${link.table} a
      WHERE a.${link.idCol} = p.${link.parentId}
        AND a.attr_key = $${iKey}
        AND a.attr_value = $${iVal}
    )`;
  }
  const { rows } = await db.getQuery()(sql, params);
  return new Set(rows.map((r) => r.id));
}

async function filterPageIdsByFacets(facets = {}) {
  const section = facets.section || facets.group
    ? await getSectionByIdOrSlug(facets.section || facets.group)
    : null;
  const attrs = { ...facets };
  // Только служебные ключи выбора раздела; имена полей (в т.ч. city) не трогаем.
  delete attrs.section;
  delete attrs.group;
  return filterEntityIdsByAttrs({
    entity: 'page',
    sectionId: section?.id || null,
    attrs,
  });
}

async function filterProductIdsByFacets(facets = {}) {
  const section = facets.section || facets.group
    ? await getSectionByIdOrSlug(facets.section || facets.group)
    : null;
  const attrs = { ...facets };
  delete attrs.section;
  delete attrs.group;
  return filterEntityIdsByAttrs({
    entity: 'product',
    sectionId: section?.id || null,
    attrs,
  });
}

/** Совместимость: старый сид Авто/гео больше не нужен */
async function seedCatalogTerms() {
  return { skipped: true, reason: 'legacy_terms_disabled', counts: {} };
}

async function getAdminTaxonomy() {
  const sections = await listSections({ activeOnly: false });
  const withKeys = [];
  for (const s of sections) {
    const known_keys = await listKnownKeysForSection(s.id, 'both');
    withKeys.push({ ...s, known_keys });
  }
  return { sections: withKeys };
}

module.exports = {
  slugify,
  listSections,
  getSectionByIdOrSlug,
  createSection,
  updateSection,
  deleteSection,
  getPageCatalog,
  getProductCatalog,
  setPageCatalog,
  setProductCatalog,
  applyEntityCatalogPayload,
  listKnownKeysForSection,
  listValuesForKey,
  getLinkedFiltersPayload,
  filterPageIdsByFacets,
  filterProductIdsByFacets,
  filterEntityIdsByAttrs,
  seedCatalogTerms,
  getAdminTaxonomy,
  // legacy aliases used by older callers — map to new model
  async setEntityTermsFromPayload(linkTable, idColumn, entityId, payload) {
    const kind = linkTable === 'store_product_terms' ? 'product' : 'page';
    const result = await applyEntityCatalogPayload(kind, entityId, {
      catalog_section_id: payload.catalog_section_id,
      catalog_attrs: payload.catalog_attrs,
    });
    return result.catalog_attrs;
  },
  async getPageTerms(pageId) {
    const data = await getPageCatalog(pageId);
    return data.catalog_attrs;
  },
  async getProductTerms(productId) {
    const data = await getProductCatalog(productId);
    return data.catalog_attrs;
  },
  termsToByKind() {
    return {};
  },
  normalizeTermsPayload(payload = {}) {
    const raw = payload.catalog_section_id ?? payload.section_id ?? null;
    const catalog_section_id = raw != null && String(raw).trim() !== '' ? String(raw).trim() : null;
    return {
      catalog_section_id,
      catalog_attrs: normalizeAttrs(payload.catalog_attrs || payload.attrs || []),
    };
  },
};
