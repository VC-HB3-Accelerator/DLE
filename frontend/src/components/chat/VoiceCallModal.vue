<template>
  <Teleport to="body">
    <div class="voice-call-modal" role="dialog" aria-modal="true">
      <div class="voice-call-modal__card">
        <header class="voice-call-modal__head">
          <h3>{{ $t('chat.voiceCall.title') }}</h3>
          <button type="button" class="voice-call-modal__close" :aria-label="$t('common.close')" @click="close">
            <svg viewBox="0 0 24 24" class="voice-call-modal__close-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

      <div v-if="!config.enabled" class="voice-call-modal__stage voice-call-modal__stage--solo">
        <p class="voice-call-modal__status">{{ $t('chat.voiceCall.disabled') }}</p>
      </div>
      <div v-else-if="!config.call_ready" class="voice-call-modal__stage voice-call-modal__stage--solo">
        <p class="voice-call-modal__status">{{ $t('chat.voiceCall.noModel') }}</p>
        <button type="button" class="voice-call-modal__text-link" @click="goBookStaff">
          {{ $t('chat.voiceCall.toHuman') }}
        </button>
      </div>
      <template v-else>
        <section class="voice-call-modal__body">
          <div class="voice-call-modal__stage">
            <p class="voice-call-modal__status">{{ statusLabel }}</p>
            <p v-if="state === 'live' || state === 'connecting'" class="voice-call-modal__timer">
              {{ formatTime(remaining) }}
            </p>

            <!-- Idle: кнопка звонка на месте аватара -->
            <div v-if="!inCall" class="voice-call-modal__controls voice-call-modal__controls--idle">
              <button
                v-if="needsPay"
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
                type="button"
                class="voice-call-modal__fab voice-call-modal__fab--start"
                :disabled="busy || (needsPay && invoice?.status !== 'paid' && creditsSeconds < selectedMinutes * 60)"
                :aria-label="$t('chat.voiceCall.start')"
                :title="$t('chat.voiceCall.start')"
                @click="startCall"
              >
                <svg viewBox="0 0 24 24" class="voice-call-modal__fab-icon" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.5-1.1a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" />
                </svg>
              </button>
              <span class="voice-call-modal__fab-caption">{{ $t('chat.voiceCall.start') }}</span>
            </div>

            <p v-if="!showTariffs && !inCall" class="voice-call-modal__hint-line">
              {{ $t('chat.voiceCall.freeMode') }}
            </p>
            <button
              v-if="!inCall"
              type="button"
              class="voice-call-modal__text-link"
              @click="goBookStaff"
            >
              {{ $t('chat.voiceCall.toHuman') }}
            </button>
          </div>

          <div v-if="showTariffs && !inCall" class="voice-call-modal__packages">
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

          <p v-if="errorText" class="voice-call-modal__error">{{ errorText }}</p>
          <p v-if="transcript && inCall" class="transcript">{{ transcript }}</p>

          <!-- Connecting / live: mute · speaker · hangup -->
          <div v-if="inCall" class="voice-call-modal__controls voice-call-modal__controls--live">
            <div class="voice-call-modal__round-group">
              <button
                type="button"
                class="voice-call-modal__round"
                :class="{ 'is-active': micMuted }"
                :aria-pressed="micMuted"
                :aria-label="micMuted ? $t('chat.voiceCall.unmute') : $t('chat.voiceCall.mute')"
                :title="micMuted ? $t('chat.voiceCall.unmute') : $t('chat.voiceCall.mute')"
                @click="toggleMute"
              >
                <span class="voice-call-modal__round-face">
                  <svg v-if="!micMuted" viewBox="0 0 24 24" class="voice-call-modal__fab-icon" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                    <path d="M19 11a7 7 0 0 1-14 0" />
                    <path d="M12 18v4" />
                    <path d="M8 22h8" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" class="voice-call-modal__fab-icon" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M2 2l20 20" />
                    <path d="M9 9v2a3 3 0 0 0 5.1 2.1" />
                    <path d="M15 9.3V5a3 3 0 0 0-5.7-1.3" />
                    <path d="M19 11a7 7 0 0 1-1.4 4.3M5 11a7 7 0 0 0 11.2 5.5" />
                    <path d="M12 18v4" />
                    <path d="M8 22h8" />
                  </svg>
                </span>
                <span class="voice-call-modal__round-label">
                  {{ micMuted ? $t('chat.voiceCall.unmute') : $t('chat.voiceCall.mute') }}
                </span>
              </button>

              <button
                type="button"
                class="voice-call-modal__round"
                :class="{ 'is-active': speakerOn, 'is-disabled': !canControlSpeaker }"
                :disabled="!canControlSpeaker"
                :aria-pressed="speakerOn"
                :aria-label="speakerAria"
                :title="speakerTitle"
                @click="toggleSpeaker"
              >
                <span class="voice-call-modal__round-face">
                  <svg viewBox="0 0 24 24" class="voice-call-modal__fab-icon" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M11 5 6 9H3v6h3l5 4V5z" />
                    <path v-if="speakerOn" d="M15.5 8.5a5 5 0 0 1 0 7" />
                    <path v-if="speakerOn" d="M18.5 5.5a9 9 0 0 1 0 13" />
                    <path v-if="!speakerOn" d="M15 9.5 19.5 14.5" />
                    <path v-if="!speakerOn" d="M19.5 9.5 15 14.5" />
                  </svg>
                </span>
                <span class="voice-call-modal__round-label">{{ $t('chat.voiceCall.speaker') }}</span>
              </button>

              <button
                type="button"
                class="voice-call-modal__round voice-call-modal__round--hangup"
                :aria-label="$t('chat.voiceCall.hangup')"
                :title="$t('chat.voiceCall.hangup')"
                @click="hangup"
              >
                <span class="voice-call-modal__round-face">
                  <svg viewBox="0 0 24 24" class="voice-call-modal__fab-icon voice-call-modal__fab-icon--hangup" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.5-1.1a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" />
                  </svg>
                </span>
                <span class="voice-call-modal__round-label">{{ $t('chat.voiceCall.hangup') }}</span>
              </button>
            </div>
            <p v-if="!canControlSpeaker" class="voice-call-modal__hint">
              {{ supportsSetSinkId ? $t('chat.voiceCall.speakerNeedPermission') : $t('chat.voiceCall.speakerNotSupported') }}
            </p>
          </div>
        </section>
      </template>
    </div>
    <audio ref="playbackEl" class="voice-call-modal__playback" aria-hidden="true" />
    </div>
  </Teleport>
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
const speakerOn = ref(String(getFromStorage('voiceCallSpeakerOn', 'false')) === 'true');
const micMuted = ref(false);

