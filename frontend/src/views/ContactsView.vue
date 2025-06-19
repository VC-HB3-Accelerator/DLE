<template>
  <BaseLayout>
    <div class="contacts-tabs">
      <button :class="{active: tab==='all'}" @click="tab='all'">Все контакты</button>
      <button :class="{active: tab==='newContacts'}" @click="tab='newContacts'; markContactsAsRead()">
        Новые контакты
        <span v-if="newContacts.length" class="badge">{{ newContacts.length }}</span>
      </button>
      <button :class="{active: tab==='newMessages'}" @click="tab='newMessages'; markMessagesAsRead()">
        Новые сообщения
        <span v-if="newMessages.length" class="badge">{{ newMessages.length }}</span>
      </button>
    </div>
    <ContactTable v-if="tab==='all'" :contacts="contacts" />
    <ContactTable v-if="tab==='newContacts'" :contacts="newContacts" />
    <MessagesTable v-if="tab==='newMessages'" :messages="newMessages" />
  </BaseLayout>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import BaseLayout from '../components/BaseLayout.vue';
import ContactTable from '../components/ContactTable.vue';
import MessagesTable from '../components/MessagesTable.vue';
import { useContactsAndMessagesWebSocket } from '../composables/useContactsWebSocket';

const tab = ref('all');
const {
  contacts, newContacts, newMessages,
  markContactsAsRead, markMessagesAsRead
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
.contacts-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}
.contacts-tabs button {
  background: #f5f7fa;
  border: none;
  border-radius: 8px 8px 0 0;
  padding: 10px 22px;
  font-size: 1.08rem;
  cursor: pointer;
  position: relative;
  transition: background 0.18s, color 0.18s;
}
.contacts-tabs button.active {
  background: #fff;
  color: #17a2b8;
  font-weight: 600;
  box-shadow: 0 -2px 8px rgba(0,0,0,0.04);
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