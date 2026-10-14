'use strict';

/**
 * Таблица для согласования: 161 карточка без класса → предлагаемый тип в лиде + class_id.
 *
 *   node scripts/export-unassigned-class-proposals-2026.js
 */
const fs = require('fs');
const path = require('path');

const SKU_CSV = process.env.SKU_CSV || path.join(__dirname, '..', '..', 'data', 'sku-catalog-2026.csv');
const CLASS_CSV = process.env.CLASS_CSV || path.join(__dirname, '..', '..', 'data', 'listing-equipment-class-specs-2026.csv');
const OUT_CSV =
  process.env.OUT_CSV || path.join(__dirname, '..', '..', 'data', 'listing-unassigned-class-proposals-2026.csv');

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

function typeText(item) {
  const d = String(item.description || '');
  const m = d.match(/^[^—]+—\s*([^;]+)/i);
  return m ? m[1].trim() : '';
}

function typeTextLower(item) {
  return typeText(item).toLowerCase();
}

function itemMatchesClass(item, matchKeywords) {
  const hay = `${typeTextLower(item)};${item.description || ''};${item.segment || ''};${item.title || ''}`.toLowerCase();
  const keys = String(matchKeywords || '')
    .split(';')
    .map((k) => k.trim())
    .filter(Boolean);
  return keys.some((k) => hay.includes(k.toLowerCase()));
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

function propose(it) {
  const seg = it.segment || '';
  const t = typeTextLower(it);
  const d = (it.description || '').toLowerCase();
  const title = (it.title || '').toLowerCase();
  const brand = (it.brand || '').toLowerCase();
  let proposedType = '';
  let classId = '';
  let classRu = '';
  let notes = '';

  if (/сортиментовоз/.test(t) || /сортиментовоз/.test(d)) {
    proposedType = 'сортиментовоз';
    classId = 'sortimentovoz';
    classRu = 'Сортиментовоз';
    notes = 'отдельный класс от фургона';
  } else if (
    seg === 'gruzoviki' &&
    (t === 'lcv' ||
      t === 'коммерческий' ||
      /фургон|цельнометаллическ|буханка|сгр/.test(`${t} ${d} ${title}`) ||
      /газель|соболь|\bdaily\b|sprinter|transit|лёгкий коммерческий/.test(`${d} ${title}`))
  ) {
    proposedType = 'фургон';
    classId = 'furgon';
    classRu = 'Фургон';
    notes = 'все бывшие LCV и коммерческие фургоны — один класс «фургон», без слова «коммерческий»';
  } else if (/среднетоннаж|развозной|городской\/развозной/.test(`${t} ${d}`)) {
    proposedType = /средне/.test(t) ? 'среднетоннажный грузовик' : 'развозной грузовик';
    classId = 'truck_distribution';
    classRu = 'Развозной / среднетоннажный';
  } else if (/actros|линейка actros/.test(t)) {
    proposedType = 'седельный тягач';
    classId = 'semitractor';
    classRu = 'Седельный тягач';
    notes = 'уточнить тип Mercedes с оф. каталога';
  } else if (t === 'полноприводный' && seg === 'gruzoviki') {
    proposedType = 'бортовой';
    classId = 'flatbed';
    classRu = 'Бортовой';
    notes = 'уточнить с URL';
  } else if (t === 'погрузчик' || (t === 'погрузчик' && brand.includes('амкодор'))) {
    proposedType = 'фронтальный погрузчик';
    classId = 'wheel_loader';
    classRu = 'Фронтальный погрузчик';
    notes = 'проверить amkodor.by — часть может быть не фронтальный';
  } else if (/электрический экскаватор/.test(t) || (/экскаватор/.test(d) && /электр/.test(d))) {
    proposedType = 'электрический экскаватор';
    classId = 'excavator_electric';
    classRu = 'Электрический экскаватор';
    notes = 'новый класс или keyword к excavator_*';
  } else if (t === 'экскаватор') {
    proposedType = 'гусеничный экскаватор';
    classId = 'excavator_crawler';
    classRu = 'Гусеничный экскаватор';
    notes = 'уточнить шасси с оф. сайта';
  } else if (t === 'спецтехника') {
    proposedType = 'уточнить тип спецтехники';
    classId = 'municipal';
    classRu = 'Коммунальная / прочая спецтехника';
    notes = 'разобрать по source_url';
  } else if (/электрический строительный/.test(t)) {
    proposedType = 'электрическая спецтехника';
    classId = 'spectehnika_electric';
    classRu = 'Электрическая спецтехника';
    notes = 'новый класс';
  } else if (/\bкт\b|aquilion|somatom|revolution|optima ct|anatom|маммограф|флюорограф|неusoft/.test(`${t} ${d}`)) {
    if (/маммограф/.test(`${t} ${d}`)) {
      proposedType = 'цифровой маммограф';
      classId = 'medical_mammography';
      classRu = 'Маммография';
    } else if (/флюорограф/.test(`${t} ${d}`)) {
      proposedType = 'флюорограф';
      classId = 'medical_fluorography';
      classRu = 'Флюорография';
    } else {
      proposedType = typeText(it).toLowerCase().includes('кт') ? typeText(it) : 'КТ';
      classId = 'medical_ct';
      classRu = 'КТ (медицина)';
    }
  } else if (/\bмрт\b|signa|ingenia|biomatrix/.test(`${t} ${d}`)) {
    proposedType = 'МРТ';
    classId = 'medical_mri';
    classRu = 'МРТ';
  } else if (/листогиб|trubend/.test(`${t} ${d}`)) {
    proposedType = 'листогиб';
    classId = 'industrial_press_brake';
    classRu = 'Листогиб';
  } else if (/лазер|2d-лазер|резк/.test(`${t} ${d}`)) {
    proposedType = 'лазерная резка листа';
    classId = 'industrial_laser';
    classRu = 'Лазерная резка';
  } else if (/токарный оц|вертикальный оц|горизонтальный оц|портальный оц|5-осевой оц|обрабатывающий центр/.test(`${t} ${d}`)) {
    proposedType = /токар/.test(t) ? 'токарный обрабатывающий центр' : 'обрабатывающий центр';
    classId = 'cnc_machine';
    classRu = 'Станок / ОЦ';
    notes = 'расширить match_keywords: оц;токарный';
  } else if (/опрыскиватель|разбрасыватель|туман/.test(`${t} ${d}`)) {
    proposedType = /прицеп/.test(t) ? 'опрыскиватель прицепной' : 'самоходный опрыскиватель';
    classId = 'sprayer_ag';
    classRu = 'Опрыскиватель';
  } else if (/кормоуборочный комплекс|уэс/.test(`${t} ${d}`)) {
    proposedType = 'кормоуборочный комплекс';
    classId = 'combine_forage';
    classRu = 'Кормоуборочный комбайн';
  } else if (/электростанц|cat energy/.test(`${t} ${d}`)) {
    proposedType = 'дизель-генератор';
    classId = 'dg_set';
    classRu = 'ДГУ';
  } else if (/металлорежущ|станок/.test(`${t} ${d}`)) {
    proposedType = 'станок с ЧПУ';
    classId = 'cnc_machine';
    classRu = 'Станок / ОЦ';
  } else if (seg === 'premium') {
    if (/универсал|wagon|estate|touring/.test(`${t} ${d} ${title}`)) {
      proposedType = 'универсал';
      classId = 'car_wagon';
      classRu = 'Универсал';
      notes = 'новый класс или keyword в car_premium_other';
    } else if (/минивэн|minivan|mpv|multivan|v-class|v class/.test(`${t} ${d} ${title}`)) {
      proposedType = 'минивэн';
      classId = 'car_minivan';
      classRu = 'Минивэн';
    } else if (/911|спорткар|sport car/.test(`${d} ${title}`)) {
      proposedType = 'спорткар';
      classId = 'car_premium_other';
      classRu = 'Автомobile (прочие кузова)';
    } else if (/купе|coupe|boxster|cayman|gran coup/.test(`${t} ${d} ${title}`)) {
      proposedType = 'купе';
      classId = 'car_premium_other';
      classRu = 'Автomobile (прочие кузова)';
    } else if (/седан|sedan|passion/.test(`${t} ${d} ${title}`)) {
      proposedType = 'седан';
      classId = 'car_sedan';
      classRu = 'Седан';
    } else if (/электро|eq |phev|гибрид|hybrid|evr|plug|доступны силовые|комплектация|^[\\d.]+\s*t\s*/.test(t)) {
      if (/cla\b|sedan|седан|passion|e-class|s-class|c-class|3 series|5 series|7 series|a4|a6|a8|genesis g80|hongqi h9/.test(`${d} ${title}`)) {
        proposedType = 'седан';
        classId = 'car_sedan';
        classRu = 'Седан';
      } else if (/v-class|vito|multivan|minivan|минивэн|caravelle/.test(`${d} ${title}`)) {
        proposedType = 'минивэн';
        classId = 'car_minivan';
        classRu = 'Минивэн';
      } else {
        proposedType = 'кроссовер';
        classId = 'car_suv';
        classRu = 'Кроссовер / SUV';
      }
      notes = notes || 'лид: кузов первым сегментом; мотор/гибрид — после';
    } else if (/модель 8x|8 series|840|850/.test(`${t} ${title}`)) {
      proposedType = 'купе';
      classId = 'car_premium_other';
      classRu = 'Автomobile (прочие кузова)';
      notes = 'BMW 8 — уточнить Gran Coupé / кабриолет';
    } else if (/hongqi|hs7|guoya|h5/.test(`${d} ${title}`)) {
      if (/hs7|guoya/.test(`${d} ${title}`)) {
        proposedType = 'кроссовер';
        classId = 'car_suv';
        classRu = 'Кроссовер / SUV';
      } else {
        proposedType = 'седан';
        classId = 'car_sedan';
        classRu = 'Седан';
      }
    } else {
      proposedType = 'уточнить кузов';
      classId = 'car_premium_other';
      classRu = 'Легковой автомобиль';
      notes = `лид сейчас: ${typeText(it).slice(0, 100)}`;
    }
  }

  if (!classId) {
    proposedType = proposedType || `уточнить: ${typeText(it).slice(0, 70)}`;
    classId = 'NEEDS_REVIEW';
    notes = `${notes ? `${notes}; ` : ''}нет эвристики`;
  }

  return { proposedType, classId, classRu, notes };
}

function main() {
  const sku = parseCsv(fs.readFileSync(SKU_CSV, 'utf8')).items;
  const classes = parseCsv(fs.readFileSync(CLASS_CSV, 'utf8')).items;
  const assigned = new Set();
  for (const row of classes) {
    for (const it of sku.filter((i) => itemMatchesClass(i, row.match_keywords))) {
      assigned.add(it.title);
    }
  }
  const un = sku.filter((it) => !assigned.has(it.title));

  const header = [
    'title',
    'segment',
    'brand',
    'model',
    'current_type_lead',
    'proposed_type_lead',
    'proposed_class_id',
    'proposed_class_ru',
    'notes',
    'source_url',
  ];

  const rows = un.map((it) => {
    const p = propose(it);
    return {
      title: it.title,
      segment: it.segment,
      brand: it.brand,
      model: it.model,
      current_type_lead: typeText(it),
      proposed_type_lead: p.proposedType,
      proposed_class_id: p.classId,
      proposed_class_ru: p.classRu,
      notes: p.notes,
      source_url: it.source_url,
    };
  });

  rows.sort(
    (a, b) =>
      a.segment.localeCompare(b.segment) ||
      a.proposed_class_id.localeCompare(b.proposed_class_id) ||
      a.title.localeCompare(b.title, 'ru'),
  );

  fs.writeFileSync(OUT_CSV, writeCsv(header, rows), 'utf8');

  const byClass = {};
  for (const r of rows) {
    byClass[r.proposed_class_id] = (byClass[r.proposed_class_id] || 0) + 1;
  }
  const needsReview = rows.filter((r) => r.proposed_class_id === 'NEEDS_REVIEW').length;

  console.log(
    JSON.stringify(
      {
        written: OUT_CSV,
        count: rows.length,
        NEEDS_REVIEW: needsReview,
        byClass: Object.fromEntries(Object.entries(byClass).sort((a, b) => b[1] - a[1])),
      },
      null,
      2,
    ),
  );
}

main();
