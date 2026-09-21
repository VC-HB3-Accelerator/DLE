<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="conference-live page-with-close" v-loading="loading">
    <PageCloseButton v-if="showLocalClose" :on-navigate="leaveRoom" />

    <div v-if="session" class="live-meta">
      <h2>{{ session.title || t('contacts.conference.live.untitled') }}</h2>
    </div>

    <div class="live-layout">
      <section
        ref="videoPanelRef"
        class="live-panel video-panel"
        :class="{ 'is-fullscreen': videoFullscreen, 'has-chat-open': chatVisible }"
      >
        <div class="video-panel-head">
          <h3>{{ t('contacts.conference.live.videoTitle') }}</h3>
          <div class="video-panel-head-actions">
            <el-button
              v-if="videoFullscreen && isConferenceHost"
              size="small"
              type="danger"
              plain
              :loading="ending"
              @click="endConference"
            >
              {{ t('contacts.conference.live.end') }}
            </el-button>
            <el-button v-if="videoFullscreen" size="small" @click="leaveRoom">
              {{ t('contacts.conference.live.leave') }}
            </el-button>
            <el-button size="small" @click="toggleVideoFullscreen">
              {{
                videoFullscreen
                  ? t('contacts.conference.live.videoFullscreenExit')
                  : t('contacts.conference.live.videoFullscreen')
              }}
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
              <div v-else-if="!hasRemoteVideo" class="video-placeholder small">
                {{ t('contacts.conference.live.videoWaitingPeer') }}
              </div>
            </div>
          </div>
        </div>
        <div v-if="interpretCaption" class="interpret-caption">
          <span class="interpret-caption-label">{{ t('contacts.conference.live.interpretCaption') }}</span>
          <span>{{ interpretCaption }}</span>
        </div>
        <div class="video-actions">
          <el-button
            size="small"
            :loading="livekitConnecting"
            :type="livekitStatus === 'connected' ? 'success' : 'primary'"
            @click="onConnectRoomClick"
          >
            {{
              livekitStatus === 'connected'
                ? t('contacts.conference.live.videoRoomOn')
                : t('contacts.conference.live.videoRoomConnect')
            }}
          </el-button>
          <el-button
            size="small"
            :loading="mediaBusy"
            :disabled="livekitConnecting || interpretationRunning"
            :type="micOn ? 'primary' : 'default'"
            @click="toggleMic"
          >
            {{
              micOn
                ? t('contacts.conference.live.videoMicOff')
                : t('contacts.conference.live.videoMicOn')
            }}
          </el-button>
          <el-button
            size="small"
            :loading="mediaBusy"
            :disabled="livekitConnecting"
            :type="cameraOn ? 'primary' : 'default'"
            @click="toggleCamera"
          >
            {{
              cameraOn
                ? t('contacts.conference.live.videoCameraOff')
                : t('contacts.conference.live.videoCameraOn')
            }}
          </el-button>
          <el-button
            v-if="isEditor"
            size="small"
            :loading="mediaBusy"
            :disabled="livekitConnecting"
            :type="screenOn ? 'primary' : 'default'"
            @click="toggleScreen"
          >
            {{
              screenOn
                ? t('contacts.conference.live.videoScreenOff')
                : t('contacts.conference.live.videoScreenOn')
            }}
          </el-button>
          <el-button size="small" @click="toggleVideoFullscreen">
            {{
              videoFullscreen
                ? t('contacts.conference.live.videoFullscreenExit')
                : t('contacts.conference.live.videoFullscreen')
            }}
          </el-button>
          <el-button
            size="small"
            :type="chatVisible ? 'primary' : 'default'"
            @click="toggleChatPanel"
          >
            {{
              chatVisible
                ? t('contacts.conference.live.chatHide')
                : t('contacts.conference.live.chatShow')
            }}
          </el-button>
          <template v-if="canPickListenLanguage">
            <label class="video-lang-label">{{ t('contacts.conference.live.listenLanguage') }}</label>
            <el-select
              :model-value="myListenLanguage"
              filterable
              size="small"
              class="video-lang-select"
              :loading="langSaving"
              @change="onListenLanguageChange"
            >
              <el-option
                v-for="lang in speechLanguages"
                :key="lang.value"
                :label="lang.label"
                :value="lang.value"
              />
            </el-select>
          </template>
          <el-button
            v-if="canUseInterpretation"
            size="small"
            :type="interpretationRunning ? 'warning' : 'success'"
            :loading="interpretationToggling"
            :disabled="livekitStatus !== 'connected'"
            @click="toggleInterpretation"
          >
            {{
              interpretationRunning && interpretStatus === 'connected'
                ? t('contacts.conference.live.stopInterpretation')
                : t('contacts.conference.live.startInterpretation')
            }}
          </el-button>
          <el-button
            v-if="isConferenceHost"
            size="small"
            type="success"
            :loading="confirmNotifying"
            @click="confirmCallNotify"
          >
            {{ t('contacts.conference.live.confirmCall') }}
          </el-button>
          <el-button
            v-if="isConferenceHost"
            size="small"
            type="danger"
            plain
            :loading="ending"
            @click="endConference"
          >
            {{ t('contacts.conference.live.end') }}
          </el-button>
          <el-button size="small" type="danger" @click="leaveRoom">
            {{ t('contacts.conference.live.leave') }}
          </el-button>
        </div>
        <p v-if="livekitStatus !== 'connected'" class="video-hint">
          {{ t('contacts.conference.live.videoJoinHint') }}
        </p>
        <p v-else-if="!cameraOn && !screenOn" class="video-hint">
          {{ t('contacts.conference.live.videoEnableHint') }}
        </p>
      </section>

      <section
        v-if="interpretationRunning"
        class="live-panel transcript-panel"
      >
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
            <span>{{ displayVoiceText(item) }}</span>
            <span v-if="voiceSubtitle(item)" class="chat-original">{{ voiceSubtitle(item) }}</span>
          </div>
        </div>
      </section>

      <section v-if="chatVisible" class="live-panel chat-panel">
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
              <span v-if="chatSubtitle(item)" class="chat-original">{{ chatSubtitle(item) }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div v-if="isEditor" class="live-actions">
      <div class="live-actions-agent">
        <el-button
          v-if="!agentEnabled"
          plain
          @click="goAgent"
        >
          {{ t('contacts.conference.live.agentEnableInSettings') }}
        </el-button>
        <el-button
          v-else-if="!agentRunning"
          type="primary"
          :loading="agentStarting"
          :disabled="livekitStatus !== 'connected'"
          @click="startAgent"
        >
          {{ t('contacts.conference.live.startAgent') }}
        </el-button>
        <el-button
          v-else
          :type="agentMuted ? 'success' : 'warning'"
          :loading="muteSaving"
          @click="toggleMute"
        >
          {{ agentMuted
            ? t('contacts.conference.live.unmuteAgent')
            : t('contacts.conference.live.muteAgent') }}
        </el-button>
        <el-button plain @click="goAgent">
          {{ t('contacts.conference.live.openAgentSettings') }}
        </el-button>
      </div>
    </div>

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
</template>

<script setup>
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageCloseButton from '@/components/PageCloseButton.vue';
import conferenceService from '@/services/conferenceService';
import { usePermissions } from '@/composables/usePermissions';
import { useAuthContext } from '@/composables/useAuth';
import { createConferenceRealtimeController } from '@/composables/useConferenceRealtime';
import {
  createConferenceLivekitController,
  captureConferenceCameraTrack,
  captureConferenceMedia,
  attachCapturedPreview
} from '@/composables/useConferenceLivekit';
import { createConferenceInterpretationController } from '@/composables/useConferenceInterpretation';
import {
  displayTextForViewer,
  subtitleTextForViewer
} from '@/utils/conferenceInterpretDisplay';
import { CONFERENCE_SPEECH_LANGUAGES } from '@/shared/conferenceSpeechLanguages';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { isEditor } = usePermissions();
const { userId } = useAuthContext();
const speechLanguages = CONFERENCE_SPEECH_LANGUAGES;
const langSaving = ref(false);

/** Layout может перехватить × и вызвать leaveRoom (с очисткой медиа) */
const registerPageCloseHandler = inject('registerPageCloseHandler', null);
const unregisterPageCloseHandler = inject('unregisterPageCloseHandler', null);
const showLocalClose = !registerPageCloseHandler;

const loading = ref(false);
const session = ref(null);
const chatDraft = ref('');
const chatVisible = ref(false);
const coachDraft = ref('');
const transcriptItems = ref([]);
const coachRules = ref([]);
const agentRunning = ref(false);
const agentEnabled = ref(false);
const agentMuted = ref(false);
const agentStarting = ref(false);
const muteSaving = ref(false);
const coachSaving = ref(false);
const ending = ref(false);
const confirmNotifying = ref(false);
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
const lastInterpretLine = ref(null);
const interpretStatus = ref('disconnected');
const interpretationRunning = ref(false);
const interpretationToggling = ref(false);

let realtime = null;
let interpretation = null;
let livekit = null;
let pollTimer = null;
let recognition = null;
let liveViewActive = false;
let sharedMicStream = null;
let remoteEndedHandled = false;
let interpretationSyncPromise = null;
let interpretationLocallyEnabled = false;
let commandQueue = Promise.resolve();
let agentPlaybackActive = false;
let interpretationPlaybackActive = false;
let interpretReconnectAttempts = 0;
let interpretReconnectTimer = null;
let lastInterpretErrorMsg = '';
const INTERPRET_RECONNECT_MAX = 3;

function syncModelInputGates() {
  // Пока играет перевод — глушим и агента, и вход переводчика (эхо с динамиков).
  const gate = interpretationPlaybackActive || agentPlaybackActive;
  realtime?.setInputMuted(gate);
  interpretation?.setInputMuted(gate);
}

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

/** Ведущий сессии по книге (created_by), не по роли editor в матрице. */
const isConferenceHost = computed(() => {
  const uid = userId.value;
  const createdBy = session.value?.created_by;
  if (uid == null || createdBy == null) return false;
  return Number(createdBy) === Number(uid);
});

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
  () => isConferenceHost.value && String(route.query.solo || '') === '1'
);

