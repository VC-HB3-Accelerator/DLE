'use strict';

/**
 * Обогащение description/summary для всех карточек 2026.
 *
 *   APPLY=0 node scripts/enrich-listing-descriptions-2026.js
 *   APPLY=1 node scripts/enrich-listing-descriptions-2026.js
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { enrichListingDescription } = require('./listing-b-mass/build-listing-description');

const CATEGORY = '2026';
const CSV_PATH = process.env.SKU_CSV || path.join(__dirname, '..', '..', 'data', 'sku-catalog-2026.csv');
const APPLY = process.env.APPLY === '1';
const SKIP_DB = process.env.SKIP_DB === '1';

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

function patchCsv() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const { header, items } = parseCsv(raw);
  if (!header.length) throw new Error('CSV header missing');
  let changed = 0;
  const samples = [];
  for (const item of items) {
    const before = (item.description || '').trim();
    const after = enrichListingDescription(item);
    if (after !== before) {
      changed += 1;
      if (samples.length < 12) {
        samples.push({ title: item.title, before, after });
      }
      item.description = after;
    }
  }
  if (APPLY && changed) {
    fs.writeFileSync(CSV_PATH, writeCsv(header, items), 'utf8');
  }
  return { rows: items.length, changed, samples };
}

async function patchDb(csvItems) {
  const byTitle = new Map();
  for (const item of csvItems) {
    const title = (item.title || '').trim();
    if (title) byTitle.set(title, enrichListingDescription(item));
  }

  const { rows } = await db.getQuery()(
    `SELECT id, title, summary, content, seo
     FROM admin_pages_simple
     WHERE category = $1`,
    [CATEGORY],
  );
  let changed = 0;
  const samples = [];
  for (const row of rows) {
    const title = String(row.title || '').trim();
    const before = String(row.summary || '').trim();
    const fromCsv = byTitle.get(title);
    const after = fromCsv != null ? fromCsv : enrichListingDescription({
      title,
      brand: '',
      model: '',
      description: before,
      segment: '',
    });
    if (after === before) continue;
    changed += 1;
    if (samples.length < 12) {
      samples.push({ id: row.id, title, before, after });
    }
    if (!APPLY) continue;
    const content = `<p>${esc(after)}</p>`;
    let seo = row.seo;
    if (seo && typeof seo === 'object') {
      seo = { ...seo, description: after };
    } else {
      try {
        seo = JSON.parse(seo || '{}');
      } catch {
        seo = {};
      }
      seo.description = after;
    }
    await db.getQuery()(
      `UPDATE admin_pages_simple
       SET summary = $2,
           content = $3,
           seo = $4::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [row.id, after, content, JSON.stringify(seo)],
    );
  }
  return { pages: rows.length, changed, samples };
}

async function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const { items } = parseCsv(raw);
  const csv = patchCsv();
  let dbResult = { skipped: true };
  if (!SKIP_DB) {
    dbResult = await patchDb(items);
  }
  console.log(JSON.stringify({
    apply: APPLY,
    skipDb: SKIP_DB,
    csvPath: CSV_PATH,
    csv,
    db: dbResult,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
