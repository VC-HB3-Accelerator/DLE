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
    <div class="contact-details-page">
      <div v-if="isLoading" class="page-state">{{ t('common.loading') }}</div>
      <div v-else-if="!contact && !isCreateMode" class="page-state">{{ t('contacts.contactNotFound') }}</div>
      <div v-else class="contact-details-content">
        <header class="contact-details-header">
          <div class="header-top">
            <div class="header-main">
              <h1>{{ contactTitle }}</h1>
              <p v-if="contact.name?.trim()" class="header-subtitle">{{ t('contacts.details.userId') }} {{ contact.id }}</p>
            </div>
            <el-button class="back-btn" @click="goBack">{{ t('contacts.details.backToList') }}</el-button>
          </div>
          <ContactDetailsNav v-if="!isCreateMode" />
        </header>

        <router-view />
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import BaseLayout from '@/components/BaseLayout.vue';
import ContactDetailsNav from './ContactDetailsNav.vue';
import { provideContactDetails } from '@/composables/useContactDetails';
import { usePermissions } from '@/composables/usePermissions';
import { useContactsAndMessagesWebSocket } from '@/composables/useContactsWebSocket';
import websocketServiceModule from '@/services/websocketService';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { canViewContacts } = usePermissions();
const { markContactAsRead } = useContactsAndMessagesWebSocket();
const { websocketService } = websocketServiceModule;

const userId = computed(() => route.params.id);
const { contact, isLoading, isCreateMode, reloadContact } = provideContactDetails(userId);

const contactTitle = computed(() => {
  if (isCreateMode.value) return t('contacts.create.title');
  const name = contact.value?.name?.trim();
  if (name) return name;
  return contact.value?.id ?? userId.value;
});

async function handleContactsUpdate() {
  await reloadContact();
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push({ name: 'contacts-list' });
  }
}

function handleClearApplicationData() {
  contact.value = null;
}

onMounted(async () => {
  window.addEventListener('clear-application-data', handleClearApplicationData);
  window.addEventListener('refresh-application-data', reloadContact);
  websocketService.on('contacts-updated', handleContactsUpdate);

  if (userId.value && canViewContacts.value && !isCreateMode.value) {
    await markContactAsRead(userId.value);
  }
});

onUnmounted(() => {
  window.removeEventListener('clear-application-data', handleClearApplicationData);
  window.removeEventListener('refresh-application-data', reloadContact);
  websocketService.off('contacts-updated', handleContactsUpdate);
});
</script>

<style scoped>
.contact-details-page {
  width: 100%;
}

.page-state {
  padding: var(--spacing-lg);
  color: var(--color-grey);
}

.contact-details-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  width: 100%;
}

.contact-details-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 4px;
}

.header-top {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 16px;
}

.header-main h1 {
  margin: 0 0 4px;
  font-size: var(--font-size-xxl);
  font-weight: 600;
  color: var(--color-dark);
}

.header-subtitle {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-grey);
}

.back-btn {
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .contact-details-page {
    display: flex;
    flex-direction: column;
    max-height: calc(100dvh - var(--header-height, 65px) - 16px);
    overflow: hidden;
  }

  .contact-details-content {
    flex: 1 1 auto;
    min-height: 0;
    gap: 10px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .contact-details-content:has(.contact-chat-panel) {
    overflow: hidden;
  }

  .contact-details-header {
    flex-shrink: 0;
    margin-bottom: 0;
    gap: 10px;
  }

  .header-top {
    flex-direction: column;
    align-items: stretch;
  }

  .back-btn {
    align-self: flex-start;
  }
}
</style>
