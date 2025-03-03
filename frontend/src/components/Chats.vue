<template>
  <div class="ai-chat">
    <div v-if="!isAuthenticated" class="connect-wallet-message">
      Для отправки сообщений необходимо подключить кошелек
    </div>
    
    <div class="chat-messages" ref="messagesContainer">
      <div v-for="(message, index) in messages" :key="index" 
           :class="['message', message.role]">
        {{ message.content }}
      </div>
    </div>
    
    <div class="chat-input">
      <textarea 
        v-model="userInput"
        @keydown.enter.prevent="sendMessage"
        placeholder="Введите ваше сообщение..."
        :disabled="!isAuthenticated"
        :class="{ 'disabled': !isAuthenticated }"
      ></textarea>
      <button 
        @click="sendMessage" 
        :disabled="!isAuthenticated || !userInput.trim()"
        :class="{ 'disabled': !isAuthenticated }"
      >
        {{ isAuthenticated ? 'Отправить' : 'Подключите кошелек' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';
import axios from 'axios';

const auth = useAuthStore();
const router = useRouter();
const messages = ref([]);
const userInput = ref('');
const messagesContainer = ref(null);

const isAuthenticated = computed(() => auth.isAuthenticated);
const currentUserAddress = computed(() => auth.address);

async function checkAndRefreshSession() {
  try {
    // Проверяем, есть ли активная сессия
    const sessionResponse = await fetch('/api/session', {
      credentials: 'include'
    });
    
    if (!sessionResponse.ok) {
      console.error('Ошибка при проверке сессии:', sessionResponse.status, sessionResponse.statusText);
      
      // Проверяем, доступен ли сервер
      try {
        const pingResponse = await fetch('/api/debug/ping');
        if (!pingResponse.ok) {
          throw new Error(`Сервер недоступен: ${pingResponse.status} ${pingResponse.statusText}`);
        }
        const pingData = await pingResponse.json();
        console.log('Ping response:', pingData);
      } catch (pingError) {
        console.error('Ошибка при проверке доступности сервера:', pingError);
        throw new Error('Сервер недоступен. Пожалуйста, убедитесь, что сервер запущен и доступен.');
      }
      
      // Пробуем восстановить из localStorage
      if (auth.restoreAuth()) {
        console.log('Сессия восстановлена из localStorage в Chats');
        return true;
      }
      
      throw new Error(`Ошибка сервера: ${sessionResponse.status} ${sessionResponse.statusText}`);
    }
    
    const sessionData = await sessionResponse.json();
    console.log('Проверка сессии в Chats:', sessionData);
    
    // Проверяем аутентификацию
    if (sessionData.isAuthenticated || sessionData.authenticated) {
      // Сессия активна, обновляем состояние auth store
      auth.setAuth(sessionData.address, sessionData.isAdmin);
      return true;
    } else {
      // Сессия не активна, пробуем восстановить из localStorage
      if (auth.restoreAuth()) {
        console.log('Сессия восстановлена из localStorage в Chats');
        return true;
      }
      
      // Если не удалось восстановить, выбрасываем ошибку
      throw new Error('Необходимо переподключить кошелек');
    }
  } catch (error) {
    console.log('Session check error:', error);
    throw error;
  }
}

async function sendMessage() {
  if (!userInput.value.trim() || !isAuthenticated.value) return;
  
  const currentMessage = userInput.value.trim();
  userInput.value = '';
  
  // Добавляем сообщение пользователя в чат
  messages.value.push({
    role: 'user',
    content: currentMessage
  });
  
  // Прокручиваем чат вниз
  scrollToBottom();
  
  try {
    console.log('Отправка сообщения в Ollama:', currentMessage);
    
    // Добавляем индикатор загрузки
    messages.value.push({
      role: 'system',
      content: 'Загрузка ответа...'
    });
    
    // Прокручиваем чат вниз
    scrollToBottom();
    
    // Отправляем запрос к серверу
    const response = await fetch('/api/chat/ollama', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: currentMessage,
        model: 'mistral' // Указываем модель Mistral
      }),
      credentials: 'include'
    });
    
    // Удаляем индикатор загрузки
    messages.value.pop();
    
    // Проверяем статус ответа
    if (!response.ok) {
      let errorMessage = 'Ошибка при отправке сообщения';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (jsonError) {
        console.error('Ошибка при парсинге JSON ответа об ошибке:', jsonError);
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log('Ответ от сервера:', data);
    
    // Добавляем ответ от сервера в чат
    messages.value.push({
      role: 'assistant',
      content: data.response
    });
    
    // Прокручиваем чат вниз
    scrollToBottom();
  } catch (error) {
    console.error('Error details:', error);
    
    // Добавляем сообщение об ошибке в чат
    messages.value.push({
      role: 'system',
      content: `Ошибка: ${error.message}`
    });
    
    // Прокручиваем чат вниз
    scrollToBottom();
  }
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

onMounted(async () => {
  // Проверяем сессию
  await checkAndRefreshSession();
  
  // Загружаем историю сообщений
  // ...
});
</script>

<style scoped>
.ai-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
}

.connect-wallet-message {
  background-color: #fff3e0;
  color: #e65100;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  text-align: center;
  font-weight: 500;
  border: 1px solid #ffe0b2;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  margin-bottom: 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: white;
}

.message {
  margin-bottom: 1rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
}

.message.user {
  background-color: #e3f2fd;
  margin-left: 2rem;
}

.message.assistant {
  background-color: #f5f5f5;
  margin-right: 2rem;
}

.message.system {
  background-color: #ffebee;
  text-align: center;
}

.chat-input {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

textarea.disabled {
  background-color: #f5f5f5;
  border-color: #ddd;
  color: #999;
  cursor: not-allowed;
}

textarea.disabled::placeholder {
  color: #999;
}

button.disabled {
  background-color: #e0e0e0;
  color: #999;
  cursor: not-allowed;
}

textarea {
  flex: 1;
  min-height: 60px;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  resize: vertical;
  transition: all 0.3s ease;
}

button {
  padding: 0.5rem 1rem;
  background-color: #1976d2;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 120px;
}

button:not(.disabled):hover {
  background-color: #1565c0;
}
</style> 