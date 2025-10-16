<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

<template>
  <BaseLayout>
    <div class="contacts-header">
      <span>Контакты</span>
      <span v-if="newContacts.length" class="badge">+{{ newContacts.length }}</span>
    </div>
    <!-- Таблица контактов для всех пользователей -->
    <ContactTable 
      :contacts="contacts" 
      :new-contacts="newContacts" 
      :new-messages="newMessages" 
      @markNewAsRead="markMessagesAsRead" 
      :markMessagesAsReadForUser="markMessagesAsReadForUser" 
      :markContactAsRead="markContactAsRead" 
      @close="goBack" 
    />
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import BaseLayout from '../components/BaseLayout.vue';
import ContactTable from '../components/ContactTable.vue';
import { useContactsAndMessagesWebSocket } from '../composables/useContactsWebSocket';
import { useAuthContext } from '@/composables/useAuth';
import { usePermissions } from '@/composables/usePermissions';

const {
  contacts, newContacts, newMessages,
  markMessagesAsRead, markMessagesAsReadForUser, markContactAsRead, fetchContacts, clearContactsData
} = useContactsAndMessagesWebSocket();
const router = useRouter();
const auth = useAuthContext();
const { canViewContacts } = usePermissions();

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

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push({ name: 'crm' });
  }
}
</script>

<style scoped>
.contacts-header {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 24px;
}
.badge {
  background: #dc3545;
  color: #fff;
  border-radius: 10px;
  padding: 2px 8px;
  font-size: 0.95em;
  margin-left: 7px;
}

</style> 