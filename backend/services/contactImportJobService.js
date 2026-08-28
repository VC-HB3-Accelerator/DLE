/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Фоновая очередь импорта контактов (Postgres job + in-process worker).
 * Паттерн как contactSiteParserService: jobChain, cancel flag, orphan cleanup.
 */

const db = require('../db');
const logger = require('../utils/logger');
const { ROLES } = require('../shared/permissions');
const {
  prepareImportIdentities,
  buildParasiteHostSet,
  rankWebsitesForImport,
  websiteHostname
} = require('../utils/contactImportMulti');
const { createLivenessCache } = require('../utils/contactImportWebsiteLiveness');
const identityService = require('./identity-service');
const userContactFilesService = require('./userContactFilesService');
const { broadcastContactsUpdate } = require('../wsHub');

const MAX_CONTACTS_PER_JOB = 100000;
const ERRORS_CAP = 200;
const PROGRESS_EVERY = 5;
const PROGRESS_MIN_MS = 1500;
const CONTACTS_UPDATE_EVERY = 200;

/** @type {Promise<void>} */
let jobChain = Promise.resolve();
/** @type {Set<number>} */
const cancelledJobIds = new Set();

function requestCancelJob(jobId) {
  const id = Number(jobId);
  if (!Number.isInteger(id) || id <= 0) return false;
  cancelledJobIds.add(id);
  return true;
}

function clearCancelFlag(jobId) {
  cancelledJobIds.delete(Number(jobId));
}

function isJobCancelled(jobId) {
  return cancelledJobIds.has(Number(jobId));
}

async function isCancelRequested(jobId) {
  const id = Number(jobId);
  if (isJobCancelled(id)) return true;
  try {
    const { rows } = await db.getQuery()(
      'SELECT status FROM contact_import_jobs WHERE id = $1',
      [id]
    );
    return String(rows[0]?.status || '') === 'cancelled';
  } catch {
    return isJobCancelled(id);
  }
}

function mapJobRow(row) {
  if (!row) return null;
  const errors = Array.isArray(row.errors) ? row.errors : [];
  return {
    id: row.id,
    status: row.status,
    requested_by: row.requested_by,
    total: Number(row.total) || 0,
    processed: Number(row.processed) || 0,
    added: Number(row.added) || 0,
    updated: Number(row.updated) || 0,
    errorsTotal: Number(row.errors_total) || 0,
    errors,
    error_summary: row.error_summary || null,
    created_at: row.created_at,
    started_at: row.started_at,
    finished_at: row.finished_at,
    // payload не отдаём клиенту
    percent: (() => {
      const total = Number(row.total) || 0;
      const processed = Number(row.processed) || 0;
      if (total <= 0 || processed <= 0) return 0;
      if (processed >= total) return 100;
      // для больших файлов 13/100000 = 0% — показываем минимум 1%, пока идёт работа
      return Math.max(1, Math.floor((processed * 100) / total));
    })()
  };
}

async function getJob(jobId) {
  const { rows } = await db.getQuery()(
    `SELECT id, status, requested_by, total, processed, added, updated,
            errors_total, errors, error_summary, created_at, started_at, finished_at
     FROM contact_import_jobs WHERE id = $1`,
    [jobId]
  );
  return mapJobRow(rows[0]);
}

async function updateJob(jobId, patch) {
  await db.getQuery()(
    `UPDATE contact_import_jobs SET
       status = COALESCE($2, status),
       processed = COALESCE($3, processed),
       added = COALESCE($4, added),
       updated = COALESCE($5, updated),
       errors_total = COALESCE($6, errors_total),
       errors = COALESCE($7::jsonb, errors),
       error_summary = COALESCE($8, error_summary),
       started_at = COALESCE($9, started_at),
       finished_at = COALESCE($10, finished_at),
       payload = CASE WHEN $11::boolean THEN '[]'::jsonb ELSE payload END
     WHERE id = $1`,
    [
      jobId,
      patch.status || null,
      patch.processed ?? null,
      patch.added ?? null,
      patch.updated ?? null,
      patch.errors_total ?? null,
      patch.errors != null ? JSON.stringify(patch.errors) : null,
      patch.error_summary || null,
      patch.started_at || null,
      patch.finished_at || null,
      patch.clearPayload === true
    ]
  );
}

/**
 * requested_by → реальный users.id.
 * После сброса/перенумерации id в JWT может остаться старый — FK падает.
 */
async function resolveRequestedBy(requestedBy) {
  const id = Number(requestedBy);
  if (Number.isInteger(id) && id > 0) {
    const { rows } = await db.getQuery()('SELECT id FROM users WHERE id = $1', [id]);
    if (rows[0]) return rows[0].id;
    logger.warn(`[ContactImportJob] stale requested_by=${id}, remapping to editor`);
  }
  const { rows: editors } = await db.getQuery()(
    `SELECT id FROM users WHERE role = 'editor' ORDER BY id ASC LIMIT 1`
  );
  if (editors[0]) return editors[0].id;
  return null;
}

