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
    <div class="page-view-container">
      <!-- Заголовок страницы -->
      <div v-if="page" class="page-header">
        <div class="header-content">
          <h1>📄 {{ page.title }}</h1>
          <div class="page-meta">
            <span class="page-status" :class="page.status">
              <i class="fas fa-circle"></i>
              {{ getStatusText(page.status) }}
            </span>
            <span class="page-date">
              <i class="fas fa-calendar"></i>
              Создано: {{ formatDate(page.createdAt) }}
            </span>
            <span v-if="page.updatedAt" class="page-date">
              <i class="fas fa-edit"></i>
              Обновлено: {{ formatDate(page.updatedAt) }}
            </span>
          </div>
        </div>
        <div class="header-actions">
          <button v-if="canEditPage" class="btn btn-outline" @click="goToEdit">
            <i class="fas fa-edit"></i>
            Редактировать
          </button>
          <button v-if="canManageLegalDocs && address" class="btn btn-danger" @click="deletePage" type="button">
            <i class="fas fa-trash"></i>
            Удалить
          </button>
          <button class="close-btn" @click="goBack">×</button>
        </div>
      </div>

      <!-- Контент страницы -->
      <div v-if="page" class="page-content-block">
        <div class="page-content">
          <!-- Описание -->
          <div v-if="page.summary" class="content-section">
            <h2>Описание</h2>
            <div class="summary-content">
              {{ page.summary }}
            </div>
          </div>

          <!-- Основной контент -->
          <div class="content-section">
            <h2>Содержание</h2>
            <div class="main-content">
              <!-- HTML -->
              <div v-if="page.format === 'html' && page.content" v-html="formatContent(page.content)"></div>

              <!-- PDF -->
              <div v-else-if="page.format === 'pdf' && page.file_path" class="file-preview">
                <embed :src="page.file_path" type="application/pdf" class="pdf-embed" />
                <a class="btn btn-outline" :href="page.file_path" target="_blank" download>Скачать PDF</a>
              </div>

              <!-- Image -->
              <div v-else-if="page.format === 'image' && page.file_path" class="file-preview">
                <img :src="page.file_path" alt="Документ" class="image-preview" />
                <a class="btn btn-outline" :href="page.file_path" target="_blank" download>Скачать изображение</a>
              </div>

              <div v-else class="empty-content">
                <i class="fas fa-file-alt"></i>
                <p>Контент не добавлен</p>
              </div>
            </div>
          </div>

          <!-- SEO информация -->
          <div v-if="page.seo" class="content-section">
            <h2>SEO информация</h2>
            <div class="seo-info">
              <div class="seo-item">
                <label>Meta Title:</label>
                <span>{{ page.seo.title || 'Не указан' }}</span>
              </div>
              <div class="seo-item">
                <label>Meta Description:</label>
                <span>{{ page.seo.description || 'Не указан' }}</span>
              </div>
              <div class="seo-item">
                <label>Keywords:</label>
                <span>{{ page.seo.keywords || 'Не указаны' }}</span>
              </div>
            </div>
          </div>

          <!-- Статистика -->
          <div class="content-section">
            <h2>Статистика</h2>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-value">{{ page.views || 0 }}</div>
                <div class="stat-label">Просмотров</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{{ page.wordCount || 0 }}</div>
                <div class="stat-label">Слов</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{{ page.characterCount || 0 }}</div>
                <div class="stat-label">Символов</div>
              </div>
            </div>
          </div>
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
        <p>Запрашиваемая страница не существует или была удалена</p>
        <button class="btn btn-primary" @click="goBack">
          <i class="fas fa-arrow-left"></i>
          Вернуться назад
        </button>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted, watch, nextTick, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import pagesService from '../../services/pagesService';
import api from '../../api/axios';
import { useAuthContext } from '../../composables/useAuth';
import { usePermissions } from '../../composables/usePermissions';
import { PERMISSIONS } from '../../composables/permissions';

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

// Состояние
const page = ref(null);
const { address } = useAuthContext();
const { canEditData, hasPermission } = usePermissions();
const canManageLegalDocs = computed(() => {
  try {
    return hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS);
  } catch (e) {
    console.error('[PageView] Ошибка проверки прав MANAGE_LEGAL_DOCS:', e);
    return false;
  }
});
const isLoading = ref(false);

// Удалять может ТОЛЬКО редактор (MANAGE_LEGAL_DOCS)
const canDeletePage = computed(() => {
  const hasPermission = canManageLegalDocs.value;
  const hasAddress = !!address.value;
  console.log('[PageView] canDeletePage проверка:', { hasPermission, hasAddress, address: address.value });
  return hasPermission && hasAddress;
});

