/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Браузер ↔ WS conference_ticket ↔ DashScope Realtime для конференции.
 */

const WebSocket = require('ws');
const logger = require('../utils/logger');
const aiProviderSettingsService = require('./aiProviderSettingsService');
const {
  realtimeWsUrlFromCompatibleBase,
  extractEventText,
  QWEN_AUDIO_REALTIME_MODEL
} = require('./qwenRealtimeService');
const conferenceRealtimeTicketService = require('./conferenceRealtimeTicketService');
const conferenceService = require('./conferenceService');
const conferenceRealtimeService = require('./conferenceRealtimeService');
const conferenceTranslateService = require('./conferenceTranslateService');
const conferenceAiAgentService = require('./conferenceAiAgentService');
const knowledge = require('./conferenceKnowledgeService');
const conferenceInterpretationHub = require('./conferenceInterpretationHub');
const interpretation = require('./conferenceInterpretationService');

const RAG_MIN_QUERY = 8;

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

function looksLikeTranscriptionError(event) {
  const msg = String(event?.error?.message || event?.message || event?.error || '');
  return /transcription|asr|input_audio_transcription/i.test(msg);
}

async function handleParticipantTranscript({
  clientWs,
  conferenceId,
  conf,
  actorId,
  userText,
  ragHelpers
}) {
  sendJson(clientWs, { type: 'user_transcript', text: userText });

  const confFull = await interpretation.loadConf(conferenceId);

  if (interpretation.isInterpretationEnabled(confFull)) {
    await interpretation.handleParticipantUtterance(conferenceId, confFull, userText, actorId);
  } else {
    let translated = null;
    try {
      translated = await conferenceTranslateService.translateForConferenceRoles(
        userText,
        'participant',
        conf
      );
    } catch (e) {
      logger.warn('[conferenceMedia] translate:', e?.message || e);
    }

    if (translated) {
      sendJson(clientWs, {
        type: 'translation',
        role: 'participant',
        original: userText,
        translated,
        target_lang: conf.host_language || 'ru'
      });
    }

    try {
      await conferenceRealtimeService.appendTranscript(conferenceId, 'participant', userText, {
        translatedText: translated
      });
    } catch (e) {
      logger.warn('[conferenceMedia] append participant transcript:', e?.message || e);
    }
  }

  if (userText.length >= RAG_MIN_QUERY && ragHelpers) {
    await refreshRagContext({
      conferenceId,
      actorId,
      query: userText,
      ...ragHelpers
    }).catch(() => {});
  }
}

async function refreshRagContext({
  conferenceId,
  actorId,
  query,
  pushSessionUpdate,
  getInstructions,
  setInstructions
}) {
  const q = String(query || '').trim();
  if (q.length < RAG_MIN_QUERY) return;

  const base = getInstructions();
  const result = await conferenceRealtimeService.searchCompanyDocs(conferenceId, q, actorId);
  const next = knowledge.appendRagBlock(base, result.answer, { found: result.found });
  setInstructions(next);
  pushSessionUpdate(next);
}

