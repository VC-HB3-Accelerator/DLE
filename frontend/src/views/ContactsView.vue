<template>
  <BaseLayout>
    <div class="contacts-header">
      <span>Контакты</span>
      <span v-if="newContacts.length" class="badge">+{{ newContacts.length }}</span>
    </div>
    <ContactTable :contacts="contacts" :new-contacts="newContacts" :new-messages="newMessages" @markNewAsRead="markContactsAsRead" 
      :markMessagesAsReadForUser="markMessagesAsReadForUser" :markContactAsRead="markContactAsRead" @close="goBack" />
  </BaseLayout>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import BaseLayout from '../components/BaseLayout.vue';
import ContactTable from '../components/ContactTable.vue';
import { useContactsAndMessagesWebSocket } from '../composables/useContactsWebSocket';

const {
  contacts, newContacts, newMessages,
  markContactsAsRead, markMessagesAsReadForUser, markContactAsRead
} = useContactsAndMessagesWebSocket();
const router = useRouter();

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