'use strict';

/**
 * Дописывает ТТХ премиум-карточек из CRM-комментариев (crm-import-premium-2026.csv)
 * и типа кузова по модели. Без выдуманных л.с.
 *
 *   APPLY=0 node scripts/apply-premium-spec-overrides-2026.js
 *   APPLY=1 node scripts/apply-premium-spec-overrides-2026.js
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { enrichListingDescription } = require('./listing-b-mass/build-listing-description');

const CATEGORY = '2026';
const CSV_PATH = process.env.SKU_CSV || path.join(__dirname, '..', '..', 'data', 'sku-catalog-2026.csv');
const APPLY = process.env.APPLY === '1';
const SKIP_DB = process.env.SKIP_DB === '1';

/** title -> сегменты после типа (без лида) */
const PREMIUM_SPEC_BY_TITLE = {
  'BMW · X1': ['компактный кроссовер', 'полный привод xDrive (типовые комплектации)'],
  'BMW · X2': ['компактный кроссовер', 'полный привод xDrive'],
  'BMW · X3': ['кроссовер', 'xDrive25Li/xDrive30Li (типовые комплектации РФ)'],
  'BMW · X5': ['кроссовер', 'xDrive30d/xDrive40d/M60i (типовые комплектации РФ)'],
  'BMW · X6': ['кросс-купе', 'полный привод xDrive'],
  'BMW · X7': ['полноразмерный внедорожник', 'полный привод xDrive'],
  'BMW · X5 M': ['спортивный внедорожник M', 'полный привод M xDrive'],
  'BMW · X6 M': ['спортивное кросс-купе M', 'полный привод M xDrive'],
  'BMW · XM': ['флагманский гибридный внедорожник M', 'plug-in hybrid M'],
  'BMW · iX': ['электрокроссовер', 'полностью электрический привод'],
  'BMW · iX3': ['электрокроссовер', 'полностью электрический привод'],
  'BMW · 3 Series': ['седан', 'задний или полный привод xDrive'],
  'BMW · 5 Series': ['седан бизнес-класса', 'задний или полный привод xDrive'],
  'BMW · 7 Series': ['седан представительского класса', 'задний или полный привод xDrive'],
  'Audi · New A6': ['седан', 'TFSI/TDI quattro (линейка A6)'],
  'Audi · A6': ['седан', 'TFSI/TDI quattro'],
  'Audi · A8 L': ['седан представительского класса', 'удлинённая база L; quattro'],
  'Audi · Q7': ['полноразмерный SUV', '7 мест; TFSI quattro'],
  'Audi · Q8': ['кросс-купе SUV', 'TFSI quattro'],
  'Mercedes-Benz · A-Class Sedan': ['седан компакт-класса', 'Front-Wheel Drive / 4MATIC'],
  'Mercedes-Benz · A-Class Hatchback': ['хэтчбек компакт-класса', 'Front-Wheel Drive / 4MATIC'],
  'Mercedes-Benz · C-Class Sedan': ['седан', '4MATIC (типовые комплектации)'],
  'Mercedes-Benz · E-Class Sedan': ['седан бизнес-класса', '4MATIC (типовые комплектации)'],
  'Mercedes-Benz · S-Class Sedan': ['седан представительского класса', '4MATIC'],
  'Mercedes-Benz · Maybach S-Class': ['седан Maybach', '4MATIC; удлинённая база'],
  'Mercedes-Benz · CLA Coupe': ['купе-седан', '4MATIC'],
  'Mercedes-Benz · CLE Coupe': ['купе', '4MATIC'],
  'Mercedes-Benz · GLA': ['компактный кроссовер', '4MATIC'],
  'Mercedes-Benz · GLB': ['компактный кроссовер', '7 мест; 4MATIC'],
  'Mercedes-Benz · GLC SUV': ['среднеразмерный SUV', '4MATIC'],
  'Mercedes-Benz · GLC Coupe': ['купеобразный SUV', '4MATIC'],
  'Mercedes-Benz · GLE SUV': ['SUV', 'GLE 300 d/450 d/450 4MATIC (типовые комплектации РФ)'],
  'Mercedes-Benz · GLE Coupe': ['купеобразный SUV', '4MATIC'],
  'Mercedes-Benz · GLS': ['полноразмерный SUV', '3 ряда сидений; 4MATIC'],
  'Mercedes-Benz · Maybach GLS': ['полноразмерный SUV Maybach', '4MATIC'],
  'Mercedes-Benz · G-Class': ['внедорожник', 'G 450 d/G 500 (типовые комплектации РФ)'],
  'Mercedes-Benz · AMG GT Coupe': ['спорткупе AMG GT', 'задний привод / 4MATIC'],
  'Mercedes-Benz · V-Class': ['минивэн', 'дизель; 7–8 мест'],
  'Lexus · ES': ['седан бизнес-класса', 'бензин/hybrid (ES)'],
  'Lexus · Новый ES': ['седан бизнес-класса', 'обновлённая линейка ES'],
  'Lexus · RZ': ['электрокроссовер', 'полностью электрический привод'],
  'Lexus · NX': ['компактный кроссовер', 'бензин/hybrid NX'],
  'Lexus · RX': ['среднеразмерный SUV', '350h/500h hybrid (типовые комплектации РФ)'],
  'Lexus · GX': ['рамный внедорожник', 'полный привод 4WD'],
  'Lexus · LX': ['полноразмерный внедорожник', 'полный привод 4WD'],
  'Lexus · LM': ['премиальный минивэн', '4 места Executive / 7 мест'],
  'Porsche · Macan': ['компактный кроссовер', 'бензин / PHEV (линейка Macan)'],
  'Porsche · Macan T': ['компактный кроссовер', 'комплектация T'],
  'Porsche · Macan S': ['компактный кроссовер', 'комплектация S'],
  'Porsche · Macan GTS': ['компактный кроссовер', 'комплектация GTS'],
  'Porsche · Macan Electric': ['электрокроссовер', 'полностью электрический Macan'],
  'Porsche · Macan 4 Electric': ['электрокроссовер', 'Macan 4 Electric'],
  'Porsche · Macan 4S Electric': ['электрокроссовер', 'Macan 4S Electric'],
  'Porsche · Macan Turbo Electric': ['электрокроссовер', 'Macan Turbo Electric'],
  'Genesis · GV70': ['среднеразмерный кроссовер', 'бензин/turbo; полный привод AWD'],
  'Genesis · GV80': ['полноразмерный кроссовер', 'бензин/turbo; полный привод AWD'],
  'Genesis · G80': ['седан', 'бензин/turbo; задний или полный привод AWD'],
  'Genesis · G70': ['седан компакт-класса', 'бензин/turbo; AWD'],
  'Genesis · G70 Shooting Brake': ['универсал', 'бензин/turbo; AWD'],
  'MINI · Cooper C': ['хэтчбек', 'бензин Cooper C'],
  'MINI · Cooper S': ['хэтчбек', 'бензин Cooper S'],
  'MINI · Countryman S ALL4': ['кроссовер', 'ALL4 полный привод'],
  'Rolls-Royce · Phantom': ['седан представительского класса', 'V12; стандартная колёсная база'],
  'Rolls-Royce · Phantom Extended': ['седан представительского класса', 'V12; удлинённая база Extended'],
  'Rolls-Royce · Ghost': ['седан люкс-класса', 'V12'],
  'Rolls-Royce · Ghost Extended': ['седан люкс-класса', 'V12; удлинённая база'],
  'Rolls-Royce · Cullinan': ['SUV люкс-класса', 'V12; полный привод'],
  'Rolls-Royce · Spectre': ['купе', 'полностью электрический привод'],
};

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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
  if (!header) return { header: [], items: [] };
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

