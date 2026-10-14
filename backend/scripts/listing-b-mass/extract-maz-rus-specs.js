'use strict';

const MAZ_FIELD_MAP = [
  ['Колесная формула', 'formula'],
  ['Мощность двигателя, л.с.', 'hp'],
  ['Полная масса автомобиля, кг', 'gvw'],
  ['Грузоподъемность,кг', 'payload'],
  ['Грузоподъемность, кг', 'payload'],
  ['Число передач', 'gears'],
  ['Модель двигателя', 'engine'],
  ['Тип кабины', 'cabin'],
];

function decodeNuxtString(s) {
  return String(s || '')
    .replace(/\\u002F/g, '/')
    .replace(/\\u003C/g, '<')
    .replace(/\\u003E/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/х/g, '×');
}

function normalizeFormula(v) {
  return decodeNuxtString(v).replace(/x/gi, '×').replace(/х/gi, '×');
}

/**
 * Парсит ТТХ из HTML maz-rus.com (payload window.__NUXT__).
 */
function extractMazRusSpecsFromHtml(html) {
  const found = {};
  for (const [title, key] of MAZ_FIELD_MAP) {
    const esc = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`"${esc}","([^"]+)"`);
    const m = String(html).match(re);
    if (m) found[key] = decodeNuxtString(m[1]);
  }
  return found;
}

function mazSpecsToSegments(specs) {
  const segments = [];
  if (specs.formula && /\d+\s*[×xх]\d+/i.test(specs.formula)) {
    segments.push(normalizeFormula(specs.formula));
  }
  if (specs.hp) segments.push(`${specs.hp} л.с.`);
  if (specs.engine && !specs.hp) segments.push(`двигатель ${specs.engine}`);
  if (specs.gears) segments.push(`${specs.gears} передач`);
  if (specs.gvw) segments.push(`полная масса ${specs.gvw} кг`);
  if (specs.payload) segments.push(`грузоподъёмность ${specs.payload} кг`);
  return segments.filter(Boolean);
}

function mergeSpecSegments(existingDescription, newSegments) {
  let raw = String(existingDescription || '').trim();
  const leadMatch = raw.match(/^(.+?—\s*[^;]+)(?:;\s*(.*))?$/s);
  let lead = '';
  let existing = [];
  if (leadMatch) {
    lead = leadMatch[1].trim();
    existing = (leadMatch[2] || '').split(';').map((p) => p.trim()).filter(Boolean);
  } else {
    existing = raw.split(';').map((p) => p.trim()).filter(Boolean);
  }
  const typeInLead = (lead.split('—')[1] || '').trim().toLowerCase();
  const specRe = /л\.?\s*с|квт|×|\d{3,}\s*кг|полная масса|грузоподъ|передач/i;
  const kept = existing.filter((p) => {
    if (specRe.test(p)) return false;
    if (typeInLead && p.toLowerCase() === typeInLead) return false;
    return true;
  });
  const merged = [...kept];
  for (const seg of newSegments) {
    if (typeInLead && seg.toLowerCase() === typeInLead) continue;
    if (!merged.some((x) => x.toLowerCase() === seg.toLowerCase())) {
      merged.push(seg);
    }
  }
  const tail = merged.join('; ');
  if (lead && tail) return `${lead}; ${tail}`;
  if (lead) return lead;
  return tail;
}

module.exports = {
  extractMazRusSpecsFromHtml,
  mazSpecsToSegments,
  mergeSpecSegments,
};
