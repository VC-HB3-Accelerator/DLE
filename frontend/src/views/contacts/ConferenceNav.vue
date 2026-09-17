<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <nav class="conference-nav">
    <router-link
      v-for="item in visibleNavItems"
      :key="item.key"
      :to="item.to"
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
import { useAuthContext } from '@/composables/useAuth';
import { canAccessPath, ensureScreenAccessLoaded } from '@/composables/useScreenAccess.js';

const { t } = useI18n();
const route = useRoute();
const { isEditor, canPersonalCalls, canScheduleCalls } = usePermissions();
const { userId } = useAuthContext();
ensureScreenAccessLoaded();

const contactId = computed(() => route.params.id);
const isOwnCard = computed(() => (
  contactId.value != null
  && userId.value != null
  && String(contactId.value) === String(userId.value)
));

const visibleNavItems = computed(() => {
  const id = contactId.value;
  const items = [];

  if (canAccessPath(`/contacts/${id}/conference`)) {
    items.push({
      key: 'settings',
      labelKey: 'contacts.conference.nav.settings',
      to: { name: 'contact-conference', params: { id } }
    });
  }
  if (isEditor.value && canAccessPath(`/contacts/${id}/conference/agent`)) {
    items.push({
      key: 'agent',
      labelKey: 'contacts.conference.nav.agent',
      to: { name: 'contact-conference-agent', params: { id } }
    });
  }
  if (canPersonalCalls.value && canAccessPath('/personal-calls')) {
    items.push({
      key: 'personal-calls',
      labelKey: 'contacts.personalCalls',
      to: { name: 'personal-calls' }
    });
  }
  if (
    !isOwnCard.value
    && id
    && canScheduleCalls.value
    && canAccessPath('/contacts-list/calls/calendar')
  ) {
    items.push({
      key: 'book',
      labelKey: 'contacts.conference.nav.schedule',
      to: { name: 'contacts-calls-calendar', query: { ids: String(id) } }
    });
  } else if (
    isOwnCard.value
    && isEditor.value
    && canAccessPath('/conferences/schedule')
  ) {
    items.push({
      key: 'availability',
      labelKey: 'contacts.conference.nav.schedule',
      to: { name: 'hub-conference-schedule' }
    });
  }
  return items;
});
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
  border-radius: var(--block-radius);
  border: 1px solid var(--color-border);
  background: var(--color-white);
  color: var(--color-grey);
  text-decoration: none;
  font-size: var(--font-size-md);
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.conference-nav-link:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.conference-nav-link.is-active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-white);
}

@media (max-width: 768px) {
  .conference-nav, nav {
    max-width: 100%;
    flex-wrap: wrap;
    box-sizing: border-box;
  }
}
</style>
