'use strict';

/**
 * Убрать слово «шасси» из CSV каталога и карточек БД (category 2026).
 *
 *   APPLY=1 node scripts/strip-shassi-word-2026.js
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');

function removeShassiWord(raw) {
  let s = String(raw || '');
  if (!/шасси/i.test(s)) return s;
  s = s.replace(/\s+на\s+шасси\s+/gi, ' ');
  s = s.replace(/—\s*шасси\s*;?\s*/gi, '— ');
  s = s.replace(/\bшасси\b/gi, '');
  s = s.replace(/\s{2,}/g, ' ');
  s = s.replace(/;\s*;/g, ';');
  s = s.replace(/—\s*—/g, '—');
  s = s.replace(/\s+;/g, ';');
  s = s.replace(/;\s+/g, '; ');
  return s.trim();
}

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
  const { header, items } = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
  const cols = ['model', 'title', 'description'];
  let changed = 0;
  const samples = [];
  for (const item of items) {
    let rowChanged = false;
    for (const col of cols) {
      const before = String(item[col] || '');
      const after = removeShassiWord(before);
      if (after !== before) {
        item[col] = after;
        rowChanged = true;
      }
    }
    if (rowChanged) {
      changed += 1;
      if (samples.length < 6) {
        samples.push({ title: item.title, model: item.model, description: item.description });
      }
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
    const titleBefore = String(row.title || '');
    const summaryBefore = String(row.summary || '');
    const titleAfter = removeShassiWord(titleBefore);
    const summaryAfter = removeShassiWord(summaryBefore);
    let contentAfter = String(row.content || '');
    if (/шасси/i.test(contentAfter)) {
      contentAfter = removeShassiWord(contentAfter.replace(/<[^>]+>/g, ' '));
      contentAfter = `<p>${esc(summaryAfter || titleAfter)}</p>`;
    }
    let seo = row.seo && typeof row.seo === 'object' ? { ...row.seo } : {};
    if (typeof row.seo === 'string') {
      try {
        seo = JSON.parse(row.seo);
      } catch {
        seo = {};
      }
    }
    const seoDescBefore = String(seo.description || '');
    const seoDescAfter = removeShassiWord(seoDescBefore);
    if (
      titleAfter === titleBefore
      && summaryAfter === summaryBefore
      && seoDescAfter === seoDescBefore
      && !/шасси/i.test(String(row.content || ''))
    ) {
      continue;
    }
    changed += 1;
    if (samples.length < 6) {
      samples.push({
        id: row.id,
        titleBefore,
        titleAfter,
        summaryBefore: summaryBefore.slice(0, 80),
        summaryAfter: summaryAfter.slice(0, 80),
      });
    }
    if (!APPLY) continue;
    seo.description = seoDescAfter || summaryAfter;
    await db.getQuery()(
      `UPDATE admin_pages_simple
       SET title = $2,
           summary = $3,
           content = $4,
           seo = $5::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [row.id, titleAfter, summaryAfter, contentAfter, JSON.stringify(seo)],
    );
  }
  return { pages: rows.length, changed, samples };
}

async function main() {
  const csv = patchCsv();
  const dbResult = await patchDb();
  console.log(JSON.stringify({ apply: APPLY, csvPath: CSV_PATH, csv, db: dbResult }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
