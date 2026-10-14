'use strict';

const { shouldDropSegment, shouldDropMarketingSegment } = require('./sanitize-listing-summary');

const SEGMENT_DEFAULT_TYPE = {
  premium: 'автомобиль',
  gruzoviki: 'грузовик',
  spectehnika: 'спецтехника',
  oborudovanie: 'оборудование',
};

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseTitleParts(title, brand, model) {
  const t = String(title || '').trim();
  let b = String(brand || '').trim();
  let m = String(model || '').trim();
  if ((!b || !m) && t.includes('·')) {
    const idx = t.indexOf('·');
    if (!b) b = t.slice(0, idx).trim();
    if (!m) m = t.slice(idx + 1).trim();
  }
  if (!b && t) b = t.split(/\s+/)[0] || '';
  return {
    brand: b,
    model: m,
    title: t || (b && m ? `${b} · ${m}` : t),
  };
}

function normalizeKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\u00b7/g, '·')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTitleLikeSegment(seg, title, brand, model) {
  const n = normalizeKey(seg);
  const variants = new Set([
    normalizeKey(title),
    normalizeKey(`${brand} · ${model}`),
    normalizeKey(`${brand} ${model}`),
  ].filter(Boolean));
  return variants.has(n);
}

/**
 * Собирает description: «Brand Model — тип/класс; ТТХ…» без страны.
 */
function buildListingDescription(row) {
  const { brand, model, title } = parseTitleParts(row.title, row.brand, row.model);
  const segment = String(row.segment || '').trim().toLowerCase();
  const leadName = `${brand} ${model}`.replace(/\s+/g, ' ').trim();
  if (!leadName) return String(row.description || title || '').trim();

  let raw = String(row.description || '').trim();
  const leadReStrip = new RegExp(`^${escapeRe(leadName)}\\s*[—–-]\\s*`, 'i');
  if (leadReStrip.test(raw)) {
    raw = raw.replace(leadReStrip, '').trim();
  }
  if (!raw || normalizeKey(raw) === normalizeKey(title)) {
    raw = '';
  }

  let parts = raw
    ? raw.split(';').map((p) => p.trim()).filter(Boolean)
    : [];
  parts = parts.filter((p) => !isTitleLikeSegment(p, title, brand, model));

  const leadRe = new RegExp(`^${escapeRe(leadName)}\\s*[—–-]\\s*`, 'i');
  if (parts.length === 1 && leadRe.test(parts[0])) {
    parts = parts[0]
      .replace(leadRe, '')
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean);
  } else if (leadRe.test(raw)) {
    parts = raw
      .replace(leadRe, '')
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean);
  }

  const featureParts = [...parts];
  let typeLabel = '';
  while (featureParts.length > 0) {
    const candidate = featureParts.shift();
    if (!shouldDropMarketingSegment(candidate)) {
      typeLabel = candidate;
      break;
    }
  }
  if (!typeLabel) {
    typeLabel = SEGMENT_DEFAULT_TYPE[segment] || 'модель';
  }

  typeLabel = typeLabel.replace(/\s+/g, ' ').trim();
  const lead = `${leadName} — ${typeLabel}`;
  if (!featureParts.length) {
    return lead;
  }
  return `${lead}; ${featureParts.join('; ')}`;
}

/** build + вычищение хвостовых сегментов (sanitize по сегментам, лид не трогаем). */
function enrichListingDescription(row) {
  const { title } = parseTitleParts(row.title, row.brand, row.model);
  const built = buildListingDescription(row);
  const semi = built.indexOf(';');
  const lead = semi === -1 ? built.trim() : built.slice(0, semi).trim();
  const tail = semi === -1 ? '' : built.slice(semi + 1);
  const features = tail
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !shouldDropSegment(p));
  if (!features.length) {
    return lead || String(title || '').trim();
  }
  return `${lead}; ${features.join('; ')}`;
}

module.exports = {
  buildListingDescription,
  enrichListingDescription,
  parseTitleParts,
  SEGMENT_DEFAULT_TYPE,
};
