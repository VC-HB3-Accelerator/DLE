/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * API ИИ-конференции (настройки сессии и агента).
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const {
  requirePermission,
  requireEditContactsScoped,
  loadViewerAccess,
} = require('../middleware/permissions');
const { PERMISSIONS, ROLES } = require('../shared/permissions');
const accessResolver = require('../services/accessResolverService');
const conferenceService = require('../services/conferenceService');
const conferenceAiAgentService = require('../services/conferenceAiAgentService');
const conferenceMagicLinkService = require('../services/conferenceMagicLinkService');
const conferenceRealtimeService = require('../services/conferenceRealtimeService');
const conferenceLivekitService = require('../services/conferenceLivekitService');
const sessionService = require('../services/session-service');
const db = require('../db');

function actorId(req) {
  return req.user?.id || req.session?.userId || null;
}

function isSelfContactParam(req, contactId) {
  const me = Number(req.session?.userId || req.user?.id);
  const id = Number(contactId);
  return Number.isInteger(me) && me > 0 && me === id;
}

/** Platform editor: глобальные настройки ИИ / multi-хаб */
function ensurePlatformEditor(req, res) {
  const access = req.viewerAccess;
  if (access?.dataScope === 'global' && (access.role === ROLES.EDITOR || access.tokenRole === ROLES.EDITOR)) {
    return true;
  }
  res.status(403).json({ success: false, error: 'Только platform editor' });
  return false;
}

async function loadConferenceEditor(req, res) {
  const userId = actorId(req);
  if (!userId) {
    res.status(401).json({ success: false, error: 'Требуется аутентификация' });
    return null;
  }
  const access = req.viewerAccess || await loadViewerAccess(req);
  if (!accessResolver.canEditContacts(access)) {
    res.status(403).json({ success: false, error: 'Недостаточно прав для конференций' });
    return null;
  }
  req.viewerAccess = access;
  req.userRole = access.role;
  return { access, userId };
}

async function assertContactInScope(req, res, contactUserId) {
  if (isSelfContactParam(req, contactUserId)) {
    const userId = actorId(req);
    return { access: req.viewerAccess || null, userId };
  }
  const ctx = await loadConferenceEditor(req, res);
  if (!ctx) return null;
  const cid = Number(contactUserId);
  const ok = await accessResolver.canViewContact(ctx.access, cid, ctx.userId);
  if (!ok) {
    res.status(403).json({ success: false, error: 'Контакт вне вашего скоупа' });
    return null;
  }
  return ctx;
}

async function assertContactEditable(req, res, contactUserId) {
  const ctx = await assertContactInScope(req, res, contactUserId);
  if (!ctx) return null;
  if (isSelfContactParam(req, contactUserId)) return ctx;
  const ok = await accessResolver.canEditContact(ctx.access, Number(contactUserId), ctx.userId);
  if (!ok) {
    res.status(403).json({ success: false, error: 'Недостаточно прав для редактирования контакта' });
    return null;
  }
  return ctx;
}

async function assertSessionInScope(req, res, conferenceId) {
  const ctx = await loadConferenceEditor(req, res);
  if (!ctx) return null;
  const session = await conferenceService.fetchSessionById(conferenceId);
  if (!session) {
    res.status(404).json({ success: false, error: 'Конференция не найдена' });
    return null;
  }
  if (ctx.access.dataScope === 'global') {
    return { ...ctx, session };
  }
  if (Number(session.created_by) === Number(ctx.userId)) {
    return { ...ctx, session };
  }
  const contactOk = await accessResolver.canViewContact(
    ctx.access,
    session.contact_user_id,
    ctx.userId
  );
  if (!contactOk) {
    res.status(403).json({ success: false, error: 'Конференция вне вашего скоупа' });
    return null;
  }
  return { ...ctx, session };
}

function requireConferenceContactRead(req, res, next) {
  if (isSelfContactParam(req, req.params.contactId)) {
    req.conferenceSelfAccess = true;
    return next();
  }
  return requireEditContactsScoped()(req, res, async () => {
    const ok = await accessResolver.canViewContact(
      req.viewerAccess,
      req.params.contactId,
      actorId(req)
    );
    if (!ok) {
      return res.status(403).json({ success: false, error: 'Контакт вне вашего скоупа' });
    }
    next();
  });
}

function requirePlatformEditor(req, res, next) {
  return requireEditContactsScoped()(req, res, () => {
    if (!ensurePlatformEditor(req, res)) return;
    next();
  });
}

