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
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS, ROLES } = require('../shared/permissions');
const conferenceService = require('../services/conferenceService');
const conferenceAiAgentService = require('../services/conferenceAiAgentService');
const conferenceMagicLinkService = require('../services/conferenceMagicLinkService');
const conferenceRealtimeService = require('../services/conferenceRealtimeService');
const conferenceLivekitService = require('../services/conferenceLivekitService');
const sessionService = require('../services/session-service');
const db = require('../db');

function ensureEditorAccess(req, res) {
  const role = req.userRole || ROLES.USER;
  if (role !== ROLES.EDITOR) {
    res.status(403).json({ success: false, error: 'Только редакторы могут управлять конференциями' });
    return false;
  }
  return true;
}

function actorId(req) {
  return req.user?.id || req.session?.userId || null;
}

router.get(
  '/ai-agent/settings',
  requireAuth,
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
    try {
      const settings = await conferenceAiAgentService.getSettings();
      const defaults = conferenceAiAgentService.getDefaults();
      const openai = await conferenceAiAgentService.getOpenAiKeyStatus();
      res.json({ success: true, settings, defaults, openai });
    } catch (error) {
      logger.error('[conference] ai-agent settings get:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.put(
  '/ai-agent/settings',
  requireAuth,
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
    try {
      const settings = await conferenceAiAgentService.saveSettings(req.body || {}, actorId(req));
      const defaults = conferenceAiAgentService.getDefaults();
      const openai = await conferenceAiAgentService.getOpenAiKeyStatus();
      res.json({ success: true, settings, defaults, openai });
    } catch (error) {
      logger.error('[conference] ai-agent settings put:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.get(
  '/ai-agent/models',
  requireAuth,
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
    try {
      const provider = req.query.provider || null;
      const models = await conferenceAiAgentService.listAvailableModels(provider);
      res.json({ success: true, models });
    } catch (error) {
      logger.error('[conference] ai-agent models:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.get(
  '/ai-agent/rag-tables',
  requireAuth,
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
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
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
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
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
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

/** Multi-хаб: список конференций редактора (is_multi) */
router.get(
  '/multi',
  requireAuth,
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
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
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
    try {
      const userIds = req.body?.userIds || req.body?.ids || [];
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
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
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
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
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
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
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

router.post(
  '/:id/end',
  requireAuth,
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
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
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
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
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
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
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
    try {
      const userId = req.body?.userId || req.body?.user_id;
      const data = await conferenceService.addParticipant(req.params.id, userId, actorId(req));
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
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
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
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
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
    const data = await conferenceRealtimeService.createRealtimeClientSecret(
      req.params.id,
      actorId(req)
    );
    res.json({ success: true, ...data });
  } catch (error) {
    logger.error('[conference] realtime session:', error);
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
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
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
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
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
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
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
  requirePermission(PERMISSIONS.EDIT_CONTACTS),
  async (req, res) => {
    if (!ensureEditorAccess(req, res)) return;
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