const isHostViewer = computed(() => isConferenceHost.value);

const canUseAgentRealtime = computed(
  () => isRealtimePrimary.value || isHostViewer.value || isSoloHostRealtime.value
);

const interpretationEnabled = computed(
  () => Boolean(session.value?.interpretation_enabled)
);

const canUseInterpretation = computed(
  () => interpretationEnabled.value && (isHostViewer.value || isRealtimePrimary.value)
);

const interpretCaption = computed(() => {
  const line = lastInterpretLine.value;
  if (!line) return '';
  return displayTextForViewer(
    {
      role: line.role,
      text: line.original,
      text_translated: line.translated
    },
    {
      isHostViewer: isHostViewer.value,
      isPrimaryViewer: isRealtimePrimary.value
    }
  );
});

/** Host (created_by) → host_language; primary → guest_language */
const canPickListenLanguage = computed(() => {
  if (!session.value || userId.value == null) return false;
  const uid = Number(userId.value);
  return (
    Number(session.value.created_by) === uid
    || Number(session.value.contact_user_id) === uid
  );
});

const myListenLanguage = computed(() => {
  if (!session.value || userId.value == null) return 'en';
  if (Number(session.value.created_by) === Number(userId.value)) {
    return session.value.host_language || 'ru';
  }
  return session.value.guest_language || 'en';
});

