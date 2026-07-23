<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="conference-live" v-loading="loading">
    <el-alert
      :type="realtimeStatus === 'connected' ? 'success' : 'info'"
      :closable="false"
      show-icon
      class="live-alert"
    >
      <template #title>
        {{ t('contacts.conference.live.roomTitle') }}
      </template>
      <p>{{ realtimeHint }}</p>
    </el-alert>

    <div v-if="session" class="live-meta">
      <h2>{{ session.title || t('contacts.conference.live.untitled') }}</h2>
      <p>
        <el-tag type="success">{{ t(`contacts.conference.status.${session.status}`) }}</el-tag>
        <span class="live-id">#{{ session.id }}</span>
        <span class="live-langs">{{ session.guest_language }} / {{ session.host_language }}</span>
      </p>
    </div>

    <div class="live-grid">
      <section ref="videoPanelRef" class="live-panel video-panel" :class="{ 'is-fullscreen': videoFullscreen }">
        <div class="video-panel-head">
          <h3>{{ t('contacts.conference.live.videoTitle') }}</h3>
          <div class="video-panel-head-actions">
            <el-button
              v-if="videoFullscreen && isEditor"
              size="small"
              type="danger"
              plain
              :loading="ending"
              @click="endConference"
            >
              {{ t('contacts.conference.live.end') }}
            </el-button>
            <el-button
              v-if="videoFullscreen"
              size="small"
              @click="leaveRoom"
            >
              {{ t('contacts.conference.live.leave') }}
            </el-button>
            <el-button size="small" @click="toggleVideoFullscreen">
              {{ videoFullscreen
                ? t('contacts.conference.live.videoFullscreenExit')
                : t('contacts.conference.live.videoFullscreen') }}
            </el-button>
          </div>
        </div>
        <div class="video-stage video-stage-split">
          <div class="video-tile">
            <div class="video-tile-label">{{ t('contacts.conference.live.videoYou') }}</div>
            <!--
              Mount без Vue-детей: LiveKit attach/clearContainer ломает vnode
              (emitsOptions on null) если плейсхолдер внутри того же ref.
            -->
            <div class="video-mount-wrap">
              <div ref="localVideoMount" class="video-mount"></div>
              <div v-if="!cameraOn && !screenOn" class="video-placeholder small">
                {{ t('contacts.conference.live.videoStubLocal') }}
              </div>
            </div>
          </div>
          <div class="video-tile">
            <div class="video-tile-label">{{ t('contacts.conference.live.videoPeer') }}</div>
            <div class="video-mount-wrap">
              <div ref="remoteVideoMount" class="video-mount"></div>
              <div v-if="livekitStatus !== 'connected'" class="video-placeholder small">
                {{ livekitHint }}
              </div>
              <div
                v-else-if="!hasRemoteVideo"
                class="video-placeholder small"
              >
                {{ t('contacts.conference.live.videoWaitingPeer') }}
              </div>
            </div>
          </div>
        </div>
        <div class="video-actions">
          <el-button
            size="small"
            :loading="livekitConnecting"
            :type="livekitStatus === 'connected' ? 'success' : 'primary'"
            @click="onConnectRoomClick"
          >
            {{ livekitStatus === 'connected'
              ? t('contacts.conference.live.videoRoomOn')
              : t('contacts.conference.live.videoRoomConnect') }}
          </el-button>
          <el-button
            size="small"
            :loading="mediaBusy"
            :disabled="livekitConnecting"
            :type="micOn ? 'primary' : 'default'"
            @click="toggleMic"
          >
            {{ micOn
              ? t('contacts.conference.live.videoMicOff')
              : t('contacts.conference.live.videoMicOn') }}
          </el-button>
          <el-button
            size="small"
            :loading="mediaBusy"
            :disabled="livekitConnecting"
            :type="cameraOn ? 'primary' : 'default'"
            @click="toggleCamera"
          >
            {{ cameraOn
              ? t('contacts.conference.live.videoCameraOff')
              : t('contacts.conference.live.videoCameraOn') }}
          </el-button>
          <el-button
            v-if="isEditor"
            size="small"
            :loading="mediaBusy"
            :disabled="livekitConnecting"
            :type="screenOn ? 'primary' : 'default'"
            @click="toggleScreen"
          >
            {{ screenOn
              ? t('contacts.conference.live.videoScreenOff')
              : t('contacts.conference.live.videoScreenOn') }}
          </el-button>
          <el-button size="small" @click="toggleVideoFullscreen">
            {{ videoFullscreen
              ? t('contacts.conference.live.videoFullscreenExit')
              : t('contacts.conference.live.videoFullscreen') }}
          </el-button>
        </div>
        <p v-if="livekitStatus !== 'connected'" class="video-hint">
          {{ t('contacts.conference.live.videoJoinHint') }}
        </p>
        <p v-else-if="!cameraOn && !screenOn" class="video-hint">
          {{ t('contacts.conference.live.videoEnableHint') }}
        </p>
        <p class="video-note">{{ t('contacts.conference.live.videoLivekitNote') }}</p>
      </section>

      <section class="live-panel chat-panel">
        <h3>{{ t('contacts.conference.live.chatTitle') }}</h3>
        <div class="chat-log">
          <el-empty
            v-if="!visibleChatItems.length"
            :description="t('contacts.conference.live.chatEmpty')"
          />
          <div
            v-for="item in visibleChatItems"
            :key="item.id || item._key"
            class="chat-line"
          >
            <span class="chat-role">{{ roleLabel(item.role) }}</span>
            <div class="chat-texts">
              <span>{{ displayChatText(item) }}</span>
              <span v-if="chatOriginal(item)" class="chat-original">{{ chatOriginal(item) }}</span>
            </div>
          </div>
        </div>
        <div class="chat-compose">
          <el-input
            v-model="chatDraft"
            :placeholder="t('contacts.conference.live.chatPlaceholder')"
            @keyup.enter="sendChat"
          />
          <el-button type="primary" :disabled="!chatDraft.trim()" @click="sendChat">
            {{ t('common.send') }}
          </el-button>
        </div>
      </section>

      <section class="live-panel transcript-panel">
        <h3>{{ t('contacts.conference.live.transcriptTitle') }}</h3>
        <div class="transcript-log">
          <el-empty
            v-if="!voiceTranscriptItems.length"
            :description="t('contacts.conference.live.transcriptEmpty')"
          />
          <div
            v-for="item in voiceTranscriptItems"
            :key="`v-${item.id || item._key}`"
            class="transcript-line"
          >
            <el-tag size="small">{{ roleLabel(item.role) }}</el-tag>
            <span>{{ item.text }}</span>
          </div>
        </div>
      </section>

      <section v-if="isEditor" class="live-panel coach-panel">
        <h3>{{ t('contacts.conference.live.coachTitle') }}</h3>
        <p class="coach-hint">{{ t('contacts.conference.live.coachHint') }}</p>
        <el-input
          v-model="coachDraft"
          type="textarea"
          :rows="3"
          :placeholder="t('contacts.conference.live.coachPlaceholder')"
        />
        <div class="coach-actions">
          <el-button
            type="primary"
            :loading="coachSaving"
            :disabled="!coachDraft.trim()"
            @click="sendCoach"
          >
            {{ t('contacts.conference.live.coachSend') }}
          </el-button>
          <el-button
            :type="pttListening ? 'danger' : 'default'"
            @mousedown.prevent="startPtt"
            @mouseup.prevent="stopPtt"
            @mouseleave="stopPtt"
            @touchstart.prevent="startPtt"
            @touchend.prevent="stopPtt"
          >
            {{ pttListening
              ? t('contacts.conference.live.pttHold')
              : t('contacts.conference.live.ptt') }}
          </el-button>
        </div>
        <ul v-if="coachRules.length" class="coach-list">
          <li v-for="rule in coachRules" :key="rule.id">{{ rule.body }}</li>
        </ul>
      </section>
    </div>

    <div class="live-actions">
      <el-button
        v-if="isEditor"
        type="primary"
        :loading="agentStarting"
        @click="startAgent"
      >
        {{ t('contacts.conference.live.startAgent') }}
      </el-button>
      <el-button
        v-if="isEditor"
        :type="agentMuted ? 'success' : 'warning'"
        :disabled="!agentRunning"
        :loading="muteSaving"
        @click="toggleMute"
      >
        {{ agentMuted
          ? t('contacts.conference.live.unmuteAgent')
          : t('contacts.conference.live.muteAgent') }}
      </el-button>
      <el-button v-if="isEditor" @click="goAgent">
        {{ t('contacts.conference.nav.agent') }}
      </el-button>
      <el-button
        v-if="isEditor"
        type="danger"
        plain
        :loading="ending"
        @click="endConference"
      >
        {{ t('contacts.conference.live.end') }}
      </el-button>
      <el-button type="danger" plain @click="leaveRoom">
        {{ t('contacts.conference.live.leave') }}
      </el-button>
      <el-button @click="leaveRoom">{{ t('contacts.conference.live.back') }}</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import conferenceService from '@/services/conferenceService';
