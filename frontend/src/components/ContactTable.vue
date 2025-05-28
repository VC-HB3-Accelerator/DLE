<template>
  <div class="contact-table-modal">
    <div class="contact-table-header">
      <h2>Контакты</h2>
      <button class="close-btn" @click="$emit('close')">×</button>
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
        <tr v-for="contact in contacts" :key="contact.id">
          <td>{{ contact.name || '-' }}</td>
          <td>{{ contact.email || '-' }}</td>
          <td>{{ contact.telegram || '-' }}</td>
          <td>{{ contact.wallet || '-' }}</td>
          <td>{{ formatDate(contact.created_at) }}</td>
          <td>
            <button class="details-btn" @click="showDetails(contact)">Подробнее</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
const props = defineProps({
  contacts: { type: Array, required: true }
});
const emit = defineEmits(['show-details']);
function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}
function showDetails(contact) {
  emit('show-details', contact);
}
</script>

<style scoped>
.contact-table-modal {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.12);
  padding: 32px 24px 24px 24px;
  max-width: 950px;
  margin: 40px auto;
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
</style> 