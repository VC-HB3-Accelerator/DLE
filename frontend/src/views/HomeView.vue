<template>
  <div class="home">
    <h1>✌️ HB3 - Accelerator DLE (Digital Legal Entity - DAO Fork)</h1>
    
    <div class="auth-section" v-if="!isAuthenticated">
      <h3>Венчурный фонд и поставщик программного обеспечения</h3>
    </div>
       
    <div class="chat-container">
      <div class="chat-header">
        <!-- Используем тот же компонент, что и в сообщениях -->
        <div v-if="!isAuthenticated && !isConnecting" class="auth-buttons">
          <button class="auth-btn wallet-btn" @click="handleWalletAuth">
            Подключить кошелек
          </button>
        </div>
        
        <div v-if="isConnecting" class="connecting-info">
          <span>Подключение кошелька...</span>
        </div>
        
        <div v-show="isAuthenticated && auth.authType.value === 'wallet'" class="auth-info-header">
          <span class="user-id">{{ auth.address && auth.address.value ? truncateAddress(auth.address.value) : '' }}</span>
          <button class="auth-btn disconnect-btn" @click="disconnectWallet">
            Отключить кошелек
          </button>
        </div>
        
        <div v-show="isAuthenticated && auth.authType.value === 'telegram'" class="auth-info-header">
          <span class="user-id">Telegram: {{ auth.telegramId }}</span>
          <button class="auth-btn disconnect-btn" @click="disconnectWallet">
            Выйти
          </button>
        </div>
        
        <div v-show="isAuthenticated && auth.authType.value === 'email'" class="auth-info-header">
          <span class="user-id">Email: {{ auth.email }}</span>
          <button class="auth-btn disconnect-btn" @click="disconnectWallet">
            Выйти
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
          <div v-if="message.showAuthButtons && !isAuthenticated" class="message-auth-buttons">
            <button class="auth-btn wallet-btn" @click="handleWalletAuth">
              Подключить кошелек
            </button>
            
            <!-- Telegram верификация -->
            <div v-if="showTelegramVerification" class="verification-block">
              <div class="verification-code">
                <span>Код подтверждения:</span>
                <code @click="copyCode(telegramVerificationCode)">{{ telegramVerificationCode }}</code>
              </div>
              <a :href="telegramBotLink" target="_blank" class="bot-link">
                Открыть HB3_Accelerator_Bot
              </a>
            </div>
            <button v-else class="auth-btn telegram-btn" @click="handleTelegramAuth">
              Подключить Telegram
            </button>
            
            <!-- Email верификация -->
            <div v-if="showEmailVerification" class="verification-block">
              <div class="verification-code">
                <span>Код подтверждения:</span>
                <code @click="copyCode(emailVerificationCode)">{{ emailVerificationCode }}</code>
                <span v-if="codeCopied" class="copied-message">Скопировано!</span>
              </div>
              
              <div class="email-options">
                <a :href="`mailto:info@hb3-accelerator.com?subject=Verification%20Code&body=${emailVerificationCode}`" 
                   class="bot-link" 
                   target="_blank"
                   @click="handleEmailClick">
                  Отправить код на info@hb3-accelerator.com
                </a>
                
                <div v-if="showEmailAlternatives" class="email-alternatives">
                  <p>Выберите почтовый сервис:</p>
                  <div class="email-services">
                    <a href="https://mail.google.com/mail/?view=cm&fs=1&to=info@hb3-accelerator.com&su=Verification%20Code&body=Код%20верификации:%20" 
                       :href="getEmailServiceUrl('gmail')"
                       target="_blank" 
                       class="email-service-btn gmail">
                      Gmail
                    </a>
                    <a href="https://outlook.live.com/mail/0/deeplink/compose" 
                       :href="getEmailServiceUrl('outlook')"
                       target="_blank" 
                       class="email-service-btn outlook">
                      Outlook
                    </a>
                    <a href="https://mail.yahoo.com/d/compose/" 
                       :href="getEmailServiceUrl('yahoo')"
                       target="_blank" 
                       class="email-service-btn yahoo">
                      Yahoo
                    </a>
                    <a href="https://mail.protonmail.com/compose" 
                       :href="getEmailServiceUrl('proton')"
                       target="_blank" 
                       class="email-service-btn proton">
                      ProtonMail
                    </a>
                  </div>
                  <div class="manual-option">
                    <p>Или скопируйте код и отправьте вручную:</p>
                    <button @click="copyEmailWithCode" class="copy-button">
                      Скопировать email и код
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button v-else class="auth-btn email-btn" @click="handleEmailAuth">
              Подключить Email
            </button>
          </div>
            
          <div v-if="emailError" class="error-message">
            {{ emailError }}
            <button class="close-error" @click="clearEmailError">×</button>
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
import axios from 'axios';
import { useAuth } from '../composables/useAuth';

