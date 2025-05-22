<template>
  <div class="email-settings settings-panel">
    <h2>Настройки Email</h2>
    <form @submit.prevent="saveEmailSettings" class="settings-form">
      <div class="form-group">
        <label for="smtpHost">SMTP Host</label>
        <input id="smtpHost" v-model="form.smtpHost" type="text" required />
      </div>
      <div class="form-group">
        <label for="smtpUser">SMTP User</label>
        <input id="smtpUser" v-model="form.smtpUser" type="text" required />
      </div>
      <div class="form-group">
        <label for="smtpPassword">SMTP Password</label>
        <input id="smtpPassword" v-model="form.smtpPassword" type="password" required />
      </div>
      <div class="form-group">
        <label for="fromEmail">From Email</label>
        <input id="fromEmail" v-model="form.fromEmail" type="email" required />
      </div>
      <button type="submit" class="save-btn">Сохранить</button>
    </form>
  </div>
</template>

<script setup>
import { reactive } from 'vue';
// TODO: Импортировать API для сохранения
const form = reactive({
  smtpHost: '',
  smtpUser: '',
  smtpPassword: '',
  fromEmail: ''
});
const saveEmailSettings = async () => {
  // TODO: Реализовать вызов API для сохранения
  alert('Настройки Email сохранены (заглушка)');
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
</style> 