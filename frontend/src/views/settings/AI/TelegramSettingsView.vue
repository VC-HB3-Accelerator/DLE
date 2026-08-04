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
    <div class="telegram-settings-block panel page-with-close">
      <PageCloseButton fallback="/settings/ai" />
      <h2>{{ $t('settings.ai.telegram.pageTitle') }}</h2>
      <div class="telegram-settings settings-panel">
        <form v-if="editMode" @submit.prevent="saveTelegramSettings" class="settings-form">
          <div class="form-group">
            <label class="form-label" for="botToken">Bot Token</label>
            <input id="botToken" v-model="form.botToken" type="text" class="form-control" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="botUsername">Bot Username</label>
            <input id="botUsername" v-model="form.botUsername" type="text" class="form-control" required />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">{{ $t('common.save') }}</button>
            <button type="button" class="btn btn-ghost" @click="cancelEdit">{{ $t('common.cancel') }}</button>
          </div>
        </form>
        <div v-else class="settings-view">
          <div class="view-row"><span>Bot Token:</span> <b>••••••••••••••••••••••••••••••••••••••••</b></div>
          <div class="view-row"><span>Bot Username:</span> <b>{{ form.botUsername }}</b></div>
          <div class="form-actions settings-view-actions">
            <button type="button" class="btn btn-primary" @click="editMode = true">{{ $t('common.edit') }}</button>
            <button type="button" class="btn btn-danger" @click="clearTelegramSettings">{{ $t('settings.ai.email.clear') }}</button>
          </div>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import BaseLayout from '@/components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import { reactive, ref, onMounted, watch } from 'vue';
import api from '@/api/axios';
import { useAuthContext } from '@/composables/useAuth';

const form = reactive({
  botToken: '',
  botUsername: ''
});
const original = reactive({});
const editMode = ref(false);

const auth = useAuthContext();

// Подписываемся на централизованные события очистки и обновления данных
onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    console.log('[TelegramSettingsView] Clearing Telegram settings data');
    // Очищаем данные при выходе из системы
    settings.value = { botToken: '', webhookUrl: '', enabled: false };
  });
  
  window.addEventListener('refresh-application-data', () => {
    console.log('[TelegramSettingsView] Refreshing Telegram settings data');
    loadTelegramSettings(); // Обновляем данные при входе в систему
  });
});

const loadTelegramSettings = async () => {
  // Не загружаем если не авторизован
  if (!auth.isAuthenticated.value) {
    console.log('[TelegramSettings] Пропуск загрузки - пользователь не авторизован');
    return;
  }

  try {
    const res = await api.get('/settings/telegram-settings');
    if (res.data.success) {
      const s = res.data.settings;
      form.botToken = s.bot_token || '';
      form.botUsername = s.bot_username;
      Object.assign(original, JSON.parse(JSON.stringify(form)));
    }
  } catch (e) {
    console.error('[TelegramSettings] Ошибка загрузки:', e);
  }
};

// Отслеживаем изменение авторизации
watch(() => auth.isAuthenticated.value, async (isAuth) => {
  if (isAuth) {
    await loadTelegramSettings();
  }
}, { immediate: true }); // immediate: true - вызовется сразу при монтировании

onMounted(() => {
  editMode.value = false;
});

const saveTelegramSettings = async () => {
  try {
    await api.put('/settings/telegram-settings', {
      bot_token: form.botToken,
      bot_username: form.botUsername
    });
    alert(t('settings.ai.telegram.saved'));
    form.botToken = '';
    Object.assign(original, JSON.parse(JSON.stringify(form)));
    editMode.value = false;
  } catch (e) {
    alert(t('settings.ai.telegram.saveError'));
  }
};

const cancelEdit = () => {
  Object.assign(form, JSON.parse(JSON.stringify(original)));
  form.botToken = '';
  editMode.value = false;
};

const clearTelegramSettings = async () => {
  const confirmClear = confirm(t('settings.ai.telegram.confirmClear'));
  if (!confirmClear) return;
  
  try {
    await api.delete('/settings/telegram-settings');
    alert(t('settings.ai.telegram.cleared'));
    
    // Очищаем форму
    form.botToken = '';
    form.botUsername = '';
    Object.assign(original, JSON.parse(JSON.stringify(form)));
    editMode.value = false;
  } catch (e) {
    console.error('Ошибка удаления настроек Telegram:', e);
    alert(t('settings.ai.telegram.clearError'));
  }
};
</script>

<style scoped>
.telegram-settings-block {
  margin-top: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  width: 100%;
  position: relative;
  overflow-x: auto;
}

.page-with-close {
  position: relative;
}

h2 {
  margin-bottom: 0;
}

.telegram-settings.settings-panel {
  background: none !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  margin-top: 0 !important;
  max-width: 100% !important;
  padding: 0 !important;
  border: none !important;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.settings-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.view-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-md);
  background: var(--color-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
}

.settings-view-actions {
  margin-top: var(--spacing-md);
  align-self: flex-end;
}

@media (max-width: 768px) {
  .telegram-settings.settings-panel {
    max-width: 100%;
    box-sizing: border-box;
  }

  .view-row {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm);
  }

  .settings-view-actions {
    align-self: stretch;
    width: 100%;
  }
}
</style>