async function createJob({ contacts, requestedBy = null }) {
  if (!Array.isArray(contacts)) {
    const err = new Error('Ожидается массив контактов');
    err.status = 400;
    throw err;
  }
  if (!contacts.length) {
    const err = new Error('Список контактов пуст');
    err.status = 400;
    throw err;
  }
  if (contacts.length > MAX_CONTACTS_PER_JOB) {
    const err = new Error(
      `Слишком много строк за раз (макс. ${MAX_CONTACTS_PER_JOB}). Разбейте файл на части.`
    );
    err.status = 400;
    throw err;
  }

  const safeRequestedBy = await resolveRequestedBy(requestedBy);

  const { rows } = await db.getQuery()(
    `INSERT INTO contact_import_jobs (
       status, requested_by, total, payload
     ) VALUES ('pending', $1, $2, $3::jsonb)
     RETURNING id, status, requested_by, total, processed, added, updated,
               errors_total, errors, error_summary, created_at, started_at, finished_at`,
    [safeRequestedBy, contacts.length, JSON.stringify(contacts)]
  );
  return mapJobRow(rows[0]);
}

async function processOneContact(c, encryptionKey, ctx = {}) {
  const parasiteHosts = ctx.parasiteHosts instanceof Set ? ctx.parasiteHosts : new Set();
  const liveness = ctx.liveness || null;

  let first_name = null;
  let last_name = null;
  if (c.name) {
    const parts = String(c.name).trim().split(/\s+/).filter(Boolean);
    first_name = parts[0] || null;
    last_name = parts.slice(1).join(' ') || null;
  }

  const prepared = prepareImportIdentities(c, identityService);
  if (!prepared.hasAny) {
    throw new Error(
      prepared.warnings[0]
        || 'Нет ни одного рабочего идентификатора (email / телефон / сайт / telegram / кошелёк)'
    );
  }

  const { emails, phones, telegram, wallet } = prepared;
  const siteWarnings = [];
  let websites = prepared.websites;

  if (websites.length && liveness) {
    websites = await liveness.filterAliveUrls(websites, {
      onDead: (url) => {
        const host = websiteHostname(url) || url;
        siteWarnings.push(`сайт «${host}»: пропуск (DNS/недоступен)`);
      }
    });
    if (prepared.websites.length && !websites.length) {
      siteWarnings.push('все сайты строки отсеяны как недоступные');
    }
  }

  websites = rankWebsitesForImport(websites, { emails, parasiteHosts });

  if (!emails.length && !phones.length && !websites.length && !telegram && !wallet) {
    throw new Error(
      siteWarnings[0]
        || prepared.warnings[0]
        || 'Нет ни одного рабочего идентификатора (email / телефон / сайт / telegram / кошелёк)'
    );
  }

  const dbq = db.getQuery();

  let userId = null;
  let foundUser = null;
  for (const email of emails) {
    foundUser = await identityService.findUserIdByIdentity('email', email);
    if (foundUser) break;
  }
  if (!foundUser) {
    for (const phone of phones) {
      foundUser = await identityService.findUserIdByIdentity('phone', phone);
      if (foundUser) break;
    }
  }
  if (!foundUser) {
    for (const site of websites) {
      foundUser = await identityService.findUserIdByIdentity('website', site);
      if (foundUser) break;
    }
  }
  if (!foundUser && telegram) {
    foundUser = await identityService.findUserIdByIdentity('telegram', telegram);
  }
  if (!foundUser && wallet) {
    foundUser = await identityService.findUserIdByIdentity('wallet', wallet);
  }

  let added = 0;
  let updated = 0;
  let createdUserId = null;

  if (foundUser) {
    userId = foundUser;
    updated = 1;
    if (first_name || last_name) {
      await dbq(
        `UPDATE users SET
           first_name_encrypted = COALESCE(encrypt_text($1, $4), first_name_encrypted),
           last_name_encrypted = COALESCE(encrypt_text($2, $4), last_name_encrypted)
         WHERE id = $3`,
        [first_name, last_name, userId, encryptionKey]
      );
    }
  } else {
    const ins = await dbq(
      `INSERT INTO users (first_name_encrypted, last_name_encrypted, role, created_at)
       VALUES (encrypt_text($1, $4), encrypt_text($2, $4), $3, NOW())
       RETURNING id`,
      [first_name, last_name, ROLES.USER, encryptionKey]
    );
    userId = ins.rows[0].id;
    createdUserId = userId;
    added = 1;
  }

  if (c.crm_comment !== undefined && c.crm_comment !== null && String(c.crm_comment).trim() !== '') {
    await userContactFilesService.updateContactExtras(userId, {
      comment: String(c.crm_comment)
    }, encryptionKey);
  }

  let savedIdentities = 0;
  const identityErrors = [];

  const tryAdd = async (provider, value, { makePrimary = false } = {}) => {
    const save = await identityService.addContactIdentity(userId, provider, value, {
      label: '',
      makePrimary
    });
    if (save.success) {
      savedIdentities += 1;
      return true;
    }
    identityErrors.push(`${provider}: ${save.error || 'ошибка'}`);
    return false;
  };

  for (const email of emails) await tryAdd('email', email);
  for (const phone of phones) await tryAdd('phone', phone);
  let primarySiteSet = false;
  for (const site of websites) {
    const ok = await tryAdd('website', site, { makePrimary: !primarySiteSet });
    if (ok && !primarySiteSet) primarySiteSet = true;
  }

  if (telegram) {
    const save = await identityService.saveIdentity(userId, 'telegram', telegram, true);
    if (save.success) savedIdentities += 1;
    else identityErrors.push(`telegram: ${save.error || 'ошибка'}`);
  }
  if (wallet) {
    const save = await identityService.saveIdentity(userId, 'wallet', wallet, true);
    if (save.success) savedIdentities += 1;
    else identityErrors.push(`wallet: ${save.error || 'ошибка'}`);
  }

  if (createdUserId && savedIdentities === 0) {
    await dbq('DELETE FROM users WHERE id = $1', [createdUserId]);
    throw new Error(
      identityErrors[0]
        || prepared.warnings[0]
        || 'Не удалось сохранить ни одного рабочего идентификатора'
    );
  }

  const warning = [...prepared.warnings, ...siteWarnings, ...identityErrors].filter(Boolean);
  return {
    added,
    updated,
    warning: warning.length ? warning.slice(0, 8).join('; ') : null
  };
}

