<template>
  <div class="home">
    <h1>✌️ HB3 - Accelerator DLE (Digital Legal Entity - DAO Fork)</h1>
    
    <div class="auth-section" v-if="!auth.isAuthenticated">
      <h3>Венчурный фонд и поставщик программного обеспечения</h3>
    </div>
    <div class="chat-container">
      <div class="chat-header">
        <WalletConnection 
          :onWalletAuth="handleWalletAuth"
          :isAuthenticated="auth.isAuthenticated"
        />
        <div class="user-info" v-if="auth.isAuthenticated">
        </div>
      </div>
      
      <!-- Кнопка загрузки предыдущих сообщений -->
      <div v-if="hasMoreMessages" class="load-more-container">
        <button @click="loadMoreMessages" class="load-more-btn" :disabled="isLoadingMore">
          {{ isLoadingMore ? 'Загрузка...' : 'Показать предыдущие сообщения' }}
        </button>
      </div>

      <div class="chat-messages" ref="messagesContainer">
        <div v-for="message in messages" :key="message.id" :class="['message', message.role === 'assistant' ? 'ai-message' : 'user-message']">
          <div class="message-content">
            {{ message.content }}
          </div>
        
          <!-- Кнопки аутентификации -->
          <div v-if="message.showAuthButtons && !auth.isAuthenticated" class="auth-buttons">
            <button class="auth-btn wallet-btn" @click="handleWalletAuth">
              <span class="auth-icon">👛</span> Подключить кошелек
            </button>
            <button class="auth-btn telegram-btn" @click="handleTelegramAuth">
              <span class="auth-icon">📱</span> Подключить Telegram
            </button>
            <button class="auth-btn email-btn" @click="handleEmailAuth">
              <span class="auth-icon">✉️</span> Подключить Email
            </button>
          </div>
          
          <!-- Email форма -->
          <div v-if="showEmailForm" class="auth-form">
            <input 
              v-model="emailInput"
              type="email"
              placeholder="Введите ваш email"
              class="auth-input"
            />
            <button @click="submitEmail" class="auth-btn">
              Отправить код
            </button>
          </div>
          
          <!-- Форма верификации email -->
          <div v-if="showEmailVerification" class="auth-form">
            <input 
              v-model="emailCode"
              type="text"
              placeholder="Введите код из email"
              class="auth-input"
            />
            <button @click="verifyEmailCode" class="auth-btn">
              Подтвердить
            </button>
          </div>
          
          <!-- Telegram верификация -->
          <div v-if="showTelegramVerification" class="auth-form">
            <input 
              v-model="telegramCode"
              type="text"
              placeholder="Введите код из Telegram"
              class="auth-input"
            />
            <button @click="verifyTelegramCode" class="auth-btn">
              Подтвердить
            </button>
          </div>
          
          <div v-if="emailError" class="error-message">
            {{ emailError }}
          </div>
          
          <div class="message-time">
            {{ formatTime(message.timestamp || message.created_at) }}
          </div>
        </div>
      </div>
      
      <div class="chat-input">
        <textarea 
          v-model="newMessage" 
          @keydown.enter.prevent="handleMessage(newMessage)"
          placeholder="Введите сообщение..."
          :disabled="isLoading"
        ></textarea>
        <button @click="handleMessage(newMessage)" :disabled="isLoading || !newMessage.trim()">
          {{ isLoading ? 'Отправка...' : 'Отправить' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useAuthStore } from '../stores/auth';
import WalletConnection from '../components/WalletConnection.vue';
import TelegramConnect from '../components/TelegramConnect.vue';
import axios from '../api/axios';
import { connectWithWallet } from '../utils/wallet';

console.log('HomeView.vue: Version with chat loaded');

const auth = useAuthStore();
const messages = ref([]);
const newMessage = ref('');
const isLoading = ref(false);
const messagesContainer = ref(null);
const userLanguage = ref('ru');
const email = ref('');
const isValidEmail = ref(true);
const hasShownAuthMessage = ref(false);
const guestMessages = ref([]);
const hasShownAuthOptions = ref(false);

// Email аутентификация
const emailVerificationCode = ref('');
const showEmailVerification = ref(false);
const emailErrorMessage = ref('');

// Добавляем состояния для форм верификации
const showTelegramVerification = ref(false);
const showEmailForm = ref(false);
const telegramCode = ref('');
const emailInput = ref('');
const emailCode = ref('');
const emailError = ref('');

// Добавляем состояния для пагинации
const PAGE_SIZE = 2; // Показываем только последнее сообщение и ответ
const allMessages = ref([]); // Все загруженные сообщения
const currentPage = ref(1); // Текущая страница
const hasMoreMessages = ref(false); // Есть ли еще сообщения
const isLoadingMore = ref(false); // Загружаются ли дополнительные сообщения

// Вычисляемое свойство для отображаемых сообщений
const displayedMessages = computed(() => {
  const startIndex = Math.max(allMessages.value.length - (PAGE_SIZE * currentPage.value), 0);
  return allMessages.value.slice(startIndex);
});

// Функция загрузки истории чата
const loadChatHistory = async () => {
  try {
    if (!auth.isAuthenticated || !auth.userId) {
      return;
    }

    const response = await axios.get('/api/chat/history', { 
      headers: { Authorization: `Bearer ${auth.address}` },
      params: { limit: PAGE_SIZE, offset: 0 }
    });
    
    if (response.data.success) {
      messages.value = response.data.messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role || (msg.sender_type === 'assistant' ? 'assistant' : 'user'),
        timestamp: msg.created_at,
        showAuthOptions: false
      }));

      hasMoreMessages.value = response.data.total > PAGE_SIZE;
      
      await nextTick();
      scrollToBottom();
    }
  } catch (error) {
    console.error('Error loading chat history:', error);
  }
};

