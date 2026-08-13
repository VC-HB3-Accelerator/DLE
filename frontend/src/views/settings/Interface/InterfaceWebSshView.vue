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
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
  >
    <AdminPageShell :show-close="true" fallback="/settings/interface" variant="panel">
      <h2 class="webssh-title">{{ $t('settings.interface.vds.setupTitle') }}</h2>
      <WebSshForm />
    </AdminPageShell>
  </BaseLayout>
</template>

<script setup>
import BaseLayout from '@/components/BaseLayout.vue';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';
import WebSshForm from '@/components/WebSshForm.vue';

defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: [Array, Object],
  isLoadingTokens: Boolean,
});
</script>

<style scoped>
.webssh-title {
  margin: 0 0 var(--spacing-lg) 0;
  padding-right: 2.5rem;
  color: var(--color-dark);
  font-size: var(--font-size-xl);
  font-weight: 600;
}
</style>
