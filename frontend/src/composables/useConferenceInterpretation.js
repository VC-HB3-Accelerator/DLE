/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * WS редактора: микрофон → лайв-перевод юзеру (озвучка + текст).
 */

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

export function createConferenceInterpretationController(options = {}) {
  const { onStatus, onError, onInterpretLine } = options;

  let ws = null;
  let audioCtx = null;
  let processor = null;
  let micSourceNode = null;
  let localStream = null;
  let interpretQueue = [];
  let interpretPlaying = false;
  let connected = false;
  let conferenceId = null;

  function setStatus(status) {
    onStatus?.(status);
  }

  function enqueueInterpretPlayback(b64) {
    const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const samples = Math.floor(raw.byteLength / 2);
    interpretQueue.push(new Int16Array(raw.buffer, raw.byteOffset, samples));
    if (!interpretPlaying) playNextInterpret();
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
    const chunk = interpretQueue.shift();
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

  function startMicStream() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    if (processor || !localStream) return;
    micSourceNode = audioCtx.createMediaStreamSource(localStream);
    processor = audioCtx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      const resampled = downsample(input, audioCtx.sampleRate, 16000);
      const pcm = floatTo16BitPCM(resampled);
      const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
      ws.send(JSON.stringify({ type: 'audio', pcm: btoa(bin) }));
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

  async function connect(id, session) {
    if (connected) return;
    conferenceId = id;
    setStatus('connecting');

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    return new Promise((resolve, reject) => {
      ws = new WebSocket(wsUrl(session.ws_path));
      ws.onopen = () => setStatus('connecting');
      ws.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.type === 'session' && msg.state === 'live') {
          connected = true;
          setStatus('connected');
          startMicStream();
          resolve();
        }
        if (msg.type === 'interpret_audio' && msg.pcm) {
          enqueueInterpretPlayback(msg.pcm);
        }
        if (msg.type === 'interpret_line') {
          onInterpretLine?.(msg);
        }
        if (msg.type === 'error') {
          const err = new Error(msg.message || 'Interpretation error');
          onError?.(err);
          reject(err);
        }
      };
      ws.onerror = () => {
        const err = new Error('Interpretation WebSocket failed');
        onError?.(err);
        reject(err);
      };
      ws.onclose = () => {
        if (connected) disconnect();
      };
    });
  }

  function disconnect() {
    try {
      ws?.send(JSON.stringify({ type: 'hangup' }));
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
    interpretQueue = [];
    interpretPlaying = false;
    connected = false;
    setStatus('disconnected');
  }

  return {
    connect,
    disconnect,
    get connected() {
      return connected;
    }
  };
}
