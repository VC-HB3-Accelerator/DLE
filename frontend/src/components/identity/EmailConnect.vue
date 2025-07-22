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
  <div class="email-connection">
    <form @submit.prevent="showVerification ? verifyCode() : requestCode()" class="email-form-panel">
      <div class="form-header">
        <div>
          <div class="form-title">Email</div>
          <div class="form-step">{{ showVerification ? 'Шаг 2 из 2' : 'Шаг 1 из 2' }}</div>
        </div>
      </div>
    <div v-if="!showVerification" class="email-form">
        <label for="email-input" class="form-label">Email</label>
        <input id="email-input" v-model="email" type="email" placeholder="Введите email" class="email-input" :disabled="isLoading" autocomplete="email" />
        <div class="form-hint">На этот адрес придёт код подтверждения</div>
        <button type="submit" :disabled="isLoading || !isValidEmail" class="email-btn main-btn">
        {{ isLoading ? 'Отправка...' : 'Получить код' }}
      </button>
    </div>
    <div v-else class="verification-form">
        <p class="verification-info success-msg">Код отправлен на <b>{{ email }}</b></p>
        <label for="code-input" class="form-label">Код</label>
        <input id="code-input" v-model="code" type="text" placeholder="Введите код из письма" class="code-input" :disabled="isLoading" autocomplete="one-time-code" />
        <div class="form-hint">Проверьте почту и введите код из письма</div>
        <button type="submit" :disabled="isLoading || !code" class="verify-btn main-btn">
        {{ isLoading ? 'Проверка...' : 'Подтвердить' }}
      </button>
        <button type="button" class="reset-btn link-btn" @click="resetForm" :disabled="isLoading">Изменить email</button>
      </div>
      <div v-if="error" class="error-msg">{{ error }}</div>
      <div class="actions">
        <slot name="actions">
          <button type="button" class="cancel-btn" @click="$emit('close')" :disabled="isLoading">Отмена</button>
        </slot>
    </div>
    </form>
  </div>
</template>

<script setup>
  import { ref, computed } from 'vue';
  import axios from '@/api/axios';
  import { useAuthContext } from '@/composables/useAuth';

const emit = defineEmits(['close', 'success']);
  const { linkIdentity } = useAuthContext();

  const email = ref('');
  const code = ref('');
  const error = ref('');
  const isLoading = ref(false);
  const showVerification = ref(false);

  const isValidEmail = computed(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value);
  });

  const requestCode = async () => {
    try {
      isLoading.value = true;
      error.value = '';
    const response = await axios.post('/auth/email/request', {
        email: email.value,
      });
      if (response.data.success) {
        showVerification.value = true;
      } else {
        error.value = response.data.error || 'Ошибка отправки кода';
      }
    } catch (err) {
      error.value = err.response?.data?.error || 'Ошибка отправки кода';
    } finally {
      isLoading.value = false;
    }
  };

  const verifyCode = async () => {
    try {
      isLoading.value = true;
      error.value = '';
    const response = await axios.post('/auth/email/verify-code', {
        email: email.value,
        code: code.value,
      });
      if (response.data.success) {
      emit('success');
      } else {
        error.value = response.data.error || 'Неверный код';
      }
    } catch (err) {
      error.value = err.response?.data?.error || 'Ошибка проверки кода';
    } finally {
      isLoading.value = false;
    }
  };

  const resetForm = () => {
    email.value = '';
    code.value = '';
    error.value = '';
    showVerification.value = false;
  };
</script>

<style scoped>
.email-connection {
  width: 100%;
  display: flex;
  justify-content: center;
}
.email-form-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 1.2rem;
  margin: 0;
  padding: 0;
  background: none;
  border-radius: 0;
  box-shadow: none;
}
.form-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}
.form-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--color-primary, #2e7d32);
}
.form-step {
  font-size: 0.98rem;
  color: var(--color-grey, #888);
}
.form-label {
  font-size: 1rem;
  color: var(--color-primary, #2e7d32);
  margin-bottom: 0.3rem;
  font-weight: 500;
}
.form-hint {
  font-size: 0.95rem;
  color: var(--color-grey, #888);
  margin-bottom: 0.5rem;
  margin-top: -0.3rem;
}
.email-input, .code-input {
  border: 1px solid var(--color-grey, #ccc);
  border-radius: 4px;
  padding: 0 1rem;
  font-size: 1rem;
  margin-bottom: 0.7rem;
  outline: none;
  width: 100%;
  height: 44px;
  box-shadow: none;
  transition: none;
}
.email-input:focus, .code-input:focus {
  border-color: var(--color-primary, #2e7d32);
}
.email-btn, .verify-btn, .main-btn, .cancel-btn {
  width: 100%;
  height: 44px;
  background: var(--color-primary, #2e7d32);
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 1.05rem;
  cursor: pointer;
  margin-bottom: 0.5rem;
  font-weight: 500;
  box-shadow: none;
  transition: none;
}
.email-btn:disabled, .verify-btn:disabled, .main-btn:disabled {
  background: var(--color-grey-light, #e0e0e0);
  color: #aaa;
  cursor: not-allowed;
}
.reset-btn.link-btn {
  background: none;
  border: none;
  color: var(--color-primary, #2e7d32);
  text-decoration: underline;
  cursor: pointer;
  font-size: 0.95rem;
  margin-top: 0.2rem;
  margin-bottom: 0.5rem;
  width: 100%;
  height: 44px;
  text-align: left;
  padding-left: 0;
}
.reset-btn.link-btn:disabled {
  color: #aaa;
  cursor: not-allowed;
}
.error-msg {
  color: #d32f2f;
  font-size: 1.05rem;
  margin-top: 0.2rem;
  margin-bottom: 0.2rem;
  text-align: left;
  font-weight: 500;
}
.success-msg {
  color: var(--color-primary, #2e7d32);
  font-size: 1.05rem;
  font-weight: 500;
}
.verification-info {
  margin-bottom: 0.7rem;
}
.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}
.cancel-btn {
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
.cancel-btn:hover {
  background: var(--color-grey, #bdbdbd);
}
</style>