let ws = null;
let timer = null;
let audioCtx = null;
let playbackDest = null;
let playbackGain = null;
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
const inCall = computed(() => state.value === 'live' || state.value === 'connecting');
const canControlSpeaker = computed(() => supportsSetSinkId.value && outputDevices.value.length > 0);

const statusLabel = computed(() => {
  if (state.value === 'connecting') return t('chat.voiceCall.connecting');
  if (state.value === 'live') return t('chat.voiceCall.inCall');
  if (state.value === 'time_up') return t('chat.voiceCall.timeUp');
  if (state.value === 'ended') return t('chat.voiceCall.ended');
  if (state.value === 'awaiting_payment') return t('chat.voiceCall.pay');
  return t('chat.voiceCall.agentName');
});

const speakerTitle = computed(() => {
  if (!supportsSetSinkId.value) return t('chat.voiceCall.speakerNotSupported');
  if (!outputDevices.value.length) return t('chat.voiceCall.speakerNeedPermission');
  if (speakerOn.value) {
    const cur = outputDevices.value.find((d) => d.deviceId === selectedSinkId.value);
    return cur?.label || t('chat.voiceCall.speakerOn');
  }
  return t('chat.voiceCall.speakerOff');
});

const speakerAria = computed(() => (
  speakerOn.value ? t('chat.voiceCall.speakerOn') : t('chat.voiceCall.speakerOff')
));

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

function detectSetSinkSupport() {
  const proto = typeof HTMLMediaElement !== 'undefined' ? HTMLMediaElement.prototype : null;
  supportsSetSinkId.value = Boolean(proto && typeof proto.setSinkId === 'function');
}

function playbackOutputNode() {
  if (playbackGain) return playbackGain;
  if (supportsSetSinkId.value && playbackDest) return playbackDest;
  return audioCtx?.destination || null;
}

function syncPlaybackGain() {
  if (!playbackGain) return;
  playbackGain.gain.value = speakerOn.value ? 1.35 : 1;
}