function buildRawFromSegments(segments) {
  return segments.join('; ');
}

async function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const { header, items } = parseCsv(raw);
  let changed = 0;
  const samples = [];

  for (const item of items) {
    if (item.segment !== 'premium') continue;
    const title = (item.title || '').trim();
    const segs = PREMIUM_SPEC_BY_TITLE[title];
    if (!segs) continue;
    const before = (item.description || '').trim();
    const rawDesc = buildRawFromSegments(segs);
    const after = enrichListingDescription({ ...item, description: rawDesc });
    if (after === before) continue;
    changed += 1;
    if (samples.length < 10) samples.push({ title, before, after });
    if (APPLY) item.description = after;
  }

  if (APPLY && changed) {
    fs.writeFileSync(CSV_PATH, writeCsv(header, items), 'utf8');
  }

  let dbChanged = 0;
  if (!SKIP_DB && APPLY) {
    const byTitle = new Map(items.map((i) => [(i.title || '').trim(), enrichListingDescription(i)]));
    const { rows } = await db.getQuery()(
      `SELECT id, title, summary FROM admin_pages_simple WHERE category = $1`,
      [CATEGORY],
    );
    for (const row of rows) {
      const title = String(row.title || '').trim();
      if (!PREMIUM_SPEC_BY_TITLE[title]) continue;
      const after = byTitle.get(title);
      if (!after || after === String(row.summary || '').trim()) continue;
      dbChanged += 1;
      const content = `<p>${esc(after)}</p>`;
      await db.getQuery()(
        `UPDATE admin_pages_simple
         SET summary = $2, content = $3,
             seo = jsonb_set(COALESCE(seo, '{}'::jsonb), '{description}', to_jsonb($2::text), true),
             updated_at = NOW()
         WHERE id = $1`,
        [row.id, after, content],
      );
    }
  }

  console.log(JSON.stringify({
    apply: APPLY,
    changed,
    dbChanged,
    mappedTitles: Object.keys(PREMIUM_SPEC_BY_TITLE).length,
    samples,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
