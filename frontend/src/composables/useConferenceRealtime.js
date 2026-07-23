/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * WebRTC-подключение к OpenAI Realtime для конференции.
 * API-ключ OpenAI на клиент не попадает — только ephemeral client_secret.
 */

import conferenceService from '@/services/conferenceService';

function safeParse(data) {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function createConferenceRealtimeController(options = {}) {
  const {
    onTranscript,
    onStatus,
    onError
  } = options;

  let pc = null;
  let dc = null;
  let audioEl = null;
  let localStream = null;
  let conferenceId = null;
  let connected = false;
  let muted = false;
  const handledCallIds = new Set();

  function setStatus(status) {
    onStatus?.(status);
  }

  function sendEvent(event) {
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
      if (conferenceId) {
        try {
          await conferenceService.appendTranscript(conferenceId, {
            role: 'participant',
            text: event.transcript
          });
        } catch {
          /* ignore */
        }
      }
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

  async function connect(id) {
    if (connected) return;
    conferenceId = id;
    setStatus('connecting');

    const session = await conferenceService.createRealtimeSession(id);
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

  function startPresentation(text) {
    const prompt =
      text ||
      'Start the audio presentation for the client now. Speak in guest_language. Use search_company_docs for company facts.';
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
              `Acknowledge silently and continue helping the client in guest_language.`
          }
        ]
      }
    });
    sendEvent({ type: 'response.create' });
  }

  function setMuted(next) {
    muted = Boolean(next);
    if (audioEl) audioEl.muted = muted;
    if (muted) {
      sendEvent({ type: 'response.cancel' });
    }
  }

  function disconnect() {
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
    connected = false;
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
