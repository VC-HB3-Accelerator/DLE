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
      <div class="header-start">
        <button
          v-if="showPersonalToggle && !isPersonalSidebarOpen"
          type="button"
          class="header-personal-btn"
          :aria-label="personalToggleLabel"
          :title="personalToggleLabel"
          aria-expanded="false"
          @click="togglePersonalSidebar"
        >
          <UiGlyph name="sidebar-left" :size="20" />
        </button>
      </div>

      <div class="header-center">
        <div v-if="dleDisplayName" class="footer-dle-info">
          <img
            v-if="headerLogoUrl"
            :src="headerLogoUrl"
            :alt="dleDisplayName.name"
            class="footer-dle-logo"
            @error="handleLogoError"
          />
          <div class="footer-dle-text">
            <span class="dle-name">{{ dleDisplayName.name }} ({{ dleDisplayName.symbol }})</span>
            <span v-if="headerDescription" class="dle-header-desc">{{ headerDescription }}</span>
          </div>
        </div>
      </div>

      <div class="header-actions">
        <button
          v-if="showClose"
          type="button"
          class="header-close-btn"
          :aria-label="backLabel"
          :title="backLabel"
          @click="closePage"
        >
          <UiGlyph name="arrow-left" :size="20" />
        </button>
        <button
          v-if="!isSidebarOpen"
          type="button"
          class="header-wallet-btn"
          :aria-label="osToggleLabel"
          :title="osToggleLabel"
          aria-expanded="false"
          @click="toggleSidebar"
        >
          <UiGlyph name="sidebar-right" :size="20" />
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
import { useSiteBrand } from '../composables/useSiteBrand';
import { usePageClose } from '../composables/usePageClose';
import eventBus from '../utils/eventBus';
import UiGlyph from './UiGlyph.vue';

const props = defineProps({
  isSidebarOpen: {
    type: Boolean,
    required: true
  },
  isPersonalSidebarOpen: {
    type: Boolean,
    default: false
  },
  showPersonalToggle: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['toggle-sidebar', 'toggle-personal-sidebar']);

const { t } = useI18n();
const { showClose, closePage } = usePageClose();
const backLabel = computed(() => t('common.back'));
const personalToggleLabel = computed(() => t('personalSidebar.toggle'));
const osToggleLabel = computed(() => t('personalSidebar.osToggle'));

const toggleSidebar = () => {
  emit('toggle-sidebar');
};

const togglePersonalSidebar = () => {
  emit('toggle-personal-sidebar');
};

const auth = useAuthContext();
const { isAuthenticated } = auth;

const { footerDle } = useFooterDle();
const {
  headerDescription,
  headerLogoUrl,
  loadSiteBrand,
} = useSiteBrand();

const dleDisplayName = computed(() => {
  if (!footerDle.value || !footerDle.value.name || !footerDle.value.symbol) return null;
  if (footerDle.value.name.startsWith('DLE ') && footerDle.value.name.includes('...')) {
    return null;
  }
  return {
    name: footerDle.value.name,
    symbol: footerDle.value.symbol
  };
});

const handleLogoError = (event) => {
  const el = event.target;
  const fallback = '/og-default.png';
  console.log('[Header] Ошибка загрузки логотипа:', el?.src);
  if (el && el.src && !String(el.src).includes('og-default.png')) {
    el.src = fallback;
    return;
  }
  if (el) el.style.display = 'none';
};

let unwatch = null;
let refreshInterval = null;

onMounted(() => {
  unwatch = watch(isAuthenticated, (newValue, oldValue) => {
    if (newValue !== oldValue) {
      eventBus.emit('auth-state-changed', {
        isAuthenticated: newValue,
        fromHeader: true
      });
    }
  });

  const { refreshFooterDle } = useFooterDle();
  refreshInterval = setInterval(() => {
    refreshFooterDle();
    loadSiteBrand({ force: true });
  }, 5 * 60 * 1000);
  loadSiteBrand();
});

onBeforeUnmount(() => {
  if (unwatch) {
    unwatch();
  }
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
  z-index: 100;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.header-content {
  display: grid;
  grid-template-columns: minmax(min-content, 1fr) minmax(0, auto) minmax(min-content, 1fr);
  align-items: center;
  min-width: 0;
  max-width: 100%;
  gap: var(--spacing-sm);
}

.header-start {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 44px;
  position: relative;
  z-index: 1;
}

.header-center {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-xs);
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.header-personal-btn {
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
  min-width: 44px;
  min-height: 44px;
  box-sizing: border-box;
}

.header-personal-btn:hover {
  background-color: var(--color-light);
}

.header-personal-btn.active {
  background-color: var(--color-light);
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
  color: var(--color-primary);
  font-size: 1.5rem;
  font-weight: 400;
  line-height: 1;
  cursor: pointer;
  transition: color var(--transition-fast, 0.15s ease), background var(--transition-fast, 0.15s ease);
  box-sizing: border-box;
}

.header-close-btn:hover {
  color: var(--color-primary);
  background: var(--color-light, #f3f4f6);
}

.header-close-btn:focus-visible {
  outline: 2px solid var(--color-primary, #2563eb);
  outline-offset: 2px;
}

.footer-dle-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.footer-dle-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.footer-dle-logo {
  width: clamp(22px, 4.2vw + 10px, 32px);
  height: clamp(22px, 4.2vw + 10px, 32px);
  border-radius: 6px;
  object-fit: contain;
  border: 2px solid var(--color-border);
  background: var(--color-white);
  flex-shrink: 0;
}

.dle-name {
  display: block;
  width: 100%;
  font-size: clamp(0.7rem, 0.52rem + 1.1vw, 0.9rem);
  color: var(--color-primary);
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  max-width: 100%;
}

.dle-header-desc {
  display: block;
  width: 100%;
  font-size: clamp(0.6rem, 0.48rem + 0.85vw, 0.75rem);
  color: var(--color-grey-dark, #4a5568);
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  max-width: 100%;
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

@media (max-width: 768px) {
  .header {
    padding:
      max(14px, env(safe-area-inset-top, 0px))
      max(12px, env(safe-area-inset-right, 0px))
      12px
      max(12px, env(safe-area-inset-left, 0px));
  }

  .header-content {
    gap: var(--spacing-xs);
  }

  .footer-dle-info {
    gap: 6px;
  }

  .header-close-btn,
  .header-wallet-btn,
  .header-personal-btn {
    min-width: 48px;
    min-height: 48px;
    padding: 12px;
  }
}

@media (max-width: 480px) {
  .header {
    padding:
      max(12px, env(safe-area-inset-top, 0px))
      max(10px, env(safe-area-inset-right, 0px))
      10px
      max(10px, env(safe-area-inset-left, 0px));
  }

  .header-content {
    gap: 4px;
  }

  .footer-dle-info {
    gap: 4px;
  }

  .footer-dle-text {
    gap: 1px;
  }

  .footer-dle-logo {
    border-width: 1px;
  }

  .header-close-btn,
  .header-wallet-btn,
  .header-personal-btn {
    min-width: 48px;
    min-height: 48px;
  }

  .header-close-btn {
    padding: 0;
  }
}

@media (max-width: 360px) {
  .header {
    padding:
      max(10px, env(safe-area-inset-top, 0px))
      max(8px, env(safe-area-inset-right, 0px))
      8px
      max(8px, env(safe-area-inset-left, 0px));
  }

  .header-content {
    gap: 2px;
  }

  .footer-dle-info {
    gap: 4px;
  }

  .header-actions {
    gap: 0;
  }
}
</style>
