/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Legal document packs by jurisdiction (TZ_LEGAL_PACK_CONSTRUCTOR).
 */

const fs = require('fs');
const path = require('path');
const db = require('../db');

const PACKS_ROOT = path.join(__dirname, '..', 'legal-packs');

function isSkeletonContent(content) {
  const s = String(content || '');
  if (!s.trim()) return true;
  return /\{\{\s*[a-z0-9_]+\s*\}\}/i.test(s);
}

function htmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateSlug(text, maxLength = 100) {
  if (!text) return `doc-${Date.now()}`;
  const map = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo',
    ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
    н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
    ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  return String(text)
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[а-яё]/g, (ch) => map[ch] || ch)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, maxLength)
    .replace(/-+$/, '') || `doc-${Date.now()}`;
}

function listPackDirs() {
  if (!fs.existsSync(PACKS_ROOT)) return [];
  return fs.readdirSync(PACKS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function readPackJson(packId) {
  const file = path.join(PACKS_ROOT, packId, 'pack.json');
  if (!fs.existsSync(file)) {
    const err = new Error(`Pack not found: ${packId}`);
    err.status = 404;
    throw err;
  }
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw);
}

function listPacks() {
  return listPackDirs().map((id) => {
    const p = readPackJson(id);
    return {
      packId: p.packId || id,
      jurisdiction: String(p.jurisdiction || ''),
      fallback: p.fallback === true || String(p.jurisdiction || '') === '*',
      locale: p.locale || 'ru',
      title: p.title || id,
      version: p.version || '1.0.0',
      documentsCount: Array.isArray(p.documents) ? p.documents.length : 0,
    };
  });
}

function getPackByJurisdiction(numeric) {
  const code = String(numeric || '').trim();
  const packs = listPacks();
  const exact = packs.find((p) => p.jurisdiction === code && !p.fallback);
  if (exact) return getPackManifest(exact.packId);
  // РФ всегда только ru-пакет; прочие страны → нейтральный international fallback
  if (code && code !== '643') {
    const fallback = packs.find((p) => p.fallback);
    if (fallback) return getPackManifest(fallback.packId);
  }
  const err = new Error(`No legal pack for jurisdiction ${code}`);
  err.status = 404;
  throw err;
}

function getPackManifest(packId) {
  const p = readPackJson(packId);
  return {
    packId: p.packId || packId,
    jurisdiction: String(p.jurisdiction || ''),
    fallback: p.fallback === true || String(p.jurisdiction || '') === '*',
    locale: p.locale || 'ru',
    title: p.title || packId,
    version: p.version || '1.0.0',
    publishedSection: 'политика и согласия',
    variables: Array.isArray(p.variables)
      ? p.variables.map((v) => ({
          key: v.key,
          label_ru: v.label_ru || v.key,
          label_en: v.label_en || v.label_ru || v.key,
          required: v.required === true,
          default: v.default,
          form: v.form !== false,
        }))
      : [],
    documents: (Array.isArray(p.documents) ? p.documents : []).map((d) => ({
      id: d.id,
      title: d.title,
      summary: d.summary || d.title,
      visibility: d.visibility,
      category: d.category || null,
      order_index: d.order_index || 0,
      required: d.required !== false,
      required_permission: d.required_permission || null,
      show_in_blog: d.show_in_blog === true,
      file: d.file,
    })),
  };
}

function shortenFio(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  const surname = parts[0];
  const initials = parts.slice(1).map((p) => `${p.charAt(0).toUpperCase()}.`).join('');
  return `${surname} ${initials}`.trim();
}

function normalizeVariables(raw, pack) {
  const vars = { ...(raw || {}) };
  const aliases = {
    responsible: 'responsible_person',
    responsible_name: 'responsible_person',
    email: 'privacy_email',
    phone: 'privacy_phone',
    address: 'company_address',
    legal_address: 'company_address',
    website: 'site',
  };
  for (const [from, to] of Object.entries(aliases)) {
    if (vars[to] == null && vars[from] != null) vars[to] = vars[from];
  }

  for (const def of pack.variables || []) {
    if ((vars[def.key] == null || String(vars[def.key]).trim() === '') && def.default != null) {
      vars[def.key] = def.default;
    }
  }

  // site → единый источник: host/idn всегда из URL
  if (vars.site && String(vars.site).trim()) {
    const rawSite = String(vars.site).trim();
    const rawHost = rawSite.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split('/')[0].split('?')[0];
    try {
      const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(rawSite) ? rawSite : `https://${rawSite}`);
      const displayHost = /[^\x00-\x7F]/.test(rawHost) ? rawHost : u.host;
      // в документах предпочитаем читаемый unicode-домен, не punycode
      vars.site = `${u.protocol}//${displayHost}${u.pathname === '/' ? '' : u.pathname}`.replace(/\/$/, '');
      vars.site_host = displayHost;
      vars.site_idn = displayHost;
    } catch {
      vars.site_host = rawHost || String(vars.site).replace(/^https?:\/\//, '').split('/')[0];
      if (!vars.site_idn) vars.site_idn = vars.site_host;
    }
  } else if ((!vars.site_host || !String(vars.site_host).trim()) && vars.site) {
    vars.site_host = String(vars.site).replace(/^https?:\/\//, '').split('/')[0];
  }
  if ((!vars.site_idn || !String(vars.site_idn).trim()) && vars.site_host) {
    vars.site_idn = vars.site_host;
  }
  if (!vars.responsible_person_genitive && vars.responsible_person) {
    vars.responsible_person_genitive = vars.responsible_person;
  }
  if (!vars.responsible_person_short && vars.responsible_person) {
    vars.responsible_person_short = shortenFio(vars.responsible_person);
  }
  if (!vars.language) vars.language = pack.locale || 'ru';

  const missing = [];
  for (const def of pack.variables || []) {
    if (!def.required) continue;
    if (vars[def.key] == null || String(vars[def.key]).trim() === '') {
      missing.push(def.key);
    }
  }
  return { vars, missing };
}

function renderTemplate(html, variables) {
  let out = String(html);
  const leftover = new Set();
  out = out.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(variables, key) && variables[key] != null) {
      return htmlEscape(variables[key]);
    }
    leftover.add(key);
    return `{{${key}}}`;
  });
  return { html: out, leftover: [...leftover] };
}

