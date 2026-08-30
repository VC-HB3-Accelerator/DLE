<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="store-cart-page page-with-close">
      <PageCloseButton :fallback="{ name: 'storefront' }" />
      <StoreCartPanel />
    </div>
  </BaseLayout>
</template>

<script setup>
import { onBeforeMount } from 'vue';
import { useRouter } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import StoreCartPanel from '@/components/store/StoreCartPanel.vue';
import { useAuthContext } from '../../composables/useAuth';
import { storeCartRoute } from '../../services/storeService';

defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});
defineEmits(['auth-action-completed']);

const router = useRouter();
const { userId } = useAuthContext();

onBeforeMount(() => {
  const to = storeCartRoute(userId.value);
  if (to.name === 'contact-cart') {
    router.replace(to);
  }
});
</script>