import { usePermissions } from '@/composables/usePermissions';
import { useAuthContext } from '@/composables/useAuth';
import { createConferenceRealtimeController } from '@/composables/useConferenceRealtime';
import { createConferenceLivekitController } from '@/composables/useConferenceLivekit';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { isEditor } = usePermissions();
const { userId } = useAuthContext();

const loading = ref(false);
const session = ref(null);
const chatDraft = ref('');
const coachDraft = ref('');
const transcriptItems = ref([]);
const coachRules = ref([]);
const agentRunning = ref(false);
const agentMuted = ref(false);
const agentStarting = ref(false);
const muteSaving = ref(false);
const coachSaving = ref(false);
const ending = ref(false);
const realtimeStatus = ref('disconnected');
const hostId = ref(null);
const pttListening = ref(false);
const localVideoMount = ref(null);
const remoteVideoMount = ref(null);
const videoPanelRef = ref(null);
const videoFullscreen = ref(false);
const cameraOn = ref(false);
const micOn = ref(false);
const screenOn = ref(false);
const livekitStatus = ref('disconnected');
const livekitConnecting = ref(false);
const mediaBusy = ref(false);
const hasRemoteVideo = ref(false);

let realtime = null;
let livekit = null;
let pollTimer = null;
let recognition = null;
let liveViewActive = false;

