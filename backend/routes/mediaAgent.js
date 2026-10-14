/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { PERMISSIONS } = require('/app/shared/permissions');
const roleActionCapabilitiesService = require('../services/roleActionCapabilitiesService');
const logger = require('../utils/logger');
const mediaAgent = require('../services/mediaAgentService');
const mediaAgentSkills = require('../services/mediaAgentSkills');
const mediaAgentSessions = require('../services/mediaAgentSessionService');
const mediaAgentContactPrefs = require('../services/mediaAgentContactPrefsService');
const listingPool = require('../services/listingImagePoolService');
const { assertOwned, resolveTargetOwnerUserId } = require('../services/orchOwnerGuard');

const router = express.Router();

function isTurnFile(file) {
  const mime = String(file?.mimetype || '');
  const name = String(file?.originalname || '');
  if (/^image\//i.test(mime)) return true;
  if (/csv|text\/plain|pdf|spreadsheet|excel/i.test(mime)) return true;
  return /\.(csv|tsv|txt|pdf|xlsx|xls)$/i.test(name);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) => {
    if (isTurnFile(file)) return cb(null, true);
    cb(new Error('Нужны изображения, CSV, текст или PDF'));
  },
});

const skillUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || '');
    const mime = String(file.mimetype || '');
    if (/csv|text\/plain/i.test(mime) || /\.csv$/i.test(name)) return cb(null, true);
    cb(new Error('Нужен CSV-файл'));
  },
});

async function roleOf(req) {
  const userId = req.session?.userId || null;
  if (!userId) return null;
  const accessResolver = require('../services/accessResolverService');
  const access = await accessResolver.resolveAccess(userId);
  return access.role || 'user';
}

async function requireCap(req, res, permission, message) {
  const userId = req.session?.userId || null;
  if (!userId) {
    res.status(403).json({ success: false, error: 'Нет прав' });
    return false;
  }
  try {
    const role = await roleOf(req);
    if (!(await roleActionCapabilitiesService.roleHasPermission(role, permission))) {
      res.status(403).json({ success: false, error: message });
      return false;
    }
    return true;
  } catch {
    res.status(403).json({ success: false, error: 'Нет прав' });
    return false;
  }
}

async function requireOrchUser(req, res) {
  return requireCap(req, res, PERMISSIONS.USE_ORCHESTRATOR, 'Нет доступа к оркестратору');
}

async function requireSkillAdmin(req, res) {
  return requireCap(req, res, PERMISSIONS.MANAGE_SETTINGS, 'Нужны права на настройки');
}

function sendHidden(res, message = 'Задача не найдена') {
  return res.status(404).json({ success: false, error: message });
}

function ownedOrHidden(record, sessionUserId) {
  try {
    assertOwned(record, sessionUserId);
    return true;
  } catch {
    return false;
  }
}

function sendErr(res, e, fallback) {
  const status = e.status || 500;
  logger.error('[media-agent]', e.message);
  return res.status(status).json({
    success: false,
    code: e.code,
    error: e.message || fallback,
    questions: e.questions || undefined,
  });
}

router.get('/status', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const qwen = await mediaAgent.hasQwenKey();
    const orchQuota = require('../services/orchQuota');
    const orchSpawn = require('../services/orchSpawn');
    res.json({
      success: true,
      qwenConfigured: qwen,
      quota: orchQuota.snapshot(),
      agents: orchSpawn.WORKERS,
    });
  } catch (e) {
    sendErr(res, e, 'Не удалось проверить статус');
  }
});

router.get('/skills', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const data = await mediaAgentSkills.listSkills();
    res.json({ success: true, ...data });
  } catch (e) {
    sendErr(res, e, 'Не удалось загрузить skills');
  }
});

router.post('/skills/install', requireAuth, async (req, res) => {
  try {
    if (!(await requireSkillAdmin(req, res))) return;
    const rec = await mediaAgentSkills.installMarketplace(req.body?.id);
    res.json({
      success: true,
      skill: rec ? mediaAgentSkills.publicSkill(rec.parsed, {
        id: rec.id,
        source: 'user',
        installed: true,
      }) : null,
    });
  } catch (e) {
    sendErr(res, e, 'Не удалось установить skill');
  }
});

router.post('/skills/upload', requireAuth, (req, res, next) => {
  skillUpload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message || 'Файл не принят' });
    }
    return next();
  });
}, async (req, res) => {
  try {
    if (!(await requireSkillAdmin(req, res))) return;
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, error: 'Нужен zip или SKILL.md' });
    }
    const rec = await mediaAgentSkills.uploadSkillFile({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mime: req.file.mimetype,
    });
    res.json({
      success: true,
      skill: rec ? mediaAgentSkills.publicSkill(rec.parsed, {
        id: rec.id,
        source: 'user',
        installed: true,
      }) : null,
    });
  } catch (e) {
    sendErr(res, e, 'Не удалось загрузить skill');
  }
});

