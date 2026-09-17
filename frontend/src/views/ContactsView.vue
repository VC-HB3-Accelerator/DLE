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
  <BaseLayout>
    <AdminPageShell :show-close="true" :fallback="{ name: 'crm' }" variant="panel">
      <h1 class="contacts-page-header">
        {{ t('contacts.title') }}
        <span v-if="profileOwnerId" class="contacts-owner-hint">#{{ profileOwnerId }}</span>
        <span v-if="newContacts.length" class="badge">+{{ newContacts.length }}</span>
      </h1>
      <ContactTable
        :contacts="contacts"
        :new-contacts="newContacts"
        :new-messages="newMessages"
        @markNewAsRead="markMessagesAsRead"
        :markMessagesAsReadForUser="markMessagesAsReadForUser"
        :markContactAsRead="markContactAsRead"
      />
    </AdminPageShell>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import BaseLayout from '../components/BaseLayout.vue';
import AdminPageShell from '../components/admin/AdminPageShell.vue';
import ContactTable from '../components/ContactTable.vue';
import { useContactsAndMessagesWebSocket } from '../composables/useContactsWebSocket';
import { useAuthContext } from '@/composables/useAuth';
import { usePermissions } from '@/composables/usePermissions';

const { t } = useI18n();
const route = useRoute();
const {
  contacts, newContacts, newMessages,
  markMessagesAsRead, markMessagesAsReadForUser, markContactAsRead, fetchContacts, clearContactsData
} = useContactsAndMessagesWebSocket();
const auth = useAuthContext();
const { canViewContacts } = usePermissions();

const profileOwnerId = computed(() => {
  const raw = route.query.owner;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
});

// Отладочная информация о правах доступа
onMounted(() => {
  console.log('[ContactsView] Permissions debug:', {
    canViewContacts: canViewContacts.value,
    userAccessLevel: auth.userAccessLevel,
    userId: auth.userId,
    address: auth.address
  });
  
  // Логика обновления данных централизована в useContactsWebSocket
});

// Отслеживаем изменения прав доступа
watch(canViewContacts, (newValue, oldValue) => {
  console.log('[ContactsView] canViewContacts changed:', { newValue, oldValue });
  if (newValue && !oldValue) {
    // Если права появились, загружаем данные
    fetchContacts();
  }
});

</script>

<style scoped>
.contacts-page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 20px;
  padding-right: 2.5rem;
  font-size: var(--font-size-xxl);
  font-weight: 600;
  color: var(--color-dark);
}

.contacts-owner-hint {
  font-size: var(--font-size-md);
  font-weight: 500;
  color: var(--color-grey);
}

.badge {
  background: var(--color-danger);
  color: var(--color-white);
  border-radius: 10px;
  padding: 2px 8px;
  font-size: 0.55em;
  font-weight: 600;
  vertical-align: middle;
}

@media (max-width: 768px) {
  .contacts-page-header {
    font-size: var(--font-size-xl);
    margin-bottom: 16px;
  }
}
</style> 