// Функция загрузки дополнительных сообщений
const loadMoreMessages = async () => {
  if (isLoadingMore.value) return;
  
  try {
    isLoadingMore.value = true;
    const offset = messages.value.length;
    
    const response = await axios.get('/api/chat/history', {
      headers: { Authorization: `Bearer ${auth.address}` },
      params: { limit: PAGE_SIZE, offset }
    });

    if (response.data.success) {
      const newMessages = response.data.messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role || (msg.sender_type === 'assistant' ? 'assistant' : 'user'),
        timestamp: msg.created_at,
        showAuthOptions: false
      }));

      messages.value = [...newMessages, ...messages.value];
      hasMoreMessages.value = response.data.total > messages.value.length;
    }
  } catch (error) {
    console.error('Error loading more messages:', error);
  } finally {
    isLoadingMore.value = false;
  }
};

// Функция прокрутки к последнему сообщению
const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

// Инициализация при монтировании
onMounted(async () => {
  console.log('HomeView.vue: onMounted called');
  console.log('Auth state:', auth.isAuthenticated);
  
  // Определяем язык
  const cyrillicPattern = /[а-яА-ЯёЁ]/;
  userLanguage.value = cyrillicPattern.test(newMessage.value) ? 'ru' : 'en';
  console.log('Detected language:', userLanguage.value);

  // Если пользователь уже аутентифицирован, загружаем историю
  if (auth.isAuthenticated && auth.userId) {
    console.log('User authenticated, loading chat history...');
    await loadChatHistory();
  }
});

// Наблюдатель за изменением состояния аутентификации
watch(() => auth.isAuthenticated, async (newValue, oldValue) => {
  console.log('Auth state changed in HomeView:', newValue);
  
  if (newValue && auth.userId) {
    // Пользователь только что аутентифицировался
    await loadChatHistory();
  } else {
    // Пользователь вышел из системы
    messages.value = []; // Очищаем историю сообщений
    hasMoreMessages.value = false; // Сбрасываем флаг наличия дополнительных сообщений
    console.log('Chat history cleared after logout');
  }
}, { immediate: true });

// Функция для подключения кошелька
const handleWalletAuth = async () => {
  try {
    const result = await connectWithWallet();
    if (result.success) {
      console.log('Wallet auth result:', result);
      
      // Обновляем состояние аутентификации
      auth.setAuth({
        authenticated: true,
        isAuthenticated: true,
        userId: result.userId,
        address: result.address,
        isAdmin: result.isAdmin,
        authType: 'wallet'
      });

      // Добавляем задержку для синхронизации сессии
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Загружаем историю чата
      await loadChatHistory();
    }
    return result;
  } catch (error) {
    console.error('Error connecting wallet:', error);
    throw error;
  }
};

// Функция для сохранения гостевых сообщений на сервере
const saveGuestMessagesToServer = async () => {
  if (guestMessages.value.length === 0) return;
  
  try {
    // Фильтруем только сообщения пользователя (не AI)
    const userMessages = guestMessages.value.filter(msg => msg.role === 'user');
    
    // Отправляем каждое сообщение на сервер
    for (const msg of userMessages) {
      await axios.post('/api/chat/message', {
        message: msg.content,
        language: userLanguage.value
      });
    }
    
    console.log('Guest messages saved to server');
  } catch (error) {
    console.error('Error saving guest messages to server:', error);
  }
};

