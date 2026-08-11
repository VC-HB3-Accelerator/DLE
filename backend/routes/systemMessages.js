/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 *
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS } = require('../shared/permissions');
const systemMessages = require('../services/systemMessagesService');
const logger = require('../utils/logger');

function publicShape(msg) {
  if (!msg) return null;
  return {
    id: msg.id,
    slug: msg.slug,
    kind: msg.kind,
    channels: msg.channels,
    reply_type: msg.reply_type,
    importance: msg.importance,
    audience: msg.audience,
    max_user_age_seconds: msg.max_user_age_seconds,
    persist_to_history: false,
    i18n: msg.i18n,
    sort_order: msg.sort_order,
    updated_at: msg.updated_at,
  };
}

/** GET /api/system-messages/published?channel=web */
router.get('/published', async (req, res) => {
  try {
    const channel = String(req.query.channel || 'web');
    if (!['web', 'telegram', 'email'].includes(channel)) {
      return res.status(400).json({ error: 'Invalid channel' });
    }
    const viewer = await systemMessages.buildViewerFromRequest(req);
    const items = await systemMessages.getPublishedForChannel({ channel, viewer });
    // Не кэшировать: гостевой ответ после логина не должен подставляться из browser cache.
    res.set('Cache-Control', 'no-store');
    res.set('Vary', 'Cookie');
    return res.json({
      items: items.map(publicShape),
      viewer: {
        isGuest: viewer.isGuest,
        role: viewer.role,
      },
    });
  } catch (error) {
    logger.error('[system-messages] published:', error);
    return res.status(500).json({ error: 'Failed to load system messages' });
  }
});

router.get(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS),
  async (req, res) => {
    try {
      const items = await systemMessages.listAll({
        status: req.query.status || undefined,
      });
      return res.json({ items });
    } catch (error) {
      logger.error('[system-messages] list:', error);
      return res.status(500).json({ error: 'Failed to list' });
    }
  }
);

router.get(
  '/presets',
  requireAuth,
  requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS),
  (req, res) => {
    res.json({ presets: systemMessages.PRESET_DEFAULTS });
  }
);

router.get(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS),
  async (req, res) => {
    try {
      const item = await systemMessages.getById(req.params.id);
      if (!item) return res.status(404).json({ error: 'Not found' });
      return res.json(item);
    } catch (error) {
      logger.error('[system-messages] get:', error);
      return res.status(500).json({ error: 'Failed to get' });
    }
  }
);

router.post(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS),
  async (req, res) => {
    try {
      const item = await systemMessages.createMessage(req.body, req.session.userId);
      return res.status(201).json(item);
    } catch (error) {
      logger.error('[system-messages] create:', error);
      return res.status(error.status || 500).json({ error: error.message || 'Failed to create' });
    }
  }
);

router.patch(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS),
  async (req, res) => {
    try {
      const item = await systemMessages.updateMessage(
        req.params.id,
        req.body,
        req.session.userId
      );
      return res.json(item);
    } catch (error) {
      logger.error('[system-messages] update:', error);
      return res.status(error.status || 500).json({ error: error.message || 'Failed to update' });
    }
  }
);

router.delete(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS),
  async (req, res) => {
    try {
      const ok = await systemMessages.deleteMessage(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Not found' });
      return res.json({ success: true });
    } catch (error) {
      logger.error('[system-messages] delete:', error);
      return res.status(500).json({ error: 'Failed to delete' });
    }
  }
);

router.post(
  '/bulk/publish',
  requireAuth,
  requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS),
  async (req, res) => {
    try {
      const result = await systemMessages.bulkSetStatus(req.body.ids || [], 'published');
      return res.json(result);
    } catch (error) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  }
);

router.post(
  '/bulk/unpublish',
  requireAuth,
  requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS),
  async (req, res) => {
    try {
      const result = await systemMessages.bulkSetStatus(req.body.ids || [], 'draft');
      return res.json(result);
    } catch (error) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  }
);

router.post(
  '/bulk/delete',
  requireAuth,
  requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS),
  async (req, res) => {
    try {
      const result = await systemMessages.bulkDelete(req.body.ids || []);
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;
