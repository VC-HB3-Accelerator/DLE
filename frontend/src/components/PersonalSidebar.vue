<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Личный сайдбар workspace (слева). Один инстанс в App + Teleport на body.
  Страница 1 — мой workspace; страница 2 — карточка CRM + Закрыть.
-->

<template>
  <Teleport to="body">
    <div
      class="personal-sidebar"
      :class="{ 'is-open': modelValue }"
      :aria-hidden="modelValue ? 'false' : 'true'"
      :aria-label="t('personalSidebar.toggle')"
    >
      <div class="personal-sidebar-content">
        <div class="personal-sidebar-head">
          <button
            type="button"
            class="personal-sidebar-toggle"
            :aria-label="t('personalSidebar.toggle')"
            :title="t('personalSidebar.toggle')"
            :aria-expanded="modelValue ? 'true' : 'false'"
            @click="close"
          >
            <UiGlyph name="sidebar-left" :size="20" />
          </button>
        </div>

        <template v-if="showCardPage">
          <p class="personal-sidebar-section-title">
            {{ t('personalSidebar.contactCard') }}
            <span v-if="selectedContactId" class="personal-sidebar-section-id">
              #{{ selectedContactId }}
            </span>
          </p>
          <div class="navigation-buttons">
            <router-link
              v-for="item in cardItems"
              :key="item.id"
              :to="item.to"
              class="btn btn-ghost btn-block nav-link-btn"
              :class="{ active: item.active }"
              @click="close"
            >
              <span>{{ t(item.labelKey) }}</span>
            </router-link>
            <button
              type="button"
              class="btn btn-ghost btn-block nav-link-btn nav-close-card-btn"
              @click="onCloseCard"
            >
              <span>{{ t('personalSidebar.closeCard') }}</span>
            </button>
          </div>
        </template>

        <template v-else>
          <div class="navigation-buttons">
            <router-link
              v-for="item in workspaceItems"
              :key="item.id"
              :to="item.to"
              class="btn btn-ghost btn-block nav-link-btn"
              :class="{ active: item.active }"
              @click="close"
            >
              <span>{{ t(item.labelKey) }}</span>
            </router-link>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePersonalSidebarItems } from '@/composables/usePersonalSidebarItems';
import UiGlyph from './UiGlyph.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const {
  workspaceItems,
  cardItems,
  showCardPage,
  selectedContactId,
  closeCard,
  isAuthenticated,
} = usePersonalSidebarItems();

function close() {
  emit('update:modelValue', false);
}

async function onCloseCard() {
  await closeCard();
  // Панель оставляем открытой на странице 1 (workspace).
}

watch(isAuthenticated, (ok) => {
  if (!ok && props.modelValue) close();
});
</script>

<style scoped>
.personal-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  max-width: 100%;
  height: 100%;
  background-color: var(--color-white);
  z-index: 1000;
  overflow: hidden;
  padding: 0 var(--spacing-lg) var(--spacing-lg);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  box-shadow: 5px 0 15px rgba(0, 0, 0, 0.1);
  transform: translateX(-100%);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    transform var(--transition-normal),
    opacity var(--transition-normal),
    visibility var(--transition-normal);
}

.personal-sidebar.is-open {
  transform: translateX(0);
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.personal-sidebar-content {
  max-width: 100%;
  width: 100%;
  margin: 0 auto;
  padding: 0 var(--spacing-md);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  overflow: hidden;
  flex: 1;
  min-height: 0;
}

.personal-sidebar-head {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  box-sizing: border-box;
  min-height: var(--header-height);
  padding-top: max(30px, env(safe-area-inset-top, 0px));
  padding-bottom: 25px;
}

.personal-sidebar-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
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

.personal-sidebar-toggle:hover {
  background-color: var(--color-light);
}

.personal-sidebar-section-title {
  margin: 0;
  padding: 0 var(--spacing-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-grey);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.personal-sidebar-section-id {
  font-weight: 500;
  text-transform: none;
  opacity: 0.85;
}

.personal-sidebar :deep(.btn:not(.btn-icon)),
.personal-sidebar .nav-link-btn {
  justify-content: flex-start;
  text-align: left;
  padding-left: var(--spacing-md);
  padding-right: var(--spacing-md);
}

.navigation-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  overflow: auto;
  min-height: 0;
}

.nav-link-btn.active {
  background-color: var(--color-grey-light);
  border-color: var(--color-grey);
  font-weight: 600;
}

.nav-close-card-btn {
  margin-top: var(--spacing-sm);
  border-color: var(--color-border);
  color: var(--color-grey);
}

@media (min-width: 1200px) {
  .personal-sidebar {
    width: var(--sidebar-panel-width);
    max-width: var(--sidebar-panel-width);
  }
}

@media (min-width: 769px) and (max-width: 1199px) {
  .personal-sidebar {
    width: var(--sidebar-panel-width-narrow);
    max-width: var(--sidebar-panel-width-narrow);
  }
}

@media (max-width: 768px) {
  .personal-sidebar {
    padding: 0 var(--spacing-md) var(--spacing-md);
  }

  .personal-sidebar-content {
    padding: 0;
    gap: var(--spacing-sm);
  }
}
</style>
