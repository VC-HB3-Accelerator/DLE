/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

import { ref } from 'vue';

/** Общее состояние — один тост на всё приложение (BaseLayout / любой компонент). */
const notifications = ref({
  successMessage: '',
  showSuccess: false,
  errorMessage: '',
  showError: false,
});

let successTimeout = null;
let errorTimeout = null;

function showSuccessMessage(message, duration = 3000) {
  clearTimeout(successTimeout);
  notifications.value.successMessage = message;
  notifications.value.showSuccess = true;
  successTimeout = setTimeout(() => {
    notifications.value.showSuccess = false;
  }, duration);
}

function showErrorMessage(message, duration = 3000) {
  clearTimeout(errorTimeout);
  notifications.value.errorMessage = message;
  notifications.value.showError = true;
  errorTimeout = setTimeout(() => {
    notifications.value.showError = false;
  }, duration);
}

function hideSuccessMessage() {
  clearTimeout(successTimeout);
  notifications.value.showSuccess = false;
}

function hideErrorMessage() {
  clearTimeout(errorTimeout);
  notifications.value.showError = false;
}

export function useNotifications() {
  return {
    notifications,
    showSuccessMessage,
    showErrorMessage,
    hideSuccessMessage,
    hideErrorMessage,
  };
}
