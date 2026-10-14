/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Обёртки /tables: те же права, что экран. Писать только владельцу беседы.
 */

function slug(name, used) {
  const base = String(name || 'col')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'col';
  let candidate = base;
  let i = 1;
  while (used.has(candidate)) {
    candidate = `${base}_${i}`;
    i += 1;
  }
  used.add(candidate);
  return candidate;
}

async function createTable({ name, description = '', ragSource = false, ownerUserId }, hooks = {}) {
  const title = String(name || '').trim();
  if (!title) {
    const error = new Error('Как назвать таблицу?');
    error.status = 400;
    error.code = 'TABLE_NAME_REQUIRED';
    throw error;
  }
  const owner = Number(ownerUserId);
  if (!Number.isInteger(owner) || owner <= 0) {
    const error = new Error('Нет владельца беседы');
    error.status = 403;
    error.code = 'OWNER_REQUIRED';
    throw error;
  }
  if (hooks.createTable) {
    const created = await hooks.createTable({ name: title, description, ragSource, ownerUserId: owner });
    return {
      ...created,
      editor_path: created.editor_path || tableEditorPath(created.table_id || created.id),
    };
  }
  const db = require('../db');
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  const { rows } = await db.getQuery()(
    `INSERT INTO user_tables (name_encrypted, description_encrypted, is_rag_source_id, created_by)
     VALUES (encrypt_text($1, $4), encrypt_text($2, $4), $3, $5)
     RETURNING id, created_by, is_rag_source_id`,
    [title, description || null, ragSource ? 1 : 2, encryptionKey, owner]
  );
  return {
    table_id: rows[0].id,
    name: title,
    description: description || null,
    owner_user_id: owner,
    rag_source: ragSource,
    editor_path: tableEditorPath(rows[0].id),
  };
}

function columnType(raw) {
  const type = String(raw || 'text').toLowerCase();
  return ['text', 'number', 'multiselect'].includes(type) ? type : 'text';
}

function tableEditorPath(id) {
  const draftId = id == null || id === '' ? '' : String(id);
  return draftId ? `/tables/${draftId}` : '/tables/create';
}

async function addColumns({ tableId, columns, ownerUserId }, hooks = {}) {
  const specs = (columns || []).map((col) => {
    if (typeof col === 'string') return { name: col, type: 'text' };
    return { name: col?.name, type: columnType(col?.type) };
  }).filter((col) => col.name);
  if (!specs.length) {
    const error = new Error('Какие колонки?');
    error.status = 400;
    error.code = 'COLUMNS_REQUIRED';
    throw error;
  }
  if (hooks.addColumns) {
    return hooks.addColumns({ tableId, columns: specs, ownerUserId });
  }
  const db = require('../db');
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  const existing = (await db.getQuery()(
    'SELECT placeholder FROM user_columns WHERE placeholder IS NOT NULL',
    []
  )).rows.map((row) => row.placeholder).filter(Boolean);
  const used = new Set(existing);
  const created = [];
  for (let i = 0; i < specs.length; i += 1) {
    const name = String(specs[i].name).slice(0, 80);
    const type = columnType(specs[i].type);
    const placeholder = slug(name, used);
    const { rows } = await db.getQuery()(
      `INSERT INTO user_columns (table_id, name_encrypted, type_encrypted, placeholder_encrypted, "order", placeholder, options)
       VALUES ($1, encrypt_text($2, $7), encrypt_text($3, $7), encrypt_text($6, $7), $4, $5, $8)
       RETURNING id, placeholder`,
      [tableId, name, type, i, placeholder, placeholder, encryptionKey, JSON.stringify({})]
    );
    created.push({
      id: rows[0].id,
      name,
      type,
      placeholder: rows[0].placeholder,
    });
  }
  return { table_id: tableId, columns: created, owner_user_id: ownerUserId };
}

async function addRows({ tableId, columns, rows, ownerUserId }, hooks = {}) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    const error = new Error('Нет строк для записи');
    error.status = 400;
    error.code = 'ROWS_REQUIRED';
    throw error;
  }
  if (hooks.addRows) {
    return hooks.addRows({ tableId, columns, rows: list, ownerUserId });
  }
  const db = require('../db');
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  const created = [];
  for (const row of list) {
    const inserted = await db.getQuery()(
      'INSERT INTO user_rows (table_id) VALUES ($1) RETURNING id',
      [tableId]
    );
    const rowId = inserted.rows[0].id;
    for (const col of columns || []) {
      const value = row[col.name] ?? row[col.placeholder] ?? '';
      if (value === '' || value == null) continue;
      await db.getQuery()(
        `INSERT INTO user_cell_values (row_id, column_id, value_encrypted)
         VALUES ($1, $2, encrypt_text($3, $4))
         ON CONFLICT (row_id, column_id) DO UPDATE
           SET value_encrypted = encrypt_text($3, $4), updated_at = NOW()`,
        [rowId, col.id, String(value), encryptionKey]
      );
    }
    created.push({ id: rowId });
  }
  return {
    table_id: tableId,
    row_count: created.length,
    rows: created,
    owner_user_id: ownerUserId,
  };
}

