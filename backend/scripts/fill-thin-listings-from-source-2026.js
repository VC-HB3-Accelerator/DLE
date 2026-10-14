'use strict';

/**
 * Для карточек без ТТХ после типа — meta description / og:description с official URL.
 *
 *   APPLY=1 node scripts/fill-thin-listings-from-source-2026.js
 *   LIMIT=50 APPLY=1 ...
 */
const fs = require('fs');
const path = require('path');
const { enrichListingDescription } = require('./listing-b-mass/build-listing-description');
const { mergeSpecSegments } = require('./listing-b-mass/extract-maz-rus-specs');

const SKU_CSV = process.env.SKU_CSV || path.join(__dirname, '..', '..', 'data', 'sku-catalog-2026.csv');
const APPLY = process.env.APPLY === '1';
const LIMIT = Number(process.env.LIMIT || 0) || Infinity;
const DELAY_MS = Number(process.env.DELAY_MS || 400);
const SPEC_RE = /л\.?\s*с|квт|×|\d{3,}\s*кг|полная масса|грузоподъ|gcw|gvw|мм|м³|об\/мин/i;

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

function isThin(item) {
  const d = String(item.description || '');
  if (!d.includes('—')) return false;
  const afterLead = d.replace(/^[^—]+—\s*[^;]+;?\s*/, '').trim();
  if (!afterLead) return true;
  return !SPEC_RE.test(afterLead);
}

function extractMetaSegments(html) {
  const pick = (re) => {
    const m = html.match(re);
    return m ? m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim() : '';
  };
  const text =
    pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    pick(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i) ||
    pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
    pick(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  if (!text || text.length < 12) return [];
  const parts = text
    .split(/[.;|/]\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 8 && SPEC_RE.test(p));
  return parts.slice(0, 4);
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; B2B4ThinListingFill/1.0)' },
    redirect: 'follow',
    signal: AbortSignal.timeout(28000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { header, items } = parseCsv(fs.readFileSync(SKU_CSV, 'utf8'));
  let processed = 0;
  let changed = 0;
  let failed = 0;
  let skipped = 0;
  const samples = [];

  for (const item of items) {
    if (processed >= LIMIT) break;
    if (!isThin(item)) {
      skipped += 1;
      continue;
    }
    const url = String(item.source_url || '').trim();
    if (!url.startsWith('http')) {
      skipped += 1;
      continue;
    }

    processed += 1;
    const before = String(item.description || '').trim();
    try {
      const html = await fetchHtml(url);
      const segments = extractMetaSegments(html);
      if (!segments.length) {
        failed += 1;
        continue;
      }
      const merged = mergeSpecSegments(before, segments);
      const after = enrichListingDescription({ ...item, description: merged });
      if (after === before) continue;
      changed += 1;
      if (samples.length < 15) samples.push({ title: item.title, before, after: after.slice(0, 140), url });
      if (APPLY) item.description = after;
    } catch (e) {
      failed += 1;
      if (samples.length < 15) {
        samples.push({ title: item.title, error: String(e.message || e).slice(0, 80), url });
      }
    }
    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  if (APPLY && changed) {
    fs.writeFileSync(SKU_CSV, writeCsv(header, items), 'utf8');
  }

  console.log(
    JSON.stringify(
      { apply: APPLY, processed, changed, failed, skipped, samples },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
