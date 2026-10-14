'use strict';

/**
 * URL policy for listing photo search (plan B): year, model/chassis hints, wheel formula.
 */

const LISTING_MIN_YEAR = Number(process.env.LISTING_MIN_YEAR || 2020);
const LISTING_YEAR_HINT = String(process.env.LISTING_YEAR_HINT || '2024 2025').trim();

function decodeHaystack(url) {
  try {
    return decodeURIComponent(String(url || '')).toLowerCase();
  } catch {
    return String(url || '').toLowerCase();
  }
}

/** @returns {string|null} e.g. "4x2", "6x4" */
function parseWheelFormula(specs) {
  const m = String(specs || '').match(/(\d)\s*[×xх]\s*(\d)/i);
  if (!m) return null;
  return `${m[1]}x${m[2]}`;
}

function extractProductCodes(brand, model, specs) {
  const hay = `${model} ${specs || ''}`;
  const codes = new Set();
  const re = /\d{4,5}[a-zA-Z0-9]*(?:-\d{2,3})*(?:-\d{2,3})?/g;
  let m;
  while ((m = re.exec(hay)) !== null) {
    const t = m[0].replace(/\s/g, '').toLowerCase();
    if (t.length >= 4) codes.add(t);
    const core = t.match(/^(\d{4,5})/);
    if (core) codes.add(core[1]);
  }
  return [...codes];
}

function codeMatchesAllowed(token, allowed) {
  const t = String(token || '').replace(/-/g, '').toLowerCase();
  if (!t || t.length < 4) return true;
  for (const a of allowed) {
    const aa = String(a).replace(/-/g, '').toLowerCase();
    if (!aa) continue;
    if (t === aa) return true;
    if (t.startsWith(aa) || aa.startsWith(t)) return true;
    if (t.length >= 5 && aa.length >= 5 && t.slice(0, 5) === aa.slice(0, 5)) return true;
    if (/\d{4,5}/.test(t) && /\d{4,5}/.test(aa)) {
      const td = t.match(/(\d{4,5})/)?.[1];
      const ad = aa.match(/(\d{4,5})/)?.[1];
      if (td && ad && td === ad) return true;
    }
  }
  return false;
}

function kamazIndexTokensInUrl(url) {
  const u = decodeHaystack(url);
  const found = new Set();
  let m;
  const patterns = [
    /kamaz[\-_](\d{4,5}[a-z0-9]*)/gi,
    /(?:bortovoy|shassi|shassy|avtomobil|flatbed|dump-truck|truck)[\-_\s]+(?:kamaz[\-_])?(\d{4,5}[a-z0-9]*)/gi,
    /(?:^|[\/_\-\.])(43\d{3}|44\d{3}|53\d{3}|55\d{3}|56\d{3}|58\d{3}|59\d{3}|65\d{3}|66\d{3}|69\d{3})(?:[\/_\-\.]|$)/gi,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    while ((m = re.exec(u)) !== null) {
      if (m[1]) found.add(m[1].toLowerCase());
    }
  }
  return [...found];
}

/** Known KAMAZ chassis indices strongly tied to 6×4 in dealer URLs (when card is 4×2). */
const KAMAZ_LIKELY_6X4_INDEX = /\b43118\b|\b65115\b|\b65861\b|\b53504\b|\b53505\b|\b43114\b|\b53605\b/;

function urlModelConflict(url, brand, model, specs) {
  const b = String(brand || '');
  if (!/kamaz|кamaz|камаз/i.test(b)) return { conflict: false };
  const allowed = extractProductCodes(brand, model, specs);
  if (!allowed.length) return { conflict: false };
  const found = kamazIndexTokensInUrl(url);
  for (const f of found) {
    if (!codeMatchesAllowed(f, allowed)) {
      return { conflict: true, token: f, allowed };
    }
  }
  return { conflict: false };
}

function urlWheelConflict(url, wheelFormula) {
  const wf = String(wheelFormula || '').toLowerCase();
  if (!wf) return { conflict: false };
  const u = decodeHaystack(url);
  if (wf === '4x2') {
    if (/6\s*[×xх]\s*4|6x4|8\s*[×xх]\s*4|8x4/.test(u)) {
      return { conflict: true, reason: 'opposite_axle_in_url' };
    }
    if (KAMAZ_LIKELY_6X4_INDEX.test(u)) {
      return { conflict: true, reason: 'likely_6x4_index' };
    }
  }
  if (wf === '6x4') {
    if (/4\s*[×xх]\s*2|4x2/.test(u) && !/6\s*[×xх]\s*4|6x4/.test(u)) {
      return { conflict: true, reason: 'opposite_axle_in_url' };
    }
  }
  return { conflict: false };
}

function urlYearRejected(url) {
  if (process.env.SKIP_LISTING_YEAR_URL === '1') return { reject: false };
  const u = decodeHaystack(url);
  const minYear = LISTING_MIN_YEAR;
  let m;
  const yearRe = /\b(19\d{2}|20\d{2})\b/g;
  while ((m = yearRe.exec(u)) !== null) {
    const y = parseInt(m[1], 10);
    if (y >= 1990 && y < minYear) return { reject: true, year: y, reason: 'year_in_url' };
  }
  const pathRe = /\/(20\d{2})\/(0[1-9]|1[0-2])\//g;
  while ((m = pathRe.exec(u)) !== null) {
    const y = parseInt(m[1], 10);
    if (y < minYear) return { reject: true, year: y, reason: 'year_in_path' };
  }
  return { reject: false };
}

function listingYearSearchSuffix() {
  return LISTING_YEAR_HINT;
}

module.exports = {
  LISTING_MIN_YEAR,
  LISTING_YEAR_HINT,
  parseWheelFormula,
  extractProductCodes,
  urlModelConflict,
  urlWheelConflict,
  urlYearRejected,
  listingYearSearchSuffix,
};
