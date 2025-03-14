<template>
  <div class="home">
    <h1>DApp for Business</h1>
    
    <div class="auth-section" v-if="!auth.isAuthenticated">
      <p>Подключите кошелек, Telegram или Email для сохранения истории чата и доступа к дополнительным функциям:</p>
      <WalletConnection />
      <!-- Здесь можно добавить кнопки для подключения Telegram и Email -->
    </div>
    
    <div class="chat-container">
      <div class="chat-header">
        <h2>Чат с ИИ</h2>
        <div class="user-info" v-if="auth.isAuthenticated">
          <span>{{ formatAddress(auth.address) }}</span>
          <button @click="logout" class="logout-btn">Выйти</button>
        </div>
      </div>
      
      <div class="chat-messages" ref="messagesContainer">
        <div v-for="message in messages" :key="message.id" :class="['message', message.role === 'assistant' ? 'ai-message' : 'user-message']">
          <div class="message-content">
            {{ message.content }}
          </div>
          
          <!-- Опции аутентификации -->
          <div v-if="!auth.isAuthenticated && message.role === 'assistant' && !hasShownAuthOptions.value" class="auth-options">
            <div class="auth-option">
              <WalletConnection />
            </div>
            
            <div class="auth-option">
              <button class="auth-btn telegram-btn" @click="connectTelegram">
                <span class="auth-icon">📱</span> Подключить Telegram
              </button>
            </div>
            
            <div class="auth-option email-option">
              <input 
                type="email" 
                v-model="email" 
                placeholder="Введите ваш email" 
                class="email-input"
              />
              <button class="auth-btn email-btn" @click="connectEmail" :disabled="!isValidEmail">
                <span class="auth-icon">✉️</span> Подключить Email
              </button>
            </div>
          </div>
          
          <div class="message-time">
            {{ formatTime(message.timestamp || message.created_at) }}
          </div>
        </div>
      </div>
      
      <div class="chat-input">
        <textarea 
          v-model="newMessage" 
          @keydown.enter.prevent="sendMessage"
          placeholder="Введите сообщение..."
          :disabled="isLoading"
        ></textarea>
        <button @click="sendMessage" :disabled="isLoading || !newMessage.trim()">
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
import axios from '../api/axios';

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

