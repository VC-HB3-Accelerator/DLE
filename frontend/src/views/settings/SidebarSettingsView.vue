<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <AdminPageShell
    :title="t('settings.sidebar.pageTitle')"
    :show-close="true"
    fallback="/settings"
  >
    <p class="sidebar-settings__intro">{{ t('settings.sidebar.intro') }}</p>

    <nav class="sidebar-settings__tabs">
      <router-link
        :to="{ name: 'settings-sidebar-text' }"
        class="sidebar-settings__tab"
        active-class="is-active"
      >
        {{ t('settings.sidebar.tabs.text') }}
      </router-link>
      <router-link
        :to="{ name: 'settings-sidebar-languages' }"
        class="sidebar-settings__tab"
        active-class="is-active"
      >
        {{ t('settings.sidebar.tabs.languages') }}
      </router-link>
      <router-link
        :to="{ name: 'settings-sidebar-auth' }"
        class="sidebar-settings__tab"
        active-class="is-active"
      >
        {{ t('settings.sidebar.tabs.auth') }}
      </router-link>
      <router-link
        :to="{ name: 'settings-sidebar-buttons' }"
        class="sidebar-settings__tab"
        active-class="is-active"
      >
        {{ t('settings.sidebar.tabs.buttons') }}
      </router-link>
      <router-link
        :to="{ name: 'settings-sidebar-regions' }"
        class="sidebar-settings__tab"
        active-class="is-active"
      >
        {{ t('settings.sidebar.tabs.regions') }}
      </router-link>
    </nav>

    <router-view />
  </AdminPageShell>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';

const { t } = useI18n();
</script>

<style scoped>
.sidebar-settings__intro {
  margin: 0 0 1.25rem;
  color: var(--theme-text-muted);
  line-height: 1.5;
  max-width: 720px;
}

.sidebar-settings__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.5rem;
}

.sidebar-settings__tab {
  padding: 0.5rem 1rem;
  border-radius: 8px 8px 0 0;
  text-decoration: none;
  color: var(--theme-text-muted);
  font-weight: 500;
  font-size: 0.95rem;
}

.sidebar-settings__tab:hover {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-border) 35%, transparent);
}

.sidebar-settings__tab.is-active {
  color: var(--color-primary);
  background: var(--color-white);
  box-shadow: inset 0 -2px 0 var(--color-primary);
}
</style>
