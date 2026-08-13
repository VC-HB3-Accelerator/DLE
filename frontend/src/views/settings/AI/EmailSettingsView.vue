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
    <AdminPageShell
      :title="$t('settings.ai.email.pageTitle')"
      :show-close="true"
      fallback="/settings/ai"
      variant="panel"
    >
              <form v-if="editMode" @submit.prevent="saveEmailSettings" class="settings-form">
          <div class="form-group">
            <label class="form-label" for="smtpHost">SMTP Host</label>
            <input id="smtpHost" v-model="form.smtpHost" type="text" class="form-control" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="smtpPort">SMTP Port</label>
            <input id="smtpPort" v-model.number="form.smtpPort" type="number" class="form-control" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="smtpUser">SMTP User</label>
            <input id="smtpUser" v-model="form.smtpUser" type="text" class="form-control" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="smtpPassword">SMTP Password</label>
            <input id="smtpPassword" v-model="form.smtpPassword" type="password" class="form-control" :placeholder="form.smtpPassword ? t('settings.ai.email.changePassword') : t('settings.ai.email.enterPassword')" />
          </div>
          <div class="form-group">
            <label class="form-label" for="imapHost">IMAP Host</label>
            <input id="imapHost" v-model="form.imapHost" type="text" class="form-control" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="imapPort">IMAP Port</label>
            <input id="imapPort" v-model.number="form.imapPort" type="number" class="form-control" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="imapUser">IMAP User</label>
            <input id="imapUser" v-model="form.imapUser" type="text" class="form-control" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="imapPassword">IMAP Password</label>
            <input id="imapPassword" v-model="form.imapPassword" type="password" class="form-control" :placeholder="form.imapPassword ? t('settings.ai.email.changePassword') : t('settings.ai.email.enterPassword')" />
          </div>
          <div class="form-group">
            <label class="form-label" for="fromEmail">From Email</label>
            <input id="fromEmail" v-model="form.fromEmail" type="email" class="form-control" required />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">{{ $t('common.save') }}</button>
            <button type="button" class="btn btn-ghost" @click="cancelEdit">{{ $t('common.cancel') }}</button>
          </div>
        </form>
        <div v-else class="settings-view">
          <div class="view-row"><span>SMTP Host:</span> <b>{{ form.smtpHost }}</b></div>
          <div class="view-row"><span>SMTP Port:</span> <b>{{ form.smtpPort }}</b></div>
          <div class="view-row"><span>SMTP User:</span> <b>{{ form.smtpUser }}</b></div>
          <div class="view-row"><span>IMAP Host:</span> <b>{{ form.imapHost }}</b></div>
          <div class="view-row"><span>IMAP Port:</span> <b>{{ form.imapPort }}</b></div>
          <div class="view-row"><span>IMAP User:</span> <b>{{ form.imapUser }}</b></div>
          <div class="view-row"><span>IMAP Password:</span> <b>{{ form.imapPassword ? '••••••••' : $t('settings.ai.email.notSet') }}</b></div>
          <div class="view-row"><span>From Email:</span> <b>{{ form.fromEmail }}</b></div>
          <div class="form-actions settings-view-actions">
            <button type="button" class="btn btn-primary" @click="editMode = true">{{ $t('common.edit') }}</button>
            <button type="button" class="btn btn-danger" @click="clearEmailSettings">{{ $t('settings.ai.email.clear') }}</button>
          </div>
        </div>
    </AdminPageShell>
  </BaseLayout>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import BaseLayout from '@/components/BaseLayout.vue';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';
import { reactive, ref, onMounted, watch } from 'vue';
import api from '@/api/axios';
import { useAuthContext } from '@/composables/useAuth';

const form = reactive({
  smtpHost: '',
  smtpPort: 465,
  smtpUser: '',
  smtpPassword: '',
  imapHost: '',
  imapPort: 993,
  imapUser: '',
  imapPassword: '',
  fromEmail: ''
});
const original = reactive({});
const editMode = ref(false);

