<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <nav class="conference-nav">
    <router-link
      v-for="item in visibleNavItems"
      :key="item.name"
      :to="{ name: item.name, params: { id: contactId } }"
      class="conference-nav-link"
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
import { usePermissions } from '@/composables/usePermissions';

const { t } = useI18n();
const route = useRoute();
const { isEditor } = usePermissions();

const contactId = computed(() => route.params.id);

const navItems = [
  { name: 'contact-conference', labelKey: 'contacts.conference.nav.settings' },
  { name: 'contact-conference-agent', labelKey: 'contacts.conference.nav.agent', editorOnly: true },
];

const visibleNavItems = computed(() =>
  navItems.filter((item) => !item.editorOnly || isEditor.value)
);
</script>

<style scoped>
.conference-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.conference-nav-link {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: var(--block-radius, 8px);
  border: 1px solid var(--color-border, #dcdfe6);
  background: var(--color-white, #fff);
  color: var(--color-grey, #606266);
  text-decoration: none;
  font-size: var(--font-size-md, 0.95rem);
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.conference-nav-link:hover {
  border-color: var(--color-primary, #409eff);
  color: var(--color-primary, #409eff);
}

.conference-nav-link.is-active {
  background: var(--color-primary, #409eff);
  border-color: var(--color-primary, #409eff);
  color: #fff;
}
</style>
