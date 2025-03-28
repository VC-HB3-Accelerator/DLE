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
        
      <!-- Кнопка 7 в нижней части боковой панели -->
      <button class="nav-btn sidebar-bottom-btn" @click="toggleWalletSidebar">
        <div class="nav-btn-number">7</div>
        <div class="nav-btn-text">{{ showWalletSidebar ? 'Скрыть панель' : 'Подключиться' }}</div>
          </button>
        </div>
        
    <!-- Основной контент -->
    <div class="main-content" :class="{ 'no-right-sidebar': !showWalletSidebar }">
      <div class="header">
        <h1 class="title">✌️HB3 - Accelerator DLE (Digital Legal Entity - DAO Fork)</h1>
        <p class="subtitle">Венчурный фонд и поставщик программного обеспечения</p>
        </div>
        
      <div class="chat-container">
        <div class="chat-messages" ref="messagesContainer">
          <div v-for="message in messages" :key="message.id" 
               :class="['message', message.sender_type === 'assistant' || message.role === 'assistant' ? 'ai-message' : 'user-message']">
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
    <div class="wallet-sidebar" v-if="showWalletSidebar">
      <div class="wallet-header">
        <button v-if="!isAuthenticated" @click="handleWalletAuth" class="wallet-connect-btn-header">
              Подключить кошелек
            </button>
        <button v-if="isAuthenticated" @click="disconnectWallet" class="wallet-disconnect-btn-header">
          Отключить
        </button>
        <button class="close-wallet-sidebar" @click="toggleWalletSidebar">×</button>
      </div>
      
      <!-- Добавляем дополнительные кнопки авторизации -->
      <div v-if="!isAuthenticated && messages.length > 0" class="auth-buttons">
        <h3>Авторизация через:</h3>
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
          <div class="email-form-container">
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
          <div class="email-form-container">
            <input 
              v-model="emailVerificationCode" 
              type="text" 
              placeholder="Введите код верификации" 
              maxlength="6"
              class="email-input"
            />
            <button @click="verifyEmailCode" class="send-email-btn" :disabled="isVerifying">
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
const hasUserSentMessage = ref(localStorage.getItem('hasUserSentMessage') === 'true');
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

// Состояние для отображения правой панели
const showWalletSidebar = ref(false);

// Функция для управления сайдбаром
const toggleSidebar = () => {
  showSidebar.value = !showSidebar.value;
  document.querySelector('.app-container').classList.toggle('menu-open');
};

const navigateTo = (page) => {
  currentPage.value = page;
  console.log(`Навигация на страницу: ${page}`);
};

