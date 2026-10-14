'use strict';

/** Плейсхолдеры и явные ошибки — не публиковать. */
const PLACEHOLDER_RE = [
  /^мощность кВт$/i,
  /^ковш м³$/i,
  /мощность кВт;\s*ковш м³/i,
  /;\s*мощность кВт\s*$/i,
];

/** ЧЕТРА: линейка Т* — бульдозеры, не колёсные погрузчики. */
function chetraTypeMismatch(model, description) {
  const m = String(model || '').trim();
  const d = String(description || '');
  if (!/^Т\d/i.test(m)) return null;
  if (/колёсный погрузчик/i.test(d)) {
    return 'chetra_t_bulldozer_not_wheel_loader';
  }
  return null;
}

function isPlaceholderDescription(description) {
  const parts = String(description || '').split(';').map((p) => p.trim()).filter(Boolean);
  for (const p of parts) {
    for (const re of PLACEHOLDER_RE) {
      if (re.test(p)) return true;
    }
  }
  return false;
}

const WEAK_TYPE_LEAD_RE = [
  /^[\d,.]+\s*–\s*[\d,.]+\s*л\.?\s*с\.?$/i,
  /^DE\d/i,
  /^LCV$/i,
  /^спецтехника$/i,
  /^коммерческий$/i,
  /^линейка /i,
];

function typeLead(desc) {
  const m = String(desc || '').match(/^[^—]+—\s*([^;]+)/i);
  return m ? m[1].trim() : '';
}

function isWeakTypeLead(desc) {
  const lead = typeLead(desc);
  if (!lead) return true;
  return WEAK_TYPE_LEAD_RE.some((re) => re.test(lead));
}

function isThinDescription(desc) {
  const d = String(desc || '');
  if (!d.includes('—')) return false;
  const afterLead = d.replace(/^[^—]+—\s*[^;]+;?\s*/, '').trim();
  if (!afterLead) return true;
  if (afterLead.startsWith('— Класс —')) return true;
  return !/л\.?\s*с|квт|×|\d{3,}\s*кг|полная масса|грузоподъ|мм|м³|об\/мин|т\/ч/i.test(afterLead);
}

function auditDescription(row) {
  const issues = [];
  const desc = String(row.description || row.summary || '');
  if (isPlaceholderDescription(desc)) issues.push('placeholder_spec');
  const chetra = chetraTypeMismatch(row.model, desc);
  if (chetra) issues.push(chetra);
  if (String(row.brand) === 'ЧЕТРА' && /\/catalog\/?$/.test(String(row.source_url || '').replace(/\/$/, ''))) {
    issues.push('chetra_generic_catalog_url');
  }
  if (isWeakTypeLead(desc)) issues.push('weak_type_lead');
  if (isThinDescription(desc)) issues.push('thin_description');
  return issues;
}

module.exports = {
  PLACEHOLDER_RE,
  isPlaceholderDescription,
  chetraTypeMismatch,
  auditDescription,
};
