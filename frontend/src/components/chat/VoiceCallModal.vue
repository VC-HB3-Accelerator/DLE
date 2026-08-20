<template>
  <div class="voice-call-modal" role="dialog" aria-modal="true">
    <div class="voice-call-modal__backdrop" @click="close" />
    <div class="voice-call-modal__card">
      <header class="voice-call-modal__head">
        <h3>{{ $t('chat.voiceCall.title') }}</h3>
        <button type="button" class="voice-call-modal__close" @click="close">×</button>
      </header>

      <div v-if="!config.enabled" class="voice-call-modal__note">
        {{ $t('chat.voiceCall.disabled') }}
      </div>
      <div v-else-if="!config.call_ready" class="voice-call-modal__note">
        {{ $t('chat.voiceCall.noModel') }}
        <div class="voice-call-modal__actions">
          <button type="button" class="btn btn-outline" @click="goBookStaff">{{ $t('chat.voiceCall.toHuman') }}</button>
        </div>
      </div>
      <template v-else>
        <section class="voice-call-modal__body">
          <p v-if="!showTariffs" class="voice-call-modal__note">{{ $t('chat.voiceCall.freeMode') }}</p>
          <div v-if="showTariffs" class="voice-call-modal__packages">
            <label v-for="pkg in config.packages" :key="pkg.id" class="pkg">
              <input v-model="selectedPackageId" type="radio" :value="pkg.id">
              <span>{{ pkg.minutes }} {{ $t('chat.voiceCall.min') }}</span>
              <strong v-if="showPrice(pkg)">{{ pkg.price }} {{ config.token_symbol }}</strong>
              <strong v-else>{{ $t('chat.voiceCall.free') }}</strong>
            </label>
          </div>

          <p v-if="state === 'awaiting_payment' && invoice" class="pay-box">
            {{ $t('chat.voiceCall.payExactly', { amount: invoice.amount_unique, token: invoice.token_symbol, sticker: invoice.sticker }) }}
            <br>
            <code>{{ invoice.pay_to_address }}</code>
            <button type="button" class="btn btn-outline btn-sm" @click="copy(invoice.pay_to_address)">{{ $t('chat.voiceCall.copy') }}</button>
            <a v-if="invoice.eip681" class="btn btn-outline btn-sm" :href="invoice.eip681">{{ $t('chat.voiceCall.openWallet') }}</a>
          </p>

          <div
            v-if="state === 'connecting' || state === 'live'"
            class="voice-call-modal__speaker"
          >
            <button
              type="button"
              class="voice-call-modal__speaker-btn"
              :disabled="!supportsSetSinkId || !outputDevices.length"
              :title="speakerTitle"
              @click="cycleSpeaker"
            >
              <svg viewBox="0 0 24 24" class="voice-call-modal__icon" aria-hidden="true">
                <path d="M3 10v4h4l5 4V6L7 10H3z" />
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.08c.58.43.95 1.13.95 1.95s-.37 1.52-.95 1.95v2.08c1.48-.74 2.5-2.26 2.5-4.03z" />
                <path d="M19.5 12c0-3.04-1.72-5.67-4.22-6.98v2.23c1.62 1.08 2.72 2.95 2.72 4.75s-1.1 3.67-2.72 4.75v2.23c2.5-1.31 4.22-3.94 4.22-6.98z" />
              </svg>
            </button>
            <p v-if="!supportsSetSinkId" class="voice-call-modal__hint">
              {{ $t('chat.voiceCall.speakerNotSupported') }}
            </p>
          </div>

          <p v-if="errorText" class="voice-call-modal__error">{{ errorText }}</p>
          <p v-if="state === 'connecting'" class="voice-call-modal__note connecting-note">
            {{ $t('chat.voiceCall.connecting') }}
          </p>
          <p v-if="state === 'live'" class="timer">{{ formatTime(remaining) }}</p>
          <p v-if="transcript" class="transcript">{{ transcript }}</p>

          <div class="voice-call-modal__actions">
            <button
              v-if="needsPay && state !== 'live' && state !== 'connecting'"
              type="button"
              class="btn btn-outline"
              :disabled="busy"
              @click="pay"
            >{{ $t('chat.voiceCall.pay') }}</button>
            <button
              v-if="state === 'awaiting_payment'"
              type="button"
              class="btn btn-outline"
              :disabled="busy"
              @click="checkPay"
            >{{ $t('chat.voiceCall.checkPay') }}</button>
            <button
              v-if="state !== 'live' && state !== 'connecting'"
              type="button"
              class="btn btn-primary"
              :disabled="busy || (needsPay && invoice?.status !== 'paid' && creditsSeconds < selectedMinutes * 60)"
              @click="startCall"
            >{{ $t('chat.voiceCall.start') }}</button>
            <button
              v-if="state === 'live' || state === 'connecting'"
              type="button"
              class="btn btn-danger voice-call-modal__hangup"
              @click="hangup"
              :aria-label="$t('chat.voiceCall.hangup')"
            >
              <svg viewBox="0 0 24 24" class="voice-call-modal__icon voice-call-modal__icon--phone" aria-hidden="true">
                <path d="M4.1 4.1c.5-.5 1.3-.5 1.8 0l2.3 2.3c.5.5.5 1.3 0 1.8l-1 1c.8 1.5 2 2.8 3.5 3.5l1-1c.5-.5 1.3-.5 1.8 0l2.3 2.3c.5.5.5 1.3 0 1.8l-1 1c-.8.8-2.1 1-3.2.5-3.4-1.6-6.2-4.4-7.8-7.8-.5-1.1-.3-2.4.5-3.2l1-1z" />
                <path d="M14 3h7v7h-2V6.4l-5.3 5.3-1.4-1.4L17.6 5H14V3z" opacity="0.6" />
              </svg>
              <span class="voice-call-modal__hangup-text">{{ $t('chat.voiceCall.hangup') }}</span>
            </button>
            <button
              v-if="state === 'time_up' || state === 'ended' || state === 'idle'"
              type="button"
              class="btn btn-outline"
              @click="goBookStaff"
            >{{ $t('chat.voiceCall.toHuman') }}</button>
          </div>
        </section>
      </template>
    </div>
    <audio ref="playbackEl" class="voice-call-modal__playback" aria-hidden="true" />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import api from '@/api/axios';
