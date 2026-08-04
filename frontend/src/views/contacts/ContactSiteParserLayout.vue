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
    <div class="parser-page page-with-close">
      <PageCloseButton :on-navigate="goBack" />
      <div class="parser-topbar">
        <div>
          <h1 class="parser-title">{{ t('contacts.parser.title') }}</h1>
          <p class="parser-subtitle">{{ t('contacts.parser.description') }}</p>
        </div>
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
import PageCloseButton from '@/components/PageCloseButton.vue';

const PARSER_IDS_STORAGE_KEY = 'contactSiteParserIds';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

watch(
  () => route.query.ids,
  (ids) => {
    if (ids) {
      sessionStorage.setItem(PARSER_IDS_STORAGE_KEY, String(ids));
    }
  },
  { immediate: true }
);

function goBack() {
  sessionStorage.removeItem(PARSER_IDS_STORAGE_KEY);
  router.push({ name: 'contacts-list' });
}
</script>

<style scoped>
.parser-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
  position: relative;
}

.parser-topbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}

.parser-title {
  margin: 0 0 6px;
  font-size: 1.5rem;
}

.parser-subtitle {
  margin: 0;
  color: var(--color-text-light);
  font-size: var(--font-size-sm);
  max-width: 640px;
}

@media (max-width: 768px) {
  .parser-page {
    padding: 12px;
  }

  .parser-topbar {
    flex-direction: column;
    align-items: stretch;
  }
}

/* TZ package C: bp normalized */
</style>
