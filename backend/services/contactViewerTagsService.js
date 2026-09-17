/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Личные теги зрителя (TZ_CRM_PERSONAL_TAGS): словарь «Мои теги» + contact_viewer_tag_links.
 */

const db = require('../db');
const logger = require('../utils/logger');

const DICT_NAMES = Object.freeze(['Мои теги', 'My tags']);
const COL_NAME_RU = 'Название';
const COL_DESC_RU = 'Описание';
const COL_NAME_EN = 'Name';
const COL_DESC_EN = 'Description';

let tablesReady = false;

async function ensureTables() {
  if (tablesReady) return;
  const q = db.getQuery();
  await q(`
    CREATE TABLE IF NOT EXISTS contact_viewer_tag_links (
      viewer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (viewer_user_id, contact_user_id, tag_id)
    )
  `);
  await q(`
    CREATE INDEX IF NOT EXISTS idx_contact_viewer_tag_links_viewer_tag
      ON contact_viewer_tag_links (viewer_user_id, tag_id)
  `);
  await q(`
    CREATE INDEX IF NOT EXISTS idx_contact_viewer_tag_links_contact
      ON contact_viewer_tag_links (contact_user_id)
  `);
  tablesReady = true;
}

function encryptionKey() {
  return require('../utils/encryptionUtils').getEncryptionKey();
}

async function findMyTagsTableId(viewerUserId) {
  const vid = Number(viewerUserId);
  if (!Number.isInteger(vid) || vid <= 0) return null;
  const key = encryptionKey();
  const { rows } = await db.getQuery()(
    `SELECT id
     FROM user_tables
     WHERE created_by = $1
       AND decrypt_text(name_encrypted, $2) = ANY($3::text[])
     ORDER BY id ASC
     LIMIT 1`,
    [vid, key, DICT_NAMES]
  );
  return rows[0]?.id ? Number(rows[0].id) : null;
}

async function ensureMyTagsDictionary(viewerUserId) {
  await ensureTables();
  const vid = Number(viewerUserId);
  if (!Number.isInteger(vid) || vid <= 0) {
    throw new Error('Invalid viewer');
  }

  let tableId = await findMyTagsTableId(vid);
  const key = encryptionKey();
  const q = db.getQuery();

  if (!tableId) {
    const ins = await q(
      `INSERT INTO user_tables (name_encrypted, description_encrypted, is_rag_source_id, created_by)
       VALUES (encrypt_text($1, $3), encrypt_text($2, $3), 2, $4)
       RETURNING id`,
      [DICT_NAMES[0], 'Личные маркеры для своих контактов', key, vid]
    );
    tableId = Number(ins.rows[0].id);
    await q(
      `INSERT INTO user_columns (table_id, name_encrypted, type_encrypted, placeholder_encrypted, "order", placeholder, options)
       VALUES
         ($1, encrypt_text($2, $4), encrypt_text('text', $4), encrypt_text('nazvanie', $4), 0, 'nazvanie', '{"purpose":"userTags"}'::jsonb),
         ($1, encrypt_text($3, $4), encrypt_text('text', $4), encrypt_text('opisanie', $4), 1, 'opisanie', '{}'::jsonb)`,
      [tableId, COL_NAME_RU, COL_DESC_RU, key]
    );
  } else {
    const cols = await q(
      `SELECT id, decrypt_text(name_encrypted, $2) AS name
       FROM user_columns WHERE table_id = $1`,
      [tableId, key]
    );
    const names = new Set(cols.rows.map((r) => r.name));
    if (![COL_NAME_RU, COL_NAME_EN].some((n) => names.has(n))) {
      await q(
        `INSERT INTO user_columns (table_id, name_encrypted, type_encrypted, placeholder_encrypted, "order", placeholder, options)
         VALUES ($1, encrypt_text($2, $3), encrypt_text('text', $3), encrypt_text('nazvanie', $3), 0, 'nazvanie', '{"purpose":"userTags"}'::jsonb)`,
        [tableId, COL_NAME_RU, key]
      );
    }
    if (![COL_DESC_RU, COL_DESC_EN].some((n) => names.has(n))) {
      await q(
        `INSERT INTO user_columns (table_id, name_encrypted, type_encrypted, placeholder_encrypted, "order", placeholder, options)
         VALUES ($1, encrypt_text($2, $3), encrypt_text('text', $3), encrypt_text('opisanie', $3), 1, 'opisanie', '{}'::jsonb)`,
        [tableId, COL_DESC_RU, key]
      );
    }
  }

  return tableId;
}

