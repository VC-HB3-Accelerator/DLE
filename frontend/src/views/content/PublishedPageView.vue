<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <BaseLayout :is-authenticated="isAuthenticated" :identities="identities" :token-balances="tokenBalances" :is-loading-tokens="isLoadingTokens" @auth-action-completed="$emit('auth-action-completed')">
    <div class="docs-page">
      <div class="docs-header">
        <button class="close-btn" @click="goBack" title="Закрыть">×</button>
      </div>

      <!-- Основной контент: сайдбар + контент -->
      <div class="docs-layout has-content">
        <!-- Сайдбар навигации -->
        <DocsSidebar :current-page-id="currentPageId" />

        <!-- Основной контент -->
        <div class="docs-main">
          <DocsContent v-if="pageSlug" :page-id="pageSlug" :is-published-route="true" @back="goToIndex" />
          
          <div v-else class="loading-state">
            <div class="loading-spinner"></div>
            <p>Загрузка документа...</p>
          </div>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import DocsSidebar from '../../components/docs/DocsSidebar.vue';
import DocsContent from '../../components/docs/DocsContent.vue';
import pagesService from '../../services/pagesService';

const props = defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});

const router = useRouter();
const route = useRoute();

const currentPageId = ref(null);
const pageSlug = computed(() => route.params.slug);

function goBack() {
  router.push({ name: 'content-published' });
}

function goToIndex() {
  router.push({ name: 'content-published' });
}

// Загружаем ID страницы по slug для сайдбара
onMounted(async () => {
  if (pageSlug.value) {
    try {
      const page = await pagesService.getPublishedPageBySlug(pageSlug.value);
      if (page && page.id) {
        currentPageId.value = page.id;
      }
    } catch (error) {
      console.error('[PublishedPageView] Ошибка загрузки страницы:', error);
    }
  }
});
</script>

<style scoped>
.docs-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 40px);
  overflow: hidden;
}

.docs-header {
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  padding: 20px;
  border-bottom: 2px solid #e9ecef;
  background: #fff;
  flex-shrink: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #888;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.docs-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
  background: #fff;
}

.docs-main {
  flex: 1;
  overflow-y: auto;
  background: #fafafa;
}

.loading-state {
  text-align: center;
  padding: 60px 20px;
}

.loading-spinner {
  border: 3px solid #f3f3f3;
  border-top: 3px solid var(--color-primary);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 1024px) {
  .docs-layout {
    flex-direction: column;
  }

  .docs-main {
    overflow-y: auto;
    min-height: 0;
  }
}

@media (max-width: 768px) {
  .docs-page {
    height: auto;
    min-height: calc(100vh - 40px);
    overflow: visible;
  }

  .docs-layout {
    flex: 1;
    min-height: 0;
    overflow: visible;
    flex-direction: column;
  }

  .docs-layout.has-content .docs-sidebar {
    display: none;
  }

  .docs-main {
    overflow-y: visible;
    min-height: auto;
    width: 100%;
    display: block;
    flex: 1;
  }

  .docs-header {
    padding: 16px;
  }
}
</style>