const livekitHint = computed(() => {
  if (livekitStatus.value === 'connecting') return t('contacts.conference.live.videoConnecting');
  if (livekitStatus.value === 'connected') return t('contacts.conference.live.videoWaitingPeer');
  return t('contacts.conference.live.videoStub');
});

const sessionId = computed(() => route.params.sessionId);
const isParticipantRoute = computed(() => route.name === 'conference-participant-live');

/** id сессии: сначала из загруженных данных, иначе из URL */
function resolveConferenceId() {
  const fromSession = Number(session.value?.id);
  if (Number.isInteger(fromSession) && fromSession > 0) return fromSession;
  const fromRoute = Number(sessionId.value);
  if (Number.isInteger(fromRoute) && fromRoute > 0) return fromRoute;
  return null;
}

/** Primary participant = владелец Realtime по ТЗ (contact_user_id). */
const isRealtimePrimary = computed(() => {
  const contactId = session.value?.contact_user_id;
  const uid = userId.value;
  if (contactId == null || uid == null) return false;
  return Number(contactId) === Number(uid);
});

/**
 * Solo-тест в одном браузере: host с ?solo=1 может сам держать Realtime.
 * В обычном 2-browser режиме host только шлёт команды primary.
 */
const isSoloHostRealtime = computed(
  () =>
    Boolean(isEditor.value)
    && !isParticipantRoute.value
    && String(route.query.solo || '') === '1'
);

const isRealtimeOwner = computed(() => isRealtimePrimary.value || isSoloHostRealtime.value);

/** Чат: все роли кроме coach (клиент coach не видит) */
const visibleChatItems = computed(() =>
  (transcriptItems.value || []).filter((i) => i.role !== 'host_coach')
);

/** Голосовой транскрипт: agent + participant (mic) */
const voiceTranscriptItems = computed(() =>
  (transcriptItems.value || []).filter((i) => i.role === 'agent' || i.role === 'participant')
);

