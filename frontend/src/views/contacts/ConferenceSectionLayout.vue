<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Секция 1:1 конференции внутри ContactDetailsLayout (без второго BaseLayout).
-->

<template>
  <div class="conference-section-wrap">
    <ConferenceNav v-if="showSubNav" />
    <router-view />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import ConferenceNav from './ConferenceNav.vue';

const route = useRoute();
const isLive = computed(() => route.name === 'contact-conference-live');
/** На create/agent — без ссылки «Настройки». */
const showSubNav = computed(
  () =>
    !isLive.value &&
    route.name !== 'contact-conference-create' &&
    route.name !== 'contact-conference-agent'
);
</script>

<style scoped>
.conference-section-wrap {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* TZ package C */
@media (max-width: 768px) {
  .conference-section-layout, .section-layout {
    max-width: 100%;
    box-sizing: border-box;
  }
}
</style>
