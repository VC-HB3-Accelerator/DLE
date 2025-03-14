<template>
  <div class="telegram-auth">
    <div v-if="!isAuthenticating">
      <a :href="telegramBotLink" target="_blank" class="telegram-btn" @click="startAuth">
        <span class="auth-icon">📱</span> Подключить Telegram
      </a>
    </div>
    
    <div v-else class="auth-progress">
      <p>Для завершения авторизации:</p>
      <ol>
        <li>Перейдите в Telegram-бота <strong>@{{ botUsername }}</strong></li>
        <li>Если бот не открылся автоматически, скопируйте и отправьте ему команду:</li>
      </ol>
      
      <div class="auth-code">
        /auth {{ authToken }}
      </div>
      <button class="copy-btn" @click="copyAuthCommand">Копировать команду</button>
      
      <div class="auth-actions">
        <button class="cancel-btn" @click="cancelAuth">Отмена</button>
        <button class="check-btn" @click="checkAuthStatus">Проверить статус</button>
      </div>
      
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

const isAuthenticating = ref(false);
const authToken = ref('');
const botUsername = ref(process.env.VUE_APP_TELEGRAM_BOT_USERNAME || 'HB3_Accelerator_Bot');
const errorMessage = ref('');
const checkInterval = ref(null);

// Формируем ссылку на бота с параметром авторизации
const telegramBotLink = computed(() => {
  // Возвращаем ссылку только если есть токен
  if (!authToken.value) return `https://t.me/${botUsername.value}`;
  return `https://t.me/${botUsername.value}?start=auth_${authToken.value}`;
});

async function startAuth() {
  try {
    // Сначала запрашиваем токен
    const response = await auth.createTelegramAuthToken();
    
    if (response.success) {
      authToken.value = response.token;
      
      // Теперь можно включить режим авторизации
      isAuthenticating.value = true;
      
      // И запустить проверку
      checkInterval.value = setInterval(checkAuthStatus, 3000);
      
      // Открываем Telegram
      console.log(`Открывается ссылка на Telegram: ${telegramBotLink.value}`);
      window.open(telegramBotLink.value, '_blank');
    } else {
      errorMessage.value = response.error || 'Не удалось начать авторизацию';
    }
  } catch (error) {
    console.error('Error starting Telegram auth:', error);
    errorMessage.value = 'Ошибка при инициализации авторизации';
  }
}

async function checkAuthStatus() {
  try {
    const response = await auth.checkTelegramAuthStatus(authToken.value);
    
    if (response.success && response.authenticated) {
      // Авторизация успешна, очищаем интервал и состояние
      clearInterval(checkInterval.value);
      isAuthenticating.value = false;
      
      // Здесь можно добавить дополнительные действия после успешной авторизации
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
  }
}

function cancelAuth() {
  clearInterval(checkInterval.value);
  isAuthenticating.value = false;
  authToken.value = '';
  errorMessage.value = '';
}

function copyAuthCommand() {
  const command = `/auth ${authToken.value}`;
  navigator.clipboard.writeText(command);
  // Можно добавить уведомление о копировании
}
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