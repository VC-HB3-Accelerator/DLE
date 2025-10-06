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
    <ContactTable v-if="canRead" :contacts="contacts" :new-contacts="newContacts" :new-messages="newMessages" @markNewAsRead="markMessagesAsRead" 
      :markMessagesAsReadForUser="markMessagesAsReadForUser" :markContactAsRead="markContactAsRead" @close="goBack" />
    
    <!-- Таблица-заглушка для обычных пользователей -->
    <div v-else class="contact-table-placeholder">
      <div class="contact-table-header">
        <h2>Контакты</h2>
        <button class="close-btn" @click="goBack">×</button>
      </div>
      
      <!-- Форма фильтров (неактивная) -->
      <div class="filters-form-placeholder">
        <div class="form-row">
          <div class="form-item">
            <label>Поиск</label>
            <input type="text" disabled placeholder="Поиск по имени, email, telegram, кошельку" />
          </div>
          <div class="form-item">
            <label>Тип контакта</label>
            <select disabled>
              <option>Все</option>
            </select>
          </div>
          <div class="form-item">
            <label>Дата от</label>
            <input type="date" disabled />
          </div>
          <div class="form-item">
            <label>Дата до</label>
            <input type="date" disabled />
          </div>
          <button class="btn-disabled" disabled>Сбросить фильтры</button>
        </div>
      </div>
      
      <!-- Таблица с замаскированными данными -->
      <table class="contact-table-masked">
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
          <tr v-for="i in 3" :key="i">
            <td>••••••••••</td>
            <td>••••••••••••••••••••</td>
            <td>••••••••••••</td>
            <td>••••••••••••••••••••••••••••••••••</td>
            <td>••••••••••••••</td>
            <td>
              <button class="details-btn-disabled" disabled>Подробнее</button>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div class="access-notice">
        <i class="fas fa-info-circle"></i>
        Полные данные контактов доступны только администраторам
      </div>
    </div>
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
  markMessagesAsRead, markMessagesAsReadForUser, markContactAsRead
} = useContactsAndMessagesWebSocket();
const router = useRouter();
const auth = useAuthContext();
const { canRead } = usePermissions();

// Отладочная информация о правах доступа
onMounted(() => {
  console.log('[ContactsView] Permissions debug:', {
    canRead: canRead.value,
    isAdmin: auth.isAdmin?.value,
    userAccessLevel: auth.userAccessLevel?.value,
    userId: auth.userId?.value,
    address: auth.address?.value
  });
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

/* Стили для таблицы-заглушки */
.contact-table-placeholder {
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

.contact-table-header h2 {
  margin: 0;
  color: #333;
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

.filters-form-placeholder {
  margin-bottom: 24px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: end;
}

.form-item {
  display: flex;
  flex-direction: column;
  min-width: 150px;
}

.form-item label {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 4px;
}

.form-item input,
.form-item select {
  padding: 8px 12px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 0.9rem;
  background: #f8f9fa;
  color: #6c757d;
  cursor: not-allowed;
}

.btn-disabled {
  padding: 8px 16px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: #f8f9fa;
  color: #6c757d;
  cursor: not-allowed;
  height: fit-content;
}

.contact-table-masked {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.contact-table-masked th,
.contact-table-masked td {
  padding: 12px 8px;
  text-align: left;
  border-bottom: 1px solid #e9ecef;
}

.contact-table-masked th {
  background: #f8f9fa;
  font-weight: 600;
  color: #495057;
}

.contact-table-masked td {
  color: #adb5bd;
  font-family: monospace;
}

.details-btn-disabled {
  padding: 6px 12px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: #f8f9fa;
  color: #6c757d;
  font-size: 0.8rem;
  cursor: not-allowed;
}

.access-notice {
  margin-top: 20px;
  padding: 12px 16px;
  background: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 8px;
  color: #1976d2;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
}
</style> 