function readDocHtml(packId, relativeFile) {
  const abs = path.normalize(path.join(PACKS_ROOT, packId, relativeFile));
  const root = path.normalize(path.join(PACKS_ROOT, packId));
  if (!abs.startsWith(root + path.sep)) {
    const err = new Error('Invalid template path');
    err.status = 400;
    throw err;
  }
  if (!fs.existsSync(abs)) {
    const err = new Error(`Template file missing: ${relativeFile}`);
    err.status = 500;
    throw err;
  }
  return fs.readFileSync(abs, 'utf8');
}

async function uniqueSlug(tableName, baseSlug, excludeId = null) {
  let slug = baseSlug || `doc-${Date.now()}`;
  let n = 0;
  for (;;) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const params = excludeId != null ? [candidate, excludeId] : [candidate];
    const sql = excludeId != null
      ? `SELECT id FROM ${tableName} WHERE slug = $1 AND id <> $2 LIMIT 1`
      : `SELECT id FROM ${tableName} WHERE slug = $1 LIMIT 1`;
    const hit = await db.getQuery()(sql, params);
    if (hit.rows.length === 0) return candidate;
    n += 1;
    if (n > 50) return `${slug}-${Date.now()}`;
  }
}

async function findOperatorCopy(tableName, doc, packId) {
  const category = doc.category || '';
  const pack = packId ? String(packId) : null;
  const { rows } = await db.getQuery()(
    `SELECT id, slug, content, status, visibility, category, pack_id
     FROM ${tableName}
     WHERE title = $1
       AND visibility = $2
       AND LOWER(TRIM(COALESCE(category, ''))) = LOWER(TRIM($3))
       AND COALESCE(is_system_template, FALSE) = FALSE
       AND (
         ($4::text IS NOT NULL AND pack_id = $4)
         OR ($4::text IS NOT NULL AND pack_id IS NULL)
         OR ($4::text IS NULL AND pack_id IS NULL)
       )
     ORDER BY CASE WHEN pack_id IS NOT NULL THEN 0 ELSE 1 END
     LIMIT 1`,
    [doc.title, doc.visibility, category, pack]
  );
  return rows[0] || null;
}

