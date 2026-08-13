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
  <AdminPageShell
    :title="t('settings.ai.integrations')"
    :show-close="true"
    fallback="/settings"
  >
    <HubGrid>
      <HubCard
        :title="t('settings.ai.openai.title')"
        :description="t('settings.ai.openai.description')"
        @open="goTo('/settings/ai/openai')"
      />
      <HubCard
        :title="t('settings.ai.deepseek.title')"
        :description="t('settings.ai.deepseek.description')"
        @open="goTo('/settings/ai/deepseek')"
      />
      <HubCard
        :title="t('settings.ai.qwencloud.title')"
        :description="t('settings.ai.qwencloud.description')"
        @open="goTo('/settings/ai/qwencloud')"
      />
      <HubCard
        :title="t('settings.ai.vpn.title')"
        :description="t('settings.ai.vpn.cardDescription')"
        @open="goTo('/settings/ai/vpn')"
      />
      <HubCard
        :title="t('settings.ai.ollama.title')"
        :description="t('settings.ai.ollama.description')"
        @open="goTo('/settings/ai/ollama')"
      />
      <HubCard
        :title="t('settings.ai.telegram.title')"
        :description="t('settings.ai.telegram.description')"
        @open="goTo('/settings/ai/telegram')"
      />
      <HubCard
        :title="t('settings.ai.email.title')"
        :description="t('settings.ai.email.description')"
        @open="goTo('/settings/ai/email')"
      />
      <HubCard
        :title="t('settings.ai.database.title')"
        :description="t('settings.ai.database.description')"
        @open="goTo('/settings/ai/database')"
      />
      <HubCard
        :title="t('settings.ai.rag.title')"
        :description="t('settings.ai.rag.description')"
        @open="goTo('/settings/ai/rag')"
      />
      <HubCard
        :title="t('settings.ai.assistant.title')"
        :description="t('settings.ai.assistant.description')"
        @open="goTo('/settings/ai/assistant')"
      />
    </HubGrid>

    <NoAccessModal
      :show="showNoAccessModal"
      :title="t('settings.accessRestricted')"
      :message="t('settings.ai.adminOnly')"
      @close="showNoAccessModal = false"
    />
  </AdminPageShell>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { usePermissions } from '@/composables/usePermissions';
import { useAuthContext } from '@/composables/useAuth';
import NoAccessModal from '@/components/NoAccessModal.vue';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';
import HubGrid from '@/components/admin/HubGrid.vue';
import HubCard from '@/components/admin/HubCard.vue';

const { t } = useI18n();
const router = useRouter();
const { checkAuth, checkUserAccessLevel, address, isAuthenticated } = useAuthContext();
const { canManageSettings } = usePermissions();
const showNoAccessModal = ref(false);

onMounted(async () => {
  await checkAuth();
  if (isAuthenticated.value && address.value) {
    await checkUserAccessLevel(address.value);
  }
});

async function goTo(path) {
  await checkAuth();
  if (isAuthenticated.value && address.value) {
    await checkUserAccessLevel(address.value);
  }
  if (!canManageSettings.value) {
    showNoAccessModal.value = true;
    return;
  }
  router.push(path);
}
</script>