console.log('HomeView.vue: Version with chat loaded');

const auth = useAuth();
const isAuthenticated = computed(() => auth.isAuthenticated.value);
const isConnecting = ref(false);
const messages = ref([]);
const newMessage = ref('');
const isLoading = ref(false);
const messagesContainer = ref(null);
const userLanguage = ref('ru');

// Добавляем состояния для пагинации
const isLoadingMore = ref(false);
const hasMoreMessages = ref(false);
const offset = ref(0);
const limit = ref(20);

// Состояния для верификации
const showTelegramVerification = ref(false);
const telegramVerificationCode = ref('');
const telegramBotLink = ref('');
const telegramAuthCheckInterval = ref(null);
const showEmailVerification = ref(false);
const emailVerificationCode = ref('');
const emailAuthCheckInterval = ref(null);
const emailError = ref('');
const codeCopied = ref(false);
const showEmailAlternatives = ref(false);

// Функция для копирования кода
const copyCode = (code) => {
  navigator.clipboard.writeText(code).then(() => {
    codeCopied.value = true;
    setTimeout(() => {
      codeCopied.value = false;
    }, 2000);
  });
};

// Функция для копирования email и кода
const copyEmailWithCode = () => {
  const textToCopy = `Email: info@hb3-accelerator.com\nКод верификации: ${emailVerificationCode.value}`;
  navigator.clipboard.writeText(textToCopy).then(() => {
    alert('Email и код скопированы в буфер обмена');
  });
};

// Функция для определения URL почтового сервиса
const getEmailServiceUrl = (service) => {
  const to = 'info@hb3-accelerator.com';
  const subject = 'Verification Code';
  const body = `Код верификации: ${emailVerificationCode.value}`;
  
  switch (service) {
    case 'gmail':
      return `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${encodeURIComponent(body)}`;
    case 'outlook':
      return `https://outlook.live.com/mail/0/deeplink/compose?to=${to}&subject=${subject}&body=${encodeURIComponent(body)}`;
    case 'yahoo':
      return `https://compose.mail.yahoo.com/?to=${to}&subject=${subject}&body=${encodeURIComponent(body)}`;
    case 'proton':
      return `https://mail.protonmail.com/compose?to=${to}&subject=${subject}&body=${encodeURIComponent(body)}`;
    default:
      return `mailto:${to}?subject=${subject}&body=${encodeURIComponent(body)}`;
  }
};

// Функция для обработки клика по email-ссылке
const handleEmailClick = (e) => {
  // Определяем, есть ли у пользователя почтовый клиент
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|windows phone/i.test(userAgent);
  
  // На мобильных устройствах обычно есть почтовые клиенты
  if (isMobile) {
    // Позволяем стандартному обработчику открыть почтовый клиент
    return true;
  }
  
  // На десктопе предлагаем веб-почту
  e.preventDefault();
  showEmailAlternatives.value = true;
  return false;
};

// Функция для показа ошибок
const showError = (message) => {
  // Можно использовать toast или alert
  alert(message);
};

