/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS, ROLES } = require('../shared/permissions');
const contactSiteParserService = require('../services/contactSiteParserService');

function ensureEditorAccess(req, res) {
  const role = req.userRole || ROLES.USER;
  if (role !== ROLES.EDITOR) {
    res.status(403).json({ error: 'Только редакторы могут управлять парсером сайтов' });
    return { allowed: false };
  }
  return { allowed: true };
}

router.get('/settings', requireAuth, requirePermission(PERMISSIONS.EDIT_CONTACTS), async (req, res) => {
  if (!ensureEditorAccess(req, res).allowed) return;
  try {
    const settings = await contactSiteParserService.getSettings();
    const defaults = contactSiteParserService.getDefaults();
    res.json({ success: true, settings, defaults });
  } catch (error) {
    logger.error('[ContactSiteParser] settings get error:', error);
    res.status(500).json({ error: 'Ошибка получения настроек парсера', details: error.message });
  }
});

router.put('/settings', requireAuth, requirePermission(PERMISSIONS.EDIT_CONTACTS), async (req, res) => {
  if (!ensureEditorAccess(req, res).allowed) return;
  try {
    const actorId = req.user?.id || req.session?.userId || null;
    const settings = await contactSiteParserService.saveSettings(req.body || {}, actorId);
    const defaults = contactSiteParserService.getDefaults();
    res.json({ success: true, settings, defaults });
  } catch (error) {
    logger.error('[ContactSiteParser] settings save error:', error);
    res.status(400).json({ error: error.message || 'Ошибка сохранения настроек парсера' });
  }
});

router.get('/models', requireAuth, requirePermission(PERMISSIONS.EDIT_CONTACTS), async (req, res) => {
  if (!ensureEditorAccess(req, res).allowed) return;
  try {
    const models = await contactSiteParserService.listAvailableModels();
    const provider = String(req.query?.provider || '').trim().toLowerCase();
    const filtered = provider
      ? models.filter((item) => String(item.provider || '').toLowerCase() === provider)
      : models;
    res.json({ success: true, models: filtered });
  } catch (error) {
    logger.error('[ContactSiteParser] models error:', error);
    res.status(500).json({ error: 'Ошибка получения моделей', details: error.message });
  }
});

router.post('/jobs', requireAuth, requirePermission(PERMISSIONS.EDIT_CONTACTS), async (req, res) => {
  if (!ensureEditorAccess(req, res).allowed) return;

  const rawIds = Array.isArray(req.body?.userIds)
    ? req.body.userIds
    : String(req.body?.ids || req.query?.ids || '')
      .split(',')
      .map((id) => id.trim());

  const userIds = [...new Set(rawIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!userIds.length) {
    return res.status(400).json({ error: 'userIds обязателен' });
  }

  try {
    const actorId = req.user?.id || req.session?.userId || null;
    const force = req.body?.force !== false;
    const job = await contactSiteParserService.startJobForUserIds(userIds, {
      requestedBy: actorId,
      trigger: 'manual',
      force
    });
    res.json({ success: true, job });
  } catch (error) {
    logger.error('[ContactSiteParser] start job error:', error);
    res.status(400).json({ error: error.message || 'Не удалось запустить парсинг' });
  }
});

router.get('/jobs', requireAuth, requirePermission(PERMISSIONS.EDIT_CONTACTS), async (req, res) => {
  if (!ensureEditorAccess(req, res).allowed) return;
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const jobs = await contactSiteParserService.listJobs({ limit });
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, jobs });
  } catch (error) {
    logger.error('[ContactSiteParser] list jobs error:', error);
    res.status(500).json({ error: 'Ошибка получения заданий', details: error.message });
  }
});

router.get('/jobs/:id', requireAuth, requirePermission(PERMISSIONS.EDIT_CONTACTS), async (req, res) => {
  if (!ensureEditorAccess(req, res).allowed) return;
  const jobId = parseInt(req.params.id, 10);
  if (!jobId || Number.isNaN(jobId)) {
    return res.status(400).json({ error: 'Некорректный ID задания' });
  }
  try {
    const job = await contactSiteParserService.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Задание не найдено' });
    }
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, job });
  } catch (error) {
    logger.error('[ContactSiteParser] get job error:', error);
    res.status(500).json({ error: 'Ошибка получения задания', details: error.message });
  }
});

module.exports = router;
