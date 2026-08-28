<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Вкладки Management ↔ CRM (единый CSS).
-->

<template>
  <nav class="admin-section-tabs" aria-label="Section">
    <router-link
      v-if="canAccessPath('/management')"
      to="/management"
      class="admin-section-tabs__link"
      active-class="is-active"
    >
      {{ t('nav.management') }}
    </router-link>
    <router-link
      v-if="canAccessPath('/crm')"
      to="/crm"
      class="admin-section-tabs__link"
      active-class="is-active"
    >
      {{ t('nav.crm') }}
    </router-link>
  </nav>
</template>

<script setup>
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { canAccessPath, ensureScreenAccessLoaded } from '@/composables/useScreenAccess.js';

const { t } = useI18n();
onMounted(() => {
  ensureScreenAccessLoaded();
});
</script>

<style scoped>
.admin-section-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: var(--spacing-lg, 1rem);
}

.admin-section-tabs__link {
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

.admin-section-tabs__link:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.admin-section-tabs__link.is-active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-white);
}
</style>
