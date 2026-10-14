'use strict';

/**
 * Пересборка description только с официальных страниц (без выдумок).
 * Чинит плейсхолдеры и явные ошибки (ЧЕТРА T* и др.).
 *
 *   APPLY=0 LIMIT=50 node scripts/reconcile-listing-specs-from-source-2026.js
 *   APPLY=1 node scripts/reconcile-listing-specs-from-source-2026.js
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { enrichListingDescription } = require('./listing-b-mass/build-listing-description');
const { auditDescription, isPlaceholderDescription } = require('./listing-b-mass/listing-description-quality');
const { resolveChetraUrl, extractChetraFromHtml } = require('./listing-b-mass/extract-chetra-specs');
const {
  extractMazRusSpecsFromHtml,
  mazSpecsToSegments,
  mergeSpecSegments,
} = require('./listing-b-mass/extract-maz-rus-specs');

const CATEGORY = '2026';
const CSV_PATH = process.env.SKU_CSV || path.join(__dirname, '..', '..', 'data', 'sku-catalog-2026.csv');
const APPLY = process.env.APPLY === '1';
const SKIP_DB = process.env.SKIP_DB === '1';
const LIMIT = Number(process.env.LIMIT || 0) || Infinity;
const DELAY_MS = Number(process.env.DELAY_MS || 350);
const ONLY_BAD = process.env.ONLY_BAD !== '0';

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => cell !== '')) rows.push(row);
  }
  const header = rows.shift();
  if (!header) return { header: [], items: [] };
  const items = rows.map((cells) => {
    const item = {};
    header.forEach((key, idx) => {
      item[key] = cells[idx] || '';
    });
    return item;
  });
  return { header, items };
}

function csvEscapeField(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(header, items) {
  const lines = [header.map(csvEscapeField).join(',')];
  for (const item of items) {
    lines.push(header.map((key) => csvEscapeField(item[key] ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; B2B4ListingReconcile/1.0)' },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function needsReconcile(item) {
  const issues = auditDescription(item);
  if (issues.length) return true;
  if (ONLY_BAD) return false;
  return false;
}

async function extractFromOfficial(item, html, fetchUrl) {
  const brand = String(item.brand || '').trim();
  const host = (() => {
    try {
      return new URL(fetchUrl).hostname;
    } catch {
      return '';
    }
  })();

  if (host.includes('chetra.ru')) {
    const { segments } = extractChetraFromHtml(html, brand, item.model, fetchUrl);
    if (!segments.length) throw new Error('no chetra segments');
    const raw = segments.join('; ');
    return { raw, fetchUrl, source_kind: 'official' };
  }

  if (host.includes('maz-rus.com')) {
    const specs = extractMazRusSpecsFromHtml(html);
    const segments = mazSpecsToSegments(specs);
    if (!segments.length) throw new Error('no maz segments');
    const merged = mergeSpecSegments('', segments);
    return { raw: merged, fetchUrl, source_kind: 'official' };
  }

  throw new Error(`no extractor for ${host}`);
}

function resolveFetchUrl(item) {
  const brand = String(item.brand || '').trim();
  const url = String(item.source_url || '').trim();
  if (brand === 'ЧЕТРА') {
    return resolveChetraUrl(item.model, url);
  }
  return url;
}

async function reconcileItems(items) {
  let processed = 0;
  let changed = 0;
  let failed = 0;
  let skipped = 0;
  const samples = [];

  for (const item of items) {
    if (processed >= LIMIT) break;
    if (!needsReconcile(item)) {
      skipped += 1;
      continue;
    }

    const fetchUrl = resolveFetchUrl(item);
    if (!fetchUrl || fetchUrl.endsWith('/catalog/') && item.brand !== 'ЧЕТРА') {
      skipped += 1;
      continue;
    }

    processed += 1;
    const before = String(item.description || '').trim();

    try {
      const html = await fetchHtml(fetchUrl);
      const extracted = await extractFromOfficial(item, html, fetchUrl);
      const after = enrichListingDescription({
        ...item,
        description: extracted.raw,
      });
      if (after === before && fetchUrl === item.source_url) {
        continue;
      }
      changed += 1;
      if (samples.length < 20) {
        samples.push({
          title: item.title,
          issues: auditDescription(item),
          before,
          after,
          fetchUrl,
        });
      }
      if (APPLY) {
        item.description = after;
        if (extracted.fetchUrl && extracted.fetchUrl !== item.source_url) {
          item.source_url = extracted.fetchUrl;
        }
        item.source_kind = 'official';
      }
    } catch (e) {
      failed += 1;
      if (samples.length < 20) {
        samples.push({
          title: item.title,
          error: String(e.message || e).slice(0, 100),
          fetchUrl,
        });
      }
    }

    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  return { processed, changed, failed, skipped, samples };
}

async function patchDb(items) {
  const byTitle = new Map();
  for (const item of items) {
    const title = (item.title || '').trim();
    if (title) byTitle.set(title, enrichListingDescription(item));
  }
  const { rows } = await db.getQuery()(
    `SELECT id, title, summary FROM admin_pages_simple WHERE category = $1`,
    [CATEGORY],
  );
  let changed = 0;
  for (const row of rows) {
    const title = String(row.title || '').trim();
    const after = byTitle.get(title);
    if (!after || after === String(row.summary || '').trim()) continue;
    changed += 1;
    if (!APPLY) continue;
    const content = `<p>${esc(after)}</p>`;
    await db.getQuery()(
      `UPDATE admin_pages_simple
       SET summary = $2, content = $3,
           seo = jsonb_set(COALESCE(seo, '{}'::jsonb), '{description}', to_jsonb($2::text), true),
           updated_at = NOW()
       WHERE id = $1`,
      [row.id, after, content],
    );
  }
  return { pages: rows.length, changed };
}

async function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const { header, items } = parseCsv(raw);
  const result = await reconcileItems(items);
  if (APPLY && result.changed) {
    fs.writeFileSync(CSV_PATH, writeCsv(header, items), 'utf8');
  }
  let dbResult = { skipped: true };
  if (!SKIP_DB) {
    dbResult = await patchDb(items);
  }
  const auditFail = items.filter((i) => auditDescription(i).length > 0);
  console.log(JSON.stringify({
    apply: APPLY,
    onlyBad: ONLY_BAD,
    csvPath: CSV_PATH,
    reconcile: result,
    db: dbResult,
    remainingIssues: auditFail.length,
    remainingSample: auditFail.slice(0, 15).map((i) => ({
      title: i.title,
      description: (i.description || '').slice(0, 100),
      issues: auditDescription(i),
    })),
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
