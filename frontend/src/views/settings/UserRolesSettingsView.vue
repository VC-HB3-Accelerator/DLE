<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Хаб настроек ролей: вкладки «Сообщения» / «Страницы и блоки» / «Действия» / «ИИ-агент».
-->

<template>
  <AdminPageShell :show-close="true" fallback="/settings/security" variant="plain">
    <h2>{{ t('settings.security.roles.title') }}</h2>
    <p class="page-lead">{{ t('settings.security.roles.description') }}</p>

    <nav class="roles-tabs" aria-label="Role settings sections">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="roles-tabs__tab"
        :class="{ 'is-active': activeTab === tab.id }"
        @click="selectTab(tab.id)"
      >
        {{ t(tab.labelKey) }}
      </button>
    </nav>

    <UserRolesMessagesTab v-if="activeTab === 'messages'" />
    <UserRolesScreensTab v-else-if="activeTab === 'screens'" />
    <UserRolesActionsTab v-else-if="activeTab === 'actions'" />
    <UserRolesAiAgentTab v-else-if="activeTab === 'ai'" />
  </AdminPageShell>
</template>

<script setup>
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';
import UserRolesMessagesTab from '@/views/settings/UserRolesMessagesTab.vue';
import UserRolesScreensTab from '@/views/settings/UserRolesScreensTab.vue';
import UserRolesActionsTab from '@/views/settings/UserRolesActionsTab.vue';
import UserRolesAiAgentTab from '@/views/settings/UserRolesAiAgentTab.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const tabs = [
  { id: 'messages', labelKey: 'settings.security.roles.tabs.messages' },
  { id: 'screens', labelKey: 'settings.security.roles.tabs.screens' },
  { id: 'actions', labelKey: 'settings.security.roles.tabs.actions' },
  { id: 'ai', labelKey: 'settings.security.roles.tabs.ai' }
];

const TAB_IDS = new Set(tabs.map((tab) => tab.id));

function tabFromRoute() {
  const raw = String(route.query.tab || route.params.tab || '').trim().toLowerCase();
  if (raw === 'ai-agent' || raw === 'agent') return 'ai';
  if (TAB_IDS.has(raw)) return raw;
  // legacy nested paths
  const path = String(route.path || '');
  if (path.endsWith('/screens')) return 'screens';
  if (path.endsWith('/actions')) return 'actions';
  if (path.endsWith('/ai-agent')) return 'ai';
  if (path.endsWith('/messages')) return 'messages';
  return 'messages';
}

const activeTab = computed(() => tabFromRoute());

function selectTab(id) {
  if (!TAB_IDS.has(id)) return;
  router.replace({
    name: 'settings-security-roles',
    query: { ...route.query, tab: id }
  });
}

watch(
  () => route.fullPath,
  () => {
    const path = String(route.path || '').replace(/\/$/, '');
    if (
      path === '/settings/security/roles/messages'
      || path === '/settings/security/roles/screens'
      || path === '/settings/security/roles/actions'
      || path === '/settings/security/roles/ai-agent'
    ) {
      const tab = tabFromRoute();
      router.replace({ name: 'settings-security-roles', query: { ...route.query, tab } });
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.page-lead {
  margin: 0 0 1.25rem;
  color: #666;
  line-height: 1.5;
  max-width: 720px;
}

h2 {
  margin: 0 0 var(--spacing-md, 16px);
  padding-right: 2.5rem;
  color: var(--theme-text, #222);
}

.roles-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--color-border, #e9ecef);
  padding-bottom: 0.5rem;
}

.roles-tabs__tab {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px 8px 0 0;
  background: transparent;
  color: #64748b;
  font-weight: 500;
  font-size: 0.95rem;
  cursor: pointer;
}

.roles-tabs__tab:hover {
  color: var(--color-primary, #1a365d);
  background: color-mix(in srgb, var(--color-border, #e9ecef) 35%, transparent);
}

.roles-tabs__tab.is-active {
  color: var(--color-primary, #1a365d);
  background: #fff;
  box-shadow: inset 0 -2px 0 var(--color-primary, #1a365d);
}
</style>
