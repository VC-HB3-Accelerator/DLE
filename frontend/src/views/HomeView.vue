<template>
  <div class="app-container">
    <!-- Боковая панель / Меню -->
    <div class="sidebar" :class="{ 'sidebar-expanded': showSidebar }">
      <button class="menu-button" @click="toggleSidebar">
        <div class="hamburger"></div>
      </button>
      <div class="nav-buttons">
        <button class="nav-btn" @click="navigateTo('page1')">
          <div class="nav-btn-number">1</div>
          <div class="nav-btn-text">Кнопка 1</div>
        </button>
        <button class="nav-btn" @click="navigateTo('page2')">
          <div class="nav-btn-number">2</div>
          <div class="nav-btn-text">Кнопка 2</div>
        </button>
        <button class="nav-btn" @click="navigateTo('page3')">
          <div class="nav-btn-number">3</div>
          <div class="nav-btn-text">Кнопка 3</div>
        </button>
        <button class="nav-btn" @click="navigateTo('page4')">
          <div class="nav-btn-number">4</div>
          <div class="nav-btn-text">Кнопка 4</div>
        </button>
        <button class="nav-btn" @click="navigateTo('page5')">
          <div class="nav-btn-number">5</div>
          <div class="nav-btn-text">Кнопка 5</div>
        </button>
        <button class="nav-btn" @click="navigateTo('page6')">
          <div class="nav-btn-number">6</div>
          <div class="nav-btn-text">Кнопка 6</div>
        </button>
      </div>
    </div>

    <!-- Основной контент -->
    <div class="main-content">
      <div class="header">
        <div class="title">
          <span class="hand-emoji">✌️</span> HB3 - Accelerator DLE (Digital Legal Entity - DAO Fork)
        </div>
        <div class="subtitle">
          Венчурный фонд и поставщик программного обеспечения
        </div>
      </div>

      <div class="chat-container">
        <div class="chat-messages" ref="messagesContainer">
          <div v-for="message in messages" :key="message.id" 
               :class="['message', message.role === 'assistant' ? 'ai-message' : 'user-message']">
            <div class="message-content" v-html="formatMessage(message.content)"></div>
            <div class="message-time">{{ formatTime(message.timestamp || message.created_at) }}</div>
          </div>
        </div>

        <div class="chat-input">
          <textarea 
            v-model="newMessage" 
            placeholder="Введите сообщение..." 
            @keydown.enter.prevent="handleMessage(newMessage)"
            :disabled="isLoading"
          ></textarea>
          <button @click="handleMessage(newMessage)" :disabled="isLoading || !newMessage.trim()">
            {{ isLoading ? 'Отправка...' : 'Отправить' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Правая панель с информацией о кошельке -->
    <div class="wallet-sidebar">
      <button v-if="!isAuthenticated" @click="handleWalletAuth" class="wallet-connect-btn">
        Подключить кошелек
      </button>
      <button v-else @click="disconnectWallet" class="wallet-disconnect-btn">
        Отключить кошелек
      </button>

      <!-- Добавляем дополнительные кнопки авторизации -->
      <div v-if="!isAuthenticated && messages.length > 0" class="auth-buttons">
        <div v-if="!showTelegramVerification" class="auth-btn-container">
          <button @click="handleTelegramAuth" class="auth-btn telegram-btn">
            Подключить Telegram
          </button>
        </div>
        <div v-if="showTelegramVerification" class="verification-block">
          <div class="verification-code">
            <span>Код верификации:</span>
            <code @click="copyCode(telegramVerificationCode)">{{ telegramVerificationCode }}</code>
            <span v-if="codeCopied" class="copied-message">Скопировано!</span>
          </div>
          <a :href="telegramBotLink" target="_blank" class="bot-link">Открыть бота Telegram</a>
          <button @click="cancelTelegramAuth" class="cancel-btn">Отмена</button>
        </div>
        
        <div v-if="!showEmailForm && !showEmailVerificationInput" class="auth-btn-container">
          <button @click="handleEmailAuth" class="auth-btn email-btn">
            Подключить Email
          </button>
        </div>
        
        <!-- Форма для Email верификации (встроена в auth-buttons) -->
        <div v-if="showEmailForm" class="email-form">
          <p>Введите ваш email для получения кода подтверждения:</p>
          <div class="email-input-container">
            <input 
              v-model="emailInput" 
              type="email" 
              placeholder="Ваш email" 
              class="email-input"
              :class="{ 'email-input-error': emailFormatError }"
            />
            <button @click="sendEmailVerification" class="send-email-btn" :disabled="isEmailSending">
              {{ isEmailSending ? 'Отправка...' : 'Отправить код' }}
            </button>
          </div>
          <div class="form-actions">
            <button @click="cancelEmailAuth" class="cancel-btn">Отмена</button>
            <p v-if="emailFormatError" class="email-format-error">Пожалуйста, введите корректный email</p>
          </div>
        </div>
        
        <!-- Форма для ввода кода верификации Email (встроена в auth-buttons) -->
        <div v-if="showEmailVerificationInput" class="email-verification-form">
          <p>На ваш email <strong>{{ emailVerificationEmail }}</strong> отправлен код подтверждения.</p>
          <div class="verification-input">
            <input 
              v-model="emailVerificationCode" 
              type="text" 
              placeholder="Введите код верификации" 
              maxlength="6"
            />
            <button @click="verifyEmailCode" class="verify-btn" :disabled="isVerifying">
              {{ isVerifying ? 'Проверка...' : 'Подтвердить' }}
            </button>
          </div>
          <button @click="cancelEmailAuth" class="cancel-btn">Отмена</button>
        </div>
      </div>

      <!-- Сообщение об ошибке в Email -->
      <div v-if="emailError" class="error-message">
        {{ emailError }}
        <button class="close-error" @click="clearEmailError">×</button>
      </div>

      <!-- Блок баланса токенов -->
      <div class="balance-container">
        <h3>Баланс:</h3>
        <div class="token-balance">
          <span class="token-name">ETH:</span>
          <span class="token-amount">{{ tokenBalances.eth }}</span>
          <span class="token-symbol">{{ TOKEN_CONTRACTS.eth.symbol }}</span>
        </div>
        <div class="token-balance">
          <span class="token-name">ARB:</span>
          <span class="token-amount">{{ tokenBalances.arbitrum }}</span>
          <span class="token-symbol">{{ TOKEN_CONTRACTS.arbitrum.symbol }}</span>
        </div>
        <div class="token-balance">
          <span class="token-name">POL:</span>
          <span class="token-amount">{{ tokenBalances.polygon }}</span>
          <span class="token-symbol">{{ TOKEN_CONTRACTS.polygon.symbol }}</span>
        </div>
        <div class="token-balance">
          <span class="token-name">BNB:</span>
          <span class="token-amount">{{ tokenBalances.bsc }}</span>
          <span class="token-symbol">{{ TOKEN_CONTRACTS.bsc.symbol }}</span>
        </div>
      </div>

      <!-- Блок информации о пользователе -->
      <div v-if="isAuthenticated" class="user-info">
        <h3>Идентификаторы:</h3>
        <div v-if="auth.address?.value" class="user-info-item">
          <span class="user-info-label">Кошелек:</span>
          <span class="user-info-value">{{ truncateAddress(auth.address.value) }}</span>
        </div>
        <div v-if="auth.telegramId?.value" class="user-info-item">
          <span class="user-info-label">Telegram:</span>
          <span class="user-info-value">{{ auth.telegramId.value }}</span>
        </div>
        <div v-if="auth.email?.value" class="user-info-item">
          <span class="user-info-label">Email:</span>
          <span class="user-info-value">{{ auth.email.value }}</span>
        </div>
      </div>

      <div class="language-selector">
        RU <span class="dropdown-icon">▼</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick, onBeforeUnmount } from 'vue';
import { useAuth } from '../composables/useAuth';
import { connectWithWallet } from '../services/wallet';
import axios from 'axios';
import api from '../api/axios';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import '../assets/styles/home.css';
import { fetchTokenBalances, TOKEN_CONTRACTS } from '../services/tokens';

console.log('HomeView.vue: Version with chat loaded');

const auth = useAuth();
const isAuthenticated = computed(() => auth.isAuthenticated.value);
const isConnecting = ref(false);
const messages = ref([]);
const newMessage = ref('');
const isLoading = ref(false);
const messagesContainer = ref(null);
const userLanguage = ref('ru');

// Состояния для пагинации
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
const emailError = ref('');
const codeCopied = ref(false);
const showEmailAlternatives = ref(false);

// Состояния для формы ввода кода
const showEmailVerificationInput = ref(false);
const emailVerificationEmail = ref('');

// Состояния для формы ввода email
const showEmailForm = ref(false);
const emailInput = ref('');
const emailFormatError = ref(false);
const isEmailSending = ref(false);

// Состояния для индикации и успешных сообщений
const isVerifying = ref(false);
const successMessage = ref('');
const showSuccessMessage = ref(false);

// Состояния для сайдбара
const showSidebar = ref(false);
const currentPage = ref('home');

// Добавляем состояние для балансов
const tokenBalances = ref({
  eth: '0',
  bsc: '0',
  arbitrum: '0',
  polygon: '0'
});

// Функция для управления сайдбаром
const toggleSidebar = () => {
  showSidebar.value = !showSidebar.value;
  document.querySelector('.app-container').classList.toggle('menu-open');
};

const navigateTo = (page) => {
  currentPage.value = page;
  console.log(`Навигация на страницу: ${page}`);
};

// Функция для копирования кода
const copyCode = (code) => {
  navigator.clipboard.writeText(code).then(() => {
    codeCopied.value = true;
    setTimeout(() => {
      codeCopied.value = false;
    }, 2000);
  });
};

// Функция для очистки ошибки
const clearEmailError = () => {
  emailError.value = '';
};

// Обработчик для Email аутентификации
const handleEmailAuth = async () => {
  try {
    // Показываем форму для ввода email
    showEmailForm.value = true;
    // Сбрасываем другие состояния форм
    showEmailVerification.value = false;
    showEmailVerificationInput.value = false;
    // Очищаем поля и ошибки
    emailInput.value = '';
    emailFormatError.value = false;
    emailError.value = '';
  } catch (error) {
    console.error('Error in email auth:', error);
  }
};

// Функция для отмены email авторизации
const cancelEmailAuth = () => {
  showEmailForm.value = false;
  showEmailVerificationInput.value = false;
  emailError.value = '';
  emailFormatError.value = false;
};

// Функция для отправки запроса на верификацию email
const sendEmailVerification = async () => {
  try {
    // Очищаем сообщения об ошибках
    emailFormatError.value = false;
    emailError.value = '';
    
    // Проверяем формат email
    if (!emailInput.value || !emailInput.value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      emailFormatError.value = true;
      return;
    }
    
    isEmailSending.value = true;
    
    // Отправляем запрос на сервер для инициализации email аутентификации
    try {
      const response = await axios.post('/api/auth/email/init', { email: emailInput.value });
      
      if (response.data.success) {
        // Скрываем форму ввода email
        showEmailForm.value = false;
        // Показываем форму для ввода кода
        showEmailVerificationInput.value = true;
        // Скрываем старую форму кода верификации
        showEmailVerification.value = false;
        // Сохраняем email
        emailVerificationEmail.value = emailInput.value;
        // Очищаем поле для ввода кода
        emailVerificationCode.value = '';
      } else {
        emailError.value = response.data.error || 'Ошибка инициализации аутентификации по email';
      }
    } catch (error) {
      console.error('Error sending email verification:', error);
      if (error.response && error.response.data && error.response.data.error) {
        emailError.value = error.response.data.error;
      } else {
        emailError.value = 'Ошибка при отправке кода. Пожалуйста, проверьте правильность email или попробуйте позже.';
      }
    }
  } catch (error) {
    emailError.value = 'Ошибка при запросе кода подтверждения';
    console.error('Error in email auth:', error);
  } finally {
    isEmailSending.value = false;
  }
};

// Функция для проверки введенного кода
const verifyEmailCode = async () => {
  try {
    // Очищаем сообщение об ошибке
    emailError.value = '';
    
    if (!emailVerificationCode.value) {
      emailError.value = 'Пожалуйста, введите код верификации';
      return;
    }
    
    // Показываем индикатор процесса верификации
    isVerifying.value = true;
    
    // Преобразуем код в верхний регистр перед отправкой
    const code = emailVerificationCode.value.toUpperCase();
    
    const response = await axios.post('/api/auth/check-email-verification', {
      code: code
    });
    
    if (response.data.success) {
      // Сбрасываем все состояния форм email
      showEmailVerificationInput.value = false;
      showEmailForm.value = false;
      showEmailVerification.value = false;
      
      // Показываем сообщение об успешной верификации
      successMessage.value = `Email ${emailVerificationEmail.value} успешно подтвержден!`;
      showSuccessMessage.value = true;
      
      // Скрываем сообщение через 3 секунды
      setTimeout(() => {
        showSuccessMessage.value = false;
      }, 3000);
      
      // Обновляем состояние аутентификации
      await auth.checkAuth();
      
      // Загружаем историю сообщений
      messages.value = [];
      offset.value = 0;
      hasMoreMessages.value = true;
      await loadMoreMessages();
      
      // Связываем гостевые сообщения
      try {
        await api.post('/api/chat/link-guest-messages');
        console.log('Guest messages linked to authenticated user');
        
        // Перезагружаем сообщения после связывания
        messages.value = [];
        offset.value = 0;
        await loadMoreMessages();
      } catch (linkError) {
        console.error('Error linking guest messages:', linkError);
      }
      
      // Обновляем баланс токенов
      await updateBalances();
    } else {
      emailError.value = response.data.message || 'Неверный код верификации';
    }
  } catch (error) {
    emailError.value = 'Ошибка при проверке кода';
    console.error('Error verifying email code:', error);
  } finally {
    isVerifying.value = false;
  }
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
        console.log('Проверка авторизации:', response.data);
        
        if (response.data.authenticated) {
          // Обновляем состояние аутентификации
          auth.updateAuth({
            isAuthenticated: true,
            authType: response.data.authType,
            userId: response.data.userId,
            telegramId: response.data.telegramId
          });
          
          console.log('Telegram authentication successful:', response.data);
          
          // Обновляем все данные пользователя
          await auth.checkAuth();
          
          // Загружаем историю сообщений
          messages.value = [];
          offset.value = 0;
          hasMoreMessages.value = true;
          await loadMoreMessages();
          
          // Связываем гостевые сообщения
          try {
            await api.post('/api/chat/link-guest-messages');
            console.log('Guest messages linked to authenticated user');
            
            // Перезагружаем сообщения после связывания
            messages.value = [];
            offset.value = 0;
            await loadMoreMessages();
          } catch (linkError) {
            console.error('Error linking guest messages:', linkError);
          }
          
          // Обновляем баланс токенов
          await updateBalances();
          
          clearInterval(telegramAuthCheckInterval.value);
          telegramAuthCheckInterval.value = null;
          showTelegramVerification.value = false;
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
    alert('Ошибка при инициализации Telegram аутентификации');
  }
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
  if (isConnecting.value || isAuthenticated.value) return;
  
  isConnecting.value = true;
  try {
    const result = await connectWithWallet();
    console.log('Wallet connection result:', result);
    
    if (result.success) {
      // Обновляем состояние авторизации
      await auth.checkAuth();
      
      // Загружаем историю сообщений
      messages.value = [];
      offset.value = 0;
      hasMoreMessages.value = true;
      await loadMoreMessages();
      
      // Связываем гостевые сообщения
      try {
        await api.post('/api/chat/link-guest-messages');
        console.log('Guest messages linked to authenticated user');
        
        // Перезагружаем сообщения после связывания
        messages.value = [];
        offset.value = 0;
        await loadMoreMessages();
      } catch (linkError) {
        console.error('Error linking guest messages:', linkError);
      }
      
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

// Форматирование сообщения с поддержкой markdown
const formatMessage = (text) => {
  if (!text) return '';
  const rawHtml = marked.parse(text);
  return DOMPurify.sanitize(rawHtml);
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
          timestamp: new Date().toISOString()
        };
        messages.value.push(userMessage);

        // Показываем сообщение с просьбой авторизоваться
        messages.value.push({
          id: Date.now() + 1,
          content: 'Для получения ответа от ассистента, пожалуйста, авторизуйтесь одним из способов в правой панели.',
          role: 'assistant',
          timestamp: new Date().toISOString()
        });

        // НЕ показываем форму email автоматически и НЕ устанавливаем showEmailAlternatives
        // showEmailForm.value = true;
        // showEmailAlternatives.value = true;
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
    
    await nextTick();
    scrollToBottom();
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

// Функция получения балансов
const updateBalances = async () => {
  if (auth.isAuthenticated.value && auth.address?.value) {
    try {
      const balances = await fetchTokenBalances();
      tokenBalances.value = balances;
    } catch (error) {
      console.error('Error updating balances:', error);
    }
  }
};

// Функция отмены Telegram аутентификации
const cancelTelegramAuth = () => {
  showTelegramVerification.value = false;
  if (telegramAuthCheckInterval.value) {
    clearInterval(telegramAuthCheckInterval.value);
    telegramAuthCheckInterval.value = null;
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

  // Проверяем статус авторизации
  auth.checkAuth();

  // Обновляем баланс при монтировании и изменении аутентификации
  if (auth.isAuthenticated.value) {
    updateBalances();
  }
});

watch(() => auth.isAuthenticated.value, async (newValue) => {
  if (newValue) {
    await updateBalances();
  } else {
    tokenBalances.value = {
      eth: '0',
      bsc: '0',
      arbitrum: '0',
      polygon: '0'
    };
  }
});

onBeforeUnmount(() => {
  // Удаляем слушатель
  if (messagesContainer.value) {
    messagesContainer.value.removeEventListener('scroll', handleScroll);
  }
  if (telegramAuthCheckInterval.value) {
    clearInterval(telegramAuthCheckInterval.value);
  }
  document.querySelector('.app-container')?.classList.remove('menu-open');
});
</script>