async function assertOwner(tableId, ownerUserId) {
  const owner = Number(ownerUserId);
  const id = Number(tableId);
  if (!Number.isInteger(owner) || owner <= 0) {
    const error = new Error('Нет владельца беседы');
    error.status = 403;
    error.code = 'OWNER_REQUIRED';
    throw error;
  }
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Нет таблицы');
    error.status = 400;
    error.code = 'TABLE_REQUIRED';
    throw error;
  }
  const db = require('../db');
  const { rows } = await db.getQuery()(
    'SELECT created_by FROM user_tables WHERE id = $1',
    [id]
  );
  if (!rows[0]) {
    const error = new Error('Таблица не найдена');
    error.status = 404;
    error.code = 'TABLE_NOT_FOUND';
    throw error;
  }
  if (Number(rows[0].created_by) !== owner) {
    const error = new Error('Чужая таблица');
    error.status = 404;
    error.code = 'TABLE_NOT_FOUND';
    throw error;
  }
  return id;
}

async function loadGrid({ tableId, ownerUserId }, hooks = {}) {
  if (hooks.loadGrid) return hooks.loadGrid({ tableId, ownerUserId });
  const id = await assertOwner(tableId, ownerUserId);
  const db = require('../db');
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  const [cols, rows, cells] = await Promise.all([
    db.getQuery()(
      `SELECT id, decrypt_text(name_encrypted, $2) as name,
              decrypt_text(type_encrypted, $2) as type
       FROM user_columns WHERE table_id = $1 ORDER BY "order" ASC, id ASC`,
      [id, encryptionKey]
    ),
    db.getQuery()('SELECT id FROM user_rows WHERE table_id = $1 ORDER BY id', [id]),
    db.getQuery()(
      `SELECT row_id, column_id, decrypt_text(value_encrypted, $2) as value
       FROM user_cell_values
       WHERE row_id IN (SELECT id FROM user_rows WHERE table_id = $1)`,
      [id, encryptionKey]
    ),
  ]);
  const columns = cols.rows.map((col) => ({
    id: col.id,
    name: col.name,
    type: col.type || 'text',
  }));
  const byRow = new Map();
  cells.rows.forEach((cell) => {
    if (!byRow.has(cell.row_id)) byRow.set(cell.row_id, {});
    const col = columns.find((item) => Number(item.id) === Number(cell.column_id));
    if (col) byRow.get(cell.row_id)[col.name] = cell.value || '';
  });
  return {
    table_id: id,
    columns,
    rows: rows.rows.map((row, index) => {
      const values = byRow.get(row.id) || {};
      const cellsMap = {};
      columns.forEach((col) => { cellsMap[col.name] = values[col.name] || ''; });
      return { id: row.id, index, cells: cellsMap };
    }),
  };
}

async function applyPatches({ tableId, patches, ownerUserId }, hooks = {}) {
  if (hooks.applyPatches) return hooks.applyPatches({ tableId, patches, ownerUserId });
  const id = await assertOwner(tableId, ownerUserId);
  const db = require('../db');
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  let count = 0;
  for (const patch of patches || []) {
    const rowId = Number(patch.row_id);
    const columnId = Number(patch.column_id);
    const value = String(patch.value || '').trim();
    if (!rowId || !columnId || !value) continue;
    await db.getQuery()(
      `INSERT INTO user_cell_values (row_id, column_id, value_encrypted)
       VALUES ($1, $2, encrypt_text($3, $4))
       ON CONFLICT (row_id, column_id) DO UPDATE
         SET value_encrypted = encrypt_text($3, $4), updated_at = NOW()`,
      [rowId, columnId, value, encryptionKey]
    );
    count += 1;
  }
  return { table_id: id, count };
}

module.exports = {
  createTable,
  addColumns,
  addRows,
  loadGrid,
  applyPatches,
  tableEditorPath,
  columnType,
};
