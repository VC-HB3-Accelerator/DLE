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
        
        <!-- Блок информации о пользователе или формы подключения -->
        <template v-if="isAuthenticated">
          <div v-if="emailAuth.showForm || emailAuth.showVerification" class="auth-modal-panel">
            <EmailConnect @success="$emit('cancel-email-auth')">
              <template #actions>
                <button class="close-btn" @click="$emit('cancel-email-auth')">Отмена</button>
              </template>
            </EmailConnect>
          </div>
          <div v-else-if="telegramAuth.showVerification" class="auth-modal-panel">
            <TelegramConnect
              :bot-link="telegramAuth.botLink"
              :verification-code="telegramAuth.verificationCode"
              :error="telegramAuth.error"
              @cancel="$emit('cancel-telegram-auth')"
            />
          </div>
          <div v-else class="user-info-section sidebar-section">
            <h3>Ваши идентификаторы:</h3>
            <div class="user-info-item">
              <span class="user-info-label">Кошелек:</span>
              <span v-if="hasIdentityType('wallet')" class="user-info-value">
                {{ truncateAddress(getIdentityValue('wallet')) }}
                <button class="delete-identity-btn" @click="handleDeleteIdentity('wallet', getIdentityValue('wallet'))" title="Удалить">✕</button>
              </span>
              <span v-else class="user-info-value">
                Не подключен
                <button class="connect-btn" @click="handleWalletAuth">Подключить</button>
              </span>
            </div>
            <div class="user-info-item">
              <span class="user-info-label">Telegram:</span>
              <span v-if="hasIdentityType('telegram')" class="user-info-value">
                {{ getIdentityValue('telegram') }}
                <button class="delete-identity-btn" @click="handleDeleteIdentity('telegram', getIdentityValue('telegram'))" title="Удалить">✕</button>
              </span>
              <span v-else class="user-info-value">
                Не подключен
                <button class="connect-btn" @click="$emit('telegram-auth')">Подключить</button>
              </span>
            </div>
            <div class="user-info-item">
              <span class="user-info-label">Email:</span>
              <span v-if="hasIdentityType('email')" class="user-info-value">
                {{ getIdentityValue('email') }}
                <button class="delete-identity-btn" @click="handleDeleteIdentity('email', getIdentityValue('email'))" title="Удалить">✕</button>
              </span>
              <span v-else class="user-info-value">
                Не подключен
                <button class="connect-btn" @click="$emit('email-auth')">Подключить</button>
              </span>
            </div>
          </div>
        </template>

        <!-- Блок баланса токенов -->
        <div v-if="isAuthenticated" class="token-balances-section sidebar-section">
          <h3>Баланс токенов:</h3>
          <div v-if="isLoadingTokens" class="token-loading">
            Загрузка балансов...
          </div>
          <div v-else-if="!tokenBalances || tokenBalances.length === 0" class="token-no-data">
            Баланс не доступен
          </div>
          <div v-else>
            <div class="token-balance-header">
            </div>
            <div v-for="(token, index) in tokenBalances.data || []" :key="token.tokenAddress ? token.tokenAddress : 'token-' + index" class="token-balance-row">
              <span class="token-name">{{ token.tokenName }}</span>
              <span class="token-network">{{ token.network }}</span>
              <span class="token-amount">{{ isNaN(Number(token.balance)) ? '—' : Number(token.balance).toLocaleString() }}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  </transition>
</template>

<script setup>
import { defineProps, defineEmits, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import eventBus from '../utils/eventBus';
import EmailConnect from './identity/EmailConnect.vue';
import TelegramConnect from './identity/TelegramConnect.vue';
import { useAuthContext } from '@/composables/useAuth';

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

const emit = defineEmits(['update:modelValue', 'wallet-auth', 'disconnect-wallet', 'telegram-auth', 'email-auth', 'cancel-email-auth']);

const { deleteIdentity } = useAuthContext();

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

const handleDeleteIdentity = async (provider, providerId) => {
  if (confirm('Удалить идентификатор?')) {
    await deleteIdentity(provider, providerId);
  }
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

.token-balance-header {
  display: flex;
  font-weight: bold;
  color: var(--color-primary, #4caf50);
  gap: 10px;
  margin-bottom: 6px;
}
.token-balance-row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 4px;
}
.token-name {
  min-width: 80px;
  font-weight: 500;
}
.token-network {
  min-width: 70px;
  color: var(--color-dark, #333);
}
.token-amount {
  min-width: 80px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.connect-btn {
  margin-left: 10px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.2rem 0.8rem;
  cursor: pointer;
  font-size: 0.95rem;
  transition: background 0.2s;
}
.connect-btn:hover {
  background: var(--color-primary-dark);
}

.auth-modal-panel {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.15);
  padding: 2rem 2.5rem;
  max-width: 400px;
  width: 100%;
  margin: 2rem auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.delete-identity-btn {
  margin-left: 8px;
  background: none;
  border: none;
  color: #d32f2f;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0 4px;
  border-radius: 3px;
  transition: background 0.15s;
}
.delete-identity-btn:hover {
  background: #ffeaea;
}
</style> 