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
  <div class="notification-container">
    <transition name="fade">
      <div v-if="notifications.showSuccess" class="notification success">
        <span class="icon">✅</span>
        <span class="message">{{ notifications.successMessage }}</span>
        <!-- <button @click="hideSuccess" class="close-btn">&times;</button> -->
      </div>
    </transition>
    <transition name="fade">
      <div v-if="notifications.showError" class="notification error">
        <span class="icon">❌</span>
        <span class="message">{{ notifications.errorMessage }}</span>
        <!-- <button @click="hideError" class="close-btn">&times;</button> -->
      </div>
    </transition>
    <!-- Можно добавить info/warning по аналогии -->
  </div>
</template>

<script setup>
import { defineProps } from 'vue';
// Если нужна возможность закрывать вручную, импортируем useNotifications и используем hide* функции
// import { useNotifications } from '../composables/useNotifications'; 

const props = defineProps({
  notifications: {
    type: Object,
    required: true,
    default: () => ({
      successMessage: '',
      showSuccess: false,
      errorMessage: '',
      showError: false,
    })
  }
});

// Пример, если нужно закрытие вручную
// const { hideSuccessMessage, hideErrorMessage } = useNotifications();
// const hideSuccess = () => { hideSuccessMessage(); };
// const hideError = () => { hideErrorMessage(); };

</script>

<style scoped>
.notification-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notification {
  display: flex;
  align-items: center;
  padding: 12px 18px;
  border-radius: var(--radius-md, 8px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  color: var(--color-white, #fff);
  min-width: 250px;
  max-width: 400px; /* Ограничиваем ширину */
  word-wrap: break-word; /* Перенос длинных слов */
}

.notification.success {
  background-color: var(--color-success, #4CAF50);
}

.notification.error {
  background-color: var(--color-danger, #f44336);
}

.icon {
  margin-right: 10px;
  font-size: 1.2em;
}

.message {
  flex-grow: 1;
}

/* Анимация появления/исчезновения */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

/* Стили для кнопки закрытия (если нужна) */
/*
.close-btn {
  background: none;
  border: none;
  color: inherit;
  font-size: 1.2em;
  cursor: pointer;
  padding: 0 0 0 10px;
  opacity: 0.7;
}
.close-btn:hover {
  opacity: 1;
}
*/
</style> 