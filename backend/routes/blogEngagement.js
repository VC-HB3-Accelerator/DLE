/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { hasPermission, PERMISSIONS } = require('/app/shared/permissions');
const blogEngagementService = require('../services/blogEngagementService');
const db = require('../db');

function getSessionUserId(req) {
  return req.session?.userId || null;
}

async function userIsEditor(req) {
  const userId = getSessionUserId(req);
  if (!userId) return false;
  try {
    const encryptionUtils = require('../utils/encryptionUtils');
    const encryptionKey = encryptionUtils.getEncryptionKey();
    const { rows } = await db.getQuery()(
      `SELECT role FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    const role = rows[0]?.role || 'user';
    return hasPermission(role, PERMISSIONS.MANAGE_LEGAL_DOCS);
  } catch {
    return false;
  }
}

router.get('/pages/:pageId/engagement', async (req, res) => {
  try {
    const pageId = parseInt(req.params.pageId, 10);
    if (!pageId || Number.isNaN(pageId)) {
      return res.status(400).json({ error: 'Некорректный pageId' });
    }
    const userId = getSessionUserId(req);
    const data = await blogEngagementService.getEngagement(pageId, userId);
    res.json(data);
  } catch (error) {
    console.error('[blogEngagement] GET engagement:', error);
    res.status(500).json({ error: 'Ошибка загрузки engagement' });
  }
});

router.post('/pages/:pageId/like', requireAuth, async (req, res) => {
  try {
    const pageId = parseInt(req.params.pageId, 10);
    const userId = getSessionUserId(req);
    if (!pageId || !userId) {
      return res.status(400).json({ error: 'Некорректный запрос' });
    }
    const result = await blogEngagementService.toggleReaction(pageId, userId, 'heart');
    res.json(result);
  } catch (error) {
    console.error('[blogEngagement] POST like:', error);
    res.status(400).json({ error: error.message || 'Ошибка реакции' });
  }
});

router.post('/pages/:pageId/reaction', requireAuth, async (req, res) => {
  try {
    const pageId = parseInt(req.params.pageId, 10);
    const userId = getSessionUserId(req);
    const type = req.body?.type;
    if (!pageId || !userId) {
      return res.status(400).json({ error: 'Некорректный запрос' });
    }
    const result = await blogEngagementService.toggleReaction(pageId, userId, type);
    res.json(result);
  } catch (error) {
    console.error('[blogEngagement] POST reaction:', error);
    res.status(400).json({ error: error.message || 'Ошибка реакции' });
  }
});

router.post('/pages/:pageId/view', async (req, res) => {
  try {
    const pageId = parseInt(req.params.pageId, 10);
    if (!pageId || Number.isNaN(pageId)) {
      return res.status(400).json({ error: 'Некорректный pageId' });
    }
    const result = await blogEngagementService.recordView(pageId);
    res.json(result);
  } catch (error) {
    console.error('[blogEngagement] POST view:', error);
    res.status(400).json({ error: error.message || 'Ошибка просмотра' });
  }
});

router.post('/pages/:pageId/comments', requireAuth, async (req, res) => {
  try {
    const pageId = parseInt(req.params.pageId, 10);
    const userId = getSessionUserId(req);
    const { body, parent_id: parentId } = req.body || {};
    if (!pageId || !userId) {
      return res.status(400).json({ error: 'Некорректный запрос' });
    }
    const comment = await blogEngagementService.addComment(
      pageId,
      userId,
      body,
      parentId ? parseInt(parentId, 10) : null
    );
    res.status(201).json(comment);
  } catch (error) {
    console.error('[blogEngagement] POST comment:', error);
    res.status(400).json({ error: error.message || 'Ошибка комментария' });
  }
});

router.delete('/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId, 10);
    const userId = getSessionUserId(req);
    const isEditor = await userIsEditor(req);
    if (!commentId || !userId) {
      return res.status(400).json({ error: 'Некорректный запрос' });
    }
    await blogEngagementService.hideComment(commentId, userId, isEditor);
    res.json({ success: true });
  } catch (error) {
    console.error('[blogEngagement] DELETE comment:', error);
    res.status(400).json({ error: error.message || 'Ошибка удаления' });
  }
});

router.post('/subscribe', async (req, res) => {
  try {
    const { email, source_page_id: sourcePageId } = req.body || {};
    const result = await blogEngagementService.subscribe(
      email,
      sourcePageId ? parseInt(sourcePageId, 10) : null
    );
    res.json(result);
  } catch (error) {
    console.error('[blogEngagement] POST subscribe:', error);
    res.status(400).json({ error: error.message || 'Ошибка подписки' });
  }
});

router.get('/subscribe/confirm', async (req, res) => {
  try {
    const { token } = req.query;
    await blogEngagementService.confirmSubscribe(token);
    const baseUrl = process.env.FRONTEND_URL || process.env.PRERENDER_BASE_URL || 'https://hb3-accelerator.com';
    const blogUrl = `${baseUrl.replace(/\/$/, '')}/blog`;
    res.redirect(302, `${blogUrl}?subscribed=1`);
  } catch (error) {
    console.error('[blogEngagement] GET confirm:', error);
    res.status(400).send('Ссылка подтверждения недействительна или уже использована.');
  }
});

router.get('/subscribers', requireAuth, async (req, res) => {
  try {
    const isEditor = await userIsEditor(req);
    if (!isEditor) {
      return res.status(403).json({ error: 'Нет прав' });
    }
    const subscribers = await blogEngagementService.listConfirmedSubscribers();
    res.json(subscribers);
  } catch (error) {
    console.error('[blogEngagement] GET subscribers:', error);
    res.status(500).json({ error: 'Ошибка загрузки подписчиков' });
  }
});

module.exports = router;
