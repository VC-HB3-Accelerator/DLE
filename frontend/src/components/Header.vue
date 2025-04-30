<template>
  <div class="header">
    <div class="header-content">
      <div class="header-text">
        <h1 class="title">✌️HB3 - Accelerator DLE</h1>
        <p class="subtitle">Венчурный фонд и поставщик программного обеспечения</p>
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
import { defineProps, defineEmits, onMounted, onBeforeUnmount, watch } from 'vue';
import { useAuth } from '../composables/useAuth';
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
const auth = useAuth();
const { isAuthenticated } = auth;

// Мониторинг изменений статуса аутентификации
let unwatch = null;
onMounted(() => {
  // Следим за изменениями авторизации и сообщаем о них через eventBus
  unwatch = watch(isAuthenticated, (newValue, oldValue) => {
    if (newValue !== oldValue) {
      console.log('[Header] Состояние аутентификации изменилось:', newValue);
      // Оповещаем остальные компоненты через шину событий
      eventBus.emit('auth-state-changed', { 
        isAuthenticated: newValue, 
        fromHeader: true
      });
    }
  });
});

// Очищаем наблюдатель при удалении компонента
onBeforeUnmount(() => {
  if (unwatch) {
    unwatch();
  }
});
</script>

<style scoped>
.header {
  background-color: var(--color-white);
  padding: 15px 20px;
  position: sticky;
  top: 0;
  z-index: 100; /* Ensure header stays on top */
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px; /* Optional: limit max width */
  margin: 0 auto; /* Optional: center content */
}

.header-text {
  flex-grow: 1;
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
  padding: 10px 15px;
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

.header-wallet-btn.active .hamburger-line {
  background-color: transparent; /* Hide middle line */
}

.header-wallet-btn.active .hamburger-line::before {
  top: 0;
  transform: rotate(45deg);
}

.header-wallet-btn.active .hamburger-line::after {
  top: 0;
  transform: rotate(-45deg);
}

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
    padding: 8px 12px;
  }
  .nav-btn-text {
    font-size: 0.8rem;
  }
}

@media (max-width: 480px) {
  .header-text {
    display: none; /* Hide text on very small screens */
  }
  .header-content {
    justify-content: flex-end; /* Align button to the right */
  }
}

</style> 