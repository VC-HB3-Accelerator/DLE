<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="blog-drafts page-with-close">
      <PageCloseButton :fallback="{ name: 'blog' }" />

      <div class="blog-drafts__panel">
        <h2>{{ t('blog.drafts.title') }}</h2>
        <p class="blog-drafts__intro">{{ t('blog.drafts.intro') }}</p>

        <div v-if="!isAuthenticated" class="blog-drafts__denied">
          <p>{{ t('blog.drafts.loginRequired') }}</p>
        </div>

        <div v-else-if="isLoading" class="blog-drafts__loading">
          {{ t('common.loading') }}
        </div>

        <div v-else-if="loadError" class="blog-drafts__error">{{ loadError }}</div>

        <div v-else-if="!items.length" class="blog-drafts__empty">
          {{ t('blog.drafts.empty') }}
        </div>

        <ul v-else class="blog-drafts__list">
          <li v-for="item in items" :key="item.id" class="blog-drafts__item">
            <button type="button" class="blog-drafts__open" @click="openDraft(item)">
              <strong>{{ item.title?.trim() || t('blog.drafts.untitled') }}</strong>
              <span class="blog-drafts__meta">{{ formatDate(item.updated_at || item.created_at) }}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import pagesService from '../services/pagesService';

const props = defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});

defineEmits(['auth-action-completed']);

const router = useRouter();
const { t, locale } = useI18n();
const items = ref([]);
const isLoading = ref(false);
const loadError = ref('');

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString(locale.value === 'en' ? 'en-GB' : 'ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

function openDraft(item) {
  if (!item?.id) return;
  router.push({
    name: 'content-create',
    query: {
      edit: String(item.id),
      visibility: 'public',
      show_in_blog: '1',
    },
  });
}

async function load() {
  if (!props.isAuthenticated) {
    items.value = [];
    return;
  }
  isLoading.value = true;
  loadError.value = '';
  try {
    const rows = await pagesService.getPages({
      status: 'draft',
      show_in_blog: '1',
      mine: '1',
    });
    items.value = Array.isArray(rows) ? rows : [];
  } catch (e) {
    items.value = [];
    loadError.value = e?.response?.data?.error || t('blog.drafts.loadError');
  } finally {
    isLoading.value = false;
  }
}

onMounted(load);
watch(() => props.isAuthenticated, () => { load(); });
</script>

<style scoped>
.blog-drafts {
  max-width: 40rem;
  margin: 0 auto;
  padding: 1rem 1rem 2.5rem;
}

.blog-drafts__panel {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.blog-drafts__panel h2 {
  margin: 0;
  font-size: 1.35rem;
}

.blog-drafts__intro,
.blog-drafts__loading,
.blog-drafts__empty,
.blog-drafts__denied,
.blog-drafts__error {
  margin: 0;
  font-size: 0.95rem;
  color: var(--text-secondary, #555);
}

.blog-drafts__error {
  color: var(--danger, #b00020);
}

.blog-drafts__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.blog-drafts__item {
  border-bottom: 1px solid var(--border-color, #e2e2e2);
}

.blog-drafts__open {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  width: 100%;
  margin: 0;
  padding: 0.75rem 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.blog-drafts__open:hover strong {
  color: var(--color-primary);
}

.blog-drafts__meta {
  font-size: 0.8rem;
  color: var(--text-secondary, #777);
}
</style>
