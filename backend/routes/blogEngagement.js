/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { hasPermission, PERMISSIONS } = require('/app/shared/permissions');
const blogEngagementService = require('../services/blogEngagementService');
const blogFeedService = require('../services/blogFeedService');
const db = require('../db');

// Те же лимиты, что на /api/auth/email/* (пакет B OTP)
const emailOtpInitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Слишком много запросов кода. Подождите 15 минут.' },
});

const emailOtpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Слишком много попыток ввода кода. Подождите 15 минут.' },
});

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

router.post('/subscriptions/request-code', emailOtpInitLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const privacyConsent = Boolean(req.body?.privacy_consent ?? req.body?.privacyAccepted);
    if (!privacyConsent) {
      return res.status(400).json({ error: 'Требуется согласие с Политикой и согласиями', code: 'PRIVACY_CONSENT_REQUIRED' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Некорректный email' });
    }
    const emailAuth = require('../services/emailAuth');
    const sessionService = require('../services/session-service');
    const result = await emailAuth.initEmailAuth(req.session, email);
    req.session.emailPrivacyAccepted = true;
    await sessionService.saveSession(req.session);
    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Ошибка отправки кода' });
    }
    return res.json({ success: true, message: 'Код подтверждения отправлен на email' });
  } catch (error) {
    console.error('[blogEngagement] POST subscriptions/request-code:', error);
    res.status(error.status || 500).json({ error: error.message || 'Ошибка отправки кода' });
  }
});

/**
 * Один endpoint: код + filters → вход + подписка (TZ).
 */
router.post('/subscriptions/verify', emailOtpVerifyLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || req.session?.pendingEmail || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    const privacyConsent = Boolean(req.body?.privacy_consent ?? req.body?.privacyAccepted ?? req.session?.emailPrivacyAccepted);
    const filters = req.body?.filters || {};
    const sourcePageId = req.body?.source_page_id ? parseInt(req.body.source_page_id, 10) : null;
    const privacyConsentUrl = req.body?.privacy_consent_url || null;

    if (!privacyConsent) {
      return res.status(400).json({ error: 'Требуется согласие с Политикой и согласиями', code: 'PRIVACY_CONSENT_REQUIRED' });
    }
    if (!code) {
      return res.status(400).json({ error: 'Код подтверждения обязателен' });
    }
    if (!email) {
      return res.status(400).json({ error: 'Email не найден. Запросите код снова.' });
    }

    const verificationService = require('../services/verification-service');
    const authService = require('../services/auth-service');
    const identityService = require('../services/identity-service');
    const sessionService = require('../services/session-service');
    const consentService = require('../services/consentService');
    const blogSubscriptionService = require('../services/blogSubscriptionService');

    if (!req.session.pendingEmail) {
      req.session.pendingEmail = email;
    }

    const codeVerificationResult = await verificationService.verifyCode(code, 'email', req.session.pendingEmail);
    if (!codeVerificationResult.valid) {
      return res.status(400).json({ error: codeVerificationResult.message || 'Неверный код подтверждения' });
    }

    const guestId = req.session.guestId;
    const previousGuestId = req.session.previousGuestId;
    const authResult = await authService.handleEmailVerification(req.session.pendingEmail, req.session);

    let linkedWalletAddress = null;
    if (authResult.userId) {
      try {
        const walletIdentity = await identityService.findIdentity(authResult.userId, 'wallet');
        if (walletIdentity) linkedWalletAddress = walletIdentity.provider_id;
      } catch (_) { /* ignore */ }
    }

    let resolvedAccess = null;
    try {
      const accessResolver = require('../services/accessResolverService');
      resolvedAccess = await accessResolver.recompute(authResult.userId);
    } catch (_) { /* ignore */ }

    let walletLevel = null;
    if (linkedWalletAddress) {
      try {
        walletLevel = await authService.getUserAccessLevel(linkedWalletAddress);
      } catch (_) { /* ignore */ }
    }
    const userAccessLevel = authService.userAccessLevelFromAccess(resolvedAccess, walletLevel);

    req.session.userId = authResult.userId;
    req.session.authenticated = true;
    req.session.authType = 'email';
    req.session.email = authResult.email;
    req.session.userAccessLevel = userAccessLevel;
    if (linkedWalletAddress) req.session.address = linkedWalletAddress;
    if (guestId) req.session.guestId = guestId;
    if (previousGuestId) req.session.previousGuestId = previousGuestId;
    delete req.session.tempUserId;
    delete req.session.pendingEmail;
    delete req.session.emailPrivacyAccepted;
    await sessionService.saveSession(req.session);
    await sessionService.linkGuestMessages(req.session, authResult.userId);

    try {
      await consentService.grantMissingConsents({
        userId: authResult.userId,
        walletAddress: linkedWalletAddress || null,
        channel: 'email',
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
        userAgent: req.get('user-agent') || null,
      });
    } catch (_) { /* ignore */ }

    const subscription = await blogSubscriptionService.createSubscription({
      userId: authResult.userId,
      email: authResult.email || email,
      filters,
      privacyConsent: true,
      privacyConsentUrl,
      sourcePageId,
    });

    return res.json({
      success: true,
      authenticated: true,
      userId: authResult.userId,
      email: authResult.email,
      userAccessLevel,
      address: linkedWalletAddress || null,
      isNewAuth: authResult.isNewUser,
      subscription,
    });
  } catch (error) {
    console.error('[blogEngagement] POST subscriptions/verify:', error);
    res.status(error.status || 400).json({
      error: error.message || 'Ошибка подписки',
      code: error.code || null,
    });
  }
});

