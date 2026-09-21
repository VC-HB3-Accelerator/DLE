<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Обёртка /conference/live/:sessionId — шапка и сайдбары как у остальных экранов.
-->

<template>
  <BaseLayout>
    <router-view />
  </BaseLayout>
</template>

<script setup>
import BaseLayout from '@/components/BaseLayout.vue';
</script>
