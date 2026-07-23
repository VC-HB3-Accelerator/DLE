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
  <BaseLayout>
    <div class="openai-settings-block">
      <button type="button" class="close-btn" @click="goBack" :aria-label="t('common.close')">×</button>
      <h2>{{ t('settings.ai.openai.pageTitle') }}</h2>
      <AIProviderSettings
        class="openai-provider"
        provider="openai"
        :label="t('settings.ai.openai.label')"
        :description="t('settings.ai.openai.providerDescription')"
        api-key-placeholder="sk-..."
        base-url-placeholder="https://api.openai.com/v1"
        :show-api-key="true"
        :show-base-url="true"
        :show-proxy="true"
        :show-heading="false"
      />
    </div>
  </BaseLayout>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import BaseLayout from '@/components/BaseLayout.vue';
import AIProviderSettings from '@/views/settings/AIProviderSettings.vue';
import { useRouter } from 'vue-router';

const { t } = useI18n();
const router = useRouter();
const goBack = () => router.push('/settings/ai');
</script>

<style scoped>
.openai-settings-block {
  background: #fff;
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-top: 20px;
  margin-bottom: 20px;
  width: 100%;
  position: relative;
  color: #222;
  overflow: visible;
}

.close-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  background: none;
  border: none;
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
  color: #bbb;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #333;
}

h2 {
  margin: 0 0 12px;
  padding-right: 36px;
  color: #222;
}

/* Не трогаем padding/visibility дочерней формы через scopeId на root child */
:deep(.openai-provider.ai-provider-settings) {
  max-width: 640px;
  margin-top: 0;
  padding: 0;
  background: transparent;
  box-shadow: none;
}
</style>