async function onListenLanguageChange(code) {
  const id = resolveConferenceId();
  if (!id || !code || userId.value == null) return;
  const previousGuestLanguage = session.value?.guest_language;
  const previousHostLanguage = session.value?.host_language;
  langSaving.value = true;
  try {
    const isHostActor = Number(session.value?.created_by) === Number(userId.value);
    const payload = isHostActor
      ? { host_language: code }
      : { guest_language: code };
    const data = await conferenceService.updateLanguages(id, payload);
    if (data.session) {
      session.value = { ...session.value, ...data.session };
      const languageChanged = previousGuestLanguage !== session.value.guest_language
        || previousHostLanguage !== session.value.host_language;
      if (languageChanged && interpretationRunning.value && liveViewActive) {
        interpretation?.disconnect();
        await syncInterpretationRuntime();
      }
    }
    if (!liveViewActive) return;
    ElMessage.success(t('contacts.conference.live.listenLanguageSaved'));
  } catch (e) {
    ElMessage.error(
      e?.response?.data?.error || t('contacts.conference.live.listenLanguageError')
    );
  } finally {
    langSaving.value = false;
  }
}

/** Чат: все роли кроме coach (клиент coach не видит) */
const visibleChatItems = computed(() =>
  (transcriptItems.value || []).filter(
    (i) => i.role !== 'host_coach' && Boolean(displayChatText(i))
  )
);

/** Голосовой транскрипт: agent + participant + host (синхрон) */
const voiceTranscriptItems = computed(() =>
  (transcriptItems.value || []).filter((i) => {
    if (i.role === 'agent' || i.role === 'participant') return true;
    if (i.role === 'interpret_to_host') return isHostViewer.value;
    if (i.role === 'interpret_to_primary') return isRealtimePrimary.value;
    return interpretationEnabled.value && i.role === 'host';
  })
);

function roleLabel(role) {
  if (role === 'agent') return t('contacts.conference.live.roleAgent');
  if (role === 'host_coach') return t('contacts.conference.live.roleCoach');
  if (role === 'host') return t('contacts.conference.live.roleHost');
  if (role === 'interpret_to_host') return t('contacts.conference.live.roleParticipant');
  if (role === 'interpret_to_primary') return t('contacts.conference.live.roleHost');
  if (role === 'participant') return t('contacts.conference.live.roleParticipant');
  return t('contacts.conference.live.roleHost');
}

function displayChatText(item) {
  return displayTextForViewer(item, {
    isHostViewer: isHostViewer.value,
    isPrimaryViewer: isRealtimePrimary.value
  });
}

function chatSubtitle(item) {
  const sub = subtitleTextForViewer(item, { isHostViewer: isHostViewer.value });
  if (!sub) return '';
  return t('contacts.conference.live.chatOriginal', { text: sub });
}