// Редактировать может редактор или пользователь с правом редактирования
const canEditPage = computed(() => {
  if (!address.value) return false;
  return canManageLegalDocs.value || canEditData.value;
});

// Методы
function goToEdit() {
  router.push({ name: 'content-create', query: { edit: route.params.id } });
}

async function reindex() {
  try {
    await api.post(`/pages/${route.params.id}/reindex`);
    alert('Индексация выполнена');
  } catch (e) {
    alert('Ошибка индексации: ' + (e?.response?.data?.error || e.message));
  }
}

async function deletePage() {
  // Дополнительная проверка прав на стороне клиента
  if (!canManageLegalDocs.value) {
    alert('У вас нет прав для удаления страниц. Требуются права редактора.');
    return;
  }
  
  if (!confirm('Вы уверены, что хотите удалить эту страницу? Это действие нельзя отменить. Все связанные файлы также будут удалены.')) {
    return;
  }
  
    try {
      await pagesService.deletePage(route.params.id);
      router.push({ name: 'content-list' });
    } catch (error) {
      console.error('Ошибка удаления страницы:', error);
    alert('Ошибка при удалении страницы: ' + (error?.response?.data?.error || error?.message || 'Неизвестная ошибка'));
  }
}

function goBack() {
  router.go(-1);
}