const realtimeHint = computed(() => {
  if (realtimeStatus.value === 'connected') {
    return t('contacts.conference.live.realtimeConnected');
  }
  if (realtimeStatus.value === 'connecting') {
    return t('contacts.conference.live.realtimeConnecting');
  }
  if (isSoloHostRealtime.value) {
    return t('contacts.conference.live.soloHint');
  }
  if (!isRealtimeOwner.value && isEditor.value) {
    return t('contacts.conference.live.hostWaitingPrimary');
  }
  return t('contacts.conference.live.stubBody');
});

function roleLabel(role) {
  if (role === 'agent') return t('contacts.conference.live.roleAgent');
  if (role === 'host_coach') return t('contacts.conference.live.roleCoach');
  if (role === 'host') return t('contacts.conference.live.roleHost');
  if (role === 'participant') return t('contacts.conference.live.roleParticipant');
  return t('contacts.conference.live.roleHost');
}

/** Для получателя: перевод первым; оригинал — подпись. */
function displayChatText(item) {
  if (!item) return '';
  if (item.text_translated) return item.text_translated;
  return item.text || '';
}

function chatOriginal(item) {
  if (!item?.text_translated) return '';
  return t('contacts.conference.live.chatOriginal', { text: item.text });
}

function applyLive(data) {
  if (!liveViewActive || !data) return;
  if (data.session) session.value = data.session;
  if (data.session?.created_by) hostId.value = data.session.created_by;
  agentRunning.value = Boolean(data.agentRunning);
  agentMuted.value = Boolean(data.agentMuted);
  if (Array.isArray(data.coachRules)) {
    coachRules.value = data.coachRules;
  }
  if (Array.isArray(data.transcript)) {
    transcriptItems.value = data.transcript;
  }
  // Команды Realtime обрабатывает только владелец (primary / solo host)
  if (isRealtimeOwner.value) {
    for (const cmd of data.pendingCommands || []) {
      handleCommand(cmd);
    }
  }
}

async function handleCommand(cmd) {
  if (!cmd?.type) return;
  if (cmd.type === 'start_presentation' || cmd.type === 'coach' || cmd.type === 'mute' || cmd.type === 'unmute') {
    try {
      await ensureRealtime();
    } catch (e) {
      ElMessage.error(e?.response?.data?.error || e?.message || t('contacts.conference.live.realtimeError'));
      return;
    }
  }
  if (!realtime) return;
  if (cmd.type === 'start_presentation') {
    realtime.startPresentation(cmd.text);
  } else if (cmd.type === 'coach') {
    realtime.applyCoach(cmd.text);
  } else if (cmd.type === 'mute') {
    realtime.setMuted(true);
  } else if (cmd.type === 'unmute') {
    realtime.setMuted(false);
  }
}

async function ensureRealtime() {
  if (!realtime) {
    realtime = createConferenceRealtimeController({
      onStatus: (s) => {
        realtimeStatus.value = s;
      },
      onTranscript: (item) => {
        transcriptItems.value.push({
          _key: `${Date.now()}-${Math.random()}`,
          role: item.role,
          text: item.text
        });
      },
      onError: (err) => {
        ElMessage.error(err?.message || t('contacts.conference.live.realtimeError'));
      }
    });
  }
  if (!realtime.connected) {
    await realtime.connect(sessionId.value);
  }
}

async function load() {
  loading.value = true;
  try {
    const live = await conferenceService.getLive(sessionId.value, { drain: false });
    applyLive(live);
    if (!session.value && live.session) {
      session.value = live.session;
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.live.loadError'));
  } finally {
    loading.value = false;
  }
}

async function pollLive() {
  if (!liveViewActive) return;
  try {
    // Drain только у primary — иначе secondary в multi съест команды
    const live = await conferenceService.getLive(sessionId.value, {
      drain: isRealtimePrimary.value
    });
    applyLive(live);
  } catch {
    /* ignore poll errors */
  }
}

async function sendChat() {
  const text = chatDraft.value.trim();
  if (!text) return;
  chatDraft.value = '';
  const role = isEditor.value && !isParticipantRoute.value ? 'host' : 'participant';
  try {
    const data = await conferenceService.appendTranscript(sessionId.value, { role, text });
    if (data.item) {
      transcriptItems.value = [...transcriptItems.value, data.item];
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.live.chatError'));
    return;
  }
  // В Realtime чат уходит только у владельца Realtime (primary / solo)
  if (isRealtimeOwner.value && realtime?.connected) {
    realtime.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }]
      }
    });
    realtime.sendEvent({ type: 'response.create' });
  }
}

