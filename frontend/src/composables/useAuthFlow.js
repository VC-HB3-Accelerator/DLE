/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 *
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

import { ref, onUnmounted } from 'vue';
import api from '../api/axios';
import { useAuthContext } from './useAuth';
import { useNotifications } from './useNotifications';
import { i18n } from '@/locales/index.js';

const t = (key, params) => i18n.global.t(key, params);

const TELEGRAM_POLL_MS = 3000;
const TELEGRAM_TIMEOUT_MS = 10 * 60 * 1000;

export function useAuthFlow(options = {}) {
  const { onAuthSuccess } = options;

  const auth = useAuthContext();
  const { showSuccessMessage, showErrorMessage } = useNotifications();

  const telegramAuth = ref({
    showVerification: false,
    botLink: '',
    checkInterval: null,
    timeoutTimer: null,
    error: '',
    isLoading: false,
    hadTelegramBefore: false,
  });

  const emailAuth = ref({
    showForm: false,
    showVerification: false,
    email: '',
    verificationEmail: '',
    verificationCode: '',
    formatError: false,
    isLoading: false,
    isVerifying: false,
    error: '',
  });

  const passwordAuth = ref({
    showStub: false,
  });

  const clearTelegramInterval = () => {
    if (telegramAuth.value.checkInterval) {
      clearInterval(telegramAuth.value.checkInterval);
      telegramAuth.value.checkInterval = null;
    }
    if (telegramAuth.value.timeoutTimer) {
      clearTimeout(telegramAuth.value.timeoutTimer);
      telegramAuth.value.timeoutTimer = null;
    }
  };

  const startTelegramPolling = () => {
    clearTelegramInterval();
    const startedAt = Date.now();
    telegramAuth.value.timeoutTimer = setTimeout(() => {
      clearTelegramInterval();
      telegramAuth.value.error = t('auth.flow.telegramTimeout');
      showErrorMessage(telegramAuth.value.error);
    }, TELEGRAM_TIMEOUT_MS);

    telegramAuth.value.checkInterval = setInterval(async () => {
      try {
        if (Date.now() - startedAt > TELEGRAM_TIMEOUT_MS) return;
        await auth.checkAuth();
        const telegramId = auth.telegramId?.value;
        const linkedNow = Boolean(telegramId);
        const successGuest = auth.isAuthenticated.value && linkedNow;
        const successLink =
          auth.isAuthenticated.value &&
          linkedNow &&
          telegramAuth.value.hadTelegramBefore === false;

        if (successGuest || successLink) {
          clearTelegramInterval();
          telegramAuth.value.showVerification = false;
          telegramAuth.value.botLink = '';
          telegramAuth.value.error = '';
          showSuccessMessage(t('auth.flow.telegramConnectedSuccess'));
          if (onAuthSuccess) onAuthSuccess('telegram');
        }
      } catch (_) {
        /* keep polling */
      }
    }, TELEGRAM_POLL_MS);
  };

  /** Открыть панель согласия (без API). */
  const handleTelegramAuth = () => {
    telegramAuth.value.error = '';
    telegramAuth.value.botLink = '';
    telegramAuth.value.hadTelegramBefore = Boolean(auth.telegramId?.value);
    telegramAuth.value.showVerification = true;
  };

  /** После галочки: init + deep-link + polling. */
  const confirmTelegramDeeplink = async () => {
    if (telegramAuth.value.isLoading) return null;
    telegramAuth.value.isLoading = true;
    telegramAuth.value.error = '';
    telegramAuth.value.botLink = '';
    try {
      const response = await api.post('/auth/telegram/init', { privacyAccepted: true });
      if (response.data.success && response.data.botLink) {
        telegramAuth.value.botLink = response.data.botLink;
        startTelegramPolling();
        return response.data.botLink;
      }
      telegramAuth.value.error = response.data.error || t('auth.flow.telegramInitFailed');
      showErrorMessage(telegramAuth.value.error);
      return null;
    } catch (error) {
      const message = error?.response?.data?.error || t('auth.flow.telegramInitError');
      telegramAuth.value.error = message;
      showErrorMessage(message);
      return null;
    } finally {
      telegramAuth.value.isLoading = false;
    }
  };

  const cancelTelegramAuth = () => {
    clearTelegramInterval();
    telegramAuth.value.showVerification = false;
    telegramAuth.value.botLink = '';
    telegramAuth.value.error = '';
    telegramAuth.value.isLoading = false;
  };

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
        emailAuth.value.verificationEmail = emailAuth.value.email;
        emailAuth.value.showForm = false;
        emailAuth.value.showVerification = true;
        emailAuth.value.verificationCode = '';
      } else {
        emailAuth.value.error = response.data.error || t('auth.flow.emailInitFailed');
        showErrorMessage(emailAuth.value.error);
      }
    } catch (error) {
      const message = error?.response?.data?.error || t('auth.flow.emailCodeRequestError');
      emailAuth.value.error = message;
      showErrorMessage(message);
    } finally {
      emailAuth.value.isLoading = false;
    }
  };

  const verifyEmailCode = async () => {
    emailAuth.value.error = '';
    if (!emailAuth.value.verificationCode) {
      emailAuth.value.error = t('auth.flow.verificationCodeRequired');
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
        emailAuth.value.showForm = false;
        emailAuth.value.showVerification = false;
        emailAuth.value.error = '';
        await auth.checkAuth();
        showSuccessMessage(
          t('auth.flow.emailVerifiedSuccess', { email: emailAuth.value.verificationEmail })
        );
        if (onAuthSuccess) onAuthSuccess('email');
      } else {
        emailAuth.value.error = response.data.message || t('auth.flow.invalidVerificationCode');
      }
    } catch (error) {
      const message = error?.response?.data?.error || t('auth.flow.verifyCodeError');
      emailAuth.value.error = message;
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
  };

  const showPasswordStub = () => {
    passwordAuth.value.showStub = true;
  };

  const cancelPasswordAuth = () => {
    passwordAuth.value.showStub = false;
  };

  onUnmounted(() => {
    clearTelegramInterval();
  });

  return {
    telegramAuth,
    handleTelegramAuth,
    confirmTelegramDeeplink,
    cancelTelegramAuth,

    emailAuth,
    showEmailForm,
    sendEmailVerification,
    verifyEmailCode,
    cancelEmailAuth,

    passwordAuth,
    showPasswordStub,
    cancelPasswordAuth,
  };
}
