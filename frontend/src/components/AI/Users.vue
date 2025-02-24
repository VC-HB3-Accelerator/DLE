<template>
    <div class="data-tables">
      <h3>Данные из базы</h3>
      
      <!-- История чатов -->
      <div class="table-section">
        <h4>История чатов</h4>
        <div v-if="displayedChats.length === 0" class="empty-state">
          Нет доступных сообщений
        </div>
        <table v-else>
          <thead>
            <tr>
              <th>Адрес</th>
              <th>Сообщение</th>
              <th>Ответ</th>
              <th>Дата</th>
              <th v-if="isAdmin">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="chat in displayedChats" :key="chat.id">
              <td>{{ shortenAddress(chat.address) }}</td>
              <td>{{ chat.message }}</td>
              <td>{{ JSON.parse(chat.response).content }}</td>
              <td>{{ formatDate(chat.created_at) }}</td>
              <td v-if="isAdmin">
                <button 
                  @click="approveChat(chat.id)"
                  :disabled="chat.is_approved"
                  :class="{ approved: chat.is_approved }"
                >
                  {{ chat.is_approved ? 'Одобрен' : 'Одобрить' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
  
      <!-- Пользователи -->
      <div class="table-section">
        <h4>Пользователи</h4>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Адрес</th>
              <th>Дата регистрации</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>{{ user.id }}</td>
              <td>{{ shortenAddress(user.address) }}</td>
              <td>{{ formatDate(user.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
  
      <div v-if="isAdmin" class="chat-history">
        <h2>История сообщений всех пользователей</h2>
        <table>
          <thead>
            <tr>
              <th>Адрес</th>
              <th>Сообщение</th>
              <th>Ответ</th>
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="chat in allChats" :key="chat.id">
              <td>{{ shortenAddress(chat.address) }}</td>
              <td>{{ chat.message }}</td>
              <td>{{ JSON.parse(chat.response).content }}</td>
              <td>{{ new Date(chat.created_at).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, watch, computed } from 'vue';
  import contractABI from '../../artifacts/MyContract.json'
  
  const props = defineProps({
    isConnected: Boolean,
    userAddress: String
  });
  
  const allChats = ref([]);
  const users = ref([]);
  const isAdmin = ref(false);
  
  const displayedChats = computed(() => {
    return isAdmin.value ? allChats.value : allChats.value.filter(
      chat => chat.address.toLowerCase() === props.userAddress?.toLowerCase()
    );
  });
  
  // Нормализация адреса (приведение к нижнему регистру)
  function normalizeAddress(address) {
    return address?.toLowerCase() || '';
  }
  
  // Следим за изменением состояния подключения
  watch(() => props.isConnected, (newValue) => {
    console.log('isConnected изменился:', newValue);
    if (newValue) {
      // Небольшая задержка для обновления сессии
      setTimeout(() => {
        fetchData();
      }, 500);
    }
  });
  
  // Следим за изменением адреса
  watch(() => props.userAddress, (newValue) => {
    console.log('userAddress изменился:', newValue);
    if (props.isConnected && newValue) {
      fetchData();
    }
  });
  
  // Получение данных
  async function fetchData() {
    try {
      console.log('Запрос обновления данных');
      
      if (!props.userAddress) {
        console.log('Адрес пользователя не определен');
        return;
      }
  
      // Проверяем права админа
      const adminCheck = await fetch('http://127.0.0.1:3000/api/admin/check', {
        credentials: 'include'
      });
      
      if (adminCheck.ok) {
        const { isAdmin: adminStatus } = await adminCheck.json();
        isAdmin.value = adminStatus;
        console.log('Статус админа:', adminStatus);
      }
      
      // Получаем чаты
      const chatsResponse = await fetch('http://127.0.0.1:3000/api/admin/chats', {
        credentials: 'include'
      });
      
      if (chatsResponse.ok) {
        const data = await chatsResponse.json();
        allChats.value = data.chats || [];
      }
      
      // Получаем пользователей
      const usersResponse = await fetch('http://127.0.0.1:3000/api/users', {
        credentials: 'include'
      });
      
      if (usersResponse.ok) {
        const data = await usersResponse.json();
        users.value = data.users || [];
      }
    } catch (error) {
      console.error('Ошибка получения данных:', error);
    }
  }
  
  // Форматирование адреса
  function shortenAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  
  // Форматирование даты
  function formatDate(date) {
    return new Date(date).toLocaleString();
  }
  
  async function approveChat(chatId) {
    try {
      const response = await fetch('http://127.0.0.1:3000/api/admin/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ chatId })
      });
      
      if (!response.ok) throw new Error('Failed to approve chat');
      
      // Обновляем статус локально
      const chat = allChats.value.find(c => c.id === chatId);
      if (chat) chat.is_approved = true;
    } catch (error) {
      console.error('Error approving chat:', error);
      alert('Ошибка при одобрении чата');
    }
  }
  
  onMounted(() => {
    if (props.isConnected) {
      fetchData();
    }
  });
  
  // Делаем метод доступным извне
  defineExpose({
    fetchData
  });
  
  async function fetchAllChats() {
    try {
      const response = await fetch('http://127.0.0.1:3000/api/admin/chats', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        allChats.value = data.chats;
      }
    } catch (error) {
      console.error('Ошибка получения чатов:', error);
    }
  }
  
  onMounted(() => {
    if (props.isAdmin) {
      fetchAllChats();
    }
  });
  
  watch(() => props.isAdmin, (newValue) => {
    if (newValue) {
      fetchAllChats();
    }
  });
  </script>
  
  <style scoped>
  .data-tables {
    margin: 20px;
  }
  
  .table-section {
    margin-bottom: 30px;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
  }
  
  th, td {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: left;
  }
  
  th {
    background-color: #f5f5f5;
  }
  
  tr:nth-child(even) {
    background-color: #f9f9f9;
  }
  
  .empty-state {
    text-align: center;
    color: #666;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 4px;
    margin: 1rem 0;
  }
  </style> 