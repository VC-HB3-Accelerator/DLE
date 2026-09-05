/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const db = require('../db');
const logger = require('../utils/logger');
const identityService = require('./identity-service');

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
 * @param {object} p
 * @param {number} p.contactUserId
 * @param {number|null} p.importedBy
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
  const cid = Number(contactUserId);
  if (!Number.isInteger(cid) || cid <= 0) return null;

  const { rows } = await db.getQuery()(
    `INSERT INTO contact_provenance (
       contact_user_id, imported_by, owner_domain, source, job_id
     ) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (contact_user_id) DO UPDATE SET
       imported_by = COALESCE(contact_provenance.imported_by, EXCLUDED.imported_by),
       owner_domain = COALESCE(contact_provenance.owner_domain, EXCLUDED.owner_domain),
       source = COALESCE(NULLIF(EXCLUDED.source, ''), contact_provenance.source),
       job_id = COALESCE(EXCLUDED.job_id, contact_provenance.job_id),
       updated_at = NOW()
     RETURNING *`,
    [
      cid,
      importedBy ? Number(importedBy) : null,
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

/**
 * Backfill provenance для контактов без записи (TZ §6.3).
 * Эвристика: user создан между started_at и finished_at done-job → imported_by = requested_by.
 */
async function backfillFromCompletedImportJobs() {
  const accessResolver = require('./accessResolverService');
  await accessResolver.ensureTables();

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
  backfillFromCompletedImportJobs().catch((error) => {
    logger.warn('[contactProvenance] backfill failed:', error.message);
  });
}

module.exports = {
  extractDomain,
  ownerDomainFromUserId,
  upsertProvenance,
  recordImportProvenance,
  backfillFromCompletedImportJobs,
  initialize,
};
