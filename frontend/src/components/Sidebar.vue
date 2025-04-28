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
        
          <!-- Блок информации о пользователе (отображается, если не активна ни одна форма) -->
          <div v-if="!emailAuth.showForm && !emailAuth.showVerification && !telegramAuth.showVerification" class="user-info">
            <h3>Идентификаторы:</h3>
            <div class="user-info-item">
              <span class="user-info-label">Кошелек:</span>
              <span v-if="hasIdentityType('wallet')" class="user-info-value">
                {{ truncateAddress(getIdentityValue('wallet')) }}
              </span>
              <button v-else class="connect-btn" @click="handleWalletAuth">
                Подключить кошелек
              </button>
            </div>
          </div>
        </div>

        <!-- Блок баланса токенов -->
        <div v-if="isAuthenticated && hasIdentityType('wallet')" class="token-balances">
          <h3>Баланс токенов:</h3>
          <div class="token-balance">
            <span class="token-name">ETH:</span>
            <span class="token-amount">{{ Number(tokenBalances.eth).toLocaleString() }}</span>
            <span class="token-symbol">{{ TOKEN_CONTRACTS.eth.symbol }}</span>
          </div>
          <div class="token-balance">
            <span class="token-name">BSC:</span>
            <span class="token-amount">{{ Number(tokenBalances.bsc).toLocaleString() }}</span>
            <span class="token-symbol">{{ TOKEN_CONTRACTS.bsc.symbol }}</span>
          </div>
          <div class="token-balance">
            <span class="token-name">ARB:</span>
            <span class="token-amount">{{
              Number(tokenBalances.arbitrum).toLocaleString()
            }}</span>
            <span class="token-symbol">{{ TOKEN_CONTRACTS.arbitrum.symbol }}</span>
          </div>
          <div class="token-balance">
            <span class="token-name">POL:</span>
            <span class="token-amount">{{ Number(tokenBalances.polygon).toLocaleString() }}</span>
            <span class="token-symbol">{{ TOKEN_CONTRACTS.polygon.symbol }}</span>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import { TOKEN_CONTRACTS } from '../services/tokens';

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

@media screen and (max-width: 480px) {
  .close-sidebar-btn {
    width: 42px;
    height: 42px;
    min-width: 42px;
    font-size: 20px;
  }
}

@media screen and (max-width: 360px) {
  .close-sidebar-btn {
    width: 36px;
    height: 36px;
    min-width: 36px;
    font-size: 18px;
  }
}
</style> 