router.post('/subscriptions', requireAuth, async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    const blogSubscriptionService = require('../services/blogSubscriptionService');
    const email = String(req.body?.email || req.session?.email || '').trim().toLowerCase();
    let resolvedEmail = email;
    if (!resolvedEmail) {
      const identityService = require('../services/identity-service');
      resolvedEmail = await identityService.getPrimaryIdentityValue(userId, 'email');
    }
    const subscription = await blogSubscriptionService.createSubscription({
      userId,
      email: resolvedEmail,
      filters: req.body?.filters || {},
      privacyConsent: true,
      privacyConsentUrl: req.body?.privacy_consent_url || null,
      sourcePageId: req.body?.source_page_id ? parseInt(req.body.source_page_id, 10) : null,
    });
    res.json({ success: true, subscription });
  } catch (error) {
    console.error('[blogEngagement] POST subscriptions:', error);
    res.status(error.status || 400).json({
      error: error.message || 'Ошибка подписки',
      code: error.code || null,
    });
  }
});

router.get('/subscriptions/mine', requireAuth, async (req, res) => {
  try {
    const blogSubscriptionService = require('../services/blogSubscriptionService');
    const items = await blogSubscriptionService.listForUser(getSessionUserId(req));
    res.json({ success: true, items });
  } catch (error) {
    console.error('[blogEngagement] GET subscriptions/mine:', error);
    res.status(500).json({ error: 'Ошибка загрузки подписок' });
  }
});

