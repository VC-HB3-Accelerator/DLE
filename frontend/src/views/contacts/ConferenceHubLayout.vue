<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Хаб multi-конференции (2–3 участника). Не страница одного контакта.
-->

<template>
  <BaseLayout>
    <div class="hub-page page-with-close">
      <PageCloseButton :on-navigate="handlePageClose" />
      <div class="hub-topbar">
        <div class="hub-topbar-left">
          <h1 class="hub-title">{{ t('contacts.conference.hub.title') }}</h1>
          <p class="hub-subtitle">{{ t('contacts.conference.hub.subtitle') }}</p>
          <nav v-if="sessionId && !isLive" class="hub-nav">
            <router-link
              :to="{ name: 'hub-conference', params: { sessionId } }"
              class="hub-nav-link"
              active-class="is-active"
            >
              {{ t('contacts.conference.nav.settings') }}
            </router-link>
            <router-link
              :to="{ name: 'hub-conference-agent', params: { sessionId } }"
              class="hub-nav-link"
              active-class="is-active"
            >
              {{ t('contacts.conference.nav.agent') }}
            </router-link>
          </nav>
        </div>
      </div>
      <router-view />
    </div>
  </BaseLayout>
</template>

<script setup>
import { computed, provide, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import BaseLayout from '@/components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const sessionId = computed(() => route.params.sessionId || null);
const isLive = computed(() => route.name === 'hub-conference-live');

const pageCloseHandler = ref(null);
provide('registerPageCloseHandler', (fn) => {
  pageCloseHandler.value = fn;
});
provide('unregisterPageCloseHandler', () => {
  pageCloseHandler.value = null;
});

function goBack() {
  if (route.name === 'hub-conferences' || !sessionId.value) {
    router.push({ name: 'contacts-list' });
    return;
  }
  router.push({ name: 'hub-conferences' });
}

function handlePageClose() {
  if (typeof pageCloseHandler.value === 'function') {
    pageCloseHandler.value();
    return;
  }
  goBack();
}
</script>

<style scoped>
.hub-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
  position: relative;
}

.hub-topbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}

.hub-topbar-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.hub-title {
  margin: 0;
  font-size: 1.5rem;
}

.hub-subtitle {
  margin: 0;
  color: var(--color-grey);
  font-size: var(--font-size-sm);
}

.hub-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.hub-nav-link {
  padding: 6px 12px;
  border-radius: var(--block-radius);
  text-decoration: none;
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.hub-nav-link.is-active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 600;
}

@media (max-width: 768px) {
  .hub-page {
    padding: 12px;
  }

  .hub-topbar {
    flex-direction: column;
    align-items: stretch;
  }
}

/* TZ package C: bp normalized */
</style>
