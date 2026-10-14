'use strict';

/**
 * Заполняет data/listing-equipment-class-specs-2026.csv агрегатами из sku-catalog-2026.csv.
 * Классы и колонки min/max правятся вручную в CSV; скрипт пересчитывает counts и цифры.
 *
 *   node scripts/build-listing-equipment-class-specs-2026.js
 *   APPLY=1 node scripts/build-listing-equipment-class-specs-2026.js
 */
const fs = require('fs');
const path = require('path');

const SKU_CSV = process.env.SKU_CSV || path.join(__dirname, '..', '..', 'data', 'sku-catalog-2026.csv');
const CLASS_CSV = process.env.CLASS_CSV || path.join(__dirname, '..', '..', 'data', 'listing-equipment-class-specs-2026.csv');
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

function typeText(item) {
  const d = String(item.description || '').toLowerCase();
  const m = d.match(/^[^—]+—\s*([^;]+)/);
  return m ? m[1].trim() : d;
}

function itemMatchesClass(item, matchKeywords) {
  const hay = `${typeText(item)};${item.description || ''};${item.segment};${item.title || ''}`.toLowerCase();
  const keys = String(matchKeywords || '')
    .split(';')
    .map((k) => k.trim())
    .filter(Boolean);
  return keys.some((k) => hay.includes(k.toLowerCase()));
}

function collectMetrics(desc) {
  const d = String(desc || '');
  const out = {
    mass_t: [],
    mass_kg: [],
    kw: [],
    hp: [],
    bucket: [],
    lift_t: [],
    formulas: new Set(),
    fuel: new Set(),
  };
  for (const m of d.matchAll(/эксплуатационная масса от ([\d,.]+) до ([\d,.]+) т/gi)) {
    out.mass_t.push(parseFloat(m[1].replace(',', '.')), parseFloat(m[2].replace(',', '.')));
  }
  for (const m of d.matchAll(/масса ([\d,.]+)\s*т/gi)) {
    const v = parseFloat(m[1].replace(',', '.'));
    if (!isNaN(v)) out.mass_t.push(v);
  }
  for (const m of d.matchAll(/масса ([\d\s]+) кг/gi)) {
    out.mass_kg.push(parseFloat(m[1].replace(/\s/g, '')));
  }
  for (const m of d.matchAll(/полная масса ([\d\s]+) кг/gi)) {
    out.mass_kg.push(parseFloat(m[1].replace(/\s/g, '')));
  }
  for (const m of d.matchAll(/([\d,.]+)\s*\(\s*([\d,.]+)\s*\)\s*кВт/gi)) {
    out.kw.push(parseFloat(m[1].replace(',', '.')));
    out.hp.push(parseFloat(m[2].replace(',', '.')));
  }
  for (const m of d.matchAll(/([\d,.]+)\s*кВт/gi)) {
    out.kw.push(parseFloat(m[1].replace(',', '.')));
  }
  for (const m of d.matchAll(/([\d,.]+)\s*л\.?\s*с\.?/gi)) {
    out.hp.push(parseFloat(m[1].replace(',', '.')));
  }
  for (const m of d.matchAll(/ковш[^;\d]*([\d,.]+)\s*м³/gi)) {
    out.bucket.push(parseFloat(m[1].replace(',', '.')));
  }
  for (const m of d.matchAll(/отвал[^;\d]*([\d,.]+)\s*м³/gi)) {
    out.bucket.push(parseFloat(m[1].replace(',', '.')));
  }
  for (const m of d.matchAll(/грузоподъ(?:ём|е)мность[^;\d]*([\d,.]+)\s*т/gi)) {
    out.lift_t.push(parseFloat(m[1].replace(',', '.')));
  }
  for (const m of d.matchAll(/(\d+[×xх]\d+)/gi)) {
    out.formulas.add(m[1].replace(/x|х/gi, '×'));
  }
  if (/электр/i.test(d) && /квт|ev|электро/i.test(d)) out.fuel.add('electric');
  if (/дизел/i.test(d) || /л\.?\s*с\.?/i.test(d)) out.fuel.add('diesel');
  if (/гибрид|phev|plug-in/i.test(d)) out.fuel.add('hybrid');
  if (/спг|cng|кпг|lng/i.test(d)) out.fuel.add('gas');
  return out;
}

