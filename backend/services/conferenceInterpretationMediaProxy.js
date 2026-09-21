/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Микрофон host/primary → Qwen LiveTranslate → голос перевода другой стороне.
 */

const WebSocket = require('ws');
const logger = require('../utils/logger');
const aiProviderSettingsService = require('./aiProviderSettingsService');
const {
  realtimeWsUrlFromCompatibleBase,
  extractEventText
} = require('./qwenRealtimeService');
const conferenceRealtimeTicketService = require('./conferenceRealtimeTicketService');
const conferenceRealtimeService = require('./conferenceRealtimeService');
const conferenceInterpretationHub = require('./conferenceInterpretationHub');
const interpretation = require('./conferenceInterpretationService');
const interpretationSettings = require('./conferenceInterpretationSettingsService');

const MAX_PENDING_PCM_CHUNKS = 480;

function sendJson(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function extractAudioB64(event) {
  if (!event || typeof event !== 'object') return '';
  if (event.delta && (event.type === 'response.audio.delta' || event.type === 'response.output_audio.delta')) {
    return String(event.delta);
  }
  return '';
}

function buildInterpretationSession(targetLanguage) {
  return {
    modalities: ['audio', 'text'],
    input_audio_format: 'pcm',
    output_audio_format: 'pcm',
    translation: {
      language: String(targetLanguage || 'en').slice(0, 2)
    }
  };
}

async function handleInterpretationSocket(clientWs, ticket) {
  const entry = conferenceRealtimeTicketService.consumeTicket(ticket);
  if (!entry || (entry.role !== 'host' && entry.role !== 'primary')) {
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

  const role = entry.role === 'host' ? 'host' : 'primary';
  if (role === 'host' && !membership.isHost && membership.role !== 'host') {
    sendJson(clientWs, { type: 'error', message: 'Синхрон ведущего только для редактора' });
    clientWs.close();
    return;
  }
  if (role === 'primary') {
    const primaryId = Number(membership.session?.contact_user_id);
    if (primaryId !== Number(entry.userId)) {
      sendJson(clientWs, { type: 'error', message: 'Синхрон собеседника только для основного участника' });
      clientWs.close();
      return;
    }
  }

  const conferenceId = entry.conferenceId;
  const conf = await interpretation.loadConf(conferenceId);
  if (!interpretation.isInterpretationEnabled(conf)) {
    sendJson(clientWs, { type: 'error', message: 'Режим синхрона выключен' });
    clientWs.close();
    return;
  }
  if (!conferenceRealtimeService.isInterpretationRunning(conferenceId)) {
    sendJson(clientWs, { type: 'error', message: 'Лайв-перевод не запущен' });
    clientWs.close();
    return;
  }

  const providerSettings = await aiProviderSettingsService.getProviderSettings('qwencloud');
  if (!providerSettings?.api_key) {
    sendJson(clientWs, {
      type: 'error',
      code: 'QWENCLOUD_KEY_MISSING',
      message: 'Ключ Qwen Cloud не настроен'
    });
    clientWs.close();
    return;
  }

  const sourceLang = role === 'host'
    ? (conf.host_language || 'ru')
    : (conf.guest_language || 'en');
  const targetLang = role === 'host'
    ? (conf.guest_language || 'en')
    : (conf.host_language || 'ru');
  const targetRole = role === 'host' ? 'primary' : 'host';
  const { selected_model: model } = await interpretationSettings.getSettings();

  const registered = conferenceInterpretationHub.registerClient(conferenceId, role, clientWs);
  if (!registered) {
    sendJson(clientWs, { type: 'error', message: 'Конференция или перевод уже завершены' });
    return;
  }
  sendJson(clientWs, {
    type: 'session',
    state: 'live',
    role,
    model,
    guest_language: conf.guest_language,
    host_language: conf.host_language
  });

  let upstream = null;
  let upstreamGen = 0;
  let closed = false;
  let translationReady = false;
  let lastSpoken = '';
  const pendingPcm = [];
  let reconnectAttempts = 0;

  const flushPendingPcm = () => {
    if (
      !translationReady
      || !upstream
      || upstream.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    while (pendingPcm.length) {
      upstream.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: pendingPcm.shift()
      }));
    }
  };

  const closeAll = (reason) => {
    if (closed) return;
    closed = true;
    upstreamGen += 1;
    try {
      if (upstream) upstream.close();
    } catch (_) {
      /* ignore */
    }
    try {
      clientWs.close();
    } catch (_) {
      /* ignore */
    }
    logger.info(`[conferenceInterpret] closed conference=${conferenceId} role=${role} reason=${reason || 'done'}`);
  };

  const openUpstream = async () => {
    if (closed) return;
    const gen = upstreamGen + 1;
    upstreamGen = gen;
    if (upstream) {
      const old = upstream;
      upstream = null;
      old.removeAllListeners();
      try {
        old.close();
      } catch (_) {
        /* ignore */
      }
    }
    translationReady = false;

    const url = realtimeWsUrlFromCompatibleBase(providerSettings.base_url, model);
    logger.info(`[conferenceInterpret] connect conference=${conferenceId} role=${role} model=${model} ${sourceLang}→${targetLang}`);
    upstream = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${providerSettings.api_key}`,
        'x-dashscope-dataInspection': 'disable'
      }
    });

    upstream.on('open', () => {
      if (gen !== upstreamGen || closed) return;
      upstream.send(JSON.stringify({
        type: 'session.update',
        session: buildInterpretationSession(targetLang)
      }));
    });

    upstream.on('message', async (raw) => {
      if (gen !== upstreamGen || closed) return;
      let event;
      try {
        event = JSON.parse(String(raw));
      } catch (_) {
        return;
      }
      const t = String(event.type || '');

      if (t === 'session.updated') {
        translationReady = true;
        reconnectAttempts = 0;
        logger.info(`[conferenceInterpret] ready conference=${conferenceId} role=${role} model=${model}`);
        flushPendingPcm();
      }
      if (t === 'response.created') {
        lastSpoken = '';
        logger.info(`[conferenceInterpret] response conference=${conferenceId} role=${role}`);
      }

      if (t === 'error') {
        const upstreamMsg = String(event.error?.message || event.message || '');
        logger.warn(
          `[conferenceInterpret] upstream conference=${conferenceId} role=${role}:`,
          upstreamMsg || 'unknown'
        );
        // Краткий обрыв сессии у Qwen — не рвём клиент и не шлём тост:
        // переоткрываем upstream, речь копится в pendingPcm.
        const transient = /session does not exist|session not found|connection reset/i.test(
          upstreamMsg
        );
        if (transient) {
          translationReady = false;
          if (reconnectAttempts < 12) {
            reconnectAttempts += 1;
            setTimeout(() => {
              if (closed) return;
              openUpstream().catch((e) => {
                logger.warn('[conferenceInterpret] transient reconnect:', e?.message || e);
              });
            }, Math.min(8000, 400 * reconnectAttempts));
          }
          return;
        }
        sendJson(clientWs, {
          type: 'error',
          code: 'QWEN_REALTIME_ERROR',
          message: upstreamMsg || 'Ошибка модели перевода'
        });
        return;
      }

      const audio = extractAudioB64(event);
      if (audio) {
        conferenceInterpretationHub.sendJsonToRole(conferenceId, targetRole, {
          type: 'interpret_audio',
          pcm: audio,
          language: targetLang
        });
      }

      if (
        t === 'response.audio_transcript.done' ||
        t === 'response.output_audio_transcript.done' ||
        t === 'response.text.done' ||
        t === 'response.output_text.done'
      ) {
        const spoken = extractEventText(event).trim();
        if (!spoken || spoken === lastSpoken) return;
        lastSpoken = spoken;
        const fresh = await interpretation.loadConf(conferenceId).catch(() => conf);
        if (role === 'host') {
          await interpretation.handleHostUtterance(conferenceId, fresh || conf, '', spoken);
        } else {
          await interpretation.handleParticipantUtterance(
            conferenceId,
            fresh || conf,
            '',
            null,
            spoken
          );
        }
      }
    });

    upstream.on('close', () => {
      if (closed || gen !== upstreamGen) return;
      translationReady = false;
      logger.warn(`[conferenceInterpret] upstream closed conference=${conferenceId} role=${role}`);
      if (reconnectAttempts >= 12) return;
      reconnectAttempts += 1;
      setTimeout(() => {
        if (closed) return;
        openUpstream().catch((e) => {
          logger.warn('[conferenceInterpret] reconnect:', e?.message || e);
        });
      }, Math.min(8000, 400 * reconnectAttempts));
    });

    upstream.on('error', (err) => {
      logger.warn('[conferenceInterpret] upstream ws:', err.message);
    });
  };

  clientWs.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch (_) {
      return;
    }
    if (msg.type === 'hangup') {
      closeAll('user');
      return;
    }
    if (msg.type === 'audio' && msg.pcm) {
      if (translationReady && upstream && upstream.readyState === WebSocket.OPEN) {
        upstream.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: msg.pcm
        }));
      } else if (pendingPcm.length < MAX_PENDING_PCM_CHUNKS) {
        pendingPcm.push(msg.pcm);
      } else {
        sendJson(clientWs, {
          type: 'error',
          code: 'INTERPRET_AUDIO_BACKLOG',
          message: 'Очередь речи переполнена; перевод будет переподключён'
        });
        closeAll('audio_backlog');
      }
    }
  });

  clientWs.on('close', () => {
    closeAll('client_close');
  });

  openUpstream().catch((e) => {
    logger.warn('[conferenceInterpret] open:', e?.message || e);
    sendJson(clientWs, { type: 'error', message: e.message || 'Не удалось открыть перевод' });
    closeAll('open_fail');
  });
}

async function handleInterpretationHostSocket(clientWs, ticket) {
  return handleInterpretationSocket(clientWs, ticket);
}

module.exports = {
  buildInterpretationSession,
  handleInterpretationSocket,
  handleInterpretationHostSocket
};
