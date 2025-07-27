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
  <div class="main-blocks">
    <div class="main-block">
      <h3>ИИ</h3>
      <p>Настройки интеграций, моделей, ассистента и RAG.</p>
      <button class="details-btn" @click="$router.push('/settings/ai')">Подробнее</button>
    </div>
    <div class="main-block">
      <h3>Блокчейн</h3>
      <p>Интеграция с блокчейн-сетями, RPC, токены и смарт-контракты.</p>
      <button class="details-btn" @click="$router.push('/settings/blockchain')">Подробнее</button>
    </div>
    <div class="main-block">
      <h3>Блокчейн 2</h3>
      <p>Современный DLE v2 - единый смарт-контракт с встроенной системой голосования.</p>
      <button class="details-btn details-btn-secondary" @click="$router.push('/settings/dle-v2-deploy')">Подробнее</button>
    </div>
    <div class="main-block">
      <h3>Безопасность</h3>
      <p>Управление доступом, токенами, аутентификацией и правами.</p>
      <button class="details-btn" @click="$router.push('/settings/security')">Подробнее</button>
    </div>
    <div class="main-block">
      <h3>Сервер</h3>
      <p>Настройки серверов, хостинга и публикации приложения.</p>
      <button class="details-btn" @click="$router.push('/settings/interface')">Подробнее</button>
    </div>

  </div>


</template>

<script setup>
// Компонент настроек
</script>

<style scoped>
.main-blocks {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}
.main-block {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  padding: 2rem;
  min-width: 260px;
  flex: 1 1 300px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.button-group {
  margin-top: 1.5rem;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.details-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
  margin: 0;
}

.details-btn:hover {
  background: var(--color-primary-dark);
}

.details-btn-secondary {
  background: #6c757d;
}

.details-btn-secondary:hover {
  background: #5a6268;
}

/* Для блоков без группы кнопок */
.main-block .details-btn:not(.button-group .details-btn) {
  margin-top: 1.5rem;
}


</style> 