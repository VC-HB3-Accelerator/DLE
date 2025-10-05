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
    <div class="content-management-page">
      <!-- Заголовок страницы -->
      <div class="page-header">
          <div class="header-content">
          <h1>📄 Управление контентом</h1>
          <p v-if="isAdmin && address">Создавайте и управляйте страницами вашего DLE</p>
          <p v-else>Просмотр опубликованных страниц DLE</p>
          <button v-if="isAdmin && address" class="btn btn-primary" @click="goToCreate">
            <i class="fas fa-plus"></i>
            Создать страницу
          </button>
          <button v-else class="btn btn-primary" @click="goToPublicPages">
            <i class="fas fa-eye"></i>
            Публичные страницы
          </button>
        </div>
        <div class="header-actions">
          <button class="close-btn" @click="goBack">×</button>
        </div>
      </div>

      <!-- Основной контент с тенью -->
      <div class="content-block">
        <!-- Навигация -->
        <div class="content-navigation">
          <div class="nav-tabs">
            <button 
              class="nav-tab" 
              :class="{ active: activeTab === 'pages' }"
              @click="activeTab = 'pages'"
            >
              <i class="fas fa-file-alt"></i>
              Страницы
            </button>
            <button 
              class="nav-tab" 
              :class="{ active: activeTab === 'settings' }"
              @click="activeTab = 'settings'"
            >
              <i class="fas fa-cog"></i>
              Настройки
            </button>
          </div>
        </div>

        <!-- Контент в зависимости от активной вкладки -->
        <div class="content-section">
          <!-- Вкладка Страницы -->
          <div v-if="activeTab === 'pages'" class="pages-section">
            <div class="section-header">
              <h2 v-if="isAdmin && address">Созданные страницы</h2>
              <h2 v-else>Опубликованные страницы</h2>
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
                  <div class="page-actions" v-if="isAdmin && address">
                    <button 
                      class="action-btn edit-btn"
                      @click.stop="goToEdit(page.id)"
                      title="Редактировать"
                    >
                      <i class="fas fa-edit"></i>
                    </button>
                    <button 
                      class="action-btn delete-btn"
                      @click.stop="deletePage(page.id)"
                      title="Удалить"
                    >
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
                <div class="page-card-content">
                  <p class="page-summary">{{ page.summary || 'Без описания' }}</p>
                  <div class="page-meta">
                    <span class="page-date">
                      <i class="fas fa-calendar"></i>
                      {{ formatDate(page.created_at) }}
                    </span>
                    <span class="page-status" :class="page.status">
                      <i class="fas fa-circle"></i>
                      {{ getStatusText(page.status) }}
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
              <h3 v-if="isAdmin && address">Нет созданных страниц</h3>
              <h3 v-else>Нет опубликованных страниц</h3>
              <p v-if="isAdmin && address">Создайте первую страницу для вашего DLE</p>
              <p v-else>Публичные страницы появятся здесь после их создания администраторами</p>
              <button v-if="isAdmin && address" class="btn btn-primary" @click="goToCreate">
                <i class="fas fa-plus"></i>
                Создать страницу
              </button>
              <button v-else class="btn btn-primary" @click="goToPublicPages">
                <i class="fas fa-eye"></i>
                Публичные страницы
              </button>
            </div>

            <!-- Загрузка -->
            <div v-else class="loading-state">
              <div class="loading-spinner"></div>
              <p>Загрузка страниц...</p>
            </div>
          </div>


          <!-- Вкладка Настройки -->
          <div v-if="activeTab === 'settings'" class="settings-section">
            <div class="section-header">
              <h2>Настройки контента</h2>
            </div>
            
            <div class="settings-grid">
              <div class="setting-card">
                <h3>SEO настройки</h3>
                <div class="setting-item">
                  <label>Мета-теги по умолчанию</label>
                  <textarea v-model="seoSettings.defaultMeta" placeholder="Введите мета-теги..."></textarea>
                </div>
              </div>
              
              <div class="setting-card">
                <h3>Настройки публикации</h3>
                <div class="setting-item">
                  <label>
                    <input type="checkbox" v-model="publishSettings.autoPublish">
                    Автоматическая публикация
                  </label>
                </div>
              </div>
            </div>
          </div>
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
import { useAuthContext } from '../../composables/useAuth';

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
const { isAdmin, address } = useAuthContext();

