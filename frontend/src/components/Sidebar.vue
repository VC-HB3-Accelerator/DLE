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
            <i class="nav-icon">💬</i>
            <span>Чат</span>
          </router-link>
          <router-link to="/crm" class="nav-link-btn" active-class="active">
            <i class="nav-icon">👥</i>
            <span>CRM</span>
          </router-link>
          <router-link to="/settings" class="nav-link-btn" active-class="active">
            <i class="nav-icon">⚙️</i>
            <span>Настройки</span>
          </router-link>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { defineProps, defineEmits, ref, onMounted, onBeforeUnmount } from 'vue';
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
  identities: Array
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
</script>

<style scoped>
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
  background-color: var(--color-light);
  color: var(--color-dark);
  border: 1px solid var(--color-grey-light);
  border-radius: var(--radius-lg);
  padding: 12px 15px;
  font-size: var(--font-size-md);
  text-decoration: none;
  transition: all var(--transition-normal);
  cursor: pointer;
}

.nav-link-btn.active {
  background-color: var(--color-primary);
  color: var(--color-white);
  border-color: var(--color-primary);
}

.nav-link-btn:hover:not(.active) {
  background-color: var(--color-grey-light);
}

.nav-icon {
  margin-right: 10px;
  font-size: 1.2em;
}

@media screen and (max-width: 480px) {
  .close-sidebar-btn {
    width: 42px;
    height: 42px;
    min-width: 42px;
    font-size: 20px;
  }
  
  .nav-link-btn {
    padding: 10px 12px;
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
  
  .nav-link-btn {
    padding: 8px 10px;
  }
}
</style> 