import { getFromStorage, setToStorage } from '@/utils/storage';
import { generateUniqueId } from '@/utils/helpers';

const emit = defineEmits(['close']);
const { t, locale } = useI18n();
const router = useRouter();

const config = ref({ enabled: true, paid_enabled: false, packages: [], token_symbol: 'USDT', call_ready: false });
const selectedPackageId = ref('');
const invoice = ref(null);
const state = ref('idle');
const busy = ref(false);
const errorText = ref('');
const remaining = ref(0);
const transcript = ref('');
const creditsSeconds = ref(0);
const playbackEl = ref(null);
const outputDevices = ref([]);
const selectedSinkId = ref(getFromStorage('voiceCallSinkId', '') || '');
const supportsSetSinkId = ref(false);

let ws = null;
let timer = null;
let audioCtx = null;
let playbackDest = null;
let processor = null;
let mediaStream = null;
let callSessionId = null;
let ringTimer = null;
let ringOsc = null;
const playQueue = [];
let playing = false;
let activePlaybackSource = null;
let mixDest = null;
let mediaRecorder = null;
const recordedChunks = [];
let transcriptLog = [];
let micSourceNode = null;
let saveRecordingEnabled = true;
let hangupInFlight = null;

const selectedPkg = computed(() => (config.value.packages || []).find((p) => p.id === selectedPackageId.value) || null);
const selectedMinutes = computed(() => Number(selectedPkg.value?.minutes || 0));
const showTariffs = computed(() => Boolean(
  config.value.paid_enabled
  && (config.value.packages || []).some((pkg) => Number(pkg.price) > 0)
));
const needsPay = computed(() => Boolean(showTariffs.value && Number(selectedPkg.value?.price || 0) > 0));

