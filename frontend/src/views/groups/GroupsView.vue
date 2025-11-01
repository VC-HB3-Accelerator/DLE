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
    <div class="groups-management">
      <div class="management-header">
        <div class="header-content">
          <h1>Группы</h1>
          <p class="groups-description">
            Создание и управление группами
          </p>
        </div>
      </div>

      <!-- Блоки управления группами -->
      <div class="management-blocks">
        <!-- Столбец 1 -->
        <div class="blocks-column">
          <div v-if="canEditData" class="management-block">
            <h3>Создать группу</h3>
            <p>Создание новой группы для организации работы и совместной деятельности</p>
            <button class="details-btn" @click="goToCreateGroup">
              Подробнее
            </button>
          </div>
          
          <div v-if="isAuthenticated" class="management-block">
            <h3>Приватные группы</h3>
            <p>Просмотр и управление приватными группами</p>
            <button class="details-btn" @click="goToPrivateGroups">
              Подробнее
            </button>
          </div>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, defineProps, defineEmits, computed } from 'vue';
import { useRouter } from 'vue-router';
import { usePermissions } from '../../composables/usePermissions';
import { useAuthContext } from '../../composables/useAuth';
import BaseLayout from '../../components/BaseLayout.vue';

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

// Используем composable для проверки прав доступа
const { canEditData } = usePermissions();

// Используем composable для проверки авторизации
const { isAuthenticated } = useAuthContext();

// Переход к созданию группы
const goToCreateGroup = () => {
  // TODO: Реализовать переход к странице создания группы
  router.push({ name: 'groups-create' });
};

// Переход к приватным группам
const goToPrivateGroups = () => {
  // TODO: Реализовать переход к странице приватных групп
  router.push({ name: 'groups-private' });
};
</script>

<style scoped>
.groups-management {
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

.groups-description {
  margin: 0.5rem 0 0 0;
  color: #666;
  font-size: 1.1rem;
}

.management-blocks {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  margin-bottom: 2rem;
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
  
  .groups-description {
    font-size: 1rem;
  }
  
  .groups-management {
    padding: 15px;
  }
}
</style>