async function runJob(jobId) {
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();

  const { rows } = await db.getQuery()(
    'SELECT * FROM contact_import_jobs WHERE id = $1',
    [jobId]
  );
  const job = rows[0];
  if (!job) throw new Error('Job not found');

  if (await isCancelRequested(jobId)) {
    clearCancelFlag(jobId);
    if (String(job.status) !== 'cancelled') {
      await updateJob(jobId, {
        status: 'cancelled',
        error_summary: 'Остановлено пользователем',
        finished_at: new Date().toISOString(),
        clearPayload: true
      });
    }
    return getJob(jobId);
  }

  const contacts = Array.isArray(job.payload) ? job.payload : [];
  if (!contacts.length) {
    await updateJob(jobId, {
      status: 'failed',
      error_summary: 'Payload пуст',
      finished_at: new Date().toISOString(),
      clearPayload: true
    });
    return getJob(jobId);
  }

  await updateJob(jobId, {
    status: 'running',
    started_at: new Date().toISOString(),
    processed: 0,
    added: 0,
    updated: 0,
    errors_total: 0,
    errors: []
  });

  logger.warn(`[ContactImportJob] start id=${jobId} rows=${contacts.length}`);

  const parasiteInfo = buildParasiteHostSet(contacts, { identityService });
  const parasiteHosts = parasiteInfo.parasites;
  const liveness = createLivenessCache({ concurrency: 12 });
  logger.warn(
    `[ContactImportJob] site-rank id=${jobId} parasites=${parasiteHosts.size} threshold=${parasiteInfo.threshold} uniqueHosts=${parasiteInfo.domainCounts.size}`
  );

  let added = 0;
  let updated = 0;
  const errors = [];
  let lastBroadcastAt = 0;
  let lastProgressAt = 0;
  const rowCtx = { parasiteHosts, liveness };

  for (let i = 0; i < contacts.length; i += 1) {
    if (await isCancelRequested(jobId)) {
      await updateJob(jobId, {
        status: 'cancelled',
        processed: i,
        added,
        updated,
        errors_total: errors.length,
        errors: errors.slice(0, ERRORS_CAP),
        error_summary: 'Остановлено пользователем',
        finished_at: new Date().toISOString(),
        clearPayload: true
      });
      clearCancelFlag(jobId);
      broadcastContactsUpdate();
      logger.warn(`[ContactImportJob] cancelled id=${jobId} at ${i}/${contacts.length}`);
      return getJob(jobId);
    }

    try {
      const result = await processOneContact(contacts[i], encryptionKey, rowCtx);
      added += result.added;
      updated += result.updated;
      if (result.warning) {
        errors.push({ row: i + 1, error: null, warning: result.warning, partial: true });
      }
    } catch (e) {
      errors.push({ row: i + 1, error: e.message || String(e) });
    }

    const processed = i + 1;
    const now = Date.now();
    if (
      processed % PROGRESS_EVERY === 0
      || processed === contacts.length
      || now - lastProgressAt >= PROGRESS_MIN_MS
    ) {
      lastProgressAt = now;
      await updateJob(jobId, {
        processed,
        added,
        updated,
        errors_total: errors.length,
        errors: errors.slice(0, ERRORS_CAP)
      });
    }

    if (processed - lastBroadcastAt >= CONTACTS_UPDATE_EVERY) {
      lastBroadcastAt = processed;
      broadcastContactsUpdate();
    }
  }

  await updateJob(jobId, {
    status: 'done',
    processed: contacts.length,
    added,
    updated,
    errors_total: errors.length,
    errors: errors.slice(0, ERRORS_CAP),
    finished_at: new Date().toISOString(),
    clearPayload: true
  });
  broadcastContactsUpdate();
  clearCancelFlag(jobId);
  logger.warn(
    `[ContactImportJob] done id=${jobId} added=${added} updated=${updated} errors=${errors.length}/${contacts.length}`
  );
  return getJob(jobId);
}

