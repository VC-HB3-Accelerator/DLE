<template>
  <div class="admin-view">
    <h1>Панель администратора</h1>

    <div v-if="!authStore.isAdmin" class="admin-error">
      <p>У вас нет прав администратора для доступа к этой странице.</p>
      <button @click="updateAdminStatus" class="btn btn-primary">
        Получить права администратора
      </button>
    </div>

    <div v-else-if="loading" class="loading">Загрузка данных администратора...</div>

    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-else class="admin-content">
      <div class="admin-section">
        <h2>Статистика</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <h3>Пользователи</h3>
            <p class="stat-value">{{ stats.userCount || 0 }}</p>
          </div>
          <div class="stat-card">
            <h3>Доски</h3>
            <p class="stat-value">{{ stats.boardCount || 0 }}</p>
          </div>
          <div class="stat-card">
            <h3>Задачи</h3>
            <p class="stat-value">{{ stats.taskCount || 0 }}</p>
          </div>
        </div>
      </div>

      <div class="admin-section">
        <h2>Пользователи</h2>
        <table class="users-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Адрес</th>
              <th>Администратор</th>
              <th>Создан</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>{{ user.id }}</td>
              <td>{{ user.address }}</td>
              <td>{{ user.is_admin ? 'Да' : 'Нет' }}</td>
              <td>{{ new Date(user.created_at).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="admin-section">
        <h2>Логи</h2>
        <table class="logs-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Тип</th>
              <th>Сообщение</th>
              <th>Время</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id">
              <td>{{ log.id }}</td>
              <td>{{ log.type }}</td>
              <td>{{ log.message }}</td>
              <td>{{ new Date(log.created_at).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import axios from 'axios';

const authStore = useAuthStore();
const users = ref([]);
const stats = ref({});
const logs = ref([]);
const loading = ref(true);
const error = ref(null);

// Функция для обновления статуса администратора
async function updateAdminStatus() {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    console.log('Обновление статуса администратора для адреса:', authStore.address);

    // Отправляем запрос на обновление статуса администратора
    const response = await axios.post(
      `${apiUrl}/api/auth/update-admin-status`,
      {
        address: authStore.address,
        isAdmin: true,
      },
      {
        withCredentials: true,
      }
    );

    console.log('Статус администратора обновлен:', response.data);

    // Обновляем сессию
    const refreshResponse = await axios.post(
      `${apiUrl}/api/auth/refresh-session`,
      {
        address: authStore.address,
      },
      {
        withCredentials: true,
      }
    );

    console.log('Сессия обновлена после обновления статуса:', refreshResponse.data);

    // Обновляем статус администратора в хранилище
    authStore.updateAuthState({
      ...authStore.$state,
      isAdmin: refreshResponse.data.isAdmin,
    });

    // Перезагружаем страницу
    window.location.reload();
  } catch (error) {
    console.error('Ошибка при обновлении статуса администратора:', error);

    if (error.response) {
      console.error('Статус ответа:', error.response.status);
      console.error('Данные ответа:', error.response.data);
    }
  }
}

// Загрузка данных администратора
async function loadAdminData() {
  try {
    loading.value = true;
    error.value = null;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    // Заголовки для запросов
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.address}`,
    };

    console.log('Запрос к API администратора с заголовками:', headers);

    // Загрузка пользователей
    const usersResponse = await axios.get(`${apiUrl}/api/admin/users`, {
      withCredentials: true,
      headers,
    });

    users.value = usersResponse.data;

    // Загрузка статистики
    const statsResponse = await axios.get(`${apiUrl}/api/admin/stats`, {
      withCredentials: true,
      headers,
    });

    stats.value = statsResponse.data;

    // Загрузка логов
    const logsResponse = await axios.get(`${apiUrl}/api/admin/logs`, {
      withCredentials: true,
      headers,
    });

    logs.value = logsResponse.data;

    loading.value = false;
  } catch (error) {
    console.error('Ошибка при загрузке данных администратора:', error);

    if (error.response) {
      console.error('Статус ответа:', error.response.status);
      console.error('Данные ответа:', error.response.data);
      console.error('Заголовки ответа:', error.response.headers);
    }

    error.value = 'Ошибка при загрузке данных администратора';
    loading.value = false;
  }
}

onMounted(async () => {
  if (authStore.isAdmin) {
    await loadAdminData();
  }
});
</script>

<style scoped>
.admin-view {
  padding: 1rem;
}

.admin-error {
  text-align: center;
  padding: 2rem;
  background-color: #f8d7da;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.admin-section {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-card {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: #3498db;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e9ecef;
}

th {
  background-color: #f8f9fa;
  font-weight: bold;
}

.loading,
.error-message {
  text-align: center;
  padding: 2rem;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.error-message {
  color: #e74c3c;
}
</style>
