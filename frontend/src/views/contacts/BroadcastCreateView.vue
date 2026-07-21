<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <div class="broadcast-section">
    <div class="broadcast-section-header">
      <h1>{{ t('contacts.broadcast.title') }}</h1>
      <p>{{ t('contacts.broadcast.selectedUsers', { count: eligibleUserIds.length, total: userIds.length }) }}</p>
    </div>

      <el-alert
        v-if="!userIds.length"
        type="warning"
        :closable="false"
        show-icon
        class="broadcast-alert"
      >
        <template #title>
          {{ t('contacts.broadcast.noRecipients') }}
        </template>
      </el-alert>

      <el-alert
        v-if="recipientsSummary?.blocked"
        type="warning"
        :closable="false"
        show-icon
        class="broadcast-alert"
      >
        <template #title>
          {{ t('contacts.broadcast.blockedSkipped', { count: recipientsSummary.blocked }) }}
        </template>
      </el-alert>

      <el-alert
        v-if="recipientsSummary?.withoutEmail"
        type="warning"
        :closable="false"
        show-icon
        class="broadcast-alert"
      >
        <template #title>
          {{ t('contacts.broadcast.withoutEmailWarning', { count: recipientsSummary.withoutEmail }) }}
        </template>
      </el-alert>

      <el-alert
        v-if="userIds.length"
        type="info"
        :closable="false"
        show-icon
        class="broadcast-alert"
      >
        <template #title>
          {{ t('contacts.broadcast.infoAlert') }}
        </template>
      </el-alert>

      <el-alert
        v-if="userIds.length"
        type="success"
        :closable="false"
        show-icon
        class="broadcast-alert"
      >
        <template #title>
          {{ t('contacts.broadcast.backendQueueAlert') }}
        </template>
      </el-alert>

      <el-form class="broadcast-form" label-position="top" @submit.prevent>
        <div class="template-toolbar">
          <el-button :disabled="loading" @click="templatesDialogVisible = true">
            {{ t('contacts.broadcast.templates.button') }}
          </el-button>
        </div>

        <el-form-item :label="t('contacts.broadcast.subject')" required>
          <el-input v-model="subject" :placeholder="t('contacts.broadcast.subjectPlaceholder')" maxlength="200" show-word-limit />
        </el-form-item>

        <el-form-item :label="t('contacts.broadcast.message')" required>
          <el-input
            v-model="message"
            type="textarea"
            :rows="12"
            :placeholder="t('contacts.broadcast.messagePlaceholder')"
          />
        </el-form-item>

        <el-form-item :label="t('contacts.broadcast.attachments')">
          <div class="attachments-box">
            <input ref="fileInputRef" class="file-input" type="file" multiple @change="onFilesSelected" />
            <el-button type="default" :disabled="loading" @click="openFilePicker">{{ t('contacts.broadcast.addAttachments') }}</el-button>
            <span class="attachments-hint">{{ t('contacts.broadcast.attachmentsHint') }}</span>
            <span class="attachments-hint">{{ t('contacts.broadcast.attachmentsPerRecipient') }}</span>
          </div>

          <div v-if="attachments.length" class="attachments-list">
            <div v-for="(file, index) in attachments" :key="`${file.name}-${file.size}-${index}`" class="attachment-item">
              <span>{{ file.name }} ({{ formatFileSize(file.size) }})</span>
              <el-button link type="danger" :disabled="loading" @click="removeAttachment(index)">{{ t('contacts.broadcast.remove') }}</el-button>
            </div>
          </div>
        </el-form-item>

        <el-divider />

        <section class="delivery-settings">
          <div class="section-heading">
            <h2>{{ t('contacts.broadcast.deliverySettings') }}</h2>
            <el-switch
              v-model="warmupMode"
              :active-text="t('contacts.broadcast.warmupMode')"
              :inactive-text="t('contacts.broadcast.normalMode')"
              :disabled="loading || !!activeCampaignId"
            />
          </div>

          <div class="ai-personalize-row">
            <el-switch
              v-model="aiPersonalize"
              :active-text="t('contacts.broadcast.aiPersonalize')"
              :disabled="loading || !!activeCampaignId"
            />
            <router-link
              class="ai-settings-link"
              :to="{ name: 'contacts-broadcast-agent', query: route.query.ids ? { ids: route.query.ids } : {} }"
            >
              {{ t('contacts.broadcast.aiPersonalizeSettings') }}
            </router-link>
          </div>

          <el-form-item :label="t('contacts.broadcast.schedule.days')">
            <el-checkbox-group v-model="scheduleDays" :disabled="loading || !!activeCampaignId">
              <el-checkbox v-for="day in weekDayOptions" :key="day.value" :label="day.value">
                {{ day.label }}
              </el-checkbox>
            </el-checkbox-group>
          </el-form-item>

          <div class="settings-grid">
            <el-form-item :label="t('contacts.broadcast.schedule.hourStart')">
              <el-input-number
                v-model="scheduleHourStart"
                :min="0"
                :max="23"
                :disabled="loading || !!activeCampaignId"
              />
            </el-form-item>
            <el-form-item :label="t('contacts.broadcast.schedule.hourEnd')">
              <el-input-number
                v-model="scheduleHourEnd"
                :min="0"
                :max="23"
                :disabled="loading || !!activeCampaignId"
              />
            </el-form-item>
            <el-form-item :label="t('contacts.broadcast.delayBetween')">
              <el-input-number
                v-model="delaySeconds"
                :min="0"
                :max="600"
                :step="5"
                :disabled="loading || !!activeCampaignId"
              />
              <span class="field-hint">{{ t('contacts.broadcast.seconds') }}</span>
            </el-form-item>
            <el-form-item :label="t('contacts.broadcast.maxRecipients')">
              <el-input-number
                v-model="maxRecipients"
                :min="1"
                :max="Math.max(eligibleUserIds.length, 1)"
                :disabled="loading || !!activeCampaignId"
              />
              <span class="field-hint">{{ t('contacts.broadcast.willSend', { send: recipientsToSend.length, total: eligibleUserIds.length }) }}</span>
            </el-form-item>
          </div>

          <el-alert
            type="info"
            :closable="false"
            show-icon
            class="delivery-alert"
          >
            <template #title>
              {{ t('contacts.broadcast.schedule.hint', {
                days: scheduleDaysLabel,
                start: scheduleHourStart,
                end: scheduleHourEnd
              }) }}
            </template>
          </el-alert>

          <el-alert
            v-if="aiPersonalize && !aiAgentEnabled"
            type="warning"
            :closable="false"
            show-icon
            class="delivery-alert"
          >
            <template #title>
              {{ t('contacts.broadcast.aiAgentDisabledAlert') }}
            </template>
          </el-alert>

          <el-alert
            v-if="aiPersonalize && aiAgentEnabled"
            type="info"
            :closable="false"
            show-icon
            class="delivery-alert"
          >
            <template #title>
              {{ t('contacts.broadcast.aiPersonalizeAlert') }}
            </template>
          </el-alert>

          <el-alert
            v-if="warmupMode"
            type="success"
            :closable="false"
            show-icon
            class="delivery-alert"
          >
            <template #title>
              {{ t('contacts.broadcast.warmupAlert') }}
            </template>
          </el-alert>

          <el-alert
            v-if="attachments.length"
            type="warning"
            :closable="false"
            show-icon
            class="delivery-alert"
          >
            <template #title>
              {{ t('contacts.broadcast.attachmentsAlert', { size: formatFileSize(attachmentsTotalSize) }) }}
            </template>
          </el-alert>
        </section>

        <section class="history-section">
          <div class="section-heading">
            <h2>{{ t('contacts.broadcast.agent.historyTitle') }}</h2>
            <div class="history-heading-actions">
              <span v-if="generatedHistory.length" class="drafts-count">
                {{ t('contacts.broadcast.drafts.readyCount', { ready: draftsReadyCount, total: draftsPlannedTotal }) }}
              </span>
              <el-button :loading="historyLoading" @click="loadGeneratedHistory">
                {{ t('common.refresh') }}
              </el-button>
            </div>
          </div>
          <p class="history-hint">{{ t('contacts.broadcast.agent.historyHint') }}</p>

          <el-alert
            v-if="generatedHistory.length"
            type="success"
            :closable="false"
            show-icon
            class="delivery-alert"
          >
            <template #title>
              {{ t('contacts.broadcast.drafts.reviewHint') }}
            </template>
          </el-alert>

          <p v-if="!historyLoading && !generatedHistory.length" class="history-empty">
            {{ t('contacts.broadcast.agent.historyEmpty') }}
          </p>

          <div v-if="generatedHistory.length" class="history-list">
            <router-link
              v-for="item in generatedHistory"
              :key="`${item.campaignId || 'local'}-${item.userId}-${item.at}`"
              class="history-item"
              :to="contactChatTarget(item.userId, item.campaignId || activeCampaignId)"
            >
              <div class="history-item-top">
                <span class="history-id">ID {{ item.userId }}</span>
                <span class="history-status">{{ item.statusLabel }}</span>
              </div>
              <div class="history-subject">{{ item.subject || '—' }}</div>
              <div class="history-body">{{ item.bodyPreview }}</div>
              <div class="history-open">{{ t('contacts.broadcast.agent.openContactChat') }} →</div>
            </router-link>
          </div>
        </section>

        <div v-if="loading || (activeCampaignId && ['in_progress', 'paused', 'preparing'].includes(campaignStatus))" class="send-progress">
          <div class="progress-text">
            <template v-if="campaignStatus === 'preparing'">
              {{ t('contacts.broadcast.drafts.preparing') }}
              <span class="drafts-count">
                {{ t('contacts.broadcast.drafts.readyCount', { ready: draftsReadyCount, total: draftsPlannedTotal }) }}
              </span>
            </template>
            <template v-else>
              {{ t('contacts.broadcast.sendingProgress', { current: sentAttempts, total: recipientsToSend.length }) }}
              <span v-if="currentUserId">{{ t('contacts.broadcast.currentId', { id: currentUserId }) }}</span>
            </template>
          </div>
          <el-progress
            v-if="campaignStatus === 'preparing'"
            :percentage="prepareProgressPercentage"
          />
          <el-progress v-else :percentage="progressPercentage" />
          <p v-if="campaignStatus" class="status-line">
            {{ t('contacts.broadcast.statusLabel', { status: statusLabel(campaignStatus) }) }}
          </p>
        </div>

        <div class="form-actions">
          <el-button :disabled="loading && !activeCampaignId" @click="goBack">{{ t('common.cancel') }}</el-button>
          <el-button
            v-if="activeCampaignId && campaignStatus === 'in_progress'"
            :disabled="actionLoading"
            @click="pauseCampaign"
          >
            {{ t('contacts.broadcast.pause') }}
          </el-button>
          <el-button
            v-if="canResumeSend"
            type="warning"
            :disabled="actionLoading"
            @click="resumeCampaign"
          >
            {{ t('contacts.broadcast.resume') }}
          </el-button>
          <el-button
            v-if="activeCampaignId && ['in_progress', 'paused', 'queued', 'ready', 'preparing', 'interrupted'].includes(campaignStatus)"
            type="danger"
            :disabled="actionLoading"
            @click="stopCampaign"
          >
            {{ t('contacts.broadcast.stop') }}
          </el-button>
          <el-button
            type="primary"
            plain
            :disabled="!canPrepare"
            :loading="preparing && !activeCampaignId"
            @click="prepareDrafts"
          >
            {{ t('contacts.broadcast.drafts.prepare') }}
          </el-button>
          <el-button
            v-if="canRePrepare"
            type="primary"
            plain
            :loading="preparing"
            @click="rePrepareDrafts"
          >
            {{ t('contacts.broadcast.drafts.rePrepare') }}
          </el-button>
          <el-button
            type="primary"
            :disabled="!canStart"
            :loading="starting"
            @click="startBroadcast"
          >
            {{ t('contacts.broadcast.drafts.start') }}
          </el-button>
        </div>
      </el-form>

      <el-card v-if="result" class="result-card" shadow="never">
        <template #header>{{ t('contacts.broadcast.resultTitle') }}</template>
        <p>{{ t('contacts.broadcast.successSent', { count: result.successCount, total: result.totalCount }) }}</p>
        <p v-if="result.errorCount">{{ t('contacts.broadcast.errorsCount', { count: result.errorCount }) }}</p>
        <p v-if="result.skippedCount">{{ t('contacts.broadcast.skippedDueToLimit', { count: result.skippedCount }) }}</p>
        <p v-if="result.campaignId">
          <router-link :to="{ name: 'contacts-broadcast-history' }">
            {{ t('contacts.broadcast.openHistory') }}
          </router-link>
        </p>
      </el-card>

      <BroadcastTemplatesDialog
        v-model="templatesDialogVisible"
        :subject="subject"
        :message="message"
        @apply="applyTemplate"
      />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import messagesService from '@/services/messagesService.js';
