<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Inbox «Личные звонки»: запланированные 1:1 и мульти (TZ_CALL_SYSTEM).
-->

<template>
  <BaseLayout>
    <div class="personal-calls-header page-with-close">
      <PageCloseButton :fallback="{ name: 'crm' }" />
      <span>{{ t('contacts.personalCalls') }}</span>
      <span v-if="calls.length > 0" class="badge">{{ calls.length }}</span>
    </div>

    <div v-if="isLoading" class="loading-container">
      <div class="loading">{{ t('contacts.calls.loading') }}</div>
    </div>

    <div v-else-if="calls.length === 0" class="empty-state">
      <p>{{ t('contacts.calls.empty') }}</p>
    </div>

    <div v-else class="calls-list">
      <div
        v-for="call in calls"
        :key="call.id"
        class="call-item"
      >
        <div class="call-info">
          <div class="call-title">{{ callTitle(call) }}</div>
          <div class="call-meta">
            <span class="call-kind">{{ kindLabel(call) }}</span>
            <span v-if="call.scheduled_at">{{ formatDate(call.scheduled_at) }}</span>
            <span>{{ t(`contacts.conference.status.${call.status}`) }}</span>
          </div>
        </div>
        <el-button
          type="primary"
          size="small"
          :loading="joiningId === call.id"
          @click="openCall(call)"
        >
          {{ call.status === 'live'
            ? t('contacts.conference.actions.connect')
            : t('contacts.calls.open') }}
        </el-button>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import BaseLayout from '@/components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import conferenceService from '@/services/conferenceService';
import websocketServiceModule from '@/services/websocketService';

const { t, locale } = useI18n();
const router = useRouter();
const { websocketService } = websocketServiceModule;

const isLoading = ref(true);
const calls = ref([]);
const joiningId = ref(null);
let reloadTimer = null;

function callTitle(call) {
  if (call.kind === 'multi') {
    return call.title || t('contacts.conference.live.untitled');
  }
  return call.peer_name || call.title || t('contacts.calls.oneToOne');
}

function kindLabel(call) {
  if (call.kind === 'multi') {
    return t('contacts.calls.kindMulti', { count: call.participant_count || 0 });
  }
  return t('contacts.calls.kindOneToOne');
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString(locale.value === 'en' ? 'en-US' : 'ru-RU');
  } catch {
    return String(value);
  }
}

async function loadCalls() {
  isLoading.value = true;
  try {
    const data = await conferenceService.listMyUpcomingCalls();
    calls.value = data.calls || [];
  } catch (e) {
    calls.value = [];
    ElMessage.error(e?.response?.data?.error || t('contacts.calls.loadError'));
  } finally {
    isLoading.value = false;
  }
}

function scheduleReload() {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => loadCalls(), 150);
}

async function openCall(call) {
  joiningId.value = call.id;
  try {
    if (call.my_role === 'host' || call.status === 'draft' || call.status === 'scheduled') {
      if (call.status === 'draft' || call.status === 'scheduled') {
        try {
          await conferenceService.startSession(call.id);
        } catch (_) {
          /* уже live или нет прав start — пробуем join/live */
        }
      }
      if (call.is_multi || call.kind === 'multi') {
        await router.push({
          name: 'hub-conference-live',
          params: { sessionId: String(call.id) }
        });
        return;
      }
      const contactId = call.contact_user_id || call.peer_id;
      await router.push({
        name: 'contact-conference-live',
        params: { id: String(contactId), sessionId: String(call.id) }
      });
      return;
    }

    const data = await conferenceService.joinSession(call.id);
    await router.push({
      name: 'conference-participant-live',
      params: { sessionId: String(data.session.id) }
    });
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.calls.openError'));
  } finally {
    joiningId.value = null;
  }
}

onMounted(() => {
  loadCalls();
  websocketService?.on?.('contacts-updated', scheduleReload);
  websocketService?.on?.('messages-updated', scheduleReload);
});

onUnmounted(() => {
  if (reloadTimer) clearTimeout(reloadTimer);
  websocketService?.off?.('contacts-updated', scheduleReload);
  websocketService?.off?.('messages-updated', scheduleReload);
});
</script>

<style scoped>
.personal-calls-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  padding: 0 6px;
  border-radius: var(--block-radius);
  background: var(--color-primary);
  color: var(--color-white);
  font-size: var(--font-size-sm);
}

.loading-container,
.empty-state {
  padding: 24px 0;
  color: var(--color-grey);
}

.calls-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.call-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--block-radius);
  background: var(--color-white);
}

.call-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.call-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--color-grey);
  font-size: var(--font-size-sm);
}

.call-kind {
  color: var(--color-primary);
}

@media (max-width: 768px) {
  .call-item {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
