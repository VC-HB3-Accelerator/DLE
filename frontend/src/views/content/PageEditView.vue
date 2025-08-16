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
    <div v-if="page" class="page-edit-page">
      <!-- Заголовок страницы -->
      <div class="page-header">
        <div class="header-content">
          <h1>✏️ Редактирование страницы</h1>
          <p v-if="page">Редактируйте содержимое страницы "{{ page.title }}"</p>
          <p v-else>Загрузка страницы...</p>
        </div>
        <div class="header-actions">
          <button class="close-btn" @click="goBack">×</button>
        </div>
      </div>

      <!-- Основной контент с тенью -->
      <div class="content-block">
        <form class="content-form" @submit.prevent="save">
          <!-- Основная информация -->
          <div class="form-section">
            <h2>Основная информация</h2>
            <div class="form-group">
              <label for="title">Заголовок страницы *</label>
              <input 
                v-model="page.title" 
                id="title" 
                type="text" 
                required 
                placeholder="Введите заголовок страницы"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="summary">Краткое описание *</label>
              <textarea 
                v-model="page.summary" 
                id="summary" 
                required 
                rows="3" 
                placeholder="Краткое описание страницы"
                class="form-textarea"
              />
            </div>
          </div>

          <!-- Контент -->
          <div class="form-section">
            <h2>Содержание</h2>
            <div class="form-group">
              <label for="content">Основной контент *</label>
              <textarea 
                v-model="page.content" 
                id="content" 
                required 
                rows="10" 
                placeholder="Введите основной контент страницы"
                class="form-textarea"
              />
              <div class="content-stats">
                <span>Слов: {{ wordCount }}</span>
                <span>Символов: {{ characterCount }}</span>
              </div>
            </div>
          </div>

          <!-- SEO настройки -->
          <div class="form-section">
            <h2>SEO настройки</h2>
            <div class="form-group">
              <label for="seo-title">Meta Title</label>
              <input 
                v-model="page.seo.title" 
                id="seo-title" 
                type="text" 
                placeholder="SEO заголовок (если отличается от основного)"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="seo-description">Meta Description</label>
              <textarea 
                v-model="page.seo.description" 
                id="seo-description" 
                rows="3" 
                placeholder="SEO описание для поисковых систем"
                class="form-textarea"
              />
            </div>
            <div class="form-group">
              <label for="seo-keywords">Keywords</label>
              <input 
                v-model="page.seo.keywords" 
                id="seo-keywords" 
                type="text" 
                placeholder="Ключевые слова через запятую"
                class="form-input"
              />
            </div>
          </div>

          <!-- Настройки публикации -->
          <div class="form-section">
            <h2>Настройки публикации</h2>
            <div class="form-group">
              <label for="status">Статус</label>
              <select v-model="page.status" id="status" class="form-select">
                <option value="draft">Черновик</option>
                <option value="published">Опубликовано</option>
                <option value="pending">На модерации</option>
                <option value="archived">Архив</option>
              </select>
            </div>
          </div>

          <!-- Кнопки действий -->
          <div class="form-actions">
            <button type="button" class="btn btn-outline" @click="goBack">
              <i class="fas fa-times"></i>
              Отмена
            </button>
            <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
              <i class="fas fa-save"></i>
              {{ isSubmitting ? 'Сохранение...' : 'Сохранить изменения' }}
            </button>
          </div>
        </form>
      </div>
    </div>
    
    <!-- Загрузка -->
    <div v-else class="loading-state">
      <div class="loading-spinner"></div>
      <p>Загрузка страницы...</p>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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

const route = useRoute();
const router = useRouter();
const page = ref(null);
const isSubmitting = ref(false);

// Вычисляемые свойства
const wordCount = computed(() => {
  return page.value?.content ? page.value.content.split(/\s+/).length : 0;
});

const characterCount = computed(() => {
  return page.value?.content ? page.value.content.length : 0;
});

// Методы
function goBack() {
  router.push({ name: 'page-view', params: { id: route.params.id } });
}

async function save() {
  if (!page.value.title.trim()) {
    alert('Заполните заголовок страницы!');
    return;
  }

  if (!page.value.summary.trim()) {
    alert('Заполните описание страницы!');
    return;
  }

  if (!page.value.content.trim()) {
    alert('Заполните контент страницы!');
    return;
  }

  try {
    isSubmitting.value = true;
    
    const pageData = {
      title: page.value.title.trim(),
      summary: page.value.summary.trim(),
      content: page.value.content.trim(),
      seo: page.value.seo || {},
      status: page.value.status || 'draft'
    };

    await pagesService.updatePage(route.params.id, pageData);
    
    // Перенаправляем на просмотр страницы
    router.push({ name: 'page-view', params: { id: route.params.id } });
  } catch (error) {
    console.error('Ошибка при сохранении страницы:', error);
    alert('Ошибка при сохранении страницы: ' + (error?.message || error));
  } finally {
    isSubmitting.value = false;
  }
}

// Загрузка данных
onMounted(async () => {
  try {
    page.value = await pagesService.getPage(route.params.id);
    
    // Инициализируем SEO объект если его нет
    if (!page.value.seo) {
      page.value.seo = {
        title: '',
        description: '',
        keywords: ''
      };
    }
  } catch (error) {
    console.error('Ошибка при загрузке страницы:', error);
    alert('Ошибка при загрузке страницы: ' + (error?.message || error));
  }
});
</script>

<style scoped>
.page-edit-page {
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

.header-content {
  flex: 1;
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

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  color: var(--color-grey-dark);
  cursor: pointer;
  padding: 0 10px;
  transition: color 0.3s ease;
}

.close-btn:hover {
  color: var(--color-primary);
}

.content-block {
  background: #f8f9fa;
  border-radius: var(--radius-lg);
  padding: 25px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.content-form {
  background: white;
  border-radius: var(--radius-sm);
  padding: 30px;
  border: 1px solid #e9ecef;
  max-width: 1000px;
  margin: 0 auto;
}

.form-section {
  margin-bottom: 30px;
}

.form-section:last-child {
  margin-bottom: 0;
}

.form-section h2 {
  color: var(--color-primary);
  margin: 0 0 20px 0;
  font-size: 1.3rem;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 10px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--color-grey-dark);
}

.form-input,
.form-textarea,
.form-select {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-sm);
  font-size: 1rem;
  transition: border-color 0.3s ease;
  box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(45, 114, 217, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.content-stats {
  display: flex;
  gap: 20px;
  margin-top: 8px;
  font-size: 0.9rem;
  color: var(--color-grey-dark);
}

.form-actions {
  display: flex;
  gap: 15px;
  justify-content: flex-end;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
}

.btn {
  padding: 12px 24px;
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

.btn-outline {
  background: white;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}

.btn-outline:hover {
  background: var(--color-primary);
  color: white;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-state p {
  color: var(--color-grey-dark);
  font-size: 1.1rem;
  margin: 0;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 15px;
  }
  
  .header-content h1 {
    font-size: 2rem;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .content-stats {
    flex-direction: column;
    gap: 5px;
  }
}
</style> 