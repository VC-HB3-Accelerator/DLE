/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS } = require('../shared/permissions');
const contactSiteParserService = require('../services/contactSiteParserService');

async function ensureParserAccess(req, res, { settingsOnly = false } = {}) {
  const accessResolver = require('../services/accessResolverService');
  const userId = req.user?.id || req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Требуется аутентификация' });
    return { allowed: false };
  }
  const access = await accessResolver.resolveAccess(userId);
  req.viewerAccess = access;
  req.userRole = access.role;

  if (settingsOnly) {
    const globalEditor = access.dataScope === 'global'
      && accessResolver.hasActionPermission(access, PERMISSIONS.EDIT_CONTACTS);
    if (!globalEditor) {
      res.status(403).json({ error: 'Только platform editor может управлять настройками парсера' });
      return { allowed: false };
    }
    return { allowed: true, access };
  }

  if (!accessResolver.canEditContacts(access)) {
    res.status(403).json({ error: 'Недостаточно прав для парсера контактов' });
    return { allowed: false };
  }
  return { allowed: true, access };
}

router.get('/settings', requireAuth, requirePermission(PERMISSIONS.EDIT_CONTACTS), async (req, res) => {
  if (!(await ensureParserAccess(req, res, { settingsOnly: true })).allowed) return;
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
  if (!(await ensureParserAccess(req, res, { settingsOnly: true })).allowed) return;
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
  if (!(await ensureParserAccess(req, res, { settingsOnly: true })).allowed) return;
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
  if (!(await ensureParserAccess(req, res)).allowed) return;

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
    const accessResolver = require('../services/accessResolverService');
    const scopedIds = await accessResolver.filterContactIdsToScope(
      req.viewerAccess,
      userIds,
      actorId
    );
    if (!scopedIds.length) {
      return res.status(403).json({ error: 'Нет контактов в вашем скоупе для парсинга' });
    }
    const force = req.body?.force !== false;
    const job = await contactSiteParserService.startJobForUserIds(scopedIds, {
      actorId,
      force,
    });
    res.status(202).json({ success: true, job });
  } catch (error) {
    logger.error('[ContactSiteParser] start job error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Ошибка запуска парсера' });
  }
});

router.get('/jobs', requireAuth, requirePermission(PERMISSIONS.EDIT_CONTACTS), async (req, res) => {
  if (!(await ensureParserAccess(req, res)).allowed) return;
  try {
    const jobs = await contactSiteParserService.listJobs({ limit: parseInt(req.query.limit, 10) || 50 });
    res.json({ success: true, jobs });
  } catch (error) {
    logger.error('[ContactSiteParser] jobs list error:', error);
    res.status(500).json({ error: 'Ошибка списка задач парсера', details: error.message });
  }
});

router.get('/jobs/:id', requireAuth, requirePermission(PERMISSIONS.EDIT_CONTACTS), async (req, res) => {
  if (!(await ensureParserAccess(req, res)).allowed) return;
  try {
    const job = await contactSiteParserService.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, job });
  } catch (error) {
    logger.error('[ContactSiteParser] job get error:', error);
    res.status(500).json({ error: 'Ошибка получения задачи парсера', details: error.message });
  }
});

router.post('/jobs/:id/cancel', requireAuth, requirePermission(PERMISSIONS.EDIT_CONTACTS), async (req, res) => {
  if (!(await ensureParserAccess(req, res)).allowed) return;
  try {
    const job = await contactSiteParserService.cancelJob(req.params.id);
    res.json({ success: true, job });
  } catch (error) {
    logger.error('[ContactSiteParser] job cancel error:', error);
    res.status(error.message === 'Job not found' ? 404 : 500).json({ error: error.message });
  }
});

module.exports = router;