function callLocaleTag() {
  const raw = String(locale.value || 'ru').toLowerCase();
  return raw.startsWith('en') ? 'en' : 'ru';
}

function showPrice(pkg) {
  return Boolean(config.value.paid_enabled && Number(pkg.price) > 0);
}

function formatTime(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function copy(text) {
  navigator.clipboard?.writeText(text);
}

function playbackOutputNode(ctx) {
  if (supportsSetSinkId.value && playbackDest) return playbackDest;
  return ctx.destination;
}

const speakerTitle = computed(() => {
  if (!supportsSetSinkId.value) return t('chat.voiceCall.speakerNotSupported');
  if (!outputDevices.value.length) return t('chat.voiceCall.speaker');
  const cur = outputDevices.value.find((d) => d.deviceId === selectedSinkId.value);
  if (!cur) return t('chat.voiceCall.speakerDefault');
  return cur.label || cur.deviceId;
});

async function applySinkId(deviceId) {
  selectedSinkId.value = deviceId || '';
  setToStorage('voiceCallSinkId', selectedSinkId.value);
  const el = playbackEl.value;
  if (!el || typeof el.setSinkId !== 'function') return;
  try {
    await el.setSinkId(deviceId || '');
  } catch (_) { /* ignore */ }
}

async function refreshOutputDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    outputDevices.value = devices.filter((d) => d.kind === 'audiooutput' && d.deviceId);
  } catch (_) { /* ignore */ }
}

function ensurePlaybackRouting(ctx) {
  const el = playbackEl.value;
  supportsSetSinkId.value = Boolean(el && typeof el.setSinkId === 'function');
  if (!supportsSetSinkId.value || playbackDest) return;
  playbackDest = ctx.createMediaStreamDestination();
  el.srcObject = playbackDest.stream;
  el.play().catch(() => {});
  applySinkId(selectedSinkId.value);
}

function initPlaybackAudio() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  ensurePlaybackRouting(audioCtx);
}

function startRingback() {
  stopRingback();
  const beep = () => {
    if (!audioCtx) return;
    try { ringOsc?.stop(); } catch (_) { /* ignore */ }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 425;
    gain.gain.value = 0.07;
    osc.connect(gain);
    gain.connect(playbackOutputNode(audioCtx));
    osc.start();
    osc.stop(audioCtx.currentTime + 1);
    ringOsc = osc;
  };
  if (!audioCtx) initPlaybackAudio();
  if (!audioCtx) return;
  beep();
  ringTimer = setInterval(beep, 4000);
}

function stopRingback() {
  if (ringTimer) {
    clearInterval(ringTimer);
    ringTimer = null;
  }
  try { ringOsc?.stop(); } catch (_) { /* ignore */ }
  ringOsc = null;
}

function stopPlaybackImmediate() {
  playQueue.length = 0;
  playing = false;
  try { activePlaybackSource?.stop(); } catch (_) { /* ignore */ }
  activePlaybackSource = null;
}

function startCallTimer() {
  if (timer) return;
  timer = setInterval(() => {
    remaining.value = Math.max(0, remaining.value - 1);
  }, 1000);
}

function markLive() {
  if (state.value === 'live') return;
  stopRingback();
  state.value = 'live';
  startMicStream();
  startCallRecording();
  startCallTimer();
}

function guestPayload() {
  let id = getFromStorage('guestId', '');
  if (!id) {
    id = generateUniqueId();
    setToStorage('guestId', id);
  }
  return { guestId: id };
}

function close() {
  hangup();
  emit('close');
}

function goBookStaff() {
  hangup();
  emit('close');
  router.push({ name: 'voice-call-booking' });
}

