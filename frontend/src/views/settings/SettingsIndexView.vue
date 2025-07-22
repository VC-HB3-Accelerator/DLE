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
      <h3>Безопасность</h3>
      <p>Управление доступом, токенами, аутентификацией и правами.</p>
      <button class="details-btn" @click="$router.push('/settings/security')">Подробнее</button>
    </div>
    <div class="main-block">
      <h3>Сервер</h3>
      <p>Настройки серверов, хостинга и публикации приложения.</p>
      <button class="details-btn" @click="$router.push('/settings/interface')">Подробнее</button>
    </div>
    <div class="main-block copyright-block">
      <h3>© Авторские права</h3>
      <p>Информация об авторских правах и лицензировании проекта DLE.</p>
      <div class="copyright-info">
        <p><strong>Автор:</strong> Тарабанов Александр Викторович</p>
        <p><strong>Email:</strong> info@hb3-accelerator.com</p>
        <p><strong>Сайт:</strong> <a href="https://hb3-accelerator.com" target="_blank">hb3-accelerator.com</a></p>
        <p><strong>GitHub:</strong> <a href="https://github.com/HB3-ACCELERATOR" target="_blank">@HB3-ACCELERATOR</a></p>
      </div>
      <button class="details-btn" @click="showCopyrightModal = true">Подробнее</button>
    </div>
  </div>

  <!-- Модальное окно с информацией об авторских правах -->
  <div v-if="showCopyrightModal" class="modal-overlay" @click="showCopyrightModal = false">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>© Авторские права DLE</h2>
        <button class="close-btn" @click="showCopyrightModal = false">&times;</button>
      </div>
      <div class="modal-body">
        <div class="copyright-section">
          <h3>Основная информация</h3>
          <p><strong>Автор:</strong> Тарабанов Александр Викторович</p>
          <p><strong>Период:</strong> 2024-2025</p>
          <p><strong>Статус:</strong> Проприетарное программное обеспечение</p>
        </div>
        
        <div class="copyright-section">
          <h3>Контакты</h3>
          <p><strong>Email:</strong> <a href="mailto:info@hb3-accelerator.com">info@hb3-accelerator.com</a></p>
          <p><strong>Сайт:</strong> <a href="https://hb3-accelerator.com" target="_blank">hb3-accelerator.com</a></p>
          <p><strong>GitHub:</strong> <a href="https://github.com/HB3-ACCELERATOR" target="_blank">@HB3-ACCELERATOR</a></p>
        </div>

        <div class="copyright-section">
          <h3>Условия использования</h3>
          <p>✅ <strong>Разрешено:</strong> Использование в бизнесе для внутренних операций</p>
          <p>❌ <strong>Запрещено:</strong> Перепродажа, модификация, копирование без разрешения</p>
          <p>📋 <strong>Требуется:</strong> Разрешение автора для коммерческого использования</p>
        </div>

        <div class="copyright-section">
          <h3>Лицензирование</h3>
          <p>Для получения коммерческой лицензии обращайтесь к автору по указанным контактам.</p>
          <p>Все права защищены. Несанкционированное использование запрещено.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const showCopyrightModal = ref(false);
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

.copyright-block {
  border-left: 4px solid var(--color-primary);
}

.copyright-info {
  margin: 1rem 0;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
  font-size: 0.9rem;
}

.copyright-info p {
  margin: 0.5rem 0;
}

.copyright-info a {
  color: var(--color-primary);
  text-decoration: none;
}

.copyright-info a:hover {
  text-decoration: underline;
}

/* Модальное окно */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #eee;
}

.modal-header h2 {
  margin: 0;
  color: var(--color-primary);
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
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 1.5rem;
}

.copyright-section {
  margin-bottom: 2rem;
}

.copyright-section h3 {
  color: var(--color-primary);
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

.copyright-section p {
  margin: 0.5rem 0;
  line-height: 1.5;
}

.copyright-section a {
  color: var(--color-primary);
  text-decoration: none;
}

.copyright-section a:hover {
  text-decoration: underline;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style> 