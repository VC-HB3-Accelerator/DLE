'use strict';

const fs = require('fs');
const path = require('path');
const { auditDescription } = require('./listing-b-mass/listing-description-quality');

const CSV_PATH = process.env.SKU_CSV || path.join(__dirname, '..', '..', 'data', 'sku-catalog-2026.csv');

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
  return rows.map((cells) => Object.fromEntries(header.map((key, idx) => [key, cells[idx] || ''])));
}

const items = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
const strict = process.env.AUDIT_STRICT === '1';
const bad = items.filter((i) => {
  const issues = auditDescription(i);
  if (!issues.length) return false;
  if (strict) {
    return issues.some((x) => x !== 'thin_description' && x !== 'weak_type_lead');
  }
  return true;
});
const byIssue = {};
for (const item of bad) {
  for (const issue of auditDescription(item)) {
    byIssue[issue] = (byIssue[issue] || 0) + 1;
  }
}
console.log(JSON.stringify({
  total: items.length,
  withIssues: bad.length,
  byIssue,
  sample: bad.slice(0, 30).map((i) => ({
    title: i.title,
    description: (i.description || '').slice(0, 120),
    issues: auditDescription(i),
    source_url: i.source_url,
  })),
}, null, 2));
