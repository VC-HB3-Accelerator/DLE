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
  <div class="header">
    <div class="header-content">
      <div class="header-text">
        <div v-if="dleDisplayName" class="footer-dle-info">
          <img 
            v-if="footerDle?.logoURI" 
            :src="footerDle.logoURI" 
            :alt="dleDisplayName.name" 
            class="footer-dle-logo"
            @error="handleLogoError"
          />
          <div v-else class="footer-dle-logo-placeholder">DLE</div>
          <span class="dle-name">{{ dleDisplayName.name }} ({{ dleDisplayName.symbol }})</span>
        </div>
      </div>
      <button
        class="header-wallet-btn"
        :class="{ active: isSidebarOpen }" 
        @click="toggleSidebar"
      >
        <div class="hamburger-line" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { useAuthContext } from '../composables/useAuth';
import { useFooterDle } from '../composables/useFooterDle';
import eventBus from '../utils/eventBus';

const props = defineProps({
  isSidebarOpen: {
    type: Boolean,
    required: true
  }
});

const emit = defineEmits(['toggle-sidebar']);

const toggleSidebar = () => {
  emit('toggle-sidebar');
};

// Обработка аутентификации
const auth = useAuthContext();
const { isAuthenticated } = auth;

// Используем composable для выбранного DLE
const { footerDle } = useFooterDle();

// Вычисляемое свойство для отображения названия
const dleDisplayName = computed(() => {
  if (!footerDle.value || !footerDle.value.name || !footerDle.value.symbol) return null;
  // Проверяем, что это не fallback данные (не начинается с "DLE " и адресом)
  if (footerDle.value.name.startsWith('DLE ') && footerDle.value.name.includes('...')) {
    return null; // Не показываем fallback данные
  }
  return {
    name: footerDle.value.name,
    symbol: footerDle.value.symbol
  };
});

// Обработка ошибки загрузки логотипа
const handleLogoError = (event) => {
  console.log('[Header] Ошибка загрузки логотипа:', event.target.src);
  event.target.style.display = 'none';
  // Показываем placeholder, если его нет
  const infoContainer = event.target.closest('.footer-dle-info');
  if (infoContainer) {
    let placeholder = infoContainer.querySelector('.footer-dle-logo-placeholder');
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.className = 'footer-dle-logo-placeholder';
      placeholder.textContent = 'DLE';
      infoContainer.insertBefore(placeholder, event.target);
    }
    placeholder.style.display = 'flex';
  }
};

// Мониторинг изменений статуса аутентификации
let unwatch = null;
let refreshInterval = null;

onMounted(() => {
  // Следим за изменениями авторизации и сообщаем о них через eventBus
  unwatch = watch(isAuthenticated, (newValue, oldValue) => {
    if (newValue !== oldValue) {
      // console.log('[Header] Состояние аутентификации изменилось:', newValue);
      // Оповещаем остальные компоненты через шину событий
      eventBus.emit('auth-state-changed', { 
        isAuthenticated: newValue, 
        fromHeader: true
      });
    }
  });
  
  // Обновляем данные DLE из блокчейна периодически (каждые 5 минут)
  const { refreshFooterDle } = useFooterDle();
  refreshInterval = setInterval(() => {
    refreshFooterDle();
  }, 5 * 60 * 1000); // 5 минут
  
  // НЕ очищаем footerDle при отключении кошелька, так как это глобальная настройка,
  // не связанная с пользовательским кошельком
});

// Очищаем наблюдатель при удалении компонента
onBeforeUnmount(() => {
  if (unwatch) {
    unwatch();
  }
  // Очищаем интервал обновления
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<style scoped>
.header {
  background-color: var(--color-white);
  padding: 30px 20px 25px 20px; /* Увеличиваем высоту шапки еще на 10px */
  position: sticky;
  top: 0;
  z-index: 100; /* Ensure header stays on top */
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  /* Убираем max-width, margin, padding */
}

.header-text {
  flex-grow: 1;
  display: flex;
  align-items: center;
}

.footer-dle-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.footer-dle-logo {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  object-fit: contain;
  border: 2px solid #e9ecef;
  background: white;
}

.footer-dle-logo-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: linear-gradient(135deg, var(--color-primary), #0056b3);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 12px;
  border: 2px solid #e9ecef;
  flex-shrink: 0;
}

.dle-name {
  font-size: 0.9rem;
  color: var(--color-primary);
  font-weight: 500;
  white-space: nowrap;
}

.title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: bold;
}

.subtitle {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-grey-dark);
}

.header-wallet-btn {
  display: flex;
  align-items: center;
  background-color: var(--color-white);
  color: var(--color-primary);
  border: none;
  padding: 8px;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-normal);
  gap: 8px;
  box-shadow: none;
}

.header-wallet-btn:hover {
  background-color: var(--color-light);
}

.header-wallet-btn.active {
  background-color: var(--color-light);
}

.hamburger-line {
  width: 20px;
  height: 3px;
  background-color: var(--color-primary);
  position: relative;
  transition: all var(--transition-normal);
}

.hamburger-line::before,
.hamburger-line::after {
  content: '';
  position: absolute;
  width: 100%;
  height: 3px;
  background-color: var(--color-primary);
  left: 0;
  transition: all var(--transition-normal);
}

.hamburger-line::before {
  top: -6px;
}

.hamburger-line::after {
  top: 6px;
}

/* Удаляем стили для трансформации бургера в крестик */
/*
.header-wallet-btn.active .hamburger-line {
  background-color: transparent; 
}

.header-wallet-btn.active .hamburger-line::before {
  top: 0;
  transform: rotate(45deg);
}

.header-wallet-btn.active .hamburger-line::after {
  top: 0;
  transform: rotate(-45deg);
}
*/

.nav-btn-text {
  font-size: 0.9rem;
  font-weight: 500;
}

/* Add some responsive styles if needed */
@media (max-width: 768px) {
  .title {
    font-size: 1.2rem;
  }
  .subtitle {
    font-size: 0.8rem;
  }
  .header-wallet-btn {
    padding: 6px;
  }
  .nav-btn-text {
    font-size: 0.8rem;
  }
}

@media (max-width: 480px) {
  .title {
    font-size: 1em;
    text-align: left;
    word-break: break-word;
  }
  .subtitle {
    font-size: 0.7em;
    text-align: left;
    word-break: break-word;
  }
  .header-content {
    flex-direction: row;
    align-items: center;
  }
  .header-text {
    flex: 1;
    min-width: 0;
    text-align: left;
    width: auto;
  }
}

</style> 