// Функция для переключения отображения правой панели
const toggleWalletSidebar = () => {
  showWalletSidebar.value = !showWalletSidebar.value;
  // Сохраняем в localStorage предпочтение пользователя
  localStorage.setItem('showWalletSidebar', showWalletSidebar.value);
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

// Функция для отправки запроса на верификацию email
const sendEmailVerification = async () => {
  try {
    emailFormatError.value = false;
    emailError.value = '';
    
    // Проверяем формат email
    if (!emailInput.value || !emailInput.value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      emailFormatError.value = true;
      return;
    }
    
    isEmailSending.value = true;
    
    // Отправляем запрос на сервер для инициализации email аутентификации
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
    
    const response = await axios.post('/api/auth/check-email-verification', {
      code: emailVerificationCode.value
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
      
      // Перезагружаем страницу для обновления UI через 1 секунду
      setTimeout(() => {
        window.location.reload();
      }, 1000);
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

// Функция для отмены Email аутентификации
const cancelEmailAuth = () => {
  showEmailForm.value = false;
  showEmailVerificationInput.value = false;
  showEmailVerification.value = false;
  emailInput.value = '';
  emailVerificationCode.value = '';
  emailError.value = '';
  emailFormatError.value = false;
};

// Функция для отправки сообщения
const handleMessage = async (text) => {
  try {
    const messageContent = text.trim();
    if (!messageContent) return;
    
    // Показываем правую панель только если пользователь не аутентифицирован
    if (!isAuthenticated.value) {
      showWalletSidebar.value = true;
    }
    
    newMessage.value = '';
    isLoading.value = true;
    
    if (!isAuthenticated.value) {
      // Сохраняем в таблицу guest_messages
      console.log('Sending guest message:', messageContent);
      const response = await api.post('/api/chat/guest-message', {
        message: messageContent,
        language: userLanguage.value
      });
      
      if (response.data.success) {
        console.log('Guest message sent:', response.data);
        const userMessage = {
          id: response.data.messageId,
          content: messageContent,
          sender_type: 'user',
          role: 'user',
          timestamp: new Date().toISOString()
        };
        messages.value.push(userMessage);

        // Показываем сообщение с просьбой авторизоваться
        messages.value.push({
          id: Date.now() + 1,
          content: 'Для получения ответа от ассистента, пожалуйста, авторизуйтесь одним из способов в правой панели.',
          sender_type: 'assistant',
          role: 'assistant',
          timestamp: new Date().toISOString()
        });

        // Прокручиваем к последнему сообщению
        await nextTick();
        scrollToBottom();
      } else {
        throw new Error(response.data.error || 'Ошибка при отправке сообщения');
      }
    } else {
      // Отправляем сообщение аутентифицированного пользователя
      console.log('Sending authenticated message:', messageContent);
      const response = await api.post('/api/chat/message', {
        message: messageContent,
        language: userLanguage.value
      });
      
      if (response.data.success) {
        console.log('Authenticated message sent:', response.data);
        // Добавляем сообщение пользователя
        messages.value.push({
          id: response.data.userMessage.id,
          content: response.data.userMessage.content,
          sender_type: 'user',
          role: 'user',
          timestamp: response.data.userMessage.created_at
        });
        
        // Добавляем ответ ассистента
        messages.value.push({
          id: response.data.aiMessage.id,
          content: response.data.aiMessage.content,
          sender_type: 'assistant',
          role: 'assistant',
          timestamp: response.data.aiMessage.created_at
        });
        
        // Прокручиваем к последнему сообщению
        await nextTick();
        scrollToBottom();
      } else {
        throw new Error(response.data.error || 'Ошибка при отправке сообщения');
      }
    }
  } catch (error) {
    console.error('Error sending message:', error);
    messages.value.push({
      id: Date.now() + 1,
      content: 'Произошла ошибка при отправке сообщения. Пожалуйста, попробуйте позже.',
      sender_type: 'assistant',
      role: 'assistant',
      timestamp: new Date().toISOString()
    });
    
    // Прокручиваем к последнему сообщению
    await nextTick();
    scrollToBottom();
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
  try {
    isLoadingMore.value = true;
    console.log('Fetching chat history...');
    
    // Всегда запрашиваем историю, так как на сервере проверяется наличие
    // userId или guestId в сессии и возвращаются соответствующие сообщения
    const response = await api.get('/api/chat/history', {
      params: {
        limit: limit.value,
        offset: offset.value
      }
    });

    console.log('Chat history response:', response.data);

    if (response.data.success) {
      const newMessages = response.data.messages.map(msg => {
        console.log('Processing message:', msg);
        return {
          id: msg.id,
          content: msg.content,
          sender_type: msg.sender_type || (msg.role === 'assistant' ? 'assistant' : 'user'),
          role: msg.role || (msg.sender_type === 'assistant' ? 'assistant' : 'user'),
          timestamp: msg.created_at,
          showAuthOptions: false
        };
      });
      
      console.log('Processed messages:', newMessages);
      
      // Объединяем сообщения и сортируем их по timestamp
      const allMessages = [...messages.value, ...newMessages];
      allMessages.sort((a, b) => {
        const timeA = new Date(a.timestamp || a.created_at).getTime();
        const timeB = new Date(b.timestamp || b.created_at).getTime();
        return timeA - timeB;
      });
      
      messages.value = allMessages;
      console.log('Updated messages array:', messages.value);
      hasMoreMessages.value = response.data.total > messages.value.length;
      offset.value += newMessages.length;
      
      // Прокручиваем к последнему сообщению
      await nextTick();
      scrollToBottom();
    }
  } catch (error) {
    console.error('Error loading chat history:', error);
  } finally {
    isLoadingMore.value = false;
  }
};

// Загружаем сообщения при изменении аутентификации
watch(() => isAuthenticated.value, async (newValue, oldValue) => {
  // Если пользователь только что авторизовался
  if (newValue && !oldValue) {
    try {
      // Связываем гостевые сообщения (копируем из guest_messages в messages)
      await api.post('/api/chat/link-guest-messages');
      console.log('Guest messages linked to authenticated user');
      
      // Перезагружаем все сообщения
      messages.value = [];
      offset.value = 0;
      hasMoreMessages.value = true;
      await loadMoreMessages();
      
      await nextTick();
      scrollToBottom();
    } catch (linkError) {
      console.error('Error linking guest messages:', linkError);
    }
  } else if (!newValue && oldValue) {
    // Если пользователь вышел из системы, загружаем только гостевые сообщения
    messages.value = [];
    offset.value = 0;
    hasMoreMessages.value = true;
    await loadMoreMessages(); // Загрузит гостевые сообщения, если они есть
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
    
    // Загружаем только гостевые сообщения после выхода
    messages.value = [];
    offset.value = 0;
    hasMoreMessages.value = true;
    await loadMoreMessages();
    
    // НЕ перезагружаем страницу, чтобы не потерять историю сообщений
    // window.location.reload();
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

// Функция для проверки наличия гостевых сообщений
const checkGuestMessages = async () => {
  try {
    const response = await api.get('/api/chat/check-session');
    console.log('Session check response:', response.data);
    
    // После инициализации сессии загружаем сообщения
    if (!isAuthenticated.value) {
      // Если пользователь не авторизован, попробуем загрузить гостевые сообщения
      await loadMoreMessages();
    }
    
    return response.data;
  } catch (error) {
    console.error('Error checking guest messages:', error);
    return { success: false };
  }
};

// Инициализация состояния при загрузке
onMounted(async () => {
  // Загружаем состояние правой панели из localStorage
  const savedSidebarState = localStorage.getItem('showWalletSidebar');
  if (savedSidebarState !== null) {
    showWalletSidebar.value = savedSidebarState === 'true';
  } else {
    // По умолчанию правая панель скрыта
    showWalletSidebar.value = false;
  }
  
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
  await auth.checkAuth();
  
  // Проверяем наличие гостевых сообщений и инициализируем сессию
  await checkGuestMessages();
  
  // Обновляем баланс при монтировании если авторизован
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
