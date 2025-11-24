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
  <aside class="docs-sidebar">
    <div class="sidebar-header" v-if="canManageDocs">
      <div class="sidebar-header-buttons">
        <button
          class="create-category-btn"
          @click="showCreateCategoryModal = true"
          title="Создать новый раздел"
        >
          <i class="fas fa-plus"></i>
          <span>Создать раздел</span>
        </button>
        <button
          class="edit-category-btn"
          @click="showEditCategoryModal = true"
          title="Редактировать раздел"
        >
          <i class="fas fa-edit"></i>
          <span>Редактировать раздел</span>
        </button>
        <button
          class="delete-category-btn"
          @click="openDeleteCategoryModal"
          title="Удалить раздел"
        >
          <i class="fas fa-trash"></i>
          <span>Удалить раздел</span>
        </button>
      </div>
    </div>

    <nav class="sidebar-nav">
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Загрузка...</p>
      </div>

      <div v-else-if="!structure.categories || structure.categories.length === 0" class="empty-state">
        <p>Нет документов</p>
      </div>

      <div v-else class="categories-list">
        <template v-for="category in structure.categories" :key="category.name">
        <div
          v-if="category"
          class="category-group"
        >
          <div
            class="category-header"
            @click="toggleCategory(category.name)"
          >
            <i
              :class="[
                'fas',
                expandedCategories[category.name] ? 'fa-chevron-down' : 'fa-chevron-right',
                'category-icon'
              ]"
            ></i>
            <span class="category-name">{{ formatCategoryName(category.name) }}</span>
            <span class="category-count">({{ getCategoryPageCount(category) }})</span>
            <div
              v-if="canManageDocs"
              class="category-actions"
              @click.stop
            >
              <button
                class="category-action-btn"
                @click="editCategory(category.name)"
                title="Редактировать раздел"
              >
                <i class="fas fa-edit"></i>
              </button>
            </div>
          </div>

          <transition name="slide">
            <div
              v-if="expandedCategories[category.name]"
              class="category-pages"
            >
              <template v-for="page in category.pages" :key="page.id">
                <div class="nav-link-wrapper">
                  <a
                    :href="`/content/published?page=${page.id}`"
                    :class="['nav-link', { active: currentPageId === page.id }]"
                    @click.prevent="navigateToPage(page.id)"
                  >
                    <span class="nav-link-text">{{ page.title }}</span>
                    <span v-if="page.is_index_page" class="nav-link-badge">Главная</span>
                  </a>
                  <button
                    v-if="canManageDocs"
                    class="nav-link-edit-btn"
                    @click.stop="editPageStructure(page)"
                    title="Изменить структуру"
                  >
                    <i class="fas fa-cog"></i>
                  </button>
                </div>

                <!-- Вложенные страницы (children) -->
                <div
                  v-if="page && page.children && page.children.length > 0"
                  class="nav-children"
                >
                  <a
                    v-for="child in page.children"
                    :key="child.id"
                    :href="`/content/published?page=${child.id}`"
                    :class="['nav-link', 'nav-link-child', { active: currentPageId === child.id }]"
                    @click.prevent="navigateToPage(child.id)"
                  >
                    <span class="nav-link-text">{{ child.title }}</span>
                  </a>
                </div>
              </template>
            </div>
          </transition>
        </div>
        </template>
      </div>
    </nav>

    <!-- Модальное окно создания категории -->
    <div v-if="showCreateCategoryModal" class="modal-overlay" @click="showCreateCategoryModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Создать новый раздел</h3>
          <button class="modal-close" @click="showCreateCategoryModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Название раздела:</label>
            <input
              v-model="newCategoryName"
              type="text"
              placeholder="Например: Руководства, API, FAQ"
              class="form-input"
              @keyup.enter="createCategory"
            />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreateCategoryModal = false">Отмена</button>
          <button class="btn btn-primary" @click="createCategory" :disabled="!newCategoryName.trim()">
            Создать
          </button>
        </div>
      </div>
    </div>

    <!-- Модальное окно редактирования категории -->
    <div v-if="showEditCategoryModal" class="modal-overlay" @click="showEditCategoryModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Редактировать раздел</h3>
          <button class="modal-close" @click="showEditCategoryModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Выберите раздел для редактирования:</label>
            <select
              v-model="editingCategoryName"
              class="form-input"
              @change="onCategorySelect"
            >
              <option value="">-- Выберите раздел --</option>
              <option
                v-for="cat in availableCategoriesForEdit"
                :key="cat"
                :value="cat"
              >
                {{ formatCategoryName(cat) }}
              </option>
            </select>
          </div>
          <div v-if="editingCategoryName" class="form-group">
            <label>Новое название раздела:</label>
            <input
              v-model="newCategoryNameForEdit"
              type="text"
              :placeholder="`Текущее название: ${formatCategoryName(editingCategoryName)}`"
              class="form-input"
              @keyup.enter="saveCategoryEdit"
            />
            <small class="form-hint">Все документы в этом разделе будут переименованы</small>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showEditCategoryModal = false">Отмена</button>
          <button 
            class="btn btn-primary" 
            @click="saveCategoryEdit" 
            :disabled="!editingCategoryName || !newCategoryNameForEdit.trim() || isSavingCategory"
          >
            {{ isSavingCategory ? 'Сохранение...' : 'Сохранить' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Модальное окно удаления категории -->
    <div v-if="showDeleteCategoryModal" class="modal-overlay" @click="showDeleteCategoryModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Удалить раздел</h3>
          <button class="modal-close" @click="showDeleteCategoryModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Выберите раздел для удаления:</label>
            <select
              v-model="deletingCategoryName"
              class="form-input"
              :disabled="isDeletingCategory"
            >
              <option value="">-- Выберите раздел --</option>
              <option
                v-for="cat in availableCategoriesForEdit"
                :key="cat"
                :value="cat"
              >
                {{ formatCategoryName(cat) }}
              </option>
            </select>
            <div v-if="availableCategoriesForEdit.length === 0" class="form-hint">
              Нет доступных разделов для удаления
            </div>
          </div>
          <div v-if="deletingCategoryName && deletingCategoryName.trim()" class="form-group">
            <div class="alert alert-warning">
              <strong>Внимание!</strong> Все документы в разделе "{{ formatCategoryName(deletingCategoryName) }}" будут перемещены в категорию "Без категории".
            </div>
            <div v-if="getCategoryPageCountByName(deletingCategoryName) > 0" class="form-hint">
              В этом разделе {{ getCategoryPageCountByName(deletingCategoryName) }} {{ getCategoryPageCountByName(deletingCategoryName) === 1 ? 'документ' : 'документов' }}.
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showDeleteCategoryModal = false">Отмена</button>
          <button 
            class="btn btn-danger" 
            @click="deleteCategory" 
            :disabled="!deletingCategoryName || !deletingCategoryName.trim() || isDeletingCategory"
          >
            {{ isDeletingCategory ? 'Удаление...' : 'Удалить раздел' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Модальное окно редактирования структуры документа -->
    <div v-if="showEditPageModal" class="modal-overlay" @click="showEditPageModal = false">
      <div class="modal-content modal-large" @click.stop>
        <div class="modal-header">
          <h3>Изменить структуру документа</h3>
          <button class="modal-close" @click="showEditPageModal = false">×</button>
        </div>
        <div class="modal-body">
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
          </div>
          <div class="form-group">
            <label>
              <input
                v-model="editingPage.is_index_page"
                type="checkbox"
                class="form-checkbox"
              />
              Главная страница категории
            </label>
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
  </aside>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import pagesService from '../../services/pagesService';
import { usePermissions } from '../../composables/usePermissions';
import { PERMISSIONS } from '../../composables/permissions';
import api from '../../api/axios';

const props = defineProps({
  currentPageId: {
    type: Number,
    default: null
  }
});

const router = useRouter();
const route = useRoute();
const { hasPermission } = usePermissions();

const canManageDocs = computed(() => hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS));

const structure = ref({ categories: [] });
const allPages = ref([]);
const isLoading = ref(false);
const expandedCategories = ref({});

// Модальные окна
const showCreateCategoryModal = ref(false);
const showEditCategoryModal = ref(false);
const showDeleteCategoryModal = ref(false);
const showEditPageModal = ref(false);
const newCategoryName = ref('');
const editingCategoryName = ref('');
const newCategoryNameForEdit = ref('');
const deletingCategoryName = ref('');
const editingPage = ref(null);
const isSaving = ref(false);
const isSavingCategory = ref(false);
const isDeletingCategory = ref(false);

// Загрузка структуры
async function loadStructure() {
  try {
    isLoading.value = true;
    const data = await pagesService.getPublicPagesStructure();
    
    console.log('[DocsSidebar] loadStructure response:', {
      hasData: !!data,
      categoriesCount: Array.isArray(data?.categories) ? data.categories.length : 0,
      totalPages: data?.totalPages || 0,
      categories: data?.categories
    });
    
    // Убеждаемся, что структура правильно инициализирована
    // Backend уже включает пустые категории из таблицы document_categories
    structure.value = {
      categories: Array.isArray(data?.categories) ? data.categories : [],
      totalPages: data?.totalPages || 0
    };
    
    // Сортируем страницы в каждой категории: сначала родительские (с детьми), потом остальные
    if (structure.value.categories && Array.isArray(structure.value.categories)) {
      structure.value.categories.forEach(cat => {
        if (cat && cat.pages && Array.isArray(cat.pages)) {
          // Логируем порядок ДО сортировки
          console.log(`[DocsSidebar] Категория "${cat.name}": порядок ДО сортировки:`, 
            cat.pages.map(p => ({
              id: p.id,
              title: p.title,
              hasChildren: p.children && Array.isArray(p.children) && p.children.length > 0,
              childrenCount: p.children ? p.children.length : 0
            }))
          );
          
          cat.pages.sort((a, b) => {
            // Сначала документы с детьми (родительские)
            const aHasChildren = a.children && Array.isArray(a.children) && a.children.length > 0;
            const bHasChildren = b.children && Array.isArray(b.children) && b.children.length > 0;
            
            // Если a имеет детей, а b нет - a идет первым (отрицательное значение = a перед b)
            if (aHasChildren && !bHasChildren) return -1;
            // Если b имеет детей, а a нет - b идет первым (положительное значение = b перед a)
            if (!aHasChildren && bHasChildren) return 1;
            
            // Если оба с детьми или оба без детей, сортируем по order_index и created_at
            if (a.order_index !== b.order_index) {
              return (a.order_index || 0) - (b.order_index || 0);
            }
            return new Date(a.created_at) - new Date(b.created_at);
          });
          
          // Логируем порядок ПОСЛЕ сортировки
          console.log(`[DocsSidebar] Категория "${cat.name}": порядок ПОСЛЕ сортировки:`, 
            cat.pages.map(p => ({
              id: p.id,
              title: p.title,
              hasChildren: p.children && Array.isArray(p.children) && p.children.length > 0,
              childrenCount: p.children ? p.children.length : 0
            }))
          );
        }
      });
    }
    
    console.log('[DocsSidebar] structure.value после инициализации:', {
      categoriesCount: structure.value.categories.length,
      totalPages: structure.value.totalPages,
      categories: structure.value.categories.map(cat => ({
        name: cat.name,
        pagesCount: cat.pages ? cat.pages.length : 0,
        hasPages: cat.pages && Array.isArray(cat.pages) && cat.pages.length > 0
      }))
    });
    
    // Загружаем все страницы для выбора родителя
    if (canManageDocs.value) {
      allPages.value = await pagesService.getPublicPages();
      console.log('[DocsSidebar] allPages загружено:', allPages.value?.length || 0);
    }
    
    // По умолчанию раскрываем все категории
    if (structure.value.categories && Array.isArray(structure.value.categories)) {
      structure.value.categories.forEach(cat => {
        if (cat && cat.name) {
          expandedCategories.value[cat.name] = true;
        }
      });
    }
  } catch (error) {
    console.error('[DocsSidebar] Ошибка загрузки структуры:', error);
    // НЕ очищаем structure.value при ошибке - оставляем предыдущие данные
    // structure.value = { categories: [], totalPages: 0 };
    // Только если структура еще не была загружена, устанавливаем пустое значение
    if (!structure.value || !structure.value.categories || structure.value.categories.length === 0) {
      structure.value = { categories: [], totalPages: 0 };
    }
  } finally {
    isLoading.value = false;
  }
}

// Список всех категорий (загружается из API)
const allCategoriesList = ref([]);

// Загрузка категорий из API
async function loadCategoriesList() {
  try {
    const categories = await pagesService.getCategories();
    allCategoriesList.value = Array.isArray(categories) ? categories : [];
    console.log('[DocsSidebar] Загружено категорий из API:', allCategoriesList.value.length);
  } catch (error) {
    console.error('[DocsSidebar] Ошибка загрузки категорий из API:', error);
    // Fallback: собираем категории из структуры
    const categories = new Set();
    if (structure.value.categories && Array.isArray(structure.value.categories)) {
      structure.value.categories.forEach(cat => {
        if (cat && cat.name) {
          categories.add(cat.name.toLowerCase().trim());
        }
      });
    }
    if (allPages.value && Array.isArray(allPages.value)) {
      allPages.value.forEach(page => {
        if (page.category && page.category.trim()) {
          categories.add(page.category.trim().toLowerCase());
        }
      });
    }
    allCategoriesList.value = Array.from(categories).sort();
  }
}

// Список всех категорий (нормализованный) - объединяем из API и структуры
const allCategories = computed(() => {
  const categories = new Set();
  
  // Добавляем категории из API (приоритет)
  if (allCategoriesList.value && Array.isArray(allCategoriesList.value)) {
    allCategoriesList.value.forEach(cat => {
      if (cat && typeof cat === 'string') {
        categories.add(cat.toLowerCase().trim());
      }
    });
  }
  
  // Добавляем категории из структуры (уже нормализованы в backend)
  if (structure.value.categories && Array.isArray(structure.value.categories)) {
    structure.value.categories.forEach(cat => {
      if (cat && cat.name) {
        // Нормализуем к нижнему регистру для консистентности
        categories.add(cat.name.toLowerCase().trim());
      }
    });
  }
  
  // Добавляем категории из всех страниц (нормализуем)
  if (allPages.value && Array.isArray(allPages.value)) {
    allPages.value.forEach(page => {
      if (page.category && page.category.trim()) {
        // Нормализуем к нижнему регистру для консистентности
        categories.add(page.category.trim().toLowerCase());
      }
    });
  }
  
  return Array.from(categories).sort();
});

// Список категорий для редактирования (исключаем 'uncategorized')
const availableCategoriesForEdit = computed(() => {
  return allCategories.value.filter(cat => cat !== 'uncategorized');
});

// Обработка выбора категории для редактирования
function onCategorySelect() {
  if (editingCategoryName.value) {
    newCategoryNameForEdit.value = formatCategoryName(editingCategoryName.value);
  } else {
    newCategoryNameForEdit.value = '';
  }
}

// Сохранение изменений категории
async function saveCategoryEdit() {
  if (!editingCategoryName.value || !newCategoryNameForEdit.value.trim()) return;
  
  const oldCategoryName = editingCategoryName.value.toLowerCase();
  const newCategoryName = newCategoryNameForEdit.value.trim().toLowerCase();
  
  if (oldCategoryName === newCategoryName) {
    alert('Новое название должно отличаться от текущего');
    return;
  }
  
  try {
    isSavingCategory.value = true;
    
    console.log('[DocsSidebar] Переименование категории:', {
      old: oldCategoryName,
      new: newCategoryName
    });
    
    // Находим все документы в старой категории
    const pagesToUpdate = allPages.value.filter(page => 
      page.category && page.category.toLowerCase() === oldCategoryName
    );
    
    console.log('[DocsSidebar] Найдено документов для обновления:', pagesToUpdate.length);
    
    // Обновляем категорию у всех документов (если есть)
    if (pagesToUpdate.length > 0) {
      const updatePromises = pagesToUpdate.map(page => 
        pagesService.updatePage(page.id, {
          category: newCategoryName
        })
      );
      
      await Promise.all(updatePromises);
    }
    
    // Если документов нет, но категория существует в document_categories,
    // нужно обновить её там. Для этого удаляем старую и создаем новую.
    if (pagesToUpdate.length === 0) {
      try {
        // Пытаемся удалить старую категорию
        await pagesService.deleteCategory(oldCategoryName);
        console.log('[DocsSidebar] Старая категория удалена из document_categories');
        
        // Создаем новую категорию с новым именем
        await pagesService.createCategory(
          newCategoryName,
          newCategoryNameForEdit.value.trim(), // display_name с сохранением регистра
          null, // description
          0 // order_index
        );
        console.log('[DocsSidebar] Новая категория создана в document_categories');
      } catch (error) {
        console.warn('[DocsSidebar] Не удалось обновить категорию в document_categories (возможно, категория существует только в документах):', error);
        // Игнорируем ошибку, так как категория может существовать только в документах
      }
    }
    
    console.log('[DocsSidebar] Категория успешно переименована');
    
    // Закрываем модальное окно
    showEditCategoryModal.value = false;
    editingCategoryName.value = '';
    newCategoryNameForEdit.value = '';
    
    // Перезагружаем структуру
    await Promise.all([
      loadStructure(),
      loadCategoriesList() // Обновляем список категорий
    ]);
    
    // Уведомляем другие компоненты об обновлении
    window.dispatchEvent(new CustomEvent('docs-structure-updated'));
    
    if (pagesToUpdate.length > 0) {
      alert(`Раздел успешно переименован. Обновлено документов: ${pagesToUpdate.length}`);
    } else {
      alert(`Раздел успешно переименован. В разделе не было документов.`);
    }
    
  } catch (error) {
    console.error('[DocsSidebar] Ошибка переименования категории:', error);
    alert('Ошибка переименования раздела: ' + (error.response?.data?.error || error.message || 'Неизвестная ошибка'));
  } finally {
    isSavingCategory.value = false;
  }
}

// Доступные родительские документы
const availableParents = computed(() => {
  if (!editingPage.value) return [];
  return allPages.value.filter(page => 
    page.id !== editingPage.value.id && 
    page.category === editingPage.value.category
  );
});

// Создание категории
async function createCategory() {
  if (!newCategoryName.value.trim()) return;
  
  try {
    const categoryName = newCategoryName.value.trim();
    const categoryNameLower = categoryName.toLowerCase();
    
    console.log('[DocsSidebar] Создание категории:', categoryName);
    
    // Проверяем, не существует ли уже категория с таким названием
    const existingCategory = structure.value.categories?.find(
      cat => cat.name && cat.name.toLowerCase() === categoryNameLower
    );
    
    if (existingCategory) {
      alert(`Раздел "${formatCategoryName(categoryName)}" уже существует. Выберите другое название.`);
      return;
    }
    
    // Создаем категорию в базе данных через API
    await pagesService.createCategory(categoryNameLower, categoryName, null, 0);
    
    console.log('[DocsSidebar] Категория создана в БД:', categoryNameLower);
    
    // Закрываем модальное окно
    showCreateCategoryModal.value = false;
    newCategoryName.value = '';
    
    // Перезагружаем структуру, чтобы новая категория появилась
    await loadStructure();
    
    // Раскрываем новую категорию по умолчанию
    expandedCategories.value[categoryNameLower] = true;
    
    // Уведомляем другие компоненты об обновлении
    window.dispatchEvent(new CustomEvent('docs-structure-updated'));
    
    alert(`Раздел "${categoryName}" успешно создан. Теперь вы можете добавлять в него документы, назначив им эту категорию.`);
    
  } catch (error) {
    console.error('[DocsSidebar] Ошибка создания категории:', error);
    alert('Ошибка создания раздела: ' + (error.response?.data?.error || error.message || 'Неизвестная ошибка'));
  }
}

// Редактирование категории
function editCategory(categoryName) {
  // Показываем список документов этой категории для редактирования
  // Можно открыть модальное окно с документами категории
  alert(`Редактирование категории "${formatCategoryName(categoryName)}". Выберите документ для изменения его структуры.`);
}

// Открытие модального окна удаления категории
function openDeleteCategoryModal() {
  deletingCategoryName.value = ''; // Сбрасываем выбранную категорию
  showDeleteCategoryModal.value = true;
  console.log('[DocsSidebar] Открыто модальное окно удаления категории. Доступно категорий:', availableCategoriesForEdit.value.length);
  console.log('[DocsSidebar] Список категорий:', availableCategoriesForEdit.value);
}

// Получение количества документов в категории по имени
function getCategoryPageCountByName(categoryName) {
  if (!categoryName || !structure.value.categories) return 0;
  const category = structure.value.categories.find(cat => 
    cat.name && cat.name.toLowerCase() === categoryName.toLowerCase()
  );
  if (!category || !category.pages) return 0;
  
  // Считаем все документы, включая дочерние
  let count = category.pages.length;
  category.pages.forEach(page => {
    if (page.children && Array.isArray(page.children)) {
      count += page.children.length;
    }
  });
  return count;
}

// Удаление категории
async function deleteCategory() {
  if (!deletingCategoryName.value) return;
  
  const categoryName = deletingCategoryName.value.toLowerCase();
  
  if (categoryName === 'uncategorized') {
    alert('Нельзя удалить категорию "Без категории"');
    return;
  }
  
  try {
    isDeletingCategory.value = true;
    
    console.log('[DocsSidebar] Удаление категории:', categoryName);
    
    // Находим все документы в этой категории
    const pagesToUpdate = allPages.value.filter(page => 
      page.category && page.category.toLowerCase() === categoryName
    );
    
    console.log('[DocsSidebar] Найдено документов для перемещения:', pagesToUpdate.length);
    
    // Перемещаем все документы в категорию "uncategorized" (устанавливаем category = null)
    // Если документов нет, просто удаляем категорию
    if (pagesToUpdate.length > 0) {
      const updatePromises = pagesToUpdate.map(page => 
        pagesService.updatePage(page.id, {
          category: null // null означает uncategorized
        })
      );
      
      await Promise.all(updatePromises);
    }
    
    console.log('[DocsSidebar] Все документы перемещены в uncategorized');
    
    // Удаляем категорию из базы данных через API
    try {
      await pagesService.deleteCategory(categoryName);
      console.log('[DocsSidebar] Категория удалена из БД:', categoryName);
    } catch (error) {
      console.warn('[DocsSidebar] Ошибка удаления категории из БД (возможно, таблица не существует):', error);
      // Продолжаем выполнение, даже если таблица не существует
    }
    
    // Закрываем модальное окно
    showDeleteCategoryModal.value = false;
    deletingCategoryName.value = '';
    
    // Перезагружаем структуру
    await Promise.all([
      loadStructure(),
      loadCategoriesList() // Обновляем список категорий
    ]);
    
    // Уведомляем другие компоненты об обновлении
    window.dispatchEvent(new CustomEvent('docs-structure-updated'));
    
    if (pagesToUpdate.length > 0) {
      alert(`Раздел "${formatCategoryName(categoryName)}" успешно удален. Все документы (${pagesToUpdate.length}) перемещены в категорию "Без категории".`);
    } else {
      alert(`Раздел "${formatCategoryName(categoryName)}" успешно удален. В разделе не было документов.`);
    }
    
  } catch (error) {
    console.error('[DocsSidebar] Ошибка удаления категории:', error);
    alert('Ошибка удаления раздела: ' + (error.response?.data?.error || error.message || 'Неизвестная ошибка'));
  } finally {
    isDeletingCategory.value = false;
  }
}

// Редактирование структуры документа
async function editPageStructure(page) {
  editingPage.value = {
    id: page.id,
    title: page.title,
    category: page.category || null,
    parent_id: page.parent_id || null,
    order_index: page.order_index || 0,
    is_index_page: page.is_index_page || false
  };
  // Загружаем актуальный список категорий перед открытием модалки
  await loadCategoriesList();
  showEditPageModal.value = true;
}

// Сохранение структуры документа
async function savePageStructure() {
  if (!editingPage.value) return;
  
  try {
    isSaving.value = true;
    
    // Нормализуем категорию (приводим к нижнему регистру)
    const category = editingPage.value.category 
      ? editingPage.value.category.trim().toLowerCase() 
      : null;
    
    await pagesService.updatePage(editingPage.value.id, {
      category: category,
      parent_id: editingPage.value.parent_id || null,
      order_index: editingPage.value.order_index || 0,
      is_index_page: editingPage.value.is_index_page || false
    });
    
    const currentPageId = editingPage.value.id;
    showEditPageModal.value = false;
    editingPage.value = null;
    
    // Перезагружаем структуру и категории
    await Promise.all([
      loadStructure(),
      loadCategoriesList()
    ]);
    
    // Если редактируем текущую страницу, обновляем её
    if (props.currentPageId === currentPageId) {
      // Эмитим событие для обновления контента
      window.dispatchEvent(new CustomEvent('page-structure-updated'));
    }
    
    // Уведомляем другие компоненты об обновлении
    window.dispatchEvent(new CustomEvent('docs-structure-updated'));
  } catch (error) {
    console.error('Ошибка сохранения структуры:', error);
    alert('Ошибка сохранения: ' + (error.response?.data?.error || error.message || 'Неизвестная ошибка'));
  } finally {
    isSaving.value = false;
  }
}

function toggleCategory(categoryName) {
  expandedCategories.value[categoryName] = !expandedCategories.value[categoryName];
}

function formatCategoryName(name) {
  if (name === 'uncategorized') return 'Без категории';
  // Преобразуем только первую букву в заглавную, остальные оставляем как есть
  if (!name || name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function getCategoryPageCount(category) {
  if (!category || !category.pages) return 0;
  let count = category.pages.length;
  category.pages.forEach(page => {
    if (page && page.children && Array.isArray(page.children)) {
      count += page.children.length;
    }
  });
  return count;
}

function navigateToPage(pageId) {
  console.log('[DocsSidebar] navigateToPage вызвана с pageId:', pageId);
  router.push({ name: 'content-published', query: { page: pageId } }).catch(err => {
    console.error('[DocsSidebar] Ошибка навигации:', err);
  });
}

// Отслеживаем изменения маршрута для подсветки активной ссылки
watch(() => [route.query.page, route.params.id], ([queryPage, paramId]) => {
  const pageId = queryPage ? parseInt(queryPage) : (paramId ? parseInt(paramId) : null);
  if (pageId) {
    // Автоматически раскрываем категорию с активной страницей
    if (structure.value && structure.value.categories) {
      structure.value.categories.forEach(category => {
        if (category && category.pages) {
          const hasActivePage = category.pages.some(
            page => page && (
              page.id === pageId || 
              (page.children && Array.isArray(page.children) && page.children.some(child => child && child.id === pageId))
            )
          );
          if (hasActivePage) {
            expandedCategories.value[category.name] = true;
          }
        }
      });
    }
  }
}, { immediate: true });

// Слушаем обновления структуры
onMounted(() => {
  loadStructure();
  loadCategoriesList(); // Загружаем список категорий из API
  
  // Слушаем событие обновления структуры
  const handleStructureUpdate = () => {
    console.log('[DocsSidebar] Получено событие docs-structure-updated, обновляю структуру...');
    loadStructure();
    loadCategoriesList(); // Обновляем список категорий
  };
  
  window.addEventListener('docs-structure-updated', handleStructureUpdate);
  
  // Сохраняем обработчик для удаления
  window._docsSidebarUpdateHandler = handleStructureUpdate;
});

onBeforeUnmount(() => {
  if (window._docsSidebarUpdateHandler) {
    window.removeEventListener('docs-structure-updated', window._docsSidebarUpdateHandler);
    delete window._docsSidebarUpdateHandler;
  }
});
</script>

<style scoped>
.docs-sidebar {
  width: 280px;
  background: #fff;
  border-right: 1px solid #e9ecef;
  height: 100%;
  overflow-y: auto;
  position: sticky;
  top: 0;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
}

.sidebar-header-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sidebar-nav {
  padding: 12px 0;
}

.loading-state,
.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #6c757d;
}

.loading-spinner {
  border: 2px solid #f3f3f3;
  border-top: 2px solid var(--color-primary);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.categories-list {
  padding: 0;
}

.category-group {
  margin-bottom: 4px;
}

.category-header {
  display: flex;
  align-items: center;
  padding: 10px 20px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
  font-weight: 600;
  color: #495057;
}

.category-header:hover {
  background-color: #f8f9fa;
}

.category-icon {
  margin-right: 8px;
  font-size: 0.75rem;
  color: #6c757d;
  transition: transform 0.2s;
}

.category-name {
  flex: 1;
}

.category-count {
  font-size: 0.85rem;
  color: #6c757d;
  font-weight: normal;
}

.category-pages {
  padding-left: 8px;
}

.empty-category {
  padding: 20px;
  text-align: center;
  color: #6c757d;
}

.empty-category p {
  margin: 8px 0;
}

.empty-category-hint {
  font-size: 0.85rem;
  font-style: italic;
}

.nav-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px 8px 36px;
  color: #495057;
  text-decoration: none;
  transition: all 0.2s;
  border-left: 2px solid transparent;
}

.nav-link:hover {
  background-color: #f8f9fa;
  color: var(--color-primary);
}

.nav-link.active {
  background-color: #e7f3ff;
  color: var(--color-primary);
  border-left-color: var(--color-primary);
  font-weight: 500;
}

.nav-link-child {
  padding-left: 52px;
  font-size: 0.9rem;
}

.nav-link-text {
  flex: 1;
}

.nav-link-badge {
  font-size: 0.75rem;
  background: var(--color-primary);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
}

.nav-children {
  margin-top: 4px;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  max-height: 1000px;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
}

/* Скроллбар */
.docs-sidebar::-webkit-scrollbar {
  width: 6px;
}

.docs-sidebar::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.docs-sidebar::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.docs-sidebar::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.create-category-btn,
.edit-category-btn,
.delete-category-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.create-category-btn {
  background: var(--color-primary);
  color: white;
}

.create-category-btn:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.edit-category-btn {
  background: #6c757d;
  color: white;
}

.edit-category-btn:hover {
  background: #5a6268;
  transform: translateY(-1px);
}

.delete-category-btn {
  background: #dc3545;
  color: white;
}

.delete-category-btn:hover {
  background: #c82333;
  transform: translateY(-1px);
}

.create-category-btn i,
.edit-category-btn i,
.delete-category-btn i {
  font-size: 0.85rem;
}

.category-actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.category-action-btn {
  background: none;
  border: none;
  padding: 4px 8px;
  color: #6c757d;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  font-size: 0.85rem;
}

.category-action-btn:hover {
  background: #f0f0f0;
  color: var(--color-primary);
}

.nav-link-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-link {
  flex: 1;
}

.nav-link-edit-btn {
  background: none;
  border: none;
  padding: 4px 8px;
  color: #adb5bd;
  cursor: pointer;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.2s;
  font-size: 0.8rem;
}

.nav-link-wrapper:hover .nav-link-edit-btn {
  opacity: 1;
}

.nav-link-edit-btn:hover {
  background: #f0f0f0;
  color: var(--color-primary);
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
  .docs-sidebar {
    width: 100%;
    position: relative;
    border-right: none;
    border-bottom: 1px solid #e9ecef;
  }

  .modal-content {
    max-width: 100%;
    margin: 10px;
  }
}
</style>

