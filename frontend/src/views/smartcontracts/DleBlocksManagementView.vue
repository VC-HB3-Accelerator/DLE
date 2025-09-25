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
      <!-- Заголовок -->
      <div class="management-header">
        <div class="header-content">
          <h1>Управление DLE</h1>
          <p v-if="dleAddress" class="dle-address">
            <strong>DLE:</strong> {{ dleAddress }}
          </p>
        </div>
        <button class="close-btn" @click="router.push('/management')">×</button>
      </div>

      <!-- Блоки управления -->
      <div class="management-blocks">
        <!-- Первый ряд -->
        <div class="blocks-row">
          <div class="management-block create-proposal-block">
            <h3>Создать предложение</h3>
            <p>Универсальная форма для создания новых предложений</p>
            <button class="details-btn create-btn" @click="openCreateProposal">
              Подробнее
            </button>
          </div>
          
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
        </div>

        <!-- Второй ряд -->
        <div class="blocks-row">
          <div class="management-block">
            <h3>Кворум</h3>
            <p>Настройки голосования</p>
            <button class="details-btn" @click="openQuorum">Подробнее</button>
          </div>
          
          <div class="management-block">
            <h3>Модули DLE</h3>
            <p>Установка, настройка, управление</p>
            <button class="details-btn" @click="openModules">Подробнее</button>
          </div>
          
          <div class="management-block">
            <h3>Аналитика</h3>
            <p>Графики, статистика, отчеты</p>
            <button class="details-btn" @click="openAnalytics">Подробнее</button>
          </div>
        </div>

        <!-- Третий ряд -->
        <div class="blocks-row">
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

const openTokens = () => {
  if (dleAddress.value) {
    router.push(`/management/tokens?address=${dleAddress.value}`);
  } else {
    router.push('/management/tokens');
  }
};

const openQuorum = () => {
  if (dleAddress.value) {
    router.push(`/management/quorum?address=${dleAddress.value}`);
  } else {
    router.push('/management/quorum');
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
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.blocks-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.management-block {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
  text-align: center;
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
}

.management-block p {
  margin: 0 0 1.5rem 0;
  color: #666;
  font-size: 1rem;
  line-height: 1.5;
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
}

.details-btn:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

/* Стили для блока создания предложения */
.create-proposal-block {
  background: linear-gradient(135deg, #e8f5e8 0%, #f0f8f0 100%);
  border: 2px solid #28a745;
}

.create-proposal-block:hover {
  border-color: #20c997;
  box-shadow: 0 4px 20px rgba(40, 167, 69, 0.15);
}

.create-proposal-block h3 {
  color: #28a745;
}

.create-btn {
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
  font-weight: 700;
}

.create-btn:hover {
  background: linear-gradient(135deg, #218838, #1ea085);
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
}

/* Адаптивность */
@media (max-width: 768px) {
  .blocks-row {
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
