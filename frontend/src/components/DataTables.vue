<template>
  <div class="data-tables" v-if="isConnected">
    <h3>Данные из базы</h3>
    
    <!-- История чатов -->
    <div class="table-section">
      <h4>История чатов</h4>
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
          <tr v-for="chat in chatHistory" :key="chat.id">
            <td>{{ shortenAddress(chat.address) }}</td>
            <td>{{ chat.message }}</td>
            <td>{{ chat.response }}</td>
            <td>{{ formatDate(chat.created_at) }}</td>
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
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';

const props = defineProps({
  isConnected: Boolean,
  userAddress: String
});

const chatHistory = ref([]);
const users = ref([]);

// Нормализация адреса (приведение к нижнему регистру)
function normalizeAddress(address) {
  return address?.toLowerCase() || '';
}

// Следим за изменением состояния подключения
watch(() => props.isConnected, (newValue) => {
  console.log('isConnected изменился:', newValue);
  if (newValue) {
    fetchData();
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
    // История чатов
    const chatResponse = await fetch('http://127.0.0.1:3000/api/chat/history', {
      credentials: 'include'
    });
    const chatData = await chatResponse.json();
    console.log('Получена история чата:', chatData);
    chatHistory.value = chatData.history.map(chat => ({
      ...chat,
      address: normalizeAddress(chat.address)
    }));

    // Пользователи
    const usersResponse = await fetch('http://127.0.0.1:3000/api/users', {
      credentials: 'include'
    });
    const usersData = await usersResponse.json();
    console.log('Получен список пользователей:', usersData);
    users.value = usersData.users.map(user => ({
      ...user,
      address: normalizeAddress(user.address)
    }));
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

onMounted(() => {
  if (props.isConnected) {
    fetchData();
  }
});

// Делаем метод доступным извне
defineExpose({
  fetchData
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
</style> 