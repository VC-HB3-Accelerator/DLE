<template>
  <div class="email-connection">
    <div v-if="!showVerification">
      <input 
        v-model="email"
        type="email"
        placeholder="Введите email"
        class="email-input"
      />
      <button 
        @click="requestCode"
        :disabled="isLoading || !isValidEmail"
        class="email-btn"
      >
        Получить код
      </button>
    </div>
    <div v-else>
      <input 
        v-model="code"
        type="text"
        placeholder="Введите код"
        class="code-input"
      />
      <button 
        @click="verifyCode"
        :disabled="isLoading"
        class="verify-btn"
      >
        Подтвердить
      </button>
    </div>
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import axios from 'axios';

const props = defineProps({
  onEmailAuth: {
    type: Function,
    required: true
  }
});

const email = ref('');
const code = ref('');
const error = ref('');
const isLoading = ref(false);
const showVerification = ref(false);
const isConnecting = ref(false);

const isValidEmail = computed(() => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value);
});

const requestCode = async () => {
  try {
    isLoading.value = true;
    await props.onEmailAuth(email.value);
    showVerification.value = true;
    error.value = '';
  } catch (err) {
    error.value = err.message || 'Ошибка отправки кода';
  } finally {
    isLoading.value = false;
  }
};

const verifyCode = async () => {
  try {
    isLoading.value = true;
    await props.onEmailAuth(email.value, code.value);
    error.value = '';
  } catch (err) {
    error.value = err.message || 'Неверный код';
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.email-connection {
  margin: 10px 0;
}

.email-input,
.code-input {
  padding: 8px;
  margin-right: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.email-btn,
.verify-btn {
  padding: 10px 20px;
  background-color: #48bb78;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.error {
  color: #e53e3e;
  margin-top: 5px;
  font-size: 14px;
}

button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
