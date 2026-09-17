/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Фоновая очередь импорта контактов (Postgres job + in-process worker).
 * Паттерн: jobChain, cancel flag. После рестарта backend незавершённые job
 * продолжаются с payload, а не помечаются cancelled (это выглядело как «остановлен»).
 */

const db = require('../db');
const logger = require('../utils/logger');
const { ROLES } = require('../shared/permissions');
const {
  prepareImportIdentities,
  buildParasiteHostSet,
  rankWebsitesForImport,
  websiteHostname,
  collectCorpAuthDomains
} = require('../utils/contactImportMulti');
const { createLivenessCache } = require('../utils/contactImportWebsiteLiveness');
const identityService = require('./identity-service');
const userContactFilesService = require('./userContactFilesService');
const contactViewerFieldsService = require('./contactViewerFieldsService');
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
/** @type {Set<number>} */
const queuedJobIds = new Set();

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

function parseJobPayload(raw) {
  if (Array.isArray(raw)) {
    return { contacts: raw, addCorpAuthDomains: false, collectedDomains: [] };
  }
  if (raw && Array.isArray(raw.contacts)) {
    return {
      contacts: raw.contacts,
      addCorpAuthDomains: Boolean(raw.addCorpAuthDomains),
      collectedDomains: Array.isArray(raw.collectedDomains)
        ? raw.collectedDomains.map((d) => String(d || '').trim().toLowerCase()).filter(Boolean)
        : []
    };
  }
  return { contacts: [], addCorpAuthDomains: false, collectedDomains: [] };
}

async function persistCollectedDomains(jobId, domainSet) {
  const domains = [...(domainSet || [])];
  await db.getQuery()(
    `UPDATE contact_import_jobs
     SET payload = CASE
       WHEN jsonb_typeof(payload) = 'object' AND (payload ? 'contacts')
       THEN jsonb_set(payload, '{collectedDomains}', $2::jsonb, true)
       ELSE payload
     END
     WHERE id = $1`,
    [jobId, JSON.stringify(domains)]
  );
}

async function recaptureCorpDomains(contacts, untilIndex, rowCtx) {
  if (!untilIndex || untilIndex <= 0 || !Array.isArray(contacts)) return;
  const parasiteHosts = rowCtx.parasiteHosts instanceof Set ? rowCtx.parasiteHosts : new Set();
  for (let i = 0; i < untilIndex && i < contacts.length; i += 1) {
    const prepared = prepareImportIdentities(contacts[i], identityService);
    let websites = prepared.websites || [];
    if (websites.length && rowCtx.liveness) {
      websites = await rowCtx.liveness.filterAliveUrls(websites);
    }
    websites = rankWebsitesForImport(websites, {
      emails: prepared.emails,
      parasiteHosts
    });
    for (const domain of collectCorpAuthDomains({
      emails: prepared.emails,
      websites,
      parasiteHosts
    })) {
      rowCtx.collectCorpDomains.add(domain);
    }
  }
}

async function upsertCollectedAuthDomains({ addCorpAuthDomains, rowCtx, requestedBy, errors }) {
  if (!addCorpAuthDomains || !rowCtx?.isPlatformEditor) return null;
  const list = errors || [];
  try {
    const authDomainRulesService = require('./authDomainRulesService');
    const collected = [...(rowCtx.collectCorpDomains || [])];
    const authDomainsResult = await authDomainRulesService.upsertDomainRulesFromImport(
      collected,
      requestedBy
    );
    if (authDomainsResult.added > 0) {
      await authDomainRulesService.recheckRolesAfterChange().catch((recheckErr) => {
        logger.warn('[ContactImportJob] auth domain recheck:', recheckErr.message);
      });
    }
    list.unshift({
      kind: 'auth_domains',
      partial: true,
      added: authDomainsResult.added,
      skipped: authDomainsResult.skipped,
      domains: authDomainsResult.values,
      warning: authDomainsResult.added
        ? `В правила входа добавлено доменов: ${authDomainsResult.added}`
        : 'Новых корп. доменов в правила входа не добавлено (уже есть или в файле нет рабочих сайтов/email)'
    });
    return authDomainsResult;
  } catch (authErr) {
    logger.warn('[ContactImportJob] auth domains upsert:', authErr.message);
    list.unshift({
      kind: 'auth_domains',
      partial: true,
      added: 0,
      skipped: 0,
      domains: [],
      warning: `Не удалось добавить корп. домены в правила входа: ${authErr.message}`
    });
    return null;
  }
}