function enqueueJob(jobId) {
  const run = jobChain.then(
    () => runJob(jobId),
    () => runJob(jobId)
  );
  jobChain = run.then(() => undefined, () => undefined);
  return run;
}

async function startImportJob({ contacts, requestedBy = null }) {
  const job = await createJob({ contacts, requestedBy });
  enqueueJob(job.id).catch((error) => {
    logger.error(`[ContactImportJob] worker failed id=${job.id}:`, error);
    updateJob(job.id, {
      status: 'failed',
      error_summary: error.message || String(error),
      finished_at: new Date().toISOString(),
      clearPayload: true
    }).catch(() => {});
  });
  return job;
}

async function cancelJob(jobId) {
  const id = Number(jobId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Некорректный ID задания');
  }
  const { rows } = await db.getQuery()('SELECT * FROM contact_import_jobs WHERE id = $1', [id]);
  const job = rows[0];
  if (!job) throw new Error('Job not found');

  const status = String(job.status || '');
  if (status === 'done' || status === 'cancelled' || status === 'failed') {
    return getJob(id);
  }

  requestCancelJob(id);
  await updateJob(id, {
    status: 'cancelled',
    error_summary: status === 'pending'
      ? 'Остановлено пользователем (до старта)'
      : 'Остановлено пользователем',
    finished_at: new Date().toISOString(),
    clearPayload: status === 'pending'
  });

  if (status === 'pending') {
    clearCancelFlag(id);
  }

  return getJob(id);
}

async function markOrphanJobsCancelled() {
  const { rowCount } = await db.getQuery()(
    `UPDATE contact_import_jobs
     SET status = 'cancelled',
         error_summary = COALESCE(error_summary, 'Прервано перезапуском сервера'),
         finished_at = COALESCE(finished_at, NOW()),
         payload = '[]'::jsonb
     WHERE status IN ('running', 'pending')`
  );
  if (rowCount > 0) {
    logger.warn(`[ContactImportJob] orphan jobs marked cancelled: ${rowCount}`);
  }
  return rowCount || 0;
}

function initialize() {
  const run = async () => {
    try {
      // миграции в проекте не всегда гоняются из initDbPool — подстрахуем таблицу job
      const { pool } = require('../db');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS contact_import_jobs (
          id SERIAL PRIMARY KEY,
          status VARCHAR(32) NOT NULL DEFAULT 'pending',
          requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          total INTEGER NOT NULL DEFAULT 0,
          processed INTEGER NOT NULL DEFAULT 0,
          added INTEGER NOT NULL DEFAULT 0,
          updated INTEGER NOT NULL DEFAULT 0,
          errors_total INTEGER NOT NULL DEFAULT 0,
          errors JSONB NOT NULL DEFAULT '[]'::jsonb,
          error_summary TEXT,
          payload JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          started_at TIMESTAMPTZ,
          finished_at TIMESTAMPTZ
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_contact_import_jobs_created
          ON contact_import_jobs (created_at DESC)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_contact_import_jobs_status
          ON contact_import_jobs (status)
      `);
    } catch (e) {
      logger.warn('[ContactImportJob] ensure table failed:', e.message);
    }
    await markOrphanJobsCancelled();
  };
  run().catch((e) => {
    logger.warn('[ContactImportJob] initialize failed:', e.message);
  });
}

module.exports = {
  MAX_CONTACTS_PER_JOB,
  startImportJob,
  getJob,
  cancelJob,
  markOrphanJobsCancelled,
  initialize,
  enqueueJob
};
