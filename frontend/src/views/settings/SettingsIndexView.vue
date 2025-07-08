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
      <h3>Безопасность</h3>
      <p>Управление доступом, токенами, аутентификацией и правами.</p>
      <button class="details-btn" @click="$router.push('/settings/security')">Подробнее</button>
    </div>
    <div class="main-block">
      <h3>Интерфейс</h3>
      <p>Настройки внешнего вида, локализации и пользовательского опыта.</p>
      <button class="details-btn" @click="$router.push('/settings/interface')">Подробнее</button>
    </div>
    <div class="main-block">
      <h3>WEB SSH</h3>
      <p>Автоматическая публикация приложения в интернете через SSH-туннель.</p>
      <button class="details-btn" @click="$router.push('/settings/webssh')">Подробнее</button>
    </div>
  </div>
</template>

<script setup>
// пусто
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
.details-btn {
  margin-top: 1.5rem;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}
.details-btn:hover {
  background: var(--color-primary-dark);
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style> 