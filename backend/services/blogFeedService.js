/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const db = require('../db');

const SORT_BY_OPTIONS = ['new', 'views', 'likes', 'comments', 'popular'];

const DEFAULT_FILTERS = [
  { slug: 'new', label_ru: 'Новые', label_en: 'New', sort_by: 'new', is_default: true, is_active: true, position: 0 },
  { slug: 'popular', label_ru: 'Популярные', label_en: 'Popular', sort_by: 'popular', is_default: false, is_active: true, position: 1 },
  { slug: 'views', label_ru: 'По просмотрам', label_en: 'By views', sort_by: 'views', is_default: false, is_active: true, position: 2 },
  { slug: 'likes', label_ru: 'По лайкам', label_en: 'By likes', sort_by: 'likes', is_default: false, is_active: true, position: 3 },
  { slug: 'comments', label_ru: 'По комментариям', label_en: 'By comments', sort_by: 'comments', is_default: false, is_active: true, position: 4 },
];

/** Legacy slug фильтра ленты (перенесен в /content/published). */
const PRIVACY_BLOG_FILTER_SLUG = 'politika-i-soglasiya';
const PRIVACY_SECTION = 'политика и согласия';

/**
 * Юрдоки раздела «политика и согласия» живут в /content/published, не в ленте /blog:
 * show_in_blog = false, фильтр politika-i-soglasiya удаляется.
 */
async function detachPrivacyFromBlog() {
  const pagesResult = await db.getQuery()(
    `UPDATE admin_pages_simple
     SET show_in_blog = FALSE, updated_at = NOW()
     WHERE LOWER(TRIM(COALESCE(category, ''))) = LOWER(TRIM($1))
       AND status = 'published'
       AND visibility = 'public'
       AND COALESCE(is_system_template, FALSE) = FALSE
     RETURNING id`,
    [PRIVACY_SECTION]
  );

  let removedFilter = false;
  if (await tableExists('blog_feed_filters')) {
    const existing = await db.getQuery()(
      `SELECT id FROM blog_feed_filters WHERE slug = $1 LIMIT 1`,
      [PRIVACY_BLOG_FILTER_SLUG]
    );
    const filterId = existing.rows[0]?.id || null;
    if (filterId) {
      if (await tableExists('blog_feed_filter_pages')) {
        await db.getQuery()(`DELETE FROM blog_feed_filter_pages WHERE filter_id = $1`, [filterId]);
      }
      await db.getQuery()(`DELETE FROM blog_feed_filters WHERE id = $1`, [filterId]);
      removedFilter = true;
    }
  }

  return {
    ok: true,
    pagesDetached: pagesResult.rows.length,
    filterRemoved: removedFilter,
  };
}

