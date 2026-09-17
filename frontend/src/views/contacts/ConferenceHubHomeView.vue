<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Список multi-конференций. Создание — только через Календарь (TZ_CALL_SYSTEM).
-->

<template>
  <div class="hub-home" v-loading="loading">
    <el-alert type="info" :closable="false" show-icon class="hub-alert">
      <template #title>{{ t('contacts.conference.hub.hintRedirect') }}</template>
    </el-alert>

    <div class="hub-actions">
      <el-button type="primary" @click="goPersonalCalls">{{ t('contacts.personalCalls') }}</el-button>
      <el-button :disabled="loading" @click="loadList">{{ t('common.refresh') }}</el-button>
    </div>

    <el-empty v-if="!sessions.length" :description="t('contacts.conference.hub.empty')" />

    <div v-else class="session-list">
      <div
        v-for="item in sessions"
        :key="item.id"
        class="session-row"
        @click="openSession(item.id)"
      >
        <div class="session-main">
          <div class="session-title">
            {{ item.title || t('contacts.conference.live.untitled') }}
            <span class="session-id">#{{ item.id }}</span>
          </div>
          <div class="session-meta">
            <el-tag size="small">{{ t(`contacts.conference.status.${item.status}`) }}</el-tag>
            <span>{{ t('contacts.conference.hub.participantsCount', { count: item.participant_count || 0 }) }}</span>
            <span>{{ item.guest_language }} / {{ item.host_language }}</span>
          </div>
        </div>
        <el-button type="primary" size="small" @click.stop="openSession(item.id)">
          {{ t('contacts.conference.hub.open') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import conferenceService from '@/services/conferenceService';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const loading = ref(false);
const sessions = ref([]);

function parseIds(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function goPersonalCalls() {
  router.push({ name: 'personal-calls' });
}

function openSession(id) {
  router.push({ name: 'hub-conference', params: { sessionId: String(id) } });
}

async function loadList() {
  loading.value = true;
  try {
    const data = await conferenceService.listMultiSessions();
    sessions.value = data.sessions || [];
  } catch (e) {
    sessions.value = [];
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.hub.loadError'));
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  const ids = parseIds(route.query.ids);
  if (ids.length >= 1) {
    // Старый silent create убран: всегда через календарь
    await router.replace({
      name: 'contacts-calls-calendar',
      query: { ids: ids.slice(0, 3).join(',') }
    });
    return;
  }
  await loadList();
});
</script>

<style scoped>
.hub-home {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.hub-alert {
  margin: 0;
}

.hub-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--block-radius);
  background: var(--color-white);
  cursor: pointer;
}

.session-title {
  font-weight: 600;
}

.session-id {
  margin-left: 6px;
  color: var(--color-grey);
  font-weight: 400;
}

.session-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
  color: var(--color-grey);
  font-size: var(--font-size-sm);
}
</style>
