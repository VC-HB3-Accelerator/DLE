'use strict';

/**
 * Копирует description из CSV в summary/content/seo без пересборки (сохраняет blurb класса).
 *
 *   APPLY=1 node scripts/sync-sku-descriptions-to-db-2026.js
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');

const CATEGORY = '2026';
const CSV_PATH = process.env.SKU_CSV || path.join(__dirname, '..', '..', 'data', 'sku-catalog-2026.csv');
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
  const items = rows.map((cells) => {
    const item = {};
    header.forEach((key, idx) => {
      item[key] = cells[idx] || '';
    });
    return item;
  });
  return { items };
}

async function main() {
  const { items } = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
  const byTitle = new Map();
  for (const item of items) {
    const title = (item.title || '').trim();
    if (title) byTitle.set(title, String(item.description || '').trim());
  }

  const { rows } = await db.getQuery()(
    `SELECT id, title, summary FROM admin_pages_simple WHERE category = $1`,
    [CATEGORY],
  );
  let changed = 0;
  const samples = [];

  for (const row of rows) {
    const title = String(row.title || '').trim();
    const after = byTitle.get(title);
    if (!after) continue;
    const before = String(row.summary || '').trim();
    if (after === before) continue;
    changed += 1;
    if (samples.length < 8) samples.push({ title, before: before.slice(0, 80), after: after.slice(0, 80) });
    if (!APPLY) continue;
    const content = `<p>${esc(after)}</p>`;
    await db.getQuery()(
      `UPDATE admin_pages_simple
       SET summary = $2,
           content = $3,
           seo = jsonb_set(COALESCE(seo, '{}'::jsonb), '{description}', to_jsonb($2::text), true),
           updated_at = NOW()
       WHERE id = $1`,
      [row.id, after, content],
    );
  }

  console.log(JSON.stringify({ apply: APPLY, pages: rows.length, changed, samples }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
