<template>
    <div class="ai-assistant">
      <h3>AI Ассистент</h3>
      
      <div class="chat-container" ref="chatContainer">
        <div v-if="messages.length === 0" class="empty-state">
          Начните диалог с AI ассистентом
        </div>
        <div v-for="(message, index) in messages" :key="index" 
             :class="['message', message.role]">
          {{ message.content }}
        </div>
      </div>
  
      <div class="input-container">
        <input 
          v-model="userInput"
          @keyup.enter="sendMessage"
          placeholder="Введите сообщение..."
          :disabled="isLoading"
        />
        <button 
          @click="sendMessage" 
          :disabled="isLoading || !userInput"
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
    userAddress: String
  })
  
  const emit = defineEmits(['chatUpdated'])
  
  const userInput = ref('')
  const messages = ref([])
  const isLoading = ref(false)
  const chatContainer = ref(null)
  
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
          message: userInput.value
        })
      });
  
      if (!response.ok) {
        if (response.status === 401) {
          messages.value.push({
            role: 'system',
            content: 'Пожалуйста, подключите кошелек для сохранения истории чата'
          });
        } else {
          throw new Error('Network response was not ok')
        }
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
      if (!props.userAddress) {
        console.log('Адрес пользователя не определен');
        return;
      }
  
      const response = await fetch('http://127.0.0.1:3000/api/chat/history', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.log('Ошибка загрузки истории:', error);
        
        if (error.error === 'User not found') {
          // Создаем нового пользователя
          const createUserResponse = await fetch('http://127.0.0.1:3000/api/users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
              address: props.userAddress
            })
          });
          
          if (!createUserResponse.ok) {
            console.error('Ошибка создания пользователя:', await createUserResponse.text());
            return;
          }
  
          if (createUserResponse.ok) {
            // Повторно загружаем историю
            return loadChatHistory();
          }
        }
        return;
      }
      
      const data = await response.json();
      messages.value = (data.history || []).map(chat => ({
        role: chat.is_user ? 'user' : 'assistant',
        content: chat.is_user ? chat.message : JSON.parse(chat.response).content
      }));
    } catch (error) {
      console.error('Ошибка загрузки истории:', error);
    }
  }
  
  // Загружаем историю при монтировании
  onMounted(() => {
    if (props.userAddress) {
      loadChatHistory()
    }
  })
  
  // Добавляем наблюдение за изменением адреса
  watch(() => props.userAddress, (newAddress) => {
    if (newAddress) {
      loadChatHistory()
    } else {
      messages.value = []
    }
  })
  
  watch(messages, () => {
    if (chatContainer.value) {
      setTimeout(() => {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight
      }, 0)
    }
  }, { deep: true })
  </script>
  
  <style scoped>
  .empty-state {
    text-align: center;
    color: #666;
    padding: 2rem;
  }
  
  .ai-assistant {
    margin-top: 20px;
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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