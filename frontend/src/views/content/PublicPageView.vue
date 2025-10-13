<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="public-page-view">
      <button class="close-btn" @click="goBack">×</button>

      <!-- Заголовок страницы -->
      <div class="page-header" v-if="page">
        <h1>{{ page.title }}</h1>
        <div class="page-meta">
          <span class="page-date">
            <i class="fas fa-calendar"></i>
            {{ formatDate(page.created_at) }}
          </span>
          <span class="page-status published">
            <i class="fas fa-circle"></i>
            Опубликовано
          </span>
          <span class="page-author" v-if="page.author_address">
            <i class="fas fa-user"></i>
            Автор: {{ formatAddress(page.author_address) }}
          </span>
        </div>
      </div>

      <!-- Основной контент -->
      <div class="content-block" v-if="page">
        <!-- Краткое описание -->
        <div v-if="page.summary" class="page-summary">
          <h2>Описание</h2>
          <p>{{ page.summary }}</p>
        </div>

        <!-- Основной контент -->
        <div class="page-content">
          <h2>Содержание</h2>
          <div class="content-text" v-html="formatContent(page.content)"></div>
        </div>

        <!-- SEO информация -->
        <div v-if="page.seo" class="page-seo">
          <h2>SEO информация</h2>
          <div class="seo-content" v-html="formatContent(page.seo)"></div>
        </div>
      </div>

      <!-- Загрузка -->
      <div v-else-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Загрузка страницы...</p>
      </div>

      <!-- Ошибка -->
      <div v-else class="error-state">
        <div class="error-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3>Страница не найдена</h3>
        <p>Запрашиваемая страница не существует или не опубликована</p>
        <button class="btn btn-primary" @click="goBack">
          <i class="fas fa-arrow-left"></i>
          Вернуться к списку
        </button>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import pagesService from '../../services/pagesService';

// Props
const props = defineProps({
  isAuthenticated: {
    type: Boolean,
    default: false
  },
  identities: {
    type: Array,
    default: () => []
  },
  tokenBalances: {
    type: Object,
    default: () => ({})
  },
  isLoadingTokens: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits(['auth-action-completed']);

const router = useRouter();
const route = useRoute();

// Состояние
const page = ref(null);
const isLoading = ref(false);

// Методы
function goBack() {
  router.push({ name: 'content-list' });
}

function formatDate(date) {
  if (!date) return 'Не указана';
  return new Date(date).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatAddress(address) {
  if (!address) return '';
  // Показываем сокращенный адрес: 0x1234...5678
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatContent(content) {
  if (!content) return '';
  // Простое форматирование - замена переносов строк на <br>
  return content.replace(/\n/g, '<br>');
}

async function loadPage() {
  try {
    isLoading.value = true;
    const pageId = route.params.id;
    page.value = await pagesService.getPublicPage(pageId);
  } catch (error) {
    console.error('Ошибка загрузки страницы:', error);
    page.value = null;
  } finally {
    isLoading.value = false;
  }
}

// Загрузка данных
onMounted(() => {
  loadPage();
});
</script>

<style scoped>
.public-page-view {
  padding: 20px;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  position: relative;
}

.close-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #bbb;
  transition: color 0.2s;
  z-index: 10;
}

.close-btn:hover {
  color: #333;
}

.page-header {
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.page-header h1 {
  color: var(--color-primary);
  font-size: 2.5rem;
  margin: 0 0 15px 0;
  line-height: 1.2;
}

.page-meta {
  display: flex;
  gap: 20px;
  font-size: 0.9rem;
  color: var(--color-grey-dark);
  flex-wrap: wrap;
}

.page-meta span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.page-status.published {
  color: #4caf50;
}

.content-block {
  background: #f8f9fa;
  border-radius: var(--radius-lg);
  padding: 30px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.page-summary,
.page-content,
.page-seo {
  margin-bottom: 30px;
}

.page-summary:last-child,
.page-content:last-child,
.page-seo:last-child {
  margin-bottom: 0;
}

.page-summary h2,
.page-content h2,
.page-seo h2 {
  color: var(--color-primary);
  font-size: 1.5rem;
  margin: 0 0 15px 0;
}

.page-summary p {
  color: var(--color-grey-dark);
  font-size: 1.1rem;
  line-height: 1.6;
  margin: 0;
}

.content-text,
.seo-content {
  color: var(--color-grey-dark);
  font-size: 1rem;
  line-height: 1.7;
}

.loading-state,
.error-state {
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

.error-icon {
  font-size: 4rem;
  color: #ff9800;
  margin-bottom: 20px;
}

.error-state h3 {
  color: var(--color-primary);
  margin: 0 0 10px 0;
}

.error-state p {
  color: var(--color-grey-dark);
  margin: 0 0 25px 0;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
}

.btn-outline {
  background: white;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}

.btn-outline:hover {
  background: var(--color-primary);
  color: white;
}

@media (max-width: 768px) {
  .public-page-view {
    padding: 15px;
  }
  
  .page-header h1 {
    font-size: 2rem;
  }
  
  .page-meta {
    flex-direction: column;
    gap: 10px;
  }
  
  .content-block {
    padding: 20px;
  }
}
</style>
