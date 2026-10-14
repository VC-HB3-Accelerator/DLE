'use strict';

const fs = require('fs');
const path = require('path');
const { enrichListingDescription } = require('./listing-b-mass/build-listing-description');
const { resolveChetraUrl, extractChetraFromHtml } = require('./listing-b-mass/extract-chetra-specs');

const CSV_PATH = process.env.SKU_CSV || path.join(__dirname, '..', '..', 'data', 'sku-catalog-2026.csv');
const APPLY = process.env.APPLY === '1';
const DELAY_MS = Number(process.env.DELAY_MS || 300);

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

async function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const { header, items } = parseCsv(raw);
  let changed = 0;
  const samples = [];
  for (const item of items) {
    if (item.brand !== 'ЧЕТРА') continue;
    const url = resolveChetraUrl(item.model, item.source_url);
    try {
      const html = await fetch(url, { signal: AbortSignal.timeout(30000) }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      });
      const { segments } = extractChetraFromHtml(html, item.brand, item.model, url);
      if (!segments.length) continue;
      const after = enrichListingDescription({ ...item, description: segments.join('; ') });
      const before = (item.description || '').trim();
      if (after === before) continue;
      changed += 1;
      if (samples.length < 8) samples.push({ title: item.title, before, after, url });
      if (APPLY) {
        item.description = after;
        item.source_url = url;
        item.source_kind = 'official';
      }
    } catch (e) {
      if (samples.length < 12) samples.push({ title: item.title, error: String(e.message), url });
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  if (APPLY && changed) fs.writeFileSync(CSV_PATH, writeCsv(header, items), 'utf8');
  console.log(JSON.stringify({ apply: APPLY, changed, samples }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
