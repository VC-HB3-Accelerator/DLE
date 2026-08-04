<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="locale-controls">
    <div
      v-if="enabledLocales.length > 1"
      ref="localeDropdownRef"
      class="locale-controls__dropdown"
    >
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
          v-for="loc in enabledLocales"
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
      v-if="serverList.length > 1"
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
          class="locale-controls__dropdown-chevron"
          aria-hidden="true"
        >▾</span>
      </button>

      <ul
        v-if="serverMenuOpen"
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useLocale } from '../composables/useLocale';
import {
  detectCurrentRegion,
  getRegionUrl,
  getRegionSwitcherList,
} from '../config/regions';
import { getEnabledLocalesCache } from '../config/enabledLocalesCache';
import { fetchRegionUrls } from '../services/regionUrlsService';
import { fetchSidebarNav } from '../services/sidebarNavService';

const { currentLocale, setLocale, t } = useLocale();

const localeMenuOpen = ref(false);
const serverMenuOpen = ref(false);
const localeDropdownRef = ref(null);
const serverDropdownRef = ref(null);

const enabledLocalesCache = getEnabledLocalesCache();
const enabledLocales = computed(() => enabledLocalesCache.locales);

const serverList = computed(() => getRegionSwitcherList());
const currentServerId = computed(() => detectCurrentRegion());

const currentServerLabel = computed(() => {
  const current = serverList.value.find((server) => server.id === currentServerId.value);
  return current?.label || t('locale.servers');
});

function ensureCurrentLocaleAllowed() {
  const allowed = enabledLocales.value;
  if (!allowed.length) {
    return;
  }
  if (!allowed.includes(currentLocale.value)) {
    setLocale(allowed[0]);
  }
}
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
  fetchSidebarNav()
    .then(() => ensureCurrentLocaleAllowed())
    .catch(() => {});
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleDocumentKeydown);
});

watch(enabledLocales, () => {
  ensureCurrentLocaleAllowed();
}, { deep: true });

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick);
  document.removeEventListener('keydown', handleDocumentKeydown);
});
</script>

<style scoped>
.locale-controls {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
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
  height: var(--button-height);
  border: 1px solid var(--color-grey-light);
  background: var(--color-light);
  color: var(--color-dark);
  font-size: var(--font-size-md);
  font-weight: 500;
  padding: 0 var(--spacing-md);
  border-radius: var(--button-radius);
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
  box-sizing: border-box;
  gap: var(--spacing-xs);
  text-align: left;
}

.locale-controls__dropdown-trigger:hover,
.locale-controls__dropdown-trigger--open {
  background: var(--color-grey-light);
  border-color: var(--color-grey);
  color: var(--color-dark);
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
  color: inherit;
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
  padding: var(--spacing-xs);
  list-style: none;
  background: var(--color-white);
  border: 1px solid var(--color-grey-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  max-width: 100%;
  box-sizing: border-box;
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
  padding: var(--spacing-sm) var(--spacing-sm);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
  color: var(--color-dark);
}

.locale-controls__dropdown-item:hover {
  background: var(--color-grey-light);
  color: var(--color-dark);
}

.locale-controls__dropdown-item--active {
  background: var(--color-grey-light);
  color: var(--color-dark);
  font-weight: 600;
}

.locale-controls__dropdown-item-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  line-height: 1.2;
}

.locale-controls__dropdown-item-url {
  font-size: 0.7rem;
  color: var(--color-text-light);
  line-height: 1.2;
  word-break: break-all;
}

.locale-controls__dropdown-item--active .locale-controls__dropdown-item-url {
  color: var(--color-grey);
  opacity: 0.9;
}

@media (max-width: 480px) {
  .locale-controls__dropdown-trigger {
    height: var(--button-height-mobile);
    padding: 0 var(--spacing-sm);
    font-size: var(--font-size-sm);
  }
}

@media (max-width: 360px) {
  .locale-controls__dropdown-trigger {
    height: var(--button-height-mobile);
    padding: 0 var(--spacing-sm);
  }
}
</style>
