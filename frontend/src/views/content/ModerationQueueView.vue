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
    <AdminPageShell :show-close="true" :fallback="{ name: 'content-list' }">
      <div class="moderation-page">
        <h1 class="moderation-page__title">{{ t('content.moderation.title') }}</h1>
        <p class="moderation-page__lead">{{ t('content.moderation.lead') }}</p>

        <section class="moderation-section">
          <h2>{{ t('content.moderation.posts') }}</h2>
          <p v-if="postsLoading">{{ t('common.loading') }}</p>
          <p v-else-if="!pendingPosts.length" class="moderation-empty">{{ t('content.moderation.emptyPosts') }}</p>
          <ul v-else class="moderation-list">
            <li v-for="page in pendingPosts" :key="page.id" class="moderation-item">
              <div class="moderation-item__body">
                <strong>{{ page.title || t('content.moderation.untitled') }}</strong>
                <span class="moderation-item__meta">#{{ page.id }} · {{ page.status }}</span>
              </div>
              <div class="moderation-item__actions">
                <button type="button" class="btn btn-outline btn-sm" @click="openPost(page)">{{ t('common.edit') }}</button>
                <button type="button" class="btn btn-primary btn-sm" :disabled="busyId === `p-${page.id}`" @click="approvePost(page)">
                  {{ t('content.moderation.approve') }}
                </button>
                <button type="button" class="btn btn-outline btn-sm" :disabled="busyId === `p-${page.id}`" @click="returnPost(page)">
                  {{ t('content.moderation.return') }}
                </button>
              </div>
            </li>
          </ul>
        </section>

        <section class="moderation-section">
          <h2>{{ t('content.moderation.products') }}</h2>
          <p v-if="productsLoading">{{ t('common.loading') }}</p>
          <p v-else-if="!pendingProducts.length" class="moderation-empty">{{ t('content.moderation.emptyProducts') }}</p>
          <ul v-else class="moderation-list">
            <li v-for="product in pendingProducts" :key="product.id" class="moderation-item">
              <div class="moderation-item__body">
                <strong>{{ product.title }}</strong>
                <span class="moderation-item__meta">{{ product.moderation_status }}</span>
              </div>
              <div class="moderation-item__actions">
                <button type="button" class="btn btn-outline btn-sm" @click="openProduct(product)">{{ t('common.edit') }}</button>
                <button type="button" class="btn btn-primary btn-sm" :disabled="busyId === `s-${product.id}`" @click="approveProduct(product)">
                  {{ t('content.moderation.approve') }}
                </button>
                <button type="button" class="btn btn-outline btn-sm" :disabled="busyId === `s-${product.id}`" @click="returnProduct(product)">
                  {{ t('content.moderation.return') }}
                </button>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </AdminPageShell>
  </BaseLayout>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../../components/BaseLayout.vue';
import AdminPageShell from '../../components/admin/AdminPageShell.vue';
import pagesService from '../../services/pagesService';
import { listStoreProducts, approveStoreProduct, returnStoreProduct } from '../../services/storeService';

defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});
defineEmits(['auth-action-completed']);

const { t } = useI18n();
const router = useRouter();
const pendingPosts = ref([]);
const pendingProducts = ref([]);
const postsLoading = ref(true);
const productsLoading = ref(true);
const busyId = ref('');

async function loadPosts() {
  postsLoading.value = true;
  try {
    const rows = await pagesService.getPages({ status: 'pending' });
    pendingPosts.value = Array.isArray(rows) ? rows.filter((p) => p.status === 'pending') : [];
  } catch (e) {
    console.warn('[moderation] posts', e);
    pendingPosts.value = [];
  } finally {
    postsLoading.value = false;
  }
}

async function loadProducts() {
  productsLoading.value = true;
  try {
    const products = await listStoreProducts({ moderation_status: 'pending' });
    pendingProducts.value = Array.isArray(products) ? products : [];
  } catch (e) {
    console.warn('[moderation] products', e);
    pendingProducts.value = [];
  } finally {
    productsLoading.value = false;
  }
}

function openPost(page) {
  router.push({ name: 'content-create', query: { edit: String(page.id) } });
}

function openProduct(product) {
  router.push({ name: 'content-store-product-edit', params: { id: product.id } });
}

function moderationError(e) {
  return e?.response?.data?.error || e?.message || String(e);
}

async function approvePost(page) {
  busyId.value = `p-${page.id}`;
  try {
    await pagesService.approvePage(page.id);
    await loadPosts();
  } catch (e) {
    alert(moderationError(e));
  } finally {
    busyId.value = '';
  }
}

async function returnPost(page) {
  busyId.value = `p-${page.id}`;
  try {
    await pagesService.returnPage(page.id);
    await loadPosts();
  } catch (e) {
    alert(moderationError(e));
  } finally {
    busyId.value = '';
  }
}

async function approveProduct(product) {
  busyId.value = `s-${product.id}`;
  try {
    await approveStoreProduct(product.id);
    await loadProducts();
  } catch (e) {
    alert(moderationError(e));
  } finally {
    busyId.value = '';
  }
}

async function returnProduct(product) {
  busyId.value = `s-${product.id}`;
  try {
    await returnStoreProduct(product.id);
    await loadProducts();
  } catch (e) {
    alert(moderationError(e));
  } finally {
    busyId.value = '';
  }
}

onMounted(() => {
  loadPosts();
  loadProducts();
});
</script>

<style scoped>
.moderation-page {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--spacing-lg);
}

.moderation-page__title {
  margin: 0 0 var(--spacing-sm);
  font-size: var(--font-size-2xl);
}

.moderation-page__lead {
  margin: 0 0 var(--spacing-xl);
  color: var(--theme-text-muted);
}

.moderation-section {
  margin-bottom: var(--spacing-xl);
}

.moderation-section h2 {
  margin: 0 0 var(--spacing-md);
  font-size: var(--font-size-lg);
}

.moderation-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.moderation-item {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) 0;
  border-bottom: 1px solid var(--theme-border);
}

.moderation-item__meta {
  display: block;
  color: var(--theme-text-muted);
  font-size: var(--font-size-sm);
  margin-top: 0.25rem;
}

.moderation-item__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.moderation-empty {
  color: var(--theme-text-muted);
}
</style>
