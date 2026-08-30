<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Вкладки Хостинг (`?tab=hosting`) ↔ Настройки (`?tab=settings`) на `/vds`.
-->

<template>
  <nav class="vds-section-tabs" aria-label="VDS">
    <router-link
      :to="{ name: 'vds-management', query: { tab: 'hosting' } }"
      class="vds-section-tabs__link"
      :class="{ 'is-active': isHosting }"
    >
      {{ t('vds.tabHosting') }}
    </router-link>
    <router-link
      :to="{ name: 'vds-management', query: { tab: 'settings' } }"
      class="vds-section-tabs__link"
      :class="{ 'is-active': isSettings }"
    >
      {{ t('vds.tabSettings') }}
    </router-link>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const route = useRoute();

const isSettings = computed(() => String(route.query.tab || '') === 'settings');
const isHosting = computed(() => !isSettings.value);
</script>

<style scoped>
.vds-section-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: var(--spacing-lg, 1rem);
}

.vds-section-tabs__link {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: var(--block-radius, 8px);
  border: 1px solid var(--color-border);
  background: var(--color-white);
  color: var(--color-grey);
  text-decoration: none;
  font-size: var(--font-size-md, 1rem);
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.vds-section-tabs__link:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.vds-section-tabs__link.is-active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-white);
}
</style>