async function loadConfig() {
  try {
    const { data } = await api.get('/ai-calls/config');
    config.value = data.data || config.value;
    saveRecordingEnabled = config.value.save_call_recording !== false;
    creditsSeconds.value = Number(data.data?.credits?.seconds_remaining || 0);
    if (!selectedPackageId.value && config.value.packages?.[0]) {
      selectedPackageId.value = config.value.packages[0].id;
    }
  } catch (error) {
    errorText.value = error.response?.data?.error || t('chat.voiceCall.startError');
  }
}

async function pay() {
  busy.value = true;
  errorText.value = '';
  try {
    const { data } = await api.post('/ai-calls/invoices', {
      package_id: selectedPackageId.value,
      ...guestPayload()
    });
    invoice.value = data.data;
    state.value = 'awaiting_payment';
  } catch (error) {
    errorText.value = error.response?.data?.error || t('chat.voiceCall.payError');
  } finally {
    busy.value = false;
  }
}

async function checkPay() {
  if (!invoice.value?.id) return;
  busy.value = true;
  try {
    const { data } = await api.post(`/ai-calls/invoices/${invoice.value.id}/check`);
    invoice.value = data.data;
    if (data.data?.status === 'paid') {
      const credits = await api.get('/ai-calls/credits');
      creditsSeconds.value = Number(credits.data?.data?.seconds_remaining || 0);
      state.value = 'ready';
    }
  } catch (error) {
    errorText.value = error.response?.data?.error || t('chat.voiceCall.payError');
  } finally {
    busy.value = false;
  }
}

async function startCall() {
  busy.value = true;
  errorText.value = '';
  try {
    const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStream = mic;
    // Важно: инициируем AudioContext сразу после клика “Start call”.
    // Это помогает обойти autoplay policy на некоторых прод-хостах.
    initPlaybackAudio();
    await refreshOutputDevices();
    const { data } = await api.post('/ai-calls/sessions', {
      package_id: selectedPackageId.value,
      invoice_id: invoice.value?.id || null,
      ...guestPayload()
    });
    const session = data.data;
    callSessionId = session.id;
    state.value = 'connecting';
    remaining.value = session.remaining_seconds || selectedMinutes.value * 60;
    startRingback();
    openSocket(session.ws_path);
  } catch (error) {
    stopRingback();
    stopMic();
    if (error.name === 'NotAllowedError') {
      errorText.value = t('chat.mediaPermissionDenied');
      return;
    }
    errorText.value = error.response?.data?.error || t('chat.voiceCall.startError');
  } finally {
    busy.value = false;
  }
}