function minMax(arr) {
  const n = (arr || []).filter((x) => typeof x === 'number' && !isNaN(x));
  if (!n.length) return ['', ''];
  return [String(Math.min(...n)), String(Math.max(...n))];
}

function setIfEmpty(row, key, value) {
  if (value === '' || value == null) return;
  row[key] = value;
}

function main() {
  const sku = parseCsv(fs.readFileSync(SKU_CSV, 'utf8'));
  const classFile = parseCsv(fs.readFileSync(CLASS_CSV, 'utf8'));
  const assigned = new Set();

  for (const row of classFile.items) {
    const matched = sku.items.filter((it) => itemMatchesClass(it, row.match_keywords));
    for (const it of matched) assigned.add(it.title);

    const brands = [...new Set(matched.map((i) => i.brand.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    row.models_count = String(matched.length);
    row.brands_count = String(brands.length);
    row.brands_list = brands.join('; ');

    const agg = {
      mass_t: [],
      mass_kg: [],
      kw: [],
      hp: [],
      bucket: [],
      lift_t: [],
      formulas: new Set(),
      fuel: new Set(),
    };
    for (const it of matched) {
      const m = collectMetrics(it.description);
      agg.mass_t.push(...m.mass_t);
      agg.mass_kg.push(...m.mass_kg);
      agg.kw.push(...m.kw);
      agg.hp.push(...m.hp);
      agg.bucket.push(...m.bucket);
      agg.lift_t.push(...m.lift_t);
      for (const f of m.formulas) agg.formulas.add(f);
      for (const f of m.fuel) agg.fuel.add(f);
    }

    const [massTMin, massTMax] = minMax(agg.mass_t);
    const [massKgMin, massKgMax] = minMax(agg.mass_kg);
    const [kwMin, kwMax] = minMax(agg.kw);
    const [hpMin, hpMax] = minMax(agg.hp);
    const [bMin, bMax] = minMax(agg.bucket);
    const [lMin, lMax] = minMax(agg.lift_t);

    setIfEmpty(row, 'mass_t_min', massTMin);
    setIfEmpty(row, 'mass_t_max', massTMax);
    setIfEmpty(row, 'mass_kg_min', massKgMin);
    setIfEmpty(row, 'mass_kg_max', massKgMax);
    setIfEmpty(row, 'power_kw_min', kwMin);
    setIfEmpty(row, 'power_kw_max', kwMax);
    setIfEmpty(row, 'power_hp_min', hpMin);
    setIfEmpty(row, 'power_hp_max', hpMax);
    setIfEmpty(row, 'bucket_m3_min', bMin);
    setIfEmpty(row, 'bucket_m3_max', bMax);
    setIfEmpty(row, 'lift_capacity_t_min', lMin);
    setIfEmpty(row, 'lift_capacity_t_max', lMax);
    if (agg.formulas.size) row.wheel_formulas = [...agg.formulas].sort().join('; ');
    if (agg.fuel.size) row.fuel_types = [...agg.fuel].sort().join(';');
  }

  const unassigned = sku.items.filter((it) => !assigned.has(it.title));
  const report = {
    apply: APPLY,
    skuRows: sku.items.length,
    classRows: classFile.items.length,
    assignedCards: assigned.size,
    unassignedCards: unassigned.length,
    unassignedSample: unassigned.slice(0, 15).map((i) => ({ title: i.title, type: typeText(i) })),
    bulldozer: classFile.items.find((r) => r.class_id === 'bulldozer'),
  };

  if (APPLY) {
    fs.writeFileSync(CLASS_CSV, writeCsv(classFile.header, classFile.items), 'utf8');
  }

  console.log(JSON.stringify(report, null, 2));
}

main();
