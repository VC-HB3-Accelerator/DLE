<template>
  <div class="home">
    <h1>✌️ HB3 - Accelerator DLE (Digital Legal Entity - DAO Fork)</h1>
    
    <div class="auth-section" v-if="!isAuthenticated">
      <h3>Венчурный фонд и поставщик программного обеспечения</h3>
    </div>
       

    <div class="chat-container">
      <div class="chat-header">
        <!-- Используем тот же компонент, что и в сообщениях -->
        <div v-if="!isAuthenticated" class="auth-buttons">
          <button class="auth-btn wallet-btn" @click="handleWalletAuth">
            <span class="auth-icon">👛</span> Подключить кошелек
          </button>
        </div>
        <div v-else class="wallet-info">
          <span>{{ truncateAddress(auth.address.value) }}</span>
          <button class="disconnect-btn" @click="disconnectWallet">
            Отключить кошелек
          </button>
        </div>
      </div>
      
      <!-- Кнопка загрузки предыдущих сообщений -->
      <div v-if="isAuthenticated && hasMoreMessages" class="load-more">
        <button @click="loadMoreMessages" :disabled="isLoadingMore">
          {{ isLoadingMore ? 'Загрузка...' : 'Показать предыдущие сообщения' }}
        </button>
      </div>
      
      <div class="chat-messages" ref="messagesContainer">
        <div v-if="isLoadingMore" class="loading">
          Загрузка...
        </div>
        <div v-for="message in messages" :key="message.id" :class="['message', message.role === 'assistant' ? 'ai-message' : 'user-message']">
          <div class="message-content">
            {{ message.content }}
          </div>
          
          <!-- Кнопки аутентификации -->
          <div v-if="message.showAuthButtons && !isAuthenticated" class="auth-buttons">
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
import { ref, computed, onMounted, watch, nextTick, onBeforeUnmount, inject } from 'vue';
import WalletConnection from '../components/identity/WalletConnection.vue';
import TelegramConnect from '../components/identity/TelegramConnect.vue';
import EmailConnect from '../components/identity/EmailConnect.vue';
import api from '../api/axios';
import { connectWithWallet } from '../services/wallet';

console.log('HomeView.vue: Version with chat loaded');

const auth = inject('auth');
const isAuthenticated = computed(() => auth.isAuthenticated.value);
const authType = ref(null);
const messages = ref([]);
const guestMessages = ref([]);
const newMessage = ref('');
const isLoading = ref(false);
const messagesContainer = ref(null);
const userLanguage = ref('ru');
const email = ref('');
const isValidEmail = ref(true);
const hasShownAuthMessage = ref(false);
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
const hasMoreMessages = ref(true); // Есть ли еще сообщения
const isLoadingMore = ref(false); // Загружаются ли дополнительные сообщения
const offset = ref(0);
const limit = ref(20);

// Вычисляемое свойство для отображаемых сообщений
const displayedMessages = computed(() => {
  const startIndex = Math.max(allMessages.value.length - (PAGE_SIZE * currentPage.value), 0);
  return allMessages.value.slice(startIndex);
});

// Функция для сокращения адреса кошелька
const truncateAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Функция прокрутки к последнему сообщению
const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

// Загрузка сообщений
const loadMoreMessages = async () => {
  if (!isAuthenticated.value) return;
  
  try {
    isLoadingMore.value = true;
    const response = await api.get('/api/chat/history', {
      params: {
        limit: limit.value,
        offset: offset.value
      }
    });

    if (response.data.success) {
      const newMessages = response.data.messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role || (msg.sender_type === 'assistant' ? 'assistant' : 'user'),
        timestamp: msg.created_at,
        showAuthOptions: false
      }));
      
      messages.value = [...messages.value, ...newMessages];
      hasMoreMessages.value = response.data.total > messages.value.length;
      offset.value += newMessages.length;
    }
  } catch (error) {
    console.error('Error loading chat history:', error);
  } finally {
    isLoadingMore.value = false;
  }
};

// Загружаем сообщения при изменении аутентификации
watch(() => isAuthenticated.value, async (newValue) => {
  if (newValue) {
    messages.value = [];
    offset.value = 0;
    hasMoreMessages.value = true;
    
    try {
      // Сначала загружаем историю из messages
      await loadMoreMessages();
      
      // Связываем гостевые сообщения (копируем из guest_messages в messages)
      await api.post('/api/chat/link-guest-messages');
      console.log('Guest messages linked to authenticated user');
      
      // Перезагружаем сообщения, чтобы получить все, включая перенесенные
      messages.value = [];
      offset.value = 0;
      await loadMoreMessages();
      
      await nextTick();
      scrollToBottom();
    } catch (linkError) {
      console.error('Error linking guest messages:', linkError);
    }
  } else {
    messages.value = [];
    offset.value = 0;
    hasMoreMessages.value = true;
  }
});

