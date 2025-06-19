<template>
  <div class="contact-table-modal">
    <div class="contact-table-header">
      <h2>Контакты</h2>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>
    <div class="filters-panel">
      <input v-model="filterName" placeholder="Имя" />
      <input v-model="filterEmail" placeholder="Email" />
      <input v-model="filterTelegram" placeholder="Telegram" />
      <input v-model="filterWallet" placeholder="Кошелек" />
      <input v-model="filterDateFrom" type="date" placeholder="Дата от" />
      <input v-model="filterDateTo" type="date" placeholder="Дата до" />
      <label class="checkbox-label">
        <input type="checkbox" v-model="filterOnlyNewMessages" /> Только с новыми сообщениями
      </label>
    </div>
    <table class="contact-table">
      <thead>
        <tr>
          <th>Имя</th>
          <th>Email</th>
          <th>Telegram</th>
          <th>Кошелек</th>
          <th>Дата создания</th>
          <th>Действие</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="contact in filteredContactsArray" :key="contact.id" :class="{ 'new-contact-row': newIds.includes(contact.id) }">
          <td>{{ contact.name || '-' }}</td>
          <td>{{ contact.email || '-' }}</td>
          <td>{{ contact.telegram || '-' }}</td>
          <td>{{ contact.wallet || '-' }}</td>
          <td>{{ contact.created_at ? new Date(contact.created_at).toLocaleString() : '-' }}</td>
          <td>
            <span v-if="newMsgUserIds.includes(String(contact.id))" class="new-msg-icon" title="Новое сообщение">✉️</span>
            <button class="details-btn" @click="showDetails(contact)">Подробнее</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { defineProps, computed, ref } from 'vue';
import { useRouter } from 'vue-router';
const props = defineProps({
  contacts: { type: Array, default: () => [] },
  newContacts: { type: Array, default: () => [] },
  newMessages: { type: Array, default: () => [] },
  markMessagesAsReadForUser: { type: Function, default: null },
  markContactAsRead: { type: Function, default: null }
});
const contactsArray = computed(() => Array.from(props.contacts || []));
const newIds = computed(() => props.newContacts.map(c => c.id));
const newMsgUserIds = computed(() => props.newMessages.map(m => String(m.user_id)));
const router = useRouter();

// Фильтры
const filterName = ref('');
const filterEmail = ref('');
const filterTelegram = ref('');
const filterWallet = ref('');
const filterDateFrom = ref('');
const filterDateTo = ref('');
const filterOnlyNewMessages = ref(false);

const filteredContactsArray = computed(() => {
  return contactsArray.value.filter(contact => {
    const nameMatch = !filterName.value || (contact.name || '').toLowerCase().includes(filterName.value.toLowerCase());
    const emailMatch = !filterEmail.value || (contact.email || '').toLowerCase().includes(filterEmail.value.toLowerCase());
    const telegramMatch = !filterTelegram.value || (contact.telegram || '').toLowerCase().includes(filterTelegram.value.toLowerCase());
    const walletMatch = !filterWallet.value || (contact.wallet || '').toLowerCase().includes(filterWallet.value.toLowerCase());
    let dateFromMatch = true, dateToMatch = true;
    if (filterDateFrom.value && contact.created_at) {
      dateFromMatch = new Date(contact.created_at) >= new Date(filterDateFrom.value);
    }
    if (filterDateTo.value && contact.created_at) {
      dateToMatch = new Date(contact.created_at) <= new Date(filterDateTo.value);
    }
    const newMsgMatch = !filterOnlyNewMessages.value || newMsgUserIds.value.includes(String(contact.id));
    return nameMatch && emailMatch && telegramMatch && walletMatch && dateFromMatch && dateToMatch && newMsgMatch;
  });
});

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}
async function showDetails(contact) {
  if (props.markContactAsRead) {
    await props.markContactAsRead(contact.id);
  }
  if (props.markMessagesAsReadForUser) {
    props.markMessagesAsReadForUser(contact.id);
  }
  router.push({ name: 'contact-details', params: { id: contact.id } });
}
</script>

<style scoped>
.contact-table-modal {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.12);
  padding: 32px 24px 24px 24px;
  width: 100%;
  margin-top: 40px;
  position: relative;
  overflow-x: auto;
}
.contact-table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.close-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #bbb;
  transition: color 0.2s;
}
.close-btn:hover {
  color: #333;
}
.contact-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  font-size: 1.05rem;
}
.contact-table thead th {
  position: sticky;
  top: 0;
  background: #f5f7fa;
  font-weight: 700;
  padding: 14px 12px;
  border-bottom: 2px solid #e5e7eb;
  z-index: 2;
}
.contact-table tbody tr {
  transition: background 0.18s;
}
.contact-table tbody tr:nth-child(even) {
  background: #f8fafc;
}
.contact-table tbody tr:hover {
  background: #e6f7ff;
}
.contact-table td {
  padding: 12px 12px;
  border-bottom: 1px solid #f0f0f0;
  vertical-align: middle;
  word-break: break-word;
}
.contact-table th:first-child, .contact-table td:first-child {
  border-top-left-radius: 8px;
}
.contact-table th:last-child, .contact-table td:last-child {
  border-top-right-radius: 8px;
}
@media (max-width: 700px) {
  .contact-table-modal {
    padding: 12px 2px;
    max-width: 100vw;
  }
  .contact-table th, .contact-table td {
    padding: 8px 4px;
    font-size: 0.95rem;
  }
  .contact-table-header h2 {
    font-size: 1.1rem;
  }
}
.details-btn {
  background: #17a2b8;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  cursor: pointer;
  font-size: 0.98rem;
  transition: background 0.2s;
}
.details-btn:hover {
  background: #138496;
}
.new-contact-row {
  background: #e6ffe6 !important;
  transition: background 0.3s;
}
.filters-panel {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
  align-items: center;
}
.filters-panel input {
  padding: 6px 10px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  font-size: 1em;
  min-width: 110px;
}
.filters-panel input[type="checkbox"] {
  margin-right: 4px;
}
.checkbox-label {
  display: flex;
  align-items: center;
  font-size: 0.98em;
  user-select: none;
}
.new-msg-icon {
  color: #ff9800;
  font-size: 1.2em;
  margin-left: 4px;
}
</style> 