router.delete('/skills/:id', requireAuth, async (req, res) => {
  try {
    if (!(await requireSkillAdmin(req, res))) return;
    await mediaAgentSkills.removeUserSkill(req.params.id);
    res.json({ success: true });
  } catch (e) {
    sendErr(res, e, 'Не удалось удалить skill');
  }
});

router.post('/turn', requireAuth, (req, res, next) => {
  upload.array('examples', 6)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message || 'Файл не принят' });
    }
    return next();
  });
}, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const message = String(req.body?.message || '').trim();
    const history = mediaAgent.parseHistory(req.body?.history);
    const fromFiles = mediaAgent.filesToImages(req.files);
    const fromDrive = await mediaAgent.imagesFromDriveIds(
      mediaAgent.parseIdList(req.body?.driveIds)
    );
    const images = [...fromFiles, ...fromDrive].slice(0, 4);
    const documents = mediaAgent.filesToDocuments(req.files);
    const targetOwnerUserId = resolveTargetOwnerUserId({
      sessionUserId: req.session.userId,
      requestedTarget: req.body?.targetOwnerUserId,
      canWriteForeign: false,
    });
    const data = await mediaAgent.startTurn({
      message,
      history,
      sessionId: String(req.body?.sessionId || '').trim(),
      images,
      skillId: String(req.body?.skillId || '').trim(),
      ownerUserId: req.session.userId || null,
      authorAddress: req.session.address || 'media-agent',
      targetOwnerUserId,
      csvText: String(req.body?.csvText || ''),
      sourceFile: String(req.body?.csvName || '').trim() || null,
      documents,
    });
    res.json({ success: true, ...data });
  } catch (e) {
    sendErr(res, e, 'Не удалось обработать запрос');
  }
});

router.get('/jobs', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const orchJobStore = require('../services/orchJobStore');
    const jobs = await orchJobStore.listRecentJobs({
      ownerUserId: req.session.userId || null,
      limit: 20,
    });
    res.json({
      success: true,
      jobs: (jobs || []).filter(Boolean).map((job) => ({
        id: job.id,
        kind: job.kind,
        status: job.status,
        run_mode: job.run_mode,
        owner_user_id: job.owner_user_id,
        target_owner_user_id: job.target_owner_user_id,
        updated_at: job.updated_at || job.updatedAt,
        plan: job.plan || null,
      })),
    });
  } catch (e) {
    sendErr(res, e, 'Не удалось получить список задач');
  }
});

router.get('/jobs/:id', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const job = await mediaAgent.getJob(req.params.id);
    if (!job || !ownedOrHidden(job, req.session.userId)) {
      return sendHidden(res);
    }
    res.json({ success: true, job: mediaAgent.publicJob(job) });
  } catch (e) {
    sendErr(res, e, 'Не удалось получить статус');
  }
});

router.post('/jobs/:id/cancel', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const existing = await mediaAgent.getJob(req.params.id);
    if (!existing || !ownedOrHidden(existing, req.session.userId)) {
      return sendHidden(res);
    }
    const job = await mediaAgent.cancelJob(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Задача не найдена' });
    }
    res.json({ success: true, job });
  } catch (e) {
    sendErr(res, e, 'Не удалось отменить задачу');
  }
});

router.post('/listing-pool/start', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const brand = String(req.body?.brand || '').trim();
    const model = String(req.body?.model || '').trim();
    const target = Number(req.body?.target) || 8;
    if (!brand || !model) {
      return res.status(400).json({ success: false, error: 'Нужны brand и model' });
    }
    const pool = await listingPool.startPool({
      brand,
      model,
      target,
      ownerUserId: req.session.userId || null,
    });
    res.json({ success: true, pool });
  } catch (e) {
    sendErr(res, e, 'Не удалось собрать пул фото');
  }
});

router.get('/listing-pool/:id', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    let job = listingPool.getJob(req.params.id);
    if (!job || !ownedOrHidden(job, req.session.userId)) {
      return sendHidden(res, 'Пул не найден');
    }
    res.json({ success: true, pool: listingPool.publicJob(job) });
  } catch (e) {
    sendErr(res, e, 'Не удалось получить пул');
  }
});

router.delete('/listing-pool/:id/photos/:file', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const existing = listingPool.getJob(req.params.id);
    if (!existing || !ownedOrHidden(existing, req.session.userId)) {
      return sendHidden(res, 'Пул не найден');
    }
    const pool = await listingPool.dropAndRefill(req.params.id, req.params.file);
    res.json({ success: true, pool });
  } catch (e) {
    sendErr(res, e, 'Не удалось заменить фото');
  }
});