function requireConferenceSession(req, res, next) {
  return requireEditContactsScoped()(req, res, async () => {
    const ctx = await assertSessionInScope(req, res, req.params.id);
    if (!ctx) return;
    req.conferenceSession = ctx.session;
    next();
  });
}

function requireEditorContactsOrSelf(req, res, next) {
  return requireConferenceContactRead(req, res, next);
}

router.get(
  '/ai-agent/settings',
  requireAuth,
  requirePlatformEditor,
  async (req, res) => {
    try {
      const settings = await conferenceAiAgentService.getSettings();
      const defaults = conferenceAiAgentService.getDefaults();
      const openai = await conferenceAiAgentService.getOpenAiKeyStatus();
      const provider_key = await conferenceAiAgentService.getProviderKeyStatus(settings.provider);
      res.json({ success: true, settings, defaults, openai, provider_key });
    } catch (error) {
      logger.error('[conference] ai-agent settings get:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.put(
  '/ai-agent/settings',
  requireAuth,
  requirePlatformEditor,
  async (req, res) => {
    try {
      const settings = await conferenceAiAgentService.saveSettings(req.body || {}, actorId(req));
      const defaults = conferenceAiAgentService.getDefaults();
      const openai = await conferenceAiAgentService.getOpenAiKeyStatus();
      const provider_key = await conferenceAiAgentService.getProviderKeyStatus(settings.provider);
      res.json({ success: true, settings, defaults, openai, provider_key });
    } catch (error) {
      logger.error('[conference] ai-agent settings put:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.get(
  '/ai-agent/models',
  requireAuth,
  requirePlatformEditor,
  async (req, res) => {
    try {
      const provider = req.query.provider || null;
      const models = await conferenceAiAgentService.listAvailableModels(provider);
      const provider_key = await conferenceAiAgentService.getProviderKeyStatus(
        provider || (await conferenceAiAgentService.getSettings()).provider
      );
      res.json({ success: true, models, provider_key });
    } catch (error) {
      logger.error('[conference] ai-agent models:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.get(
  '/ai-agent/rag-tables',
  requireAuth,
  requirePlatformEditor,
  async (req, res) => {
    try {
      const encryptionUtils = require('../utils/encryptionUtils');
      const encryptionKey = encryptionUtils.getEncryptionKey();
      const { rows } = await db.getQuery()(
        `SELECT id, decrypt_text(name_encrypted, $1) AS name, is_rag_source_id
         FROM user_tables
         WHERE is_rag_source_id = 1
         ORDER BY id`,
        [encryptionKey]
      );
      res.json({ success: true, tables: rows });
    } catch (error) {
      logger.error('[conference] rag-tables:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.get(
  '/contact/:contactId',
  requireAuth,
  requireEditorContactsOrSelf,
  async (req, res) => {
    try {
      const data = await conferenceService.getEditableSessionForContact(req.params.contactId);
      const history = await conferenceService.listSessionsForContact(req.params.contactId, { limit: 10 });
      res.json({ success: true, ...data, history });
    } catch (error) {
      logger.error('[conference] get contact session:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message,
        code: error.code || null
      });
    }
  }
);

router.put(
  '/contact/:contactId',
  requireAuth,
  requireEditContactsScoped(),
  async (req, res) => {
    const ctx = await assertContactEditable(req, res, req.params.contactId);
    if (!ctx) return;
    try {
      const result = await conferenceService.upsertSessionForContact(
        req.params.contactId,
        req.body || {},
        actorId(req)
      );
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('[conference] put contact session:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message,
        code: error.code || null
      });
    }
  }
);

/** Конференции, где текущий пользователь — host (в т.ч. бронь /book-call) */
router.get(
  '/hosted',
  requireAuth,
  requireEditContactsScoped(),
  async (req, res) => {
    try {
      const sessions = await conferenceService.listHostedSessions(actorId(req), {
        limit: req.query.limit
      });
      res.json({ success: true, sessions });
    } catch (error) {
      logger.error('[conference] list hosted:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message,
        code: error.code || null
      });
    }
  }
);

/** Multi-хаб: список конференций редактора (is_multi) */
router.get(
  '/multi',
  requireAuth,
  requireEditContactsScoped(),
  async (req, res) => {
    try {
      const sessions = await conferenceService.listMultiSessionsForEditor(actorId(req), {
        limit: req.query.limit
      });
      res.json({ success: true, sessions });
    } catch (error) {
      logger.error('[conference] list multi:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message,
        code: error.code || null
      });
    }
  }
);

/** Multi-хаб: создать конференцию на 2–3 registered (отдельная страница, не 1:1 CRM) */
router.post(
  '/multi',
  requireAuth,
  requireEditContactsScoped(),
  async (req, res) => {
    try {
      const rawIds = req.body?.userIds || req.body?.ids || [];
      const userIds = await accessResolver.filterContactIdsToScope(
        req.viewerAccess,
        rawIds.map((id) => Number(id)),
        actorId(req)
      );
      if (userIds.length < 2) {
        return res.status(403).json({
          success: false,
          error: 'Недостаточно участников в вашем скоупе для multi-конференции',
        });
      }
      const data = await conferenceService.createMultiSession(
        userIds,
        req.body || {},
        actorId(req)
      );
      res.json({ success: true, ...data });
    } catch (error) {
      logger.error('[conference] create multi:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message,
        code: error.code || null
      });
    }
  }
);

/** Приглашения текущего пользователя (баннер в личке) */
router.get('/invites/mine', requireAuth, async (req, res) => {
  try {
    const invites = await conferenceService.listInvitesForUser(actorId(req));
    res.json({ success: true, invites });
  } catch (error) {
    logger.error('[conference] invites mine:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
      code: error.code || null
    });
  }
});

router.post(
  '/:id/notify',
  requireAuth,
  requireConferenceSession,
  async (req, res) => {
    try {
      const data = await conferenceMagicLinkService.notifyMultiParticipants(req.params.id);
      res.json({ success: true, ...data });
    } catch (error) {
      logger.error('[conference] notify:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message,
        code: error.code || null
      });
    }
  }
);

router.put(
  '/:id/settings',
  requireAuth,
  requireConferenceSession,
  async (req, res) => {
    try {
      const data = await conferenceService.updateSessionById(
        req.params.id,
        req.body || {},
        actorId(req)
      );
      res.json({ success: true, ...data });
    } catch (error) {
      logger.error('[conference] update settings:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message,
        code: error.code || null
      });
    }
  }
);

/**
 * Потратить magic link: логин участника + redirect info.
 * Публичный endpoint (без requireAuth). До маршрутов /:id/*
 */
router.post('/magic/consume', async (req, res) => {
  try {
    const consumed = await conferenceMagicLinkService.consumeMagicLink(req.body?.token);
    const role = consumed.role || 'user';
    const isElevated = role === ROLES.EDITOR || role === ROLES.READONLY;

    // Новая сессия после логина — не даём гостевому запросу затереть auth (session fixation / race)
    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });

    req.session.userId = consumed.userId;
    req.session.authenticated = true;
    req.session.authType = 'conference_magic';
    if (consumed.email) req.session.email = consumed.email;
    req.session.userAccessLevel = isElevated
      ? { level: role, tokenCount: 0, hasAccess: true }
      : { level: 'user', tokenCount: 0, hasAccess: false };
    req.session.conferenceJoin = {
      conferenceId: consumed.conferenceId,
      hostId: consumed.hostId
    };

    await sessionService.saveSession(req.session);
    await sessionService.linkGuestMessages(req.session, consumed.userId);

    const redirect = consumed.redirect || (consumed.hostId
      ? {
          name: 'admin-chat',
          params: { adminId: String(consumed.hostId) },
          query: consumed.conferenceId
            ? { conference: String(consumed.conferenceId) }
            : {}
        }
      : {
          name: 'personal-messages',
          query: consumed.conferenceId
            ? { conference: String(consumed.conferenceId) }
            : {}
        });

    res.json({
      success: true,
      authenticated: true,
      userId: consumed.userId,
      email: consumed.email || null,
      authType: 'conference_magic',
      userAccessLevel: req.session.userAccessLevel,
      conferenceId: consumed.conferenceId,
      hostId: consumed.hostId,
      isPrimary: consumed.isPrimary !== false,
      redirect
    });
  } catch (error) {
    logger.error('[conference] magic consume:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
      code: error.code || null
    });
  }
});

router.post(
  '/:id/start',
  requireAuth,
  requireConferenceSession,
  async (req, res) => {
    try {
      const data = await conferenceService.startSession(req.params.id, actorId(req));
      res.json({ success: true, ...data });
    } catch (error) {
      logger.error('[conference] start session:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message,
        code: error.code || null
      });
    }
  }
);

