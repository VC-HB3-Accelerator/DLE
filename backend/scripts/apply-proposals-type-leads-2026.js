'use strict';

/**
 * Подставляет proposed_type_lead из listing-unassigned-class-proposals-2026.csv
 * в description sku-catalog-2026.csv (первый сегмент после «—»), затем enrichListingDescription.
 *
 *   node scripts/apply-proposals-type-leads-2026.js
 *   APPLY=1 node scripts/apply-proposals-type-leads-2026.js
 */
const fs = require('fs');
const path = require('path');
const {
  enrichListingDescription,
  parseTitleParts,
} = require('./listing-b-mass/build-listing-description');

const SKU_CSV = process.env.SKU_CSV || path.join(__dirname, '..', '..', 'data', 'sku-catalog-2026.csv');
const PROPOSALS_CSV =
  process.env.PROPOSALS_CSV ||
  path.join(__dirname, '..', '..', 'data', 'listing-unassigned-class-proposals-2026.csv');
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

function shouldApplyProposal(row) {
  if (row.proposed_class_id === 'NEEDS_REVIEW') return false;
  const type = String(row.proposed_type_lead || '').trim();
  if (!type || type.startsWith('уточнить')) return false;
  return true;
}

/** Меняет тип в лиде, сохраняя хвост ТТХ после первой «;». */
function setDescriptionTypeLead(item, newType) {
  const { brand, model, title } = parseTitleParts(item.title, item.brand, item.model);
  const leadName = `${brand} ${model}`.replace(/\s+/g, ' ').trim();
  const newTypeClean = String(newType || '').replace(/\s+/g, ' ').trim();
  const raw = String(item.description || '').trim();

  const m = raw.match(/^(.+?[—–-]\s*)([^;]+)(.*)$/s);
  if (m) {
    const tail = m[3] || '';
    if (tail.startsWith(';')) {
      item.description = `${leadName} — ${newTypeClean}${tail}`.trim();
    } else if (tail.trim()) {
      item.description = `${leadName} — ${newTypeClean}; ${tail.trim().replace(/^;\s*/, '')}`.trim();
    } else {
      item.description = `${leadName} — ${newTypeClean}`.trim();
    }
    return;
  }

  if (raw) {
    item.description = `${leadName} — ${newTypeClean}; ${raw}`.trim();
  } else {
    item.description = `${leadName} — ${newTypeClean}`.trim();
  }
}

function main() {
  const proposals = parseCsv(fs.readFileSync(PROPOSALS_CSV, 'utf8')).items;
  const skuFile = parseCsv(fs.readFileSync(SKU_CSV, 'utf8'));
  const byTitle = new Map();
  for (const p of proposals) {
    if (!shouldApplyProposal(p)) continue;
    byTitle.set(String(p.title || '').trim(), String(p.proposed_type_lead || '').trim());
  }

  let matched = 0;
  let changed = 0;
  const samples = [];

  for (const item of skuFile.items) {
    const title = String(item.title || '').trim();
    const newType = byTitle.get(title);
    if (!newType) continue;
    matched += 1;
    const before = String(item.description || '').trim();
    setDescriptionTypeLead(item, newType);
    const afterLead = enrichListingDescription(item);
    if (afterLead !== before) {
      item.description = afterLead;
      changed += 1;
      if (samples.length < 15) {
        samples.push({ title, before: before.slice(0, 120), after: afterLead.slice(0, 120) });
      }
    }
  }

  if (APPLY && changed) {
    fs.writeFileSync(SKU_CSV, writeCsv(skuFile.header, skuFile.items), 'utf8');
  }

  console.log(
    JSON.stringify(
      {
        apply: APPLY,
        proposalsApplicable: byTitle.size,
        skuMatched: matched,
        descriptionsChanged: changed,
        skippedNeedsReview: proposals.filter((p) => p.proposed_class_id === 'NEEDS_REVIEW').length,
        samples,
      },
      null,
      2,
    ),
  );
}

main();