router.post('/listing-pool/:id/drop', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const existing = listingPool.getJob(req.params.id);
    if (!existing || !ownedOrHidden(existing, req.session.userId)) {
      return sendHidden(res, 'Пул не найден');
    }
    const files = Array.isArray(req.body?.files) ? req.body.files.map(String) : [];
    if (!files.length) {
      return res.status(400).json({ success: false, error: 'Нужен files[]' });
    }
    const pool = await listingPool.dropManyAndRefill(req.params.id, files);
    res.json({ success: true, pool });
  } catch (e) {
    sendErr(res, e, 'Не удалось заменить фото');
  }
});

router.get('/listing-pool/:id/files/:file', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const existing = listingPool.getJob(req.params.id);
    if (!existing || !ownedOrHidden(existing, req.session.userId)) {
      return sendHidden(res, 'Пул не найден');
    }
    const abs = listingPool.resolvePoolFile(req.params.id, req.params.file);
    if (!abs) return res.status(404).json({ success: false, error: 'Файл не найден' });
    const pathMod = require('path');
    const base = pathMod.basename(abs);
    const ascii = base.replace(/[^\x20-\x7E]/g, '_') || 'pool.bin';
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(base)}`
    );
    res.sendFile(abs);
  } catch (e) {
    sendErr(res, e, 'Не удалось отдать файл');
  }
});

const listingBatch = require('../services/listingBatchService');
const orchProviderBridge = require('../services/orchProviderBridge');

router.get('/orch/capabilities', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const caps = await orchProviderBridge.getOrchCapabilitySnapshot();
    let routing = null;
    try {
      routing = await require('../services/orchModelRouter').getRoutingTable();
    } catch (e) {
      routing = { error: e.message };
    }
    res.json({ success: true, capabilities: { ...caps, routing } });
  } catch (e) {
    sendErr(res, e, 'Не удалось получить capabilities оркестратора');
  }
});

router.get('/listing-batch', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const orchJobStore = require('../services/orchJobStore');
    const jobs = await orchJobStore.listRecentJobs({
      ownerUserId: req.session.userId || null,
      limit: 20,
    });
    res.json({
      success: true,
      jobs: (jobs || [])
        .filter((job) => job?.kind === 'listing_media_batch')
        .map((job) => listingBatch.publicBatch(job))
        .filter(Boolean),
    });
  } catch (e) {
    sendErr(res, e, 'Не удалось получить список batch');
  }
});

router.post('/listing-batch/csv', requireAuth, (req, res, next) => {
  csvUpload.single('csv')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message || 'CSV не принят' });
    }
    return next();
  });
}, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, error: 'Нужен CSV-файл' });
    }
    const listingCsv = require('../services/listingCsv');
    const parsed = listingCsv.parseListingCsv(req.file.buffer.toString('utf8'));
    res.json({
      success: true,
      source_file: req.file.originalname || 'upload.csv',
      rows: parsed.rows,
      candidates: parsed.candidates,
    });
  } catch (e) {
    sendErr(res, e, 'Не удалось разобрать CSV');
  }
});

router.get('/listing-batch/:id', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const job = await listingBatch.getBatch(req.params.id);
    if (!job || !ownedOrHidden(job, req.session.userId)) {
      return sendHidden(res, 'Batch не найден');
    }
    res.json({ success: true, batch: listingBatch.publicBatch(job) });
  } catch (e) {
    sendErr(res, e, 'Не удалось получить batch');
  }
});

router.post('/listing-batch/:id/tick', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const job = await listingBatch.tickBatch(req.params.id, {
      ownerUserId: req.session.userId || null,
    });
    res.json({ success: true, batch: listingBatch.publicBatch(job) });
  } catch (e) {
    sendErr(res, e, 'Не удалось обновить batch');
  }
});

router.post('/listing-batch/:id/respond', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const type = String(req.body?.type || 'continue').toLowerCase();
    const files = Array.isArray(req.body?.files) ? req.body.files.map(String) : undefined;
    const job = await listingBatch.respondBatch(
      req.params.id,
      {
        type,
        files,
        text: req.body?.text,
        answers: req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : undefined,
      },
      { ownerUserId: req.session.userId || null }
    );
    res.json({ success: true, batch: listingBatch.publicBatch(job) });
  } catch (e) {
    sendErr(res, e, 'Не удалось ответить на soft-ask');
  }
});

router.post('/plan/:id/choose', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const planner = require('../services/orchPlanner');
    const data = await planner.chooseOption({
      jobId: req.params.id,
      optionId: String(req.body?.option_id || req.body?.optionId || ''),
      ownerUserId: req.session.userId || null,
      decision: String(req.body?.decision || 'choose').toLowerCase(),
      rawText: String(req.body?.text || ''),
    });
    res.json({ success: true, ...data });
  } catch (e) {
    sendErr(res, e, 'Не удалось выбрать вариант плана');
  }
});

router.post('/listing-batch/:id/approval', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const job = await listingBatch.decideBatchPlan(
      req.params.id,
      String(req.body?.decision || '').toLowerCase(),
      { ownerUserId: req.session.userId || null }
    );
    res.json({ success: true, batch: listingBatch.publicBatch(job) });
  } catch (e) {
    sendErr(res, e, 'Не удалось обработать решение по плану');
  }
});

router.post('/listing-batch/:id/cancel', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const job = await listingBatch.cancelBatch(req.params.id, {
      ownerUserId: req.session.userId || null,
    });
    res.json({ success: true, batch: listingBatch.publicBatch(job) });
  } catch (e) {
    sendErr(res, e, 'Не удалось отменить batch');
  }
});

router.post('/tools/exec', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const executor = require('../services/orchToolExecutor');
    const toolId = String(req.body?.tool || req.body?.toolId || '');
    let canPublishDirectly = false;
    try {
      const accessResolver = require('../services/accessResolverService');
      const blogAccess = require('../services/blogContentAccessService');
      const access = await accessResolver.resolveAccess(req.session.userId);
      canPublishDirectly = blogAccess.canPublishDirectly(access);
    } catch {
      canPublishDirectly = false;
    }
    const data = await executor.execute({
      toolId,
      args: req.body?.args && typeof req.body.args === 'object' ? req.body.args : {},
      ctx: {
        ownerUserId: req.session.userId,
        jobId: req.body?.jobId || req.body?.job_id || null,
        decision: req.body?.decision || '',
        rawText: String(req.body?.text || ''),
        agentId: 'orchestrator',
        brief: { tools_allow: [toolId] },
        canPublishDirectly,
      },
    });
    res.json({ success: true, ...data });
  } catch (e) {
    sendErr(res, e, 'Не удалось выполнить вызов');
  }
});

router.get('/sessions', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const sessions = await mediaAgentSessions.listSessions({
      ownerUserId: req.session.userId,
      contactUserId: req.query.contactId,
    });
    res.json({ success: true, sessions });
  } catch (e) {
    sendErr(res, e, 'Не удалось загрузить историю');
  }
});

router.post('/sessions', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const session = await mediaAgentSessions.ensureLiveSession({
      ownerUserId: req.session.userId,
      contactUserId: req.body?.contactId,
    });
    res.json({ success: true, session });
  } catch (e) {
    sendErr(res, e, 'Не удалось открыть беседу');
  }
});

router.post('/sessions/fresh', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const session = await mediaAgentSessions.startFreshSession({
      ownerUserId: req.session.userId,
      contactUserId: req.body?.contactId,
    });
    res.json({ success: true, session });
  } catch (e) {
    sendErr(res, e, 'Не удалось открыть новую беседу');
  }
});

router.post('/sessions/:id/resume', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const session = await mediaAgentSessions.resumeSession({
      id: req.params.id,
      ownerUserId: req.session.userId,
    });
    res.json({ success: true, session });
  } catch (e) {
    sendErr(res, e, 'Не удалось открыть беседу');
  }
});

router.put('/sessions/:id', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const session = await mediaAgentSessions.upsertSession({
      id: req.params.id,
      ownerUserId: req.session.userId,
      contactUserId: req.body?.contactId,
      title: req.body?.title,
      skillId: req.body?.skillId,
      messages: req.body?.messages,
    });
    res.json({ success: true, session });
  } catch (e) {
    sendErr(res, e, 'Не удалось сохранить сессию');
  }
});

router.delete('/sessions/:id', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const result = await mediaAgentSessions.deleteSession({
      id: req.params.id,
      ownerUserId: req.session.userId,
    });
    res.json({ success: true, ...result });
  } catch (e) {
    sendErr(res, e, 'Не удалось удалить сессию');
  }
});

router.get('/contact-prefs/:contactId', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const prefs = await mediaAgentContactPrefs.getPrefs({
      ownerUserId: req.session.userId,
      contactUserId: req.params.contactId,
    });
    res.json({ success: true, prefs });
  } catch (e) {
    sendErr(res, e, 'Не удалось загрузить режим AI');
  }
});

router.put('/contact-prefs/:contactId', requireAuth, async (req, res) => {
  try {
    if (!(await requireOrchUser(req, res))) return;
    const prefs = await mediaAgentContactPrefs.setAiEnabled({
      ownerUserId: req.session.userId,
      contactUserId: req.params.contactId,
      aiEnabled: Boolean(req.body?.aiEnabled),
    });
    res.json({ success: true, prefs });
  } catch (e) {
    sendErr(res, e, 'Не удалось сохранить режим AI');
  }
});

module.exports = router;
