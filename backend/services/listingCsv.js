'use strict';

const path = require('path');
const fs = require('fs');

function loadCsvRuntime() {
  const candidates = [
    '/host-project/orchestrator/runtime/csv.js',
    path.join(__dirname, '../../orchestrator/runtime/csv.js'),
  ];
  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) throw new Error('orchestrator/runtime/csv.js not found');
  return require(file);
}

const { parseCsv, splitWebsites } = loadCsvRuntime();

const INJECTION_KEYS = /^(tools_allow|run_mode|spawn_role|agent_id|system|prompt)$/i;
const MODEL_TOKEN = /\b([A-ZА-Я]{2,}[A-ZА-Я0-9.\-]*|[A-Za-z][A-Za-z0-9.\-]{1,12})\s+(\d{2,5}[A-Za-z0-9.\-\/]*)\b/g;

function rowBrand(row) {
  return String(row.brand || row.марка || row.name || row.название || '').trim();
}

function rowModel(row) {
  return String(row.model || row.модель || '').trim();
}

function extractModelsFromComment(comment, fallbackBrand) {
  const text = String(comment || '');
  const out = [];
  const seen = new Set();
  let match;
  const re = new RegExp(MODEL_TOKEN.source, 'g');
  while ((match = re.exec(text))) {
    const model = `${match[1]} ${match[2]}`.trim();
    const key = model.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      brand: fallbackBrand || match[1],
      model: fallbackBrand ? model : match[2],
    });
  }
  return out;
}

function parseListingCsv(text) {
  const rows = parseCsv(text);
  const candidates = [];
  const seen = new Set();

  function push(brand, model, extra = {}) {
    const b = String(brand || '').trim();
    const m = String(model || '').trim();
    if (!b || !m) return;
    const key = `${b}::${m}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({
      brand: b,
      model: m,
      keep_target: Number(extra.keep_target) > 0
        ? Math.min(16, Number(extra.keep_target))
        : 8,
      websites: extra.websites || [],
      hints: extra.hints || [],
    });
  }

  for (const row of rows) {
    const websites = splitWebsites(row.website || row.websites || row.url || '');
    const hints = String(row.comment || row.hints || row.примечание || '').trim();
    const brand = rowBrand(row);
    const model = rowModel(row);
    if (brand && model) {
      push(brand, model, { websites, hints: hints ? [hints] : [] });
      continue;
    }
    const fromComment = extractModelsFromComment(hints, brand);
    if (fromComment.length) {
      for (const item of fromComment) {
        push(item.brand, item.model, { websites, hints: hints ? [hints] : [] });
      }
      continue;
    }
    if (brand && !model) {
      /* skip incomplete row */
    }
  }

  return {
    rows: rows.map((row) => {
      const clean = {};
      for (const [key, value] of Object.entries(row || {})) {
        if (INJECTION_KEYS.test(key)) continue;
        clean[key] = value;
      }
      return clean;
    }),
    candidates,
  };
}

module.exports = {
  parseCsv,
  splitWebsites,
  parseListingCsv,
};
