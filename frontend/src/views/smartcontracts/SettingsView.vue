<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
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
        <button class="close-btn" @click="goBackToBlocks">×</button>
      </div>

      <!-- Основной контент -->
      <div v-if="dleInfo" class="main-content">
        <!-- Отображение в футере -->
        <div v-if="canSetFooterDle" class="footer-card">
          <div class="footer-header">
            <h3>Отображение в футере</h3>
          </div>
          <div class="footer-content">
            <p>Выберите этот DLE для отображения в футере приложения. Название будет показано в строке с кнопкой бургера.</p>
            <div v-if="isSelectedForFooter" class="selected-info">
              <i class="fas fa-check-circle"></i>
              <span>Этот DLE отображается в футере</span>
            </div>
            <div v-else-if="hasFooterDle" class="other-selected-info">
              <i class="fas fa-info-circle"></i>
              <span>В футере отображается другой DLE: {{ footerDle.value?.name }} ({{ footerDle.value?.symbol }})</span>
            </div>
            <div class="footer-actions">
              <button 
                v-if="!isSelectedForFooter" 
                @click="setAsFooterDle" 
                class="btn-primary" 
                :disabled="isLoading"
              >
                <i class="fas fa-eye"></i>
                Отображать в футере
              </button>
              <button 
                v-if="isSelectedForFooter" 
                @click="removeFromFooter" 
                class="btn-danger" 
                :disabled="isLoading"
              >
                <i class="fas fa-trash"></i>
                Удалить из футера
              </button>
              <button 
                v-if="hasFooterDle && !isSelectedForFooter" 
                @click="removeFromFooter" 
                class="btn-danger btn-sm" 
                :disabled="isLoading"
              >
                <i class="fas fa-trash"></i>
                Удалить из футера
              </button>
            </div>
          </div>
        </div>

        <!-- Удаление DLE -->
        <div class="danger-card">
          <div class="danger-header">
            <h3>Удаление DLE</h3>
          </div>
          <div class="danger-content">
            <p>Полное удаление DLE и всех связанных данных. Это действие необратимо.</p>
            <div class="warning-info">
              <h4>⚠️ Важно:</h4>
              <ul>
                <li>Для деактивации DLE необходимо иметь токены</li>
                <li>Может потребоваться голосование участников</li>
                <li>DLE должен быть активен</li>
                <li>Только владелец токенов может инициировать деактивацию</li>
              </ul>
            </div>
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
        <button @click="goBackToBlocks" class="btn-primary">
          Вернуться к списку DLE
        </button>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, defineProps, defineEmits, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthContext } from '../../composables/useAuth';
import { useFooterDle } from '../../composables/useFooterDle';
import { usePermissions } from '../../composables/usePermissions';
import { ROLES } from '../../composables/permissions';
import BaseLayout from '../../components/BaseLayout.vue';
import { deactivateDLE } from '../../utils/dle-contract.js';
import api from '../../api/axios';

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

// Функция возврата к блокам управления
const goBackToBlocks = () => {
  if (address) {
    router.push(`/management/dle-blocks?address=${address}`);
  } else {
    router.push('/management');
  }
};

// Получаем адрес пользователя из контекста аутентификации
const { address: userAddress } = useAuthContext();

// Используем composable для проверки прав доступа
const { currentRole } = usePermissions();

// Используем composable для выбранного DLE
const { footerDle, setFooterDle, clearFooterDle } = useFooterDle();

// Проверяем, может ли пользователь устанавливать DLE для футера (только редактор)
const canSetFooterDle = computed(() => {
  return currentRole.value === ROLES.EDITOR;
});

// Проверяем, выбран ли этот DLE для отображения в футере
const isSelectedForFooter = computed(() => {
  if (!address || !footerDle.value) return false;
  // Сравниваем адреса в нижнем регистре для надежности
  return footerDle.value.address && footerDle.value.address.toLowerCase() === address.toLowerCase();
});

// Проверяем, есть ли какой-либо DLE в футере
const hasFooterDle = computed(() => {
  return footerDle.value !== null && footerDle.value.address !== null;
});

// Устанавливает выбранный DLE для отображения в футере
const setAsFooterDle = async () => {
  // Проверяем права доступа (только редактор может устанавливать DLE для футера)
  if (!canSetFooterDle.value) {
    alert('❌ Только пользователи с ролью редактор могут устанавливать DLE для отображения в футере');
    return;
  }

  if (!dleInfo.value || !address) {
    alert('Информация о DLE не загружена');
    return;
  }

  try {
    // Устанавливаем адрес, данные будут загружены из блокчейна
    await setFooterDle(address, dleInfo.value?.currentChainId ?? null);
    
    alert(`✅ DLE "${dleInfo.value.name} (${dleInfo.value.symbol})" теперь отображается в футере приложения`);
  } catch (error) {
    console.error('Ошибка при установке выбранного DLE:', error);
    alert('❌ Не удалось установить выбранный DLE');
  }
};

