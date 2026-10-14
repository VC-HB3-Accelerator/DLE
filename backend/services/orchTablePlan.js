/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Выборка из фразы + пустые колонки обогащения для живой /tables.
 * Не пишет. Не выдумывает факты в ячейки.
 */

const ENRICH_FOR_CARD = [
  { name: 'card_title', type: 'text', role: 'enrich' },
  { name: 'card_excerpt', type: 'text', role: 'enrich' },
  { name: 'source_url', type: 'text', role: 'enrich' },
];

const ENRICH_DEFAULT = [
  { name: 'notes', type: 'text', role: 'enrich' },
  { name: 'source_url', type: 'text', role: 'enrich' },
];

function looksNumber(value) {
  const raw = String(value || '').trim().replace(/\s/g, '').replace(',', '.');
  if (!raw) return true;
  return /^-?\d+(\.\d+)?$/.test(raw);
}

function inferType(column, rows) {
  const values = (rows || []).map((row) => row[column]).filter((v) => String(v || '').trim());
  if (values.length && values.every(looksNumber)) return 'number';
  return 'text';
}

function normalize(text) {
  return String(text || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\wа-я]+/gi, ' ').trim();
}

function matchColumns(message, columns) {
  const text = normalize(message);
  if (!text || !columns.length) return [];
  if (/все\s+колонк|все\s+столбц|целиком|как\s+есть/i.test(message || '')) return [...columns];
  const hits = columns.filter((col) => {
    const name = normalize(col);
    if (name.length < 2) return false;
    return text.includes(name) || name.split(' ').some((part) => part.length > 2 && text.includes(part));
  });
  const aliases = [
    { re: /модел|model/i, keys: /модел|model/i },
    { re: /бренд|марк|brand/i, keys: /бренд|марк|brand/i },
    { re: /цен|price|стоимость/i, keys: /цен|price|стоим/i },
    { re: /назван|title|имя/i, keys: /назван|title|имя|name/i },
    { re: /артикул|sku|код/i, keys: /артикул|sku|код/i },
  ];
  aliases.forEach((alias) => {
    if (!alias.re.test(message || '')) return;
    columns.forEach((col) => {
      if (alias.keys.test(col) && !hits.includes(col)) hits.push(col);
    });
  });
  return hits;
}

function filterRows(rows, message, columns) {
  const text = String(message || '');
  const only = text.match(/(?:только|выбери|выборк\w*)\s+(.{2,80}?)(?:\.|$)/i);
  if (!only) return rows;
  const needle = normalize(only[1]).split(' ').filter((w) => w.length > 2 && !/только|выбери|колонк|строк|данн|таблиц/.test(w));
  if (!needle.length) return rows;
  const filtered = rows.filter((row) => {
    const blob = normalize(columns.map((col) => row[col] || '').join(' '));
    return needle.every((word) => blob.includes(word));
  });
  return filtered.length ? filtered : rows;
}

function enrichColumns(message, used) {
  const taken = new Set(used.map((c) => normalize(c)));
  const wantsCard = /карточк|объявлен|магазин|витрин/i.test(message || '');
  const list = wantsCard ? ENRICH_FOR_CARD : ENRICH_DEFAULT;
  return list.filter((col) => !taken.has(normalize(col.name)));
}

function tableName(message, filename) {
  const fromFile = String(filename || '').replace(/\.[^.]+$/, '').trim();
  const named = String(message || '').match(/таблиц\w*\s+(?:для\s+|из\s+)?[«"]?([^.«"]{3,80})/i);
  if (named) return named[1].trim().slice(0, 80);
  return (fromFile || 'Таблица из файла').slice(0, 80);
}

function planFromPreview({ preview = {}, message = '' } = {}) {
  const sourceCols = Array.isArray(preview.columns) ? preview.columns.map((c) => String(c)) : [];
  const sourceRows = Array.isArray(preview.rows) ? preview.rows : [];
  const selected = matchColumns(message, sourceCols);
  const unclear = Boolean(sourceCols.length) && /выбер|оставь|колонк|столбц/i.test(message) && !selected.length
    && !/все\s+колонк|как\s+есть/i.test(message);
  const keep = selected.length ? selected : sourceCols;
  const rows = filterRows(sourceRows, message, keep).map((row) => {
    const next = {};
    keep.forEach((col) => { next[col] = row[col] == null ? '' : String(row[col]); });
    return next;
  });
  const sourceMeta = keep.map((name) => ({
    name,
    type: inferType(name, rows),
    role: 'source',
  }));
  const enrich = enrichColumns(message, keep);
  enrich.forEach((col) => {
    rows.forEach((row) => { if (row[col.name] == null) row[col.name] = ''; });
  });
  const columns = [...sourceMeta, ...enrich];
  const questions = [];
  if (unclear) {
    questions.push({
      id: 'table.columns',
      field: 'table.columns',
      text: 'Какие колонки оставить в таблице? Остальные не перенесу.',
    });
  }
  if (!keep.length) {
    questions.push({
      id: 'empty',
      field: 'file',
      text: 'В файле не видно колонок. Поправьте файл или вставьте таблицу текстом.',
    });
  }
  return {
    ...preview,
    trusted: false,
    table_name: tableName(message, preview.filename),
    description: String(message || '').slice(0, 240),
    columns: columns.map((c) => c.name),
    column_meta: columns,
    rows,
    questions: [...questions, ...(preview.questions || []).filter((q) => q.id !== 'xlsx' && q.id !== 'empty')],
    editor_path: '/tables/create',
  };
}

module.exports = {
  inferType,
  matchColumns,
  filterRows,
  enrichColumns,
  tableName,
  planFromPreview,
};