function pickSpeakerDeviceId() {
  const list = outputDevices.value;
  if (!list.length) return '';
  const scored = list.find((d) => /speaker|динамик|lautsprecher|haut-parleur/i.test(d.label || ''));
  if (scored) return scored.deviceId;
  return list[0].deviceId;
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

async function applySpeakerRouting() {
  syncPlaybackGain();
  if (!supportsSetSinkId.value) return;
  if (speakerOn.value) {
    await applySinkId(pickSpeakerDeviceId() || selectedSinkId.value || '');
  } else {
    await applySinkId('');
  }
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
  detectSetSinkSupport();
  if (!playbackGain) {
    playbackGain = ctx.createGain();
    syncPlaybackGain();
  }
  if (supportsSetSinkId.value) {
    if (!playbackDest) {
      playbackDest = ctx.createMediaStreamDestination();
      el.srcObject = playbackDest.stream;
      el.play().catch(() => {});
    }
    try { playbackGain.disconnect(); } catch (_) { /* ignore */ }
    playbackGain.connect(playbackDest);
    applySpeakerRouting();
  } else {
    try { playbackGain.disconnect(); } catch (_) { /* ignore */ }
    playbackGain.connect(ctx.destination);
  }
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
    const out = playbackOutputNode();
    if (out) gain.connect(out);
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

function applyMicMuteState() {
  mediaStream?.getAudioTracks().forEach((track) => {
    track.enabled = !micMuted.value;
  });
}

function toggleMute() {
  micMuted.value = !micMuted.value;
  applyMicMuteState();
}

async function toggleSpeaker() {
  if (!canControlSpeaker.value) return;
  speakerOn.value = !speakerOn.value;
  setToStorage('voiceCallSpeakerOn', String(speakerOn.value));
  await applySpeakerRouting();
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
  micMuted.value = false;
  try {
    const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStream = mic;
    // Важно: инициируем AudioContext сразу после клика “Start call”.
    // Это помогает обойти autoplay policy на некоторых прод-хостах.
    initPlaybackAudio();
    await refreshOutputDevices();
    await applySpeakerRouting();
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
  applyMicMuteState();
  processor = audioCtx.createScriptProcessor(4096, 1, 1);
  processor.onaudioprocess = (e) => {
    if (!ws || ws.readyState !== 1) return;
    const input = e.inputBuffer.getChannelData(0);
    const resampled = downsample(input, audioCtx.sampleRate, 16000);
    const pcm = micMuted.value
      ? new Int16Array(resampled.length)
      : floatTo16BitPCM(resampled);
    const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
    ws.send(JSON.stringify({ type: 'audio', pcm: btoa(bin), playing }));
  };
  const keepAlive = audioCtx.createGain();
  keepAlive.gain.value = 0;
  micSourceNode.connect(processor);
  micSourceNode.connect(mixDest);
  processor.connect(keepAlive);
  keepAlive.connect(audioCtx.destination);
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
  const out = playbackOutputNode();
  if (out) src.connect(out);
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
  try { playbackGain?.disconnect(); } catch (_) { /* ignore */ }
  playbackGain = null;
  playbackDest = null;
  mixDest = null;
  if (audioCtx) {
    const ctx = audioCtx;
    audioCtx = null;
    ctx.close().catch(() => {});
  }
  const el = playbackEl.value;
  if (el) el.srcObject = null;
  micMuted.value = false;
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
  detectSetSinkSupport();
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
  z-index: 1200;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  background: var(--color-white);
}

.voice-call-modal__card {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100dvh;
  max-height: 100dvh;
  overflow: auto;
  display: flex;
  flex-direction: column;
  background: var(--color-white);
  border-radius: 0;
  padding:
    max(12px, env(safe-area-inset-top))
    max(16px, env(safe-area-inset-right))
    max(16px, env(safe-area-inset-bottom))
    max(16px, env(safe-area-inset-left));
  box-shadow: none;
}

.voice-call-modal__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 0 0 auto;
  margin-bottom: var(--spacing-sm);
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--color-white);
  padding-bottom: var(--spacing-xs);
}

.voice-call-modal__head h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text, var(--color-dark));
}

.voice-call-modal__close {
  border: 1px solid var(--color-border);
  background: var(--color-white);
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
  color: var(--color-text, var(--color-dark));
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.voice-call-modal__close:hover {
  background: var(--color-light, #f5f5f5);
}

.voice-call-modal__close-icon {
  width: 18px;
  height: 18px;
}

.voice-call-modal__body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: var(--spacing-md);
}

.voice-call-modal__stage {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--spacing-sm);
  gap: var(--spacing-xs);
}

.voice-call-modal__stage--solo {
  flex: 1 1 auto;
  justify-content: center;
}

.voice-call-modal__status {
  margin: 0;
  font-weight: 600;
  font-size: 1.15rem;
  color: var(--color-text);
}