function displayVoiceText(item) {
  return displayTextForViewer(item, {
    isHostViewer: isHostViewer.value,
    isPrimaryViewer: isRealtimePrimary.value
  });
}

function voiceSubtitle(item) {
  const sub = subtitleTextForViewer(item, { isHostViewer: isHostViewer.value });
  if (!sub) return '';
  return t('contacts.conference.live.chatOriginal', { text: sub });
}

function applyLive(data) {
  if (!liveViewActive || !data) return;
  const previousGuestLanguage = session.value?.guest_language;
  const previousHostLanguage = session.value?.host_language;
  if (data.session) session.value = data.session;
  if (data.session?.created_by) hostId.value = data.session.created_by;
  const st = String(data.session?.status || '');
  if (st === 'ended' || st === 'cancelled') {
    handleRemoteEnded();
    return;
  }
  if (data.agentEnabled !== undefined) agentEnabled.value = Boolean(data.agentEnabled);
  agentRunning.value = Boolean(data.agentRunning);
  agentMuted.value = Boolean(data.agentMuted);
  if (data.interpretationRunning !== undefined) {
    const previous = interpretationRunning.value;
    interpretationRunning.value = Boolean(data.interpretationRunning);
    if (
      previous !== interpretationRunning.value
      && interpretationLocallyEnabled
      && !interpretationToggling.value
    ) {
      syncInterpretationRuntime().catch(() => {});
    }
  }
  const languageChanged = Boolean(
    data.session
    && previousGuestLanguage
    && previousHostLanguage
    && (
      previousGuestLanguage !== data.session.guest_language
      || previousHostLanguage !== data.session.host_language
    )
  );
  if (
    languageChanged
    && interpretationRunning.value
    && interpretationLocallyEnabled
  ) {
    interpretation?.disconnect();
    syncInterpretationRuntime().catch(() => {});
  }
  if (Array.isArray(data.coachRules)) {
    coachRules.value = data.coachRules;
  }
  if (Array.isArray(data.transcript)) {
    transcriptItems.value = data.transcript;
  }
  // Команды Realtime обрабатывает только владелец (primary / solo host)
  if (canUseAgentRealtime.value) {
    for (const cmd of data.pendingCommands || []) {
      commandQueue = commandQueue
        .then(() => handleCommand(cmd))
        .catch((error) => {
          ElMessage.error(
            error?.response?.data?.error
            || error?.message
            || t('contacts.conference.live.realtimeError')
          );
        });
    }
  }
}

