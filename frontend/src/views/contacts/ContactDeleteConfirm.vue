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
  <div class="delete-confirm-page">
    <h2>{{ t('contacts.deleteConfirm.title') }}</h2>
    <div v-if="isLoading">{{ t('common.loading') }}</div>
    <div v-else-if="!contact">{{ t('contacts.contactNotFound') }}</div>
    <div v-else class="contact-info">
      <p><strong>{{ t('contacts.name') }}:</strong> {{ contact.name || '-' }}</p>
      <p><strong>{{ t('contacts.email') }}:</strong> {{ contact.email || '-' }}</p>
      <p><strong>{{ t('contacts.telegram') }}:</strong> {{ contact.telegram || '-' }}</p>
      <p><strong>{{ t('contacts.wallet') }}:</strong> {{ contact.wallet || '-' }}</p>
      <p><strong>{{ t('contacts.createdAt') }}:</strong> {{ formatDate(contact.created_at) }}</p>
      <div class="confirm-actions">
        <button v-if="canDeleteData" class="delete-btn" @click="deleteContact" :disabled="isDeleting">{{ t('common.delete') }}</button>
        <button class="cancel-btn" @click="cancelDelete" :disabled="isDeleting">{{ t('common.cancel') }}</button>
      </div>
      <div v-if="!canDeleteData" class="empty-table-placeholder">{{ t('contacts.deleteConfirm.noPermission') }}</div>
      <div v-if="error" class="error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { errorMessageMatches } from '../../utils/i18nErrorMatch';
import { useRoute, useRouter } from 'vue-router';
import contactsService from '../../services/contactsService.js';
import { usePermissions } from '@/composables/usePermissions';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const contact = ref(null);
const isLoading = ref(true);

onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    console.log('[ContactDeleteConfirm] Clearing contact data');
    contact.value = null;
  });
  
  window.addEventListener('refresh-application-data', () => {
    console.log('[ContactDeleteConfirm] Refreshing contact data');
    loadContact();
  });
});
const isDeleting = ref(false);
const error = ref('');
const { canDeleteData } = usePermissions();

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}

async function loadContact() {
  isLoading.value = true;
  try {
    contact.value = await contactsService.getContactById(route.params.id);
    if (!contact.value) {
      error.value = t('contacts.contactNotFound');
    }
  } catch (e) {
    contact.value = null;
    error.value = t('contacts.contactNotFound');
  } finally {
    isLoading.value = false;
  }
}

async function deleteContact() {
  if (!contact.value) return;
  isDeleting.value = true;
  error.value = '';
  try {
    const result = await contactsService.deleteContact(contact.value.id);
    if (result.success || errorMessageMatches(result.message, 'contacts.deleteConfirm.alreadyDeleted')) {
      router.push({ name: 'contacts-list' });
    } else {
      error.value = t('contacts.deleteConfirm.deleteError');
    }
  } catch (e) {
    error.value = t('contacts.deleteConfirm.deleteError');
  } finally {
    isDeleting.value = false;
  }
}

function cancelDelete() {
  router.push({ name: 'contacts-list' });
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
