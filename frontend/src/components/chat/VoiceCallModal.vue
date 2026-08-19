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
            v-if="(state === 'connecting' || state === 'live') && outputDevices.length"
            class="voice-call-modal__speaker"
          >
            <label class="voice-call-modal__speaker-label" for="voice-call-speaker">{{ $t('chat.voiceCall.speaker') }}</label>
            <select
              id="voice-call-speaker"
              v-model="selectedSinkId"
              class="voice-call-modal__speaker-select"
              @change="applySinkId(selectedSinkId)"
            >
              <option value="">{{ $t('chat.voiceCall.speakerDefault') }}</option>
              <option v-for="dev in outputDevices" :key="dev.deviceId" :value="dev.deviceId">
                {{ dev.label || dev.deviceId }}
              </option>
            </select>
          </div>
          <p
            v-else-if="(state === 'connecting' || state === 'live') && !supportsSetSinkId"
            class="voice-call-modal__hint"
          >
            {{ $t('chat.voiceCall.speakerNotSupported') }}
          </p>

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
              class="btn btn-danger"
              @click="hangup"
            >{{ $t('chat.voiceCall.hangup') }}</button>
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
let ringCtx = null;
let ringTimer = null;
let ringOsc = null;
const playQueue = [];
let playing = false;
let activePlaybackSource = null;

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

function startRingback() {
  stopRingback();
  try {
    ringCtx = new AudioContext();
    if (ringCtx.state === 'suspended') ringCtx.resume().catch(() => {});
    ensurePlaybackRouting(ringCtx);
  } catch (_) {
    return;
  }
  const beep = () => {
    if (!ringCtx) return;
    try { ringOsc?.stop(); } catch (_) { /* ignore */ }
    const osc = ringCtx.createOscillator();
    const gain = ringCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 425;
    gain.gain.value = 0.07;
    osc.connect(gain);
    gain.connect(playbackOutputNode(ringCtx));
    osc.start();
    osc.stop(ringCtx.currentTime + 1);
    ringOsc = osc;
  };
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
  if (ringCtx) {
    const ctx = ringCtx;
    ringCtx = null;
    ctx.close().catch(() => {});
  }
}

function stopPlaybackImmediate() {
  playQueue.length = 0;
  playing = false;
  try { activePlaybackSource?.stop(); } catch (_) { /* ignore */ }
  activePlaybackSource = null;
  if (audioCtx && audioCtx.state === 'running') {
    audioCtx.suspend().catch(() => {});
  }
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
    if (msg.type === 'transcript') transcript.value = msg.text || transcript.value;
    if (msg.type === 'ended') {
      stopRingback();
      stopPlaybackImmediate();
      state.value = msg.reason === 'timeout' ? 'time_up' : 'ended';
      stopMic();
    }
    if (msg.type === 'error') {
      stopRingback();
      stopPlaybackImmediate();
      errorText.value = msg.message || t('chat.voiceCall.startError');
    }
  };
  ws.onclose = () => {
    stopRingback();
    stopPlaybackImmediate();
    if (state.value === 'live' || state.value === 'connecting') state.value = 'ended';
    stopMic();
  };
}

function startMicStream() {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  ensurePlaybackRouting(audioCtx);
  const source = audioCtx.createMediaStreamSource(mediaStream);
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
  source.connect(processor);
  processor.connect(mute);
  mute.connect(audioCtx.destination);
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
  try { mediaStream?.getTracks().forEach((tr) => tr.stop()); } catch (_) { /* ignore */ }
  mediaStream = null;
  playbackDest = null;
  if (audioCtx) {
    const ctx = audioCtx;
    audioCtx = null;
    ctx.close().catch(() => {});
  }
  const el = playbackEl.value;
  if (el) el.srcObject = null;
}

function hangup() {
  stopRingback();
  stopPlaybackImmediate();
  if (state.value === 'live' || state.value === 'connecting') state.value = 'ended';
  try { ws?.send(JSON.stringify({ type: 'hangup' })); } catch (_) { /* ignore */ }
  try { ws?.close(); } catch (_) { /* ignore */ }
  ws = null;
  stopMic();
  const id = callSessionId;
  callSessionId = null;
  if (id) {
    api.post(`/ai-calls/sessions/${id}/hangup`, { reason: 'user', ...guestPayload() }).catch(() => {});
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
