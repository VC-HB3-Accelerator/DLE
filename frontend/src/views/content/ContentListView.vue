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
    <div class="content-management-page">
      <!-- Заголовок страницы -->
      <div class="page-header">
          <div class="header-content">
          <h1>Управление контентом</h1>
          <p v-if="canEditData && address">Создавайте и управляйте страницами вашего DLE</p>
          <p v-else>Просмотр опубликованных страниц DLE</p>
        </div>
        <div class="header-actions">
          <button class="close-btn" @click="goBack">×</button>
        </div>
      </div>

      <!-- Основной контент с тенью -->
      <div class="content-block">
        <!-- Быстрые разделы -->
        <div class="quick-sections">
          <div class="management-blocks">
            <div class="blocks-column">
              <div class="management-block">
                <h3>Создать страницу</h3>
                <p>Создайте новую страницу и заполните содержимое</p>
                <button class="details-btn" @click="goToCreate">Подробнее</button>
              </div>

              <div class="management-block">
                <h3>Шаблоны</h3>
                <p>Системные шаблоны документов. Персонализируйте перед публикацией</p>
                <button class="details-btn" @click="goToTemplates">Подробнее</button>
              </div>
            </div>

            <div class="blocks-column">
              <div class="management-block">
                <h3>Публичные</h3>
                <p>Публичные документы, доступные пользователям</p>
                <button class="details-btn" @click="goToPublished">Подробнее</button>
              </div>

              <div class="management-block">
                <h3>Настройка</h3>
                <p>Юр. реквизиты и параметры подстановки переменных</p>
                <button class="details-btn" @click="goToContentSettings">Подробнее</button>
              </div>
            </div>

            <div class="blocks-column">
              <div class="management-block">
                <h3>Внутренние</h3>
                <p>Внутренние документы, видимые только по ролям</p>
                <button class="details-btn" @click="goToInternal">Подробнее</button>
              </div>

              <div class="management-block">
                <h3>Системные сообщения</h3>
                <p>Управляйте уведомлениями, отображаемыми в чате и интерфейсе DLE</p>
                <button class="details-btn" @click="goToSystemMessages">Подробнее</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Секции списков и настроек удалены: навигация через карточки выше -->
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { } from 'vue';
import { useRouter } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import { useAuthContext } from '../../composables/useAuth';
import { usePermissions } from '../../composables/usePermissions';

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
const { address } = useAuthContext();
const { canEditData } = usePermissions();

// Методы
function goToCreate() {
  router.push({ name: 'content-create' });
}


function goBack() {
  router.go(-1);
}

function goToTemplates() {
  router.push({ name: 'content-templates' });
}

function goToPublished() {
  router.push({ name: 'content-published' });
}

function goToInternal() {
  router.push({ name: 'content-internal' });
}

function goToContentSettings() {
  router.push({ name: 'content-settings' });
}

function goToSystemMessages() {
  router.push({ name: 'content-system-messages-table' });
}

async function deletePage(id) {
  if (confirm('Вы уверены, что хотите удалить эту страницу?')) {
    try {
      // удаление здесь больше не используется
    } catch (error) {
      console.error('Ошибка удаления страницы:', error);
    }
  }
}


// Удалены: загрузка и локальные списки — навигация через карточки
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

.quick-sections { margin-bottom: 24px; }

/* Стили блоков как в CRM */
.management-blocks { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
.blocks-column { display: flex; flex-direction: column; gap: 1.5rem; align-items: stretch; }
.management-block { background: #fff; border-radius: 12px; padding: 2rem; box-shadow: 0 2px 12px rgba(0,0,0,0.08); border: 1px solid #e9ecef; transition: all 0.3s ease; text-align: center; display: flex; flex-direction: column; justify-content: space-between; height: 250px; }
.management-block:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.12); transform: translateY(-2px); border-color: var(--color-primary); }
.management-block h3 { margin: 0 0 1rem 0; color: var(--color-primary); font-size: 1.5rem; font-weight: 600; }
.management-block p { margin: 0 0 1.5rem 0; color: #666; font-size: 1rem; line-height: 1.5; }
.details-btn { background: var(--color-primary); color: #fff; border: none; border-radius: 8px; padding: 0.75rem 1.5rem; cursor: pointer; font-size: 1rem; font-weight: 600; transition: all 0.2s; min-width: 120px; margin-top: auto; }
.details-btn:hover { background: var(--color-primary-dark); transform: translateY(-1px); }

@media (max-width: 1024px) { .management-blocks { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 768px) { .management-blocks { grid-template-columns: 1fr; } }

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