async function sendCoach() {
  const text = coachDraft.value.trim();
  if (!text) return;
  coachSaving.value = true;
  try {
    const data = await conferenceService.sendCoach(sessionId.value, text);
    coachDraft.value = '';
    applyLive(data);
    // Локальный apply только у владельца Realtime; иначе команда уйдёт primary через poll
    if (isRealtimeOwner.value && realtime?.connected) {
      realtime.applyCoach(text);
    }
    ElMessage.success(t('contacts.conference.live.coachSaved'));
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.live.coachError'));
  } finally {
    coachSaving.value = false;
  }
}

function stopLocalMedia() {
  cameraOn.value = false;
  micOn.value = false;
  screenOn.value = false;
}

async function ensureLivekit() {
  if (!livekit) {
    livekit = createConferenceLivekitController({
      onStatus: (s) => {
        livekitStatus.value = s;
        if (s === 'disconnected') {
          hasRemoteVideo.value = false;
          stopLocalMedia();
        }
      },
      onRemoteVideo: (present) => {
        hasRemoteVideo.value = Boolean(present);
      },
      onError: (err) => {
        ElMessage.error(err?.message || t('contacts.conference.live.videoLivekitError'));
      },
      remoteContainerEl: () => remoteVideoMount.value,
      localContainerEl: () => localVideoMount.value
    });
  }
  if (!livekit.connected) {
    await livekit.connect(sessionId.value);
  }
}

async function connectLivekit({ silent = false, withCamera = false } = {}) {
  if (livekit?.connected) {
    if (!silent) ElMessage.success(t('contacts.conference.live.videoRoomReady'));
    if (withCamera && !cameraOn.value) {
      await toggleCamera();
    }
    return;
  }
  livekitConnecting.value = true;
  try {
    await ensureLivekit();
    if (!silent) ElMessage.success(t('contacts.conference.live.videoRoomReady'));
    // Жест пользователя (клик «В комнату») — сразу запросить камеру
    if (withCamera) {
      try {
        await livekit.setCameraEnabled(true);
        cameraOn.value = true;
      } catch (camErr) {
        ElMessage.warning(
          camErr?.message || t('contacts.conference.live.videoCameraError')
        );
      }
    }
  } catch (e) {
    const raw = e?.response?.data?.error || e?.message || '';
    const isPc =
      /could not establish pc connection|pc connection|ice connection|peerconnection/i.test(
        String(raw)
      );
    const msg = isPc
      ? t('contacts.conference.live.videoLivekitPcError')
      : raw || t('contacts.conference.live.videoLivekitError');
    if (silent) {
      ElMessage.warning(msg);
    } else {
      ElMessage.error(msg);
    }
  } finally {
    livekitConnecting.value = false;
  }
}

/** Клик по «Подключить» — с user gesture включаем камеру. */
async function onConnectRoomClick() {
  if (livekit?.connected) {
    if (!cameraOn.value) await toggleCamera();
    return;
  }
  await connectLivekit({ silent: false, withCamera: true });
}

async function toggleMic() {
  mediaBusy.value = true;
  try {
    await ensureLivekit();
    const next = !micOn.value;
    await livekit.setMicrophoneEnabled(next);
    micOn.value = next;
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.live.videoMicError'));
  } finally {
    mediaBusy.value = false;
  }
}

async function toggleCamera() {
  mediaBusy.value = true;
  try {
    await ensureLivekit();
    const next = !cameraOn.value;
    if (next && screenOn.value) {
      await livekit.setScreenEnabled(false);
      screenOn.value = false;
    }
    await livekit.setCameraEnabled(next);
    cameraOn.value = next;
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.live.videoCameraError'));
  } finally {
    mediaBusy.value = false;
  }
}