async function handleConferenceSocket(clientWs, ticket) {
  const pending = [];
  let onClientMessage = (raw) => {
    pending.push(raw);
  };
  clientWs.on('message', (raw) => onClientMessage(raw));

  const entry = conferenceRealtimeTicketService.consumeTicket(ticket);
  if (!entry) {
    sendJson(clientWs, {
      type: 'error',
      code: 'CONFERENCE_TICKET_INVALID',
      message: 'Тикет конференции недействителен или истёк'
    });
    clientWs.close();
    return;
  }

  const conferenceId = entry.conferenceId;
  const actorId = entry.userId;

  let membership;
  try {
    membership = await conferenceRealtimeService.assertConferenceMember(conferenceId, actorId);
  } catch (e) {
    sendJson(clientWs, {
      type: 'error',
      code: e.code || 'FORBIDDEN',
      message: e.message || 'Нет доступа'
    });
    clientWs.close();
    return;
  }

  const conf = membership.session;
  const confFull = await interpretation.loadConf(conferenceId);
  conferenceInterpretationHub.registerClient(conferenceId, 'primary', clientWs);
  const settings = await conferenceAiAgentService.getSettings();
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

  const model =
    settings.model ||
    providerSettings.selected_model ||
    QWEN_AUDIO_REALTIME_MODEL;

  let upstream = null;
  let upstreamGen = 0;
  let closed = false;
  let omniReady = false;
  let responseOpen = false;
  let agentMuted = false;
  let transcribe = true;
  let lastInstructions = await knowledge.buildAgentInstructions(conf);
  let lastRagQuery = '';

  const getInstructions = () => lastInstructions;
  const setInstructions = (v) => {
    lastInstructions = v;
  };

  const pushSessionUpdate = (instructions, { gateAudio = false } = {}) => {
    if (!upstream || upstream.readyState !== WebSocket.OPEN) return;
    if (gateAudio) omniReady = false;
    upstream.send(JSON.stringify({
      type: 'session.update',
      session: knowledge.buildOmniSession(instructions, conf)
    }));
  };

  const cancelUpstreamResponse = () => {
    if (upstream && upstream.readyState === WebSocket.OPEN && responseOpen) {
      try {
        upstream.send(JSON.stringify({ type: 'response.cancel' }));
      } catch (_) {
        /* ignore */
      }
      responseOpen = false;
    }
  };

  const closeAll = (reason) => {
    if (closed) return;
    closed = true;
    cancelUpstreamResponse();
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
    logger.info(`[conferenceMedia] closed conference=${conferenceId} reason=${reason || 'done'}`);
  };

  const ragHelpers = {
    pushSessionUpdate,
    getInstructions,
    setInstructions
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
    omniReady = false;
    responseOpen = false;

    const url = realtimeWsUrlFromCompatibleBase(providerSettings.base_url, model);
    logger.info(`[conferenceMedia] Omni connect conference=${conferenceId} model=${model}`);
    upstream = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${providerSettings.api_key}`,
        'x-dashscope-dataInspection': 'disable'
      }
    });

    upstream.on('open', () => {
      if (gen !== upstreamGen || closed) return;
      pushSessionUpdate(lastInstructions, { gateAudio: true });
      sendJson(clientWs, { type: 'session', state: 'connecting', model });
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
        omniReady = true;
        sendJson(clientWs, { type: 'session', state: 'live', model });
      }
      if (t === 'response.created') responseOpen = true;
      if (t === 'response.done') responseOpen = false;

      if (t === 'error') {
        logger.warn('[conferenceMedia] upstream:', event.error?.message || event.message);
        if (transcribe && looksLikeTranscriptionError(event) && lastInstructions) {
          transcribe = false;
          pushSessionUpdate(lastInstructions);
          return;
        }
        sendJson(clientWs, {
          type: 'error',
          code: 'QWEN_REALTIME_ERROR',
          message: event.error?.message || 'Ошибка модели'
        });
        return;
      }

      if (agentMuted) {
        if (t === 'response.created') cancelUpstreamResponse();
      } else {
        const audio = extractAudioB64(event);
        if (audio) sendJson(clientWs, { type: 'audio', pcm: audio });
      }

      const assistantText = extractEventText(event);
      if (
        t === 'response.audio_transcript.done' ||
        t === 'response.output_audio_transcript.done' ||
        t === 'response.text.done' ||
        t === 'response.output_text.done'
      ) {
        const text = assistantText.trim();
        if (text) {
          sendJson(clientWs, { type: 'transcript', text });
          try {
            await conferenceRealtimeService.appendTranscript(conferenceId, 'agent', text);
          } catch (e) {
            logger.warn('[conferenceMedia] append agent:', e?.message || e);
          }
        }
      }

      const userText = knowledge.extractUserTranscript(event);
      if (userText && userText !== lastRagQuery) {
        lastRagQuery = userText;
        await handleParticipantTranscript({
          clientWs,
          conferenceId,
          conf,
          actorId,
          userText,
          ragHelpers
        });
      }
    });

    upstream.on('close', () => {
      if (closed || gen !== upstreamGen) return;
      logger.warn(`[conferenceMedia] upstream closed conference=${conferenceId}`);
    });

    upstream.on('error', (err) => {
      logger.warn('[conferenceMedia] upstream ws:', err.message);
    });
  };

  const handleClientMessage = async (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch (_) {
      return;
    }
    const type = String(msg.type || '');

    if (type === 'hangup') {
      closeAll('user');
      return;
    }

    if (type === 'mic_ready') {
      sendJson(clientWs, { type: 'session', state: 'connecting', model });
      await openUpstream();
      return;
    }

    if (type === 'presentation_start') {
      if (!upstream || upstream.readyState !== WebSocket.OPEN) return;
      for (const ev of knowledge.presentationTurnEvents(msg.text)) {
        upstream.send(JSON.stringify(ev));
      }
      return;
    }

    if (type === 'chat_message') {
      if (!upstream || upstream.readyState !== WebSocket.OPEN) return;
      for (const ev of knowledge.chatTurnEvents(msg.text)) {
        upstream.send(JSON.stringify(ev));
      }
      return;
    }

    if (type === 'upstream_event' && msg.event && upstream && upstream.readyState === WebSocket.OPEN) {
      upstream.send(JSON.stringify(msg.event));
      return;
    }

    if (type === 'coach') {
      if (!upstream || upstream.readyState !== WebSocket.OPEN) return;
      const events = knowledge.coachTurnEvents(msg.text);
      const merged = knowledge.appendRagBlock(
        lastInstructions,
        `[COACH] ${String(msg.text || '').trim()}`,
        { found: true }
      );
      setInstructions(merged);
      for (const ev of events) upstream.send(JSON.stringify(ev));
      return;
    }

    if (type === 'mute') {
      agentMuted = true;
      cancelUpstreamResponse();
      return;
    }

    if (type === 'unmute') {
      agentMuted = false;
      return;
    }

    if (type === 'audio' && msg.pcm && omniReady && upstream && upstream.readyState === WebSocket.OPEN) {
      upstream.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: msg.pcm
      }));
    }
  };

  onClientMessage = (raw) => {
    handleClientMessage(raw).catch((error) => {
      logger.warn('[conferenceMedia] client message:', error.message);
    });
  };
  const queued = pending.splice(0, pending.length);
  for (const raw of queued) onClientMessage(raw);

  clientWs.on('close', () => {
    closeAll('client_close');
  });

  // подтверждаем сессию до mic_ready
  const sessionRow = await conferenceService.getSession(conferenceId).catch(() => null);
  sendJson(clientWs, {
    type: 'session',
    state: 'ready',
    conference_id: conferenceId,
    guest_language: sessionRow?.session?.guest_language || conf.guest_language,
    host_language: sessionRow?.session?.host_language || conf.host_language
  });
}

module.exports = {
  handleConferenceSocket
};
