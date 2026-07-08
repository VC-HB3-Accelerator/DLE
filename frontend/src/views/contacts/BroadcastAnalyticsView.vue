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
      <h1>{{ t('contacts.broadcast.analytics.title') }}</h1>
      <p>{{ t('contacts.broadcast.analytics.description') }}</p>
    </div>

    <div class="analytics-toolbar">
      <el-button :loading="loading" @click="loadAnalytics">{{ t('common.refresh') }}</el-button>
    </div>

    <div v-loading="loading" class="analytics-grid">
      <el-card class="stat-card" shadow="never">
        <div class="stat-value">{{ totals.campaigns }}</div>
        <div class="stat-label">{{ t('contacts.broadcast.analytics.campaigns') }}</div>
      </el-card>
      <el-card class="stat-card" shadow="never">
        <div class="stat-value success">{{ totals.success }}</div>
        <div class="stat-label">{{ t('contacts.broadcast.analytics.successful') }}</div>
      </el-card>
      <el-card class="stat-card" shadow="never">
        <div class="stat-value danger">{{ totals.errors }}</div>
        <div class="stat-label">{{ t('contacts.broadcast.analytics.failed') }}</div>
      </el-card>
      <el-card class="stat-card" shadow="never">
        <div class="stat-value warning">{{ totals.bounces }}</div>
        <div class="stat-label">{{ t('contacts.broadcast.analytics.bounces') }}</div>
      </el-card>
      <el-card class="stat-card" shadow="never">
        <div class="stat-value">{{ totals.successRate }}%</div>
        <div class="stat-label">{{ t('contacts.broadcast.analytics.successRate') }}</div>
      </el-card>
      <el-card class="stat-card" shadow="never">
        <div class="stat-value">{{ emailOpens.openRate }}%</div>
        <div class="stat-label">{{ t('contacts.broadcast.analytics.openRate') }}</div>
      </el-card>
      <el-card class="stat-card" shadow="never">
        <div class="stat-value">{{ emailOpens.openedEmails }}/{{ emailOpens.trackedEmails }}</div>
        <div class="stat-label">{{ t('contacts.broadcast.analytics.emailOpens') }}</div>
      </el-card>
    </div>

    <div class="analytics-panels">
      <el-card class="panel-card" shadow="never">
        <template #header>{{ t('contacts.broadcast.analytics.byChannel') }}</template>
        <el-table v-if="byChannel.length" :data="byChannel" size="small">
          <el-table-column prop="channel" :label="t('contacts.broadcast.analytics.channel')" />
          <el-table-column prop="total" :label="t('contacts.broadcast.analytics.attempts')" width="100" align="center" />
          <el-table-column prop="success_count" :label="t('contacts.broadcast.analytics.successful')" width="100" align="center" />
          <el-table-column prop="error_count" :label="t('common.errors')" width="100" align="center" />
        </el-table>
        <p v-else class="empty-state">{{ t('contacts.broadcast.analytics.noChannelData') }}</p>
      </el-card>

      <el-card class="panel-card" shadow="never">
        <template #header>{{ t('contacts.broadcast.analytics.last30Days') }}</template>
        <ul v-if="daily.length" class="daily-list">
          <li v-for="item in daily" :key="item.day">
            <span>{{ formatDay(item.day) }}</span>
            <span>{{ t('contacts.broadcast.analytics.daySummary', { campaigns: item.campaigns_count, success: item.success_count, errors: item.error_count, bounces: item.bounce_count || 0 }) }}</span>
          </li>
        </ul>
        <p v-else class="empty-state">{{ t('contacts.broadcast.analytics.noDailyData') }}</p>
      </el-card>
    </div>

    <el-card class="panel-card recent-card" shadow="never">
      <template #header>{{ t('contacts.broadcast.analytics.recentCampaigns') }}</template>
      <el-table v-if="recentCampaigns.length" :data="recentCampaigns" size="small">
        <el-table-column prop="started_at" :label="t('contacts.broadcast.history.date')" min-width="150">
          <template #default="{ row }">
            {{ formatTime(row.started_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="subject" :label="t('contacts.broadcast.subject')" min-width="200" show-overflow-tooltip />
        <el-table-column :label="t('contacts.broadcast.history.recipients')" width="120" align="center">
          <template #default="{ row }">
            {{ row.success_count }}/{{ row.planned_recipients }}
          </template>
        </el-table-column>
        <el-table-column prop="error_count" :label="t('common.errors')" width="90" align="center" />
        <el-table-column prop="bounce_count" :label="t('contacts.broadcast.analytics.bounces')" width="90" align="center" />
        <el-table-column :label="t('contacts.broadcast.analytics.opens')" width="100" align="center">
          <template #default="{ row }">
            {{ row.opened_emails || 0 }}/{{ row.tracked_emails || 0 }}
          </template>
        </el-table-column>
      </el-table>
      <p v-else class="empty-state">{{ t('contacts.broadcast.analytics.noRecentData') }}</p>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import messagesService from '@/services/messagesService.js';
import { formatTime } from '@/utils/helpers.js';

const { t } = useI18n();

const loading = ref(false);
const totals = reactive({
  campaigns: 0,
  success: 0,
  errors: 0,
  bounces: 0,
  planned: 0,
  skipped: 0,
  successRate: 0
});
const emailOpens = reactive({
  trackedEmails: 0,
  openedEmails: 0,
  totalOpens: 0,
  openRate: 0
});
const byChannel = ref([]);
const daily = ref([]);
const recentCampaigns = ref([]);

function formatDay(day) {
  if (!day) return '';
  return new Date(day).toLocaleDateString();
}

async function loadAnalytics() {
  loading.value = true;
  try {
    const data = await messagesService.getBroadcastAnalytics();
    const analytics = data.analytics || {};
    Object.assign(totals, analytics.totals || {});
    Object.assign(emailOpens, analytics.emailOpens || {});
    byChannel.value = analytics.byChannel || [];
    daily.value = analytics.daily || [];
    recentCampaigns.value = analytics.recentCampaigns || [];
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.broadcast.analytics.loadError'));
  } finally {
    loading.value = false;
  }
}

onMounted(loadAnalytics);
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

.analytics-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.analytics-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  border-radius: 16px;
  text-align: center;
}

.stat-value {
  font-size: 1.8rem;
  font-weight: 700;
  color: #303133;
}

.stat-value.success {
  color: #67c23a;
}

.stat-value.danger {
  color: #f56c6c;
}

.stat-value.warning {
  color: #e6a23c;
}

.stat-label {
  margin-top: 6px;
  color: #909399;
}

.analytics-panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.panel-card,
.recent-card {
  border-radius: 16px;
}

.empty-state {
  margin: 0;
  color: #909399;
  text-align: center;
  padding: 12px 0;
}

.daily-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.daily-list li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #ebeef5;
  font-size: 0.95rem;
}

.daily-list li:last-child {
  border-bottom: 0;
}

@media (max-width: 900px) {
  .analytics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .analytics-panels {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .analytics-grid {
    grid-template-columns: 1fr;
  }

  .daily-list li {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
