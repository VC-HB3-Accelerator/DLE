<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <form class="tg-form-panel" @submit.prevent>
    <div class="tg-header">
      <div>
        <div class="tg-title">Telegram</div>
        <div class="tg-step">Шаг 1 из 2</div>
      </div>
    </div>
    <ol class="tg-steps">
      <li>
        Откройте Telegram-бота:<br>
        <a :href="botLink" target="_blank" class="tg-link">{{ botLink }}</a>
        <div class="tg-hint">Ссылка откроется в новом окне</div>
      </li>
      <li>
        Введите код:
        <span class="tg-code">{{ verificationCode }}</span>
        <span class="tg-hint">Скопируйте и отправьте этот код боту</span>
      </li>
    </ol>
    <p v-if="error" class="tg-error">{{ error }}</p>
    <button type="button" class="tg-cancel-btn" @click="$emit('cancel')">Отмена</button>
  </form>
</template>

<script setup>
const props = defineProps({
  botLink: String,
  verificationCode: String,
  error: String
});
const emit = defineEmits(['cancel']);
</script>

<style scoped>
.tg-form-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 1.2rem;
  margin: 0;
  background: none;
  border-radius: 0;
  box-shadow: none;
  padding: 0;
}
.tg-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}
.tg-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--color-primary, #2e7d32);
}
.tg-step {
  font-size: 0.98rem;
  color: var(--color-grey, #888);
}
.tg-steps {
  padding-left: 1.2rem;
  margin-bottom: 0.7rem;
  color: var(--color-dark, #222);
  font-size: 1rem;
  word-break: break-all;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}
.tg-link {
  color: var(--color-primary, #2e7d32);
  word-break: break-all;
  text-decoration: underline;
  font-size: 1.05rem;
  font-weight: 500;
}
.tg-hint {
  font-size: 0.95rem;
  color: var(--color-grey, #888);
  margin-top: 0.2rem;
}
.tg-code {
  display: inline-block;
  background: var(--color-grey-light, #e0e0e0);
  color: #222;
  border-radius: 4px;
  padding: 0.2rem 0.7rem;
  font-weight: bold;
  font-size: 1.1rem;
  letter-spacing: 1px;
  margin-left: 0.5rem;
  height: 44px;
  line-height: 44px;
}
.tg-error {
  color: #d32f2f;
  font-size: 1.05rem;
  margin-top: 0.2rem;
  margin-bottom: 0.2rem;
  text-align: left;
  font-weight: 500;
}
.tg-cancel-btn {
  width: 100%;
  height: 44px;
  background: var(--color-grey-light, #e0e0e0);
  color: var(--color-dark, #222);
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 400;
  margin-bottom: 0;
  margin-top: 0.2rem;
  box-shadow: none;
  transition: none;
}
.tg-cancel-btn:hover {
  background: var(--color-grey, #bdbdbd);
}
</style> 