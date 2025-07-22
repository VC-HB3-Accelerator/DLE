/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/HB3-ACCELERATOR
 */

import { ref, onUnmounted } from 'vue';
import api from '../api/axios';
import { useAuthContext } from './useAuth';
import { useNotifications } from './useNotifications';

export function useAuthFlow(options = {}) {
  const { onAuthSuccess } = options; // Callback после успешной аутентификации/привязки

  const auth = useAuthContext();
  const { showSuccessMessage, showErrorMessage } = useNotifications();

  // Состояния Telegram
  const telegramAuth = ref({
    showVerification: false,
    verificationCode: '',
    botLink: '',
    checkInterval: null,
    error: '',
    isLoading: false, // Добавим isLoading
  });

  // Состояния Email
  const emailAuth = ref({
    showForm: false,
    showVerification: false,
    email: '',
    verificationEmail: '', // Храним email, на который отправили код
    verificationCode: '',
    formatError: false,
    isLoading: false, // Для отправки запроса на init
    isVerifying: false, // Для проверки кода
    error: '',
  });

  // --- Telegram --- 

  const clearTelegramInterval = () => {
    if (telegramAuth.value.checkInterval) {
      clearInterval(telegramAuth.value.checkInterval);
      telegramAuth.value.checkInterval = null;
      console.log('[useAuthFlow] Интервал проверки Telegram авторизации очищен');
    }
  };

  const handleTelegramAuth = async () => {
    if (telegramAuth.value.isLoading) return;
    telegramAuth.value.isLoading = true;
    telegramAuth.value.error = '';
    try {
      const response = await api.post('/auth/telegram/init');
      if (response.data.success) {
        telegramAuth.value.verificationCode = response.data.verificationCode;
        telegramAuth.value.botLink = response.data.botLink;
        telegramAuth.value.showVerification = true;

        // Начинаем проверку статуса
        clearTelegramInterval(); // На всякий случай
        telegramAuth.value.checkInterval = setInterval(async () => {
          try {
            console.log('[useAuthFlow] Проверка статуса Telegram...');
            // Используем checkAuth из useAuth для обновления состояния
            const checkResponse = await auth.checkAuth();
            const telegramId = auth.telegramId.value;

            if (auth.isAuthenticated.value && telegramId) {
              console.log('[useAuthFlow] Telegram успешно связан/подтвержден.');
              clearTelegramInterval();
              telegramAuth.value.showVerification = false;
              telegramAuth.value.verificationCode = '';
              telegramAuth.value.error = '';

              showSuccessMessage('Telegram успешно подключен!');
              if (onAuthSuccess) onAuthSuccess('telegram'); // Вызываем callback
              // Нет необходимости продолжать интервал
              return;
            }
          } catch (intervalError) {
            console.error('[useAuthFlow] Ошибка при проверке статуса Telegram в интервале:', intervalError);
            // Решаем, останавливать ли интервал при ошибке
            // telegramAuth.value.error = 'Ошибка проверки статуса Telegram.';
            // clearTelegramInterval();
          }
        }, 3000); // Проверяем каждые 3 секунды

      } else {
        telegramAuth.value.error = response.data.error || 'Ошибка инициализации Telegram';
        showErrorMessage(telegramAuth.value.error);
      }
    } catch (error) {
      console.error('[useAuthFlow] Ошибка инициализации Telegram аутентификации:', error);
      const message = error?.response?.data?.error || 'Ошибка при инициализации аутентификации через Telegram';
      telegramAuth.value.error = message;
      showErrorMessage(message);
    } finally {
      telegramAuth.value.isLoading = false;
    }
  };

  const cancelTelegramAuth = () => {
    clearTelegramInterval();
    telegramAuth.value.showVerification = false;
    telegramAuth.value.verificationCode = '';
    telegramAuth.value.error = '';
    telegramAuth.value.isLoading = false;
    console.log('[useAuthFlow] Аутентификация Telegram отменена');
  };

  // --- Email --- 

  const showEmailForm = () => {
    emailAuth.value.showForm = true;
    emailAuth.value.showVerification = false;
    emailAuth.value.email = '';
    emailAuth.value.formatError = false;
    emailAuth.value.error = '';
    emailAuth.value.isLoading = false;
    emailAuth.value.isVerifying = false;
  };

  const sendEmailVerification = async () => {
    emailAuth.value.formatError = false;
    emailAuth.value.error = '';

    if (!emailAuth.value.email || !emailAuth.value.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      emailAuth.value.formatError = true;
      return;
    }

    if (emailAuth.value.isLoading) return;
    emailAuth.value.isLoading = true;

    try {
      const response = await api.post('/auth/email/init', { email: emailAuth.value.email });
      if (response.data.success) {
        emailAuth.value.verificationEmail = emailAuth.value.email; // Сохраняем email
        emailAuth.value.showForm = false;
        emailAuth.value.showVerification = true;
        emailAuth.value.verificationCode = ''; // Очищаем поле кода
        console.log('[useAuthFlow] Код верификации Email отправлен на:', emailAuth.value.verificationEmail);
      } else {
        emailAuth.value.error = response.data.error || 'Ошибка инициализации аутентификации по email';
        showErrorMessage(emailAuth.value.error);
      }
    } catch (error) {
      console.error('[useAuthFlow] Ошибка при запросе инициализации Email:', error);
      const message = error?.response?.data?.error || 'Ошибка при запросе кода подтверждения';
      emailAuth.value.error = message;
      showErrorMessage(message);
    } finally {
      emailAuth.value.isLoading = false;
    }
  };

  const verifyEmailCode = async () => {
    emailAuth.value.error = '';
    if (!emailAuth.value.verificationCode) {
      emailAuth.value.error = 'Пожалуйста, введите код верификации';
      return;
    }
    if (emailAuth.value.isVerifying) return;
    emailAuth.value.isVerifying = true;

    try {
      const response = await api.post('/auth/email/verify-code', {
        email: emailAuth.value.verificationEmail,
        code: emailAuth.value.verificationCode,
      });

      if (response.data.success) {
        console.log('[useAuthFlow] Email успешно подтвержден:', emailAuth.value.verificationEmail);
        emailAuth.value.showForm = false;
        emailAuth.value.showVerification = false;
        emailAuth.value.error = '';

        // Обновляем состояние аутентификации через useAuth
        await auth.checkAuth(); 
        showSuccessMessage(`Email ${emailAuth.value.verificationEmail} успешно подтвержден!`);

        if (onAuthSuccess) onAuthSuccess('email'); // Вызываем callback

      } else {
        emailAuth.value.error = response.data.message || 'Неверный код верификации';
        // Не используем showErrorMessage здесь, т.к. ошибка отображается локально в форме
      }
    } catch (error) {
        console.error('[useAuthFlow] Ошибка проверки кода Email:', error);
        const message = error?.response?.data?.error || 'Ошибка при проверке кода';
        emailAuth.value.error = message;
        // Не используем showErrorMessage здесь
    } finally {
      emailAuth.value.isVerifying = false;
    }
  };

  const cancelEmailAuth = () => {
    emailAuth.value.showForm = false;
    emailAuth.value.showVerification = false;
    emailAuth.value.email = '';
    emailAuth.value.verificationCode = '';
    emailAuth.value.error = '';
    emailAuth.value.formatError = false;
    emailAuth.value.isLoading = false;
    emailAuth.value.isVerifying = false;
    console.log('[useAuthFlow] Аутентификация Email отменена');
  };

  // Очистка интервала при размонтировании
  onUnmounted(() => {
    clearTelegramInterval();
  });

  return {
    telegramAuth,
    handleTelegramAuth,
    cancelTelegramAuth,

    emailAuth,
    showEmailForm,
    sendEmailVerification,
    verifyEmailCode,
    cancelEmailAuth,
  };
} 