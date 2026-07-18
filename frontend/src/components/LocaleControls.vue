<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="locale-controls">
    <div ref="localeDropdownRef" class="locale-controls__dropdown">
      <button
        type="button"
        class="locale-controls__dropdown-trigger"
        :class="{ 'locale-controls__dropdown-trigger--open': localeMenuOpen }"
        :aria-expanded="localeMenuOpen"
        :aria-haspopup="true"
        :title="t('locale.language')"
        @click="toggleLocaleMenu"
      >
        <span class="locale-controls__dropdown-label">
          {{ t('locale.language') }}: {{ t(`locale.${currentLocale}`) }}
        </span>
        <span class="locale-controls__dropdown-chevron" aria-hidden="true">▾</span>
      </button>

      <ul
        v-if="localeMenuOpen"
        class="locale-controls__dropdown-menu"
        role="menu"
      >
        <li
          v-for="loc in locales"
          :key="loc"
          role="none"
        >
          <button
            type="button"
            class="locale-controls__dropdown-item"
            :class="{ 'locale-controls__dropdown-item--active': currentLocale === loc }"
            role="menuitem"
            @click="selectLocale(loc)"
          >
            <span class="locale-controls__dropdown-item-label">{{ t(`locale.${loc}`) }}</span>
          </button>
        </li>
      </ul>
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
const localeMenuOpen = ref(false);
const serverMenuOpen = ref(false);
const localeDropdownRef = ref(null);
const serverDropdownRef = ref(null);

const serverList = computed(() => getRegionSwitcherList());
const currentServerId = computed(() => detectCurrentRegion());

const currentServerLabel = computed(() => {
  const current = serverList.value.find((server) => server.id === currentServerId.value);
  return current?.label || t('locale.servers');
});

function closeMenus() {
  localeMenuOpen.value = false;
  serverMenuOpen.value = false;
}

function toggleLocaleMenu() {
  const next = !localeMenuOpen.value;
  closeMenus();
  localeMenuOpen.value = next;
}

function toggleServerMenu() {
  if (serverList.value.length <= 1) {
    return;
  }
  const next = !serverMenuOpen.value;
  closeMenus();
  serverMenuOpen.value = next;
}

function selectLocale(loc) {
  closeMenus();
  setLocale(loc);
}

function selectServer(serverId) {
  closeMenus();
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
  if (!localeMenuOpen.value && !serverMenuOpen.value) {
    return;
  }
  const localeRoot = localeDropdownRef.value;
  const serverRoot = serverDropdownRef.value;
  const inLocale = localeRoot && localeRoot.contains(event.target);
  const inServer = serverRoot && serverRoot.contains(event.target);
  if (!inLocale && !inServer) {
    closeMenus();
  }
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') {
    closeMenus();
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
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.locale-controls__dropdown {
  position: relative;
  width: 100%;
}

.locale-controls__dropdown-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 48px;
  border: 1px solid var(--color-grey-light);
  background: var(--color-light);
  color: var(--color-dark);
  font-size: var(--font-size-md);
  padding: 0 15px;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-normal);
  box-sizing: border-box;
  gap: 8px;
  text-align: left;
}

.locale-controls__dropdown-trigger:hover,
.locale-controls__dropdown-trigger--open {
  background: var(--color-grey-light);
}

.locale-controls__dropdown-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
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
  left: 0;
  right: 0;
  z-index: 1100;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: var(--color-white, #fff);
  border: 1px solid var(--color-grey-light, #e4e7ed);
  border-radius: var(--radius-lg);
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
  padding: 10px 12px;
  border-radius: var(--radius-md, 6px);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  color: var(--color-dark);
}

.locale-controls__dropdown-item:hover {
  background: var(--color-light, #f5f7fa);
}

.locale-controls__dropdown-item--active {
  background: rgba(64, 158, 255, 0.08);
  color: var(--color-primary);
}

.locale-controls__dropdown-item-label {
  font-size: var(--font-size-sm, 0.875rem);
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

@media screen and (max-width: 480px) {
  .locale-controls__dropdown-trigger {
    height: 42px;
    padding: 0 12px;
    font-size: var(--font-size-sm);
  }
}

@media screen and (max-width: 360px) {
  .locale-controls__dropdown-trigger {
    height: 36px;
    padding: 0 10px;
  }
}
</style>
