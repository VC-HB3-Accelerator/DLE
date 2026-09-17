/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { hasPermission, PERMISSIONS } = require('/app/shared/permissions');
const db = require('../db');
const logger = require('../utils/logger');
const mediaAgent = require('../services/mediaAgentService');
const mediaAgentSkills = require('../services/mediaAgentSkills');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 4 },
  fileFilter: (req, file, cb) => {
    if (/^image\//i.test(file.mimetype || '')) return cb(null, true);
    cb(new Error('Только изображения как примеры'));
  },
});

const skillUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

async function requireEditor(req, res) {
  const userId = req.session?.userId || null;
  if (!userId) {
    res.status(403).json({ success: false, error: 'Нет прав' });
    return false;
  }
  try {
    const { rows } = await db.getQuery()(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [userId]);
    const role = rows[0]?.role || 'user';
    if (!hasPermission(role, PERMISSIONS.MANAGE_LEGAL_DOCS)) {
      res.status(403).json({ success: false, error: 'Нужны права редактора' });
      return false;
    }
    return true;
  } catch {
    res.status(403).json({ success: false, error: 'Нет прав' });
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
  });
}

router.get('/status', requireAuth, async (req, res) => {
  try {
    if (!(await requireEditor(req, res))) return;
    const qwen = await mediaAgent.hasQwenKey();
    res.json({ success: true, qwenConfigured: qwen });
  } catch (e) {
    sendErr(res, e, 'Не удалось проверить статус');
  }
});

router.get('/skills', requireAuth, async (req, res) => {
  try {
    if (!(await requireEditor(req, res))) return;
    const data = await mediaAgentSkills.listSkills();
    res.json({ success: true, ...data });
  } catch (e) {
    sendErr(res, e, 'Не удалось загрузить skills');
  }
});

router.post('/skills/install', requireAuth, async (req, res) => {
  try {
    if (!(await requireEditor(req, res))) return;
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
    if (!(await requireEditor(req, res))) return;
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
    if (!(await requireEditor(req, res))) return;
    await mediaAgentSkills.removeUserSkill(req.params.id);
    res.json({ success: true });
  } catch (e) {
    sendErr(res, e, 'Не удалось удалить skill');
  }
});

router.post('/turn', requireAuth, (req, res, next) => {
  upload.array('examples', 4)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message || 'Файл не принят' });
    }
    return next();
  });
}, async (req, res) => {
  try {
    if (!(await requireEditor(req, res))) return;
    const message = String(req.body?.message || '').trim();
    const history = mediaAgent.parseHistory(req.body?.history);
    const fromFiles = mediaAgent.filesToImages(req.files);
    const fromDrive = await mediaAgent.imagesFromDriveIds(
      mediaAgent.parseIdList(req.body?.driveIds)
    );
    const images = [...fromFiles, ...fromDrive].slice(0, 4);
    const data = await mediaAgent.startTurn({
      message,
      history,
      images,
      skillId: String(req.body?.skillId || '').trim(),
      ownerUserId: req.session.userId || null,
      authorAddress: req.session.address || 'media-agent',
    });
    res.json({ success: true, ...data });
  } catch (e) {
    sendErr(res, e, 'Не удалось обработать запрос');
  }
});

router.get('/jobs/:id', requireAuth, async (req, res) => {
  try {
    if (!(await requireEditor(req, res))) return;
    const job = mediaAgent.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Задача не найдена' });
    }
    res.json({ success: true, job: mediaAgent.publicJob(job) });
  } catch (e) {
    sendErr(res, e, 'Не удалось получить статус');
  }
});

module.exports = router;
