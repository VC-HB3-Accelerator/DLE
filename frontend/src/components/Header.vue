<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
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
      <div class="header-actions">
        <button
          v-if="showClose"
          type="button"
          class="header-close-btn"
          :aria-label="closeLabel"
          :title="closeLabel"
          @click="closePage"
        >×</button>
        <button
          class="header-wallet-btn"
          :class="{ active: isSidebarOpen }"
          @click="toggleSidebar"
        >
        <div class="hamburger-line" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthContext } from '../composables/useAuth';
import { useFooterDle } from '../composables/useFooterDle';
import { usePageClose } from '../composables/usePageClose';
import eventBus from '../utils/eventBus';

const props = defineProps({
  isSidebarOpen: {
    type: Boolean,
    required: true
  }
});

const emit = defineEmits(['toggle-sidebar']);

const { t } = useI18n();
const { showClose, closePage } = usePageClose();
const closeLabel = computed(() => t('common.close'));

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
  padding:
    max(30px, env(safe-area-inset-top, 0px))
    max(20px, env(safe-area-inset-right, 0px))
    25px
    max(20px, env(safe-area-inset-left, 0px));
  position: sticky;
  top: 0;
  z-index: 100; /* Ensure header stays on top */
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  gap: var(--spacing-sm);
}

.header-text {
  flex-grow: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.header-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: var(--radius-lg, 8px);
  background: transparent;
  box-shadow: none;
  color: var(--theme-text, #444);
  font-size: 1.5rem;
  font-weight: 400;
  line-height: 1;
  cursor: pointer;
  transition: color var(--transition-fast, 0.15s ease), background var(--transition-fast, 0.15s ease);
  box-sizing: border-box;
}

.header-close-btn:hover {
  color: var(--theme-text, #222);
  background: var(--color-light, #f3f4f6);
}

.header-close-btn:focus-visible {
  outline: 2px solid var(--color-primary, #2563eb);
  outline-offset: 2px;
}

.footer-dle-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
  max-width: 100%;
}

.footer-dle-logo {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  object-fit: contain;
  border: 2px solid var(--color-border);
  background: var(--color-white);
  flex-shrink: 0;
}

.footer-dle-logo-placeholder {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: var(--theme-surface);
  color: var(--color-white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: var(--font-size-xs);
  border: 2px solid var(--color-border);
  flex-shrink: 0;
}

.dle-name {
  font-size: 0.9rem;
  color: var(--color-primary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
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
  justify-content: center;
  background-color: var(--color-white);
  color: var(--color-primary);
  border: none;
  padding: var(--spacing-xs);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: background-color var(--transition-normal);
  gap: var(--spacing-xs);
  box-shadow: none;
  min-width: 44px;
  min-height: 44px;
  box-sizing: border-box;
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
  flex-shrink: 0;
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
  .header {
    padding:
      max(14px, env(safe-area-inset-top, 0px))
      max(12px, env(safe-area-inset-right, 0px))
      12px
      max(12px, env(safe-area-inset-left, 0px));
  }

  .title {
    font-size: 1.2rem;
  }
  .subtitle {
    font-size: 0.8rem;
  }
  .header-close-btn,
  .header-wallet-btn {
    min-width: 48px;
    min-height: 48px;
    padding: 12px;
  }
  .header-close-btn {
    font-size: 1.6rem;
  }
  .nav-btn-text {
    font-size: 0.8rem;
  }
}

@media (max-width: 480px) {
  .header {
    padding:
      max(12px, env(safe-area-inset-top, 0px))
      max(14px, env(safe-area-inset-right, 0px))
      10px
      max(12px, env(safe-area-inset-left, 0px));
  }

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
  .header-close-btn,
  .header-wallet-btn {
    min-width: 48px;
    min-height: 48px;
    margin-right: 2px;
  }
  .header-close-btn {
    font-size: 1.6rem;
    padding: 0;
    margin-right: 0;
  }
}

</style> 