function wsUrl(path) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}${path}`;
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

function openSocket(path) {
  let micSent = false;
  ws = new WebSocket(wsUrl(path));
  ws.onopen = () => {
    state.value = 'connecting';
  };
  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (_) { return; }
    if (msg.type === 'session' && !micSent) {
      micSent = true;
      ws.send(JSON.stringify({ type: 'mic_ready', locale: callLocaleTag() }));
      state.value = 'connecting';
      startCallTimer();
    }
    if (msg.type === 'session' && msg.state === 'live') {
      markLive();
    }
    if (msg.type === 'session' && msg.remaining_seconds != null) remaining.value = msg.remaining_seconds;
    if (msg.type === 'audio' && msg.pcm) {
      markLive();
      enqueuePlayback(msg.pcm);
    }
    if (msg.type === 'transcript') {
      transcript.value = msg.text || transcript.value;
      if (msg.text) transcriptLog.push(`Агент: ${msg.text}`);
    }
    if (msg.type === 'user_transcript' && msg.text) {
      transcriptLog.push(`Абонент: ${msg.text}`);
    }
    if (msg.type === 'ended') {
      hangup();
      state.value = msg.reason === 'timeout' ? 'time_up' : 'ended';
    }
    if (msg.type === 'error') {
      stopRingback();
      stopPlaybackImmediate();
      errorText.value = msg.message || t('chat.voiceCall.startError');
      hangup();
    }
  };
  ws.onclose = () => {
    if (state.value === 'live' || state.value === 'connecting') {
      hangup();
    } else {
      stopRingback();
      stopPlaybackImmediate();
    }
  };
}

function startMicStream() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  ensurePlaybackRouting(audioCtx);
  if (!mixDest) mixDest = audioCtx.createMediaStreamDestination();
  if (processor) return;
  micSourceNode = audioCtx.createMediaStreamSource(mediaStream);
  processor = audioCtx.createScriptProcessor(4096, 1, 1);
  processor.onaudioprocess = (e) => {
    if (!ws || ws.readyState !== 1) return;
    const input = e.inputBuffer.getChannelData(0);
    const resampled = downsample(input, audioCtx.sampleRate, 16000);
    const pcm = floatTo16BitPCM(resampled);
    const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
    ws.send(JSON.stringify({ type: 'audio', pcm: btoa(bin), playing }));
  };
  const mute = audioCtx.createGain();
  mute.gain.value = 0;
  micSourceNode.connect(processor);
  micSourceNode.connect(mixDest);
  processor.connect(mute);
  mute.connect(audioCtx.destination);
}

function pickRecorderMime() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const mime of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(mime)) return mime;
  }
  return '';
}

function startCallRecording() {
  if (!saveRecordingEnabled || !audioCtx) return;
  if (typeof MediaRecorder === 'undefined') return;
  try {
    if (!mixDest) mixDest = audioCtx.createMediaStreamDestination();
    recordedChunks.length = 0;
    const mime = pickRecorderMime();
    mediaRecorder = mime
      ? new MediaRecorder(mixDest.stream, { mimeType: mime })
      : new MediaRecorder(mixDest.stream);
    mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) recordedChunks.push(ev.data);
    };
    mediaRecorder.start(1000);
  } catch (_) {
    mediaRecorder = null;
  }
}

function stopRecorderBlob() {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      resolve(null);
      return;
    }
    const mime = mediaRecorder.mimeType || 'audio/webm';
    mediaRecorder.onstop = () => {
      const blob = recordedChunks.length
        ? new Blob(recordedChunks, { type: mime })
        : null;
      mediaRecorder = null;
      resolve(blob && blob.size > 0 ? blob : null);
    };
    try { mediaRecorder.stop(); } catch (_) { resolve(null); }
  });
}

async function uploadCallRecording(sessionId, blob) {
  if (!sessionId || !blob || !saveRecordingEnabled) return;
  const form = new FormData();
  const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
  form.append('file', blob, `voice-call-${sessionId}.${ext}`);
  form.append('transcript', transcriptLog.join('\n').slice(0, 18000));
  const guest = guestPayload();
  if (guest.guestId) form.append('guestId', guest.guestId);
  await api.post(`/ai-calls/sessions/${sessionId}/recording`, form);
}

function enqueuePlayback(b64) {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const samples = Math.floor(raw.byteLength / 2);
  const pcm = new Int16Array(raw.buffer, raw.byteOffset, samples);
  playQueue.push(pcm);
  if (!playing) playNext();
}

async function playNext() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    ensurePlaybackRouting(audioCtx);
  }
  if (audioCtx.state === 'suspended') {
    try { await audioCtx.resume(); } catch (_) { /* ignore */ }
  }
  if (!mixDest) mixDest = audioCtx.createMediaStreamDestination();
  const chunk = playQueue.shift();
  if (!chunk) {
    playing = false;
    activePlaybackSource = null;
    return;
  }
  playing = true;
  const buffer = audioCtx.createBuffer(1, chunk.length, 24000);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < chunk.length; i += 1) data[i] = chunk[i] / 0x8000;
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(playbackOutputNode(audioCtx));
  src.connect(mixDest);
  activePlaybackSource = src;
  src.onended = () => {
    activePlaybackSource = null;
    playNext();
  };
  src.start();
}

function stopMic() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  try { processor?.disconnect(); } catch (_) { /* ignore */ }
  processor = null;
  try { micSourceNode?.disconnect(); } catch (_) { /* ignore */ }
  micSourceNode = null;
  try { mediaStream?.getTracks().forEach((tr) => tr.stop()); } catch (_) { /* ignore */ }
  mediaStream = null;
  playbackDest = null;
  mixDest = null;
  if (audioCtx) {
    const ctx = audioCtx;
    audioCtx = null;
    ctx.close().catch(() => {});
  }
  const el = playbackEl.value;
  if (el) el.srcObject = null;
}

function cycleSpeaker() {
  if (!supportsSetSinkId.value) return;
  if (!outputDevices.value.length) return;

  const options = [{ deviceId: '' }].concat(outputDevices.value.map((d) => ({ deviceId: d.deviceId })));
  const curIdx = Math.max(0, options.findIndex((o) => o.deviceId === selectedSinkId.value));
  const next = options[(curIdx + 1) % options.length];
  applySinkId(next.deviceId);
}

async function hangup() {
  if (hangupInFlight) return hangupInFlight;
  hangupInFlight = (async () => {
    stopRingback();
    stopPlaybackImmediate();
    if (state.value === 'live' || state.value === 'connecting') state.value = 'ended';
    const id = callSessionId;
    const blob = await stopRecorderBlob();
    stopMic();
    callSessionId = null;
    if (id && blob) {
      try {
        await uploadCallRecording(id, blob);
      } catch (error) {
        console.warn('[voiceCall] recording upload:', error.response?.data?.error || error.message);
      }
    }
    try { ws?.send(JSON.stringify({ type: 'hangup' })); } catch (_) { /* ignore */ }
    try { ws?.close(); } catch (_) { /* ignore */ }
    ws = null;
    if (id) {
      api.post(`/ai-calls/sessions/${id}/hangup`, { reason: 'user', ...guestPayload() }).catch(() => {});
    }
    transcriptLog = [];
    recordedChunks.length = 0;
  })();
  try {
    await hangupInFlight;
  } finally {
    hangupInFlight = null;
  }
}

onMounted(async () => {
  await loadConfig();
});

onUnmounted(() => {
  hangup();
});
</script>

<style scoped>
.voice-call-modal {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
}
.voice-call-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
}
.voice-call-modal__card {
  position: relative;
  width: min(560px, calc(100vw - 24px));
  max-height: calc(100vh - 32px);
  overflow: auto;
  background: var(--color-white);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
}
.voice-call-modal__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}
.voice-call-modal__close {
  border: 0;
  background: transparent;
  font-size: 1.4rem;
  cursor: pointer;
}
.voice-call-modal__packages {
  display: grid;
  gap: var(--spacing-sm);
  margin: var(--spacing-md) 0;
}
.pkg {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
  background: var(--color-white);
}
.voice-call-modal__speaker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin: var(--spacing-sm) 0;
}

.voice-call-modal__speaker-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-white);
  cursor: pointer;
}

.voice-call-modal__speaker-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.voice-call-modal__icon {
  width: 22px;
  height: 22px;
  fill: currentColor;
}

.voice-call-modal__hangup {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.voice-call-modal__hangup-text {
  font-weight: 600;
}
.voice-call-modal__speaker-label {
  font-size: 0.9rem;
  color: var(--color-text);
}
.voice-call-modal__speaker-select {
  width: 100%;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-white);
}
.voice-call-modal__hint {
  font-size: 0.85rem;
  color: var(--color-text-muted, var(--color-text));
  margin: var(--spacing-sm) 0;
}
.voice-call-modal__playback {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
.voice-call-modal__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}
.voice-call-modal__note,
.pay-box,
.transcript {
  color: var(--color-text);
}
.voice-call-modal__error {
  color: var(--color-danger);
}
.timer {
  font-size: 1.4rem;
  font-weight: 600;
}
.connecting-note {
  font-weight: 600;
}
code {
  display: block;
  margin: var(--spacing-sm) 0;
  word-break: break-all;
}
</style>