// Состояние
const activeTab = ref('pages');
const pages = ref([]);
const isLoading = ref(false);
const searchQuery = ref('');

// Настройки
const seoSettings = ref({
  defaultMeta: ''
});

const publishSettings = ref({
  autoPublish: false
});


// Вычисляемые свойства
const filteredPages = computed(() => {
  if (!searchQuery.value) return pages.value;
  return pages.value.filter(page => 
    page.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    page.summary?.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
});

// Методы
function goToCreate() {
  router.push({ name: 'content-create' });
}

function goToPublicPages() {
  router.push({ name: 'public-pages' });
}

function goBack() {
  router.go(-1);
}

function goToPage(id) {
  if (isAdmin.value && address.value) {
    router.push({ name: 'page-view', params: { id } });
  } else {
    router.push({ name: 'public-page-view', params: { id } });
  }
}

function goToEdit(id) {
  router.push({ name: 'page-edit', params: { id } });
}

async function deletePage(id) {
  if (confirm('Вы уверены, что хотите удалить эту страницу?')) {
    try {
      await pagesService.deletePage(id);
      await loadPages();
    } catch (error) {
      console.error('Ошибка удаления страницы:', error);
    }
  }
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

function getStatusText(status) {
  const statusMap = {
    draft: 'Черновик',
    published: 'Опубликовано',
    archived: 'Архив'
  };
  return statusMap[status] || 'Неизвестно';
}

async function loadPages() {
  try {
    isLoading.value = true;
    
    // Проверяем роль админа через кошелек
    if (isAdmin.value && address.value) {
      try {
        // Пытаемся загрузить админские страницы
        const response = await pagesService.getPages();
        pages.value = response;
      } catch (error) {
        if (error.response?.status === 403) {
          // Пользователь не админ или нет токенов, загружаем публичные страницы
          pages.value = await pagesService.getPublicPages();
        } else {
          throw error;
        }
      }
    } else {
      // Пользователь не админ или нет кошелька, загружаем публичные страницы
      pages.value = await pagesService.getPublicPages();
    }
  } catch (error) {
    console.error('Ошибка загрузки страниц:', error);
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
.content-management-page {
  padding: 20px;
  width: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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
  margin: 0 0 20px 0;
}

.header-content .btn {
  margin-top: 10px;
}

.content-navigation {
  margin-bottom: 30px;
}

.nav-tabs {
  display: flex;
  gap: 10px;
  border-bottom: 1px solid #e9ecef;
}

.nav-tab {
  background: none;
  border: none;
  padding: 15px 20px;
  font-size: 1rem;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.3s ease;
  color: var(--color-grey-dark);
}

.nav-tab:hover {
  color: var(--color-primary);
}

.nav-tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.nav-tab i {
  margin-right: 8px;
}

.content-block {
  background: #f8f9fa;
  border-radius: var(--radius-lg);
  padding: 25px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.content-section {
  background: #f8f9fa;
  border-radius: var(--radius-lg);
  padding: 25px;
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

.page-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: none;
  border: none;
  padding: 5px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background 0.2s;
}

.edit-btn:hover {
  background: #e3f2fd;
  color: #2196f3;
}

.delete-btn:hover {
  background: #ffebee;
  color: #f44336;
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
.page-status i {
  margin-right: 5px;
}

.page-status.draft i {
  color: #ff9800;
}

.page-status.published i {
  color: #4caf50;
}

.page-status.archived i {
  color: #9e9e9e;
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
  margin: 0 0 25px 0;
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


.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.setting-card {
  background: white;
  border-radius: var(--radius-sm);
  padding: 20px;
  border: 1px solid #e9ecef;
}

.setting-card h3 {
  color: var(--color-primary);
  margin: 0 0 15px 0;
}

.setting-item {
  margin-bottom: 15px;
}

.setting-item label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--color-grey-dark);
}

.setting-item textarea {
  width: 100%;
  min-height: 100px;
  padding: 10px;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-sm);
  resize: vertical;
}

.setting-item input[type="checkbox"] {
  margin-right: 8px;
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

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--color-grey-dark);
  padding: 5px;
  border-radius: var(--radius-sm);
  transition: background 0.2s;
}

.close-btn:hover {
  background: #f0f0f0;
  color: var(--color-primary);
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 15px;
  }
  
  .nav-tabs {
    flex-wrap: wrap;
  }
  
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
  
  
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style> 