// Обработчик для Telegram аутентификации
const handleTelegramAuth = async () => {
  try {
    const { data } = await axios.post('/api/auth/telegram/init');
    const { verificationCode, botLink } = data;
    
    // Показываем код верификации
    showTelegramVerification.value = true;
    telegramVerificationCode.value = verificationCode;
    telegramBotLink.value = botLink;
    
    // Запускаем проверку статуса аутентификации
    telegramAuthCheckInterval.value = setInterval(async () => {
      try {
        const response = await axios.get('/api/auth/check');
        if (response.data.authenticated) {
          auth.updateAuth({
            isAuthenticated: true,
            authType: response.data.authType,
            userId: response.data.userId
          });
          
          clearInterval(telegramAuthCheckInterval.value);
          telegramAuthCheckInterval.value = null;
          showTelegramVerification.value = false;
          
          // Перезагружаем страницу для полного обновления состояния
          window.location.reload();
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      }
    }, 2000);
    
    // Очищаем интервал через 5 минут
    setTimeout(() => {
      if (telegramAuthCheckInterval.value) {
        clearInterval(telegramAuthCheckInterval.value);
        telegramAuthCheckInterval.value = null;
        showTelegramVerification.value = false;
      }
    }, 5 * 60 * 1000);
    
  } catch (error) {
    console.error('Error initializing Telegram auth:', error);
    showError('Ошибка при инициализации Telegram аутентификации');
  }
};

// Функция для очистки ошибки
const clearEmailError = () => {
  emailError.value = '';
};

// Функция для обработки Email аутентификации
const handleEmailAuth = async () => {
  try {
    clearEmailError(); // Очищаем ошибку перед новой попыткой
    
    // Инициализируем процесс аутентификации
    const response = await axios.post('/api/auth/email/init');
    
    if (response.data.success) {
      showEmailVerification.value = true;
      emailVerificationCode.value = response.data.verificationCode;
      
      // Запускаем проверку статуса аутентификации
      startEmailAuthCheck();
    }
  } catch (error) {
    console.error('Error in email auth:', error);
    emailError.value = 'Ошибка при подключении Email';
  }
};

// Функция для запуска проверки статуса аутентификации по Email
const startEmailAuthCheck = () => {
  if (emailAuthCheckInterval.value) {
    clearInterval(emailAuthCheckInterval.value);
  }
  
  emailAuthCheckInterval.value = setInterval(async () => {
    try {
      const response = await axios.get('/api/auth/check-email-verification', {
        params: { code: emailVerificationCode.value }
      });
      
      if (response.data.verified) {
        clearInterval(emailAuthCheckInterval.value);
        showEmailVerification.value = false;
        
        // Обновляем состояние аутентификации
        await auth.checkAuth();
        
        // Перезагружаем страницу для обновления UI
        window.location.reload();
      } else if (response.data.message) {
        // Показываем сообщение пользователю, если есть
        emailError.value = response.data.message;
      }
    } catch (error) {
      console.error('Error checking email verification:', error);
    }
  }, 5000); // Проверяем каждые 5 секунд
};

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

// Функция для подключения кошелька
const handleWalletAuth = async () => {
  if (isConnecting.value || isAuthenticated.value) return; // Предотвращаем повторное подключение
  
  isConnecting.value = true;
  try {
    const result = await connectWithWallet();
    console.log('Wallet connection result:', result);
    
    if (result.success) {
      // Обновляем состояние авторизации
      await auth.checkAuth();
      
      // Добавляем небольшую задержку перед сбросом состояния isConnecting
      setTimeout(() => {
        isConnecting.value = false;
      }, 500);
      return;
    } else {
      console.error('Failed to connect wallet:', result.error);
    }
  } catch (error) {
    console.error('Error connecting wallet:', error);
  }
  
  isConnecting.value = false;
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

// Функция для отключения кошелька/выхода
const disconnectWallet = async () => {
  try {
    await axios.post('/api/auth/logout');
    auth.isAuthenticated.value = false;
    auth.address.value = null;
    auth.authType.value = null;
    auth.telegramId = null;
    auth.email = null;
    
    // Перезагружаем страницу для сброса состояния
    window.location.reload();
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
  console.log('Auth state on mount:', {
    isAuthenticated: auth.isAuthenticated.value,
    authType: auth.authType.value,
    telegramId: auth.telegramId.value
  });
  
  // Добавляем отладочный вывод для auth.authType
  console.log('auth.authType:', auth.authType);
  console.log('auth.authType.value:', auth.authType.value);
  console.log('auth.authType.value === "telegram":', auth.authType.value === 'telegram');
});

watch(() => auth.telegramId.value, (newValue) => {
  console.log('Telegram ID changed:', newValue);
});

onBeforeUnmount(() => {
  // Удаляем слушатель
  if (messagesContainer.value) {
    messagesContainer.value.removeEventListener('scroll', handleScroll);
  }
  if (telegramAuthCheckInterval.value) {
    clearInterval(telegramAuthCheckInterval.value);
  }
  if (emailAuthCheckInterval.value) {
    clearInterval(emailAuthCheckInterval.value);
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

.auth-btn, .disconnect-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
}

.wallet-btn {
  background-color: #4CAF50;
  color: white;
}

.wallet-btn:hover {
  background-color: #45a049;
}

.disconnect-btn {
  background-color: #f44336;
  color: white;
}

.disconnect-btn:hover {
  background-color: #d32f2f;
}

.auth-buttons, .wallet-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.auth-icon {
  margin-right: 5px;
}

.connecting-info {
  padding: 8px 16px;
  background-color: #2196F3;
  color: white;
  border-radius: 4px;
}

.error-message {
  position: relative;
  padding: 10px;
  margin: 10px 0;
  background-color: #ffebee;
  color: #c62828;
  border-radius: 4px;
  border-left: 4px solid #c62828;
}

.close-error {
  position: absolute;
  top: 5px;
  right: 5px;
  background: none;
  border: none;
  color: #c62828;
  font-size: 16px;
  cursor: pointer;
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

.wallet-btn:hover {
  background-color: #2d3748;
}

.telegram-btn {
  background-color: #0088cc;
  color: white;
}

.telegram-btn:hover {
  background-color: #0077b5;
}

.email-btn {
  background-color: #f44336;
  color: white;
}

.email-btn:hover {
  background-color: #d32f2f;
}

.disconnect-btn {
  background-color: #f44336;
  color: white;
}

.disconnect-btn:hover {
  background-color: #d32f2f;
}

/* Стили для информации о пользователе в header */
.auth-info-header {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-id {
  font-size: 14px;
  color: #333;
}

/* Общие стили для кнопок */
.auth-btn {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.wallet-btn {
  background-color: #4CAF50;
  color: white;
}

.wallet-btn:hover {
  background-color: #45a049;
}

.telegram-btn {
  background-color: #0088cc;
  color: white;
}

.telegram-btn:hover {
  background-color: #0077b5;
}

.email-btn {
  background-color: #f44336;
  color: white;
}

.email-btn:hover {
  background-color: #d32f2f;
}

.disconnect-btn {
  background-color: #f44336;
  color: white;
}

.disconnect-btn:hover {
  background-color: #d32f2f;
}

.bot-link {
  display: inline-block;
  margin-top: 10px;
  color: #0088cc;
  text-decoration: underline;
  cursor: pointer;
}

.bot-link:hover {
  color: #005580;
}

.verification-block {
  margin: 15px 0;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 5px;
  border-left: 4px solid #0088cc;
}

.verification-code {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.verification-code code {
  background-color: #e0e0e0;
  padding: 5px 10px;
  border-radius: 3px;
  font-family: monospace;
  cursor: pointer;
  user-select: all;
}

.copied-message {
  color: #4CAF50;
  font-size: 12px;
}

.email-options {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.email-alternatives {
  margin-top: 15px;
  padding: 15px;
  background-color: #fff;
  border-radius: 5px;
  border: 1px solid #ddd;
}

.email-services {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 15px 0;
}

.email-service-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 15px;
  border-radius: 4px;
  color: white;
  text-decoration: none;
  font-weight: 500;
  min-width: 120px;
}

.gmail {
  background-color: #D44638;
}

.outlook {
  background-color: #0078D4;
}

.yahoo {
  background-color: #6001D2;
}

.proton {
  background-color: #8A6EFF;
}

.manual-option {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.copy-button {
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-top: 5px;
}

.copy-button:hover {
  background-color: #e0e0e0;
}
</style>
