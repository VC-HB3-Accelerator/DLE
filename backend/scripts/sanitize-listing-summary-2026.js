'use strict';

/**
 * Чистка summary/description в CSV и в admin_pages_simple (category 2026).
 *
 *   APPLY=0 node scripts/sanitize-listing-summary-2026.js
 *   APPLY=1 node scripts/sanitize-listing-summary-2026.js
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { sanitizeListingSummary } = require('./listing-b-mass/sanitize-listing-summary');

const CATEGORY = '2026';
const CSV_PATH = process.env.SKU_CSV || path.join(__dirname, '..', '..', 'data', 'sku-catalog-2026.csv');
// В контейнере CSV с хоста: SKU_CSV=/host-project/data/sku-catalog-2026.csv
const APPLY = process.env.APPLY === '1';

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
    const title = (item.title || '').trim();
    const before = (item.description || '').trim();
    const after = sanitizeListingSummary(before, title);
    if (after !== before) {
      changed += 1;
      if (samples.length < 8) {
        samples.push({ title, before, after });
      }
      item.description = after;
    }
  }
  if (APPLY && changed) {
    fs.writeFileSync(CSV_PATH, writeCsv(header, items), 'utf8');
  }
  return { rows: items.length, changed, samples };
}

async function patchDb() {
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
    const after = sanitizeListingSummary(before, title);
    if (after === before) continue;
    changed += 1;
    if (samples.length < 8) {
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
  const csv = patchCsv();
  const dbResult = await patchDb();
  console.log(JSON.stringify({
    apply: APPLY,
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
