<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="blog-feed-toolbar">
    <div ref="filterDropdownRef" class="blog-feed-toolbar__filter">
      <button
        type="button"
        class="blog-feed-toolbar__btn"
        :class="{ 'blog-feed-toolbar__btn--open': menuOpen }"
        :aria-expanded="menuOpen"
        :aria-haspopup="true"
        @click="toggleMenu"
      >
        <i class="fas fa-filter" aria-hidden="true" />
        <span class="blog-feed-toolbar__btn-label">{{ currentFilterLabel }}</span>
        <span class="blog-feed-toolbar__chevron" aria-hidden="true">▾</span>
      </button>

      <ul
        v-if="menuOpen && filters.length"
        class="blog-feed-toolbar__menu"
        role="menu"
      >
        <li
          v-for="item in filters"
          :key="item.slug"
          role="none"
        >
          <button
            type="button"
            class="blog-feed-toolbar__menu-item"
            :class="{ 'blog-feed-toolbar__menu-item--active': item.slug === modelValue }"
            role="menuitem"
            @click="selectFilter(item.slug)"
          >
            {{ filterLabel(item) }}
          </button>
        </li>
      </ul>
    </div>

    <button
      v-if="canManage"
      type="button"
      class="blog-feed-toolbar__settings"
      :title="t('blog.feedSettings.open')"
      :aria-label="t('blog.feedSettings.open')"
      @click="$emit('open-settings')"
    >
      <i class="fas fa-cog" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  filters: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' },
  canManage: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'open-settings']);

const { t, locale } = useI18n();
const menuOpen = ref(false);
const filterDropdownRef = ref(null);

function filterLabel(item) {
  if (!item) return t('blog.filter.button');
  if (locale.value === 'en') {
    return item.label_en || item.label_ru || item.slug;
  }
  return item.label_ru || item.label_en || item.slug;
}

const currentFilterLabel = computed(() => {
  const current = props.filters.find((f) => f.slug === props.modelValue);
  return filterLabel(current) || t('blog.filter.button');
});

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

function selectFilter(slug) {
  menuOpen.value = false;
  emit('update:modelValue', slug);
}

function handleDocumentClick(event) {
  if (!menuOpen.value) return;
  const root = filterDropdownRef.value;
  if (root && !root.contains(event.target)) {
    menuOpen.value = false;
  }
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') {
    menuOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleDocumentKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick);
  document.removeEventListener('keydown', handleDocumentKeydown);
});
</script>

<style scoped>
.blog-feed-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--spacing-md);
}

.blog-feed-toolbar__filter {
  position: relative;
  flex: 1;
  min-width: 0;
}

.blog-feed-toolbar__btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 42px;
  padding: 0 14px;
  border: 1px solid var(--color-grey-light);
  border-radius: var(--radius-lg);
  background: var(--color-light);
  color: var(--color-dark);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background var(--transition-normal), border-color var(--transition-normal);
  box-sizing: border-box;
}

.blog-feed-toolbar__btn:hover,
.blog-feed-toolbar__btn--open {
  background: var(--color-grey-light);
}

.blog-feed-toolbar__btn-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  font-weight: 600;
}

.blog-feed-toolbar__chevron {
  flex-shrink: 0;
  font-size: 0.85rem;
  transition: transform 0.15s ease;
}

.blog-feed-toolbar__btn--open .blog-feed-toolbar__chevron {
  transform: rotate(180deg);
}

.blog-feed-toolbar__menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 20;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: var(--color-white);
  border: 1px solid var(--color-grey-light);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.blog-feed-toolbar__menu-item {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  padding: 10px 12px;
  border-radius: var(--radius-md, 6px);
  cursor: pointer;
  color: var(--color-dark);
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: background 0.15s ease, color 0.15s ease;
}

.blog-feed-toolbar__menu-item:hover {
  background: var(--color-light);
}

.blog-feed-toolbar__menu-item--active {
  background: rgba(64, 158, 255, 0.08);
  color: var(--color-primary);
  font-weight: 600;
}

.blog-feed-toolbar__settings {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-grey-light);
  border-radius: var(--radius-lg);
  background: var(--color-light);
  color: var(--color-dark);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal);
}

.blog-feed-toolbar__settings:hover {
  background: var(--color-grey-light);
  color: var(--color-primary);
}
</style>
