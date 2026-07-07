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
      <el-button :loading="loading" @click="loadHistory">{{ t('common.refresh') }}</el-button>
    </div>

    <el-card v-loading="loading" class="history-card" shadow="never">
      <el-table
        v-if="campaigns.length"
        :data="campaigns"
        row-key="id"
        class="history-table"
        @row-click="openDetails"
      >
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
        <p><strong>{{ t('contacts.broadcast.subject') }}:</strong> {{ selectedCampaign.subject }}</p>
        <p><strong>{{ t('contacts.broadcast.history.date') }}:</strong> {{ formatTime(selectedCampaign.started_at) }}</p>
        <p><strong>{{ t('contacts.broadcast.history.recipients') }}:</strong> {{ selectedCampaign.success_count }}/{{ selectedCampaign.planned_recipients }}</p>
        <p v-if="emailOpens">
          <strong>{{ t('contacts.broadcast.analytics.emailOpens') }}:</strong>
          {{ emailOpens.openedEmails }}/{{ emailOpens.trackedEmails }}
          ({{ emailOpens.openRate }}%)
        </p>
        <p v-if="selectedCampaign.message_preview"><strong>{{ t('contacts.broadcast.message') }}:</strong></p>
        <p v-if="selectedCampaign.message_preview" class="message-preview">{{ selectedCampaign.message_preview }}</p>

        <h3>{{ t('contacts.broadcast.history.deliveries') }}</h3>
        <div v-if="detailsLoading" class="details-loading">{{ t('common.loading') }}</div>
        <ul v-else-if="deliveries.length" class="deliveries-list">
          <li v-for="delivery in deliveries" :key="delivery.id">
            <div class="delivery-row">
              <span>{{ t('contacts.broadcast.history.recipientId', { id: delivery.recipient_user_id }) }}</span>
              <div class="delivery-tags">
                <el-tag :type="delivery.status === 'sent' ? 'success' : 'danger'" size="small">
                  {{ delivery.status === 'sent' ? t('contacts.broadcast.history.sent') : t('contacts.broadcast.history.failed') }}
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
            <p v-if="delivery.error_message" class="delivery-error">{{ delivery.error_message }}</p>
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
import { ElMessage } from 'element-plus';
import messagesService from '@/services/messagesService.js';
import { formatTime } from '@/utils/helpers.js';

const { t } = useI18n();

const loading = ref(false);
const campaigns = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = 20;
const detailsVisible = ref(false);
const detailsLoading = ref(false);
const selectedCampaign = ref(null);
const deliveries = ref([]);
const emailOpens = ref(null);

function statusTagType(status) {
  if (status === 'completed') return 'success';
  if (status === 'in_progress') return 'warning';
  return 'info';
}

function statusLabel(status) {
  if (status === 'completed') return t('contacts.broadcast.history.statusCompleted');
  if (status === 'in_progress') return t('contacts.broadcast.history.statusInProgress');
  return status;
}

async function loadHistory() {
  loading.value = true;
  try {
    const offset = (currentPage.value - 1) * pageSize;
    const data = await messagesService.getBroadcastHistory({ limit: pageSize, offset });
    campaigns.value = data.campaigns || [];
    total.value = data.total || 0;
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.broadcast.history.loadError'));
  } finally {
    loading.value = false;
  }
}

async function openDetails(row) {
  selectedCampaign.value = row;
  detailsVisible.value = true;
  detailsLoading.value = true;
  deliveries.value = [];
  emailOpens.value = null;

  try {
    const data = await messagesService.getBroadcastCampaignDetails(row.id);
    selectedCampaign.value = data.campaign || row;
    deliveries.value = data.deliveries || [];
    emailOpens.value = data.emailOpens || null;
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.broadcast.history.detailsError'));
  } finally {
    detailsLoading.value = false;
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
  justify-content: flex-end;
  margin-bottom: 12px;
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
