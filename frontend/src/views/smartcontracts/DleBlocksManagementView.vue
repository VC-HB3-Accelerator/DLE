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
    <div class="dle-blocks-management">
      <!-- Блоки управления -->
      <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div v-if="dleAddress" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ dleAddress }}
        </div>
        <button class="close-btn" @click="router.push('/management')">×</button>
      </div>
      <div class="management-blocks">
        <!-- Столбец 1 -->
        <div class="blocks-column">
          <div class="management-block">
            <h3>Создать предложение</h3>
            <p>Универсальная форма для создания новых предложений</p>
            <button class="details-btn" @click="openCreateProposal">
              Подробнее
            </button>
          </div>
          
          <div class="management-block">
            <h3>Модули DLE</h3>
            <p>Установка, настройка, управление</p>
            <button class="details-btn" @click="openModules">Подробнее</button>
          </div>
        </div>

        <!-- Столбец 2 -->
        <div class="blocks-column">
          <div class="management-block">
            <h3>Предложения</h3>
            <p>Создание, подписание, выполнение</p>
            <button class="details-btn" @click="openProposals">Подробнее</button>
          </div>
          
          <div class="management-block">
            <h3>Аналитика</h3>
            <p>Графики, статистика, отчеты</p>
            <button class="details-btn" @click="openAnalytics">Подробнее</button>
          </div>
        </div>

        <!-- Столбец 3 -->
        <div class="blocks-column">
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
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';

// Props
const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

const emit = defineEmits(['auth-action-completed']);

const router = useRouter();
const route = useRoute();

// Получаем адрес DLE из query параметров
const dleAddress = computed(() => route.query.address || null);

// Функции для открытия страниц управления
const openProposals = () => {
  if (dleAddress.value) {
    router.push(`/management/proposals?address=${dleAddress.value}`);
  } else {
    router.push('/management/proposals');
  }
};


const openModules = () => {
  if (dleAddress.value) {
    router.push(`/management/modules?address=${dleAddress.value}`);
  } else {
    router.push('/management/modules');
  }
};

const openAnalytics = () => {
  if (dleAddress.value) {
    router.push(`/management/analytics?address=${dleAddress.value}`);
  } else {
    router.push('/management/analytics');
  }
};

const openHistory = () => {
  if (dleAddress.value) {
    router.push(`/management/history?address=${dleAddress.value}`);
  } else {
    router.push('/management/history');
  }
};

const openSettings = () => {
  if (dleAddress.value) {
    router.push(`/management/settings?address=${dleAddress.value}`);
  } else {
    router.push('/management/settings');
  }
};

const openCreateProposal = () => {
  if (dleAddress.value) {
    router.push(`/management/create-proposal?address=${dleAddress.value}`);
  } else {
    router.push('/management/create-proposal');
  }
};

onMounted(() => {
  // Если нет адреса DLE, перенаправляем на главную страницу management
  if (!dleAddress.value) {
    router.push('/management');
  }
});
</script>

<style scoped>
.dle-blocks-management {
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  min-height: 100vh;
}

.management-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e9ecef;
}

.header-content h1 {
  margin: 0;
  color: var(--color-primary);
  font-size: 2rem;
  font-weight: 700;
}

.dle-address {
  margin: 0.5rem 0 0 0;
  color: #666;
  font-size: 1.1rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  color: #666;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f8f9fa;
  color: #333;
}

.management-blocks {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}

.blocks-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: stretch;
}

.management-block {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 250px;
}

.management-block:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
  border-color: var(--color-primary);
}

.management-block h3 {
  margin: 0 0 1rem 0;
  color: var(--color-primary);
  font-size: 1.5rem;
  font-weight: 600;
  flex-shrink: 0;
}

.management-block p {
  margin: 0 0 1.5rem 0;
  color: #666;
  font-size: 1rem;
  line-height: 1.5;
  flex-grow: 1;
}

.details-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.2s;
  min-width: 120px;
  flex-shrink: 0;
  margin-top: auto;
}

.details-btn:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}


/* Адаптивность */
@media (max-width: 1024px) {
  .management-blocks {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .management-blocks {
    grid-template-columns: 1fr;
  }
  
  .management-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .header-content h1 {
    font-size: 1.5rem;
  }
}
</style>
