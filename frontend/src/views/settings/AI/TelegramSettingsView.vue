<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

<template>
  <BaseLayout>
    <div class="telegram-settings-block">
      <button class="close-btn" @click="goBack">×</button>
      <h2>Telegram: интеграция и настройки</h2>
      <div class="telegram-settings settings-panel">
        <form v-if="editMode" @submit.prevent="saveTelegramSettings" class="settings-form">
          <div class="form-group">
            <label for="botToken">Bot Token</label>
            <input id="botToken" v-model="form.botToken" type="text" required />
          </div>
          <div class="form-group">
            <label for="botUsername">Bot Username</label>
            <input id="botUsername" v-model="form.botUsername" type="text" required />
          </div>
          <button type="submit" class="save-btn">Сохранить</button>
          <button type="button" class="cancel-btn" @click="cancelEdit">Отмена</button>
        </form>
        <div v-else class="settings-view">
          <div class="view-row"><span>Bot Token:</span> <b>••••••••••••••••••••••••••••••••••••••••</b></div>
          <div class="view-row"><span>Bot Username:</span> <b>{{ form.botUsername }}</b></div>
          <button type="button" class="edit-btn" @click="editMode = true">Изменить</button>
          <button type="button" class="cancel-btn" @click="goBack">Закрыть</button>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import BaseLayout from '@/components/BaseLayout.vue';
import { useRouter } from 'vue-router';
import { reactive, ref, onMounted, watch } from 'vue';
import api from '@/api/axios';
import { useAuthContext } from '@/composables/useAuth';

const router = useRouter();
const goBack = () => router.push('/settings/ai');

const form = reactive({
  botToken: '',
  botUsername: ''
});
const original = reactive({});
const editMode = ref(false);

const auth = useAuthContext();

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
    alert('Настройки Telegram сохранены');
    form.botToken = '';
    Object.assign(original, JSON.parse(JSON.stringify(form)));
    editMode.value = false;
  } catch (e) {
    alert('Ошибка сохранения telegram-настроек');
  }
};

const cancelEdit = () => {
  Object.assign(form, JSON.parse(JSON.stringify(original)));
  form.botToken = '';
  editMode.value = false;
};
</script>

<style scoped>
.telegram-settings-block {
  background: #fff;
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-top: 20px;
  margin-bottom: 20px;
  width: 100%;
  position: relative;
  overflow-x: auto;
}
.close-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #bbb;
  transition: color 0.2s;
}
.close-btn:hover {
  color: #333;
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
}
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.save-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}
.save-btn:hover {
  background: var(--color-primary-dark);
}
.cancel-btn {
  background: #eee;
  color: #333;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  margin-left: 1rem;
}
.settings-view {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}
.view-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1rem;
  background: #f8f8f8;
  border-radius: 4px;
  padding: 0.5rem 1rem;
}
.edit-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  align-self: flex-end;
  margin-top: 1.5rem;
  transition: background 0.2s;
}
.edit-btn:hover {
  background: var(--color-primary-dark);
}
</style> 