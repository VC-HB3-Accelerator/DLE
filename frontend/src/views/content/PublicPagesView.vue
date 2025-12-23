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
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="public-pages-page">

      <!-- Основной контент -->
      <div class="content-block">
        <div class="section-header">
          <h2>Опубликованные страницы</h2>
          <div class="search-box">
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Поиск страниц..."
              class="search-input"
            >
            <i class="fas fa-search search-icon"></i>
          </div>
        </div>

        <!-- Список страниц -->
        <div v-if="filteredPages.length" class="pages-grid">
          <div 
            v-for="page in filteredPages" 
            :key="page.id" 
            class="page-card"
            @click="goToPage(page.id)"
          >
            <div class="page-card-header">
              <h3>{{ page.title }}</h3>
              <div class="page-status published">
                <i class="fas fa-circle"></i>
                Опубликовано
              </div>
            </div>
            <div class="page-card-content">
              <p class="page-summary">{{ page.summary || 'Без описания' }}</p>
              <div class="page-meta">
                <span class="page-date">
                  <i class="fas fa-calendar"></i>
                  {{ formatDate(page.created_at) }}
                </span>
                <span class="page-author" v-if="page.author_address">
                  <i class="fas fa-user"></i>
                  {{ formatAddress(page.author_address) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Пустое состояние -->
        <div v-else-if="!isLoading" class="empty-state">
          <div class="empty-icon">
            <i class="fas fa-file-alt"></i>
          </div>
          <h3>Нет опубликованных страниц</h3>
          <p>Публичные страницы появятся здесь после их создания администраторами</p>
        </div>

        <!-- Загрузка -->
        <div v-else class="loading-state">
          <div class="loading-spinner"></div>
          <p>Загрузка страниц...</p>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
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

// Состояние
const pages = ref([]);
const isLoading = ref(false);
const searchQuery = ref('');

// Вычисляемые свойства
const filteredPages = computed(() => {
  if (!searchQuery.value) return pages.value;
  return pages.value.filter(page => 
    page.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    page.summary?.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
});

// Методы
function goToPage(id) {
  router.push({ name: 'public-page-view', params: { id } });
}

function formatDate(date) {
  if (!date) return 'Не указана';
  return new Date(date).toLocaleDateString('ru-RU');
}

function formatAddress(address) {
  if (!address) return '';
  // Показываем сокращенный адрес: 0x1234...5678
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

async function loadPages() {
  try {
    isLoading.value = true;
    pages.value = await pagesService.getPublicPages();
  } catch (error) {
    console.error('Ошибка загрузки публичных страниц:', error);
    pages.value = [];
  } finally {
    isLoading.value = false;
  }
}

// Загрузка данных
onMounted(() => {
  loadPages();
});
</script>

<style scoped>
.public-pages-page {
  padding: 20px;
  width: 100%;
}

.page-header {
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.header-content h1 {
  color: var(--color-primary);
  font-size: 2.5rem;
  margin: 0 0 10px 0;
}

.header-content p {
  color: var(--color-grey-dark);
  font-size: 1.1rem;
  margin: 0;
}

.content-block {
  background: #f8f9fa;
  border-radius: var(--radius-lg);
  padding: 25px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
}

.section-header h2 {
  color: var(--color-primary);
  margin: 0;
}

.search-box {
  position: relative;
  width: 300px;
}

.search-input {
  width: 100%;
  padding: 10px 40px 10px 15px;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-sm);
  font-size: 1rem;
}

.search-icon {
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-grey-dark);
}

.pages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.page-card {
  background: white;
  border-radius: var(--radius-sm);
  padding: 20px;
  border: 1px solid #e9ecef;
  cursor: pointer;
  transition: all 0.3s ease;
}

.page-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.page-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
}

.page-card-header h3 {
  color: var(--color-primary);
  margin: 0;
  font-size: 1.2rem;
}

.page-status.published {
  font-size: 0.9rem;
  color: #4caf50;
}

.page-status.published i {
  margin-right: 5px;
}

.page-summary {
  color: var(--color-grey-dark);
  margin: 0 0 15px 0;
  line-height: 1.5;
}

.page-meta {
  display: flex;
  gap: 15px;
  font-size: 0.9rem;
  color: var(--color-grey-dark);
}

.page-date i,
.page-author i {
  margin-right: 5px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 4rem;
  color: var(--color-grey-dark);
  margin-bottom: 20px;
}

.empty-state h3 {
  color: var(--color-primary);
  margin: 0 0 10px 0;
}

.empty-state p {
  color: var(--color-grey-dark);
  margin: 0;
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

@media (max-width: 768px) {
  .section-header {
    flex-direction: column;
    gap: 15px;
    align-items: stretch;
  }
  
  .search-box {
    width: 100%;
  }
  
  .pages-grid {
    grid-template-columns: 1fr;
  }
}
</style>