async function toggleScreen() {
  mediaBusy.value = true;
  try {
    await ensureLivekit();
    const next = !screenOn.value;
    if (next && cameraOn.value) {
      await livekit.setCameraEnabled(false);
      cameraOn.value = false;
    }
    await livekit.setScreenEnabled(next);
    screenOn.value = next;
  } catch (e) {
    if (e?.name !== 'NotAllowedError') {
      ElMessage.error(e?.response?.data?.error || t('contacts.conference.live.videoScreenError'));
    }
  } finally {
    mediaBusy.value = false;
  }
}

function syncFullscreenState() {
  const el = videoPanelRef.value;
  videoFullscreen.value = Boolean(el && document.fullscreenElement === el);
}

async function exitVideoFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  } catch {
    /* ignore */
  }
  videoFullscreen.value = false;
}

async function toggleVideoFullscreen() {
  const el = videoPanelRef.value;
  if (!el) return;
  try {
    if (document.fullscreenElement === el || videoFullscreen.value) {
      await exitVideoFullscreen();
      return;
    }
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    } else {
      ElMessage.warning(t('contacts.conference.live.videoFullscreenUnsupported'));
    }
  } catch (e) {
    ElMessage.warning(e?.message || t('contacts.conference.live.videoFullscreenUnsupported'));
  } finally {
    syncFullscreenState();
  }
}

function getSpeechRecognition() {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = session.value?.host_language || 'ru-RU';
  if (rec.lang.length === 2) {
    rec.lang = rec.lang === 'en' ? 'en-US' : `${rec.lang}-${rec.lang.toUpperCase()}`;
  }
  rec.interimResults = false;
  rec.continuous = false;
  return rec;
}

function startPtt() {
  if (pttListening.value) return;
  recognition = getSpeechRecognition();
  if (!recognition) {
    ElMessage.warning(t('contacts.conference.live.pttUnsupported'));
    return;
  }
  pttListening.value = true;
  recognition.onresult = async (event) => {
    const text = Array.from(event.results)
      .map((r) => r[0]?.transcript || '')
      .join(' ')
      .trim();
    if (!text) return;
    coachDraft.value = [coachDraft.value, text].filter(Boolean).join(' ').trim();
    // Hold UX: после распознавания сразу отправляем coach
    if (coachDraft.value.trim()) {
      await sendCoach();
    }
  };
  recognition.onerror = () => {
    pttListening.value = false;
  };
  recognition.onend = () => {
    pttListening.value = false;
  };
  try {
    recognition.start();
  } catch {
    pttListening.value = false;
  }
}

function stopPtt() {
  if (!pttListening.value) return;
  try {
    recognition?.stop();
  } catch {
    /* ignore */
  }
  pttListening.value = false;
}

/**
 * Host шлёт команду primary (владелец Realtime).
 * Локальный Realtime у host — только ?solo=1 (тест в одном браузере).
 */