/** Участник (клиент) входит в комнату по magic link → Старт */
router.post('/:id/join', requireAuth, async (req, res) => {
  try {
    const membership = await conferenceRealtimeService.assertConferenceMember(
      req.params.id,
      actorId(req)
    );
    const data = await conferenceService.startSession(req.params.id, actorId(req));
    res.json({
      success: true,
      ...data,
      role: membership.role,
      isHost: membership.isHost
    });
  } catch (error) {
    logger.error('[conference] join:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
      code: error.code || null
    });
  }
});

/** Смена языка перевода (прослушивания) — в т.ч. во время live */
router.patch('/:id/languages', requireAuth, async (req, res) => {
  try {
    await conferenceRealtimeService.assertConferenceMember(req.params.id, actorId(req));
    const session = await conferenceService.updateSessionLanguages(
      req.params.id,
      actorId(req),
      req.body || {}
    );
    res.json({ success: true, session });
  } catch (error) {
    logger.error('[conference] languages:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
      code: error.code || null
    });
  }
});

router.post(
  '/:id/end',
  requireAuth,
  requireConferenceSession,
  async (req, res) => {
    try {
      const data = await conferenceService.endSession(req.params.id, actorId(req));
      res.json({ success: true, ...data });
    } catch (error) {
      logger.error('[conference] end session:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message,
        code: error.code || null
      });
    }
  }
);

