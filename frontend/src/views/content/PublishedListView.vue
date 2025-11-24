<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<!--
  Copyright (c) 2024-2025
-->
<template>
  <BaseLayout :is-authenticated="isAuthenticated" :identities="identities" :token-balances="tokenBalances" :is-loading-tokens="isLoadingTokens" @auth-action-completed="$emit('auth-action-completed')">
    <div class="docs-page">
      <!-- Заголовок страницы -->
      <div class="docs-header">
        <div class="header-content">
          <h1>Публичные документы</h1>
        </div>
        <button class="close-btn" @click="goBack" title="Закрыть">×</button>
      </div>

      <!-- Основной контент: сайдбар + контент -->
      <div class="docs-layout">
        <!-- Сайдбар навигации -->
        <DocsSidebar :current-page-id="currentPageId" />

        <!-- Основной контент -->
        <div class="docs-main">
          <!-- Если выбран документ - показываем его -->
          <DocsContent v-if="currentPageId" :page-id="currentPageId" @back="goToIndex" />

          <!-- Иначе показываем список документов по категориям -->
          <div v-else class="docs-index">
            <div v-if="isLoading" class="loading-state">
              <div class="loading-spinner"></div>
              <p>Загрузка документов...</p>
            </div>

            <div v-else-if="groupedPages.length === 0" class="empty-state">
              <div class="empty-icon"><i class="fas fa-file-alt"></i></div>
              <h3>Нет опубликованных документов</h3>
            </div>

            <div v-else class="categories-view">
              <div
                v-for="category in groupedPages"
                :key="category.name"
                class="category-section"
              >
                <h2 class="category-title">
                  <i class="fas fa-folder"></i>
                  {{ formatCategoryName(category.name) }}
                </h2>
                <div class="pages-grid">
                  <div
                    v-for="page in category.pages"
                    :key="page.id"
                    class="page-card"
                    @click="openPublic(page.id)"
                  >
                    <div class="page-card-header">
                      <h3>{{ page.title }}</h3>
                      <div class="page-card-badges">
                        <span v-if="page.is_index_page" class="index-badge">Главная</span>
                        <div v-if="canManageDocs" class="page-card-actions">
                          <button
                            class="page-action-btn page-edit-btn"
                            @click.stop="editPage(page.id)"
                            title="Редактировать документ"
                          >
                            <i class="fas fa-edit"></i>
                          </button>
                          <button
                            class="page-action-btn page-structure-btn"
                            @click.stop="editPageStructure(page)"
                            title="Изменить структуру"
                          >
                            <i class="fas fa-cog"></i>
                          </button>
                          <button
                            class="page-action-btn page-delete-btn"
                            @click.stop="confirmDeletePage(page)"
                            title="Удалить документ"
                          >
                            <i class="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                    <div class="page-card-content">
                      <p class="page-summary">{{ page.summary || 'Без описания' }}</p>
                      <div class="page-meta">
                        <span class="page-date">
                          <i class="fas fa-calendar"></i>
                          {{ formatDate(page.created_at) }}
                        </span>
                        <span v-if="page.category" class="page-category">
                          <i class="fas fa-folder"></i>
                          {{ formatCategoryName(page.category) }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно редактирования структуры документа -->
    <div v-if="showEditPageModal && editingPage" class="modal-overlay" @click="showEditPageModal = false">
      <div class="modal-content modal-large" @click.stop>
        <div class="modal-header">
          <h3>Изменить структуру документа</h3>
          <button class="modal-close" @click="showEditPageModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Документ:</label>
            <div class="form-readonly">{{ editingPage.title }}</div>
          </div>
          <div class="form-group">
            <label>Родительский документ:</label>
            <select v-model="editingPage.parent_id" class="form-input">
              <option :value="null">Нет (корневой документ)</option>
              <option
                v-for="parent in availableParents"
                :key="parent.id"
                :value="parent.id"
              >
                {{ parent.title }}
              </option>
            </select>
            <small class="form-hint">Выберите родительский документ для создания иерархии. Доступны только документы той же категории.</small>
          </div>
          <div class="form-group">
            <label>Категория:</label>
            <input
              v-model="editingPage.category"
              type="text"
              class="form-input"
              placeholder="Введите название категории или выберите из списка"
              list="categories-list"
            />
            <datalist id="categories-list">
              <option
                v-for="cat in allCategories"
                :key="cat"
                :value="cat"
              >
                {{ formatCategoryName(cat) }}
              </option>
            </datalist>
            <small class="form-hint">Категория создается автоматически при сохранении. Можно ввести новую или выбрать существующую.</small>
          </div>
          <div class="form-group">
            <label>Порядок сортировки:</label>
            <input
              v-model.number="editingPage.order_index"
              type="number"
              min="0"
              class="form-input"
              placeholder="0"
            />
            <small class="form-hint">Чем меньше число, тем выше документ в списке категории.</small>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input
                v-model="editingPage.is_index_page"
                type="checkbox"
                class="form-checkbox"
              />
              Главная страница категории
            </label>
            <small class="form-hint">Если отмечено, этот документ будет главной страницей категории.</small>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showEditPageModal = false">Отмена</button>
          <button class="btn btn-primary" @click="savePageStructure" :disabled="isSaving">
            {{ isSaving ? 'Сохранение...' : 'Сохранить' }}
          </button>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import DocsSidebar from '../../components/docs/DocsSidebar.vue';
import DocsContent from '../../components/docs/DocsContent.vue';
import pagesService from '../../services/pagesService';
import { usePermissions } from '../../composables/usePermissions';
import { PERMISSIONS } from '../../composables/permissions';

const props = defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});

