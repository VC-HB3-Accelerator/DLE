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
const { ownerFromReq, persistGuestSession, sanitizeReturnUrl } = require('../services/voiceCallOwner');
const settingsService = require('../services/voiceCallSettingsService');
const billing = require('../services/voiceCallBillingService');
const sessions = require('../services/voiceCallSessionService');
const booking = require('../services/voiceCallBookingService');
const rpcProviderService = require('../services/rpcProviderService');
const db = require('../db');

function sendError(res, error) {
  const status = error.status || 500;
  res.status(status).json({
    success: false,
    error: error.message,
    code: error.code || null,
    returnUrl: error.returnUrl || null,
    session: error.session || undefined
  });
}

router.get('/config', async (req, res) => {
  try {
    const settings = await settingsService.getSettings();
    let credits = { seconds_remaining: 0 };
    try {
      const owner = ownerFromReq(req);
      await persistGuestSession(req, owner);
      if (owner) credits = await billing.getCredits(owner);
    } catch (creditErr) {
      logger.warn('[ai-calls] credits:', creditErr.message);
    }
    res.json({
      success: true,
      data: {
        ...settingsService.publicConfig(settings),
        credits
      }
    });
  } catch (error) {
    logger.error('[ai-calls] config:', error);
    sendError(res, error);
  }
});

router.get('/admin/settings', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const settings = await settingsService.getSettings();
    const rpc = await rpcProviderService.getAllRpcProviders();
    const encryptionUtils = require('../utils/encryptionUtils');
    const encryptionKey = encryptionUtils.getEncryptionKey();
    const { rows: editors } = await db.getQuery()(
      `SELECT id, role,
              CASE WHEN first_name_encrypted IS NULL OR first_name_encrypted = '' THEN NULL
                   ELSE decrypt_text(first_name_encrypted, $1) END AS first_name,
              CASE WHEN last_name_encrypted IS NULL OR last_name_encrypted = '' THEN NULL
                   ELSE decrypt_text(last_name_encrypted, $1) END AS last_name
       FROM users WHERE role = 'editor' ORDER BY id`,
      [encryptionKey]
    );
    res.json({
      success: true,
      data: {
        settings,
        editors: editors.map((e) => ({
          id: e.id,
          name: [e.first_name, e.last_name].filter(Boolean).join(' ').trim() || `editor #${e.id}`
        })),
        rpc: (rpc || []).map((p) => ({
          networkId: p.network_id,
          rpcUrl: p.rpc_url,
          rpcUrlDisplay: p.rpc_url,
          chainId: p.chain_id
        }))
      }
    });
  } catch (error) {
    logger.error('[ai-calls] admin get:', error);
    sendError(res, error);
  }
});

router.put('/admin/settings', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  try {
    const settings = await settingsService.saveSettings(req.body || {}, req.session?.userId || null);
    res.json({ success: true, data: { settings } });
  } catch (error) {
    logger.error('[ai-calls] admin put:', error);
    sendError(res, error);
  }
});

router.get('/credits', async (req, res) => {
  try {
    const owner = ownerFromReq(req);
    await persistGuestSession(req, owner);
    if (!owner) return res.status(400).json({ success: false, error: 'Нет сессии' });
    const credits = await billing.getCredits(owner);
    res.json({ success: true, data: credits });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/invoices', async (req, res) => {
  try {
    const owner = ownerFromReq(req);
    await persistGuestSession(req, owner);
    if (!owner) return res.status(400).json({ success: false, error: 'Нет сессии' });
    const invoice = await billing.createInvoice(owner, req.body?.package_id);
    res.json({ success: true, data: invoice });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/invoices/:id', async (req, res) => {
  try {
    const owner = ownerFromReq(req);
    const { invoice } = await billing.getInvoice(req.params.id, owner);
    res.json({ success: true, data: invoice });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/invoices/:id/check', async (req, res) => {
  try {
    const owner = ownerFromReq(req);
    const invoice = await billing.checkInvoice(req.params.id, owner);
    res.json({ success: true, data: invoice });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/sessions', async (req, res) => {
  try {
    const owner = ownerFromReq(req);
    await persistGuestSession(req, owner);
    if (!owner) return res.status(400).json({ success: false, error: 'Нет сессии' });
    const session = await sessions.createSession(owner, {
      packageId: req.body?.package_id,
      invoiceId: req.body?.invoice_id
    });
    res.json({ success: true, data: session });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/sessions/:id/extend', async (req, res) => {
  try {
    const owner = ownerFromReq(req);
    const session = await sessions.extendSession(req.params.id, owner, req.body?.package_id);
    res.json({ success: true, data: session });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/sessions/:id/hangup', async (req, res) => {
  try {
    const owner = ownerFromReq(req);
    await persistGuestSession(req, owner);
    const session = await sessions.hangup(req.params.id, owner, req.body?.reason || 'user');
    res.json({ success: true, data: session });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/booking/slots', async (req, res) => {
  try {
    const data = await booking.listSlots({ from: req.query.from, to: req.query.to });
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/booking/schedule', requireAuth, requirePermission(PERMISSIONS.EDIT_CONTACTS), async (req, res) => {
  try {
    const data = await booking.listSchedule();
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/booking/schedule', requireAuth, requirePermission(PERMISSIONS.EDIT_CONTACTS), async (req, res) => {
  try {
    const data = await booking.saveSchedule(req.body || {});
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/booking', async (req, res) => {
  try {
    const owner = ownerFromReq(req);
    if (!owner) return res.status(400).json({ success: false, error: 'Нет сессии' });
    const data = await booking.bookSlot(owner, req.body?.starts_at);
    res.json({ success: true, data });
  } catch (error) {
    if (error.status === 401) {
      error.returnUrl = sanitizeReturnUrl(error.returnUrl);
    }
    sendError(res, error);
  }
});

module.exports = router;
