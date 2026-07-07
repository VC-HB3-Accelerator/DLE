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
    <div class="broadcast-page">
      <div class="broadcast-topbar">
        <BroadcastNav />
        <el-button @click="goBack">{{ t('contacts.broadcast.backToContacts') }}</el-button>
      </div>

      <router-view />
    </div>
  </BaseLayout>
</template>

<script setup>
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import BaseLayout from '@/components/BaseLayout.vue';
import BroadcastNav from './BroadcastNav.vue';

const BROADCAST_IDS_STORAGE_KEY = 'broadcastRecipientIds';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

watch(
  () => route.query.ids,
  (ids) => {
    if (ids) {
      sessionStorage.setItem(BROADCAST_IDS_STORAGE_KEY, String(ids));
    }
  },
  { immediate: true }
);

function goBack() {
  sessionStorage.removeItem(BROADCAST_IDS_STORAGE_KEY);
  router.push({ name: 'contacts-list' });
}
</script>

<style scoped>
.broadcast-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
}

.broadcast-topbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}

@media (max-width: 700px) {
  .broadcast-page {
    padding: 12px;
  }

  .broadcast-topbar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