function pickNameColumns(columns) {
  const ordered = [];
  const push = (col) => {
    if (col && !ordered.some((c) => c.id === col.id)) ordered.push(col);
  };
  push(columns.find((c) => c.name === COL_NAME_RU || c.name === COL_NAME_EN));
  push(columns.find((c) => c.options && (c.options.purpose === 'userTags' || c.options?.purpose === 'userTags')));
  columns.filter((c) => c.type === 'text').forEach(push);
  return ordered;
}

function pickDescColumn(columns, nameCols) {
  const used = new Set(nameCols.map((c) => c.id));
  const byName = columns.find((c) => c.name === COL_DESC_RU || c.name === COL_DESC_EN);
  if (byName && !used.has(byName.id)) return byName;
  return columns.find((c) => !used.has(c.id) && c.type === 'text') || null;
}

async function listDictionaryTags(viewerUserId) {
  const tableId = await ensureMyTagsDictionary(viewerUserId);
  const key = encryptionKey();
  const q = db.getQuery();

  const [columnsResult, rowsResult, cellValuesResult] = await Promise.all([
    q(
      `SELECT id, decrypt_text(name_encrypted, $2) AS name,
              decrypt_text(type_encrypted, $2) AS type, options
       FROM user_columns WHERE table_id = $1 ORDER BY "order" ASC, id ASC`,
      [tableId, key]
    ),
    q('SELECT id FROM user_rows WHERE table_id = $1 ORDER BY id', [tableId]),
    q(
      `SELECT row_id, column_id, decrypt_text(value_encrypted, $2) AS value
       FROM user_cell_values
       WHERE row_id IN (SELECT id FROM user_rows WHERE table_id = $1)`,
      [tableId, key]
    ),
  ]);

  const columns = columnsResult.rows.map((c) => ({
    ...c,
    options: typeof c.options === 'string' ? JSON.parse(c.options || '{}') : (c.options || {}),
  }));
  const nameCols = pickNameColumns(columns);
  const descCol = pickDescColumn(columns, nameCols);
  const cells = cellValuesResult.rows;

  const cellVal = (rowId, colId) => {
    const hit = cells.find((c) => Number(c.row_id) === Number(rowId) && Number(c.column_id) === Number(colId));
    return hit ? String(hit.value || '').trim() : '';
  };

  return {
    tableId,
    tags: rowsResult.rows
      .map((row) => {
        let name = '';
        for (const col of nameCols) {
          const v = cellVal(row.id, col.id);
          if (v) {
            name = v;
            break;
          }
        }
        const description = descCol ? cellVal(row.id, descCol.id) : '';
        return { id: Number(row.id), name, description };
      })
      .filter((t) => t.name),
  };
}