async function startAgent() {
  agentStarting.value = true;
  try {
    const data = await conferenceService.startAgent(sessionId.value);
    applyLive(data);
    if (isRealtimeOwner.value) {
      await ensureRealtime();
      realtime.startPresentation();
      ElMessage.success(t('contacts.conference.live.agentStarted'));
    } else {
      ElMessage.success(t('contacts.conference.live.agentSignaled'));
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.live.agentStartError'));
  } finally {
    agentStarting.value = false;
  }
}

async function toggleMute() {
  muteSaving.value = true;
  const next = !agentMuted.value;
  try {
    const data = await conferenceService.muteAgent(sessionId.value, next);
    applyLive(data);
    if (isRealtimeOwner.value) {
      realtime?.setMuted(next);
    }
    ElMessage.success(
      next ? t('contacts.conference.live.muted') : t('contacts.conference.live.unmuted')
    );
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.live.muteError'));
  } finally {
    muteSaving.value = false;
  }
}

async function endConference() {
  const id = resolveConferenceId();
  const nav = {
    routeName: route.name,
    contactId: route.params.id,
    sessionId: id || sessionId.value,
    hostId: hostId.value
  };
  if (!id) {
    ElMessage.warning(t('contacts.conference.live.endError'));
    await exitVideoFullscreen();
    goBack(nav);
    return;
  }
  if (ending.value) return;
  ending.value = true;
  try {
    // Сначала снимаем fullscreen — иначе fixed-оверлей/FS блокирует вкладки
    await exitVideoFullscreen();
    const data = await conferenceService.endSession(id);
    stopLocalMedia();
    livekit?.disconnect();
    realtime?.disconnect();
    try {
      const a = data.analytics;
      if (a?.duration_sec != null) {
        ElMessage.success(
          t('contacts.conference.live.endedWithStats', {
            min: Math.round(a.duration_sec / 60),
            messages: (a.transcript_by_role?.host || 0) + (a.transcript_by_role?.participant || 0),
            coach: a.coach_rules || 0
          })
        );
      } else {
        ElMessage.success(t('contacts.conference.live.ended'));
      }
    } catch {
      /* toast не должен блокировать уход со страницы */
    }
    goBack(nav);
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.live.endError'));
  } finally {
    ending.value = false;
  }
}

function goBack(nav = {}) {
  const name = nav.routeName || route.name;
  const sid = nav.sessionId != null ? nav.sessionId : sessionId.value;
  const contactId = nav.contactId != null ? nav.contactId : route.params.id;
  const hid = nav.hostId != null ? nav.hostId : hostId.value;

  if (name === 'hub-conference-live') {
    if (sid) {
      router.push({ name: 'hub-conference', params: { sessionId: String(sid) } });
    } else {
      router.push({ name: 'hub-conferences' });
    }
    return;
  }
  if (name === 'conference-participant-live') {
    if (hid) {
      router.push({
        name: 'admin-chat',
        params: { adminId: String(hid) },
        query: sid ? { conference: String(sid) } : {}
      });
      return;
    }
    router.push({ name: 'personal-messages' });
    return;
  }
  if (contactId != null && contactId !== '') {
    router.push({ name: 'contact-conference', params: { id: contactId } });
    return;
  }
  router.push({ name: 'contacts-list' });
}

async function leaveRoom() {
  const nav = {
    routeName: route.name,
    contactId: route.params.id,
    sessionId: resolveConferenceId() || sessionId.value,
    hostId: hostId.value
  };
  await exitVideoFullscreen();
  stopLocalMedia();
  livekit?.disconnect();
  realtime?.disconnect();
  goBack(nav);
}

function goAgent() {
  exitVideoFullscreen().finally(() => {
    if (route.name === 'hub-conference-live') {
      router.push({ name: 'hub-conference-agent', params: { sessionId: String(sessionId.value) } });
      return;
    }
    router.push({ name: 'contact-conference-agent', params: { id: route.params.id } });
  });
}

onMounted(async () => {
  liveViewActive = true;
  document.addEventListener('fullscreenchange', syncFullscreenState);
  await load();
  if (!liveViewActive) return;
  pollTimer = setInterval(pollLive, 3000);
  // LiveKit только по клику «В комнату»: иначе Chrome блокирует AudioContext
  // (autoplay policy) и сыпятся предупреждения без user gesture.
  if (isRealtimeOwner.value) {
    try {
      await ensureRealtime();
    } catch (e) {
      if (!liveViewActive) return;
      ElMessage.warning(
        e?.response?.data?.error || t('contacts.conference.live.realtimeReadyHint')
      );
    }
  }
});

onBeforeUnmount(() => {
  liveViewActive = false;
  document.removeEventListener('fullscreenchange', syncFullscreenState);
  if (document.fullscreenElement && videoPanelRef.value
    && document.fullscreenElement === videoPanelRef.value) {
    document.exitFullscreen?.().catch(() => {});
  }
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  stopPtt();
  stopLocalMedia();
  livekit?.disconnect();
  realtime?.disconnect();
});
</script>

<style scoped>
.live-alert {
  margin-bottom: 16px;
}

.live-meta h2 {
  margin: 0 0 8px;
}

.live-id,
.live-langs {
  margin-left: 10px;
  color: var(--color-grey, #606266);
}

.live-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 14px;
  margin-top: 16px;
}

.live-panel {
  border: 1px solid var(--color-border, #dcdfe6);
  border-radius: var(--block-radius, 8px);
  padding: 12px 14px;
  background: var(--color-white, #fff);
}

.live-panel h3 {
  margin: 0;
  font-size: 1rem;
}

.video-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.video-stage {
  position: relative;
  min-height: 180px;
  border-radius: 6px;
  overflow: hidden;
  background: #1a1f2b;
}

.video-stage-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 8px;
  min-height: 200px;
}

.video-tile {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.video-tile-label {
  font-size: 0.75rem;
  color: #c0c4cc;
  margin-bottom: 4px;
}

.video-mount-wrap {
  position: relative;
  flex: 1;
  min-height: 160px;
  border-radius: 6px;
  overflow: hidden;
  background: #111;
}

.video-mount {
  width: 100%;
  height: 100%;
  min-height: 160px;
  background: #111;
  position: relative;
  z-index: 1;
}

.video-mount-wrap > .video-placeholder {
  position: absolute;
  inset: 0;
  z-index: 2;
  min-height: 0;
  pointer-events: none;
}

.video-mount :deep(video) {
  width: 100%;
  height: 100%;
  min-height: 160px;
  max-height: none;
  object-fit: contain;
  display: block;
  background: #000;
}

.video-panel-head-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

/* Native Fullscreen: height:100% часто схлопывается до контента → белая пустота.
   Явно 100dvh + селектор :fullscreen. Без position:fixed (ломает вкладки/Завершить). */
.video-panel:fullscreen,
.video-panel.is-fullscreen {
  margin: 0;
  border: none;
  border-radius: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  width: 100vw;
  height: 100%;
  height: 100vh;
  height: 100dvh;
  max-height: 100dvh;
  padding: 12px 14px;
  overflow: auto;
  background: #0b0d12;
  color: #fff;
}

.video-panel:fullscreen .video-stage-split,
.video-panel.is-fullscreen .video-stage-split {
  flex: 1 1 auto;
  min-height: 0;
  height: auto;
  grid-template-rows: 1fr;
}

.video-panel:fullscreen .video-mount-wrap,
.video-panel.is-fullscreen .video-mount-wrap {
  min-height: 0;
  height: 100%;
}

.video-panel:fullscreen .video-mount,
.video-panel.is-fullscreen .video-mount {
  min-height: 0;
  height: 100%;
}

.video-panel:fullscreen .video-mount :deep(video),
.video-panel.is-fullscreen .video-mount :deep(video) {
  min-height: 0;
  height: 100%;
  object-fit: contain;
}

.video-panel:fullscreen .video-note,
.video-panel.is-fullscreen .video-note,
.video-panel:fullscreen .video-hint,
.video-panel.is-fullscreen .video-hint {
  color: #c0c4cc;
}

.video-placeholder {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #1a1f2b, #2c3344);
  color: #c0c4cc;
  text-align: center;
  padding: 16px;
}

.video-placeholder.small {
  min-height: 160px;
  font-size: 0.85rem;
}

.video-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.video-hint {
  margin: 8px 0 0;
  font-size: 0.85rem;
  color: var(--el-color-warning, #b88230);
}

.video-note {
  margin: 8px 0 0;
  font-size: 0.8rem;
  color: var(--color-grey, #606266);
}

@media (max-width: 900px) {
  .video-stage-split {
    grid-template-columns: 1fr;
  }
}

.chat-log,
.transcript-log {
  min-height: 140px;
  max-height: 220px;
  overflow: auto;
  margin-bottom: 10px;
}

.chat-line,
.transcript-line {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 0.9rem;
}

.chat-texts {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.chat-original {
  font-size: 0.8rem;
  color: var(--color-grey, #909399);
}

.chat-role {
  font-weight: 600;
  color: var(--color-grey, #606266);
  flex-shrink: 0;
}

.chat-compose,
.coach-actions,
.live-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.coach-hint {
  margin: 0 0 8px;
  color: var(--color-grey, #606266);
  font-size: 0.85rem;
}

.coach-list {
  margin: 10px 0 0;
  padding-left: 18px;
}

.live-actions {
  margin-top: 18px;
}

@media (max-width: 900px) {
  .live-grid {
    grid-template-columns: 1fr;
  }
}
</style>
