<template>
  <transition name="sidebar-slide">
    <div v-if="modelValue" class="wallet-sidebar">
      <div class="wallet-sidebar-content">
        <!-- Блок для неавторизованных пользователей -->
        <div v-if="!isAuthenticated">
          <div class="button-with-close">
            <button
              v-if="
                !telegramAuth.showVerification &&
                !emailAuth.showForm &&
                !emailAuth.showVerification
              "
              class="auth-btn connect-wallet-btn"
              @click="handleWalletAuth"
            >
              Подключить кошелек
            </button>
            <button class="close-sidebar-btn" @click="closeSidebar">×</button>
          </div>
        </div>

        <!-- Блок для авторизованных пользователей -->
        <div v-if="isAuthenticated">
          <div class="button-with-close">
            <button class="auth-btn disconnect-wallet-btn" @click="disconnectWallet">
              Отключить
            </button>
            <button class="close-sidebar-btn" @click="closeSidebar">×</button>
          </div>
        </div>

        <!-- Навигационные кнопки -->
        <div class="navigation-buttons">
          <router-link to="/" class="nav-link-btn" active-class="active">
            <span>Чат</span>
          </router-link>
          <router-link to="/crm" class="nav-link-btn" active-class="active">
            <span>CRM</span>
          </router-link>
          <router-link to="/settings" class="nav-link-btn" active-class="active">
            <span>Настройки</span>
          </router-link>
        </div>
        
        <!-- Блок информации о пользователе -->
        <div v-if="isAuthenticated" class="user-info-section sidebar-section">
          <h3>Ваши идентификаторы:</h3>
          <div class="user-info-item">
            <span class="user-info-label">Кошелек:</span>
            <span v-if="hasIdentityType('wallet')" class="user-info-value">
              {{ truncateAddress(getIdentityValue('wallet')) }}
            </span>
            <span v-else class="user-info-value">Не подключен</span>
          </div>
          <!-- Можно добавить другие идентификаторы по аналогии -->
        </div>

        <!-- Блок баланса токенов -->
        <div v-if="isAuthenticated" class="token-balances-section sidebar-section">
          <h3>Баланс токенов:</h3>
          <div v-if="isLoadingTokens" class="token-loading">
            Загрузка балансов...
          </div>
          <div v-else-if="!tokenBalances || Object.keys(tokenBalances).length === 0" class="token-no-data">
            Баланс не доступен
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

      </div>
    </div>
  </transition>
</template>

