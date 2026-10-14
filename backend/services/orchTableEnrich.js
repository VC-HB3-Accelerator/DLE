/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Обогащение /tables поиском: сначала дифф, запись только при apply.
 * Пустые ячейки. Не затирает уже заполненное. Не выдумывает без источника.
 */

const MAX_ROWS = 8;

function wantsTableEnrich(message) {
  return /обогат|дополни\s+поиск|заполни\s+пуст|найди\s+в\s+сети/i.test(String(message || ''));
}

function extractTableId(message) {
  const raw = String(message || '');
  const match = raw.match(/\/tables\/(\d+)/i)
    || raw.match(/таблиц[а-яё]*\s*#?(\d+)/i)
    || raw.match(/#(\d+)/);
  const id = Number(match?.[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function usableSources(sources) {
  return (Array.isArray(sources) ? sources : []).filter((row) => {
    const blob = `${row?.url || ''} ${row?.title || ''} ${row?.snippet || ''}`;
    return !/enable-javascript|smart-captcha|captcha|consent\.google|showcaptcha/i.test(blob);
  });
}

function isEnrichName(name) {
  return /notes|source_url|card_|обогат|snippet|описан|excerpt/i.test(String(name || ''));
}

function enrichColumns(columns, rows) {
  const named = columns.filter((col) => isEnrichName(col.name));
  if (named.length) return named;
  return columns.filter((col) => rows.every((row) => !String(row.cells?.[col.name] || '').trim()));
}

function sourceColumns(columns, enrich) {
  const skip = new Set(enrich.map((col) => col.name));
  return columns.filter((col) => !skip.has(col.name));
}

function valueForColumn(column, source) {
  const name = String(column.name || '');
  if (/source_url|url|ссылк/i.test(name)) return String(source.url || '').slice(0, 500);
  if (/title|назван|card_title/i.test(name)) return String(source.title || '').slice(0, 200);
  return String(source.snippet || source.title || '').slice(0, 400);
}

function rowQuery(row, identityCols) {
  return identityCols
    .map((col) => String(row.cells?.[col.name] || '').trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 160);
}

function gridFromPreview(preview = {}) {
  const meta = Array.isArray(preview.column_meta) && preview.column_meta.length
    ? preview.column_meta
    : (preview.columns || []).map((name) => ({ name, type: 'text' }));
  const columns = meta.map((col, i) => ({
    id: col.id || null,
    name: col.name,
    type: col.type || 'text',
    role: col.role || (isEnrichName(col.name) ? 'enrich' : 'source'),
    index: i,
  }));
  const rows = (preview.rows || []).map((row, i) => {
    const cells = {};
    columns.forEach((col) => { cells[col.name] = row[col.name] == null ? '' : String(row[col.name]); });
    return { id: row.id || row.row_id || null, index: i, cells };
  });
  return { columns, rows, table_id: preview.table_id || null };
}

async function searchOne(query, ownerUserId, hooks) {
  if (!query) return [];
  if (typeof hooks.searchPages === 'function') {
    const res = await hooks.searchPages({ query, ownerUserId });
    return usableSources(res?.sources || []);
  }
  if (process.env.NODE_TEST_CONTEXT) return [];
  try {
    const res = await require('./orchPageSearch').searchPages({ query, ownerUserId });
    return usableSources(res?.sources || []);
  } catch {
    return [];
  }
}

async function propose({ preview, tableId, message, ownerUserId } = {}, hooks = {}) {
  const tables = hooks.tables || require('./orchTablesTools');
  let grid = tableId
    ? await tables.loadGrid({ tableId, ownerUserId })
    : gridFromPreview(preview || {});
  const enrich = enrichColumns(grid.columns, grid.rows);
  const identity = sourceColumns(grid.columns, enrich);
  if (!enrich.length) {
    return {
      kind: 'table_enrich',
      apply: false,
      table_id: grid.table_id || tableId || null,
      diff: [],
      questions: [{
        id: 'table.enrich_cols',
        field: 'table.enrich_cols',
        text: 'Нет пустых колонок для обогащения. Добавьте notes или source_url.',
      }],
      reply: 'Нечего обогащать: нет пустых полей под поиск.',
    };
  }
  const diff = [];
  const slice = grid.rows.slice(0, MAX_ROWS);
  for (const row of slice) {
    const query = rowQuery(row, identity) || String(message || '').slice(0, 160);
    const sources = await searchOne(query, ownerUserId, hooks);
    const hit = sources[0];
    if (!hit) continue;
    for (const col of enrich) {
      const before = String(row.cells?.[col.name] || '').trim();
      if (before) continue;
      const after = valueForColumn(col, hit).trim();
      if (!after) continue;
      diff.push({
        row_id: row.id || null,
        row_index: row.index,
        column: col.name,
        column_id: col.id || null,
        before: '',
        after,
        source: {
          system: hit.system || null,
          url: hit.url || null,
          title: hit.title || null,
        },
      });
    }
  }
  return {
    kind: 'table_enrich',
    apply: false,
    table_id: grid.table_id || tableId || null,
    can_apply: Boolean((grid.table_id || tableId) && diff.some((item) => item.row_id && item.column_id)),
    diff,
    questions: [],
    reply: diff.length
      ? `Нашёл ${diff.length} заполнений из поиска. Запись — отдельным согласием.`
      : 'Поиск не дал годных источников для пустых ячеек.',
  };
}

async function apply({ tableId, patches, ownerUserId } = {}, hooks = {}) {
  const id = Number(tableId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Нет таблицы для записи обогащения');
    error.status = 400;
    error.code = 'TABLE_REQUIRED';
    throw error;
  }
  const list = (Array.isArray(patches) ? patches : []).filter((item) => (
    item.row_id && item.column_id && String(item.after || '').trim()
  ));
  if (!list.length) {
    const error = new Error('Нет принятых изменений');
    error.status = 400;
    error.code = 'ENRICH_EMPTY';
    throw error;
  }
  const tables = hooks.tables || require('./orchTablesTools');
  const written = await tables.applyPatches({
    tableId: id,
    patches: list.map((item) => ({
      row_id: item.row_id,
      column_id: item.column_id,
      value: String(item.after).trim(),
    })),
    ownerUserId,
  });
  return {
    kind: 'table_enrich',
    apply: true,
    table_id: id,
    written: written.count,
    editor_path: tables.tableEditorPath(id),
    reply: `Записал ${written.count} ячеек из поиска. Выкладки нет.`,
  };
}

module.exports = {
  MAX_ROWS,
  wantsTableEnrich,
  extractTableId,
  usableSources,
  enrichColumns,
  gridFromPreview,
  propose,
  apply,
};
