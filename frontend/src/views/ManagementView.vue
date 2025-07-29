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
    <div class="management-container">
      <!-- Заголовок -->
      <div class="management-header">
        <h1>Управление DLE</h1>
        <button class="close-btn" @click="router.push('/')">×</button>
      </div>

      <!-- Блоки управления -->
      <div class="management-blocks">
        <!-- Первый ряд -->
        <div class="blocks-row">
          <div class="management-block">
            <h3>Предложения</h3>
            <p>Создание, подписание, выполнение</p>
            <button class="details-btn" @click="openProposals">Подробнее</button>
          </div>
          
          <div class="management-block">
            <h3>Токены DLE</h3>
            <p>Балансы, трансферы, распределение</p>
            <button class="details-btn" @click="openTokens">Подробнее</button>
          </div>
          
          <div class="management-block">
            <h3>Кворум</h3>
            <p>Настройки голосования</p>
            <button class="details-btn" @click="openQuorum">Подробнее</button>
          </div>
        </div>

        <!-- Второй ряд -->
        <div class="blocks-row">
          <div class="management-block">
            <h3>Модули DLE</h3>
            <p>Установка, настройка, управление</p>
            <button class="details-btn" @click="openModules">Подробнее</button>
          </div>
          
          <div class="management-block">
            <h3>DLE</h3>
            <p>Интеграция с другими DLE, участие в кворумах</p>
            <button class="details-btn" @click="openDle">Подробнее</button>
          </div>
          
          <div class="management-block">
            <h3>Казна</h3>
            <p>Управление средствами</p>
            <button class="details-btn" @click="openTreasury">Подробнее</button>
          </div>
        </div>

        <!-- Третий ряд -->
        <div class="blocks-row">
          <div class="management-block">
            <h3>Аналитика</h3>
            <p>Графики, статистика, отчеты</p>
            <button class="details-btn" @click="openAnalytics">Подробнее</button>
          </div>
          
          <div class="management-block">
            <h3>История</h3>
            <p>Лог операций, события, транзакции</p>
            <button class="details-btn" @click="openHistory">Подробнее</button>
          </div>
          
          <div class="management-block">
            <h3>Настройки</h3>
            <p>Параметры DLE, конфигурация</p>
            <button class="details-btn" @click="openSettings">Подробнее</button>
          </div>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import { useRouter } from 'vue-router';
import BaseLayout from '../components/BaseLayout.vue';

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

// Функции для открытия страниц управления
const openProposals = () => {
  router.push('/management/proposals');
};

const openTokens = () => {
  router.push('/management/tokens');
};

const openQuorum = () => {
  router.push('/management/quorum');
};

const openModules = () => {
  router.push('/management/modules');
};

const openDle = () => {
  router.push('/management/dle-management');
};

const openTreasury = () => {
  router.push('/management/treasury');
};

const openAnalytics = () => {
  router.push('/management/analytics');
};

const openHistory = () => {
  router.push('/management/history');
};

const openSettings = () => {
  router.push('/management/settings');
};
</script>

<style scoped>
.management-container {
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
  margin-bottom: 20px;
}

.management-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.management-header h1 {
  color: var(--color-primary);
  font-size: 2.5rem;
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
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

/* Блоки управления */
.management-blocks {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.blocks-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.management-block {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  padding: 2rem;
  min-width: 260px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.management-block:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.management-block h3 {
  color: var(--color-primary);
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.management-block p {
  color: var(--color-grey-dark);
  margin: 0 0 1.5rem 0;
  line-height: 1.5;
  flex-grow: 1;
}

.details-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: background 0.2s;
  margin: 0;
  min-width: 120px;
}

.details-btn:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

/* Адаптивность */
@media (max-width: 768px) {
  .blocks-row {
    grid-template-columns: 1fr;
  }
  
  .management-block {
    padding: 1.5rem;
  }
  
  .management-block h3 {
    font-size: 1.3rem;
  }
}
</style> 