router.delete('/subscriptions/:id', requireAuth, async (req, res) => {
  try {
    const blogSubscriptionService = require('../services/blogSubscriptionService');
    const ok = await blogSubscriptionService.deleteForUser(getSessionUserId(req), req.params.id);
    if (!ok) return res.status(404).json({ error: 'Подписка не найдена' });
    res.json({ success: true });
  } catch (error) {
    console.error('[blogEngagement] DELETE subscriptions:', error);
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

router.delete('/subscriptions', requireAuth, async (req, res) => {
  try {
    const blogSubscriptionService = require('../services/blogSubscriptionService');
    const count = await blogSubscriptionService.deleteAllForUser(getSessionUserId(req));
    res.json({ success: true, deleted: count });
  } catch (error) {
    console.error('[blogEngagement] DELETE all subscriptions:', error);
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

router.get('/subscriptions/unsubscribe', async (req, res) => {
  try {
    const blogSubscriptionService = require('../services/blogSubscriptionService');
    await blogSubscriptionService.unsubscribeByToken(req.query.token);
    const baseUrl = process.env.FRONTEND_URL || process.env.PRERENDER_BASE_URL || 'http://localhost:9000';
    res.redirect(302, `${baseUrl.replace(/\/$/, '')}/blog/my-subscriptions?unsubscribed=1`);
  } catch (error) {
    console.error('[blogEngagement] GET unsubscribe:', error);
    res.status(400).send('Ссылка отписки недействительна или устарела.');
  }
});

/** @deprecated старый confirm-flow — отключён */
router.post('/subscribe', async (req, res) => {
  res.status(410).json({
    error: 'Используйте подписку с подтверждением кода: /api/blog/subscriptions/verify',
    code: 'SUBSCRIBE_DEPRECATED',
  });
});

router.get('/subscribe/confirm', async (req, res) => {
  const baseUrl = process.env.FRONTEND_URL || process.env.PRERENDER_BASE_URL || 'http://localhost:9000';
  res.redirect(302, `${baseUrl.replace(/\/$/, '')}/blog?subscribe=1`);
});

router.get('/subscribers', requireAuth, async (req, res) => {
  try {
    const isEditor = await userIsEditor(req);
    if (!isEditor) {
      return res.status(403).json({ error: 'Нет прав' });
    }
    // В v1 глобальный реестр не делаем — пустой ответ для совместимости
    res.json([]);
  } catch (error) {
    console.error('[blogEngagement] GET subscribers:', error);
    res.status(500).json({ error: 'Ошибка загрузки подписчиков' });
  }
});

/** Публичный список активных фильтров ленты */
router.get('/feed-filters', async (req, res) => {
  try {
    const filters = await blogFeedService.listActiveFilters();
    res.json({ filters });
  } catch (error) {
    console.error('[blogEngagement] GET feed-filters:', error);
    res.status(500).json({ error: 'Ошибка загрузки фильтров ленты' });
  }
});

/** Настройки ленты (фильтры + закрепления) — только editor */
router.get('/feed-settings', requireAuth, async (req, res) => {
  try {
    const isEditor = await userIsEditor(req);
    if (!isEditor) {
      return res.status(403).json({ error: 'Нет прав' });
    }
    const settings = await blogFeedService.getFeedSettings();
    res.json(settings);
  } catch (error) {
    console.error('[blogEngagement] GET feed-settings:', error);
    res.status(500).json({ error: 'Ошибка загрузки настроек ленты' });
  }
});

router.put('/feed-settings', requireAuth, async (req, res) => {
  try {
    const isEditor = await userIsEditor(req);
    if (!isEditor) {
      return res.status(403).json({ error: 'Нет прав' });
    }
    const settings = await blogFeedService.saveFeedSettings({
      filters: req.body?.filters,
      pins: req.body?.pins,
      guest_limit: req.body?.guest_limit,
    });
    res.json(settings);
  } catch (error) {
    console.error('[blogEngagement] PUT feed-settings:', error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Ошибка сохранения настроек ленты' });
  }
});

/** Публичный статус: настроен ли редактор book-call для кнопок Написать/Позвонить */
router.get('/listing-contact/status', async (req, res) => {
  try {
    const listingContactService = require('../services/listingContactService');
    const data = await listingContactService.getPublicStatus();
    res.json(data);
  } catch (error) {
    console.error('[blogEngagement] GET listing-contact/status:', error);
    res.status(500).json({ error: 'Ошибка статуса связи с объявлением' });
  }
});

/** Автосохранение / финальная отправка лида гостя (email или телефон) */
router.post('/listing-contact/guest-lead', async (req, res) => {
  try {
    const listingContactService = require('../services/listingContactService');
    const body = req.body || {};
    const result = await listingContactService.upsertGuestLead({
      pageId: body.page_id,
      action: body.action === 'call' ? 'call' : 'write',
      contactRaw: body.contact,
      privacyConsent: Boolean(body.privacy_consent),
      guestSession: body.guest_session || req.sessionID || null,
      finalize: Boolean(body.finalize),
    });
    res.json(result);
  } catch (error) {
    console.error('[blogEngagement] POST listing-contact/guest-lead:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'Ошибка сохранения контакта',
      code: error.code || null,
    });
  }
});

/** Авторизованный пользователь: «Написать» редактору book-call */
router.post('/listing-contact/write', requireAuth, async (req, res) => {
  try {
    const listingContactService = require('../services/listingContactService');
    const userId = getSessionUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Требуется вход' });
    }
    const body = req.body || {};
    const result = await listingContactService.writeAsUser({
      pageId: body.page_id,
      action: body.action === 'call' ? 'call' : 'write',
      userId,
    });
    res.json(result);
  } catch (error) {
    console.error('[blogEngagement] POST listing-contact/write:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'Не удалось отправить запрос',
      code: error.code || null,
    });
  }
});

module.exports = router;
