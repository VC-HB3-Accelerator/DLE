<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="locale-controls">
    <div class="locale-controls__group" :title="t('locale.language')">
      <button
        v-for="loc in locales"
        :key="loc"
        type="button"
        class="locale-controls__btn"
        :class="{ 'locale-controls__btn--active': currentLocale === loc }"
        :aria-label="t(`locale.${loc}`)"
        @click="setLocale(loc)"
      >
        {{ t(`locale.${loc}`) }}
      </button>
    </div>

    <div
      v-if="serverList.length"
      ref="serverDropdownRef"
      class="locale-controls__dropdown"
    >
      <button
        type="button"
        class="locale-controls__dropdown-trigger"
        :class="{ 'locale-controls__dropdown-trigger--open': serverMenuOpen }"
        :aria-expanded="serverMenuOpen"
        :aria-haspopup="true"
        :title="t('locale.servers')"
        @click="toggleServerMenu"
      >
        <span class="locale-controls__dropdown-label">{{ currentServerLabel }}</span>
        <span
          v-if="serverList.length > 1"
          class="locale-controls__dropdown-chevron"
          aria-hidden="true"
        >▾</span>
      </button>

      <ul
        v-if="serverMenuOpen && serverList.length > 1"
        class="locale-controls__dropdown-menu"
        role="menu"
      >
        <li
          v-for="server in serverList"
          :key="server.id"
          role="none"
        >
          <button
            type="button"
            class="locale-controls__dropdown-item"
            :class="{ 'locale-controls__dropdown-item--active': server.id === currentServerId }"
            role="menuitem"
            @click="selectServer(server.id)"
          >
            <span class="locale-controls__dropdown-item-label">{{ server.label }}</span>
            <span v-if="server.url" class="locale-controls__dropdown-item-url">{{ server.url }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useLocale } from '../composables/useLocale';
import {
  detectCurrentRegion,
  getRegionUrl,
  getRegionSwitcherList,
} from '../config/regions';
import { fetchRegionUrls } from '../services/regionUrlsService';

const { currentLocale, setLocale, t } = useLocale();

const locales = ['ru', 'en'];
const serverMenuOpen = ref(false);
const serverDropdownRef = ref(null);

const serverList = computed(() => getRegionSwitcherList());
const currentServerId = computed(() => detectCurrentRegion());

const currentServerLabel = computed(() => {
  const current = serverList.value.find((server) => server.id === currentServerId.value);
  return current?.label || t('locale.servers');
});

function closeServerMenu() {
  serverMenuOpen.value = false;
}

function toggleServerMenu() {
  if (serverList.value.length <= 1) {
    return;
  }
  serverMenuOpen.value = !serverMenuOpen.value;
}

function selectServer(serverId) {
  closeServerMenu();
  switchServer(serverId);
}

function switchServer(serverId) {
  if (serverId === currentServerId.value) {
    return;
  }
  const url = getRegionUrl(serverId);
  const target = new URL(url, window.location.origin);
  const current = window.location.href.replace(/\/$/, '').split('#')[0];
  const next = target.href.replace(/\/$/, '').split('#')[0];
  if (next === current) {
    return;
  }
  window.location.href = target.href;
}

function handleDocumentClick(event) {
  if (!serverMenuOpen.value) {
    return;
  }
  const root = serverDropdownRef.value;
  if (root && !root.contains(event.target)) {
    closeServerMenu();
  }
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') {
    closeServerMenu();
  }
}

onMounted(() => {
  fetchRegionUrls().catch(() => {});
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleDocumentKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick);
  document.removeEventListener('keydown', handleDocumentKeydown);
});
</script>

<style scoped>
.locale-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.locale-controls__group {
  display: flex;
  align-items: center;
  background: var(--color-light, #f5f7fa);
  border-radius: var(--radius-lg, 8px);
  padding: 2px;
}

.locale-controls__btn {
  border: none;
  background: transparent;
  color: var(--color-grey-dark, #606266);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  line-height: 1;
  white-space: nowrap;
}

.locale-controls__btn:hover {
  color: var(--color-primary);
}

.locale-controls__btn--active {
  background: var(--color-white, #fff);
  color: var(--color-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.locale-controls__dropdown {
  position: relative;
}

.locale-controls__dropdown-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: var(--color-light, #f5f7fa);
  color: var(--color-grey-dark, #606266);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: var(--radius-lg, 8px);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
  line-height: 1;
  max-width: 140px;
}

.locale-controls__dropdown-trigger:hover,
.locale-controls__dropdown-trigger--open {
  color: var(--color-primary);
  background: var(--color-white, #fff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.locale-controls__dropdown-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.locale-controls__dropdown-chevron {
  flex-shrink: 0;
  font-size: 0.85rem;
  line-height: 1;
  transition: transform 0.15s ease;
}

.locale-controls__dropdown-trigger--open .locale-controls__dropdown-chevron {
  transform: rotate(180deg);
}

.locale-controls__dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 200;
  min-width: 220px;
  max-width: min(320px, 80vw);
  margin: 0;
  padding: 4px;
  list-style: none;
  background: var(--color-white, #fff);
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.locale-controls__dropdown-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.locale-controls__dropdown-item:hover {
  background: var(--color-light, #f5f7fa);
}

.locale-controls__dropdown-item--active {
  background: rgba(64, 158, 255, 0.08);
  color: var(--color-primary);
}

.locale-controls__dropdown-item-label {
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.2;
}

.locale-controls__dropdown-item-url {
  font-size: 0.7rem;
  color: #909399;
  line-height: 1.2;
  word-break: break-all;
}

.locale-controls__dropdown-item--active .locale-controls__dropdown-item-url {
  color: var(--color-primary);
  opacity: 0.75;
}

@media (max-width: 480px) {
  .locale-controls__dropdown-trigger {
    max-width: 100px;
    padding: 6px 8px;
  }

  .locale-controls__dropdown-menu {
    min-width: 200px;
  }
}
</style>
