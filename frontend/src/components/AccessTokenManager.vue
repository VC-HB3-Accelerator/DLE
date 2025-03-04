<template>
  <div class="access-token-manager">
    <h3>Управление токенами доступа</h3>
    <div class="token-actions">
      <button @click="mintNewToken">Выпустить новый токен</button>
      <button @click="loadTokens">Обновить список</button>
    </div>

    <div v-if="loading">Загрузка...</div>

    <table v-else-if="tokens.length > 0" class="tokens-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Владелец</th>
          <th>Роль</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="token in tokens" :key="token.id">
          <td>{{ token.id }}</td>
          <td>{{ token.owner }}</td>
          <td>{{ getRoleName(token.role) }}</td>
          <td>
            <button @click="revokeToken(token.id)">Отозвать</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-else>Нет доступных токенов</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const tokens = ref([]);
const loading = ref(false);

const roles = {
  0: 'Администратор',
  1: 'Модератор',
  2: 'Пользователь',
};

function getRoleName(roleId) {
  return roles[roleId] || 'Неизвестная роль';
}

async function loadTokens() {
  try {
    console.log('Загрузка токенов...');
    loading.value = true;

    // Добавляем withCredentials для передачи куки с сессией
    const response = await axios.get('/api/access/tokens', {
      withCredentials: true,
    });

    console.log('Ответ API:', response.data);
    tokens.value = response.data;
  } catch (error) {
    console.error('Ошибка при загрузке токенов:', error);
    if (error.response) {
      console.error('Статус ошибки:', error.response.status);
      console.error('Данные ошибки:', error.response.data);
    } else if (error.request) {
      console.error('Запрос без ответа:', error.request);
    } else {
      console.error('Ошибка настройки запроса:', error.message);
    }
  } finally {
    loading.value = false;
  }
}

async function mintNewToken() {
  try {
    const walletAddress = prompt('Введите адрес получателя:');
    if (!walletAddress) return;

    const role = prompt('Введите роль (ADMIN, MODERATOR, USER):');
    if (!role) return;

    const expiresInDays = prompt('Введите срок действия в днях:');
    if (!expiresInDays) return;

    // Используем правильные имена параметров
    await axios.post(
      '/api/access/mint',
      {
        walletAddress,
        role,
        expiresInDays,
      },
      {
        withCredentials: true,
      }
    );

    await loadTokens();
  } catch (error) {
    console.error('Ошибка при выпуске токена:', error);
    if (error.response) {
      console.error('Статус ошибки:', error.response.status);
      console.error('Данные ошибки:', error.response.data);
    }
  }
}

async function revokeToken(tokenId) {
  try {
    if (!confirm(`Вы уверены, что хотите отозвать токен #${tokenId}?`)) return;

    await axios.post('/api/access/revoke', { tokenId });
    await loadTokens();
  } catch (error) {
    console.error('Ошибка при отзыве токена:', error);
  }
}

onMounted(async () => {
  await loadTokens();
});
</script>

<style scoped>
.access-token-manager {
  margin: 20px 0;
}

.token-actions {
  margin: 15px 0;
}

.tokens-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
}

.tokens-table th,
.tokens-table td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

.tokens-table th {
  background-color: #f2f2f2;
}

button {
  margin-right: 5px;
  padding: 5px 10px;
  cursor: pointer;
}
</style>
