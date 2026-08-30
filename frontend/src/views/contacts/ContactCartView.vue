<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <section class="contact-cart">
    <p v-if="!isOwn" class="contact-cart__muted">{{ t('store.cabinet.cartOwnOnly') }}</p>
    <StoreCartPanel v-else embedded />
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useAuthContext } from '@/composables/useAuth';
import StoreCartPanel from '@/components/store/StoreCartPanel.vue';

const { t } = useI18n();
const route = useRoute();
const { userId } = useAuthContext();

const isOwn = computed(() => String(userId.value || '') === String(route.params.id || ''));
</script>

<style scoped>
.contact-cart__muted {
  margin: 0;
  opacity: 0.8;
}
</style>