import BroadcastTemplatesDialog from './BroadcastTemplatesDialog.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const subject = ref('');
const message = ref('');
const attachments = ref([]);
const loading = ref(false);
const actionLoading = ref(false);
const result = ref(null);
const fileInputRef = ref(null);
const warmupMode = ref(true);
const aiPersonalize = ref(true);
const aiAgentEnabled = ref(false);
const delaySeconds = ref(60);
const maxRecipients = ref(20);
const scheduleDays = ref([1, 2, 3, 4, 5]);
const scheduleHourStart = ref(10);
const scheduleHourEnd = ref(18);
const scheduleTimezone = ref('Europe/Moscow');
const sentAttempts = ref(0);
const currentUserId = ref(null);
const templatesDialogVisible = ref(false);
const recipientsSummary = ref(null);
const activeCampaignId = ref(null);
const campaignStatus = ref('');
const pauseReason = ref('');
const plannedRecipientsCount = ref(0);
const serverDraftsReady = ref(0);
const pollTimer = ref(null);
const drafts = ref([]);
const preparing = ref(false);
const starting = ref(false);
const historyLoading = ref(false);
const generatedHistory = ref([]);
const pollInFlight = ref(false);
let campaignWs = null;

const PREVIEW_HISTORY_KEY = 'broadcastPreviewHistory';
const FALLBACK_POLL_MS = 30000;