// Находим существующую функцию handleWalletAuth и обновляем её
const handleWalletAuth = async () => {
  try {
    const result = await connectWithWallet();
    await auth.checkAuth();
    
    if (result.authenticated) {
      // Сохраняем гостевые сообщения перед очисткой
      const guestMessages = [...messages.value];
      messages.value = [];
      offset.value = 0;
      hasMoreMessages.value = true;
      
      try {
        await api.post('/api/chat/link-guest-messages');
        console.log('Guest messages linked to authenticated user');
        await loadMoreMessages();
        
        const filteredGuestMessages = guestMessages
          .filter(msg => !msg.showAuthButtons)
          .reverse();
        messages.value = [...messages.value, ...filteredGuestMessages];
        
        await nextTick();
        scrollToBottom();
      } catch (linkError) {
        console.error('Error linking guest messages:', linkError);
      }
    }
  } catch (error) {
    console.error('Error connecting wallet:', error);
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
      await api.post('/api/chat/message', {
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
    const response = await api.get('/api/auth/telegram', {
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
    const response = await api.post('/api/auth/email/verify-code', {
      email: emailInput.value,
      code: emailCode.value
    });

    if (response.data.success) {
      auth.setEmailAuth(response.data);
      showEmailVerification.value = false;
      emailError.value = '';
      
      // Загружаем историю чата после успешной аутентификации
      await loadMoreMessages();
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
const handleMessage = async (text) => {
  try {
    const messageContent = text.trim();
    if (!messageContent) return;
    
    newMessage.value = '';
    isLoading.value = true;

    if (!isAuthenticated.value) {
      // Сохраняем в таблицу guest_messages
      const response = await api.post('/api/chat/guest-message', {
        message: messageContent,
        language: userLanguage.value
      });
      
      if (response.data.success) {
        const userMessage = {
          id: response.data.messageId,
          content: messageContent,
          role: 'user',
          timestamp: new Date().toISOString(),
          showAuthButtons: false
        };
        messages.value.push(userMessage);

        messages.value.push({
          id: Date.now() + 1,
          content: 'Для получения ответа от ассистента, пожалуйста, авторизуйтесь одним из способов:',
          role: 'assistant',
          timestamp: new Date().toISOString(),
          showAuthButtons: true
        });
      }
    } else {
      // Для авторизованного пользователя сохраняем в messages
      const response = await api.post('/api/chat/message', {
        message: messageContent,
        language: userLanguage.value
      });

      if (response.data.success) {
        const message = {
          id: response.data.messageId,
          content: messageContent,
          role: 'user',
          timestamp: new Date().toISOString(),
          hasResponse: true
        };
        messages.value.push(message);
        
        const aiMessage = {
          id: response.data.aiMessageId,
          content: response.data.message,
          role: 'assistant',
          timestamp: new Date().toISOString()
        };
        messages.value.push(aiMessage);
      }
    }
  } catch (error) {
    console.error('Error sending message:', error);
    messages.value.push({
      id: Date.now(),
      content: 'Произошла ошибка при отправке сообщения.',
      role: 'assistant',
      timestamp: new Date().toISOString()
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
    const response = await api.post('/api/auth/email/request', {
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
    const response = await api.post('/api/auth/telegram/verify', {
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
        await loadMoreMessages();
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

const disconnectWallet = async () => {
  try {
    await auth.disconnect();
    messages.value = [];
    offset.value = 0;
    hasMoreMessages.value = true;
  } catch (error) {
    console.error('Error disconnecting wallet:', error);
  }
};

// Обработка прокрутки
const handleScroll = async () => {
  const element = messagesContainer.value;
  if (
    !isLoadingMore.value &&
    hasMoreMessages.value &&
    element.scrollTop === 0
  ) {
    await loadMoreMessages();
  }
};

onMounted(() => {
  // Добавляем слушатель прокрутки
  if (messagesContainer.value) {
    messagesContainer.value.addEventListener('scroll', handleScroll);
  }
});

onBeforeUnmount(() => {
  // Удаляем слушатель
  if (messagesContainer.value) {
    messagesContainer.value.removeEventListener('scroll', handleScroll);
  }
});
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
  padding: 1rem;
  border-bottom: 1px solid #ddd;
  background-color: #f8f9fa;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.wallet-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.disconnect-btn {
  padding: 0.5rem 1rem;
  background-color: #ff4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.disconnect-btn:hover {
  background-color: #cc0000;
}

.load-more {
  text-align: center;
  padding: 1rem;
}

.load-more button {
  padding: 0.5rem 1rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.load-more button:hover {
  background-color: #0056b3;
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
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.wallet-btn {
  background-color: #4a5568;
  color: white;
}

.wallet-btn:hover {
  background-color: #2d3748;
}

.auth-icon {
  font-size: 16px;
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

.wallet-section {
  margin-top: 20px;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
  background-color: #f9f9f9;
}

.wallet-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.disconnect-btn {
  padding: 0.5rem 1rem;
  background-color: #ff4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.disconnect-btn:hover {
  background-color: #cc0000;
}

.chat-history {
  height: 60vh;
  overflow-y: auto;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-top: 1rem;
}

/* Добавим индикатор загрузки */
.loading {
  text-align: center;
  padding: 1rem;
  color: #666;
}
</style>