/** @deprecated Используйте detachPrivacyFromBlog */
async function ensurePrivacyBlogFilter() {
  return detachPrivacyFromBlog();
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

async function tableExists(tableName) {
  const { rows } = await db.getQuery()(
    `SELECT to_regclass($1) AS exists`,
    [tableName]
  );
  return Boolean(rows[0]?.exists);
}

function normalizeFilter(row, index = 0) {
  const sortBy = SORT_BY_OPTIONS.includes(row.sort_by) ? row.sort_by : 'new';
  let slug = slugify(row.slug || row.label_en || row.label_ru || `filter-${index + 1}`);
  if (!slug) slug = `filter-${index + 1}`;

  const pageIds = Array.isArray(row.page_ids)
    ? row.page_ids.map((id) => parseInt(id, 10)).filter((id) => id && !Number.isNaN(id))
    : [];

  return {
    id: row.id ?? null,
    slug,
    label_ru: String(row.label_ru || row.label_en || slug).trim().slice(0, 120),
    label_en: String(row.label_en || row.label_ru || slug).trim().slice(0, 120),
    sort_by: sortBy,
    is_default: Boolean(row.is_default),
    is_active: row.is_active !== false,
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : index,
    page_ids: pageIds,
  };
}

function ensureSingleDefault(filters) {
  const active = filters.filter((f) => f.is_active);
  if (!active.length && filters.length) {
    filters[0].is_active = true;
  }

  let defaultIndex = filters.findIndex((f) => f.is_default && f.is_active);
  if (defaultIndex < 0) {
    defaultIndex = filters.findIndex((f) => f.is_active);
  }
  if (defaultIndex < 0 && filters.length) {
    defaultIndex = 0;
    filters[0].is_active = true;
  }

  return filters.map((f, i) => ({
    ...f,
    is_default: i === defaultIndex,
  }));
}

function metricScore(page, sortBy) {
  const views = Number(page.views_count) || 0;
  const likes = Number(page.likes_count) || 0;
  const comments = Number(page.comments_count) || 0;
  switch (sortBy) {
    case 'views':
      return views;
    case 'likes':
      return likes;
    case 'comments':
      return comments;
    case 'popular':
      return views + likes + comments;
    default:
      return 0;
  }
}

function createdAtTs(page) {
  const ts = Date.parse(page.created_at || 0);
  return Number.isFinite(ts) ? ts : 0;
}

/**
 * Сортировка ленты: закреплённые сверху, затем по правилу фильтра.
 */
function sortFeedPages(pages, { sortBy = 'new', pinnedMap = new Map() } = {}) {
  return [...pages].sort((a, b) => {
    const aPinned = pinnedMap.has(a.id);
    const bPinned = pinnedMap.has(b.id);
    if (aPinned !== bPinned) {
      return aPinned ? -1 : 1;
    }
    if (aPinned && bPinned) {
      return (pinnedMap.get(a.id) ?? 0) - (pinnedMap.get(b.id) ?? 0);
    }

    if (sortBy === 'new') {
      const byDate = createdAtTs(b) - createdAtTs(a);
      if (byDate !== 0) return byDate;
    } else {
      const byMetric = metricScore(b, sortBy) - metricScore(a, sortBy);
      if (byMetric !== 0) return byMetric;
      const byDate = createdAtTs(b) - createdAtTs(a);
      if (byDate !== 0) return byDate;
    }

    return (Number(a.order_index) || 0) - (Number(b.order_index) || 0);
  });
}

async function getPinnedMap() {
  if (!(await tableExists('blog_pinned_pages'))) {
    return new Map();
  }
  const { rows } = await db.getQuery()(
    `SELECT page_id, position FROM blog_pinned_pages ORDER BY position ASC, id ASC`
  );
  return new Map(rows.map((r) => [r.page_id, r.position]));
}

/** page_id[] для фильтра; null = без ограничения (все статьи ленты) */
async function getFilterPageIds(filterId) {
  if (!filterId || !(await tableExists('blog_feed_filter_pages'))) {
    return null;
  }
  const { rows } = await db.getQuery()(
    `SELECT page_id FROM blog_feed_filter_pages
     WHERE filter_id = $1
     ORDER BY position ASC, id ASC`,
    [filterId]
  );
  if (!rows.length) return null;
  return rows.map((r) => r.page_id);
}

async function getFilterPagesMap() {
  const map = new Map();
  if (!(await tableExists('blog_feed_filter_pages'))) {
    return map;
  }
  const { rows } = await db.getQuery()(
    `SELECT filter_id, page_id, position
     FROM blog_feed_filter_pages
     ORDER BY filter_id ASC, position ASC, id ASC`
  );
  for (const row of rows) {
    if (!map.has(row.filter_id)) map.set(row.filter_id, []);
    map.get(row.filter_id).push(row.page_id);
  }
  return map;
}

async function getPageFilterIds(pageId) {
  const id = parseInt(pageId, 10);
  if (!id || Number.isNaN(id) || !(await tableExists('blog_feed_filter_pages'))) {
    return [];
  }
  const { rows } = await db.getQuery()(
    `SELECT filter_id FROM blog_feed_filter_pages WHERE page_id = $1 ORDER BY filter_id ASC`,
    [id]
  );
  return rows.map((r) => r.filter_id);
}

/**
 * Заменить членство страницы в фильтрах (по id фильтров).
 */
async function setPageFilterIds(pageId, filterIds = []) {
  const id = parseInt(pageId, 10);
  if (!id || Number.isNaN(id)) {
    const err = new Error('Некорректный page_id');
    err.status = 400;
    throw err;
  }
  if (!(await tableExists('blog_feed_filter_pages')) || !(await tableExists('blog_feed_filters'))) {
    return [];
  }

  const uniqueIds = [];
  const seen = new Set();
  for (const raw of Array.isArray(filterIds) ? filterIds : []) {
    const fid = parseInt(raw, 10);
    if (!fid || Number.isNaN(fid) || seen.has(fid)) continue;
    seen.add(fid);
    uniqueIds.push(fid);
  }

  if (uniqueIds.length) {
    const { rows: valid } = await db.getQuery()(
      `SELECT id FROM blog_feed_filters WHERE id = ANY($1::int[])`,
      [uniqueIds]
    );
    const validSet = new Set(valid.map((r) => r.id));
    const invalid = uniqueIds.filter((x) => !validSet.has(x));
    if (invalid.length) {
      const err = new Error(`Неизвестные фильтры: ${invalid.join(', ')}`);
      err.status = 400;
      throw err;
    }
  }

  const pool = db.getPool();
  if (!pool) {
    const err = new Error('База данных недоступна');
    err.status = 503;
    throw err;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM blog_feed_filter_pages WHERE page_id = $1`, [id]);
    for (let i = 0; i < uniqueIds.length; i += 1) {
      const fid = uniqueIds[i];
      const { rows: maxPos } = await client.query(
        `SELECT COALESCE(MAX(position), -1) AS m FROM blog_feed_filter_pages WHERE filter_id = $1`,
        [fid]
      );
      const position = Number(maxPos[0]?.m ?? -1) + 1;
      await client.query(
        `INSERT INTO blog_feed_filter_pages (filter_id, page_id, position)
         VALUES ($1, $2, $3)
         ON CONFLICT (filter_id, page_id) DO UPDATE SET position = EXCLUDED.position`,
        [fid, id, position]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
  return getPageFilterIds(id);
}

async function listActiveFilters() {
  if (!(await tableExists('blog_feed_filters'))) {
    return DEFAULT_FILTERS.map((f, i) => normalizeFilter(f, i));
  }
  const { rows } = await db.getQuery()(
    `SELECT id, slug, label_ru, label_en, sort_by, is_default, is_active, position
     FROM blog_feed_filters
     WHERE is_active = TRUE
     ORDER BY position ASC, id ASC`
  );
  if (!rows.length) {
    return DEFAULT_FILTERS.map((f, i) => normalizeFilter(f, i));
  }
  return ensureSingleDefault(rows.map((r, i) => normalizeFilter(r, i)));
}

async function getFilterBySlug(slug) {
  const filters = await listActiveFilters();
  if (!slug) {
    return filters.find((f) => f.is_default) || filters[0] || null;
  }
  return filters.find((f) => f.slug === slug) || filters.find((f) => f.is_default) || filters[0] || null;
}

async function getFeedSettings() {
  let filters = DEFAULT_FILTERS.map((f, i) => normalizeFilter(f, i));
  let pins = [];

  if (await tableExists('blog_feed_filters')) {
    const { rows } = await db.getQuery()(
      `SELECT id, slug, label_ru, label_en, sort_by, is_default, is_active, position
       FROM blog_feed_filters
       ORDER BY position ASC, id ASC`
    );
    if (rows.length) {
      filters = ensureSingleDefault(rows.map((r, i) => normalizeFilter(r, i)));
    }
  }

  const pagesMap = await getFilterPagesMap();
  filters = filters.map((f) => ({
    ...f,
    page_ids: f.id != null ? (pagesMap.get(f.id) || []) : [],
  }));

  if (await tableExists('blog_pinned_pages')) {
    const { rows } = await db.getQuery()(
      `SELECT p.id, p.page_id, p.position,
              ap.slug, ap.title, ap.show_in_blog, ap.status, ap.visibility
       FROM blog_pinned_pages p
       LEFT JOIN admin_pages_simple ap ON ap.id = p.page_id
       ORDER BY p.position ASC, p.id ASC`
    );
    pins = rows.map((r, i) => ({
      id: r.id,
      page_id: r.page_id,
      position: r.position ?? i,
      slug: r.slug || null,
      title: r.title || `#${r.page_id}`,
      available: Boolean(r.show_in_blog && r.status === 'published' && r.visibility === 'public'),
    }));
  }

  return { filters, pins, sort_by_options: SORT_BY_OPTIONS };
}

