<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <BaseLayout>
    <AdminPageShell
      :title="$t('settings.ai.ollama.pageTitle')"
      :show-close="true"
      fallback="/settings/ai"
      variant="panel"
    >
      <AIProviderSettings
        provider="ollama"
        :label="$t('settings.ai.ollama.label')"
        :description="t('settings.ai.ollama.providerDescription')"
        api-key-placeholder=""
        base-url-placeholder="http://localhost:11434"
        :show-api-key="false"
        :show-base-url="true"
      />
      <OllamaModelManager />
    </AdminPageShell>
  </BaseLayout>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import BaseLayout from '@/components/BaseLayout.vue';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';
import AIProviderSettings from '@/views/settings/AIProviderSettings.vue';
import OllamaModelManager from '@/components/OllamaModelManager.vue';

const { t } = useI18n();
</script>
