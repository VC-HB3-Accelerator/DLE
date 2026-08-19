/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Браузер ↔ наш WS `/ws?ticket=` ↔ DashScope realtime. Ключ только на backend.
 * Instructions = SP + rules + короткий RAG FAQ (без истории чата).
 * Гостевой ACL чата не копируем: квалификация абонента в трубке.
 */

const WebSocket = require('ws');
const logger = require('../utils/logger');
const aiProviderSettingsService = require('./aiProviderSettingsService');
const { realtimeWsUrlFromCompatibleBase } = require('./qwenRealtimeService');
const { extractEventText } = require('./qwenRealtimeService');
const sessionService = require('./voiceCallSessionService');
const knowledge = require('./voiceCallKnowledgeService');
const bargeQueue = require('./voiceCallBargeQueue');

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

async function handleVoiceCallSocket(clientWs, ticket) {
  const pending = [];
  let onClientMessage = (raw) => { pending.push(raw); };
  clientWs.on('message', (raw) => onClientMessage(raw));

  const row = await sessionService.sessionByTicket(ticket);
  if (!row || !['ready', 'connecting', 'live'].includes(row.status)) {
    sendJson(clientWs, { type: 'error', code: 'CALL_TICKET_INVALID', message: 'Сессия звонка недействительна' });
    clientWs.close();
    return;
  }
  logger.info(`[voiceCall] socket ticket=${String(ticket).slice(0, 8)} status=${row.status} model=${row.model_call}`);

  const owner = {
    ownerType: row.owner_type,
    ownerUserId: row.owner_user_id,
    ownerGuestId: row.owner_guest_id
  };

  let upstream = null;
  let upstreamGen = 0;
  let closed = false;
  let reconnects = 0;
  const openedAt = Date.now();
  let lastInstructions = knowledge.assembleCallInstructions({ allowAsk: false });
  let transcribe = true;
  let omniReady = false;
  let responseOpen = false;
  let ragBusy = false;
  let lastRagQuery = '';
  let pendingRagQuery = '';
  let callAudience = null;
  let selectedTopic = '';
  let usedFacts = [];
  let explanationLevel = 'balanced';
  let greetingSent = false;
  let callLocale = 'ru';
  let clientPlaying = false;
  let lastUserTranscript = '';
  let lastAssistantTranscript = '';
  const barge = bargeQueue.createBargeQueue();

  const flushBargeToOmni = (reason) => {
    if (!upstream || upstream.readyState !== WebSocket.OPEN) return 0;
    const { chunks, burstCount } = barge.drainStitched();
    if (!chunks.length) return 0;
    for (const ev of bargeQueue.flushAppendEvents(chunks)) {
      upstream.send(JSON.stringify(ev));
    }
    logger.info(`[voiceCall] barge flush reason=${reason} chunks=${chunks.length} utterances=${burstCount}`);
    return chunks.length;
  };

  const cancelUpstreamResponse = () => {
    if (upstream && upstream.readyState === WebSocket.OPEN && responseOpen) {
      try {
        upstream.send(JSON.stringify({ type: 'response.cancel' }));
      } catch (_) { /* ignore */ }
      responseOpen = false;
    }
    barge.clear();
  };

  const closeAll = async (reason) => {
    if (closed) return;
    closed = true;
    cancelUpstreamResponse();
    upstreamGen += 1;
    try { if (upstream) upstream.close(); } catch (_) { /* ignore */ }
    try { clientWs.close(); } catch (_) { /* ignore */ }
    await sessionService.hangup(row.id, null, reason || 'user');
  };

  const pushSessionUpdate = (instructions, { gateAudio = false } = {}) => {
    if (!upstream || upstream.readyState !== WebSocket.OPEN) return;
    lastInstructions = instructions;
    if (gateAudio) omniReady = false;
    upstream.send(JSON.stringify({
      type: 'session.update',
      session: knowledge.buildOmniSession(instructions, { transcribe })
    }));
  };

  const refreshRag = async (query) => {
    const q = String(query || '').trim();
    if (q.length < RAG_MIN_QUERY || closed) return;
    if (q === lastRagQuery) return;
    if (responseOpen || ragBusy) {
      pendingRagQuery = q;
      return;
    }
    ragBusy = true;
    try {
      const questionProfile = knowledge.classifyVoiceQuestion(q);
      explanationLevel = knowledge.detectExplanationLevel(q, explanationLevel);
      const spoken = knowledge.inferCallAudience(q);
      callAudience = knowledge.pickStrongerAudience(callAudience, spoken);
      const pack = await knowledge.buildCallInstructions(owner, q, {
        audience: callAudience,
        phase: 'ongoing',
        locale: callLocale,
        latestUserText: lastUserTranscript || q,
        recentAssistantText: lastAssistantTranscript,
        selectedTopic,
        usedFacts,
        questionProfile,
        explanationLevel
      });
      if (closed) return;
      if (responseOpen) {
        pendingRagQuery = q;
        return;
      }
      lastRagQuery = q;
      callAudience = knowledge.pickStrongerAudience(callAudience, pack.audienceSlug);
      selectedTopic = pack.selectedTopic || selectedTopic;
      usedFacts = (pack.usedFacts || []).slice(0, 6);
      explanationLevel = pack.explanationLevel || explanationLevel;
      pushSessionUpdate(pack.instructions);
      logger.info(`[voiceCall] RAG refresh snippets=${pack.snippetsCount} audience=${pack.audienceSlug} ask=${pack.allowAsk}`);
    } catch (error) {
      logger.warn('[voiceCall] RAG refresh:', error.message);
    } finally {
      ragBusy = false;
      if (!closed && !responseOpen && pendingRagQuery && pendingRagQuery !== lastRagQuery) {
        const next = pendingRagQuery;
        pendingRagQuery = '';
        refreshRag(next).catch(() => {});
      }
    }
  };

  sessionService.registerLive(row.id, {
    close: (reason) => {
      sendJson(clientWs, { type: 'ended', reason: reason || 'timeout' });
      closeAll(reason);
    }
  });

  sendJson(clientWs, {
    type: 'session',
    state: 'connecting',
    remaining_seconds: sessionService.remainingSeconds(row)
  });

  const openUpstream = async () => {
    if (closed) return;
    const gen = upstreamGen + 1;
    upstreamGen = gen;
    if (upstream) {
      const old = upstream;
      upstream = null;
      old.removeAllListeners();
      try { old.close(); } catch (_) { /* ignore */ }
    }
    omniReady = false;
    responseOpen = false;
    barge.clear();

    const [settings, pack] = await Promise.all([
      aiProviderSettingsService.getProviderSettings('qwencloud'),
      knowledge.buildCallInstructions(owner, knowledge.START_QUERY, {
        audience: callAudience,
        phase: 'greeting',
        locale: callLocale,
        latestUserText: '',
        recentAssistantText: '',
        selectedTopic,
        usedFacts,
        explanationLevel
      })
    ]);
    if (closed || gen !== upstreamGen) return;
    if (!settings?.api_key) {
      sendJson(clientWs, { type: 'error', code: 'QWENCLOUD_KEY_MISSING', message: 'Ключ Qwen Cloud не настроен' });
      await closeAll('error');
      return;
    }
    lastInstructions = pack.instructions;
    lastRagQuery = knowledge.START_QUERY;

    const url = realtimeWsUrlFromCompatibleBase(settings.base_url, row.model_call);
    logger.info(`[voiceCall] Omni connect model=${row.model_call}`);
    upstream = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${settings.api_key}`,
        'x-dashscope-dataInspection': 'disable'
      }
    });
    upstream.on('open', () => {
      if (gen !== upstreamGen || closed) return;
      pushSessionUpdate(lastInstructions, { gateAudio: true });
      sendJson(clientWs, { type: 'session', state: 'connecting' });
      callAudience = knowledge.pickStrongerAudience(callAudience, pack.audienceSlug);
      selectedTopic = pack.selectedTopic || selectedTopic;
      usedFacts = (pack.usedFacts || []).slice(0, 6);
      explanationLevel = pack.explanationLevel || explanationLevel;
      logger.info(`[voiceCall] RAG start snippets=${pack.snippetsCount} audience=${pack.audienceSlug} ask=${pack.allowAsk}`);
    });
    upstream.on('message', (raw) => {
      if (gen !== upstreamGen || closed) return;
      let event;
      try { event = JSON.parse(String(raw)); } catch (_) { return; }
      const t = String(event.type || '');
      if (t === 'session.updated') {
        omniReady = true;
        sendJson(clientWs, { type: 'session', state: 'live' });
        if (!greetingSent && upstream && upstream.readyState === WebSocket.OPEN) {
          greetingSent = true;
          try {
            for (const ev of knowledge.greetingTurnEvents(callLocale)) {
              upstream.send(JSON.stringify(ev));
            }
          } catch (_) { /* ignore */ }
        }
      }
      if (t === 'response.created') responseOpen = true;
      if (t === 'input_audio_buffer.speech_started') {
        logger.info('[voiceCall] Omni speech_started (no cancel; agent keeps talking)');
      }
      if (t === 'response.done') {
        const status = event.response?.status || event.status || '';
        if (status === 'cancelled') {
          logger.info('[voiceCall] Omni response cancelled despite barge hold');
        }
        responseOpen = false;
        const flushed = clientPlaying ? 0 : flushBargeToOmni('response.done');
        if (pendingRagQuery && !flushed && barge.chunkCount === 0) {
          const next = pendingRagQuery;
          pendingRagQuery = '';
          refreshRag(next).catch(() => {});
        }
      }
      if (t === 'error') {
        logger.warn('[voiceCall] upstream:', event.error?.message || event.message);
        if (transcribe && looksLikeTranscriptionError(event) && lastInstructions) {
          transcribe = false;
          pushSessionUpdate(lastInstructions);
          return;
        }
        sendJson(clientWs, { type: 'error', code: 'QWEN_REALTIME_ERROR', message: event.error?.message || 'Ошибка модели' });
        return;
      }
      const audio = extractAudioB64(event);
      if (audio) sendJson(clientWs, { type: 'audio', pcm: audio });
      const assistantText = extractEventText(event);
      if (
        t === 'response.audio_transcript.done'
        || t === 'response.output_audio_transcript.done'
        || t === 'response.text.done'
        || t === 'response.output_text.done'
      ) {
        lastAssistantTranscript = assistantText.trim();
        sendJson(clientWs, { type: 'transcript', text: lastAssistantTranscript });
      }
      const userText = knowledge.extractUserTranscript(event);
      if (userText) {
        lastUserTranscript = userText;
        sendJson(clientWs, { type: 'user_transcript', text: userText });
        refreshRag(userText).catch(() => {});
      }
    });
    upstream.on('close', () => {
      if (closed || gen !== upstreamGen) return;
      logger.warn(`[voiceCall] Omni closed recon=${reconnects}`);
      if (Date.now() - openedAt < 60 * 1000 && reconnects < 3 && row.status === 'live') {
        reconnects += 1;
        setTimeout(() => openUpstream().catch(() => {}), 500);
      }
    });
    upstream.on('error', (err) => {
      logger.warn('[voiceCall] upstream ws:', err.message);
    });
  };

  const handleClientMessage = async (raw) => {
    let msg;
    try { msg = JSON.parse(String(raw)); } catch (_) { return; }
    const type = String(msg.type || '');
    if (type === 'hangup') {
      await closeAll('user');
      return;
    }
    if (type === 'mic_ready') {
      if (msg.locale) callLocale = knowledge.normalizeCallLocale(msg.locale);
      try {
        logger.info(`[voiceCall] mic_ready session=${row.id} locale=${callLocale}`);
        const live = await sessionService.consumeMicReady(row.id, owner);
        sendJson(clientWs, {
          type: 'session',
          state: 'connecting',
          remaining_seconds: sessionService.remainingSeconds(live),
          deadline_at: live.deadline_at
        });
        await openUpstream();
      } catch (error) {
        logger.warn('[voiceCall] mic_ready:', error.message);
        sendJson(clientWs, {
          type: 'error',
          code: error.code || 'START_FAILED',
          message: error.message
        });
        if (error.code === 'CALL_PAYMENT_REQUIRED') await closeAll('payment');
      }
      return;
    }
    if (type === 'audio' && msg.pcm && omniReady && upstream && upstream.readyState === WebSocket.OPEN) {
      clientPlaying = Boolean(msg.playing);
      const routed = bargeQueue.routeClientAudio(barge, {
        pcm: msg.pcm,
        responseOpen,
        playing: clientPlaying
      });
      if (routed.flush.length) {
        for (const ev of bargeQueue.flushAppendEvents(routed.flush)) {
          upstream.send(JSON.stringify(ev));
        }
        logger.info(`[voiceCall] barge flush reason=hold-end chunks=${routed.flush.length} utterances=${routed.burstCount}`);
      }
      if (routed.action === 'hold') {
        if (barge.chunkCount === 1) {
          logger.info('[voiceCall] barge queued while agent speaking');
        }
        return;
      }
      upstream.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: msg.pcm
      }));
    }
  };

  onClientMessage = (raw) => {
    handleClientMessage(raw).catch((error) => {
      logger.warn('[voiceCall] client message:', error.message);
    });
  };
  const queued = pending.splice(0, pending.length);
  for (const raw of queued) onClientMessage(raw);

  clientWs.on('close', () => {
    logger.info(`[voiceCall] client close session=${row.id}`);
    closeAll('user').catch(() => {});
  });
}

module.exports = {
  handleVoiceCallSocket
};