<script setup>
import { defineProps, defineEmits, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { TOKEN_CONTRACTS } from '../services/tokens';
import { useRouter } from 'vue-router';
import eventBus from '../utils/eventBus';

const router = useRouter();
const props = defineProps({
  modelValue: Boolean,
  isAuthenticated: Boolean,
  telegramAuth: Object,
  emailAuth: Object,
  tokenBalances: Object,
  identities: Array,
  isLoadingTokens: Boolean
});

const emit = defineEmits(['update:modelValue', 'wallet-auth', 'disconnect-wallet']);

// Обработчики событий
const handleWalletAuth = () => {
  emit('wallet-auth');
};

const disconnectWallet = () => {
  emit('disconnect-wallet');
};

// Функция закрытия сайдбара
const closeSidebar = () => {
  emit('update:modelValue', false);
};

// Обработка события изменения авторизации
const handleAuthEvent = (event) => {
  console.log('[Sidebar] Получено событие изменения авторизации:', event);
  // Здесь можно обновить данные, если нужно дополнительное обновление
};

// Подписка на события
let unsubscribe = null;
onMounted(() => {
  unsubscribe = eventBus.on('auth-state-changed', handleAuthEvent);
});

// Очистка при размонтировании
onBeforeUnmount(() => {
  if (unsubscribe) {
    unsubscribe();
  }
});

// Вспомогательные функции
const truncateAddress = (address) => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

const hasIdentityType = (type) => {
  if (!props.identities) return false;
  return props.identities.some((identity) => identity.provider === type);
};

const getIdentityValue = (type) => {
  if (!props.identities) return null;
  const identity = props.identities.find((identity) => identity.provider === type);
  return identity ? identity.provider_id : null;
};

// Добавляем watch для отслеживания props
watch(() => props.tokenBalances, (newVal, oldVal) => {
  console.log('[Sidebar] tokenBalances prop changed:', JSON.stringify(newVal));
}, { deep: true });

watch(() => props.isLoadingTokens, (newVal, oldVal) => {
  console.log(`[Sidebar] isLoadingTokens prop changed: ${newVal}`);
});
</script>

<style scoped>
.wallet-sidebar {
  position: fixed;
  top: 0;
  right: 0;
  width: 100%;
  height: 100%;
  background-color: var(--color-white);
  z-index: 1000;
  overflow-y: auto;
  padding: var(--spacing-lg);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  transition: transform var(--transition-normal), opacity var(--transition-normal);
  box-shadow: -5px 0 15px rgba(0, 0, 0, 0.1);
}

.wallet-sidebar-content {
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
  padding: 0 var(--spacing-md);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

/* Анимация появления и исчезновения правой панели */
.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: all var(--transition-normal);
}

.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.sidebar-slide-enter-to,
.sidebar-slide-leave-from {
  transform: translateX(0);
  opacity: 1;
}

.button-with-close {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 15px;
}

.connect-wallet-btn,
.disconnect-wallet-btn {
  flex: 1;
}

.close-sidebar-btn {
  width: 48px;
  height: 48px;
  min-width: 48px;
  background-color: var(--color-white);
  color: var(--color-dark);
  border: 1px solid var(--color-grey);
  border-radius: var(--radius-lg);
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: all var(--transition-normal);
}

.close-sidebar-btn:hover {
  background-color: var(--color-grey-light);
  border-color: var(--color-dark);
}

/* Стили для навигационных кнопок */
.navigation-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.nav-link-btn {
  display: flex;
  align-items: center;
  height: 48px;
  background-color: var(--color-light);
  color: var(--color-dark);
  border: 1px solid var(--color-grey-light);
  border-radius: var(--radius-lg);
  padding: 0 15px;
  font-size: var(--font-size-md);
  text-decoration: none;
  transition: all var(--transition-normal);
  cursor: pointer;
  box-sizing: border-box;
}

.nav-link-btn.active {
  background-color: var(--color-primary);
  color: var(--color-white);
  border-color: var(--color-primary);
}

.nav-link-btn:hover:not(.active) {
  background-color: var(--color-grey-light);
}

/* Стили для общих кнопок аутентификации/действий в сайдбаре */
.auth-btn {
  width: 100%;
  height: 48px;
  border-radius: var(--radius-lg);
  background-color: var(--color-light);
  border: 1px solid rgba(0, 0, 0, 0.1);
  color: var(--color-dark);
  font-size: var(--font-size-md);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0 var(--spacing-md);
  box-sizing: border-box;
  transition: all var(--transition-normal);
  margin: 0;
  text-decoration: none;
}

.auth-btn:hover {
  background-color: var(--color-grey-light);
}

/* Новые стили для секций в сайдбаре */
.sidebar-section {
  background-color: var(--color-light);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-lg);
}

h3 {
  color: var(--color-primary);
  margin-bottom: var(--spacing-md);
  font-size: var(--font-size-md);
}

.token-balance,
.user-info-item {
  display: flex;
  align-items: center;
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-sm);
}

.token-name,
.user-info-label {
  font-weight: bold;
  width: 80px;
}

.token-amount {
  flex: 1;
}

.token-symbol {
  color: var(--color-text-light);
  margin-left: var(--spacing-xs);
}

.token-no-data,
.user-info-empty {
  color: var(--color-text-light);
  font-style: italic;
  font-size: var(--font-size-sm);
}

/* Добавляем стиль для индикатора загрузки */
.token-loading {
  color: var(--color-text-light);
  font-style: italic;
  font-size: var(--font-size-sm);
}

/* Медиа-запросы для адаптивности */
@media screen and (min-width: 1200px) {
  .wallet-sidebar {
    width: 30%;
    max-width: 350px;
  }
}

@media screen and (min-width: 769px) and (max-width: 1199px) {
  .wallet-sidebar {
    width: 40%;
    max-width: 320px;
  }
}

@media screen and (max-width: 768px) {
  /* На мобильных устройствах сайдбар по умолчанию занимает весь экран (width: 100%, height: 100%) */
  /* Поэтому дополнительные правила для переопределения положения/размера не нужны */
  /* Оставляем только adjustment for padding when needed */
  .wallet-sidebar {
    padding: var(--spacing-md);
    /* Убраны bottom, top, height, max-height, чтобы вернуться к full-screen поведению */
  }

  .wallet-sidebar-content {
    padding: 0;
    gap: var(--spacing-md);
  }
}

@media screen and (max-width: 480px) {
  .close-sidebar-btn {
    width: 42px;
    height: 42px;
    min-width: 42px;
    font-size: 20px;
  }
  
  .auth-btn {
    height: 42px;
    font-size: var(--font-size-sm);
  }
  
  .nav-link-btn {
    height: 42px;
    padding: 0 12px;
    font-size: var(--font-size-sm);
  }
}

@media screen and (max-width: 360px) {
  .close-sidebar-btn {
    width: 36px;
    height: 36px;
    min-width: 36px;
    font-size: 18px;
  }
  
  .auth-btn {
    height: 36px;
  }
  
  .nav-link-btn {
    height: 36px;
    padding: 0 10px;
  }
}
</style> 