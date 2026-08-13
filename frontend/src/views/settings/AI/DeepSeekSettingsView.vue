<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <BaseLayout>
    <AdminPageShell
      :title="t('settings.ai.deepseek.pageTitle')"
      :show-close="true"
      fallback="/settings/ai"
      variant="panel"
    >
      <AIProviderSettings
        provider="deepseek"
        :label="t('settings.ai.deepseek.label')"
        :description="t('settings.ai.deepseek.providerDescription')"
        api-key-placeholder="sk-..."
        base-url-placeholder="https://api.deepseek.com"
        :show-api-key="true"
        :show-base-url="true"
        :show-proxy="false"
      />
    </AdminPageShell>
  </BaseLayout>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import BaseLayout from '@/components/BaseLayout.vue';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';
import AIProviderSettings from '@/views/settings/AIProviderSettings.vue';

const { t } = useI18n();
</script>