// Функция для подключения через Telegram
async function connectTelegram() {
  try {
    // Отправляем запрос на получение ссылки для авторизации через Telegram
    const response = await axios.get('/api/auth/telegram', {
      withCredentials: true
    });
    
    if (response.data.error) {
      messages.value.push({
        sender: 'ai',
        text: `Ошибка при подключении Telegram: ${response.data.error}`,
        timestamp: new Date(),
      });
      return;
    }
    
    if (response.data.authUrl) {
      messages.value.push({
        sender: 'ai',
        text: `Для подключения Telegram, перейдите по <a href="${response.data.authUrl}" target="_blank">этой ссылке</a> и авторизуйтесь.`,
        timestamp: new Date(),
      });
      
      // Открываем ссылку в новом окне
      window.open(response.data.authUrl, '_blank');
    } else {
      messages.value.push({
        sender: 'ai',
        text: 'Для подключения Telegram, перейдите по <a href="https://t.me/YourBotName" target="_blank">этой ссылке</a> и авторизуйтесь.',
        timestamp: new Date(),
      });
    }
  } catch (error) {
    console.error('Error connecting with Telegram:', error);
    
    messages.value.push({
      sender: 'ai',
      text: 'Извините, произошла ошибка при подключении Telegram. Пожалуйста, попробуйте позже.',
      timestamp: new Date(),
    });
  }
}

// Запрос кода подтверждения по email
async function requestEmailCode() {
  emailErrorMessage.value = '';
  
  try {
    const response = await auth.requestEmailVerification(email.value);
    
    if (response.success) {
      showEmailVerification.value = true;
      // Временно для тестирования
      if (response.verificationCode) {
        emailErrorMessage.value = `Код для тестирования: ${response.verificationCode}`;
      }
    } else {
      emailErrorMessage.value = response.error || 'Ошибка запроса кода подтверждения';
    }
  } catch (error) {
    console.error('Error requesting email verification:', error);
    emailErrorMessage.value = 'Ошибка запроса кода подтверждения';
  }
}

// Функция проверки кода
const verifyEmailCode = async () => {
  try {
    const response = await axios.post('/api/auth/email/verify-code', {
      email: emailInput.value,
      code: emailCode.value
    });

    if (response.data.success) {
      auth.setEmailAuth(response.data);
      showEmailVerification.value = false;
      emailError.value = '';
      
      // Загружаем историю чата после успешной аутентификации
      await loadChatHistory();
    } else {
      emailError.value = response.data.error || 'Неверный код';
    }
  } catch (error) {
    emailError.value = error.response?.data?.error || 'Ошибка проверки кода';
    console.error('Error verifying email code:', error);
  }
};

// Отмена верификации email
function cancelEmailVerification() {
  showEmailVerification.value = false;
  emailVerificationCode.value = '';
  emailErrorMessage.value = '';
}

// Добавьте эту функцию в <script setup>
const formatAddress = (address) => {
  if (!address) return '';
  return address.substring(0, 6) + '...' + address.substring(address.length - 4);
};

// Форматирование времени
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    
    // Проверяем, является ли дата валидной
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp:', timestamp);
      return '';
    }
    
    // Форматируем дату с указанием дня, месяца, года и времени
    return date.toLocaleString([], { 
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting time:', error, timestamp);
    return '';
  }
};

