'use strict';

/**
 * Исправляет явно слабый тип в лиде (только «л.с.», «спецтехника», «линейка…»).
 *
 *   APPLY=1 node scripts/fix-weak-type-leads-2026.js
 */
const fs = require('fs');
const path = require('path');
const {
  enrichListingDescription,
  parseTitleParts,
} = require('./listing-b-mass/build-listing-description');

const SKU_CSV = process.env.SKU_CSV || path.join(__dirname, '..', '..', 'data', 'sku-catalog-2026.csv');
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

function typeText(item) {
  const d = String(item.description || '');
  const m = d.match(/^[^—]+—\s*([^;]+)/i);
  return m ? m[1].trim() : '';
}

function setTypeLead(item, newType, oldLead) {
  const { brand, model } = parseTitleParts(item.title, item.brand, item.model);
  const leadName = `${brand} ${model}`.replace(/\s+/g, ' ').trim();
  const raw = String(item.description || '').trim();
  const m = raw.match(/^(.+?[—–-]\s*)([^;]+)(.*)$/s);
  let tail = m ? m[3] || '' : '';
  const typeClean = String(newType).trim();
  const old = String(oldLead || '').trim();
  if (!tail.trim() && old && isWeakLead(old) && /л\.?\s*с|квт|×|кг/i.test(old)) {
    tail = `; ${old}`;
  }
  if (tail.startsWith(';')) {
    item.description = `${leadName} — ${typeClean}${tail}`.trim();
  } else if (tail.trim()) {
    item.description = `${leadName} — ${typeClean}; ${tail.trim().replace(/^;\s*/, '')}`.trim();
  } else {
    item.description = `${leadName} — ${typeClean}`.trim();
  }
}

const WEAK_RES = [
  /^[\d,.]+\s*–\s*[\d,.]+\s*л\.?\s*с\.?$/i,
  /^DE\d/i,
  /^спецтехника$/i,
  /^линейка /i,
];

function suggestType(item) {
  const title = String(item.title || '');
  const brand = String(item.brand || '');
  const lead = typeText(item);

  if (/Scania · R-серия/i.test(title)) return 'седельный тягач';
  if (/Scania · S-серия/i.test(title)) return 'седельный тягач';
  if (/Renault Trucks · T High/i.test(title)) return 'седельный тягач';
  if (brand === 'МТЗ' && /СЕРИЯ/i.test(item.model || '')) return 'трактор';
  if (brand === 'Cummins' && /ДГУ/i.test(title)) return 'дизель-генератор';
  if (brand === 'Амкодор' && lead === 'спецтехника') return null;
  return null;
}

function isWeakLead(lead) {
  if (!lead) return true;
  return WEAK_RES.some((re) => re.test(lead.trim()));
}

function main() {
  const skuFile = parseCsv(fs.readFileSync(SKU_CSV, 'utf8'));
  let changed = 0;
  const samples = [];

  for (const item of skuFile.items) {
    const lead = typeText(item);
    if (!isWeakLead(lead)) continue;
    const newType = suggestType(item);
    if (!newType) continue;
    const before = String(item.description || '').trim();
    setTypeLead(item, newType, lead);
    const after = enrichListingDescription(item);
    if (after === before) continue;
    item.description = after;
    changed += 1;
    if (samples.length < 12) samples.push({ title: item.title, before, after });
  }

  if (APPLY && changed) {
    fs.writeFileSync(SKU_CSV, writeCsv(skuFile.header, skuFile.items), 'utf8');
  }

  console.log(JSON.stringify({ apply: APPLY, changed, samples }, null, 2));
}

main();