router.post(
  '/:id/magic-link',
  requireAuth,
  requireConferenceSession,
  async (req, res) => {
    try {
      const send = req.body?.send !== false;
      const userId = req.body?.userId || req.body?.user_id || null;
      if (send) {
        const result = await conferenceMagicLinkService.sendMagicLinkNotifications(req.params.id, {
          ttlHours: req.body?.ttlHours,
          userId,
          channels: {
            email: req.body?.email !== false,
            telegram: Boolean(req.body?.telegram)
          }
        });
        return res.json({ success: true, ...result });
      }
      const created = await conferenceMagicLinkService.createMagicLink(req.params.id, {
        ttlHours: req.body?.ttlHours,
        userId
      });
      return res.json({
        success: true,
        emailed: false,
        linkId: created.id,
        expiresAt: created.expiresAt,
        conferenceId: created.conferenceId,
        userId: created.userId,
        linkUrl: created.linkUrl
      });
    } catch (error) {
      logger.error('[conference] magic-link:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message,
        code: error.code || null
      });
    }
  }
);

router.get(
  '/:id/participants',
  requireAuth,
  requireConferenceSession,
  async (req, res) => {
    try {
      const data = await conferenceService.listParticipants(req.params.id);
      res.json({ success: true, ...data });
    } catch (error) {
      logger.error('[conference] list participants:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message,
        code: error.code || null
      });
    }
  }
);

router.post(
  '/:id/participants',
  requireAuth,
  requireConferenceSession,
  async (req, res) => {
    try {
      const rawId = req.body?.userId || req.body?.user_id;
      const scoped = await accessResolver.filterContactIdsToScope(
        req.viewerAccess,
        [Number(rawId)],
        actorId(req)
      );
      if (!scoped.length) {
        return res.status(403).json({ success: false, error: 'Участник вне вашего скоупа' });
      }
      const data = await conferenceService.addParticipant(req.params.id, scoped[0], actorId(req));
      res.json({ success: true, ...data });
    } catch (error) {
      logger.error('[conference] add participant:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message,
        code: error.code || null
      });
    }
  }
);

router.delete(
  '/:id/participants/:userId',
  requireAuth,
  requireConferenceSession,
  async (req, res) => {
    try {
      const data = await conferenceService.removeParticipant(req.params.id, req.params.userId);
      res.json({ success: true, ...data });
    } catch (error) {
      logger.error('[conference] remove participant:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message,
        code: error.code || null
      });
    }
  }
);

router.get(
  '/:id/summary',
  requireAuth,
  requireConferenceSession,
  async (req, res) => {
    try {
      const sessionData = await conferenceService.getSession(req.params.id);
      const analytics =
        sessionData.session?.analytics ||
        (await conferenceService.buildSessionAnalytics(req.params.id));
      res.json({ success: true, session: sessionData.session, analytics });
    } catch (error) {
      logger.error('[conference] summary:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message,
        code: error.code || null
      });
    }
  }
);

router.get('/:id/live', requireAuth, async (req, res) => {
  try {
    const membership = await conferenceRealtimeService.assertConferenceMember(
      req.params.id,
      actorId(req)
    );
    const includeCoach = membership.isHost || membership.role === 'host';
    const drain = String(req.query.drain || '') === '1';
    const live = await conferenceRealtimeService.getLiveSnapshot(req.params.id, {
      includeCoach,
      drain,
      actorId: actorId(req)
    });
    res.json({ success: true, session: membership.session, ...live });
  } catch (error) {
    logger.error('[conference] live get:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
      code: error.code || null
    });
  }
});

