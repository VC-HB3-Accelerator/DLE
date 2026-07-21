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
  <nav class="contact-details-nav">
    <router-link
      v-for="item in navItems"
      :key="item.name"
      :to="navTarget(item.name)"
      class="contact-details-nav-link"
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

const { t } = useI18n();
const route = useRoute();

const contactId = computed(() => route.params.id);

const navItems = [
  { name: 'contact-details', labelKey: 'contacts.details.nav.chat' },
  { name: 'contact-profile', labelKey: 'contacts.details.nav.profile' },
];

function navTarget(name) {
  const query = {};
  // Режим правки черновика рассылки не должен сбрасываться при переключении Чат/Профиль
  if (route.query.broadcastCampaignId) {
    query.broadcastCampaignId = route.query.broadcastCampaignId;
  }
  return {
    name,
    params: { id: contactId.value },
    query
  };
}
</script>

<style scoped>
.contact-details-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.contact-details-nav-link {
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

.contact-details-nav-link:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.contact-details-nav-link.is-active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-white);
}
</style>
