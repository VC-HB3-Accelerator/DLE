<template>
  <BaseLayout>
    <div class="settings-view-container">
      <h1>Настройки</h1>
      
      <!-- Блок информации о пользователе (всегда виден) -->
      <div class="user-info-section">
        <h3>Ваши идентификаторы:</h3>
        <div v-if="!auth.isAuthenticated.value" class="user-info-empty">
          Войдите, чтобы увидеть идентификаторы
        </div>
        <div v-else class="user-info-item">
          <span class="user-info-label">Кошелек:</span>
          <span v-if="hasIdentityType('wallet')" class="user-info-value">
            {{ truncateAddress(getIdentityValue('wallet')) }}
          </span>
          <span v-else class="user-info-value">Не подключен</span>
        </div>
      </div>
      
      <!-- Блок баланса токенов (всегда виден) -->
      <div class="token-balances-section">
        <h3>Баланс токенов:</h3>
        <div v-if="!auth.isAuthenticated.value" class="token-no-data">
          Войдите, чтобы увидеть баланс токенов
        </div>
        <div v-else-if="isLoadingTokens" class="token-loading">
          Загрузка балансов...
        </div>
        <div v-else-if="!hasTokenBalances" class="token-no-data">
          Информация о балансе не доступна
        </div>
        <div v-else>
          <div v-if="tokenBalances.eth" class="token-balance">
            <span class="token-name">ETH:</span>
            <span class="token-amount">{{ Number(tokenBalances.eth).toLocaleString() }}</span>
            <span class="token-symbol">{{ TOKEN_CONTRACTS.eth.symbol }}</span>
          </div>
          <div v-if="tokenBalances.bsc" class="token-balance">
            <span class="token-name">BSC:</span>
            <span class="token-amount">{{ Number(tokenBalances.bsc).toLocaleString() }}</span>
            <span class="token-symbol">{{ TOKEN_CONTRACTS.bsc.symbol }}</span>
          </div>
          <div v-if="tokenBalances.arbitrum" class="token-balance">
            <span class="token-name">ARB:</span>
            <span class="token-amount">{{ Number(tokenBalances.arbitrum).toLocaleString() }}</span>
            <span class="token-symbol">{{ TOKEN_CONTRACTS.arbitrum.symbol }}</span>
          </div>
          <div v-if="tokenBalances.polygon" class="token-balance">
            <span class="token-name">POL:</span>
            <span class="token-amount">{{ Number(tokenBalances.polygon).toLocaleString() }}</span>
            <span class="token-symbol">{{ TOKEN_CONTRACTS.polygon.symbol }}</span>
          </div>
        </div>
      </div>
      
      <div v-if="isLoading">Загрузка данных пользователя...</div>
      <div v-else-if="!auth.isAuthenticated.value">
        <p>Для доступа к настройкам необходимо <button @click="goToHomeAndShowSidebar">войти</button>.</p>
      </div>
      <div v-else>
        <p>Добро пожаловать в Настройки!</p>
        
        <div v-if="auth.isAdmin.value">
          <p><strong>У вас полный доступ (Администратор).</strong></p>
          <!-- Сюда будут добавляться полные настройки -->
          <p>Здесь будут настройки системы, управление пользователями и т.д.</p>
        </div>
        <div v-else>
          <p><strong>У вас ограниченный доступ.</strong></p>
          <!-- Сюда будут добавляться ограниченные настройки -->
          <p>Здесь будут настройки профиля, уведомлений и т.д.</p>
        </div>
        <!-- Общие настройки для всех авторизованных -->
        <div class="general-settings">
          <h3>Общие настройки</h3>
          <label>
            Язык интерфейса: 
            <select v-model="selectedLanguage">
              <option value="ru">Русский</option>
              <option value="en">English</option> 
            </select>
          </label>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount, computed } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useRouter } from 'vue-router';
import { getFromStorage, setToStorage } from '../utils/storage';
import BaseLayout from '../components/BaseLayout.vue';
import eventBus from '../utils/eventBus';
import { TOKEN_CONTRACTS } from '../services/tokens';
import { fetchTokenBalances } from '../services/tokens';

const auth = useAuth();
const router = useRouter();
const isLoading = ref(true);
const selectedLanguage = ref(getFromStorage('userLanguage', 'ru'));

// Состояние для токенов
const tokenBalances = ref({});
const isLoadingTokens = ref(false);
const hasTokenBalances = computed(() => {
  return tokenBalances.value && 
    Object.keys(tokenBalances.value).length > 0 && 
    Object.values(tokenBalances.value).some(value => parseInt(value) > 0);
});

// Получаем данные об идентификаторах пользователя
const identities = computed(() => auth.identities.value);

// Вспомогательные функции
const truncateAddress = (address) => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

const hasIdentityType = (type) => {
  if (!identities.value) return false;
  return identities.value.some((identity) => identity.provider === type);
};

const getIdentityValue = (type) => {
  if (!identities.value) return null;
  const identity = identities.value.find((identity) => identity.provider === type);
  return identity ? identity.provider_id : null;
};