router.post('/:id/realtime/session', requireAuth, async (req, res) => {
  try {
    const sessionData = await conferenceService.getSession(req.params.id);
    const data = await conferenceRealtimeService.createRealtimeClientSecret(
      req.params.id,
      actorId(req)
    );
    res.json({
      success: true,
      ...data,
      interpretation_enabled: Boolean(sessionData.session?.interpretation_enabled)
    });
  } catch (error) {
    logger.error('[conference] realtime session:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
      code: error.code || null
    });
  }
});

router.post('/:id/interpretation/session', requireAuth, async (req, res) => {
  try {
    const data = await conferenceRealtimeService.createInterpretationHostSession(
      req.params.id,
      actorId(req)
    );
    res.json({ success: true, ...data });
  } catch (error) {
    logger.error('[conference] interpretation session:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
      code: error.code || null
    });
  }
});

router.post(
  '/:id/agent/start',
  requireAuth,
  requireConferenceSession,
  async (req, res) => {
    try {
      const live = await conferenceRealtimeService.startAgent(req.params.id, actorId(req));
      res.json({ success: true, ...live });
    } catch (error) {
      logger.error('[conference] agent start:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message,
        code: error.code || null
      });
    }
  }
);

router.post(
  '/:id/agent/mute',
  requireAuth,
  requireConferenceSession,
  async (req, res) => {
    try {
      const muted = req.body?.muted !== undefined ? Boolean(req.body.muted) : true;
      const live = await conferenceRealtimeService.setAgentMuted(
        req.params.id,
        muted,
        actorId(req)
      );
      res.json({ success: true, ...live });
    } catch (error) {
      logger.error('[conference] agent mute:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message,
        code: error.code || null
      });
    }
  }
);

router.post(
  '/:id/coach',
  requireAuth,
  requireConferenceSession,
  async (req, res) => {
    try {
      const rule = await conferenceRealtimeService.addCoachRule(
        req.params.id,
        req.body?.text || req.body?.body,
        actorId(req)
      );
      const live = await conferenceRealtimeService.getLiveSnapshot(req.params.id, {
        includeCoach: true
      });
      res.json({ success: true, rule, ...live });
    } catch (error) {
      logger.error('[conference] coach:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message,
        code: error.code || null
      });
    }
  }
);

router.post('/:id/tools/search_docs', requireAuth, async (req, res) => {
  try {
    const result = await conferenceRealtimeService.searchCompanyDocs(
      req.params.id,
      req.body?.query,
      actorId(req)
    );
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('[conference] search_docs:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
      code: error.code || null
    });
  }
});

router.post('/:id/livekit/token', requireAuth, async (req, res) => {
  try {
    const data = await conferenceLivekitService.createParticipantToken(
      req.params.id,
      actorId(req)
    );
    res.json({ success: true, ...data });
  } catch (error) {
    logger.error('[conference] livekit token:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
      code: error.code || null
    });
  }
});

router.post('/:id/transcript', requireAuth, async (req, res) => {
  try {
    const membership = await conferenceRealtimeService.assertConferenceMember(
      req.params.id,
      actorId(req)
    );
    let role = 'participant';
    if (req.body?.role === 'agent') {
      role = 'agent';
    } else if (membership.isHost || membership.role === 'host') {
      role = req.body?.role === 'host_coach' ? 'participant' : 'host';
    }
    // host_coach только через /coach
    const conferenceTranslateService = require('../services/conferenceTranslateService');
    let translatedText = null;
    if (role === 'host' || role === 'participant') {
      translatedText = await conferenceTranslateService.translateForConferenceRoles(
        req.body?.text,
        role,
        membership.session
      );
    }
    const item = await conferenceRealtimeService.appendTranscript(
      req.params.id,
      role,
      req.body?.text,
      { translatedText }
    );
    res.json({ success: true, item });
  } catch (error) {
    logger.error('[conference] transcript:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
      code: error.code || null
    });
  }
});

router.get(
  '/:id',
  requireAuth,
  requireConferenceSession,
  async (req, res) => {
    try {
      const data = await conferenceService.getSession(req.params.id);
      res.json({ success: true, ...data });
    } catch (error) {
      logger.error('[conference] get session:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message,
        code: error.code || null
      });
    }
  }
);

module.exports = router;
