/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Голосовой Realtime для конференции: Qwen WS (прокси) или OpenAI WebRTC.
 */

import conferenceService from '@/services/conferenceService';

function safeParse(data) {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function wsUrl(path) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${path}`;
}

function floatTo16BitPCM(input) {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function downsample(buffer, inRate, outRate = 16000) {
  if (inRate === outRate) return buffer;
  const ratio = inRate / outRate;
  const newLen = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLen);
  for (let i = 0; i < newLen; i += 1) {
    result[i] = buffer[Math.floor(i * ratio)] || 0;
  }
  return result;
}

export function createConferenceRealtimeController(options = {}) {
  const { onTranscript, onStatus, onError } = options;

  let mode = null;
  let pc = null;
  let dc = null;
  let ws = null;
  let audioEl = null;
  let audioCtx = null;
  let processor = null;
  let micSourceNode = null;
  let localStream = null;
  let playQueue = [];
  let interpretPlayQueue = [];
  let playing = false;
  let interpretPlaying = false;
  let conferenceId = null;
  let connected = false;
  let muted = false;
  const handledCallIds = new Set();

  function setStatus(status) {
    onStatus?.(status);
  }

  function sendWs(obj) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(obj));
    return true;
  }

  function sendEvent(event) {
    if (mode === 'qwen_ws') {
      if (!event?.type) return false;
      if (event.type === 'conversation.item.create') {
        const item = event.item || {};
        if (item.type === 'function_call_output') {
          return sendWs({ type: 'upstream_event', event });
        }
        if (item.type === 'message' && item.role === 'user') {
          const text = (item.content || [])
            .map((c) => c.text || '')
            .join(' ')
            .trim();
          if (!text) return false;
          return sendWs({ type: 'chat_message', text });
        }
        return false;
      }
      if (event.type === 'response.create') {
        return sendWs({ type: 'upstream_event', event });
      }
      return sendWs({ type: 'upstream_event', event });
    }
    if (!dc || dc.readyState !== 'open') return false;
    dc.send(JSON.stringify(event));
    return true;
  }

  async function handleToolCall({ name, callId, argsRaw }) {
    if (name !== 'search_company_docs' || !callId || !conferenceId) return;
    if (handledCallIds.has(callId)) return;
    handledCallIds.add(callId);

    let query = '';
    try {
      query = JSON.parse(argsRaw || '{}').query || '';
    } catch {
      query = '';
    }
    try {
      const result = await conferenceService.searchDocs(conferenceId, query);
      sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify({
            found: result.found,
            answer: result.answer || '',
            snippets: result.snippets || []
          })
        }
      });
      sendEvent({ type: 'response.create' });
    } catch (e) {
      onError?.(e);
      sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify({
            found: false,
            answer: 'Search failed. Tell the client data is temporarily unavailable.',
            snippets: []
          })
        }
      });
      sendEvent({ type: 'response.create' });
    }
  }

  async function handleServerEvent(event) {
    if (!event?.type) return;

    if (
      (event.type === 'response.output_audio_transcript.done' ||
        event.type === 'response.audio_transcript.done') &&
      event.transcript
    ) {
      onTranscript?.({ role: 'agent', text: event.transcript });
      if (conferenceId) {
        try {
          await conferenceService.appendTranscript(conferenceId, {
            role: 'agent',
            text: event.transcript
          });
        } catch {
          /* ignore */
        }
      }
    }

    if (event.type === 'conversation.item.input_audio_transcription.completed' && event.transcript) {
      onTranscript?.({ role: 'participant', text: event.transcript });
    }

    if (event.type === 'response.function_call_arguments.done') {
      await handleToolCall({
        name: event.name,
        callId: event.call_id,
        argsRaw: event.arguments
      });
      return;
    }

    if (event.type === 'response.output_item.done' && event.item?.type === 'function_call') {
      await handleToolCall({
        name: event.item.name,
        callId: event.item.call_id,
        argsRaw: event.item.arguments
      });
    }
  }

  function enqueuePlayback(b64) {
    const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const samples = Math.floor(raw.byteLength / 2);
    const pcm = new Int16Array(raw.buffer, raw.byteOffset, samples);
    playQueue.push(pcm);
    if (!playing) playNext();
  }

  async function playNextInterpret() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') {
      try {
        await audioCtx.resume();
      } catch {
        /* ignore */
      }
    }
    const chunk = interpretPlayQueue.shift();
    if (!chunk) {
      interpretPlaying = false;
      return;
    }
    interpretPlaying = true;
    const buffer = audioCtx.createBuffer(1, chunk.length, 24000);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < chunk.length; i += 1) data[i] = chunk[i] / 0x8000;
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(audioCtx.destination);
    src.onended = () => playNextInterpret();
    src.start();
  }

  function enqueueInterpretPlayback(b64) {
    const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const samples = Math.floor(raw.byteLength / 2);
    interpretPlayQueue.push(new Int16Array(raw.buffer, raw.byteOffset, samples));
    if (!interpretPlaying) playNextInterpret();
  }

  async function playNext() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') {
      try {
        await audioCtx.resume();
      } catch {
        /* ignore */
      }
    }
    const chunk = playQueue.shift();
    if (!chunk) {
      playing = false;
      return;
    }
    playing = true;
    const buffer = audioCtx.createBuffer(1, chunk.length, 24000);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < chunk.length; i += 1) data[i] = chunk[i] / 0x8000;
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(audioCtx.destination);
    src.onended = () => playNext();
    src.start();
  }

  function startMicStream() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    if (processor || !localStream) return;
    micSourceNode = audioCtx.createMediaStreamSource(localStream);
    processor = audioCtx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => {
      if (!ws || ws.readyState !== WebSocket.OPEN || muted) return;
      const input = e.inputBuffer.getChannelData(0);
      const resampled = downsample(input, audioCtx.sampleRate, 16000);
      const pcm = floatTo16BitPCM(resampled);
      const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
      sendWs({ type: 'audio', pcm: btoa(bin), playing });
    };
    const keepAlive = audioCtx.createGain();
    keepAlive.gain.value = 0;
    micSourceNode.connect(processor);
    processor.connect(keepAlive);
    keepAlive.connect(audioCtx.destination);
  }

  function stopMicStream() {
    try {
      processor?.disconnect();
    } catch {
      /* ignore */
    }
    processor = null;
    try {
      micSourceNode?.disconnect();
    } catch {
      /* ignore */
    }
    micSourceNode = null;
    localStream?.getTracks?.().forEach((t) => t.stop());
    localStream = null;
  }

  async function connectQwenWs(id, session) {
    conferenceId = id;
    mode = 'qwen_ws';
    setStatus('connecting');

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    return new Promise((resolve, reject) => {
      let micSent = false;
      let settled = false;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      };
      const succeed = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const connectTimer = setTimeout(() => {
        fail(new Error('Realtime connection timeout'));
      }, 90000);

      ws = new WebSocket(wsUrl(session.ws_path));

      ws.onopen = () => {
        setStatus('connecting');
      };

      ws.onmessage = (ev) => {
        const msg = safeParse(ev.data);
        if (!msg) return;

        if (msg.type === 'session' && msg.state === 'ready' && !micSent) {
          micSent = true;
          sendWs({ type: 'mic_ready' });
        }
        if (msg.type === 'session' && msg.state === 'live') {
          connected = true;
          clearTimeout(connectTimer);
          setStatus('connected');
          startMicStream();
          succeed();
        }
        if (msg.type === 'interpret_audio' && msg.pcm) {
          enqueueInterpretPlayback(msg.pcm);
        }
        if (msg.type === 'interpret_line' && msg.original) {
          onTranscript?.({
            role: msg.role || 'participant',
            text: msg.original,
            text_translated: msg.translated || null
          });
        }
        if (msg.type === 'audio' && msg.pcm && !muted) {
          enqueuePlayback(msg.pcm);
        }
        if (msg.type === 'transcript' && msg.text) {
          onTranscript?.({ role: 'agent', text: msg.text });
        }
        if (msg.type === 'user_transcript' && msg.text) {
          onTranscript?.({ role: 'participant', text: msg.text });
        }
        if (msg.type === 'translation' && msg.translated) {
          onTranscript?.({
            role: msg.role || 'participant',
            text: msg.original || '',
            text_translated: msg.translated
          });
        }
        if (msg.type === 'error') {
          clearTimeout(connectTimer);
          const err = new Error(msg.message || 'Realtime error');
          onError?.(err);
          fail(err);
        }
        if (msg.type === 'ended') {
          disconnect();
        }
      };

      ws.onerror = () => {
        clearTimeout(connectTimer);
        const err = new Error('WebSocket connection failed');
        onError?.(err);
        fail(err);
      };

      ws.onclose = () => {
        clearTimeout(connectTimer);
        if (connected) disconnect();
      };
    });
  }

  async function connectOpenAi(id, session) {
    conferenceId = id;
    mode = 'openai_webrtc';
    setStatus('connecting');

    const ephemeral = session.client_secret;
    if (!ephemeral) {
      throw new Error('No ephemeral key');
    }

    pc = new RTCPeerConnection();
    audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    pc.ontrack = (e) => {
      audioEl.srcObject = e.streams[0];
      if (muted) audioEl.muted = true;
    };

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    dc = pc.createDataChannel('oai-events');
    dc.addEventListener('open', () => {
      connected = true;
      setStatus('connected');
    });
    dc.addEventListener('message', (e) => {
      const event = safeParse(e.data);
      if (event) handleServerEvent(event);
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${ephemeral}`,
        'Content-Type': 'application/sdp'
      }
    });

    if (!sdpResponse.ok) {
      const errText = await sdpResponse.text();
      throw new Error(errText || 'Realtime SDP failed');
    }

    const answer = { type: 'answer', sdp: await sdpResponse.text() };
    await pc.setRemoteDescription(answer);
  }

  async function connect(id) {
    if (connected) return;
    const session = await conferenceService.createRealtimeSession(id);
    const sessionMode = session.mode || (session.client_secret ? 'openai_webrtc' : null);

    if (sessionMode === 'qwen_ws' && session.ws_path) {
      await connectQwenWs(id, session);
      return;
    }
    await connectOpenAi(id, session);
  }

  function startPresentation(text) {
    const prompt =
      text ||
      'Start the audio presentation for the client now. Speak in guest_language. Use search_company_docs for company facts.';
    if (mode === 'qwen_ws') {
      sendWs({ type: 'presentation_start', text: prompt });
      return;
    }
    sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: prompt }]
      }
    });
    sendEvent({ type: 'response.create' });
  }

  function applyCoach(text) {
    if (mode === 'qwen_ws') {
      sendWs({ type: 'coach', text });
      return;
    }
    sendEvent({ type: 'response.cancel' });
    sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text:
              `[HOST COACH — do not read aloud to the client] New lasting rule: ${text}. ` +
              'Acknowledge silently and continue helping the client in guest_language.'
          }
        ]
      }
    });
    sendEvent({ type: 'response.create' });
  }

  function setMuted(next) {
    muted = Boolean(next);
    if (audioEl) audioEl.muted = muted;
    if (mode === 'qwen_ws') {
      sendWs({ type: muted ? 'mute' : 'unmute' });
      if (muted) playQueue = [];
      return;
    }
    if (muted) {
      sendEvent({ type: 'response.cancel' });
    }
  }

  function disconnect() {
    if (mode === 'qwen_ws') {
      try {
        sendWs({ type: 'hangup' });
      } catch {
        /* ignore */
      }
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      ws = null;
      stopMicStream();
      playQueue = [];
      playing = false;
    } else {
      try {
        dc?.close();
      } catch {
        /* ignore */
      }
      try {
        pc?.close();
      } catch {
        /* ignore */
      }
      localStream?.getTracks?.().forEach((t) => t.stop());
      dc = null;
      pc = null;
      localStream = null;
      audioEl = null;
    }
    connected = false;
    mode = null;
    setStatus('disconnected');
  }

  return {
    connect,
    disconnect,
    startPresentation,
    applyCoach,
    setMuted,
    sendEvent,
    get connected() {
      return connected;
    }
  };
}
