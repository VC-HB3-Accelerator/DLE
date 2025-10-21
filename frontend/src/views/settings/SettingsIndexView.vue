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
  <div class="settings-management">
    <!-- Заголовок -->
    <div class="management-header">
      <div class="header-content">
        <h1>Настройки системы</h1>
      </div>
    </div>

    <!-- Блоки настроек -->
    <div class="management-blocks">
      <!-- Столбец 1 -->
      <div class="blocks-column">
        <div class="management-block">
          <h3>ИИ</h3>
          <p>Настройки интеграций, моделей, ассистента и RAG</p>
          <button class="details-btn" @click="$router.push('/settings/ai')">
            Подробнее
          </button>
        </div>
        
        <div class="management-block">
          <h3>Блокчейн</h3>
          <p>Интеграция с блокчейн-сетями, RPC, токены и смарт-контракты</p>
          <button class="details-btn" @click="$router.push('/settings/dle-v2-deploy')">Подробнее</button>
        </div>
      </div>

      <!-- Столбец 2 -->
      <div class="blocks-column">
        <div class="management-block">
          <h3>Безопасность</h3>
          <p>Управление доступом, токенами, аутентификацией и правами</p>
          <button class="details-btn" @click="$router.push('/settings/security')">Подробнее</button>
        </div>
        
        <div class="management-block">
          <h3>Сервер</h3>
          <p>Настройки серверов, хостинга и публикации приложения</p>
          <button class="details-btn" @click="$router.push('/settings/interface')">Подробнее</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Компонент настроек
</script>

<style scoped>
.settings-management {
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

.management-blocks {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
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
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
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