async function upsertGeneratedDoc(tableName, doc, html, summary, mode, packId) {
  await ensurePackIdColumn(tableName);
  const existing = await findOperatorCopy(tableName, doc, packId);

  if (mode === 'missing_only' && existing) {
    if (existing.status === 'published' && !isSkeletonContent(existing.content)) {
      return { action: 'skipped', pageId: existing.id, reason: 'already_filled' };
    }
  }

  const baseSlug = generateSlug(doc.title);
  const category = doc.category || null;
  const showInBlog = doc.show_in_blog === true;
  const requiredPermission = doc.visibility === 'internal'
    ? (doc.required_permission || 'view_legal_docs')
    : null;
  const pack = packId ? String(packId) : null;

  if (existing) {
    const slug = existing.slug && String(existing.slug).trim()
      ? existing.slug
      : await uniqueSlug(tableName, baseSlug, existing.id);
    await db.getQuery()(
      `UPDATE ${tableName}
       SET summary = $2, content = $3, seo = $4,
           status = 'published', visibility = $5,
           required_permission = $6, format = 'html', mime_type = 'text/html', storage_type = 'embedded',
           is_system_template = FALSE, show_in_blog = $7,
           category = $8, slug = $9, order_index = $10, pack_id = $11,
           updated_at = NOW()
       WHERE id = $1`,
      [
        existing.id,
        summary,
        html,
        JSON.stringify({ title: doc.title, description: summary }),
        doc.visibility,
        requiredPermission,
        showInBlog,
        category,
        slug,
        doc.order_index || 0,
        pack,
      ]
    );
    return { action: 'updated', pageId: existing.id };
  }

  const slug = await uniqueSlug(tableName, baseSlug);
  const ins = await db.getQuery()(
    `INSERT INTO ${tableName}
      (author_address, title, summary, content, seo, status, visibility, required_permission,
       format, mime_type, storage_type, is_system_template, show_in_blog, category, slug, order_index, pack_id)
     VALUES (NULL, $1, $2, $3, $4, 'published', $5, $6,
             'html', 'text/html', 'embedded', FALSE, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      doc.title,
      summary,
      html,
      JSON.stringify({ title: doc.title, description: summary }),
      doc.visibility,
      requiredPermission,
      showInBlog,
      category,
      slug,
      doc.order_index || 0,
      pack,
    ]
  );
  return { action: 'created', pageId: ins.rows[0].id };
}

async function generatePack(packId, { variables, documentIds, mode } = {}) {
  const pack = getPackManifest(packId);
  const full = readPackJson(packId);
  const { vars, missing } = normalizeVariables(variables, pack);
  if (missing.length) {
    const err = new Error(`Missing required variables: ${missing.join(', ')}`);
    err.status = 400;
    err.missing = missing;
    throw err;
  }

  const modeSafe = mode === 'overwrite_selected' ? 'overwrite_selected' : 'missing_only';
  const selected = Array.isArray(documentIds) && documentIds.length
    ? new Set(documentIds.map(String))
    : null;

  const tableName = 'admin_pages_simple';
  const results = [];

  for (const doc of full.documents || []) {
    if (selected && !selected.has(doc.id)) continue;
    try {
      const rawHtml = readDocHtml(packId, doc.file);
      const { html, leftover } = renderTemplate(rawHtml, vars);
      if (leftover.length) {
        results.push({
          id: doc.id,
          action: 'error',
          error: `Unreplaced placeholders: ${leftover.join(', ')}`,
        });
        continue;
      }
      const summary = String(doc.summary || doc.title || '').slice(0, 500);
      const res = await upsertGeneratedDoc(tableName, doc, html, summary, modeSafe, packId);
      results.push({ id: doc.id, title: doc.title, ...res });
    } catch (e) {
      results.push({ id: doc.id, action: 'error', error: e.message || String(e) });
    }
  }

  const result = {
    packId,
    mode: modeSafe,
    results,
    counts: {
      created: results.filter((r) => r.action === 'created').length,
      updated: results.filter((r) => r.action === 'updated').length,
      skipped: results.filter((r) => r.action === 'skipped').length,
      error: results.filter((r) => r.action === 'error').length,
    },
  };

  try {
    const blogFeedService = require('./blogFeedService');
    if (typeof blogFeedService.detachPrivacyFromBlog === 'function') {
      result.blogDetach = await blogFeedService.detachPrivacyFromBlog();
    }
  } catch (err) {
    console.warn('[legal-packs] detachPrivacyFromBlog:', err.message);
  }

  return result;
}

async function ensurePackIdColumn(tableName = 'admin_pages_simple') {
  await db.getQuery()(
    `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS pack_id TEXT`
  );
}

async function getActivePackPublic() {
  await ensureOperatorSettingsTable();
  const settings = await getOperatorSettings();
  let packId = settings.packId || '';
  if (!packId && settings.jurisdiction) {
    try {
      const pack = getPackByJurisdiction(settings.jurisdiction);
      packId = pack.packId;
    } catch {
      packId = '';
    }
  }
  let publishedSection = 'политика и согласия';
  let locale = 'ru';
  let title = '';
  if (packId) {
    try {
      const pack = getPackManifest(packId);
      publishedSection = pack.publishedSection || publishedSection;
      locale = pack.locale || locale;
      title = pack.title || '';
    } catch {
      /* ignore */
    }
  }
  return {
    packId,
    jurisdiction: settings.jurisdiction || '',
    locale,
    title,
    publishedSection,
  };
}

async function ensureOperatorSettingsTable() {
  await db.getQuery()(`
    CREATE TABLE IF NOT EXISTS legal_operator_settings (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      jurisdiction TEXT,
      pack_id TEXT,
      variables JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT
    )
  `);
  await db.getQuery()(`
    INSERT INTO legal_operator_settings (id, variables)
    VALUES (1, '{}'::jsonb)
    ON CONFLICT (id) DO NOTHING
  `);
}

async function getOperatorSettings() {
  await ensureOperatorSettingsTable();
  const { rows } = await db.getQuery()(
    `SELECT jurisdiction, pack_id, variables, updated_at, updated_by
     FROM legal_operator_settings WHERE id = 1 LIMIT 1`
  );
  const row = rows[0] || {};
  return {
    jurisdiction: row.jurisdiction || '',
    packId: row.pack_id || '',
    variables: row.variables && typeof row.variables === 'object' ? row.variables : {},
    updatedAt: row.updated_at || null,
    updatedBy: row.updated_by || null,
  };
}

async function saveOperatorSettings({ jurisdiction, packId, variables, updatedBy } = {}) {
  await ensureOperatorSettingsTable();
  const vars = variables && typeof variables === 'object' && !Array.isArray(variables)
    ? variables
    : {};
  const { rows } = await db.getQuery()(
    `INSERT INTO legal_operator_settings (id, jurisdiction, pack_id, variables, updated_at, updated_by)
     VALUES (1, $1, $2, $3::jsonb, NOW(), $4)
     ON CONFLICT (id) DO UPDATE SET
       jurisdiction = EXCLUDED.jurisdiction,
       pack_id = EXCLUDED.pack_id,
       variables = EXCLUDED.variables,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by
     RETURNING jurisdiction, pack_id, variables, updated_at, updated_by`,
    [
      jurisdiction ? String(jurisdiction) : null,
      packId ? String(packId) : null,
      JSON.stringify(vars),
      updatedBy ? String(updatedBy) : null,
    ]
  );
  const row = rows[0];
  return {
    jurisdiction: row.jurisdiction || '',
    packId: row.pack_id || '',
    variables: row.variables || {},
    updatedAt: row.updated_at || null,
    updatedBy: row.updated_by || null,
  };
}

module.exports = {
  PACKS_ROOT,
  listPacks,
  getPackManifest,
  getPackByJurisdiction,
  generatePack,
  getOperatorSettings,
  saveOperatorSettings,
  getActivePackPublic,
  isSkeletonContent,
  renderTemplate,
  normalizeVariables,
};