// Функция для отправки сообщения
const handleMessage = async (messageText) => {
  if (!messageText.trim() || isLoading.value) return;

  console.log('Handling message:', messageText);
  isLoading.value = true;

  try {
    if (!auth.isAuthenticated) {
      await sendGuestMessage(messageText);
    } else {
      await sendMessage(messageText);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    messages.value.push({
      id: Date.now(),
      content: 'Произошла ошибка при отправке сообщения.',
      role: 'assistant',
      timestamp: new Date().toISOString()
    });
  } finally {
    newMessage.value = '';
    isLoading.value = false;
  }
};

// Функция для отправки сообщения аутентифицированного пользователя
const sendMessage = async (messageText) => {
  try {
    const userMessage = {
      id: Date.now(),
      content: messageText,
      role: 'user',
      timestamp: new Date().toISOString()
    };
    messages.value.push(userMessage);

    const response = await axios.post('/api/chat/message', {
      message: messageText,
      language: userLanguage.value
    });

    if (response.data.success) {
      messages.value.push({
        id: Date.now() + 1,
        content: response.data.message,
        role: 'assistant',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
};

// Функция для отправки гостевого сообщения
const sendGuestMessage = async (messageText) => {
  try {
    // Добавляем сообщение пользователя
    const userMessage = {
      id: Date.now(),
      content: messageText,
      role: 'user',
      timestamp: new Date().toISOString(),
      showAuthButtons: false
    };
    messages.value.push(userMessage);

    // Очищаем поле ввода
    newMessage.value = '';

    // Сохраняем сообщение на сервере без получения ответа от Ollama
    await axios.post('/api/chat/guest-message', {
      message: messageText,
      language: userLanguage.value
    });

    // Добавляем сообщение с кнопками аутентификации
    messages.value.push({
      id: Date.now() + 1,
      content: 'Для получения ответа, пожалуйста, авторизуйтесь одним из способов:',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      showAuthButtons: true
    });

  } catch (error) {
    console.error('Error sending guest message:', error);
    messages.value.push({
      id: Date.now() + 2,
      content: 'Произошла ошибка. Пожалуйста, попробуйте позже.',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      showAuthButtons: true
    });
  } finally {
    isLoading.value = false;
  }
};

// Добавляем методы для аутентификации
const handleTelegramAuth = () => {
  window.open('https://t.me/HB3_Accelerator_Bot', '_blank');
  // Показываем форму для ввода кода через небольшую задержку
  setTimeout(() => {
    showTelegramVerification.value = true;
  }, 1000);
};

const handleEmailAuth = async () => {
  showEmailForm.value = true;
};

// Функция отправки email
const submitEmail = async () => {
  try {
    const response = await axios.post('/api/auth/email/request', {
      email: emailInput.value
    });

    if (response.data.success) {
      showEmailForm.value = false;
      showEmailVerification.value = true;
    } else {
      emailError.value = response.data.error || 'Ошибка отправки кода';
    }
  } catch (error) {
    emailError.value = 'Ошибка отправки кода';
    console.error('Error sending email code:', error);
  }
};

// Функция верификации кода Telegram
const verifyTelegramCode = async () => {
  try {
    const response = await axios.post('/api/auth/telegram/verify', {
      code: telegramCode.value
    });

    if (response.data.success) {
      console.log('Telegram verification successful:', response.data);
      
      // Обновляем состояние аутентификации
      auth.setAuth({
        isAuthenticated: response.data.authenticated,
        userId: response.data.userId,
        telegramId: response.data.telegramId,
        isAdmin: response.data.isAdmin,
        authType: 'telegram'
      });

      showTelegramVerification.value = false;
      telegramCode.value = '';

      // Показываем сообщение об успехе
      messages.value.push({
        id: Date.now(),
        content: 'Telegram успешно подключен!',
        role: 'assistant',
        timestamp: new Date().toISOString()
      });

      // Загружаем историю чата после небольшой задержки
      setTimeout(async () => {
        await loadChatHistory();
      }, 100);
    } else {
      messages.value.push({
        id: Date.now(),
        content: response.data.error || 'Ошибка верификации кода',
        role: 'assistant',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error verifying Telegram code:', error);
    messages.value.push({
      id: Date.now(),
      content: 'Произошла ошибка. Пожалуйста, попробуйте позже.',
      role: 'assistant',
      timestamp: new Date().toISOString()
    });
  }
};
</script>

<style scoped>
.home {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

h1 {
  font-size: 2rem;
  margin-bottom: 1rem;
}

/* Адаптивный заголовок */
@media (max-width: 768px) {
  h1 {
    font-size: 1.5rem;
  }
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 75vh;
  border: 1px solid #ccc;
  border-radius: 8px;
  overflow: hidden;
  margin-top: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

/* Адаптивная высота контейнера чата для мобильных устройств */
@media (max-width: 768px) {
  .chat-container {
    height: calc(100vh - 150px);
    margin-top: 10px;
  }
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background-color: #f0f0f0;
  border-bottom: 1px solid #ccc;
}

/* Адаптивный заголовок чата */
@media (max-width: 768px) {
  .chat-header {
    padding: 8px 12px;
  }
  
  .chat-header h2 {
    font-size: 1.2rem;
    margin: 0;
  }
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
}

/* Адаптивная информация о пользователе */
@media (max-width: 768px) {
  .user-info {
    font-size: 0.7rem;
    gap: 5px;
  }
  
  .user-info span {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.logout-btn {
  padding: 5px 10px;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

/* Адаптивная кнопка выхода */
@media (max-width: 768px) {
  .logout-btn {
    padding: 4px 8px;
    font-size: 0.8rem;
  }
}

.chat-messages {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background-color: #f9f9f9;
}

/* Адаптивные отступы для сообщений на мобильных устройствах */
@media (max-width: 768px) {
  .chat-messages {
    padding: 10px;
    gap: 8px;
  }
}

.message {
  max-width: 70%;
  padding: 10px 15px;
  border-radius: 10px;
  position: relative;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Адаптивная ширина сообщений для мобильных устройств */
@media (max-width: 768px) {
  .message {
    max-width: 85%;
    padding: 8px 12px;
  }
}

.user-message {
  align-self: flex-end;
  background-color: #dcf8c6;
  border-bottom-right-radius: 2px;
}

.ai-message {
  align-self: flex-start;
  background-color: #ffffff;
  border-bottom-left-radius: 2px;
}

.message-content {
  margin-bottom: 5px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 1rem;
  line-height: 1.4;
}

/* Адаптивный размер текста сообщений */
@media (max-width: 768px) {
  .message-content {
    font-size: 0.9rem;
    line-height: 1.3;
  }
}

.message-time {
  font-size: 0.7rem;
  color: #888;
  text-align: right;
}

.chat-input {
  display: flex;
  padding: 10px;
  border-top: 1px solid #ccc;
  background-color: #f9f9f9;
  align-items: center;
}

/* Адаптивные отступы для поля ввода */
@media (max-width: 768px) {
  .chat-input {
    padding: 8px;
  }
}

.chat-input textarea {
  flex: 1;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  resize: none;
  height: 40px;
  margin-right: 10px;
  font-family: inherit;
  font-size: 1rem;
}

/* Адаптивное поле ввода */
@media (max-width: 768px) {
  .chat-input textarea {
    padding: 8px;
    height: 36px;
    margin-right: 8px;
    font-size: 0.9rem;
  }
}

.chat-input button {
  padding: 0 20px;
  height: 40px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;
}

.chat-input button:hover:not(:disabled) {
  background-color: #45a049;
}

/* Адаптивная кнопка отправки */
@media (max-width: 768px) {
  .chat-input button {
    padding: 0 15px;
    height: 36px;
    font-size: 0.9rem;
  }
}

.chat-input button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

/* Стили для формы подключения кошелька */
.wallet-connection-container {
  margin-top: 20px;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
  background-color: #f9f9f9;
}

/* Адаптивные стили для формы подключения */
@media (max-width: 768px) {
  .wallet-connection-container {
    padding: 15px;
    margin-top: 10px;
  }
}

/* Анимация для сообщений */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.message {
  animation: fadeIn 0.3s ease-out;
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

.auth-btn {
  display: flex;
  align-items: center;
  justify-content: center;
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

.telegram-btn {
  background-color: #0088cc;
  color: white;
}

.email-btn {
  background-color: #4caf50;
  color: white;
}

.cancel-btn {
  background-color: #999;
}

.error-message {
  color: #D32F2F;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.auth-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.auth-btn {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.wallet-btn {
  background-color: #4a5568;
  color: white;
}

.telegram-btn {
  background-color: #0088cc;
  color: white;
}

.email-btn {
  background-color: #48bb78;
  color: white;
}

.auth-icon {
  margin-right: 8px;
}

.email-form {
  margin-top: 10px;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.email-form input {
  width: 100%;
  padding: 8px;
  margin-bottom: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.email-form button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.email-form button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.auth-form {
  margin-top: 10px;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #f9f9f9;
}

.auth-input {
  width: 100%;
  padding: 8px 12px;
  margin-bottom: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.error-message {
  color: #dc3545;
  font-size: 14px;
  margin-top: 5px;
}

.load-more-container {
  display: flex;
  justify-content: center;
  padding: 10px;
  background-color: #f5f5f5;
  position: sticky;
  top: 0;
  z-index: 1;
}

.load-more-btn {
  padding: 8px 16px;
  background-color: #4a5568;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.load-more-btn:hover:not(:disabled) {
  background-color: #2d3748;
}

.load-more-btn:disabled {
  background-color: #cbd5e0;
  cursor: not-allowed;
}
</style>