function mapJobRow(row) {
  if (!row) return null;
    const errors = Array.isArray(row.errors) ? row.errors : [];
  const authDomains = errors.find((item) => item && item.kind === 'auth_domains') || null;
  return {
    id: row.id,
    status: row.status,
    requested_by: row.requested_by,
    total: Number(row.total) || 0,
    processed: Number(row.processed) || 0,
    added: Number(row.added) || 0,
    updated: Number(row.updated) || 0,
    errorsTotal: Number(row.errors_total) || 0,
    errors: errors.filter((item) => item && item.kind !== 'auth_domains'),
    authDomains,
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

async function createJob({ contacts, requestedBy = null, addCorpAuthDomains = false }) {
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
    [safeRequestedBy, contacts.length, JSON.stringify({
      contacts,
      addCorpAuthDomains: Boolean(addCorpAuthDomains)
    })]
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

  if (ctx.collectCorpDomains instanceof Set) {
    for (const domain of collectCorpAuthDomains({
      emails,
      websites,
      parasiteHosts
    })) {
      ctx.collectCorpDomains.add(domain);
    }
  }

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
    // Имя в users — только editor; иначе личное имя импортёра (ниже)
    if ((first_name || last_name) && ctx.isPlatformEditor) {
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

  const displayName = [first_name, last_name].filter(Boolean).join(' ').trim() || null;
  const importComment = (c.crm_comment !== undefined && c.crm_comment !== null && String(c.crm_comment).trim() !== '')
    ? String(c.crm_comment)
    : null;

  if (ctx.isPlatformEditor) {
    if (importComment) {
      await userContactFilesService.updateContactExtras(userId, {
        comment: importComment
      }, encryptionKey);
    }
  } else if (ctx.importedBy && (displayName || importComment)) {
    const personalPayload = {};
    if (displayName) personalPayload.displayName = displayName;
    if (importComment) personalPayload.comment = importComment;
    try {
      await contactViewerFieldsService.upsertFields(
        ctx.importedBy,
        userId,
        personalPayload,
        encryptionKey
      );
    } catch (pfErr) {
      logger.warn('[ContactImportJob] personal fields:', pfErr.message);
    }
  }

  // Теги из импорта: editor → системные; non-editor → личные маркеры
  const rawTags = c.tags ?? c.tag_names ?? c.crm_tags;
  let tagNames = [];
  if (Array.isArray(rawTags)) {
    tagNames = rawTags.map((t) => String(t || '').trim()).filter(Boolean);
  } else if (typeof rawTags === 'string' && rawTags.trim()) {
    tagNames = rawTags.split(/[,;|]/).map((t) => t.trim()).filter(Boolean);
  }
  if (tagNames.length && userId) {
    try {
      if (ctx.isPlatformEditor) {
        // системные: только если имена уже есть в словаре CRM — пропускаем auto-create в v1
        // (editor обычно вешает id; строковые имена без ensure словаря не трогаем)
      } else if (ctx.importedBy) {
        const contactViewerTagsService = require('./contactViewerTagsService');
        const tagIds = [];
        for (const name of tagNames) {
          const tid = await contactViewerTagsService.ensureTagByName(ctx.importedBy, name);
          if (tid) tagIds.push(tid);
        }
        if (tagIds.length) {
          await contactViewerTagsService.addMyTagsToContacts(ctx.importedBy, [userId], tagIds);
        }
      }
    } catch (tagErr) {
      logger.warn('[ContactImportJob] personal tags:', tagErr.message);
    }
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

  if (userId && ctx.importedBy) {
    try {
      const contactProvenanceService = require('./contactProvenanceService');
      await contactProvenanceService.recordImportProvenance({
        contactUserId: userId,
        importedBy: ctx.importedBy,
        jobId: ctx.jobId || null,
      });
    } catch (provErr) {
      logger.warn('[ContactImportJob] provenance:', provErr.message);
    }
  }

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

  if (['done', 'cancelled', 'failed'].includes(String(job.status))) {
    return getJob(jobId);
  }

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

  const { contacts, addCorpAuthDomains, collectedDomains } = parseJobPayload(job.payload);
  if (!contacts.length) {
    await updateJob(jobId, {
      status: 'failed',
      error_summary: String(job.status) === 'running'
        ? 'Прервано перезапуском сервера. Данные задания потеряны — запустите импорт снова.'
        : 'Payload пуст',
      finished_at: new Date().toISOString(),
      clearPayload: true
    });
    return getJob(jobId);
  }

  const startIndex = Math.min(
    Math.max(0, Number(job.processed) || 0),
    contacts.length
  );
  await updateJob(jobId, {
    status: 'running',
    started_at: job.started_at ? null : new Date().toISOString()
  });

  logger.warn(
    `[ContactImportJob] ${startIndex > 0 ? 'resume' : 'start'} id=${jobId} rows=${contacts.length} from=${startIndex}`
  );

  const parasiteInfo = buildParasiteHostSet(contacts, { identityService });
  const parasiteHosts = parasiteInfo.parasites;
  const liveness = createLivenessCache({ concurrency: 12 });
  logger.warn(
    `[ContactImportJob] site-rank id=${jobId} parasites=${parasiteHosts.size} threshold=${parasiteInfo.threshold} uniqueHosts=${parasiteInfo.domainCounts.size}`
  );

  let added = Number(job.added) || 0;
  let updated = Number(job.updated) || 0;
  const errors = Array.isArray(job.errors)
    ? job.errors.filter((item) => item && item.kind !== 'auth_domains')
    : [];
  let lastBroadcastAt = startIndex;
  let lastProgressAt = 0;
  let processedAt = startIndex;
  const rowCtx = {
    parasiteHosts,
    liveness,
    importedBy: job.requested_by,
    jobId: job.id,
    isPlatformEditor: false,
    collectCorpDomains: new Set(collectedDomains),
  };
  try {
    const accessResolver = require('./accessResolverService');
    if (job.requested_by) {
      const access = await accessResolver.resolveAccess(job.requested_by);
      rowCtx.isPlatformEditor = accessResolver.isPlatformEditor(access);
    }
  } catch (e) {
    logger.warn('[ContactImportJob] resolve importer access:', e.message);
  }

  if (startIndex > 0 && rowCtx.collectCorpDomains.size === 0) {
    await recaptureCorpDomains(contacts, startIndex, rowCtx);
  }

  const persistProgress = async (processed) => {
    await updateJob(jobId, {
      processed,
      added,
      updated,
      errors_total: errors.filter((item) => item && item.kind !== 'auth_domains').length,
      errors: errors.slice(0, ERRORS_CAP)
    });
    await persistCollectedDomains(jobId, rowCtx.collectCorpDomains);
  };

  const finishAuthAndStore = async ({ status, processed, error_summary, clearPayload }) => {
    await upsertCollectedAuthDomains({
      addCorpAuthDomains,
      rowCtx,
      requestedBy: job.requested_by,
      errors
    });
    await updateJob(jobId, {
      status,
      processed,
      added,
      updated,
      errors_total: errors.filter((item) => item && item.kind !== 'auth_domains').length,
      errors: errors.slice(0, ERRORS_CAP),
      error_summary: error_summary || null,
      finished_at: new Date().toISOString(),
      clearPayload: clearPayload === true
    });
    broadcastContactsUpdate();
    clearCancelFlag(jobId);
  };

  try {
    for (let i = startIndex; i < contacts.length; i += 1) {
      if (await isCancelRequested(jobId)) {
        await finishAuthAndStore({
          status: 'cancelled',
          processed: i,
          error_summary: 'Остановлено пользователем',
          clearPayload: true
        });
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
      processedAt = processed;
      const now = Date.now();
      if (
        processed % PROGRESS_EVERY === 0
        || processed === contacts.length
        || now - lastProgressAt >= PROGRESS_MIN_MS
      ) {
        lastProgressAt = now;
        await persistProgress(processed);
      }

      if (processed - lastBroadcastAt >= CONTACTS_UPDATE_EVERY) {
        lastBroadcastAt = processed;
        broadcastContactsUpdate();
      }
    }

    await finishAuthAndStore({
      status: 'done',
      processed: contacts.length,
      clearPayload: true
    });
    logger.warn(
      `[ContactImportJob] done id=${jobId} added=${added} updated=${updated} errors=${errors.length}/${contacts.length}`
    );
    return getJob(jobId);
  } catch (fatal) {
    logger.error(`[ContactImportJob] aborted id=${jobId}:`, fatal);
    try {
      await persistCollectedDomains(jobId, rowCtx.collectCorpDomains);
      await finishAuthAndStore({
        status: 'failed',
        processed: processedAt,
        error_summary: fatal.message || String(fatal),
        clearPayload: false
      });
    } catch (finishErr) {
      logger.error(`[ContactImportJob] abort-finish id=${jobId}:`, finishErr);
    }
    return getJob(jobId);
  }
}

function enqueueJob(jobId) {
  const id = Number(jobId);
  if (!Number.isInteger(id) || id <= 0) {
    return Promise.resolve(null);
  }
  if (queuedJobIds.has(id)) {
    logger.warn(`[ContactImportJob] skip duplicate enqueue id=${id}`);
    return Promise.resolve(null);
  }
  queuedJobIds.add(id);
  const run = jobChain.then(
    () => runJob(id),
    () => runJob(id)
  ).finally(() => {
    queuedJobIds.delete(id);
  });
  jobChain = run.then(() => undefined, () => undefined);
  return run;
}

async function startImportJob({ contacts, requestedBy = null, addCorpAuthDomains = false }) {
  const job = await createJob({ contacts, requestedBy, addCorpAuthDomains });
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

async function resumeInterruptedJobs() {
  const { rows } = await db.getQuery()(
    `SELECT id, status, processed, total, payload
     FROM contact_import_jobs
     WHERE status IN ('running', 'pending')
     ORDER BY id ASC`
  );
  if (!rows.length) return 0;

  let resumed = 0;
  for (const row of rows) {
    const { contacts } = parseJobPayload(row.payload);
    if (!contacts.length) {
      await updateJob(row.id, {
        status: 'failed',
        error_summary: 'Прервано перезапуском сервера. Данные задания потеряны — запустите импорт снова.',
        finished_at: new Date().toISOString(),
        clearPayload: true
      });
      logger.warn(`[ContactImportJob] interrupted id=${row.id} payload empty → failed`);
      continue;
    }
    logger.warn(
      `[ContactImportJob] resume queue id=${row.id} status=${row.status} processed=${row.processed}/${row.total}`
    );
    enqueueJob(row.id);
    resumed += 1;
  }
  return resumed;
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
    await resumeInterruptedJobs();
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
  resumeInterruptedJobs,
  initialize,
  enqueueJob
};
