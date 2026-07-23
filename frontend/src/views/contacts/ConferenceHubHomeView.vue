<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Список multi-конференций + автосоздание из ?ids= при bulk-выборе.
-->

<template>
  <div class="hub-home" v-loading="loading">
    <el-alert type="info" :closable="false" show-icon class="hub-alert">
      <template #title>{{ t('contacts.conference.hub.hint') }}</template>
    </el-alert>

    <div class="hub-actions">
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

async function createFromQueryIds() {
  const ids = parseIds(route.query.ids);
  if (ids.length < 2) return false;
  if (ids.length > 3) {
    ElMessage.warning(t('contacts.conference.bulk.maxThree'));
    return false;
  }
  const data = await conferenceService.createMultiSession(ids, {
    title: t('contacts.conference.hub.defaultTitle', { count: ids.length }),
    notify_email: true,
    notify_telegram: false
  });
  const sid = data.session?.id;
  if (!sid) throw new Error('no session');
  const n = data.notifications?.notified;
  if (n != null) {
    ElMessage.success(t('contacts.conference.hub.notified', { count: n }));
  }
  await router.replace({ name: 'hub-conference', params: { sessionId: String(sid) } });
  return true;
}

async function loadList() {
  loading.value = true;
  try {
    const data = await conferenceService.listMultiSessions();
    sessions.value = data.sessions || [];
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.hub.loadError'));
  } finally {
    loading.value = false;
  }
}

function openSession(id) {
  router.push({ name: 'hub-conference', params: { sessionId: String(id) } });
}

onMounted(async () => {
  loading.value = true;
  try {
    if (route.query.ids) {
      const created = await createFromQueryIds();
      if (created) return;
    }
    await loadList();
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.hub.createError'));
    await loadList();
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.hub-alert {
  margin-bottom: 16px;
}

.hub-actions {
  margin-bottom: 12px;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.session-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--color-border, #dcdfe6);
  border-radius: var(--block-radius, 8px);
  background: var(--color-white, #fff);
  cursor: pointer;
}

.session-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.session-id {
  margin-left: 6px;
  font-weight: 400;
  color: var(--color-grey, #606266);
  font-size: 0.85rem;
}

.session-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  color: var(--color-grey, #606266);
  font-size: 0.85rem;
}
</style>
