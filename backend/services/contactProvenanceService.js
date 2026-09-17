/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * contact_provenance: членство контакта в списке зрителя (TZ_CRM_MULTI_LIST).
 * PK (contact_user_id, imported_by) — один человек в нескольких списках.
 */

const db = require('../db');
const logger = require('../utils/logger');
const identityService = require('./identity-service');

let schemaReady = false;

function extractDomain(email) {
  if (!email || typeof email !== 'string') return null;
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

async function ownerDomainFromUserId(userId) {
  if (!userId) return null;
  try {
    const email = await identityService.getPrimaryIdentityValue(userId, 'email');
    return extractDomain(email);
  } catch (error) {
    logger.warn('[contactProvenance] ownerDomainFromUserId:', error.message);
    return null;
  }
}

/**
 * Миграция: старый PK(contact_user_id) → PK(contact_user_id, imported_by).
 */
async function ensureMultiListSchema() {
  if (schemaReady) return;
  const q = db.getQuery();

  await q(`
    CREATE TABLE IF NOT EXISTS contact_provenance (
      contact_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      imported_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_domain TEXT,
      source VARCHAR(32) NOT NULL DEFAULT 'import',
      job_id INTEGER REFERENCES contact_import_jobs(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (contact_user_id, imported_by)
    )
  `);

  // Старая схема: PK только contact_user_id
  const { rows: pkCols } = await q(`
    SELECT a.attname
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = 'contact_provenance'::regclass AND i.indisprimary
    ORDER BY a.attnum
  `);
  const pkNames = pkCols.map((r) => r.attname);

  if (pkNames.length === 1 && pkNames[0] === 'contact_user_id') {
    logger.info('[contactProvenance] migrating PK to (contact_user_id, imported_by)');
    await q(`DELETE FROM contact_provenance WHERE imported_by IS NULL`);
    await q(`ALTER TABLE contact_provenance DROP CONSTRAINT contact_provenance_pkey`);
    await q(`ALTER TABLE contact_provenance ALTER COLUMN imported_by SET NOT NULL`);
    // на случай дубликатов после ручных правок — оставить одну строку на пару
    await q(`
      DELETE FROM contact_provenance a
      USING contact_provenance b
      WHERE a.ctid < b.ctid
        AND a.contact_user_id = b.contact_user_id
        AND a.imported_by = b.imported_by
    `);
    await q(`
      ALTER TABLE contact_provenance
      ADD CONSTRAINT contact_provenance_pkey PRIMARY KEY (contact_user_id, imported_by)
    `);
  } else if (!pkNames.length) {
    await q(`DELETE FROM contact_provenance WHERE imported_by IS NULL`);
    try {
      await q(`ALTER TABLE contact_provenance ALTER COLUMN imported_by SET NOT NULL`);
    } catch (_) { /* already */ }
    await q(`
      ALTER TABLE contact_provenance
      ADD CONSTRAINT contact_provenance_pkey PRIMARY KEY (contact_user_id, imported_by)
    `);
  }

  await q(`
    CREATE INDEX IF NOT EXISTS idx_contact_provenance_imported_by
      ON contact_provenance (imported_by)
  `);
  await q(`
    CREATE INDEX IF NOT EXISTS idx_contact_provenance_owner_domain
      ON contact_provenance (owner_domain)
  `);

  schemaReady = true;
}

/**
 * @param {object} p
 * @param {number} p.contactUserId
 * @param {number} p.importedBy — обязателен (владелец списка)
 * @param {string|null} p.ownerDomain
 * @param {string} [p.source]
 * @param {number|null} [p.jobId]
 */
async function upsertProvenance({
  contactUserId,
  importedBy = null,
  ownerDomain = null,
  source = 'import',
  jobId = null,
}) {
  await ensureMultiListSchema();
  const cid = Number(contactUserId);
  const iid = Number(importedBy);
  if (!Number.isInteger(cid) || cid <= 0) return null;
  if (!Number.isInteger(iid) || iid <= 0) {
    logger.warn('[contactProvenance] upsert without importedBy skipped');
    return null;
  }

  const { rows } = await db.getQuery()(
    `INSERT INTO contact_provenance (
       contact_user_id, imported_by, owner_domain, source, job_id
     ) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (contact_user_id, imported_by) DO UPDATE SET
       owner_domain = COALESCE(EXCLUDED.owner_domain, contact_provenance.owner_domain),
       source = COALESCE(NULLIF(EXCLUDED.source, ''), contact_provenance.source),
       job_id = COALESCE(EXCLUDED.job_id, contact_provenance.job_id),
       updated_at = NOW()
     RETURNING *`,
    [
      cid,
      iid,
      ownerDomain || null,
      String(source || 'import').slice(0, 32),
      jobId ? Number(jobId) : null,
    ]
  );
  return rows[0] || null;
}

async function recordImportProvenance({ contactUserId, importedBy, jobId = null }) {
  if (!contactUserId || !importedBy) return null;
  const ownerDomain = await ownerDomainFromUserId(importedBy);
  return upsertProvenance({
    contactUserId,
    importedBy,
    ownerDomain,
    source: 'import',
    jobId,
  });
}

/** Ручное создание / attach — source=manual. */
async function recordManualCreateProvenance({ contactUserId, createdBy }) {
  if (!contactUserId || !createdBy) return null;
  const ownerDomain = await ownerDomainFromUserId(createdBy);
  return upsertProvenance({
    contactUserId,
    importedBy: createdBy,
    ownerDomain,
    source: 'manual',
    jobId: null,
  });
}

/** Убрать контакт из списка зрителя (не удаляя users). */
async function unlinkFromViewerList(contactUserId, viewerUserId) {
  await ensureMultiListSchema();
  const cid = Number(contactUserId);
  const vid = Number(viewerUserId);
  if (!Number.isInteger(cid) || !Number.isInteger(vid)) {
    return { unlinked: false };
  }

  const del = await db.getQuery()(
    `DELETE FROM contact_provenance
     WHERE contact_user_id = $1 AND imported_by = $2`,
    [cid, vid]
  );

  // Личные данные зрителя
  try {
    await db.getQuery()(
      `DELETE FROM contact_viewer_fields WHERE viewer_user_id = $1 AND contact_user_id = $2`,
      [vid, cid]
    );
  } catch (_) { /* table may miss */ }
  try {
    await db.getQuery()(
      `DELETE FROM contact_viewer_tag_links WHERE viewer_user_id = $1 AND contact_user_id = $2`,
      [vid, cid]
    );
  } catch (_) { /* */ }
  try {
    const filesSvc = require('./contactViewerFilesService');
    await filesSvc.deleteAllForViewerContact(vid, cid);
  } catch (_) { /* */ }

  return { unlinked: (del.rowCount || 0) > 0 };
}

async function isInViewerList(contactUserId, viewerUserId) {
  await ensureMultiListSchema();
  const { rows } = await db.getQuery()(
    `SELECT 1 FROM contact_provenance
     WHERE contact_user_id = $1 AND imported_by = $2
     LIMIT 1`,
    [Number(contactUserId), Number(viewerUserId)]
  );
  return Boolean(rows[0]);
}

/**
 * Backfill provenance для контактов без записи (TZ §6.3).
 */
async function backfillFromCompletedImportJobs() {
  const accessResolver = require('./accessResolverService');
  await accessResolver.ensureTables();
  await ensureMultiListSchema();

  const { rows: orphans } = await db.getQuery()(
    `SELECT u.id, u.created_at
     FROM users u
     WHERE NOT EXISTS (
       SELECT 1 FROM contact_provenance cp WHERE cp.contact_user_id = u.id
     )
     AND EXISTS (
       SELECT 1 FROM user_identities ui WHERE ui.user_id = u.id
     )
     ORDER BY u.id ASC
     LIMIT 2000`
  );

  if (!orphans.length) {
    return { orphans: 0, written: 0 };
  }

  let written = 0;
  for (const orphan of orphans) {
    const { rows: jobs } = await db.getQuery()(
      `SELECT id, requested_by
       FROM contact_import_jobs
       WHERE status = 'done'
         AND requested_by IS NOT NULL
         AND started_at IS NOT NULL
         AND finished_at IS NOT NULL
         AND started_at <= $1
         AND finished_at >= $1
       ORDER BY id DESC
       LIMIT 1`,
      [orphan.created_at]
    );
    const job = jobs[0];
    if (!job) continue;

    const rec = await recordImportProvenance({
      contactUserId: orphan.id,
      importedBy: job.requested_by,
      jobId: job.id,
    });
    if (rec) written += 1;
  }

  if (written) {
    logger.info(`[contactProvenance] backfill: ${written} из ${orphans.length} контактов без provenance`);
  }
  return { orphans: orphans.length, written };
}

async function initialize() {
  try {
    await ensureMultiListSchema();
  } catch (error) {
    logger.warn('[contactProvenance] ensureMultiListSchema:', error.message);
  }
  backfillFromCompletedImportJobs().catch((error) => {
    logger.warn('[contactProvenance] backfill failed:', error.message);
  });
}

module.exports = {
  extractDomain,
  ownerDomainFromUserId,
  ensureMultiListSchema,
  upsertProvenance,
  recordImportProvenance,
  recordManualCreateProvenance,
  unlinkFromViewerList,
  isInViewerList,
  backfillFromCompletedImportJobs,
  initialize,
};
