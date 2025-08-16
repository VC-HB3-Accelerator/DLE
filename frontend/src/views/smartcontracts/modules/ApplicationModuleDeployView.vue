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
    <div class="application-module-deploy">
      <!-- Заголовок -->
      <div class="page-header">
        <div class="header-content">
          <h1>Деплой ApplicationModule</h1>
          <p>Управление вызовом функций приложения через предложения и голосование</p>
          <p v-if="dleAddress" class="dle-address">
            <strong>DLE:</strong> {{ dleAddress }}
          </p>
        </div>
        <button class="close-btn" @click="router.push('/management/modules')">×</button>
      </div>

      <!-- Информация о модуле -->
      <div class="module-info">
        <div class="info-card">
          <h3>🖥️ ApplicationModule</h3>
          <div class="info-grid">
            <div class="info-item">
              <strong>Назначение:</strong> Управление функциями приложения через DLE
            </div>
            <div class="info-item">
              <strong>Функции:</strong> Создание предложений для вызова API, голосование за операции
            </div>
            <div class="info-item">
              <strong>Безопасность:</strong> Все операции приложения через кворум токен-холдеров
            </div>
            <div class="info-item">
              <strong>Примеры:</strong> Удаление пользователей, изменение настроек, обновление данных
            </div>
          </div>
        </div>
      </div>

      <!-- Детальное описание -->
      <div class="module-details">
        <div class="details-card">
          <h3>📋 Как работает ApplicationModule</h3>
          <div class="details-content">
            <div class="detail-step">
              <div class="step-number">1</div>
              <div class="step-content">
                <h4>Создание предложения</h4>
                <p>Токен-холдер создает предложение для выполнения операции в приложении (например, удаление пользователя, изменение настроек)</p>
              </div>
            </div>
            
            <div class="detail-step">
              <div class="step-number">2</div>
              <div class="step-content">
                <h4>Голосование</h4>
                <p>Все токен-холдеры голосуют за или против предложения в течение установленного времени</p>
              </div>
            </div>
            
            <div class="detail-step">
              <div class="step-number">3</div>
              <div class="step-content">
                <h4>Исполнение</h4>
                <p>При достижении кворума предложение исполняется - вызывается соответствующая функция приложения</p>
              </div>
            </div>
            
            <div class="detail-step">
              <div class="step-number">4</div>
              <div class="step-content">
                <h4>Аудит</h4>
                <p>Все операции логируются в блокчейне для полной прозрачности и подотчетности</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Форма деплоя будет добавлена позже -->
      <div class="deploy-form-placeholder">
        <div class="placeholder-content">
          <h3>🚧 Форма деплоя в разработке</h3>
          <p>Здесь будет форма для деплоя ApplicationModule</p>
        </div>
      </div>

    </div>
  </BaseLayout>
</template>

<script setup>
import { defineProps, defineEmits, ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import BaseLayout from '../../../components/BaseLayout.vue';

// Определяем props
const props = defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false }
});

// Определяем emits
const emit = defineEmits(['auth-action-completed']);

const router = useRouter();
const route = useRoute();

// Состояние
const isLoading = ref(false);
const dleAddress = ref(route.query.address || null);

// Инициализация
onMounted(() => {
  console.log('[ApplicationModuleDeployView] Страница загружена');
});
</script>

<style scoped>
.application-module-deploy {
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
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.page-header h1 {
  color: var(--color-primary);
  font-size: 2rem;
  margin: 0;
}

.page-header p {
  margin: 10px 0 0 0;
  color: #666;
}

.dle-address {
  margin-top: 10px !important;
  font-family: monospace;
  background: #f8f9fa;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid #dee2e6;
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

/* Информация о модуле */
.module-info {
  margin-bottom: 30px;
}

.info-card {
  background: #f8f9fa;
  border-radius: var(--radius-md);
  padding: 20px;
  border: 1px solid #e9ecef;
}

.info-card h3 {
  margin: 0 0 15px 0;
  color: var(--color-primary);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
}

.info-item {
  padding: 10px;
  background: white;
  border-radius: var(--radius-sm);
  border: 1px solid #dee2e6;
}

.info-item strong {
  color: var(--color-primary);
}

/* Детальное описание */
.module-details {
  margin-bottom: 30px;
}

.details-card {
  background: #f8f9fa;
  border-radius: var(--radius-md);
  padding: 20px;
  border: 1px solid #e9ecef;
}

.details-card h3 {
  margin: 0 0 20px 0;
  color: var(--color-primary);
}

.details-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-step {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  padding: 15px;
  background: white;
  border-radius: var(--radius-sm);
  border: 1px solid #dee2e6;
}

.step-number {
  background: var(--color-primary);
  color: white;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
  flex-shrink: 0;
}

.step-content h4 {
  margin: 0 0 8px 0;
  color: var(--color-primary);
  font-size: 16px;
}

.step-content p {
  margin: 0;
  color: #666;
  line-height: 1.5;
}

/* Плейсхолдер для формы */
.deploy-form-placeholder {
  background: #f8f9fa;
  border-radius: var(--radius-md);
  padding: 40px;
  text-align: center;
  border: 2px dashed #dee2e6;
}

.placeholder-content h3 {
  color: var(--color-primary);
  margin-bottom: 10px;
}

.placeholder-content p {
  color: #666;
  margin: 0;
}

/* Адаптивность */
@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }
  
  .detail-step {
    flex-direction: column;
    text-align: center;
  }
  
  .step-number {
    align-self: center;
  }
}
</style>
