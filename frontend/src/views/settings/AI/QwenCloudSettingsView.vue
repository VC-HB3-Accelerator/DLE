<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <BaseLayout>
    <AdminPageShell
      :title="t('settings.ai.qwencloud.pageTitle')"
      :show-close="true"
      fallback="/settings/ai"
      variant="panel"
    >
      <AIProviderSettings
        provider="qwencloud"
        :label="t('settings.ai.qwencloud.label')"
        :description="t('settings.ai.qwencloud.providerDescription')"
        api-key-placeholder="sk-..."
        base-url-placeholder="https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
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