function formatDate(date) {
  if (!date) return 'Не указана';
  return new Date(date).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getStatusText(status) {
  const statusMap = {
    draft: 'Черновик',
    published: 'Опубликовано',
    archived: 'Архив',
    pending: 'На модерации'
  };
  return statusMap[status] || 'Неизвестно';
}

function formatContent(content) {
  // Форматирование контента
  if (!content) return '';
  
  // Если контент уже содержит HTML теги (например, из RichTextEditor), обрабатываем его
  if (/<[a-z][\s\S]*>/i.test(content)) {
    // Преобразуем iframe с локальными видео-файлами обратно в тег video
    // Quill может преобразовывать video в iframe, но для локальных файлов нужен тег video
    content = content.replace(/<iframe([^>]*?)src=["']([^"']+)["']([^>]*?)><\/iframe>/gi, (match, attrs1, url, attrs2) => {
      // Проверяем, является ли это видео-файл из нашей системы
      if (url.includes('/api/uploads/media/') && url.includes('/file')) {
        // Преобразуем в тег video для локальных видео-файлов
        return `<video controls class="ql-video" style="max-width: 100%; width: 100%; height: auto; min-height: 400px; border-radius: 8px; margin: 1.5rem 0; display: block;" src="${url}"></video>`;
      }
      // Оставляем iframe для внешних видео (YouTube, Vimeo и т.д.)
      return match;
    });
    
    return content;
  }
  
  // Иначе заменяем переносы строк на <br>
  return content.replace(/\n/g, '<br>');
}

async function loadPage() {
  try {
    isLoading.value = true;
    page.value = await pagesService.getPage(route.params.id);
    
    // Подсчитываем статистику
    if (page.value) {
      page.value.wordCount = page.value.content ? page.value.content.split(/\s+/).length : 0;
      page.value.characterCount = page.value.content ? page.value.content.length : 0;
    }
  } catch (error) {
    console.error('Ошибка загрузки страницы:', error);
    page.value = null;
  } finally {
    isLoading.value = false;
  }
}

// Обработка ошибок загрузки видео
function setupVideoErrorHandlers() {
  nextTick(() => {
    const videoElements = document.querySelectorAll('.page-content video');
    videoElements.forEach((video) => {
      video.addEventListener('error', (e) => {
        console.error('Ошибка загрузки видео:', e);
        const error = e.target.error;
        let errorMessage = 'Неизвестная ошибка';
        
        if (error) {
          switch (error.code) {
            case error.MEDIA_ERR_ABORTED:
              errorMessage = 'Загрузка видео была прервана';
              break;
            case error.MEDIA_ERR_NETWORK:
              errorMessage = 'Ошибка сети при загрузке видео';
              break;
            case error.MEDIA_ERR_DECODE:
              errorMessage = 'Ошибка декодирования видео';
              break;
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorMessage = 'Формат видео не поддерживается';
              break;
            default:
              errorMessage = `Ошибка загрузки видео (код: ${error.code})`;
          }
        }
        
        // Показываем сообщение об ошибке вместо видео
        const errorDiv = document.createElement('div');
        errorDiv.className = 'video-error';
        errorDiv.style.cssText = 'padding: 20px; background: #fee; border: 1px solid #fcc; border-radius: 8px; margin: 1.5rem 0; color: #c33;';
        errorDiv.textContent = `❌ ${errorMessage}`;
        video.parentNode?.replaceChild(errorDiv, video);
      });
    });
  });
}

// Отслеживание изменений контента для добавления обработчиков ошибок
watch(() => page.value?.content, () => {
  if (page.value?.content) {
    setupVideoErrorHandlers();
  }
});

// Загрузка данных
onMounted(() => {
  loadPage();
  setupVideoErrorHandlers();
});
</script>

<style scoped>
.page-view-container {
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
  margin: 0 0 15px 0;
}

.page-meta {
  display: flex;
  gap: 20px;
  align-items: center;
  font-size: 0.9rem;
  color: var(--color-grey-dark);
}

.page-status {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border-radius: 20px;
  font-weight: 500;
}

.page-status.draft {
  background: #fff3e0;
  color: #e65100;
}

.page-status.published {
  background: #e8f5e8;
  color: #2e7d32;
}

.page-status.archived {
  background: #f5f5f5;
  color: #616161;
}

.page-status.pending {
  background: #e3f2fd;
  color: #1565c0;
}

.page-date,
.page-updated {
  display: flex;
  align-items: center;
  gap: 5px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.page-content-block {
  background: #f8f9fa;
  border-radius: var(--radius-lg);
  padding: 25px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
  width: 100%;
  max-width: 100%;
}

.page-content {
  background: white;
  border-radius: var(--radius-sm);
  padding: 25px;
  border: 1px solid #e9ecef;
  width: 100%;
  max-width: 100%;
}

.content-section {
  background: white;
  border-radius: var(--radius-sm);
  padding: 25px;
  margin-bottom: 20px;
  border: 1px solid #e9ecef;
  width: 100%;
  max-width: 100%;
}

.content-section:last-child {
  margin-bottom: 0;
}

.content-section h2 {
  color: var(--color-primary);
  margin: 0 0 20px 0;
  font-size: 1.5rem;
}

.summary-content {
  color: var(--color-grey-dark);
  line-height: 1.6;
  font-size: 1.1rem;
}

.main-content {
  line-height: 1.8;
  color: #333;
}

/* Стили для видео в контенте */
.main-content :deep(video) {
  max-width: 100%;
  width: 100%;
  height: auto;
  min-height: 400px;
  border-radius: 8px;
  margin: 1.5rem 0;
  display: block;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background: #000;
}

.main-content :deep(video.ql-video) {
  width: 100%;
  max-width: 100%;
  min-height: 400px;
}

.main-content :deep(video:focus) {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Стили для iframe в контенте (для внешних видео) */
.main-content :deep(iframe) {
  max-width: 100%;
  width: 100%;
  height: auto;
  min-height: 400px;
  border-radius: 8px;
  margin: 1.5rem 0;
  display: block;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background: #000;
  border: none;
}

.main-content :deep(iframe.ql-video) {
  min-height: 400px;
  aspect-ratio: 16 / 9;
}

.main-content :deep(iframe:focus) {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Стили для изображений в контенте */
.main-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 1.5rem 0;
  display: block;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.file-preview { display: flex; flex-direction: column; gap: 12px; }
.pdf-embed { width: 100%; height: 70vh; border: 1px solid #e9ecef; border-radius: var(--radius-sm); }
.image-preview { max-width: 100%; border: 1px solid #e9ecef; border-radius: var(--radius-sm); }

.empty-content {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-grey-dark);
}

.empty-content i {
  font-size: 3rem;
  margin-bottom: 15px;
  opacity: 0.5;
}

.seo-info {
  display: grid;
  gap: 15px;
}

.seo-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}

.seo-item:last-child {
  border-bottom: none;
}

.seo-item label {
  font-weight: 500;
  color: var(--color-grey-dark);
  min-width: 150px;
}

.seo-item span {
  color: #333;
  flex: 1;
  margin-left: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 20px;
}

.stat-item {
  text-align: center;
  padding: 20px;
  background: #f8f9fa;
  border-radius: var(--radius-sm);
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: var(--color-primary);
  margin-bottom: 5px;
}

.stat-label {
  color: var(--color-grey-dark);
  font-size: 0.9rem;
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
  color: #f44336;
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

.btn-outline {
  background: white;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}

.btn-outline:hover {
  background: var(--color-primary);
  color: white;
}

.btn-danger {
  background: #f44336;
  color: white;
}

.btn-danger:hover {
  background: #d32f2f;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
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

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 15px;
  }
  
  .page-title-section h1 {
    font-size: 2rem;
  }
  
  .page-meta {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
  
  .header-actions {
    width: 100%;
    justify-content: stretch;
  }
  
  .header-actions .btn {
    flex: 1;
    justify-content: center;
  }
  
  .seo-item {
    flex-direction: column;
    gap: 5px;
  }
  
  .seo-item label {
    min-width: auto;
  }
  
  .seo-item span {
    margin-left: 0;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style> 