const router = useRouter();
const route = useRoute();
const { hasPermission } = usePermissions();

const canManageDocs = computed(() => hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS));

const pages = ref([]);
const isLoading = ref(false);
const showEditPageModal = ref(false);
const editingPage = ref(null);
const isSaving = ref(false);
const allCategories = ref([]);
const currentPageId = computed(() => {
  // Получаем ID из query параметра или из маршрута
  const queryPage = route.query.page;
  if (queryPage) {
    const pageId = typeof queryPage === 'string' ? parseInt(queryPage, 10) : queryPage;
    if (!isNaN(pageId)) {
      console.log('[PublishedListView] currentPageId computed: найдено в query.page:', pageId);
      return pageId;
    }
  }
  if (route.name === 'public-page-view' && route.params.id) {
    const pageId = typeof route.params.id === 'string' ? parseInt(route.params.id, 10) : route.params.id;
    if (!isNaN(pageId)) {
      console.log('[PublishedListView] currentPageId computed: найдено в params.id:', pageId);
      return pageId;
    }
  }
  console.log('[PublishedListView] currentPageId computed: возвращаем null');
  return null;
});

function goBack() {
  router.push({ name: 'content-list' });
}

function openPublic(id) {
  console.log('[PublishedListView] openPublic вызвана с id:', id);
  // Обновляем URL без перехода на другую страницу
  router.push({ name: 'content-published', query: { page: id } }).catch(err => {
    console.error('[PublishedListView] Ошибка навигации:', err);
  });
}

function goToIndex() {
  router.push({ name: 'content-published' });
}

// Редактирование документа
function editPage(id) {
  router.push({ name: 'content-create', query: { edit: id } });
}

// Подтверждение удаления документа
async function confirmDeletePage(page) {
  if (!confirm(`Вы уверены, что хотите удалить документ "${page.title}"?\n\nЭто действие нельзя отменить.`)) {
    return;
  }
  
  try {
    console.log('[PublishedListView] Удаление документа:', page.id);
    await pagesService.deletePage(page.id);
    console.log('[PublishedListView] Документ успешно удален');
    
    // Перезагружаем страницы
    await loadPages();
    
    // Обновляем структуру в сайдбаре
    window.dispatchEvent(new CustomEvent('docs-structure-updated'));
    
    // Если удалили текущий открытый документ, возвращаемся к списку
    if (currentPageId.value === page.id) {
      goToIndex();
    }
  } catch (error) {
    console.error('[PublishedListView] Ошибка удаления документа:', error);
    alert('Ошибка удаления: ' + (error.response?.data?.error || error.message || 'Неизвестная ошибка'));
  }
}

