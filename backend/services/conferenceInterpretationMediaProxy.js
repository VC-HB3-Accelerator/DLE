/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * WS host: микрофон редактора → ASR → перевод → озвучка юзеру.
 */

const WebSocket = require('ws');
const logger = require('../utils/logger');
const conferenceRealtimeTicketService = require('./conferenceRealtimeTicketService');
const conferenceRealtimeService = require('./conferenceRealtimeService');
const conferenceInterpretationHub = require('./conferenceInterpretationHub');
const { transcribePcm16Buffer } = require('./conferenceInterpretationAsr');
const interpretation = require('./conferenceInterpretationService');

const SILENCE_MS = 900;
const MIN_PCM_BYTES = 16000 * 2 * 0.4; // ~0.4s at 16kHz

function sendJson(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function decodePcmChunk(b64, chunks) {
  const raw = Buffer.from(String(b64 || ''), 'base64');
  if (raw.length) chunks.push(raw);
}

async function flushUtterance({
  conferenceId,
  conf,
  chunks,
  hostLang
}) {
  if (!chunks.length) return;
  const pcm = Buffer.concat(chunks);
  chunks.length = 0;
  if (pcm.length < MIN_PCM_BYTES) return;

  const fresh = await interpretation.loadConf(conferenceId);
  const lang = fresh?.host_language || hostLang || 'ru';
  const text = await transcribePcm16Buffer(pcm, { languageHint: lang });
  if (!text) return;
  await interpretation.handleHostUtterance(conferenceId, fresh || conf, text);
}

async function handleInterpretationHostSocket(clientWs, ticket) {
  const entry = conferenceRealtimeTicketService.consumeTicket(ticket);
  if (!entry || entry.role !== 'host') {
    sendJson(clientWs, {
      type: 'error',
      code: 'INTERPRET_TICKET_INVALID',
      message: 'Тикет синхрона недействителен'
    });
    clientWs.close();
    return;
  }

  let membership;
  try {
    membership = await conferenceRealtimeService.assertConferenceMember(
      entry.conferenceId,
      entry.userId
    );
  } catch (e) {
    sendJson(clientWs, { type: 'error', message: e.message || 'Нет доступа' });
    clientWs.close();
    return;
  }

  if (!membership.isHost && membership.role !== 'host') {
    sendJson(clientWs, { type: 'error', message: 'Синхрон только для редактора' });
    clientWs.close();
    return;
  }

  const conferenceId = entry.conferenceId;
  const conf = await interpretation.loadConf(conferenceId);
  if (!interpretation.isInterpretationEnabled(conf)) {
    sendJson(clientWs, { type: 'error', message: 'Режим синхрона выключен' });
    clientWs.close();
    return;
  }

  conferenceInterpretationHub.registerClient(conferenceId, 'host', clientWs);
  sendJson(clientWs, {
    type: 'session',
    state: 'live',
    role: 'host',
    guest_language: conf.guest_language,
    host_language: conf.host_language
  });

  const chunks = [];
  let flushTimer = null;
  const hostLang = conf.host_language || 'ru';

  const scheduleFlush = () => {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      flushUtterance({ conferenceId, conf, chunks, hostLang }).catch((e) => {
        logger.warn('[conferenceInterpretHost] flush:', e?.message || e);
      });
    }, SILENCE_MS);
  };

  clientWs.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch (_) {
      return;
    }
    if (msg.type === 'hangup') {
      clientWs.close();
      return;
    }
    if (msg.type === 'audio' && msg.pcm) {
      decodePcmChunk(msg.pcm, chunks);
      scheduleFlush();
    }
    if (msg.type === 'utterance_end') {
      if (flushTimer) clearTimeout(flushTimer);
      flushUtterance({ conferenceId, conf, chunks, hostLang }).catch(() => {});
    }
  });

  clientWs.on('close', () => {
    if (flushTimer) clearTimeout(flushTimer);
    if (chunks.length) {
      flushUtterance({ conferenceId, conf, chunks, hostLang }).catch(() => {});
    }
  });
}

module.exports = {
  handleInterpretationHostSocket
};