async function createDictionaryTag(viewerUserId, { name, description = '' } = {}) {
  const label = String(name || '').trim();
  if (!label) {
    throw Object.assign(new Error('name required'), { status: 400 });
  }
  const tableId = await ensureMyTagsDictionary(viewerUserId);
  const key = encryptionKey();
  const q = db.getQuery();

  const cols = (
    await q(
      `SELECT id, decrypt_text(name_encrypted, $2) AS name, decrypt_text(type_encrypted, $2) AS type, options
       FROM user_columns WHERE table_id = $1 ORDER BY "order" ASC, id ASC`,
      [tableId, key]
    )
  ).rows.map((c) => ({
    ...c,
    options: typeof c.options === 'string' ? JSON.parse(c.options || '{}') : (c.options || {}),
  }));

  const nameCols = pickNameColumns(cols);
  const descCol = pickDescColumn(cols, nameCols);
  const nameCol = nameCols[0];
  if (!nameCol) {
    throw Object.assign(new Error('Dictionary name column missing'), { status: 500 });
  }

  const row = (await q('INSERT INTO user_rows (table_id) VALUES ($1) RETURNING id', [tableId])).rows[0];
  await q(
    `INSERT INTO user_cell_values (row_id, column_id, value_encrypted)
     VALUES ($1, $2, encrypt_text($3, $4))
     ON CONFLICT (row_id, column_id) DO UPDATE SET value_encrypted = encrypt_text($3, $4)`,
    [row.id, nameCol.id, label, key]
  );
  if (descCol && description != null && String(description).trim() !== '') {
    await q(
      `INSERT INTO user_cell_values (row_id, column_id, value_encrypted)
       VALUES ($1, $2, encrypt_text($3, $4))
       ON CONFLICT (row_id, column_id) DO UPDATE SET value_encrypted = encrypt_text($3, $4)`,
      [row.id, descCol.id, String(description).trim(), key]
    );
  }

  return { id: Number(row.id), name: label, description: String(description || '').trim(), tableId };
}

