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
              :disabled="loading"
            />
          </div>

          <div class="settings-grid">
            <el-form-item :label="t('contacts.broadcast.delayBetween')">
              <el-input-number
                v-model="delaySeconds"
                :min="0"
                :max="600"
                :step="5"
                :disabled="loading"
              />
              <span class="field-hint">{{ t('contacts.broadcast.seconds') }}</span>
            </el-form-item>

            <el-form-item :label="t('contacts.broadcast.maxRecipients')">
              <el-input-number
                v-model="maxRecipients"
                :min="1"
                :max="Math.max(eligibleUserIds.length, 1)"
                :disabled="loading"
              />
              <span class="field-hint">{{ t('contacts.broadcast.willSend', { send: recipientsToSend.length, total: eligibleUserIds.length }) }}</span>
            </el-form-item>
          </div>

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

          <ul class="delivery-checklist">
            <li>{{ t('contacts.broadcast.checklist1') }}</li>
            <li>{{ t('contacts.broadcast.checklist2') }}</li>
            <li>{{ t('contacts.broadcast.checklist3') }}</li>
          </ul>
        </section>

        <div v-if="loading || activeCampaignId" class="send-progress">
          <div class="progress-text">
            {{ t('contacts.broadcast.sendingProgress', { current: sentAttempts, total: recipientsToSend.length }) }}
            <span v-if="currentUserId">{{ t('contacts.broadcast.currentId', { id: currentUserId }) }}</span>
          </div>
          <el-progress :percentage="progressPercentage" />
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
            v-if="activeCampaignId && campaignStatus === 'paused'"
            type="warning"
            :disabled="actionLoading"
            @click="resumeCampaign"
          >
            {{ t('contacts.broadcast.resume') }}
          </el-button>
          <el-button
            v-if="activeCampaignId && ['in_progress', 'paused', 'queued'].includes(campaignStatus)"
            type="danger"
            :disabled="actionLoading"
            @click="stopCampaign"
          >
            {{ t('contacts.broadcast.stop') }}
          </el-button>
          <el-button type="primary" :disabled="!canSend" :loading="loading && !activeCampaignId" @click="sendBroadcast">
            {{ t('contacts.broadcast.sendBroadcast') }}
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
import { computed, onBeforeUnmount, ref, watch } from 'vue';
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
const delaySeconds = ref(60);
const maxRecipients = ref(20);
const sentAttempts = ref(0);
const currentUserId = ref(null);
const templatesDialogVisible = ref(false);
const recipientsSummary = ref(null);
const activeCampaignId = ref(null);
const campaignStatus = ref('');
const pollTimer = ref(null);

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

const canSend = computed(() => {
  return recipientsToSend.value.length > 0
    && subject.value.trim()
    && message.value.trim()
    && !loading.value
    && !activeCampaignId.value;
});

function statusLabel(status) {
  const map = {
    queued: t('contacts.broadcast.history.statusQueued'),
    in_progress: t('contacts.broadcast.history.statusInProgress'),
    paused: t('contacts.broadcast.history.statusPaused'),
    completed: t('contacts.broadcast.history.statusCompleted'),
    interrupted: t('contacts.broadcast.history.statusInterrupted')
  };
  return map[status] || status;
}

function stopPolling() {
  if (pollTimer.value) {
    clearInterval(pollTimer.value);
    pollTimer.value = null;
  }
}

function applyCampaignStatus(data) {
  const campaign = data?.campaign;
  const progress = data?.progress;
  if (!campaign || !progress) {
    return;
  }

  campaignStatus.value = campaign.status;
  sentAttempts.value = progress.processed;
  currentUserId.value = progress.currentRecipientId;

  if (['completed', 'interrupted'].includes(campaign.status)) {
    stopPolling();
    loading.value = false;
    activeCampaignId.value = null;
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
  }
}

async function refreshCampaignStatus() {
  if (!activeCampaignId.value) {
    return;
  }

  try {
    const data = await messagesService.getBroadcastCampaignStatus(activeCampaignId.value);
    applyCampaignStatus(data);
  } catch (error) {
    console.error('[BroadcastCreateView] Failed to poll campaign status:', error);
  }
}

function startPolling(campaignId) {
  activeCampaignId.value = campaignId;
  loading.value = true;
  stopPolling();
  refreshCampaignStatus();
  pollTimer.value = setInterval(refreshCampaignStatus, 3000);
}

onBeforeUnmount(() => {
  stopPolling();
});

watch(warmupMode, (enabled) => {
  if (enabled) {
    delaySeconds.value = Math.max(Number(delaySeconds.value) || 0, 60);
    maxRecipients.value = Math.min(20, Math.max(eligibleUserIds.value.length, 1));
  }
});

watch(userIds, async (ids) => {
  if (!ids.length) {
    recipientsSummary.value = null;
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
}, { immediate: true });

function goBack() {
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

async function sendBroadcast() {
  if (!canSend.value) return;

  loading.value = true;
  result.value = null;
  sentAttempts.value = 0;
  currentUserId.value = null;
  campaignStatus.value = 'queued';

  try {
    const campaignResponse = await messagesService.createBroadcastCampaign({
      subject: subject.value.trim(),
      message: message.value.trim(),
      recipientIds: eligibleUserIds.value,
      warmupMode: warmupMode.value,
      delaySeconds: delaySeconds.value,
      maxRecipients: normalizedMaxRecipients.value,
      attachments: attachments.value,
      autoStart: true
    });

    const campaignId = campaignResponse?.campaign?.id;
    if (!campaignId) {
      throw new Error(t('contacts.broadcast.campaignCreateError'));
    }

    startPolling(campaignId);
    ElMessage.success(t('contacts.broadcast.startedNotice'));
  } catch (error) {
    loading.value = false;
    campaignStatus.value = '';
    ElMessage.error(error?.response?.data?.error || error?.message || t('contacts.broadcast.campaignCreateError'));
  }
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
