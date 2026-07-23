/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * LiveKit tokens для видеокомнаты ИИ-конференции (срез B).
 */

const logger = require('../utils/logger');
const conferenceRealtimeService = require('./conferenceRealtimeService');
const conferenceService = require('./conferenceService');
const db = require('../db');

function getConfig() {
  return {
    apiKey: process.env.LIVEKIT_API_KEY || 'devkey',
    apiSecret: process.env.LIVEKIT_API_SECRET || 'secret',
    // URL для браузера (host), не для docker-сети
    url: process.env.LIVEKIT_URL || 'ws://localhost:7880'
  };
}

function roomNameForConference(conferenceId) {
  return `conference-${conferenceId}`;
}

async function ensureRoomId(conferenceId) {
  const id = Number(conferenceId);
  const { session } = await conferenceService.getSession(id);
  if (session.room_id) return session.room_id;

  const roomId = roomNameForConference(id);
  await db.getQuery()(
    `UPDATE conference_sessions SET room_id = $2, updated_at = NOW() WHERE id = $1`,
    [id, roomId]
  );
  return roomId;
}

/**
 * JWT для участника конференции.
 */
async function createParticipantToken(conferenceId, actorId) {
  const membership = await conferenceRealtimeService.assertConferenceMember(
    conferenceId,
    actorId
  );
  const conf = membership.session;
  if (!['draft', 'scheduled', 'live'].includes(conf.status)) {
    const err = new Error('Конференция не активна для видео');
    err.status = 400;
    throw err;
  }

  const cfg = getConfig();
  if (!cfg.apiKey || !cfg.apiSecret) {
    const err = new Error('LiveKit не настроен (LIVEKIT_API_KEY / SECRET)');
    err.status = 503;
    err.code = 'LIVEKIT_NOT_CONFIGURED';
    throw err;
  }

  let AccessToken;
  try {
    ({ AccessToken } = require('livekit-server-sdk'));
  } catch (e) {
    logger.error('[conferenceLivekit] livekit-server-sdk missing:', e.message);
    const err = new Error('Пакет livekit-server-sdk не установлен');
    err.status = 503;
    err.code = 'LIVEKIT_SDK_MISSING';
    throw err;
  }

  const roomName = await ensureRoomId(conferenceId);
  const identity = `user-${actorId}`;
  const name = membership.isHost || membership.role === 'host' ? `host-${actorId}` : `guest-${actorId}`;

  const at = new AccessToken(cfg.apiKey, cfg.apiSecret, {
    identity,
    name,
    ttl: '2h'
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true
  });

  const token = await at.toJwt();
  logger.info(`[conferenceLivekit] token room=${roomName} identity=${identity}`);

  return {
    token,
    url: cfg.url,
    roomName,
    identity,
    role: membership.role,
    isHost: membership.isHost
  };
}

module.exports = {
  getConfig,
  createParticipantToken,
  ensureRoomId,
  roomNameForConference
};
