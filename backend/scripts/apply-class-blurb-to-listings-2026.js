'use strict';

/**
 * Добавляет в description блок hub-класса: «; — Класс — {blurb}».
 *
 *   APPLY=1 node scripts/apply-class-blurb-to-listings-2026.js
 */
const fs = require('fs');
const path = require('path');
const { enrichListingDescription } = require('./listing-b-mass/build-listing-description');
const {
  appendClassBlurb,
  stripClassBlurb,
  pickPrimaryClass,
  renderBlurbTemplate,
} = require('./listing-b-mass/class-blurb');

const SKU_CSV = process.env.SKU_CSV || path.join(__dirname, '..', '..', 'data', 'sku-catalog-2026.csv');
const CLASS_CSV = process.env.CLASS_CSV || path.join(__dirname, '..', '..', 'data', 'listing-equipment-class-specs-2026.csv');
const APPLY = process.env.APPLY === '1';

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

function main() {
  const skuFile = parseCsv(fs.readFileSync(SKU_CSV, 'utf8'));
  const classFile = parseCsv(fs.readFileSync(CLASS_CSV, 'utf8'));
  let changed = 0;
  let noClass = 0;
  const samples = [];

  for (const item of skuFile.items) {
    const primary = pickPrimaryClass(item, classFile.items);
    if (!primary || !primary.blurb_ru_template) {
      noClass += 1;
      continue;
    }
    const blurb = renderBlurbTemplate(primary.blurb_ru_template, primary);
    const before = String(item.description || '').trim();
    const modelPart = enrichListingDescription({ ...item, description: stripClassBlurb(before) });
    const after = appendClassBlurb(modelPart, blurb);
    if (after === before) continue;
    item.description = after;
    changed += 1;
    if (samples.length < 10) {
      samples.push({
        title: item.title,
        class_id: primary.class_id,
        after: after.slice(0, 160),
      });
    }
  }

  if (APPLY && changed) {
    fs.writeFileSync(SKU_CSV, writeCsv(skuFile.header, skuFile.items), 'utf8');
  }

  console.log(
    JSON.stringify(
      {
        apply: APPLY,
        rows: skuFile.items.length,
        changed,
        noClass,
        samples,
      },
      null,
      2,
    ),
  );
}

main();