async function assertTagsInMyDictionary(viewerUserId, tagIds) {
  const ids = [...new Set((tagIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return [];
  const tableId = await ensureMyTagsDictionary(viewerUserId);
  const { rows } = await db.getQuery()(
    `SELECT id FROM user_rows WHERE table_id = $1 AND id = ANY($2::int[])`,
    [tableId, ids]
  );
  const ok = new Set(rows.map((r) => Number(r.id)));
  const bad = ids.filter((id) => !ok.has(id));
  if (bad.length) {
    throw Object.assign(new Error('tag_id не из словаря «Мои теги»'), { status: 400, badTagIds: bad });
  }
  return ids;
}

async function getMyTagIdsForContact(viewerUserId, contactUserId) {
  await ensureTables();
  const vid = Number(viewerUserId);
  const cid = Number(contactUserId);
  if (!Number.isInteger(vid) || !Number.isInteger(cid)) return [];
  const { rows } = await db.getQuery()(
    `SELECT tag_id FROM contact_viewer_tag_links
     WHERE viewer_user_id = $1 AND contact_user_id = $2
     ORDER BY tag_id`,
    [vid, cid]
  );
  return rows.map((r) => Number(r.tag_id));
}

/**
 * @returns {Promise<Record<number, number[]>>}
 */
async function getMyTagIdsMap(viewerUserId, contactUserIds) {
  await ensureTables();
  const vid = Number(viewerUserId);
  const ids = [...new Set((contactUserIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  const map = {};
  for (const id of ids) map[id] = [];
  if (!Number.isInteger(vid) || vid <= 0 || !ids.length) return map;

  const { rows } = await db.getQuery()(
    `SELECT contact_user_id, tag_id FROM contact_viewer_tag_links
     WHERE viewer_user_id = $1 AND contact_user_id = ANY($2::int[])
     ORDER BY contact_user_id, tag_id`,
    [vid, ids]
  );
  for (const row of rows) {
    if (!map[row.contact_user_id]) map[row.contact_user_id] = [];
    map[row.contact_user_id].push(Number(row.tag_id));
  }
  return map;
}

async function replaceMyTagsOnContact(viewerUserId, contactUserId, tagIds) {
  await ensureTables();
  const vid = Number(viewerUserId);
  const cid = Number(contactUserId);
  const ids = await assertTagsInMyDictionary(vid, tagIds || []);
  const q = db.getQuery();
  await q(
    'DELETE FROM contact_viewer_tag_links WHERE viewer_user_id = $1 AND contact_user_id = $2',
    [vid, cid]
  );
  for (const tagId of ids) {
    await q(
      `INSERT INTO contact_viewer_tag_links (viewer_user_id, contact_user_id, tag_id)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [vid, cid, tagId]
    );
  }
  return ids;
}

async function addMyTagsToContacts(viewerUserId, contactUserIds, tagIds) {
  await ensureTables();
  const vid = Number(viewerUserId);
  const cids = [...new Set((contactUserIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  const ids = await assertTagsInMyDictionary(vid, tagIds || []);
  const q = db.getQuery();
  for (const cid of cids) {
    for (const tagId of ids) {
      await q(
        `INSERT INTO contact_viewer_tag_links (viewer_user_id, contact_user_id, tag_id)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [vid, cid, tagId]
      );
    }
  }
  return { usersUpdated: cids.length, tagsAdded: ids.length };
}

async function removeMyTagsFromContacts(viewerUserId, contactUserIds, tagIds) {
  await ensureTables();
  const vid = Number(viewerUserId);
  const cids = [...new Set((contactUserIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  const ids = [...new Set((tagIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (!cids.length || !ids.length) {
    return { usersUpdated: 0, tagsRemoved: 0 };
  }
  await db.getQuery()(
    `DELETE FROM contact_viewer_tag_links
     WHERE viewer_user_id = $1
       AND contact_user_id = ANY($2::int[])
       AND tag_id = ANY($3::int[])`,
    [vid, cids, ids]
  );
  return { usersUpdated: cids.length, tagsRemoved: ids.length };
}

async function removeMyTagFromContact(viewerUserId, contactUserId, tagId) {
  await ensureTables();
  await db.getQuery()(
    `DELETE FROM contact_viewer_tag_links
     WHERE viewer_user_id = $1 AND contact_user_id = $2 AND tag_id = $3`,
    [Number(viewerUserId), Number(contactUserId), Number(tagId)]
  );
}

/** Каскад при удалении строки словаря «Мои теги». */
async function cascadeDeleteTagRow(tableId, rowId) {
  await ensureTables();
  const tid = Number(tableId);
  const rid = Number(rowId);
  if (!Number.isInteger(tid) || !Number.isInteger(rid)) return 0;

  const key = encryptionKey();
  const { rows: owners } = await db.getQuery()(
    `SELECT created_by, decrypt_text(name_encrypted, $2) AS name
     FROM user_tables WHERE id = $1`,
    [tid, key]
  );
  const owner = owners[0];
  if (!owner || !DICT_NAMES.includes(owner.name) || !owner.created_by) {
    return 0;
  }

  const del = await db.getQuery()(
    `DELETE FROM contact_viewer_tag_links
     WHERE viewer_user_id = $1 AND tag_id = $2`,
    [Number(owner.created_by), rid]
  );
  return del.rowCount || 0;
}

async function isMyTagsTable(tableId) {
  const key = encryptionKey();
  const { rows } = await db.getQuery()(
    `SELECT decrypt_text(name_encrypted, $2) AS name, created_by
     FROM user_tables WHERE id = $1`,
    [Number(tableId), key]
  );
  const row = rows[0];
  return Boolean(row && DICT_NAMES.includes(row.name) && row.created_by);
}

/**
 * Ensure/find tag by name in viewer's dictionary (import).
 * @returns {Promise<number>} tag_id
 */
async function ensureTagByName(viewerUserId, tagName) {
  const label = String(tagName || '').trim();
  if (!label) return null;
  const { tags } = await listDictionaryTags(viewerUserId);
  const existing = tags.find((t) => t.name.toLowerCase() === label.toLowerCase());
  if (existing) return existing.id;
  const created = await createDictionaryTag(viewerUserId, { name: label });
  return created.id;
}

function initialize() {
  ensureTables().catch((error) => {
    logger.warn('[contactViewerTags] ensureTables failed:', error.message);
  });
}

module.exports = {
  DICT_NAMES,
  ensureTables,
  ensureMyTagsDictionary,
  listDictionaryTags,
  createDictionaryTag,
  assertTagsInMyDictionary,
  getMyTagIdsForContact,
  getMyTagIdsMap,
  replaceMyTagsOnContact,
  addMyTagsToContacts,
  removeMyTagsFromContacts,
  removeMyTagFromContact,
  cascadeDeleteTagRow,
  isMyTagsTable,
  ensureTagByName,
  initialize,
};
