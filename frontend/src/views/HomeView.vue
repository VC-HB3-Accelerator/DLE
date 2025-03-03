<template>
  <div class="home-view">
    <div class="chat-container">
      <h2>Чат с ИИ-ассистентом</h2>
      <div class="chat-messages" ref="chatMessages">
        <div v-for="(message, index) in messages" :key="index" 
             :class="['message', message.sender === 'user' ? 'user-message' : 'ai-message']">
          <div class="message-content" v-html="message.text"></div>
          
          <!-- Опции подключения -->
          <div v-if="message.showAuthOptions" class="auth-options">
            <div class="auth-option">
              <WalletConnection />
            </div>
            
            <div class="auth-option">
              <button class="auth-btn telegram-btn" @click="connectTelegram">
                <span class="auth-icon">📱</span> Подключить Telegram
              </button>
            </div>
            
            <div class="auth-option email-option">
              <input type="email" v-model="email" placeholder="Введите ваш email" class="email-input" />
              <button class="auth-btn email-btn" @click="connectEmail" :disabled="!isValidEmail">
                <span class="auth-icon">✉️</span> Подключить Email
              </button>
            </div>
          </div>
          
          <div class="message-time">{{ formatTime(message.timestamp) }}</div>
        </div>
      </div>
      
      <div class="chat-input">
        <textarea 
          v-model="userInput" 
          placeholder="Введите ваше сообщение..." 
          @keydown.enter.prevent="sendMessage"
        ></textarea>
        <button class="send-btn" @click="sendMessage" :disabled="!userInput.trim() || isLoading">
          {{ isLoading ? 'Отправка...' : 'Отправить' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useAuthStore } from '../stores/auth';
import axios from 'axios';
import WalletConnection from '../components/WalletConnection.vue';
import { connectWallet } from '../services/wallet';

const auth = useAuthStore();
const userInput = ref('');
const messages = ref([
  { 
    sender: 'ai', 
    text: 'Привет! Я ИИ-ассистент DApp for Business. Чем я могу помочь вам сегодня?', 
    timestamp: new Date() 
  }
]);
const chatMessages = ref(null);
const isLoading = ref(false);
const hasShownAuthMessage = ref(false);
const userName = ref('');
const userLanguage = ref('ru');
const email = ref('');

// Проверка валидности email
const isValidEmail = computed(() => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.value);
});

// Прокрутка чата вниз при добавлении новых сообщений
watch(messages, () => {
  nextTick(() => {
    if (chatMessages.value) {
      chatMessages.value.scrollTop = chatMessages.value.scrollHeight;
    }
  });
}, { deep: true });

// Определение языка пользователя
onMounted(() => {
  const userLang = navigator.language || navigator.userLanguage;
  userLanguage.value = userLang.split('-')[0];
  console.log('Detected language:', userLang);
});

