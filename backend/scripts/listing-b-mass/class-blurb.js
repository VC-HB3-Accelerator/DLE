'use strict';

const CLASS_BLURB_MARKER = '— Класс —';

function typeText(item) {
  const d = String(item.description || '');
  const m = d.match(/^[^—]+—\s*([^;]+)/i);
  return m ? m[1].trim() : '';
}

function itemMatchesClass(item, matchKeywords) {
  const hay = `${typeText(item)};${item.description || ''};${item.segment || ''};${item.title || ''}`.toLowerCase();
  const keys = String(matchKeywords || '')
    .split(';')
    .map((k) => k.trim())
    .filter(Boolean);
  return keys.some((k) => hay.includes(k.toLowerCase()));
}

function renderBlurbTemplate(template, row) {
  let out = String(template || '');
  const repl = {
    brands: row.brands_list || '',
    models_count: row.models_count || '',
    mass_t_min: row.mass_t_min || '',
    mass_t_max: row.mass_t_max || '',
    mass_kg_min: row.mass_kg_min || '',
    mass_kg_max: row.mass_kg_max || '',
    power_kw_min: row.power_kw_min || '',
    power_kw_max: row.power_kw_max || '',
    power_hp_min: row.power_hp_min || '',
    power_hp_max: row.power_hp_max || '',
    bucket_m3_min: row.bucket_m3_min || '',
    bucket_m3_max: row.bucket_m3_max || '',
    wheel_formulas: row.wheel_formulas || '',
    gvw_kg_min: row.gvw_kg_min || '',
    gvw_kg_max: row.gvw_kg_max || '',
    lift_capacity_t_min: row.lift_capacity_t_min || '',
    lift_capacity_t_max: row.lift_capacity_t_max || '',
  };
  for (const [key, val] of Object.entries(repl)) {
    out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), val || '—');
  }
  out = out.replace(/\(\s*где указано\s*\)/gi, (m, off, s) => {
    const ctx = s.slice(Math.max(0, off - 40), off + 80);
    if (/—;\s*—|:\s*—|–\s*—/.test(ctx)) return '';
    return m;
  });
  out = out.replace(/\s*;\s*;\s*/g, '; ').replace(/\s+/g, ' ').trim();
  return out;
}

function pickPrimaryClass(item, classRows) {
  const matched = classRows.filter((row) => itemMatchesClass(item, row.match_keywords));
  if (!matched.length) return null;
  matched.sort((a, b) => {
    const na = Number(a.models_count) || 9999;
    const nb = Number(b.models_count) || 9999;
    if (na !== nb) return na - nb;
    return String(a.class_id).localeCompare(String(b.class_id));
  });
  return matched[0];
}

function stripClassBlurb(description) {
  const d = String(description || '').trim();
  const idx = d.indexOf(`; ${CLASS_BLURB_MARKER}`);
  if (idx === -1) return d;
  return d.slice(0, idx).trim();
}

function appendClassBlurb(description, blurbText) {
  const base = stripClassBlurb(description);
  const blurb = String(blurbText || '').trim();
  if (!blurb) return base;
  if (base.includes(blurb)) return base;
  return `${base}; ${CLASS_BLURB_MARKER} ${blurb}`;
}

module.exports = {
  CLASS_BLURB_MARKER,
  typeText,
  itemMatchesClass,
  renderBlurbTemplate,
  pickPrimaryClass,
  stripClassBlurb,
  appendClassBlurb,
};
