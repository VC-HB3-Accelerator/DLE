<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="settings-container">
      <!-- Заголовок -->
      <div class="page-header">
        <div class="header-content">
          <h1>Настройки DLE</h1>
          <p v-if="dleInfo">{{ dleInfo.name }} ({{ dleInfo.symbol }}) - {{ dleInfo.address }}</p>
          <p v-else-if="address">Загрузка...</p>
          <p v-else>DLE не выбран</p>
        </div>
        <button class="close-btn" @click="router.push('/management')">×</button>
      </div>

      <!-- Основной контент -->
      <div v-if="dleInfo" class="main-content">
        <!-- Удаление DLE -->
        <div class="danger-card">
          <div class="danger-header">
            <h3>Удаление DLE</h3>
          </div>
          <div class="danger-content">
            <p>Полное удаление DLE и всех связанных данных. Это действие необратимо.</p>
            <button @click="deleteDLE" class="btn-danger" :disabled="isLoading">
              {{ isLoading ? 'Загрузка...' : 'Удалить DLE' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Сообщение если DLE не выбран -->
      <div v-if="!address" class="no-dle-card">
        <h3>DLE не выбран</h3>
        <p>Для управления настройками необходимо выбрать DLE</p>
        <button @click="router.push('/management')" class="btn-primary">
          Вернуться к списку DLE
        </button>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, defineProps, defineEmits, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthContext } from '@/composables/useAuth';
import BaseLayout from '../../components/BaseLayout.vue';
import { getDLEInfo, deactivateDLE } from '../../utils/dle-contract.js';

// Определяем props
const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

// Определяем emits
const emit = defineEmits(['auth-action-completed']);

const router = useRouter();
const route = useRoute();

// Состояние
const isSaving = ref(false);
const dleAddress = ref('');
const dleInfo = ref(null);
const isLoading = ref(false);

// Получаем адрес DLE из URL параметров
const address = route.query.address || props.dleAddress;

// Получаем адрес пользователя из контекста аутентификации
const { address: userAddress } = useAuthContext();

// Загружаем информацию о DLE
const loadDLEInfo = async () => {
  if (!address) {
    console.error('Адрес DLE не указан');
    return;
  }

  try {
    isLoading.value = true;
    console.log('Загружаем информацию о DLE:', address);
    
    // Загружаем данные DLE из блокчейна через API
    const dleData = await getDLEInfo(address);
    console.log('Загружены данные DLE из блокчейна:', dleData);
    
    dleInfo.value = {
      name: dleData.name,           // Название DLE из блокчейна
      symbol: dleData.symbol,       // Символ DLE из блокчейна
      address: dleData.dleAddress || address  // Адрес из API или из URL
    };
    
  } catch (error) {
    console.error('Ошибка при загрузке информации о DLE:', error);
    // В случае ошибки показываем базовую информацию
    dleInfo.value = {
      name: 'DLE ' + address.slice(0, 8) + '...',
      symbol: 'DLE',
      address: address
    };
  } finally {
    isLoading.value = false;
  }
};

// Методы
const deleteDLE = async () => {
  if (!address) {
    alert('Адрес DLE не найден');
    return;
  }

  // Проверяем аутентификацию
  if (!props.isAuthenticated || !userAddress.value) {
    alert('❌ Для удаления DLE необходимо авторизоваться в приложении');
    return;
  }

  if (!confirm(`ВНИМАНИЕ! Это действие необратимо. Вы уверены, что хотите деактивировать DLE ${dleInfo.value?.name || address}?`)) {
    return;
  }
  
  if (!confirm('Это действие нельзя отменить. Подтвердите деактивацию еще раз.')) {
    return;
  }

  try {
    isSaving.value = true;
    console.log('Деактивация DLE:', address);
    
    // Выполняем деактивацию DLE
    const result = await deactivateDLE(address, userAddress.value);
    
    console.log('Результат деактивации:', result);
    
    alert(`✅ DLE ${dleInfo.value?.name || address} успешно деактивирован!\n\nТранзакция: ${result.txHash}`);
    
    // Перенаправляем на главную страницу управления
    router.push('/management');
    
  } catch (error) {
    console.error('Ошибка при деактивации DLE:', error);
    
    let errorMessage = 'Ошибка при деактивации DLE';
    
    if (error.message.includes('владелец')) {
      errorMessage = '❌ Только владелец DLE может его деактивировать';
    } else if (error.message.includes('кошелек')) {
      errorMessage = '❌ Необходимо подключить кошелек';
    } else if (error.message.includes('деактивирован')) {
      errorMessage = '❌ DLE уже деактивирован';
    } else {
      errorMessage = `❌ Ошибка: ${error.message}`;
    }
    
    alert(errorMessage);
  } finally {
    isSaving.value = false;
  }
};

// Загружаем данные при монтировании компонента
onMounted(() => {
  if (address) {
    dleAddress.value = address;
    loadDLEInfo();
  }
});
</script>

<style scoped>
.settings-container {
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
  margin-bottom: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 15px;
  border-bottom: 1px solid #f0f0f0;
}

.header-content {
  flex-grow: 1;
}

.page-header h1 {
  color: var(--color-primary);
  font-size: 2rem;
  margin: 0 0 5px 0;
}

.page-header p {
  color: var(--color-grey-dark);
  font-size: 1rem;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
  flex-shrink: 0;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

/* Основной контент */
.main-content {
  display: grid;
  gap: 20px;
}

/* Карточки */
.danger-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.danger-header {
  background: #f8f9fa;
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
}

.danger-header h3 {
  color: #c53030;
  margin: 0;
  font-size: 1.2rem;
}

.danger-content {
  padding: 20px;
}

/* Кнопки */
.btn-primary,
.btn-danger {
  border: none;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.btn-danger {
  background: #e53e3e;
  color: white;
}

.btn-danger:hover {
  background: #c53030;
  transform: translateY(-1px);
}

.btn-primary:active,
.btn-danger:active {
  transform: translateY(0);
}

/* Сообщение если DLE не выбран */
.no-dle-card {
  background: #fff5f5;
  border: 2px solid #fed7d7;
  border-radius: var(--radius-lg);
  padding: 30px;
  text-align: center;
}

.no-dle-card h3 {
  color: #c53030;
  margin-bottom: 10px;
  font-size: 1.2rem;
}

.no-dle-card p {
  color: #4a5568;
  margin-bottom: 15px;
  line-height: 1.5;
  font-size: 0.9rem;
}
</style> 