.voice-call-modal__timer {
  margin: 0;
  font-variant-numeric: tabular-nums;
  font-size: clamp(1.8rem, 5vw, 2.4rem);
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--color-text);
}

.voice-call-modal__hint-line {
  margin: var(--spacing-sm) 0 0;
  font-size: 0.95rem;
  color: var(--color-text-light, #667);
  max-width: 32ch;
}

.voice-call-modal__packages {
  display: grid;
  gap: var(--spacing-sm);
  margin: 0 auto;
  width: min(420px, 100%);
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

.voice-call-modal__controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  margin-top: 0;
  padding: var(--spacing-sm) 0 0;
  flex: 0 0 auto;
}

.voice-call-modal__controls--idle {
  padding: var(--spacing-md) 0 0;
}

.voice-call-modal__fab {
  width: 96px;
  height: 96px;
  border: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: #fff;
  transition: transform 0.15s ease, filter 0.15s ease, opacity 0.15s ease;
}

.voice-call-modal__fab:hover:not(:disabled) {
  transform: scale(1.04);
  filter: brightness(1.05);
}

.voice-call-modal__fab:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.voice-call-modal__fab--start {
  background: #1f9d55;
  box-shadow: 0 12px 28px color-mix(in srgb, #1f9d55 32%, transparent);
}

.voice-call-modal__fab-icon {
  width: 36px;
  height: 36px;
  fill: none;
  stroke: currentColor;
}

.voice-call-modal__fab-icon--hangup {
  transform: rotate(135deg);
}

.voice-call-modal__fab-caption {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
}

.voice-call-modal__round-group {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: clamp(20px, 6vw, 40px);
  width: 100%;
  max-width: 420px;
  padding: var(--spacing-sm) 0;
}

.voice-call-modal__round {
  appearance: none;
  border: 0;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 84px;
  cursor: pointer;
  color: var(--color-text);
  padding: 0;
}

.voice-call-modal__round-face {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--color-border) 40%, white);
  box-shadow: inset 0 0 0 1px var(--color-border);
  color: inherit;
  transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.voice-call-modal__round:hover:not(:disabled) .voice-call-modal__round-face {
  transform: scale(1.04);
}

.voice-call-modal__round .voice-call-modal__fab-icon {
  width: 26px;
  height: 26px;
}

.voice-call-modal__round.is-active .voice-call-modal__round-face {
  background: color-mix(in srgb, var(--theme-primary, #2f6b4f) 16%, white);
  box-shadow: inset 0 0 0 2px var(--theme-primary, #2f6b4f);
}

.voice-call-modal__round.is-active {
  color: var(--theme-primary, #2f6b4f);
}

.voice-call-modal__round.is-disabled,
.voice-call-modal__round:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.voice-call-modal__round--hangup .voice-call-modal__round-face {
  background: var(--color-danger);
  box-shadow: none;
  color: #fff;
}

.voice-call-modal__round--hangup:hover .voice-call-modal__round-face {
  background: var(--color-danger-hover);
}

.voice-call-modal__round-label {
  font-size: 0.78rem;
  line-height: 1.2;
  text-align: center;
  color: var(--color-text-light, #667);
  max-width: 10ch;
}

.voice-call-modal__round--hangup .voice-call-modal__round-label {
  color: var(--color-danger);
  font-weight: 600;
}

.voice-call-modal__text-link {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--theme-primary, #2f6b4f);
  font-size: 0.95rem;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  margin: 2px auto 0;
  padding: var(--spacing-xs);
  display: block;
  text-align: center;
  flex: 0 0 auto;
}

.voice-call-modal__text-link:hover {
  filter: brightness(0.92);
}

.voice-call-modal__hint {
  font-size: 0.8rem;
  color: var(--color-text-muted, var(--color-text-light, #667));
  margin: 0;
  text-align: center;
  max-width: 34ch;
}

.voice-call-modal__playback {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.voice-call-modal__note,
.pay-box,
.transcript {
  color: var(--color-text);
}

.transcript {
  font-size: 0.9rem;
  max-height: 4.5em;
  overflow: auto;
  text-align: center;
  opacity: 0.9;
  width: min(520px, 100%);
  margin: 0 auto;
}

.voice-call-modal__error {
  color: var(--color-danger);
  text-align: center;
  margin: 0 auto;
  max-width: 40ch;
}

.pay-box {
  font-size: 0.9rem;
  width: min(420px, 100%);
  margin: 0 auto;
}

code {
  display: block;
  margin: var(--spacing-sm) 0;
  word-break: break-all;
}
</style>