async function saveFeedSettings({ filters = [], pins = [] } = {}) {
  if (!(await tableExists('blog_feed_filters')) || !(await tableExists('blog_pinned_pages'))) {
    const err = new Error('Таблицы настроек ленты ещё не созданы. Выполните миграции.');
    err.status = 503;
    throw err;
  }

  const incoming = Array.isArray(filters) ? filters : [];
  for (const f of incoming) {
    const hasLabel = String(f?.label_ru || '').trim() || String(f?.label_en || '').trim();
    if (!hasLabel) {
      const err = new Error('У каждого фильтра должно быть название (RU или EN)');
      err.status = 400;
      throw err;
    }
  }

  const normalizedFilters = ensureSingleDefault(
    incoming.map((f, i) => normalizeFilter(f, i))
  );

  if (!normalizedFilters.length) {
    const err = new Error('Нужен хотя бы один фильтр');
    err.status = 400;
    throw err;
  }

  const slugs = new Set();
  for (const f of normalizedFilters) {
    let slug = f.slug;
    let n = 2;
    while (slugs.has(slug)) {
      slug = `${f.slug}-${n}`.slice(0, 64);
      n += 1;
    }
    f.slug = slug;
    slugs.add(slug);
  }

  const allPageIds = new Set();
  for (const f of normalizedFilters) {
    for (const pid of f.page_ids) allPageIds.add(pid);
  }

  const pinPageIds = [];
  const seenPins = new Set();
  for (const pin of Array.isArray(pins) ? pins : []) {
    const pageId = parseInt(pin.page_id, 10);
    if (!pageId || Number.isNaN(pageId) || seenPins.has(pageId)) continue;
    seenPins.add(pageId);
    pinPageIds.push(pageId);
    allPageIds.add(pageId);
  }

  if (allPageIds.size) {
    const ids = [...allPageIds];
    const { rows: validPages } = await db.getQuery()(
      `SELECT id FROM admin_pages_simple
       WHERE id = ANY($1::int[])
         AND show_in_blog = TRUE
         AND status = 'published'
         AND visibility = 'public'`,
      [ids]
    );
    const validSet = new Set(validPages.map((r) => r.id));
    const invalid = ids.filter((id) => !validSet.has(id));
    if (invalid.length) {
      const err = new Error(
        `В подборку/закреп можно брать только опубликованные статьи блога. Нельзя: ${invalid.join(', ')}`
      );
      err.status = 400;
      throw err;
    }
  }

  const pool = db.getPool();
  if (!pool) {
    const err = new Error('База данных недоступна');
    err.status = 503;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM blog_feed_filters');
    for (let i = 0; i < normalizedFilters.length; i += 1) {
      const f = normalizedFilters[i];
      const { rows: inserted } = await client.query(
        `INSERT INTO blog_feed_filters
          (slug, label_ru, label_en, sort_by, is_default, is_active, position, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING id`,
        [f.slug, f.label_ru, f.label_en, f.sort_by, f.is_default, f.is_active, i]
      );
      const filterId = inserted[0]?.id;
      if (filterId && (await tableExists('blog_feed_filter_pages'))) {
        for (let j = 0; j < f.page_ids.length; j += 1) {
          await client.query(
            `INSERT INTO blog_feed_filter_pages (filter_id, page_id, position)
             VALUES ($1, $2, $3)
             ON CONFLICT (filter_id, page_id) DO UPDATE SET position = EXCLUDED.position`,
            [filterId, f.page_ids[j], j]
          );
        }
      }
    }

    await client.query('DELETE FROM blog_pinned_pages');
    for (let i = 0; i < pinPageIds.length; i += 1) {
      await client.query(
        `INSERT INTO blog_pinned_pages (page_id, position) VALUES ($1, $2)`,
        [pinPageIds[i], i]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }

  return getFeedSettings();
}

/**
 * Ограничить список страниц ленты подборкой фильтра (если задана).
 */
function applyFilterPageRestriction(pages, pageIds) {
  if (!pageIds || !pageIds.length) return pages;
  const allow = new Set(pageIds);
  return pages.filter((p) => allow.has(p.id));
}

module.exports = {
  SORT_BY_OPTIONS,
  DEFAULT_FILTERS,
  PRIVACY_BLOG_FILTER_SLUG,
  listActiveFilters,
  getFilterBySlug,
  getFeedSettings,
  saveFeedSettings,
  getPinnedMap,
  sortFeedPages,
  getFilterPageIds,
  getPageFilterIds,
  setPageFilterIds,
  applyFilterPageRestriction,
  ensurePrivacyBlogFilter,
  detachPrivacyFromBlog,
};
