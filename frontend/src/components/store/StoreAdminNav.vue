<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Вкладки Заказы (`/crm/store`) ↔ Каталог (`/content/store`) ↔ Настройки (`/content/store/settings`).
-->

<template>
  <nav class="store-admin-nav" aria-label="Store admin">
    <router-link
      v-if="canAccessPath('/crm/store')"
      :to="{ name: 'crm-store' }"
      class="store-admin-nav__link"
      :class="{ 'is-active': isOrders }"
    >
      {{ t('store.admin.tabOrders') }}
    </router-link>
    <router-link
      v-if="canSeeCatalog"
      :to="{ name: 'content-store' }"
      class="store-admin-nav__link"
      :class="{ 'is-active': isCatalog }"
    >
      {{ t('store.admin.tabCatalog') }}
    </router-link>
    <router-link
      v-if="canSeeSettings"
      :to="{ name: 'content-store-settings' }"
      class="store-admin-nav__link"
      :class="{ 'is-active': isSettings }"
    >
      {{ t('store.admin.tabSettings') }}
    </router-link>
  </nav>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { usePermissions } from '../../composables/usePermissions';
import { PERMISSIONS } from '../../composables/permissions';
import { canAccessPath, ensureScreenAccessLoaded } from '@/composables/useScreenAccess.js';

const { t } = useI18n();
const route = useRoute();
const { hasPermission } = usePermissions();

const canSeeCatalog = computed(() =>
  hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS) && canAccessPath('/content/store')
);
const canSeeSettings = computed(() =>
  hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS) && canAccessPath('/content/store/settings')
);

const storePath = computed(() => String(route.path || ''));
const isOrders = computed(() => route.name === 'crm-store');
const isSettings = computed(() => storePath.value.startsWith('/content/store/settings'));
const isCatalog = computed(() =>
  storePath.value.startsWith('/content/store') && !isSettings.value
);

onMounted(() => {
  ensureScreenAccessLoaded();
});
</script>

<style scoped>
.store-admin-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: var(--spacing-lg, 1rem);
}

.store-admin-nav__link {
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

.store-admin-nav__link:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.store-admin-nav__link.is-active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-white);
}
</style>
