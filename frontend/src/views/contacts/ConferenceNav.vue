<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <nav v-if="visibleNavItems.length" class="conference-nav">
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
  const { isEditor } = usePermissions();
  const { userId } = useAuthContext();
  ensureScreenAccessLoaded();

  const contactId = computed(() => route.params.id);
  const isOwnCard = computed(
    () =>
      contactId.value != null &&
      userId.value != null &&
      String(contactId.value) === String(userId.value)
  );

  const visibleNavItems = computed(() => {
    const items = [];
    // Часы приёма / слоты — только на своей карточке
    if (
      isOwnCard.value &&
      isEditor.value &&
      canAccessPath('/conferences/schedule')
    ) {
      items.push({
        key: 'availability',
        labelKey: 'contacts.conference.nav.availability',
        to: { name: 'hub-conference-schedule' },
      });
    }
    return items;
  });
</script>

<style scoped>
  .conference-nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
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
    transition:
      background 0.2s,
      border-color 0.2s,
      color 0.2s;
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
    .conference-nav,
    nav {
      max-width: 100%;
      flex-wrap: wrap;
      box-sizing: border-box;
    }
  }
</style>
