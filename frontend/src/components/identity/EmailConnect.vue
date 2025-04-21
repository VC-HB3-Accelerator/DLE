<template>
  <div class="email-connection">
    <div v-if="!showVerification" class="email-form">
      <input v-model="email" type="email" placeholder="Введите email" class="email-input" />
      <button :disabled="isLoading || !isValidEmail" class="email-btn" @click="requestCode">
        {{ isLoading ? 'Отправка...' : 'Получить код' }}
      </button>
    </div>
    <div v-else class="verification-form">
      <p class="verification-info">Код отправлен на {{ email }}</p>
      <input v-model="code" type="text" placeholder="Введите код" class="code-input" />
      <button :disabled="isLoading || !code" class="verify-btn" @click="verifyCode">
        {{ isLoading ? 'Проверка...' : 'Подтвердить' }}
      </button>
      <button class="reset-btn" @click="resetForm">Изменить email</button>
    </div>
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script setup>
  import { ref, computed } from 'vue';
  import axios from '@/api/axios';
  import { useAuth } from '@/composables/useAuth';

  const emit = defineEmits(['close']);
  const { linkIdentity } = useAuth();

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

      const response = await axios.post('/api/auth/email/request-verification', {
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

      const response = await axios.post('/api/auth/email/verify', {
        email: email.value,
        code: code.value,
      });

      if (response.data.success) {
        // Связываем email с текущим пользователем
        await linkIdentity('email', email.value);
        emit('close');
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