const auth = useAuthContext();

// Подписываемся на централизованные события очистки и обновления данных
onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    console.log('[EmailSettingsView] Clearing Email settings data');
    // Очищаем данные при выходе из системы
    settings.value = { smtpHost: '', smtpPort: '', smtpUser: '', smtpPass: '', enabled: false };
  });
  
  window.addEventListener('refresh-application-data', () => {
    console.log('[EmailSettingsView] Refreshing Email settings data');
    loadEmailSettings(); // Обновляем данные при входе в систему
  });
});

const loadEmailSettings = async () => {
  // Не загружаем если не авторизован
  if (!auth.isAuthenticated.value) {
    console.log('[EmailSettings] Пропуск загрузки - пользователь не авторизован');
    return;
  }

  try {
    const res = await api.get('/settings/email-settings');
    if (res.data.success) {
      const s = res.data.settings;
      form.smtpHost = s.smtp_host;
      form.smtpPort = s.smtp_port;
      form.smtpUser = s.smtp_user;
      form.imapHost = s.imap_host || '';
      form.imapPort = s.imap_port || 993;
      form.imapUser = s.imap_user || '';
      form.imapPassword = '';
      form.fromEmail = s.from_email;
      form.smtpPassword = '';
      Object.assign(original, JSON.parse(JSON.stringify(form)));
    }
  } catch (e) {
    console.error('[EmailSettings] Ошибка загрузки:', e);
  }
};

// Отслеживаем изменение авторизации
watch(() => auth.isAuthenticated.value, async (isAuth) => {
  if (isAuth) {
    await loadEmailSettings();
  }
}, { immediate: true }); // immediate: true - вызовется сразу при монтировании

onMounted(() => {
  editMode.value = false;
});

const saveEmailSettings = async () => {
  try {
    await api.put('/settings/email-settings', {
      smtp_host: form.smtpHost,
      smtp_port: form.smtpPort,
      smtp_user: form.smtpUser,
      smtp_password: form.smtpPassword || undefined,
      imap_host: form.imapHost,
      imap_port: form.imapPort,
      imap_user: form.imapUser,
      imap_password: form.imapPassword || undefined,
      from_email: form.fromEmail
    });
    alert(t('settings.ai.email.saved'));
    form.smtpPassword = '';
    form.imapPassword = '';
    Object.assign(original, JSON.parse(JSON.stringify(form)));
    editMode.value = false;
  } catch (e) {
    alert(t('settings.ai.email.saveError'));
  }
};

const cancelEdit = () => {
  Object.assign(form, JSON.parse(JSON.stringify(original)));
  form.smtpPassword = '';
  form.imapPassword = '';
  editMode.value = false;
};

const clearEmailSettings = async () => {
  const confirmClear = confirm(t('settings.ai.email.confirmClear'));
  if (!confirmClear) return;
  
  try {
    await api.delete('/settings/email-settings');
    alert(t('settings.ai.email.cleared'));
    
    // Очищаем форму
    form.smtpHost = '';
    form.smtpPort = 465;
    form.smtpUser = '';
    form.smtpPassword = '';
    form.imapHost = '';
    form.imapPort = 993;
    form.imapUser = '';
    form.imapPassword = '';
    form.fromEmail = '';
    Object.assign(original, JSON.parse(JSON.stringify(form)));
    editMode.value = false;
  } catch (e) {
    console.error('Ошибка удаления настроек Email:', e);
    alert(t('settings.ai.email.clearError'));
  }
};
</script>

<style scoped>
.email-settings-block {
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

.email-settings.settings-panel {
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
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
}

.settings-view-actions {
  margin-top: var(--spacing-md);
  align-self: flex-end;
}

@media (max-width: 768px) {
  .email-settings-block,
  .email-settings.settings-panel {
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
