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
  <nav class="broadcast-nav">
    <router-link
      v-for="item in navItems"
      :key="item.name"
      :to="getNavTarget(item.name)"
      class="broadcast-nav-link"
      active-class="is-active"
    >
      {{ t(item.labelKey) }}
    </router-link>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

const BROADCAST_IDS_STORAGE_KEY = 'broadcastRecipientIds';

const { t } = useI18n();
const route = useRoute();

const navItems = [
  { name: 'contacts-broadcast', labelKey: 'contacts.broadcast.nav.create' },
  { name: 'contacts-broadcast-agent', labelKey: 'contacts.broadcast.nav.agent' },
  { name: 'contacts-broadcast-analytics', labelKey: 'contacts.broadcast.nav.analytics' },
  { name: 'contacts-broadcast-history', labelKey: 'contacts.broadcast.nav.history' },
];

const preservedQuery = computed(() => {
  const ids = route.query.ids || sessionStorage.getItem(BROADCAST_IDS_STORAGE_KEY);
  return ids ? { ids: String(ids) } : {};
});

function getNavTarget(routeName) {
  const query = preservedQuery.value;
  if (Object.keys(query).length) {
    return { name: routeName, query };
  }

  return { name: routeName };
}
</script>

<style scoped>
.broadcast-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.broadcast-nav-link {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: var(--block-radius);
  border: 1px solid var(--color-border);
  background: var(--color-white);
  color: var(--color-grey);
  text-decoration: none;
  font-size: var(--font-size-md);
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.broadcast-nav-link:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.broadcast-nav-link.is-active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-white);
}

/* TZ package C */
@media (max-width: 768px) {
  .broadcast-nav, nav {
    max-width: 100%;
    box-sizing: border-box;
    flex-wrap: wrap;
  }
}
</style>
