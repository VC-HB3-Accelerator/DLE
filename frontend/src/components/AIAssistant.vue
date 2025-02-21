<template>
  <div class="ai-assistant" v-if="isConnected">
    <h3>AI Ассистент</h3>
    
    <div class="chat-container" ref="chatContainer">
      <div v-for="(message, index) in messages" :key="index" 
           :class="['message', message.role]">
        {{ message.content }}
      </div>
    </div>

    <div class="input-container">
      <input 
        v-model="userInput"
        @keyup.enter="sendMessage"
        placeholder="Задайте вопрос..."
        :disabled="isLoading"
      />
      <button 
        @click="sendMessage" 
        :disabled="!userInput || isLoading"
      >
        {{ isLoading ? 'Отправка...' : 'Отправить' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { getAddress } from 'ethers'

const props = defineProps({
  isConnected: Boolean,
  userAddress: String
})

const emit = defineEmits(['chatUpdated'])

const userInput = ref('')
const messages = ref([])
const isLoading = ref(false)
const isAuthenticated = ref(false)
const chatContainer = ref(null)

// Функция для SIWE аутентификации
async function authenticateWithSIWE() {
  try {
    // Получаем nonce
    const nonceResponse = await fetch(
      'http://127.0.0.1:3000/nonce',
      { credentials: 'include' }
    );
    const { nonce } = await nonceResponse.json();
    
    // Создаем сообщение для подписи
    const message = 
      `127.0.0.1:5174 wants you to sign in with your Ethereum account:\n` +
      `${getAddress(props.userAddress)}\n\n` +
      `Sign in with Ethereum to access AI Assistant\n\n` +
      `URI: http://127.0.0.1:5174\n` +
      `Version: 1\n` +
      `Chain ID: 11155111\n` +
      `Nonce: ${nonce}\n` +
      `Issued At: ${new Date().toISOString()}\n` +
      `Resources:\n` +
      `- http://127.0.0.1:5174/api/chat`;
    
    // Получаем подпись
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, props.userAddress]
    });
    
    // Верифицируем подпись
    const verifyResponse = await fetch('http://127.0.0.1:3000/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SIWE-Nonce': nonce
      },
      credentials: 'include',
      body: JSON.stringify({ message, signature })
    });
    
    if (!verifyResponse.ok) {
      throw new Error('Failed to verify signature');
    }
    
    isAuthenticated.value = true;
  } catch (error) {
    console.error('SIWE error:', error);
    messages.value.push({
      role: 'system',
      content: 'Ошибка аутентификации. Пожалуйста, попробуйте снова.'
    });
  }
}

async function sendMessage() {
  if (!userInput.value) return;
  
  try {
    isLoading.value = true;
    
    const response = await fetch('http://127.0.0.1:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        message: userInput.value,
        userAddress: props.userAddress
      })
    });

    if (response.status === 401) {
      messages.value.push({
        role: 'system',
        content: 'Пожалуйста, подключите кошелек и авторизуйтесь'
      });
      return;
    }

    if (!response.ok) {
      throw new Error('Network response was not ok')
    }

    const data = await response.json()
    messages.value.push({ role: 'user', content: userInput.value })
    messages.value.push({ role: 'assistant', content: data.response })
    userInput.value = ''
    emit('chatUpdated')
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error)
    messages.value.push({ 
      role: 'system', 
      content: 'Произошла ошибка при получении ответа' 
    })
  } finally {
    isLoading.value = false
  }
}

// Загрузка истории чата
async function loadChatHistory() {
  try {
    const response = await fetch('http://127.0.0.1:3000/api/chat/history', {
      credentials: 'include'
    });
    const data = await response.json();
    messages.value = data.history.map(item => ({
      role: item.is_user ? 'user' : 'assistant',
      content: item.is_user ? item.message : item.response
    }));
  } catch (error) {
    console.error('Ошибка загрузки истории:', error);
  }
}

// Загружаем историю при монтировании
onMounted(() => {
  if (props.isConnected) {
    loadChatHistory();
  }
});

watch(messages, () => {
  if (chatContainer.value) {
    setTimeout(() => {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }, 0)
  }
}, { deep: true })
</script>

<style scoped>
.ai-assistant {
  margin-top: 20px;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.chat-container {
  height: 300px;
  overflow-y: auto;
  margin-bottom: 15px;
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 4px;
}

.message {
  margin: 8px 0;
  padding: 8px 12px;
  border-radius: 4px;
}

.user {
  background-color: #e3f2fd;
  margin-left: 20%;
}

.assistant {
  background-color: #f5f5f5;
  margin-right: 20%;
}

.system {
  background-color: #ffebee;
  text-align: center;
}

.input-container {
  display: flex;
  gap: 10px;
}

input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background-color: #cccccc;
}
</style> 