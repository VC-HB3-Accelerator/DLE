<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Секция 1:1 конференции внутри ContactDetailsLayout (без второго BaseLayout).
-->

<template>
  <div class="conference-section-wrap">
    <p v-if="!isLive" class="conference-1to1-hint">{{ t('contacts.conference.oneToOneHint') }}</p>
    <ConferenceNav v-if="!isLive" />
    <router-view />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import ConferenceNav from './ConferenceNav.vue';

const { t } = useI18n();
const route = useRoute();
const isLive = computed(() => route.name === 'contact-conference-live');
</script>

<style scoped>
.conference-section-wrap {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.conference-1to1-hint {
  margin: 0;
  color: var(--color-grey, #606266);
  font-size: 0.95rem;
}
</style>