// Удаляет DLE из футера
const removeFromFooter = async () => {
  // Проверяем права доступа (только редактор может удалять DLE из футера)
  if (!canSetFooterDle.value) {
    alert('❌ Только пользователи с ролью редактор могут удалять DLE из футера');
    return;
  }

  if (!confirm('Вы уверены, что хотите удалить этот DLE из футера?')) {
    return;
  }

  try {
    await clearFooterDle();
    alert('✅ DLE удален из футера приложения');
  } catch (error) {
    console.error('Ошибка при удалении DLE из футера:', error);
    alert('❌ Не удалось удалить DLE из футера');
  }
};

// Подписываемся на централизованные события очистки и обновления данных
onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    console.log('[SettingsView] Clearing DLE settings data');
    // Очищаем данные при выходе из системы
    dleInfo.value = null;
  });
  
  window.addEventListener('refresh-application-data', () => {
    console.log('[SettingsView] Refreshing DLE settings data');
    loadDLEInfo(); // Обновляем данные при входе в систему
  });
});

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
    const response = await api.post('/blockchain/read-dle-info', {
      dleAddress: address
    });
    
    if (response.data.success) {
      const dleData = response.data.data;
      console.log('Загружены данные DLE из блокчейна:', dleData);
      
      dleInfo.value = {
        name: dleData.name,           // Название DLE из блокчейна
        symbol: dleData.symbol,       // Символ DLE из блокчейна
        address: dleData.dleAddress || address,  // Адрес из API или из URL
        logoURI: dleData.logoURI || '', // URL логотипа
        currentChainId: Number(dleData.currentChainId) || null
      };
    } else {
      console.error('Ошибка загрузки DLE:', response.data.error);
      throw new Error(response.data.error || 'Не удалось загрузить данные DLE');
    }
    
  } catch (error) {
    console.error('Ошибка при загрузке информации о DLE:', error);
    // В случае ошибки НЕ устанавливаем fallback данные, оставляем null
    // чтобы не показывать некорректную информацию
    dleInfo.value = null;
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
    
    // Перенаправляем на страницу блоков управления
    goBackToBlocks();
    
  } catch (error) {
    console.error('Ошибка при деактивации DLE:', error);
    
    let errorMessage = 'Ошибка при деактивации DLE';
    
    if (error.message.includes('execution reverted')) {
      errorMessage = '❌ Деактивация невозможна: не выполнены условия смарт-контракта. Возможно, требуется голосование участников или DLE уже деактивирован.';
    } else if (error.message.includes('владелец')) {
      errorMessage = '❌ Только владелец DLE может его деактивировать';
    } else if (error.message.includes('кошелек')) {
      errorMessage = '❌ Необходимо подключить кошелек';
    } else if (error.message.includes('деактивирован')) {
      errorMessage = '❌ DLE уже деактивирован';
    } else if (error.message.includes('токены')) {
      errorMessage = '❌ Для деактивации DLE необходимо иметь токены';
    } else if (error.message.includes('условия смарт-контракта')) {
      errorMessage = error.message; // Используем сообщение из dle-contract.js
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
.footer-card,
.danger-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.footer-header {
  background: #f0f7ff;
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
}

.footer-header h3 {
  color: var(--color-primary);
  margin: 0;
  font-size: 1.2rem;
}

.footer-content {
  padding: 20px;
}

.footer-content p {
  color: var(--color-grey-dark);
  margin-bottom: 15px;
  line-height: 1.5;
}

.footer-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.selected-info {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #e6f7e6;
  border: 1px solid #b3e5b3;
  border-radius: 6px;
  padding: 10px 15px;
  margin-bottom: 15px;
  color: #2d5a2d;
  font-weight: 500;
}

.selected-info i {
  color: #28a745;
  font-size: 1.1rem;
}

.other-selected-info {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  padding: 10px 15px;
  margin-bottom: 15px;
  color: #856404;
  font-weight: 500;
}

.other-selected-info i {
  color: #ffc107;
  font-size: 1.1rem;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 0.875rem;
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

/* Стили для блока предупреждения */
.warning-info {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  padding: 15px;
  margin: 15px 0;
}

.warning-info h4 {
  color: #856404;
  margin: 0 0 10px 0;
  font-size: 1rem;
}

.warning-info ul {
  margin: 0;
  padding-left: 20px;
  color: #856404;
}

.warning-info li {
  margin-bottom: 5px;
  font-size: 0.9rem;
  line-height: 1.4;
}
</style> 