// Простая функция для выхода
const logout = async () => {
  await auth.logout();
  messages.value = [];
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
const sendMessage = async () => {
  if (!newMessage.value.trim() || isLoading.value) return;
  
  console.log('Отправка сообщения:', newMessage.value, 'язык:', userLanguage.value);
  
  // Если пользователь не аутентифицирован, используем sendGuestMessage
  if (!auth.isAuthenticated) {
    await sendGuestMessage();
    return;
  }
  
  // Код для аутентифицированных пользователей
  const userMessage = {
    id: Date.now(),
    content: newMessage.value,
    role: 'user',
    timestamp: new Date().toISOString()
  };
  
  messages.value.push(userMessage);
  const messageText = newMessage.value;
  newMessage.value = '';
  
  // Прокрутка вниз
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
  
  isLoading.value = true;
  
  try {
    const response = await axios.post('/api/chat/message', {
      message: messageText,
      language: userLanguage.value
    });
    
    console.log('Ответ от сервера:', response.data);
    
    // Добавляем ответ от ИИ
    messages.value.push({
      id: Date.now() + 1,
      content: response.data.message,
      role: 'assistant',
      timestamp: new Date().toISOString()
    });
    
    // Прокрутка вниз
    await nextTick();
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    messages.value.push({
      id: Date.now() + 1,
      content: 'Произошла ошибка при обработке вашего сообщения. Пожалуйста, попробуйте еще раз.',
      role: 'assistant',
      timestamp: new Date().toISOString()
    });
  } finally {
    isLoading.value = false;
  }
};

// Добавим наблюдатель за изменением состояния аутентификации
watch(() => auth.isAuthenticated, async (newValue, oldValue) => {
  console.log('Auth state changed in HomeView:', newValue);
  
  if (newValue && !oldValue) {
    // Пользователь только что аутентифицировался
    await loadChatHistory();
  }
});

// Загрузка истории сообщений
const loadChatHistory = async () => {
  console.log('Loading chat history...');
  
  try {
    console.log('User address from auth store:', auth.address);
    
    // Добавляем заголовок авторизации
    const headers = {};
    if (auth.address) {
      const authHeader = `Bearer ${auth.address}`;
      console.log('Adding Authorization header:', authHeader);
      headers.Authorization = authHeader;
    }
    
    const response = await axios.get('/api/chat/history', { headers });
    console.log('Chat history response:', response.data);
    
    if (response.data.messages) {
      // Получаем историю с сервера
      const serverMessages = response.data.messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role,
        timestamp: msg.timestamp || msg.created_at,
        isGuest: false
      }));
      
      // Объединяем гостевые сообщения с историей с сервера
      // Сначала отправляем гостевые сообщения на сервер
      await saveGuestMessagesToServer();
      
      // Затем загружаем обновленную историю
      const updatedResponse = await axios.get('/api/chat/history', { headers });
      const updatedServerMessages = updatedResponse.data.messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role,
        timestamp: msg.timestamp || msg.created_at,
        isGuest: false
      }));
      
      // Обновляем сообщения
      messages.value = updatedServerMessages;
      
      // Очищаем гостевые сообщения
      guestMessages.value = [];
      localStorage.removeItem('guestMessages');
      
      console.log('Updated messages:', messages.value);
    }
  } catch (error) {
    console.error('Error loading chat history:', error);
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

// Функция для подключения через Email
async function connectEmail() {
  if (!isValidEmail.value) return;
  
  try {
    messages.value.push({
      sender: 'ai',
      text: `Отправляем код подтверждения на ${email.value}...`,
      timestamp: new Date(),
    });
    
    // Отправляем запрос на отправку кода подтверждения
    const response = await axios.post('/api/auth/email', {
      email: email.value
    }, {
      withCredentials: true
    });
    
    if (response.data.error) {
      messages.value.push({
        sender: 'ai',
        text: `Ошибка: ${response.data.error}`,
        timestamp: new Date(),
      });
      return;
    }
    
    messages.value.push({
      sender: 'ai',
      text: `На ваш email ${email.value} отправлено письмо с кодом подтверждения. Пожалуйста, введите код:`,
      timestamp: new Date(),
    });
    
    // Добавляем поле для ввода кода
    const verificationCode = prompt('Введите код подтверждения:');
    
    if (verificationCode) {
      try {
        // Отправляем запрос на проверку кода
        const verifyResponse = await axios.post('/api/auth/email/verify', {
          email: email.value,
          code: verificationCode
        }, {
          withCredentials: true
        });
        
        if (verifyResponse.data.error) {
          messages.value.push({
            sender: 'ai',
            text: `Ошибка: ${verifyResponse.data.error}`,
            timestamp: new Date(),
          });
          return;
        }
        
        messages.value.push({
          sender: 'ai',
          text: 'Email успешно подтвержден! Теперь вы можете использовать все функции чата.',
          timestamp: new Date(),
        });
        
        // Обновляем состояние аутентификации
        auth.isAuthenticated = true;
        auth.user = { email: email.value };
        auth.authType = 'email';
        
        // Сбрасываем флаг показа сообщения с опциями авторизации
        hasShownAuthMessage.value = false;
      } catch (error) {
        console.error('Error verifying email code:', error);
        
        messages.value.push({
          sender: 'ai',
          text: 'Произошла ошибка при проверке кода. Пожалуйста, попробуйте позже.',
          timestamp: new Date(),
        });
      }
    }
  } catch (error) {
    console.error('Error connecting with email:', error);
    
    messages.value.push({
      sender: 'ai',
      text: 'Извините, произошла ошибка при подключении Email. Пожалуйста, попробуйте позже.',
      timestamp: new Date(),
    });
  }
}

// Добавьте эту функцию в <script setup>
const formatAddress = (address) => {
  if (!address) return '';
  return address.substring(0, 6) + '...' + address.substring(address.length - 4);
};

onMounted(async () => {
  console.log('HomeView.vue: onMounted called');
  console.log('Auth state:', auth.isAuthenticated);
  
  // Определяем язык пользователя
  const browserLanguage = navigator.language || navigator.userLanguage;
  userLanguage.value = browserLanguage.split('-')[0];
  console.log('Detected language:', userLanguage.value);
  
  // Загружаем гостевые сообщения из localStorage
  const savedGuestMessages = localStorage.getItem('guestMessages');
  if (savedGuestMessages) {
    guestMessages.value = JSON.parse(savedGuestMessages);
  }
  
  // Если пользователь аутентифицирован, загружаем историю чата с сервера
  if (auth.isAuthenticated) {
    console.log('User authenticated, loading chat history...');
    await loadChatHistory();
  } else {
    // Если пользователь не аутентифицирован, отображаем гостевые сообщения
    messages.value = [...guestMessages.value];
  }
});

// Функция для отправки сообщения от неаутентифицированного пользователя
const sendGuestMessage = async () => {
  if (!newMessage.value.trim()) return;
  
  const userMessage = {
    id: Date.now(),
    content: newMessage.value,
    role: 'user',
    timestamp: new Date().toISOString(),
    isGuest: true
  };
  
  // Добавляем сообщение пользователя в локальную историю
  messages.value.push(userMessage);
  
  // Сохраняем сообщение в массиве гостевых сообщений
  guestMessages.value.push(userMessage);
  
  // Сохраняем гостевые сообщения в localStorage
  localStorage.setItem('guestMessages', JSON.stringify(guestMessages.value));
  
  // Очищаем поле ввода
  const messageText = newMessage.value;
  newMessage.value = '';
  
  // Прокрутка вниз
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
  
  // Устанавливаем состояние загрузки
  isLoading.value = true;
  
  // Отправляем запрос на сервер
  try {
    const response = await axios.post('/api/chat/guest-message', {
      message: messageText,
      language: userLanguage.value
    });
    
    console.log('Response from server:', response.data);
    
    // Добавляем ответ AI в историю
    const aiMessage = {
      id: Date.now() + 1,
      content: response.data.message || response.data.reply,
      role: 'assistant',
      timestamp: new Date().toISOString(),
      isGuest: true,
      showAuthOptions: !hasShownAuthOptions.value
    };
    
    messages.value.push(aiMessage);
    
    // Отмечаем, что опции аутентификации уже были показаны
    if (!hasShownAuthOptions.value) {
      hasShownAuthOptions.value = true;
    }
    
    // Сохраняем ответ AI в массиве гостевых сообщений
    guestMessages.value.push(aiMessage);
    
    // Обновляем localStorage
    localStorage.setItem('guestMessages', JSON.stringify(guestMessages.value));
    
    // Прокрутка вниз
    await nextTick();
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  } catch (error) {
    console.error('Error sending guest message:', error);
    
    // Добавляем сообщение об ошибке
    messages.value.push({
      id: Date.now() + 1,
      content: 'Произошла ошибка при обработке вашего сообщения. Пожалуйста, попробуйте еще раз.',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      isGuest: true
    });
  } finally {
    isLoading.value = false;
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

.telegram-btn {
  background-color: #0088cc;
  color: white;
}

.email-btn {
  background-color: #4caf50;
  color: white;
}
</style>
