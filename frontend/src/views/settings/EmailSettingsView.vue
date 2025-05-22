<template>
  <div class="email-settings settings-panel">
    <h2>Настройки Email</h2>
    <form v-if="editMode" @submit.prevent="saveEmailSettings" class="settings-form">
      <div class="form-group">
        <label for="smtpHost">SMTP Host</label>
        <input id="smtpHost" v-model="form.smtpHost" type="text" required />
      </div>
      <div class="form-group">
        <label for="smtpPort">SMTP Port</label>
        <input id="smtpPort" v-model.number="form.smtpPort" type="number" required />
      </div>
      <div class="form-group">
        <label for="smtpUser">SMTP User</label>
        <input id="smtpUser" v-model="form.smtpUser" type="text" required />
      </div>
      <div class="form-group">
        <label for="smtpPassword">SMTP Password</label>
        <input id="smtpPassword" v-model="form.smtpPassword" type="password" :placeholder="form.smtpPassword ? 'Изменить пароль' : 'Введите пароль'" />
      </div>
      <div class="form-group">
        <label for="imapHost">IMAP Host</label>
        <input id="imapHost" v-model="form.imapHost" type="text" required />
      </div>
      <div class="form-group">
        <label for="imapPort">IMAP Port</label>
        <input id="imapPort" v-model.number="form.imapPort" type="number" required />
      </div>
      <div class="form-group">
        <label for="fromEmail">From Email</label>
        <input id="fromEmail" v-model="form.fromEmail" type="email" required />
      </div>
      <button type="submit" class="save-btn">Сохранить</button>
      <button type="button" class="cancel-btn" @click="cancelEdit">Отмена</button>
    </form>
    <div v-else class="settings-view">
      <div class="view-row"><span>SMTP Host:</span> <b>{{ form.smtpHost }}</b></div>
      <div class="view-row"><span>SMTP Port:</span> <b>{{ form.smtpPort }}</b></div>
      <div class="view-row"><span>SMTP User:</span> <b>{{ form.smtpUser }}</b></div>
      <div class="view-row"><span>IMAP Host:</span> <b>{{ form.imapHost }}</b></div>
      <div class="view-row"><span>IMAP Port:</span> <b>{{ form.imapPort }}</b></div>
      <div class="view-row"><span>From Email:</span> <b>{{ form.fromEmail }}</b></div>
      <button type="button" class="edit-btn" @click="editMode = true">Изменить</button>
      <button type="button" class="cancel-btn" @click="$emit('cancel')">Закрыть</button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import api from '@/api/axios';

const form = reactive({
  smtpHost: '',
  smtpPort: 465,
  smtpUser: '',
  smtpPassword: '',
  imapHost: '',
  imapPort: 993,
  fromEmail: ''
});
const original = reactive({});
const editMode = ref(false);

const loadEmailSettings = async () => {
  try {
    const res = await api.get('/api/email-settings');
    if (res.data.success) {
      const s = res.data.settings;
      form.smtpHost = s.smtp_host;
      form.smtpPort = s.smtp_port;
      form.smtpUser = s.smtp_user;
      form.imapHost = s.imap_host || '';
      form.imapPort = s.imap_port || 993;
      form.fromEmail = s.from_email;
      form.smtpPassword = '';
      Object.assign(original, JSON.parse(JSON.stringify(form)));
    }
  } catch (e) {
    // обработка ошибки
  }
};

onMounted(async () => {
  await loadEmailSettings();
  editMode.value = false;
});

const saveEmailSettings = async () => {
  try {
    await api.put('/api/email-settings', {
      smtp_host: form.smtpHost,
      smtp_port: form.smtpPort,
      smtp_user: form.smtpUser,
      smtp_password: form.smtpPassword || undefined,
      imap_host: form.imapHost,
      imap_port: form.imapPort,
      from_email: form.fromEmail
    });
    alert('Настройки Email сохранены');
    form.smtpPassword = '';
    Object.assign(original, JSON.parse(JSON.stringify(form)));
    editMode.value = false;
  } catch (e) {
    alert('Ошибка сохранения email-настроек');
  }
};

const cancelEdit = () => {
  Object.assign(form, JSON.parse(JSON.stringify(original)));
  form.smtpPassword = '';
  editMode.value = false;
};
</script>

<style scoped>
.settings-panel {
  padding: var(--block-padding);
  background-color: var(--color-light);
  border-radius: var(--radius-md);
  margin-top: var(--spacing-lg);
  max-width: 500px;
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