function clearCampaignSession() {
  sessionStorage.removeItem('broadcastActiveCampaignId');
  sessionStorage.removeItem('broadcastRecipientIds');
}

function sameIdSet(a = [], b = []) {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

const weekDayOptions = computed(() => ([
  { value: 1, label: t('contacts.broadcast.schedule.mon') },
  { value: 2, label: t('contacts.broadcast.schedule.tue') },
  { value: 3, label: t('contacts.broadcast.schedule.wed') },
  { value: 4, label: t('contacts.broadcast.schedule.thu') },
  { value: 5, label: t('contacts.broadcast.schedule.fri') },
  { value: 6, label: t('contacts.broadcast.schedule.sat') },
  { value: 7, label: t('contacts.broadcast.schedule.sun') }
]));

const scheduleDaysLabel = computed(() => {
  const map = Object.fromEntries(weekDayOptions.value.map((d) => [d.value, d.label]));
  return (scheduleDays.value || []).map((d) => map[d]).filter(Boolean).join(', ');
});

const draftsReadyCount = computed(() => {
  const fromDrafts = drafts.value.filter((d) => d.status === 'draft' && String(d.body || '').trim()).length;
  return Math.max(fromDrafts, Number(serverDraftsReady.value) || 0);
});

const draftsPlannedTotal = computed(() => {
  return Math.max(
    Number(plannedRecipientsCount.value) || 0,
    recipientsToSend.value.length,
    drafts.value.length
  );
});

const canPrepare = computed(() => {
  return recipientsToSend.value.length > 0
    && subject.value.trim()
    && message.value.trim()
    && scheduleDays.value.length > 0
    && !preparing.value
    && !starting.value
    && !activeCampaignId.value
    && (!aiPersonalize.value || aiAgentEnabled.value);
});

const canRePrepare = computed(() => {
  if (!activeCampaignId.value) return false;
  if (!['paused', 'interrupted'].includes(campaignStatus.value)) return false;
  if (preparing.value || starting.value) return false;
  if (!subject.value.trim() || !message.value.trim()) return false;
  if (aiPersonalize.value && !aiAgentEnabled.value) return false;
  if (canResumeSend.value) return false;
  return true;
});

const canResumeSend = computed(() => {
  if (!activeCampaignId.value || campaignStatus.value !== 'paused') return false;
  if (preparing.value || starting.value || loading.value) return false;
  if (draftsReadyCount.value <= 0 || draftsReadyCount.value < draftsPlannedTotal.value) return false;
  // пауза из-за частичного prepare / сбоя AI — не путать с паузой отправки
  if (/персонализац|частично|ollama|черновик/i.test(pauseReason.value)) return false;
  return true;
});

const canStart = computed(() => {
  return Boolean(activeCampaignId.value)
    && campaignStatus.value === 'ready'
    && draftsReadyCount.value > 0
    && draftsReadyCount.value >= draftsPlannedTotal.value
    && !preparing.value
    && !starting.value
    && !loading.value;
});

const userIds = computed(() => {
  const ids = String(route.query.ids || '')
    .split(',')
    .map(id => Number(id.trim()))
    .filter(id => Number.isInteger(id) && id > 0);

  return [...new Set(ids)];
});

const blockedIdSet = computed(() => new Set(recipientsSummary.value?.blockedIds || []));

const eligibleUserIds = computed(() => {
  return userIds.value.filter(id => !blockedIdSet.value.has(id));
});

const normalizedMaxRecipients = computed(() => {
  return Math.max(1, Math.min(Number(maxRecipients.value) || 1, Math.max(eligibleUserIds.value.length, 1)));
});

const recipientsToSend = computed(() => {
  return eligibleUserIds.value.slice(0, normalizedMaxRecipients.value);
});

const attachmentsTotalSize = computed(() => {
  return attachments.value.reduce((sum, file) => sum + (file.size || 0), 0);
});

const progressPercentage = computed(() => {
  if (!recipientsToSend.value.length) return 0;
  return Math.round((sentAttempts.value / recipientsToSend.value.length) * 100);
});

const prepareProgressPercentage = computed(() => {
  const total = Math.max(1, Number(draftsPlannedTotal.value) || 1);
  return Math.min(100, Math.round((Number(draftsReadyCount.value) / total) * 100));
});

const canSend = computed(() => {
  return canPrepare.value;
});

function statusLabel(status) {
  const map = {
    preparing: t('contacts.broadcast.history.statusPreparing'),
    ready: t('contacts.broadcast.history.statusReady'),
    queued: t('contacts.broadcast.history.statusQueued'),
    in_progress: t('contacts.broadcast.history.statusInProgress'),
    paused: t('contacts.broadcast.history.statusPaused'),
    completed: t('contacts.broadcast.history.statusCompleted'),
    interrupted: t('contacts.broadcast.history.statusInterrupted')
  };
  return map[status] || status;
}

function draftStatusLabel(status) {
  const map = {
    draft: t('contacts.broadcast.drafts.statusDraft'),
    sent: t('contacts.broadcast.drafts.statusSent'),
    error: t('contacts.broadcast.drafts.statusError'),
    bounced: t('contacts.broadcast.drafts.statusBounced'),
    preview: t('contacts.broadcast.agent.historyPreview')
  };
  return map[status] || status;
}

function contactChatTarget(userId, campaignId = activeCampaignId.value) {
  const query = {};
  const cid = Number(campaignId);
  if (Number.isInteger(cid) && cid > 0) {
    query.broadcastCampaignId = String(cid);
  }
  return {
    name: 'contact-details',
    params: { id: String(userId) },
    query
  };
}

function readLocalPreviewHistory() {
  try {
    const raw = sessionStorage.getItem(PREVIEW_HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function toHistoryItem(entry) {
  const body = String(entry.body || '').trim();
  return {
    userId: Number(entry.userId),
    campaignId: entry.campaignId || null,
    subject: entry.subject || '',
    body,
    bodyPreview: body.length > 160 ? `${body.slice(0, 160)}…` : body,
    status: entry.status || 'preview',
    statusLabel: draftStatusLabel(entry.status || 'preview'),
    at: entry.at || Date.now()
  };
}

async function loadGeneratedHistory() {
  historyLoading.value = true;
  try {
    const local = readLocalPreviewHistory().map(toHistoryItem);
    let serverDrafts = [];

    try {
      const response = await messagesService.getBroadcastAiAgentHistory({ limit: 50 });
      serverDrafts = (response?.drafts || [])
        .filter((d) => String(d.body || '').trim())
        .map((d) => toHistoryItem({
          userId: d.recipient_user_id,
          campaignId: d.campaign_id,
          subject: d.subject,
          body: d.body,
          status: d.status,
          at: d.updated_at ? new Date(d.updated_at).getTime() : Date.now()
        }));
    } catch (_) {
      if (activeCampaignId.value) {
        try {
          const response = await messagesService.getBroadcastDrafts(activeCampaignId.value);
          serverDrafts = (response?.drafts || [])
            .filter((d) => String(d.body || '').trim())
            .map((d) => toHistoryItem({
              userId: d.recipient_user_id,
              campaignId: activeCampaignId.value,
              subject: d.subject,
              body: d.body,
              status: d.status,
              at: d.updated_at ? new Date(d.updated_at).getTime() : Date.now()
            }));
        } catch {
          // ignore
        }
      }
    }

    // Черновики текущей кампании (пока готовится / после prepare)
    const campaignDrafts = (drafts.value || [])
      .filter((d) => String(d.body || '').trim())
      .map((d) => toHistoryItem({
        userId: d.recipient_user_id,
        campaignId: activeCampaignId.value,
        subject: d.subject,
        body: d.body,
        status: d.status,
        at: d.updated_at ? new Date(d.updated_at).getTime() : Date.now()
      }));

    const selected = new Set(userIds.value);
    const filterBySelected = selected.size > 0;
    const merged = new Map();
    [...campaignDrafts, ...serverDrafts, ...local].forEach((item) => {
      if (!item.userId) return;
      if (filterBySelected && !selected.has(item.userId)) return;
      const key = `${item.campaignId || 'local'}:${item.userId}`;
      const prev = merged.get(key);
      if (!prev || Number(item.at) >= Number(prev.at)) {
        merged.set(key, item);
      }
    });

    generatedHistory.value = [...merged.values()].sort((a, b) => Number(b.at) - Number(a.at));
  } finally {
    historyLoading.value = false;
  }
}

function stopPolling() {
  if (pollTimer.value) {
    clearInterval(pollTimer.value);
    pollTimer.value = null;
  }
}

function stopCampaignWatch() {
  stopPolling();
  if (campaignWs) {
    try {
      campaignWs.close();
    } catch (_) {
      // ignore
    }
    campaignWs = null;
  }
}

function mergeDraftFromWs(draft) {
  if (!draft?.recipient_user_id) return;
  const idx = drafts.value.findIndex(
    (d) => Number(d.recipient_user_id) === Number(draft.recipient_user_id)
  );
  const body = draft.body || draft.bodyPreview || (idx >= 0 ? drafts.value[idx].body : '') || '';
  const row = {
    ...(idx >= 0 ? drafts.value[idx] : {}),
    ...draft,
    body,
    campaign_id: draft.campaign_id || activeCampaignId.value
  };
  if (idx >= 0) {
    drafts.value.splice(idx, 1, row);
  } else {
    drafts.value = [...drafts.value, row];
  }
  loadGeneratedHistory();
}

function handleCampaignWsMessage(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return;
  }
  if (data?.type !== 'broadcast-campaign-updated') return;
  const campaignId = Number(data.campaign?.id);
  if (!activeCampaignId.value || campaignId !== Number(activeCampaignId.value)) return;

  if (data.draft) {
    mergeDraftFromWs(data.draft);
  }

  applyCampaignStatus({
    campaign: data.campaign,
    progress: data.progress
  });

  if (['ready', 'completed', 'interrupted', 'paused'].includes(data.campaign?.status)) {
    loadDrafts(campaignId);
  }
}

function ensureCampaignWs() {
  if (campaignWs && (campaignWs.readyState === WebSocket.OPEN || campaignWs.readyState === WebSocket.CONNECTING)) {
    return;
  }
  const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  campaignWs = new WebSocket(`${wsProtocol}://${window.location.host}/ws`);
  campaignWs.onmessage = (event) => handleCampaignWsMessage(event.data);
  campaignWs.onclose = () => {
    campaignWs = null;
    if (activeCampaignId.value && ['preparing', 'in_progress', 'paused'].includes(campaignStatus.value)) {
      setTimeout(() => ensureCampaignWs(), 2000);
    }
  };
  campaignWs.onerror = () => {
    // fallback poll останется как страховка
  };
}

function applyCampaignStatus(data) {
  const campaign = data?.campaign;
  const progress = data?.progress;
  if (!campaign || !progress) {
    return;
  }

  campaignStatus.value = campaign.status;
  pauseReason.value = campaign.pause_reason || '';
  sentAttempts.value = progress.processed;
  currentUserId.value = progress.currentRecipientId;
  if (progress.draftsReady != null) {
    serverDraftsReady.value = Number(progress.draftsReady) || 0;
  }

  if (campaign.status === 'preparing' || campaign.status === 'ready' || campaign.status === 'paused') {
    plannedRecipientsCount.value = Number(
      campaign.planned_recipients
      || progress.draftsTotal
      || plannedRecipientsCount.value
      || 0
    );
  }

  if (campaign.status === 'ready' && preparing.value) {
    stopCampaignWatch();
    preparing.value = false;
    loading.value = false;
    loadDrafts(campaign.id);
    ElMessage.success(t('contacts.broadcast.drafts.prepared', {
      count: Number(progress.draftsReady || campaign.drafts_ready_count || drafts.value.length)
    }));
    return;
  }

  if (campaign.status === 'paused' && preparing.value) {
    stopCampaignWatch();
    preparing.value = false;
    loading.value = false;
    loadDrafts(campaign.id);
    ElMessage.warning(
      campaign.pause_reason || t('contacts.broadcast.drafts.preparePartial')
    );
    return;
  }

  if (campaign.status === 'interrupted' && preparing.value) {
    stopCampaignWatch();
    preparing.value = false;
    loading.value = false;
    loadDrafts(campaign.id);
    ElMessage.error(
      campaign.pause_reason || t('contacts.broadcast.drafts.prepareError')
    );
    return;
  }

  if (['completed', 'interrupted'].includes(campaign.status) && !preparing.value) {
    // interrupted после ручного Stop — сбрасываем сессию; после prepare оставляем id (см. выше)
    if (campaign.status === 'interrupted' && draftsReadyCount.value < draftsPlannedTotal.value) {
      stopCampaignWatch();
      loading.value = false;
      return;
    }
    stopCampaignWatch();
    loading.value = false;
    preparing.value = false;
    activeCampaignId.value = null;
    plannedRecipientsCount.value = 0;
    clearCampaignSession();
    result.value = {
      successCount: progress.successCount,
      errorCount: progress.errorCount,
      totalCount: progress.total,
      skippedCount: Number(campaign.skipped_count || 0),
      campaignId: campaign.id
    };

    if (campaign.status === 'completed' && progress.errorCount > 0) {
      ElMessage.warning(t('contacts.broadcast.completedWithErrors', { count: progress.errorCount }));
    } else if (campaign.status === 'completed') {
      ElMessage.success(t('contacts.broadcast.successSentFull'));
    } else {
      ElMessage.info(t('contacts.broadcast.interruptedNotice'));
    }
    loadGeneratedHistory();
  }
}

async function refreshCampaignStatus() {
  if (!activeCampaignId.value || pollInFlight.value) {
    return;
  }

  pollInFlight.value = true;
  try {
    const data = await messagesService.getBroadcastCampaignStatus(activeCampaignId.value);
    applyCampaignStatus(data);
    if (data?.campaign?.status === 'preparing'
      || data?.campaign?.status === 'ready'
      || data?.campaign?.status === 'paused') {
      await loadDrafts(activeCampaignId.value);
    }
  } catch (error) {
    console.error('[BroadcastCreateView] Failed to poll campaign status:', error);
  } finally {
    pollInFlight.value = false;
  }
}

function startCampaignWatch(campaignId, { preparingMode = false } = {}) {
  activeCampaignId.value = campaignId;
  loading.value = true;
  if (preparingMode) {
    preparing.value = true;
    campaignStatus.value = 'preparing';
  }
  stopCampaignWatch();
  ensureCampaignWs();
  refreshCampaignStatus();
  // Редкий HTTP fallback, если WS недоступен / событие потеряно
  pollTimer.value = setInterval(refreshCampaignStatus, FALLBACK_POLL_MS);
}

function startPolling(campaignId) {
  startCampaignWatch(campaignId, { preparingMode: false });
}

function startPreparePolling(campaignId) {
  startCampaignWatch(campaignId, { preparingMode: true });
}

onBeforeUnmount(() => {
  stopCampaignWatch();
});

watch(warmupMode, (enabled) => {
  if (enabled) {
    delaySeconds.value = Math.max(Number(delaySeconds.value) || 0, 60);
    maxRecipients.value = Math.min(20, Math.max(eligibleUserIds.value.length, 1));
  }
});

watch([subject, message], () => {
  sessionStorage.setItem('broadcastTemplateSubject', subject.value || '');
  sessionStorage.setItem('broadcastTemplateBody', message.value || '');
});

watch(activeCampaignId, (id) => {
  if (id) {
    sessionStorage.setItem('broadcastActiveCampaignId', String(id));
  }
});

watch(userIds, async (ids) => {
  if (!ids.length) {
    recipientsSummary.value = null;
    generatedHistory.value = [];
    return;
  }

  maxRecipients.value = Math.min(Number(maxRecipients.value) || ids.length, ids.length);

  try {
    const data = await messagesService.getBroadcastRecipientsSummary(ids);
    recipientsSummary.value = data.summary || null;
    const eligibleCount = ids.filter(id => !(data.summary?.blockedIds || []).includes(id)).length;
    maxRecipients.value = Math.min(Number(maxRecipients.value) || eligibleCount, Math.max(eligibleCount, 1));
  } catch (error) {
    recipientsSummary.value = null;
    console.error('[BroadcastCreateView] Failed to load recipients summary:', error);
  }

  // Восстанавливаем активную кампанию только если eligible ids совпадают с сохранёнными
  if (!activeCampaignId.value) {
    const storedId = Number(sessionStorage.getItem('broadcastActiveCampaignId'));
    const storedRecipients = String(sessionStorage.getItem('broadcastRecipientIds') || '')
      .split(',')
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (sameIdSet(eligibleUserIds.value, storedRecipients)
      && Number.isInteger(storedId)
      && storedId > 0) {
      activeCampaignId.value = storedId;
      try {
        const data = await messagesService.getBroadcastCampaignStatus(storedId);
        applyCampaignStatus(data);
        hydrateFormFromCampaign(data?.campaign);
        await loadDrafts(storedId);
        const st = data?.campaign?.status;
        if (['preparing', 'in_progress', 'paused'].includes(st)) {
          startCampaignWatch(storedId, { preparingMode: st === 'preparing' });
        }
      } catch {
        // ignore
      }
    }
  }

  await loadGeneratedHistory();
}, { immediate: true });

function hydrateFormFromCampaign(campaign) {
  if (!campaign) return;
  if (campaign.subject) {
    subject.value = String(campaign.subject);
  }
  const body = campaign.message_body || campaign.message_preview;
  if (body) {
    message.value = String(body);
  }
  if (Array.isArray(campaign.schedule_days) && campaign.schedule_days.length) {
    scheduleDays.value = campaign.schedule_days.map((d) => Number(d)).filter((d) => d >= 1 && d <= 7);
  }
  if (campaign.schedule_hour_start != null) {
    scheduleHourStart.value = Number(campaign.schedule_hour_start);
  }
  if (campaign.schedule_hour_end != null) {
    scheduleHourEnd.value = Number(campaign.schedule_hour_end);
  }
  if (campaign.schedule_timezone) {
    scheduleTimezone.value = String(campaign.schedule_timezone);
  }
  if (campaign.delay_seconds != null) {
    const n = Number(campaign.delay_seconds);
    if (Number.isFinite(n)) delaySeconds.value = n;
  }
  if (campaign.max_recipients != null) {
    const n = Number(campaign.max_recipients);
    if (Number.isFinite(n) && n > 0) maxRecipients.value = n;
  }
  if (campaign.warmup_mode != null) {
    warmupMode.value = Boolean(campaign.warmup_mode);
  }
  if (campaign.ai_personalize != null) {
    aiPersonalize.value = Boolean(campaign.ai_personalize);
  }
  if (campaign.planned_recipients != null) {
    plannedRecipientsCount.value = Number(campaign.planned_recipients) || plannedRecipientsCount.value;
  }
}

function loadTemplateFromStorage() {
  const storedSubject = sessionStorage.getItem('broadcastTemplateSubject');
  const storedBody = sessionStorage.getItem('broadcastTemplateBody');
  if (storedSubject != null && !subject.value) subject.value = storedSubject;
  if (storedBody != null && !message.value) message.value = storedBody;
}

async function loadAiAgentState() {
  try {
    const response = await messagesService.getBroadcastAiAgentSettings();
    aiAgentEnabled.value = Boolean(response?.settings?.enabled);
    if (!aiAgentEnabled.value) {
      aiPersonalize.value = false;
    }
  } catch {
    aiAgentEnabled.value = false;
  }
}

onMounted(() => {
  loadTemplateFromStorage();
  loadAiAgentState();
});

async function rePrepareDrafts() {
  if (!canRePrepare.value || !activeCampaignId.value) return;
  preparing.value = true;
  loading.value = true;
  campaignStatus.value = 'preparing';
  try {
    await messagesService.prepareBroadcastCampaign(activeCampaignId.value, {
      useAi: aiPersonalize.value
    });
    startPreparePolling(activeCampaignId.value);
    ElMessage.info(t('contacts.broadcast.drafts.preparing'));
  } catch (error) {
    preparing.value = false;
    loading.value = false;
    ElMessage.error(error?.response?.data?.error || error?.message || t('contacts.broadcast.drafts.prepareError'));
  }
}

function goBack() {
  sessionStorage.removeItem('broadcastActiveCampaignId');
  sessionStorage.removeItem('broadcastRecipientIds');
  router.push({ name: 'contacts-list' });
}

function applyTemplate({ subject: nextSubject, message: nextMessage }) {
  subject.value = nextSubject;
  message.value = nextMessage;
}

function openFilePicker() {
  fileInputRef.value?.click();
}

function onFilesSelected(event) {
  const files = Array.from(event.target.files || []);
  attachments.value = [...attachments.value, ...files];
  event.target.value = '';
}

function removeAttachment(index) {
  attachments.value.splice(index, 1);
}

function formatFileSize(size) {
  if (!size) return t('common.fileSize.zero');
  if (size < 1024) return `${size} ${t('common.fileSize.bytes')}`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} ${t('common.fileSize.kb')}`;
  return `${(size / (1024 * 1024)).toFixed(1)} ${t('common.fileSize.mb')}`;
}

async function pauseCampaign() {
  if (!activeCampaignId.value) return;
  actionLoading.value = true;
  try {
    await messagesService.pauseBroadcastCampaign(activeCampaignId.value);
    await refreshCampaignStatus();
    ElMessage.success(t('contacts.broadcast.pausedNotice'));
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.broadcast.pauseError'));
  } finally {
    actionLoading.value = false;
  }
}

async function resumeCampaign() {
  if (!activeCampaignId.value) return;
  actionLoading.value = true;
  try {
    await messagesService.resumeBroadcastCampaign(activeCampaignId.value);
    await refreshCampaignStatus();
    ElMessage.success(t('contacts.broadcast.resumedNotice'));
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.broadcast.resumeError'));
  } finally {
    actionLoading.value = false;
  }
}

async function stopCampaign() {
  if (!activeCampaignId.value) return;

  try {
    await ElMessageBox.confirm(
      t('contacts.broadcast.confirmStop'),
      t('contacts.broadcast.stop'),
      { type: 'warning' }
    );
  } catch {
    return;
  }

  actionLoading.value = true;
  try {
    await messagesService.interruptBroadcastCampaign(activeCampaignId.value);
    await refreshCampaignStatus();
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.broadcast.stopError'));
  } finally {
    actionLoading.value = false;
  }
}

async function loadDrafts(campaignId = activeCampaignId.value) {
  if (!campaignId) {
    drafts.value = [];
    await loadGeneratedHistory();
    return;
  }
  try {
    const response = await messagesService.getBroadcastDrafts(campaignId);
    drafts.value = response?.drafts || [];
  } catch (error) {
    // Не обнуляем список mid-prepare при временной ошибке сети
    console.error('[BroadcastCreateView] Failed to load drafts:', error);
  }
  await loadGeneratedHistory();
}

async function prepareDrafts() {
  if (!canPrepare.value) return;

  preparing.value = true;
  loading.value = true;
  result.value = null;
  campaignStatus.value = 'preparing';

  try {
    const campaignResponse = await messagesService.createBroadcastCampaign({
      subject: subject.value.trim(),
      message: message.value.trim(),
      recipientIds: eligibleUserIds.value,
      warmupMode: warmupMode.value,
      delaySeconds: delaySeconds.value,
      maxRecipients: normalizedMaxRecipients.value,
      attachments: attachments.value,
      autoPrepare: true,
      aiPersonalize: aiPersonalize.value,
      scheduleDays: scheduleDays.value,
      scheduleHourStart: scheduleHourStart.value,
      scheduleHourEnd: scheduleHourEnd.value,
      scheduleTimezone: scheduleTimezone.value
    });

    const campaignId = campaignResponse?.campaign?.id;
    if (!campaignId) {
      throw new Error(t('contacts.broadcast.campaignCreateError'));
    }

    activeCampaignId.value = campaignId;
    campaignStatus.value = campaignResponse?.campaign?.status || 'preparing';
    plannedRecipientsCount.value = Number(
      campaignResponse?.campaign?.planned_recipients
      || campaignResponse?.prepare?.total
      || recipientsToSend.value.length
    ) || recipientsToSend.value.length;
    sessionStorage.setItem('broadcastActiveCampaignId', String(campaignId));
    sessionStorage.setItem('broadcastRecipientIds', String(eligibleUserIds.value.join(',')));

    // Prepare идёт на сервере в фоне — UI только поллит прогресс (без HTTP 499)
    if (campaignResponse?.prepare?.async || campaignStatus.value === 'preparing') {
      ElMessage.info(t('contacts.broadcast.drafts.preparing'));
      startPreparePolling(campaignId);
      return;
    }

    await loadDrafts(campaignId);
    preparing.value = false;
    loading.value = false;
    ElMessage.success(t('contacts.broadcast.drafts.prepared', {
      count: campaignResponse?.prepare?.prepared || drafts.value.length
    }));
  } catch (error) {
    campaignStatus.value = '';
    activeCampaignId.value = null;
    plannedRecipientsCount.value = 0;
    preparing.value = false;
    loading.value = false;
    ElMessage.error(error?.response?.data?.error || error?.message || t('contacts.broadcast.drafts.prepareError'));
  }
}

async function startBroadcast() {
  if (!canStart.value) return;

  starting.value = true;
  loading.value = true;
  result.value = null;
  sentAttempts.value = 0;
  currentUserId.value = null;

  try {
    await messagesService.startBroadcastCampaign(activeCampaignId.value);
    campaignStatus.value = 'in_progress';
    startPolling(activeCampaignId.value);
    ElMessage.success(t('contacts.broadcast.startedNotice'));
  } catch (error) {
    loading.value = false;
    ElMessage.error(error?.response?.data?.error || error?.response?.data?.details || t('contacts.broadcast.campaignCreateError'));
  } finally {
    starting.value = false;
  }
}

async function sendBroadcast() {
  return prepareDrafts();
}
</script>

<style scoped>
.broadcast-section-header h1 {
  margin: 0 0 8px;
  font-size: 1.8rem;
}

.broadcast-section-header p {
  margin: 0 0 20px;
  color: #606266;
}

.broadcast-alert {
  margin-bottom: 20px;
}

.broadcast-form {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.08);
  padding: 24px;
}

.template-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.attachments-box {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.file-input {
  display: none;
}

.attachments-hint,
.field-hint {
  color: #909399;
  font-size: 0.95rem;
}

.field-hint {
  margin-left: 10px;
}

.attachments-list {
  width: 100%;
  margin-top: 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.attachment-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid #ebeef5;
}

.attachment-item:last-child {
  border-bottom: 0;
}

.delivery-settings {
  margin-top: 4px;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  margin-bottom: 16px;
}

.ai-personalize-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  margin: 0 0 16px;
}

.ai-settings-link {
  color: #409eff;
  text-decoration: none;
  font-size: 0.95rem;
}

.ai-settings-link:hover {
  text-decoration: underline;
}

.drafts-section {
  margin-top: 24px;
}

.history-section {
  margin-top: 24px;
}

.history-heading-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.history-hint {
  margin: 0 0 12px;
  color: #606266;
}

.history-empty {
  margin: 12px 0 0;
  color: #909399;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.history-item {
  display: block;
  padding: 12px 14px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  background: #fafafa;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.history-item:hover {
  border-color: #c6e2ff;
  background: #f5f9ff;
}

.history-item-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.history-id {
  font-weight: 600;
  color: #303133;
}

.history-status {
  color: #909399;
  font-size: 0.9rem;
}

.history-subject {
  font-weight: 500;
  margin-bottom: 4px;
}

.history-body {
  color: #606266;
  font-size: 0.95rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}

.history-open {
  margin-top: 8px;
  color: #409eff;
  font-size: 0.9rem;
}

.drafts-count {
  color: #606266;
  font-size: 0.95rem;
}

.drafts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.draft-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
}

.draft-meta {
  display: flex;
  gap: 12px;
  color: #606266;
}

.draft-status {
  color: #909399;
}

.draft-link {
  color: #409eff;
  text-decoration: none;
  white-space: nowrap;
}

.draft-link:hover {
  text-decoration: underline;
}

.section-heading h2 {
  margin: 0;
  font-size: 1.2rem;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.delivery-alert {
  margin-bottom: 12px;
}

.delivery-checklist {
  margin: 12px 0 0;
  padding-left: 20px;
  color: #606266;
  line-height: 1.6;
}

.send-progress {
  margin-top: 24px;
}

.progress-text {
  margin-bottom: 8px;
  color: #606266;
}

.status-line {
  margin: 8px 0 0;
  color: #909399;
  font-size: 0.95rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.result-card {
  margin-top: 20px;
}

.errors-list {
  color: #f56c6c;
}

@media (max-width: 700px) {
  .section-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .broadcast-form {
    padding: 16px;
  }

  .settings-grid {
    grid-template-columns: 1fr;
  }

  .form-actions {
    flex-direction: column-reverse;
  }
}
</style>
