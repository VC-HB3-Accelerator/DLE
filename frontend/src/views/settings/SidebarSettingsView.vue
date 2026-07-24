<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="sidebar-settings settings-panel">
    <button class="close-btn" type="button" @click="router.push('/settings')">×</button>
    <h2>{{ t('settings.sidebar.pageTitle') }}</h2>
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
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const router = useRouter();
</script>

<style scoped>
.sidebar-settings {
  position: relative;
  padding: var(--block-padding, 1.5rem);
  background-color: var(--color-light, #f8f9fa);
  border-radius: var(--radius-md, 12px);
  margin-top: var(--spacing-lg, 1.5rem);
}

.sidebar-settings__intro {
  margin: 0 0 1.25rem;
  color: #6c757d;
  line-height: 1.5;
  max-width: 720px;
}

.sidebar-settings__tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 0.5rem;
}

.sidebar-settings__tab {
  padding: 0.5rem 1rem;
  border-radius: 8px 8px 0 0;
  text-decoration: none;
  color: #6c757d;
  font-weight: 500;
  font-size: 0.95rem;
}

.sidebar-settings__tab:hover {
  color: var(--color-primary);
  background: rgba(0, 0, 0, 0.03);
}

.sidebar-settings__tab.is-active {
  color: var(--color-primary);
  background: #fff;
  box-shadow: inset 0 -2px 0 var(--color-primary);
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: transparent;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: #6c757d;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #343a40;
}
</style>
