/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Личные имя/комментарий зрителя к контакту (TZ_CRM_PERSONAL_FIELDS).
 */

const db = require('../db');
const logger = require('../utils/logger');

let tablesReady = false;

async function ensureTables() {
  if (tablesReady) return;
  const pool = db.getQuery();
  await pool(`
    CREATE TABLE IF NOT EXISTS contact_viewer_fields (
      viewer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      display_name_encrypted TEXT,
      comment_encrypted TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (viewer_user_id, contact_user_id)
    )
  `);
  await pool(`
    CREATE INDEX IF NOT EXISTS idx_contact_viewer_fields_contact
      ON contact_viewer_fields (contact_user_id)
  `);
  tablesReady = true;
}

function normalizeViewerContactIds(viewerUserId, contactUserIds) {
  const viewerId = Number(viewerUserId);
  const ids = [...new Set(
    (contactUserIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
  )];
  return {
    viewerId: Number.isInteger(viewerId) && viewerId > 0 ? viewerId : null,
    ids
  };
}

/**
 * @returns {Promise<Record<number, { displayName: string|null, comment: string|null }>>}
 */
async function getFieldsMapForViewer(viewerUserId, contactUserIds, encryptionKey) {
  await ensureTables();
  const { viewerId, ids } = normalizeViewerContactIds(viewerUserId, contactUserIds);
  const map = {};
  for (const id of ids) {
    map[id] = { displayName: null, comment: null };
  }
  if (!viewerId || !ids.length || !encryptionKey) return map;

  const { rows } = await db.getQuery()(
    `SELECT contact_user_id,
      CASE WHEN display_name_encrypted IS NULL OR display_name_encrypted = '' THEN NULL
           ELSE decrypt_text(display_name_encrypted, $3) END AS display_name,
      CASE WHEN comment_encrypted IS NULL OR comment_encrypted = '' THEN NULL
           ELSE decrypt_text(comment_encrypted, $3) END AS comment
     FROM contact_viewer_fields
     WHERE viewer_user_id = $1 AND contact_user_id = ANY($2::int[])`,
    [viewerId, ids, encryptionKey]
  );

  for (const row of rows) {
    map[row.contact_user_id] = {
      displayName: row.display_name || null,
      comment: row.comment || null
    };
  }
  return map;
}

async function upsertFields(viewerUserId, contactUserId, payload, encryptionKey) {
  await ensureTables();
  const viewerId = Number(viewerUserId);
  const contactId = Number(contactUserId);
  if (!Number.isInteger(viewerId) || viewerId <= 0 || !Number.isInteger(contactId) || contactId <= 0) {
    throw new Error('Invalid viewer/contact id');
  }
  if (!encryptionKey) {
    throw new Error('Encryption key required');
  }

  const sets = [];
  const insertCols = ['viewer_user_id', 'contact_user_id'];
  const insertVals = ['$1', '$2'];
  const params = [viewerId, contactId];
  let idx = 3;

  const hasName = Object.prototype.hasOwnProperty.call(payload, 'displayName')
    || Object.prototype.hasOwnProperty.call(payload, 'name');
  const hasComment = Object.prototype.hasOwnProperty.call(payload, 'comment');

  if (hasName) {
    const raw = payload.displayName !== undefined ? payload.displayName : payload.name;
    const displayName = raw == null ? null : (String(raw).trim() || null);
    insertCols.push('display_name_encrypted');
    insertVals.push(`CASE WHEN $${idx}::text IS NULL THEN NULL ELSE encrypt_text($${idx}, $${idx + 1}) END`);
    params.push(displayName, encryptionKey);
    sets.push(`display_name_encrypted = CASE WHEN $${idx}::text IS NULL THEN NULL ELSE encrypt_text($${idx}, $${idx + 1}) END`);
    idx += 2;
  }

  if (hasComment) {
    const comment = payload.comment == null ? null : (String(payload.comment).trim() || null);
    insertCols.push('comment_encrypted');
    insertVals.push(`CASE WHEN $${idx}::text IS NULL THEN NULL ELSE encrypt_text($${idx}, $${idx + 1}) END`);
    params.push(comment, encryptionKey);
    sets.push(`comment_encrypted = CASE WHEN $${idx}::text IS NULL THEN NULL ELSE encrypt_text($${idx}, $${idx + 1}) END`);
    idx += 2;
  }

  if (!sets.length) {
    throw new Error('Нет данных для обновления');
  }

  sets.push('updated_at = NOW()');

  await db.getQuery()(
    `INSERT INTO contact_viewer_fields (${insertCols.join(', ')})
     VALUES (${insertVals.join(', ')})
     ON CONFLICT (viewer_user_id, contact_user_id) DO UPDATE SET
       ${sets.join(', ')}`,
    params
  );
}

async function isImportedByViewer(viewerUserId, contactUserId) {
  const viewerId = Number(viewerUserId);
  const contactId = Number(contactUserId);
  if (!Number.isInteger(viewerId) || !Number.isInteger(contactId)) return false;
  const { rows } = await db.getQuery()(
    `SELECT 1 FROM contact_provenance
     WHERE contact_user_id = $1 AND imported_by = $2
     LIMIT 1`,
    [contactId, viewerId]
  );
  return Boolean(rows[0]);
}

/**
 * Имя для ответа: личное → системное.
 * Комментарий: личный; editor видит shared; lazy-copy shared→personal для импортёра.
 */
async function applyOverlayToContacts(viewerUserId, contacts, encryptionKey, { isPlatformEditor = false } = {}) {
  if (!Array.isArray(contacts) || !contacts.length) return contacts;
  await ensureTables();
  const ids = contacts.map((c) => c.id).filter((id) => !String(id).startsWith('guest_'));
  const personalMap = await getFieldsMapForViewer(viewerUserId, ids, encryptionKey);

  for (const contact of contacts) {
    if (String(contact.id).startsWith('guest_')) continue;
    const cid = Number(contact.id);
    const personal = personalMap[cid] || { displayName: null, comment: null };
    const systemName = contact.name || null;
    contact.system_name = systemName;
    contact.name = personal.displayName || systemName;

    if (isPlatformEditor) {
      contact.crm_comment = personal.comment != null ? personal.comment : (contact.crm_comment ?? null);
    } else if (personal.comment != null) {
      contact.crm_comment = personal.comment;
    } else if (contact.crm_comment) {
      let migrated = null;
      try {
        if (await isImportedByViewer(viewerUserId, cid)) {
          await upsertFields(viewerUserId, cid, { comment: contact.crm_comment }, encryptionKey);
          migrated = contact.crm_comment;
        }
      } catch (err) {
        logger.warn('[contactViewerFields] lazy comment migrate:', err.message);
      }
      contact.crm_comment = migrated;
    } else {
      contact.crm_comment = null;
    }

    if (!isPlatformEditor) {
      contact.tag_ids = [];
      contact.crm_files = [];
    }
  }
  return contacts;
}

function initialize() {
  ensureTables().catch((error) => {
    logger.warn('[contactViewerFields] ensureTables failed:', error.message);
  });
}

module.exports = {
  ensureTables,
  getFieldsMapForViewer,
  upsertFields,
  isImportedByViewer,
  applyOverlayToContacts,
  initialize,
};
