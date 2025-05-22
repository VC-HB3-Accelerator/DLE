<template>
  <div class="ai-settings settings-panel">
    <h2>Интеграции</h2>
    <div class="integration-blocks">
      <div class="integration-block">
        <h3>Telegram</h3>
        <p>Интеграция с Telegram-ботом для уведомлений и авторизации.</p>
        <button class="details-btn" @click="goToTelegram">Подробнее</button>
      </div>
      <div class="integration-block">
        <h3>Email</h3>
        <p>Интеграция с Email для отправки писем и уведомлений.</p>
        <button class="details-btn" @click="goToEmail">Подробнее</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
const router = useRouter();
const goToTelegram = () => router.push({ name: 'settings-telegram' });
const goToEmail = () => router.push({ name: 'settings-email' });
</script>

<style scoped>
.settings-panel {
  padding: var(--block-padding);
  background-color: var(--color-light);
  border-radius: var(--radius-md);
  margin-top: var(--spacing-lg);
  animation: fadeIn var(--transition-normal);
}
.integration-blocks {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}
.integration-block {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  padding: 2rem;
  min-width: 260px;
  flex: 1 1 300px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.details-btn {
  margin-top: 1.5rem;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}
.details-btn:hover {
  background: var(--color-primary-dark);
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style> 