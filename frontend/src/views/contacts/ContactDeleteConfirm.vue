<template>
  <div class="delete-confirm-page">
    <h2>Подтверждение удаления контакта</h2>
    <div v-if="isLoading">Загрузка...</div>
    <div v-else-if="!contact">Контакт не найден</div>
    <div v-else class="contact-info">
      <p><strong>Имя:</strong> {{ contact.name || '-' }}</p>
      <p><strong>Email:</strong> {{ contact.email || '-' }}</p>
      <p><strong>Telegram:</strong> {{ contact.telegram || '-' }}</p>
      <p><strong>Кошелек:</strong> {{ contact.wallet || '-' }}</p>
      <p><strong>Дата создания:</strong> {{ formatDate(contact.created_at) }}</p>
      <div class="confirm-actions">
        <button v-if="isAdmin" class="delete-btn" @click="deleteContact" :disabled="isDeleting">Удалить</button>
        <button class="cancel-btn" @click="cancelDelete" :disabled="isDeleting">Отменить</button>
      </div>
      <div v-if="!isAdmin" class="empty-table-placeholder">Нет прав для удаления контакта</div>
      <div v-if="error" class="error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import contactsService from '../../services/contactsService.js';
import { useAuthContext } from '@/composables/useAuth';

const route = useRoute();
const router = useRouter();
const contact = ref(null);
const isLoading = ref(true);
const isDeleting = ref(false);
const error = ref('');
const { isAdmin } = useAuthContext();

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}

async function loadContact() {
  isLoading.value = true;
  try {
    contact.value = await contactsService.getContactById(route.params.id);
  } catch (e) {
    contact.value = null;
  } finally {
    isLoading.value = false;
  }
}

async function deleteContact() {
  if (!contact.value) return;
  isDeleting.value = true;
  error.value = '';
  try {
    await contactsService.deleteContact(contact.value.id);
    router.push({ name: 'crm' });
  } catch (e) {
    error.value = 'Ошибка при удалении контакта';
  } finally {
    isDeleting.value = false;
  }
}

function cancelDelete() {
  router.push({ name: 'contact-details', params: { id: route.params.id } });
}

onMounted(loadContact);
</script>

<style scoped>
.delete-confirm-page {
  max-width: 500px;
  margin: 60px auto;
  padding: 32px 24px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}
.contact-info {
  margin-top: 18px;
  font-size: 1.08rem;
  line-height: 1.7;
}
.confirm-actions {
  margin-top: 24px;
  display: flex;
  gap: 18px;
}
.delete-btn {
  background: #dc3545;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 22px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}
.delete-btn:disabled {
  background: #e6a6ad;
  cursor: not-allowed;
}
.delete-btn:hover:not(:disabled) {
  background: #b52a37;
}
.cancel-btn {
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 8px 22px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}
.cancel-btn:disabled {
  background: #eee;
  color: #aaa;
  cursor: not-allowed;
}
.cancel-btn:hover:not(:disabled) {
  background: #e0e0e0;
}
.error {
  color: #dc3545;
  margin-top: 18px;
}
</style> 