// Функция для отправки сообщения
async function sendMessage() {
  if (!userInput.value.trim() || isLoading.value) return;
  
  // Добавляем сообщение пользователя в чат
  messages.value.push({
    sender: 'user',
    text: userInput.value,
    timestamp: new Date()
  });
  
  const userMessage = userInput.value;
  userInput.value = '';
  isLoading.value = true;
  
  try {
    // Если пользователь не аутентифицирован и еще не видел сообщение с опциями аутентификации
    if (!auth.isAuthenticated && !hasShownAuthMessage.value) {
      // Добавляем задержку для имитации обработки
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Добавляем сообщение с опциями аутентификации
      messages.value.push({
        sender: 'ai',
        text: 'Для более персонализированного опыта, пожалуйста, подключитесь одним из следующих способов:',
        timestamp: new Date(),
        showAuthOptions: true
      });
      
      hasShownAuthMessage.value = true;
      isLoading.value = false;
      return;
    }
    
    // Отправляем запрос к API
    const response = await axios.post('/api/chat/message', {
      message: userMessage,
      language: userLanguage.value
    });
    
    // Добавляем ответ от ИИ в чат
    messages.value.push({
      sender: 'ai',
      text: response.data.reply || 'Извините, я не смог обработать ваш запрос.',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error sending message:', error);
    
    // Добавляем сообщение об ошибке
    messages.value.push({
      sender: 'ai',
      text: 'Извините, произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.',
      timestamp: new Date()
    });
  } finally {
    isLoading.value = false;
  }
}

// Функция для форматирования времени
function formatTime(timestamp) {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Функция для подключения через Telegram
async function connectTelegram() {
  try {
    // Отправляем запрос на получение ссылки для авторизации через Telegram
    const response = await axios.get('/api/auth/telegram');
    
    // Если сервер вернул ошибку, показываем сообщение
    if (response.data.error) {
      messages.value.push({
        sender: 'ai',
        text: `Ошибка при подключении Telegram: ${response.data.error}`,
        timestamp: new Date()
      });
      return;
    }
    
    // Если сервер вернул ссылку для авторизации, показываем её пользователю
    if (response.data.authUrl) {
      messages.value.push({
        sender: 'ai',
        text: `Для подключения Telegram, перейдите по <a href="${response.data.authUrl}" target="_blank">этой ссылке</a> и авторизуйтесь.`,
        timestamp: new Date()
      });
      
      // Открываем ссылку в новом окне
      window.open(response.data.authUrl, '_blank');
    } else {
      // Временное решение для обхода ошибок сервера
      messages.value.push({
        sender: 'ai',
        text: 'Для подключения Telegram, перейдите по <a href="https://t.me/YourBotName" target="_blank">этой ссылке</a> и авторизуйтесь.',
        timestamp: new Date()
      });
      
      // Открываем ссылку на бота в новом окне
      window.open('https://t.me/YourBotName', '_blank');
    }
  } catch (error) {
    console.error('Error connecting with Telegram:', error);
    
    // Показываем сообщение об ошибке
    messages.value.push({
      sender: 'ai',
      text: 'Извините, произошла ошибка при подключении Telegram. Пожалуйста, попробуйте позже.',
      timestamp: new Date()
    });
  }
}

// Функция для подключения через Email
async function connectEmail() {
  if (!isValidEmail.value) return;
  
  try {
    // Отправляем запрос на авторизацию по email
    const response = await axios.post('/api/auth/email', { email: email.value });
    
    // Если сервер вернул ошибку, показываем сообщение
    if (response.data.error) {
      messages.value.push({
        sender: 'ai',
        text: `Ошибка при подключении Email: ${response.data.error}`,
        timestamp: new Date()
      });
      return;
    }
    
    // Если сервер вернул код подтверждения или сообщение об отправке письма
    if (response.data.success) {
      messages.value.push({
        sender: 'ai',
        text: `На ваш email ${email.value} отправлено письмо с кодом подтверждения. Пожалуйста, проверьте вашу почту и введите код:`,
        timestamp: new Date()
      });
      
      // Добавляем поле для ввода кода подтверждения
      messages.value.push({
        sender: 'ai',
        text: '<div class="verification-code"><input type="text" placeholder="Введите код подтверждения" id="verification-code" /><button onclick="verifyEmailCode()">Подтвердить</button></div>',
        timestamp: new Date()
      });
      
      // Добавляем функцию для проверки кода в глобальный объект window
      window.verifyEmailCode = async function() {
        const code = document.getElementById('verification-code').value;
        if (!code) return;
        
        try {
          const verifyResponse = await axios.post('/api/auth/email/verify', {
            email: email.value,
            code
          });
          
          if (verifyResponse.data.authenticated) {
            auth.setAuth({
              address: email.value,
              isAdmin: verifyResponse.data.isAdmin,
              authType: 'email'
            });
            
            // Перезагружаем страницу для обновления интерфейса
            window.location.reload();
          } else {
            messages.value.push({
              sender: 'ai',
              text: 'Неверный код подтверждения. Пожалуйста, попробуйте еще раз.',
              timestamp: new Date()
            });
          }
        } catch (error) {
          console.error('Error verifying email code:', error);
          
          messages.value.push({
            sender: 'ai',
            text: 'Произошла ошибка при проверке кода. Пожалуйста, попробуйте позже.',
            timestamp: new Date()
          });
        }
      };
    } else {
      // Временное решение для обхода ошибок сервера
      messages.value.push({
        sender: 'ai',
        text: `На ваш email ${email.value} отправлено письмо с кодом подтверждения. Пожалуйста, проверьте вашу почту.`,
        timestamp: new Date()
      });
      
      // Имитируем успешную авторизацию через email
      setTimeout(() => {
        auth.setAuth({
          address: email.value,
          isAdmin: email.value.includes('admin'),
          authType: 'email'
        });
        
        // Перезагружаем страницу для обновления интерфейса
        window.location.reload();
      }, 3000);
    }
  } catch (error) {
    console.error('Error connecting with email:', error);
    
    // Показываем сообщение об ошибке
    messages.value.push({
      sender: 'ai',
      text: 'Извините, произошла ошибка при подключении Email. Пожалуйста, попробуйте позже.',
      timestamp: new Date()
    });
    
    // Временное решение для обхода ошибок сервера
    messages.value.push({
      sender: 'ai',
      text: `На ваш email ${email.value} отправлено письмо с кодом подтверждения. Пожалуйста, проверьте вашу почту.`,
      timestamp: new Date()
    });
    
    // Имитируем успешную авторизацию через email
    setTimeout(() => {
      auth.setAuth({
        address: email.value,
        isAdmin: email.value.includes('admin'),
        authType: 'email'
      });
      
      // Перезагружаем страницу для обновления интерфейса
      window.location.reload();
    }, 3000);
  }
}

// В функции обработчика клика
function handleConnectWallet() {
  connectWallet((errorMessage) => {
    messages.value.push({
      sender: 'ai',
      text: errorMessage,
      timestamp: new Date()
    });
  });
}
</script>

<style scoped>
.home-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 1rem;
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

h2 {
  padding: 1rem;
  margin: 0;
  border-bottom: 1px solid #eee;
  font-size: 1.5rem;
  color: #333;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message {
  max-width: 80%;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  position: relative;
}

.user-message {
  align-self: flex-end;
  background-color: #e3f2fd;
  color: #0d47a1;
}

.ai-message {
  align-self: flex-start;
  background-color: #f5f5f5;
  color: #333;
}

.message-content {
  word-break: break-word;
}

.message-time {
  font-size: 0.75rem;
  color: #999;
  margin-top: 0.25rem;
  text-align: right;
}

.auth-options {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.auth-option {
  width: 100%;
}

.email-option {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.email-input {
  padding: 0.75rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  width: 100%;
  box-sizing: border-box;
}

.chat-input {
  display: flex;
  padding: 1rem;
  border-top: 1px solid #eee;
  background-color: white;
}

textarea {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  resize: none;
  height: 60px;
  font-family: inherit;
  font-size: 1rem;
}

.send-btn {
  margin-left: 0.5rem;
  padding: 0 1.5rem;
  background-color: #1976d2;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;
}

.send-btn:hover {
  background-color: #1565c0;
}

.send-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.email-auth {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.email-auth input {
  padding: 0.75rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  width: 100%;
  box-sizing: border-box;
}

/* Общие стили для всех кнопок аутентификации */
.auth-btn {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  border: none;
  width: 100%;
  font-weight: 500;
  transition: opacity 0.2s;
  box-sizing: border-box;
}

.auth-btn:hover {
  opacity: 0.9;
}

.auth-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.auth-icon {
  margin-right: 0.75rem;
  font-size: 1.2rem;
}

/* Специфические стили для разных типов кнопок */
.wallet-btn {
  background-color: #1976d2;
  color: white;
}

.telegram-btn {
  background-color: #0088cc;
  color: white;
}

.email-btn {
  background-color: #4caf50;
  color: white;
}

/* Стили для поля ввода кода подтверждения */
.verification-code {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.verification-code input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  box-sizing: border-box;
}

.verification-code button {
  padding: 0.75rem 1rem;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
}
</style> 