async function handleCommand(cmd) {
  if (!cmd?.type || !liveViewActive) return;
  if (cmd.type === 'start_presentation' || cmd.type === 'coach' || cmd.type === 'mute' || cmd.type === 'unmute') {
    try {
      await ensureRealtime();
      if (!liveViewActive) {
        realtime?.disconnect();
        return;
      }
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

function cloneAudioStream(stream) {
  const track = stream?.getAudioTracks?.()[0];
  return track ? new MediaStream([track.clone()]) : null;
}

async function ensureSharedMic({ allowCapture = false } = {}) {
  const current = sharedMicStream?.getAudioTracks?.()[0];
  if (current && current.readyState === 'live') return sharedMicStream;
  sharedMicStream?.getTracks?.().forEach((track) => track.stop());
  sharedMicStream = null;
  if (!allowCapture) return null;
  sharedMicStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });
  return sharedMicStream;
}

function getRealtimeController() {
  if (!realtime) {
    realtime = createConferenceRealtimeController({
      onStatus: (s) => {
        realtimeStatus.value = s;
      },
      onTranscript: (item) => {
        transcriptItems.value.push({
          _key: `${Date.now()}-${Math.random()}`,
          role: item.role,
          text: item.text,
          text_translated: item.text_translated || null
        });
      },
      onError: (err) => {
        ElMessage.error(err?.message || t('contacts.conference.live.realtimeError'));
      },
      onPlaybackChange: (playing) => {
        agentPlaybackActive = Boolean(playing);
        syncModelInputGates();
      }
    });
  }
  return realtime;
}

async function ensureRealtime(existingStream = null, { allowCapture = false } = {}) {
  getRealtimeController();
  if (!realtime.connected) {
    const source = existingStream
      || cloneAudioStream(await ensureSharedMic({ allowCapture }));
    if (!source) {
      throw new Error(t('contacts.conference.live.videoMicError'));
    }
    await realtime.preparePlayback();
    await realtime.connect(sessionId.value, source);
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
  const role = isConferenceHost.value ? 'host' : 'participant';
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
  if (canUseAgentRealtime.value && realtime?.connected) {
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
    if (canUseAgentRealtime.value && realtime?.connected) {
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
  sharedMicStream?.getTracks?.().forEach((track) => track.stop());
  sharedMicStream = null;
}

function getInterpretationController() {
  if (!interpretation) {
    interpretation = createConferenceInterpretationController({
      onStatus: (s) => {
        interpretStatus.value = s;
        if (s === 'connected') {
          interpretReconnectAttempts = 0;
          lastInterpretErrorMsg = '';
          return;
        }
        if (
          s === 'disconnected'
          && interpretationRunning.value
          && interpretationLocallyEnabled
          && livekitStatus.value === 'connected'
          && liveViewActive
          && !interpretationToggling.value
        ) {
          if (interpretReconnectTimer) clearTimeout(interpretReconnectTimer);
          interpretReconnectTimer = setTimeout(async () => {
            interpretReconnectTimer = null;
            if (!interpretationRunning.value || !liveViewActive) return;
            interpretReconnectAttempts += 1;
            try {
              await syncInterpretationRuntime();
              if (interpretation?.connected) {
                interpretReconnectAttempts = 0;
                lastInterpretErrorMsg = '';
                return;
              }
            } catch {
              /* ниже — тост только после серии неудач */
            }
            if (interpretReconnectAttempts >= INTERPRET_RECONNECT_MAX) {
              ElMessage.error(
                lastInterpretErrorMsg || t('contacts.conference.live.interpretError')
              );
              interpretReconnectAttempts = 0;
            }
          }, 1000);
        }
      },
      onError: (err) => {
        lastInterpretErrorMsg =
          err?.message || t('contacts.conference.live.interpretError');
        const willAutoReconnect =
          interpretationRunning.value
          && interpretationLocallyEnabled
          && livekitStatus.value === 'connected'
          && liveViewActive
          && !interpretationToggling.value;
        // Краткий обрыв + автопереподключение — без красного тоста.
        if (!willAutoReconnect) {
          ElMessage.error(lastInterpretErrorMsg);
        }
      },
      onSessionEnded: () => {
        handleRemoteEnded();
      },
      onStopped: () => {
        interpretationLocallyEnabled = false;
        interpretationRunning.value = false;
        livekit?.setRemoteAudioMuted(false);
      },
      onInterpretLine: (line) => {
        lastInterpretLine.value = line;
        transcriptItems.value.push({
          _key: `${Date.now()}-${Math.random()}`,
          role: line.role,
          text: line.original,
          text_translated: line.translated || null
        });
      },
      onPlaybackChange: (playing) => {
        interpretationPlaybackActive = Boolean(playing);
        syncModelInputGates();
      }
    });
  }
  return interpretation;
}

async function ensureInterpretation(existingStream = null, { allowCapture = false } = {}) {
  if (
    !canUseInterpretation.value
    || !interpretationRunning.value
    || !interpretationLocallyEnabled
  ) {
    return false;
  }
  const id = resolveConferenceId();
  if (!id) return false;
  getInterpretationController();
  if (interpretation.connected) {
    existingStream?.getTracks?.().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    return true;
  }
  if (!interpretation.connected) {
    const stream = existingStream
      || cloneAudioStream(await ensureSharedMic({ allowCapture }));
    if (!stream) return false;
    const sess = await conferenceService.createInterpretationSession(id);
    await interpretation.preparePlayback();
    await interpretation.connect(id, sess, stream);
  }
  return interpretation.connected;
}

async function syncInterpretationRuntime({ allowCapture = false } = {}) {
  if (interpretationSyncPromise) return interpretationSyncPromise;
  interpretationSyncPromise = (async () => {
    if (!interpretationRunning.value) {
      interpretationLocallyEnabled = false;
      interpretation?.disconnect();
      livekit?.setRemoteAudioMuted(false);
      return;
    }
    if (
      !interpretationLocallyEnabled
      || livekitStatus.value !== 'connected'
      || !canUseInterpretation.value
    ) {
      livekit?.setRemoteAudioMuted(false);
      return;
    }
    const connected = await ensureInterpretation(null, { allowCapture });
    if (!connected) {
      livekit?.setRemoteAudioMuted(false);
      return;
    }
    livekit?.setRemoteAudioMuted(true);
    if (micOn.value && livekit?.connected) {
      await livekit?.setMicrophoneEnabled(false);
      micOn.value = false;
    }
  })();
  try {
    await interpretationSyncPromise;
  } finally {
    interpretationSyncPromise = null;
    if (!interpretationRunning.value && interpretation?.connected) {
      interpretation.disconnect();
      livekit?.setRemoteAudioMuted(false);
    }
  }
}

async function toggleInterpretation() {
  const id = resolveConferenceId();
  if (!id || interpretationToggling.value) return;
  if (livekitStatus.value !== 'connected') {
    ElMessage.warning(t('contacts.conference.live.interpretJoinRoomFirst'));
    return;
  }
  interpretationToggling.value = true;
  try {
    // Разблокируем звук непосредственно внутри жеста пользователя.
    // После сетевого await Brave/Samsung может уже запретить запуск AudioContext.
    if (!interpretationRunning.value || !interpretation?.connected) {
      await getInterpretationController().preparePlayback();
    }
    if (interpretationRunning.value && !interpretation?.connected) {
      interpretationLocallyEnabled = true;
      await syncInterpretationRuntime({ allowCapture: true });
      if (!interpretation?.connected) {
        throw new Error(t('contacts.conference.live.interpretError'));
      }
      ElMessage.success(t('contacts.conference.live.interpretStarted'));
      return;
    }

    const stopping = interpretationRunning.value;
    if (!stopping) interpretationLocallyEnabled = true;
    const data = stopping
      ? await conferenceService.stopInterpretation(id)
      : await conferenceService.startInterpretation(id);
    if (stopping) interpretationLocallyEnabled = false;
    applyLive(data);
    await syncInterpretationRuntime({ allowCapture: !stopping });
    ElMessage.success(
      interpretationRunning.value
        ? t('contacts.conference.live.interpretStarted')
        : t('contacts.conference.live.interpretStopped')
    );
  } catch (e) {
    ElMessage.error(
      e?.response?.data?.error || e?.message || t('contacts.conference.live.interpretError')
    );
  } finally {
    interpretationToggling.value = false;
  }
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
  livekit.setRemoteAudioMuted(
    interpretationRunning.value && Boolean(interpretation?.connected)
  );
}

function cameraErrorMessage(e) {
  const name = String(e?.name || e?.reason || e?.code || '');
  if (/NotAllowed|PermissionDenied/i.test(name)) {
    return t('contacts.conference.live.videoCameraDenied');
  }
  if (/NotReadable|TrackStart|DeviceInUse/i.test(name)) {
    return t('contacts.conference.live.videoCameraBusy');
  }
  if (/NotFound|DevicesNotFound/i.test(name)) {
    return t('contacts.conference.live.videoCameraMissing');
  }
  return e?.response?.data?.error || e?.message || t('contacts.conference.live.videoCameraError');
}

async function connectLivekit({ silent = false } = {}) {
  if (livekit?.connected) {
    if (!silent) ElMessage.success(t('contacts.conference.live.videoRoomReady'));
    return true;
  }
  livekitConnecting.value = true;
  try {
    await ensureLivekit();
    if (!silent) ElMessage.success(t('contacts.conference.live.videoRoomReady'));
    return true;
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
    return false;
  } finally {
    livekitConnecting.value = false;
  }
}

/** Камеру берём в этом же клике, до сети — иначе телефон блокирует доступ. */
async function enableCameraFromGesture() {
  const captured = await captureConferenceCameraTrack();
  attachCapturedPreview(captured, localVideoMount.value);
  cameraOn.value = true;
  try {
    if (screenOn.value && livekit?.connected) {
      await livekit.setScreenEnabled(false);
      screenOn.value = false;
    }
    await ensureLivekit();
    const media = captured?.mediaStreamTrack;
    if (!media || media.readyState !== 'live') {
      throw new Error(t('contacts.conference.live.videoCameraError'));
    }
    await livekit.setCameraEnabled(true, captured);
  } catch (e) {
    cameraOn.value = false;
    try {
      captured.stop();
    } catch {
      /* ignore */
    }
    throw e;
  }
}

/** Клик по «Подключить» — с user gesture включаем камеру и сразу публикуем. */
async function onConnectRoomClick() {
  if (livekit?.connected) {
    if (!cameraOn.value) await toggleCamera();
    return;
  }
  mediaBusy.value = true;
  let captured = null;
  try {
    const media = await captureConferenceMedia({ withAudio: true });
    captured = media.videoTrack || null;
    sharedMicStream?.getTracks?.().forEach((track) => track.stop());
    sharedMicStream = media.audioStream || null;

    if (captured) {
      attachCapturedPreview(captured, localVideoMount.value);
      cameraOn.value = true;
    } else {
      ElMessage.error(t('contacts.conference.live.videoCameraError'));
    }

    // Сначала комната + публикация камеры/мика — до Realtime/перевода.
    // Иначе на Android трек успевает умереть за лишними await.
    const roomConnected = await connectLivekit({ silent: false });
    if (!roomConnected) {
      cameraOn.value = false;
      return;
    }
    if (captured && livekit?.connected) {
      const mediaTrack = captured.mediaStreamTrack;
      if (!mediaTrack || mediaTrack.readyState !== 'live') {
        throw new Error(t('contacts.conference.live.videoCameraError'));
      }
      await livekit.setCameraEnabled(true, captured);
      captured = null;
    }

    if (sharedMicStream && livekit?.connected) {
      const micTrack = sharedMicStream.getAudioTracks()[0];
      if (micTrack && micTrack.readyState === 'live') {
        try {
          await livekit.publishMicrophoneTrack(micTrack.clone());
          micOn.value = true;
        } catch {
          /* мик отдельно — камера важнее */
        }
      }
    }

    if (canUseAgentRealtime.value && agentEnabled.value) {
      await getRealtimeController().preparePlayback();
    }
    if (canUseInterpretation.value) {
      await getInterpretationController().preparePlayback();
    }
    if (interpretationRunning.value) {
      await syncInterpretationRuntime();
    }
  } catch (e) {
    cameraOn.value = false;
    ElMessage.error(cameraErrorMessage(e));
  } finally {
    if (captured) {
      try {
        captured.stop();
      } catch {
        /* ignore */
      }
    }
    mediaBusy.value = false;
  }
}

async function toggleMic() {
  mediaBusy.value = true;
  try {
    await ensureLivekit();
    const next = !micOn.value;
    if (next) {
      const stream = await ensureSharedMic({ allowCapture: true });
      const track = stream.getAudioTracks()[0]?.clone();
      if (!track) throw new Error(t('contacts.conference.live.videoMicError'));
      await livekit.publishMicrophoneTrack(track);
    } else {
      await livekit.setMicrophoneEnabled(false);
    }
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
    const next = !cameraOn.value;
    if (next) {
      await enableCameraFromGesture();
      return;
    }
    await ensureLivekit();
    await livekit.setCameraEnabled(false);
    cameraOn.value = false;
  } catch (e) {
    ElMessage.error(cameraErrorMessage(e));
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

/** Чат снаружи video-panel: в native fullscreen его не видно — сначала свернуть. */
async function toggleChatPanel() {
  if (chatVisible.value) {
    chatVisible.value = false;
    return;
  }
  if (document.fullscreenElement || videoFullscreen.value) {
    await exitVideoFullscreen();
  }
  chatVisible.value = true;
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
async function startAgent({ silent = false } = {}) {
  agentStarting.value = true;
  try {
    const data = await conferenceService.startAgent(sessionId.value);
    if (!liveViewActive) return;
    applyLive(data);
    if (canUseAgentRealtime.value) {
      await ensureRealtime(null, { allowCapture: true });
      if (!liveViewActive) {
        realtime?.disconnect();
        return;
      }
      realtime.startPresentation();
      if (!silent) ElMessage.success(t('contacts.conference.live.agentStarted'));
    } else if (!silent) {
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
    if (canUseAgentRealtime.value) {
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

async function confirmCallNotify() {
  const id = resolveConferenceId();
  if (!id || !isConferenceHost.value) {
    ElMessage.warning(t('contacts.conference.live.confirmCallError'));
    return;
  }
  if (confirmNotifying.value) return;
  confirmNotifying.value = true;
  try {
    const data = await conferenceService.confirmNotify(id);
    const n = Number(data.notified) || 0;
    if (n > 0) {
      ElMessage.success(t('contacts.conference.live.confirmCallSent', { count: n }));
    } else {
      ElMessage.warning(t('contacts.conference.live.confirmCallNone'));
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.live.confirmCallError'));
  } finally {
    confirmNotifying.value = false;
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
    interpretation?.disconnect();
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

  if (name === 'hub-conference-live') {
    if (sid) {
      router.push({ name: 'hub-conference', params: { sessionId: String(sid) } });
    } else {
      router.push({ name: 'hub-conferences' });
    }
    return;
  }
  if (name === 'conference-participant-live') {
    // Своя карточка /contacts/:me/conference (не admin-chat host и не чужой контакт)
    const me = userId.value;
    if (me != null && me !== '') {
      router.push({ name: 'contact-conference', params: { id: String(me) } });
      return;
    }
    const cid = session.value?.contact_user_id;
    if (cid != null && cid !== '') {
      router.push({ name: 'contact-conference', params: { id: String(cid) } });
      return;
    }
    router.push({ name: 'contacts-list' });
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
  interpretation?.disconnect();
  goBack(nav);
}

async function handleRemoteEnded() {
  if (remoteEndedHandled || ending.value || !liveViewActive) return;
  remoteEndedHandled = true;
  ElMessage.info(t('contacts.conference.live.endedRemote'));
  await leaveRoom();
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
  registerPageCloseHandler?.(leaveRoom);
  document.addEventListener('fullscreenchange', syncFullscreenState);
  await load();
  if (!liveViewActive) return;
  pollTimer = setInterval(pollLive, 3000);
  // Камера, микрофон, перевод и презентация запускаются только кнопками.
});

onBeforeUnmount(() => {
  liveViewActive = false;
  if (interpretReconnectTimer) {
    clearTimeout(interpretReconnectTimer);
    interpretReconnectTimer = null;
  }
  unregisterPageCloseHandler?.();
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
  interpretation?.disconnect();
});
</script>

<style scoped>
.conference-live.page-with-close {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  /* Шапка ~64px — видео занимает оставшуюся высоту экрана */
  min-height: calc(100dvh - 72px);
}

.live-meta h2 {
  margin: 0 0 8px;
}

.live-layout {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  flex: 1;
  min-height: 0;
  margin-top: 8px;
}

.live-panel {
  border: 1px solid var(--color-border);
  border-radius: var(--block-radius);
  padding: 12px 14px;
  background: var(--color-white);
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

.chat-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 0 0 auto;
}

.chat-panel .chat-compose {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 0 0 12px;
  flex: 0 0 auto;
}

.chat-panel .chat-compose .el-input {
  flex: 1 1 220px;
  min-width: 160px;
}

.chat-panel .chat-log {
  flex: 0 1 auto;
  min-height: 100px;
  max-height: 220px;
  margin-bottom: 0;
}

.transcript-panel {
  width: 100%;
  flex: 0 0 auto;
}

.coach-panel {
  width: 100%;
  margin-top: 8px;
  flex: 0 0 auto;
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
  flex: 0 0 auto;
}

.video-panel {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
  z-index: 1;
}

/* Чат открыт — видео не растягивается на весь экран и не наезжает на кнопки */
.video-panel.has-chat-open {
  flex: 0 1 auto;
}

.video-panel.has-chat-open .video-stage,
.video-panel.has-chat-open .video-stage-split {
  flex: 0 1 auto;
  min-height: 200px;
  height: auto;
}

.video-panel.has-chat-open .video-mount-wrap,
.video-panel.has-chat-open .video-mount {
  min-height: 180px;
  height: 180px;
}

.video-stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 42vh;
  border-radius: 6px;
  overflow: hidden;
  background: #1a1f2b;
}

.video-stage-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 8px;
  height: 100%;
  min-height: 42vh;
}

.video-tile {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.video-tile-label {
  flex: 0 0 auto;
  font-size: 0.75rem;
  color: #c0c4cc;
  margin-bottom: 4px;
}

.video-mount-wrap {
  position: relative;
  flex: 1 1 auto;
  min-height: 280px;
  height: auto;
  border-radius: 6px;
  overflow: hidden;
  background: #111;
}

.video-mount {
  width: 100%;
  height: 100%;
  min-height: 280px;
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

/* Native Fullscreen: только :fullscreen. Класс .is-fullscreen — для UI-флагов,
   без height:100dvh (иначе после выхода из FS панель остаётся гигантской и кнопки «пропадают»). */
.video-panel:fullscreen {
  margin: 0;
  border: none;
  border-radius: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  height: 100%;
  height: 100vh;
  height: 100dvh;
  max-height: 100dvh;
  padding: 12px 14px;
  overflow: auto;
  background: #0b0d12;
  color: #fff;
}

.video-panel:fullscreen .video-stage-split {
  flex: 1 1 auto;
  min-height: 0;
  height: auto;
  grid-template-rows: 1fr;
}

.video-panel:fullscreen .video-mount-wrap {
  min-height: 0;
  height: 100%;
}

.video-panel:fullscreen .video-mount {
  min-height: 0;
  height: 100%;
}

.video-panel:fullscreen .video-mount :deep(video) {
  min-height: 0;
  height: 100%;
  object-fit: contain;
}

.video-panel:fullscreen .video-hint {
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
  min-height: 100%;
  font-size: 0.85rem;
}

.video-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  flex: 0 0 auto;
  position: relative;
  z-index: 2;
}

.video-lang-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  margin-left: 4px;
  white-space: nowrap;
}

.video-lang-select {
  width: 180px;
}

.video-hint {
  margin: 8px 0 0;
  font-size: var(--font-size-xs);
  color: var(--color-warning);
  flex: 0 0 auto;
}

.interpret-caption {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  font-size: var(--font-size-sm);
  line-height: 1.35;
}

.interpret-caption-label {
  display: block;
  margin-bottom: 2px;
  font-size: var(--font-size-xs);
  opacity: 0.75;
}

@media (max-width: 768px) {
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
  font-size: var(--font-size-xs);
  color: var(--color-text-light);
}

.chat-role {
  font-weight: 600;
  color: var(--color-grey);
  flex-shrink: 0;
}

.chat-compose,
.coach-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.live-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
  flex: 0 0 auto;
}

.live-actions-interpretation,
.live-actions-agent,
.live-actions-room {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.coach-hint {
  margin: 0 0 8px;
  color: var(--color-text-light);
  font-size: var(--font-size-xs);
}

.coach-list {
  margin: 10px 0 0;
  padding-left: 18px;
}

@media (max-width: 768px) {
  .live-actions {
    flex-direction: column;
    align-items: stretch;
  }
}

/* TZ package C: bp normalized */
</style>
