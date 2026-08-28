<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Устарело: контент на /settings/security/roles?tab=ai.
-->

<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
onMounted(() => {
  router.replace({ name: 'settings-security-roles', query: { tab: 'ai' } });
});
</script>

<template>
  <p>{{ $t('common.loading') }}</p>
</template>