// Обновление балансов токенов
const refreshTokenBalances = async () => {
  if (!hasIdentityType('wallet')) return;
  
  isLoadingTokens.value = true;
  try {
    const walletAddress = getIdentityValue('wallet');
    console.log('[SettingsView] Обновление балансов для адреса:', walletAddress);
    
    const balances = await fetchTokenBalances(walletAddress);
    console.log('[SettingsView] Полученные балансы:', balances);
    
    tokenBalances.value = balances || {};
  } catch (error) {
    console.error('[SettingsView] Ошибка при получении балансов:', error);
    tokenBalances.value = {};
  } finally {
    isLoadingTokens.value = false;
  }
};

// Следим за изменениями в идентификаторах
watch(() => identities.value, (newIdentities, oldIdentities) => {
  if (hasIdentityType('wallet')) {
    // Проверяем, появился ли новый идентификатор кошелька или изменился существующий
    const newWalletId = getIdentityValue('wallet');
    const oldWalletIdentity = oldIdentities ? oldIdentities.find(id => id.provider === 'wallet') : null;
    const oldWalletId = oldWalletIdentity ? oldWalletIdentity.provider_id : null;
    
    if (newWalletId !== oldWalletId) {
      console.log('[SettingsView] Обнаружено изменение идентификатора кошелька, обновляем балансы');
      refreshTokenBalances();
    }
  }
}, { deep: true });

// Обработчик события изменения авторизации
const handleAuthEvent = (eventData) => {
  console.log('[SettingsView] Получено событие изменения авторизации:', eventData);
  isLoading.value = false;
  
  // При изменении авторизации обновляем балансы
  if (eventData.isAuthenticated) {
    setTimeout(() => {
      refreshTokenBalances(); // Небольшая задержка для обновления идентификаторов
    }, 500);
  }
};

// Сохраняем язык при изменении
watch(selectedLanguage, (newLang) => {
  setToStorage('userLanguage', newLang);
  // TODO: Добавить логику для реальной смены языка интерфейса (например, через i18n)
  console.log(`[Settings] Язык изменен на: ${newLang}`);
});

const goToHomeAndShowSidebar = () => {
  setToStorage('showWalletSidebar', true);
  router.push({ name: 'home' });
};

// Регистрация и очистка обработчика событий
let unsubscribe = null;

onMounted(() => {
  console.log('[SettingsView] Компонент загружен');
  isLoading.value = false;
  
  // Подписка на события авторизации
  unsubscribe = eventBus.on('auth-state-changed', handleAuthEvent);
  
  // Обновляем данные о балансе токенов при загрузке
  if (auth.isAuthenticated.value && hasIdentityType('wallet')) {
    refreshTokenBalances();
  }
});

onBeforeUnmount(() => {
  // Отписка от события при удалении компонента
  if (unsubscribe) {
    unsubscribe();
  }
});

// Следим за состоянием авторизации для очистки данных при выходе
watch(() => auth.isAuthenticated.value, (isAuth) => {
  if (!isAuth) {
    // Очищаем данные при выходе из системы
    tokenBalances.value = {};
  }
});
</script>

<style scoped>
.settings-view-container {
  max-width: 1150px;
  margin: 20px auto;
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

h1 {
  color: var(--color-dark);
  margin-bottom: 20px;
}

p {
  line-height: 1.6;
  margin-bottom: 10px;
}

strong {
 color: var(--color-primary);
}

.general-settings {
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid var(--color-grey-light);
}

label {
    display: block;
    margin-bottom: 10px;
}

select {
    padding: 8px;
    border: 1px solid var(--color-grey);
    border-radius: var(--radius-md);
    margin-left: 10px;
}

button {
  padding: 5px 10px;
  background-color: var(--color-primary);
  color: var(--color-white);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  margin-left: 5px;
}
button:hover {
  opacity: 0.9;
}
button:disabled {
  background-color: var(--color-grey);
  cursor: not-allowed;
  opacity: 0.7;
}

/* Стили для блока информации о пользователе */
.user-info-section {
  margin-top: 20px;
  margin-bottom: 20px;
  padding: 15px;
  background-color: var(--color-light);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-grey-light);
}

.user-info-item {
  margin-top: 10px;
  display: flex;
  align-items: center;
}

.user-info-label {
  min-width: 100px;
  font-weight: 500;
}

.user-info-value {
  font-family: monospace;
  padding: 5px 10px;
  background-color: var(--color-white);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-grey-light);
}

/* Стили для блока баланса токенов */
.token-balances-section {
  margin-top: 20px;
  margin-bottom: 20px;
  padding: 15px;
  background-color: var(--color-light);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-grey-light);
}

.token-balance {
  display: flex;
  align-items: center;
  margin-top: 10px;
}

.token-name {
  min-width: 60px;
  font-weight: 500;
}

.token-amount {
  font-family: monospace;
  padding: 5px 10px;
  background-color: var(--color-white);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-grey-light);
  margin-right: 10px;
}

.token-symbol {
  color: var(--color-primary);
  font-weight: 500;
}

.token-loading,
.token-no-data {
  margin: 15px 0;
  padding: 10px;
  text-align: center;
  color: var(--color-grey-dark);
  font-style: italic;
}

/* Удаляем стили для кнопки обновления баланса, поскольку больше не нужны */
.token-action,
.refresh-btn {
  display: none;
}

.user-info-empty,
.token-no-data {
  margin: 15px 0;
  padding: 10px;
  text-align: center;
  color: var(--color-grey-dark);
  font-style: italic;
}
</style> 