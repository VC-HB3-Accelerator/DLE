'use strict';

/**
 * Подтягивает ТТХ с официальных source_url (maz-rus.com) в CSV и БД.
 *
 *   APPLY=0 LIMIT=20 node scripts/fill-listing-specs-from-source-2026.js
 *   APPLY=1 node scripts/fill-listing-specs-from-source-2026.js
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { enrichListingDescription } = require('./listing-b-mass/build-listing-description');
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
const DELAY_MS = Number(process.env.DELAY_MS || 400);
const HOST_FILTER = (process.env.HOST_FILTER || 'maz-rus.com').trim();

const SPEC_RE = /л\.?\s*с|квт|×|\d{3,}\s*кг|полная масса|грузоподъ|gcw|gvw/i;

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

function needsSpecs(item) {
  const d = String(item.description || '');
  if (!SPEC_RE.test(d)) return true;
  const tail = d.replace(/^[^—]+—\s*[^;]+;?\s*/, '');
  return !SPEC_RE.test(tail) && /— (самосвал|шасси|бортовой|сортиментовоз|автомобиль)$/i.test(d.trim());
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; B2B4ListingSpecBot/1.0)' },
    redirect: 'follow',
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function patchCsvItems(items) {
  let processed = 0;
  let changed = 0;
  let failed = 0;
  const samples = [];

  for (const item of items) {
    if (processed >= LIMIT) break;
    const url = String(item.source_url || '').trim();
    if (!url.includes(HOST_FILTER)) continue;
    if (!needsSpecs(item)) continue;

    processed += 1;
    try {
      const html = await fetchHtml(url);
      const specs = extractMazRusSpecsFromHtml(html);
      const segments = mazSpecsToSegments(specs);
      if (!segments.length) {
        failed += 1;
        continue;
      }
      const merged = mergeSpecSegments(item.description, segments);
      const after = enrichListingDescription({ ...item, description: merged });
      const before = String(item.description || '').trim();
      if (after === before) continue;
      changed += 1;
      if (samples.length < 15) {
        samples.push({ title: item.title, before, after, url });
      }
      if (APPLY) item.description = after;
    } catch (e) {
      failed += 1;
      if (samples.length < 15) {
        samples.push({ title: item.title, error: String(e.message || e).slice(0, 80), url });
      }
    }
    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  return { processed, changed, failed, samples };
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
  const csvResult = await patchCsvItems(items);
  if (APPLY && csvResult.changed) {
    fs.writeFileSync(CSV_PATH, writeCsv(header, items), 'utf8');
  }
  let dbResult = { skipped: true };
  if (!SKIP_DB) {
    dbResult = await patchDb(items);
  }
  console.log(JSON.stringify({
    apply: APPLY,
    hostFilter: HOST_FILTER,
    csvPath: CSV_PATH,
    csv: csvResult,
    db: dbResult,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
