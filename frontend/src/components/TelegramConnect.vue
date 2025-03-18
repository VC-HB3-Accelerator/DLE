<template>
  <div class="telegram-auth">
    <button v-if="!showVerification" class="auth-btn telegram-btn" @click="startTelegramAuth">
      <span class="auth-icon">📱</span> Подключить Telegram
    </button>
    
    <div v-else class="verification-form">
      <input 
        type="text" 
        v-model="verificationCode"
        placeholder="Введите код из Telegram"
      />
      <button class="auth-btn verify-btn" @click="verifyCode">Подтвердить</button>
      <button class="auth-btn cancel-btn" @click="cancelVerification">Отмена</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import axios from '../api/axios';

const auth = useAuthStore();
const showVerification = ref(false);
const verificationCode = ref('');

const startTelegramAuth = () => {
  // Открываем Telegram бота в новом окне
  window.open('https://t.me/your_bot_username', '_blank');
  showVerification.value = true;
};

const verifyCode = async () => {
  try {
    const response = await axios.post('/api/auth/telegram/verify', {
      code: verificationCode.value
    });
    
    if (response.data.success) {
      auth.setTelegramAuth(response.data);
    }
  } catch (error) {
    console.error('Error verifying Telegram code:', error);
  }
};

const cancelVerification = () => {
  showVerification.value = false;
  verificationCode.value = '';
};
</script>

<style scoped>
.telegram-auth {
  margin-bottom: 15px;
}

.telegram-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #0088cc;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  font-weight: bold;
  cursor: pointer;
  width: 100%;
}

.auth-icon {
  margin-right: 8px;
}

.auth-progress {
  background-color: #f8f8f8;
  border-radius: 8px;
  padding: 16px;
  margin-top: 10px;
}

.auth-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 15px;
}

.cancel-btn {
  background-color: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
  cursor: pointer;
}

.check-btn {
  background-color: #0088cc;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px;
  cursor: pointer;
  font-weight: bold;
}

.error-message {
  color: #ff4d4f;
  margin-top: 10px;
  font-size: 14px;
}

.auth-code {
  font-family: monospace;
  font-size: 16px;
  padding: 12px;
  background-color: #f1f1f1;
  border-radius: 4px;
  margin: 15px 0;
  white-space: nowrap;
  overflow-x: auto;
}

.copy-btn {
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: bold;
  display: block;
  margin-bottom: 15px;
}

.copy-btn:hover {
  background-color: #45a049;
}
</style> 