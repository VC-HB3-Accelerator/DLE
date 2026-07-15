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
      <h1>{{ t('contacts.broadcast.history.title') }}</h1>
      <p>{{ t('contacts.broadcast.history.description') }}</p>
    </div>

    <div class="history-toolbar">
      <div class="history-filters">
        <el-date-picker
          v-model="filterDateFrom"
          type="date"
          :placeholder="t('contacts.broadcast.history.dateFrom')"
          clearable
          class="history-filter-field"
          @change="onDateFilterChange"
        />
        <el-date-picker
          v-model="filterDateTo"
          type="date"
          :placeholder="t('contacts.broadcast.history.dateTo')"
          clearable
          class="history-filter-field"
          @change="onDateFilterChange"
        />
      </div>
      <div class="history-toolbar-actions">
      <el-button
        type="danger"
        :disabled="!selectedIds.length || deleting"
        :loading="deleting"
        @click="deleteSelected"
      >
        {{ t('contacts.broadcast.history.deleteSelected', { count: selectedIds.length }) }}
      </el-button>
      <el-button :loading="loading" @click="loadHistory">{{ t('common.refresh') }}</el-button>
      </div>
    </div>

    <el-card v-loading="loading" class="history-card" shadow="never">
      <el-table
        v-if="campaigns.length"
        ref="tableRef"
        :data="campaigns"
        row-key="id"
        class="history-table"
        @selection-change="handleSelectionChange"
        @row-click="openDetails"
      >
        <el-table-column type="selection" width="48" />
        <el-table-column prop="started_at" :label="t('contacts.broadcast.history.date')" min-width="160">
          <template #default="{ row }">
            {{ formatTime(row.started_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="subject" :label="t('contacts.broadcast.subject')" min-width="220" show-overflow-tooltip />
        <el-table-column :label="t('contacts.broadcast.history.recipients')" width="120" align="center">
          <template #default="{ row }">
            {{ row.success_count }}/{{ row.planned_recipients }}
          </template>
        </el-table-column>
        <el-table-column prop="error_count" :label="t('common.errors')" width="90" align="center" />
        <el-table-column prop="bounce_count" :label="t('contacts.broadcast.history.bounces')" width="90" align="center" />
        <el-table-column prop="skipped_count" :label="t('contacts.broadcast.history.skipped')" width="110" align="center" />
        <el-table-column :label="t('contacts.broadcast.analytics.opens')" width="100" align="center">
          <template #default="{ row }">
            {{ row.opened_emails || 0 }}/{{ row.tracked_emails || 0 }}
          </template>
        </el-table-column>
        <el-table-column :label="t('contacts.broadcast.history.status')" width="130">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>

      <p v-else-if="!loading" class="empty-state">{{ t('contacts.broadcast.history.empty') }}</p>

      <div v-if="total > pageSize" class="history-pagination">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="loadHistory"
        />
      </div>
    </el-card>

    <el-drawer
      v-model="detailsVisible"
      :title="t('contacts.broadcast.history.detailsTitle')"
      size="480px"
    >
      <div v-if="selectedCampaign" class="details-content">
        <div
          v-if="['in_progress', 'paused', 'queued'].includes(selectedCampaign.status)"
          class="details-actions"
          @click.stop
        >
          <el-button
            v-if="selectedCampaign.status === 'in_progress'"
            :disabled="actionLoading"
            @click.stop="pauseCampaign"
          >
            {{ t('contacts.broadcast.pause') }}
          </el-button>
          <el-button
            v-if="['paused', 'queued'].includes(selectedCampaign.status)"
            type="primary"
            :disabled="actionLoading"
            :loading="actionLoading"
            @click.stop="resumeCampaign"
          >
            {{ t('contacts.broadcast.resume') }}
          </el-button>
          <el-button
            type="danger"
            :disabled="actionLoading"
            @click.stop="stopCampaign"
          >
            {{ t('contacts.broadcast.stop') }}
          </el-button>
        </div>

        <p><strong>{{ t('contacts.broadcast.subject') }}:</strong> {{ selectedCampaign.subject }}</p>
        <p><strong>{{ t('contacts.broadcast.history.date') }}:</strong> {{ formatTime(selectedCampaign.started_at) }}</p>
        <p><strong>{{ t('contacts.broadcast.history.recipients') }}:</strong> {{ selectedCampaign.success_count }}/{{ selectedCampaign.planned_recipients }}</p>
        <p>
          <strong>{{ t('contacts.broadcast.history.status') }}:</strong>
          <el-tag :type="statusTagType(selectedCampaign.status)" size="small">
            {{ statusLabel(selectedCampaign.status) }}
          </el-tag>
        </p>
        <p v-if="selectedCampaign.bounce_count">
          <strong>{{ t('contacts.broadcast.history.bounces') }}:</strong> {{ selectedCampaign.bounce_count }}
        </p>
        <p v-if="emailOpens">
          <strong>{{ t('contacts.broadcast.analytics.emailOpens') }}:</strong>
          {{ emailOpens.openedEmails }}/{{ emailOpens.trackedEmails }}
          ({{ emailOpens.openRate }}%)
        </p>
        <p v-if="selectedCampaign.message_preview"><strong>{{ t('contacts.broadcast.message') }}:</strong></p>
        <p v-if="selectedCampaign.message_preview" class="message-preview">{{ selectedCampaign.message_preview }}</p>

        <h3>{{ t('contacts.broadcast.history.events') }}</h3>
        <div v-if="detailsLoading" class="details-loading">{{ t('common.loading') }}</div>
        <ul v-else-if="campaignEvents.length" class="events-list">
          <li v-for="event in campaignEvents" :key="event.id">
            <span class="event-time">{{ formatTime(event.created_at) }}</span>
            <span class="event-type">{{ eventLabel(event.event_type) }}</span>
            <span v-if="event.details?.reason" class="event-details">{{ event.details.reason }}</span>
          </li>
        </ul>
        <p v-else class="empty-state">{{ t('contacts.broadcast.history.noEvents') }}</p>

        <h3>{{ t('contacts.broadcast.history.deliveries') }}</h3>
        <div v-if="detailsLoading" class="details-loading">{{ t('common.loading') }}</div>
        <ul v-else-if="deliveries.length" class="deliveries-list">
          <li v-for="delivery in deliveries" :key="delivery.id">
            <div class="delivery-row">
              <span class="delivery-recipient">
                {{ formatRecipientLabel(delivery) }}
              </span>
              <div class="delivery-tags">
                <el-tag :type="deliveryTagType(delivery.status)" size="small">
                  {{ deliveryStatusLabel(delivery.status) }}
                </el-tag>
                <el-tag
                  v-if="delivery.open_count > 0"
                  type="info"
                  size="small"
                >
                  {{ t('contacts.broadcast.analytics.opened', { count: delivery.open_count }) }}
                </el-tag>
              </div>
            </div>
            <p v-if="formatDeliveryError(delivery)" class="delivery-error">{{ formatDeliveryError(delivery) }}</p>
          </li>
        </ul>
        <p v-else class="empty-state">{{ t('contacts.broadcast.history.noDeliveries') }}</p>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import messagesService from '@/services/messagesService.js';
import { formatTime } from '@/utils/helpers.js';

const { t } = useI18n();

const loading = ref(false);
const deleting = ref(false);
const actionLoading = ref(false);
const campaigns = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = 20;
const detailsVisible = ref(false);
const detailsLoading = ref(false);
const selectedCampaign = ref(null);
const deliveries = ref([]);
const campaignEvents = ref([]);
const emailOpens = ref(null);
const selectedIds = ref([]);
const tableRef = ref(null);
const filterDateFrom = ref('');
const filterDateTo = ref('');

function statusTagType(status) {
  if (status === 'completed') return 'success';
  if (status === 'in_progress') return 'warning';
  if (status === 'paused') return 'info';
  if (status === 'interrupted') return 'danger';
  if (status === 'queued') return 'info';
  return 'info';
}

function statusLabel(status) {
  const map = {
    completed: t('contacts.broadcast.history.statusCompleted'),
    in_progress: t('contacts.broadcast.history.statusInProgress'),
    queued: t('contacts.broadcast.history.statusQueued'),
    paused: t('contacts.broadcast.history.statusPaused'),
    interrupted: t('contacts.broadcast.history.statusInterrupted')
  };
  return map[status] || status;
}

function eventLabel(eventType) {
  const map = {
    started: t('contacts.broadcast.history.eventStarted'),
    paused: t('contacts.broadcast.history.eventPaused'),
    resumed: t('contacts.broadcast.history.eventResumed'),
    completed: t('contacts.broadcast.history.eventCompleted'),
    interrupted: t('contacts.broadcast.history.eventInterrupted')
  };
  return map[eventType] || eventType;
}

function formatRecipientLabel(delivery) {
  if (delivery.recipient_email) {
    return delivery.recipient_email;
  }
  return t('contacts.broadcast.history.recipientId', { id: delivery.recipient_user_id });
}

function deliveryTagType(status) {
  if (status === 'sent') return 'success';
  if (status === 'bounced') return 'warning';
  return 'danger';
}

function deliveryStatusLabel(status) {
  if (status === 'sent') return t('contacts.broadcast.history.sent');
  if (status === 'bounced') return t('contacts.broadcast.history.bounced');
  return t('contacts.broadcast.history.failed');
}

function formatDeliveryError(delivery) {
  const channelErrors = Array.isArray(delivery.channel_results)
    ? delivery.channel_results
      .filter(item => item?.status === 'error' && item?.error)
      .map(item => `${item.channel}: ${item.error}`)
    : [];

  const parts = [delivery.error_message, ...channelErrors].filter(Boolean);
  const uniqueParts = [...new Set(parts)];
  return uniqueParts.join(' — ');
}

function formatDateOnly(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function onDateFilterChange() {
  currentPage.value = 1;
  loadHistory();
}

async function loadHistory() {
  loading.value = true;
  try {
    const offset = (currentPage.value - 1) * pageSize;
    const params = { limit: pageSize, offset };
    if (filterDateFrom.value) params.dateFrom = formatDateOnly(filterDateFrom.value);
    if (filterDateTo.value) params.dateTo = formatDateOnly(filterDateTo.value);
    const data = await messagesService.getBroadcastHistory(params);
    campaigns.value = data.campaigns || [];
    total.value = data.total || 0;
    selectedIds.value = [];
    tableRef.value?.clearSelection?.();
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.broadcast.history.loadError'));
  } finally {
    loading.value = false;
  }
}

function handleSelectionChange(rows) {
  selectedIds.value = rows.map(row => row.id);
}

async function deleteSelected() {
  if (!selectedIds.value.length) {
    return;
  }

  try {
    await ElMessageBox.confirm(
      t('contacts.broadcast.history.confirmDelete', { count: selectedIds.value.length }),
      t('contacts.confirmDeleteTitle'),
      { type: 'warning' }
    );
  } catch {
    return;
  }

  deleting.value = true;
  try {
    const deletedIds = [...selectedIds.value];
    await messagesService.deleteBroadcastCampaigns(deletedIds);

    if (selectedCampaign.value && deletedIds.includes(selectedCampaign.value.id)) {
      detailsVisible.value = false;
      selectedCampaign.value = null;
      deliveries.value = [];
      campaignEvents.value = [];
      emailOpens.value = null;
    }

    ElMessage.success(t('contacts.broadcast.history.deleted', { count: deletedIds.length }));

    if (campaigns.value.length <= deletedIds.length && currentPage.value > 1) {
      currentPage.value -= 1;
    }

    await loadHistory();
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.broadcast.history.deleteError'));
  } finally {
    deleting.value = false;
  }
}

async function reloadDetails() {
  if (!selectedCampaign.value?.id) {
    return;
  }

  detailsLoading.value = true;
  try {
    const [detailsData, eventsData] = await Promise.all([
      messagesService.getBroadcastCampaignDetails(selectedCampaign.value.id),
      messagesService.getBroadcastCampaignEvents(selectedCampaign.value.id, { limit: 50 })
    ]);
    selectedCampaign.value = detailsData.campaign || selectedCampaign.value;
    deliveries.value = detailsData.deliveries || [];
    emailOpens.value = detailsData.emailOpens || null;
    campaignEvents.value = eventsData.events || [];

    const index = campaigns.value.findIndex(item => item.id === selectedCampaign.value.id);
    if (index !== -1) {
      campaigns.value[index] = { ...campaigns.value[index], ...selectedCampaign.value };
    }
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.broadcast.history.detailsError'));
  } finally {
    detailsLoading.value = false;
  }
}

async function openDetails(row) {
  selectedCampaign.value = row;
  detailsVisible.value = true;
  await reloadDetails();
}

async function pauseCampaign() {
  if (!selectedCampaign.value?.id) return;
  actionLoading.value = true;
  try {
    await messagesService.pauseBroadcastCampaign(selectedCampaign.value.id);
    await reloadDetails();
    await loadHistory();
    ElMessage.success(t('contacts.broadcast.pausedNotice'));
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.broadcast.pauseError'));
  } finally {
    actionLoading.value = false;
  }
}

async function resumeCampaign() {
  if (!selectedCampaign.value?.id) return;
  actionLoading.value = true;
  try {
    await messagesService.resumeBroadcastCampaign(selectedCampaign.value.id);
    await reloadDetails();
    await loadHistory();
    ElMessage.success(t('contacts.broadcast.resumedNotice'));
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.broadcast.resumeError'));
  } finally {
    actionLoading.value = false;
  }
}

async function stopCampaign() {
  if (!selectedCampaign.value?.id) return;

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
    await messagesService.interruptBroadcastCampaign(selectedCampaign.value.id);
    await reloadDetails();
    await loadHistory();
    ElMessage.info(t('contacts.broadcast.interruptedNotice'));
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.broadcast.stopError'));
  } finally {
    actionLoading.value = false;
  }
}

onMounted(loadHistory);
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

.history-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.history-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.history-filter-field {
  width: 180px;
}

.history-toolbar-actions {
  display: flex;
  gap: 12px;
  margin-left: auto;
}

.history-card {
  border-radius: 16px;
}

.history-table {
  width: 100%;
  cursor: pointer;
}

.empty-state {
  margin: 0;
  color: #909399;
  text-align: center;
  padding: 24px 0;
}

.history-pagination {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

.details-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.details-content p {
  margin: 0 0 12px;
  line-height: 1.5;
}

.message-preview {
  white-space: pre-wrap;
  color: #606266;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 12px;
}

.details-content h3 {
  margin: 20px 0 12px;
  font-size: 1rem;
}

.deliveries-list,
.events-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.events-list li {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 0;
  border-bottom: 1px solid #ebeef5;
}

.event-time {
  color: #909399;
  font-size: 0.9rem;
}

.event-type {
  font-weight: 600;
}

.event-details {
  color: #606266;
  font-size: 0.95rem;
}

.deliveries-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.deliveries-list li {
  border-bottom: 1px solid #ebeef5;
  padding: 10px 0;
}

.delivery-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.delivery-recipient {
  word-break: break-word;
}

.delivery-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.delivery-error {
  margin: 6px 0 0;
  color: #f56c6c;
  font-size: 0.9rem;
}

.details-loading {
  color: #909399;
}
</style>
