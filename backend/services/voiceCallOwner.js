/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const crypto = require('crypto');

function ownerKey({ ownerType, ownerUserId, ownerGuestId }) {
  if (ownerType === 'user' && ownerUserId) return `user:${Number(ownerUserId)}`;
  if (ownerGuestId) return `guest:${String(ownerGuestId)}`;
  return null;
}

/** content_media.author_address NOT NULL — гость без кошелька не может дать null. */
function mediaAuthorAddress(owner, sessionAddress) {
  const fromSession = String(sessionAddress || '').trim();
  if (fromSession) return fromSession.slice(0, 128);
  const fromOwner = String(owner?.key || '').trim();
  if (fromOwner) return fromOwner.slice(0, 128);
  return 'voice-call';
}

function normalizeWebGuestId(raw) {
  const id = String(raw || '').trim();
  if (!id) return '';
  if (id.startsWith('guest_')) return id;
  if (id.startsWith('web:')) return id.replace(/^web:/, '');
  return `guest_${id}`;
}

function ownerFromReq(req) {
  const userId = req.session?.userId ? Number(req.session.userId) : null;
  let guestId = req.body?.guestId || req.query?.guestId || req.session?.guestId || null;
  if (userId && Number.isInteger(userId) && userId > 0) {
    return {
      ownerType: 'user',
      ownerUserId: userId,
      ownerGuestId: null,
      key: ownerKey({ ownerType: 'user', ownerUserId: userId })
    };
  }
  if (!guestId && req.session) {
    guestId = `guest_${crypto.randomBytes(16).toString('hex')}`;
    req.session.guestId = guestId;
  }
  if (!guestId) return null;
  guestId = normalizeWebGuestId(guestId);
  if (req.session) req.session.guestId = guestId;
  return {
    ownerType: 'guest',
    ownerUserId: null,
    ownerGuestId: String(guestId),
    key: ownerKey({ ownerType: 'guest', ownerGuestId: String(guestId) })
  };
}

function assertOwner(row, owner) {
  if (!row || !owner) return false;
  if (row.owner_type === 'user') {
    return Number(row.owner_user_id) === Number(owner.ownerUserId);
  }
  return String(row.owner_guest_id || '') === String(owner.ownerGuestId || '');
}

async function persistGuestSession(req, owner) {
  if (!req?.session || owner?.ownerType !== 'guest' || !owner.ownerGuestId) return;
  req.session.guestId = owner.ownerGuestId;
  try {
    const sessionService = require('./session-service');
    await sessionService.saveSession(req.session);
  } catch (error) {
    const logger = require('../utils/logger');
    logger.warn('[voiceCall] session save:', error.message);
  }
}

function sanitizeReturnUrl(raw) {
  const value = String(raw || '').trim();
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (/^\/book-call(?:\?.*)?$/.test(value)) return value;
  if (/^\/contacts\/\d+\/(?:conference|profile)(?:\?.*)?$/.test(value)) return value;
  return null;
}

module.exports = {
  ownerKey,
  ownerFromReq,
  normalizeWebGuestId,
  persistGuestSession,
  assertOwner,
  sanitizeReturnUrl,
  mediaAuthorAddress
};
