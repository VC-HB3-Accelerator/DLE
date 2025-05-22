<template>
  <div class="telegram-settings settings-panel">
    <h2>Настройки Telegram</h2>
    <form @submit.prevent="saveTelegramSettings" class="settings-form">
      <div class="form-group">
        <label for="botToken">Bot Token</label>
        <input id="botToken" v-model="form.botToken" type="text" required />
      </div>
      <div class="form-group">
        <label for="botUsername">Bot Username</label>
        <input id="botUsername" v-model="form.botUsername" type="text" required />
      </div>
      <button type="submit" class="save-btn">Сохранить</button>
    </form>
  </div>
</template>

<script setup>
import { reactive } from 'vue';
// TODO: Импортировать API для сохранения
const form = reactive({
  botToken: '',
  botUsername: ''
});
const saveTelegramSettings = async () => {
  // TODO: Реализовать вызов API для сохранения
  alert('Настройки Telegram сохранены (заглушка)');
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