function formatCategoryName(name) {
  if (name === 'uncategorized') return 'Без категории';
  // Преобразуем только первую букву в заглавную, остальные оставляем как есть
  if (!name || name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Группировка страниц по категориям
const groupedPages = computed(() => {
  console.log('[PublishedListView] groupedPages computed: pages.value.length =', pages.value?.length);
  
  const groups = {};
  
  if (!Array.isArray(pages.value)) {
    console.warn('[PublishedListView] pages.value is not an array:', pages.value);
    return [];
  }
  
  if (pages.value.length === 0) {
    console.log('[PublishedListView] pages.value пустой массив');
    return [];
  }
  
  pages.value.forEach(page => {
    // Нормализуем категорию: приводим к нижнему регистру для консистентности
    let category = 'uncategorized';
    if (page.category && page.category.trim()) {
      category = page.category.trim().toLowerCase();
    }
    
    if (!groups[category]) {
      groups[category] = {
        name: category,
        pages: []
      };
    }
    groups[category].pages.push(page);
  });

  // Сортируем страницы в каждой категории: сначала родительские (с детьми), потом остальные
  Object.values(groups).forEach(group => {
    group.pages.sort((a, b) => {
      // Сначала документы с детьми (родительские)
      const aHasChildren = a.children && Array.isArray(a.children) && a.children.length > 0;
      const bHasChildren = b.children && Array.isArray(b.children) && b.children.length > 0;
      
      if (aHasChildren && !bHasChildren) return -1;
      if (!aHasChildren && bHasChildren) return 1;
      
      // Если оба с детьми или оба без детей, сортируем по order_index и created_at
      if (a.order_index !== b.order_index) {
        return (a.order_index || 0) - (b.order_index || 0);
      }
      return new Date(a.created_at) - new Date(b.created_at);
    });
  });

  const result = Object.values(groups);
  console.log('[PublishedListView] groupedPages result:', result.length, 'categories, всего страниц:', pages.value.length);
  result.forEach(group => {
    console.log(`  - ${group.name}: ${group.pages.length} страниц`);
  });
  return result;
});

// Редактирование структуры документа
function editPageStructure(page) {
  editingPage.value = {
    id: page.id,
    title: page.title,
    category: page.category || null,
    parent_id: page.parent_id || null,
    order_index: page.order_index || 0,
    is_index_page: page.is_index_page || false
  };
  
  // Загружаем список категорий
  loadCategories();
  showEditPageModal.value = true;
}

// Загрузка категорий
async function loadCategories() {
  try {
    // Используем новый endpoint для получения списка категорий
    const categories = await pagesService.getCategories();
    allCategories.value = Array.isArray(categories) ? categories : [];
    console.log('[PublishedListView] Загружено категорий:', allCategories.value.length);
  } catch (error) {
    console.error('[PublishedListView] Ошибка загрузки категорий:', error);
    // Fallback: пытаемся получить категории из структуры
    try {
      const structure = await pagesService.getPublicPagesStructure();
      allCategories.value = structure.categories ? structure.categories.map(cat => cat.name) : [];
    } catch (fallbackError) {
      console.error('[PublishedListView] Ошибка fallback загрузки категорий:', fallbackError);
      allCategories.value = [];
    }
  }
}

// Доступные родительские документы
const availableParents = computed(() => {
  if (!editingPage.value) return [];
  return pages.value.filter(page => 
    page.id !== editingPage.value.id && 
    page.category === editingPage.value.category &&
    page.visibility === 'public' &&
    page.status === 'published'
  );
});

// Сохранение структуры документа
async function savePageStructure() {
  if (!editingPage.value) return;
  
  try {
    isSaving.value = true;
    
    // Нормализуем категорию (приводим к нижнему регистру)
    const category = editingPage.value.category 
      ? editingPage.value.category.trim().toLowerCase() 
      : null;
    
    const updateData = {
      category: category,
      parent_id: editingPage.value.parent_id || null,
      order_index: editingPage.value.order_index || 0,
      is_index_page: editingPage.value.is_index_page || false
    };
    
    console.log('[PublishedListView] Сохранение структуры:', {
      id: editingPage.value.id,
      updateData: updateData,
      originalEditingPage: { ...editingPage.value }
    });
    
    // Сохраняем данные страницы
    const response = await pagesService.updatePage(editingPage.value.id, updateData);
    
    console.log('[PublishedListView] Структура успешно сохранена, ответ от сервера:', {
      id: response.id,
      category: response.category,
      parent_id: response.parent_id,
      order_index: response.order_index,
      is_index_page: response.is_index_page
    });
    
    // Закрываем модальное окно сразу после успешного сохранения
    const savedPageId = editingPage.value.id;
    showEditPageModal.value = false;
    editingPage.value = null;
    isSaving.value = false;
    
    // Перезагружаем страницы и категории в фоне (не блокируем закрытие модального окна)
    Promise.all([
      loadPages(),
      loadCategories() // Обновляем список категорий
    ]).catch(err => {
      console.error('[PublishedListView] Ошибка перезагрузки данных после сохранения:', err);
    });
    
    // Обновляем структуру в сайдбаре через событие
    console.log('[PublishedListView] Отправляю событие docs-structure-updated для обновления сайдбара');
    window.dispatchEvent(new CustomEvent('docs-structure-updated'));
    
  } catch (error) {
    console.error('[PublishedListView] Ошибка сохранения структуры:', error);
    alert('Ошибка сохранения: ' + (error.response?.data?.error || error.message || 'Неизвестная ошибка'));
    // НЕ очищаем pages.value при ошибке - оставляем текущие данные
    isSaving.value = false;
  }
}

async function loadPages() {
  try {
    isLoading.value = true;
    console.log('[PublishedListView] Начало загрузки страниц...');
    const loadedPages = await pagesService.getPublicPages();
    console.log('[PublishedListView] Загружено страниц:', loadedPages?.length || 0);
    
    // Проверяем, что ответ является массивом
    if (!Array.isArray(loadedPages)) {
      console.error('[PublishedListView] loadedPages не является массивом:', typeof loadedPages, loadedPages);
      // Если это объект с ошибкой, логируем её
      if (loadedPages && typeof loadedPages === 'object' && loadedPages.error) {
        console.error('[PublishedListView] Ошибка от API:', loadedPages.error);
      }
      // НЕ очищаем pages.value - оставляем предыдущие данные
      return;
    }
    
    // Если массив пустой, это нормально - просто нет документов
    if (loadedPages.length > 0) {
      console.log('[PublishedListView] Примеры страниц:', loadedPages.slice(0, 3).map(p => ({ id: p.id, title: p.title, category: p.category })));
      pages.value = loadedPages;
    } else {
      console.log('[PublishedListView] Получен пустой массив - нет опубликованных документов');
      // Очищаем только если массив действительно пустой (это нормальная ситуация)
      pages.value = [];
    }
  } catch (e) {
    console.error('[PublishedListView] Ошибка загрузки страниц:', e);
    // НЕ очищаем pages.value при ошибке - оставляем предыдущие данные
    // pages.value = [];
  } finally {
    isLoading.value = false;
  }
}

onMounted(async () => {
  await loadPages();
  if (canManageDocs.value) {
    await loadCategories();
  }
  
  // Слушаем обновления структуры
  window.addEventListener('docs-structure-updated', loadPages);
});

onBeforeUnmount(() => {
  window.removeEventListener('docs-structure-updated', loadPages);
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
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px;
  border-bottom: 2px solid #e9ecef;
  background: #fff;
  flex-shrink: 0;
}

.header-content h1 {
  color: var(--color-primary);
  font-size: 2rem;
  margin: 0 0 8px 0;
  font-weight: 700;
}

.header-content p {
  color: #6c757d;
  margin: 0;
  font-size: 1rem;
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

.docs-index {
  padding: 40px;
  max-width: 1200px;
  margin: 0 auto;
}

.loading-state,
.empty-state {
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

.empty-icon {
  font-size: 3rem;
  color: #6c757d;
  margin-bottom: 16px;
}

.empty-state h3 {
  color: var(--color-primary);
  margin: 0;
}

.categories-view {
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.category-section {
  margin-bottom: 32px;
}

.category-title {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--color-primary);
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 20px 0;
  padding-bottom: 12px;
  border-bottom: 2px solid #e9ecef;
}

.category-title i {
  font-size: 1.25rem;
}

.pages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.page-card {
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.page-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
  border-color: var(--color-primary);
}

.page-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.page-card-header h3 {
  margin: 0;
  color: var(--color-primary);
  font-size: 1.2rem;
  font-weight: 600;
  flex: 1;
}

.index-badge {
  font-size: 0.75rem;
  background: var(--color-primary);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
  margin-left: 8px;
}

.page-card-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-summary {
  color: #6c757d;
  margin: 0;
  line-height: 1.5;
  font-size: 0.95rem;
}

.page-meta {
  display: flex;
  gap: 16px;
  font-size: 0.85rem;
  color: #6c757d;
  align-items: center;
}

.page-date {
  display: flex;
  align-items: center;
  gap: 6px;
}

.page-date i {
  font-size: 0.8rem;
}

@media (max-width: 1024px) {
  .docs-layout {
    flex-direction: column;
  }

  .docs-main {
    overflow-y: visible;
  }
}

.page-card-badges {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-card-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.page-action-btn {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  color: #6c757d;
  transition: all 0.2s;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-action-btn:hover {
  border-color: var(--color-primary);
}

.page-edit-btn:hover {
  background: #e7f3ff;
  color: var(--color-primary);
}

.page-structure-btn:hover {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.page-delete-btn:hover {
  background: #fee;
  color: #dc3545;
  border-color: #dc3545;
}

.page-category {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
}

/* Модальные окна */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content.modal-large {
  max-width: 600px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
}

.modal-header h3 {
  margin: 0;
  color: var(--color-primary);
  font-size: 1.25rem;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #6c757d;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.modal-close:hover {
  background: #f0f0f0;
  color: #333;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #495057;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-readonly {
  padding: 10px 12px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  color: #495057;
  font-weight: 500;
}

.form-checkbox {
  margin-right: 8px;
}

.form-hint {
  display: block;
  margin-top: 6px;
  font-size: 0.85rem;
  color: #6c757d;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #e9ecef;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn-secondary {
  background: #f8f9fa;
  color: #495057;
  border: 1px solid #e9ecef;
}

.btn-secondary:hover {
  background: #e9ecef;
}

@media (max-width: 768px) {
  .docs-header {
    padding: 16px;
  }

  .header-content h1 {
    font-size: 1.5rem;
  }

  .docs-index {
    padding: 20px;
  }

  .pages-grid {
    grid-template-columns: 1fr;
  }

  .category-title {
    font-size: 1.25rem;
  }

  .modal-content {
    max-width: 100%;
    margin: 10px;
  }
}
</style>


