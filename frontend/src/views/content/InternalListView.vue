<!--
  Copyright (c) 2024-2025
-->
<template>
  <BaseLayout :is-authenticated="isAuthenticated" :identities="identities" :token-balances="tokenBalances" :is-loading-tokens="isLoadingTokens" @auth-action-completed="$emit('auth-action-completed')">
    <div class="list-page">
      <div class="page-header">
        <div class="header-content">
          <h1>Внутренние документы</h1>
          <p>Документы, доступные только пользователям с ролями</p>
        </div>
        <button class="close-btn" @click="goBack">×</button>
      </div>
      <div class="content-block">
        <div class="section-header">
          <h2>Список документов</h2>
          <div class="filters">
            <div class="filter-group" v-if="canManageLegalDocs && address">
              <label for="permission-filter">Уровень доступа:</label>
              <select v-model="permissionFilter" id="permission-filter" class="filter-select">
                <option value="">Все уровни</option>
                <option :value="PERMISSIONS.VIEW_BASIC_DOCS">Пользователи</option>
                <option :value="PERMISSIONS.VIEW_LEGAL_DOCS">Читатели</option>
                <option :value="PERMISSIONS.MANAGE_LEGAL_DOCS">Редакторы</option>
              </select>
            </div>
            <div class="search-box">
              <input v-model="search" type="text" placeholder="Поиск..." class="search-input" />
              <i class="fas fa-search search-icon"></i>
            </div>
          </div>
        </div>
        <div v-if="filtered.length" class="pages-grid">
          <div v-for="p in filtered" :key="p.id" class="page-card" @click="open(p.id)">
            <div class="page-card-header">
              <h3>{{ p.title }}</h3>
            </div>
            <div class="page-card-content">
              <p class="page-summary">{{ p.summary || 'Без описания' }}</p>
              <div class="page-meta">
                <span class="page-status" :class="p.status === 'published' ? 'published' : 'draft'"><i class="fas fa-circle"></i>{{ p.status === 'published' ? 'Опубликовано' : 'Черновик' }}</span>
                <span class="page-status"><i class="fas fa-lock"></i>Внутренний</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <div class="empty-icon"><i class="fas fa-file-alt"></i></div>
          <h3>Нет внутренних документов</h3>
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
import { usePermissions } from '../../composables/usePermissions';
import { PERMISSIONS } from '/app/shared/permissions.js';

const props = defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});

const router = useRouter();
const search = ref('');
const permissionFilter = ref('');
const pages = ref([]);

// Проверка прав доступа
const { address } = useAuthContext();
const { hasPermission } = usePermissions();
const canManageLegalDocs = computed(() => hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS));

function goBack() { router.push({ name: 'content-list' }); }
function open(id) { router.push({ name: 'page-view', params: { id } }); }

const filtered = computed(() => {
  return pages.value.filter(p => {
    // Базовые фильтры
    if (p.visibility !== 'internal' || p.status !== 'published') {
      return false;
    }
    
    // Фильтр по поиску
    if (search.value && !p.title?.toLowerCase().includes(search.value.toLowerCase())) {
      return false;
    }
    
    // Фильтр по уровню доступа (только для редакторов)
    if (permissionFilter.value && p.required_permission !== permissionFilter.value) {
      return false;
    }
    
    // Фильтр по правам доступа
    if (!p.required_permission) {
      return false; // Документ без прав не показываем
    }
    
    // Проверяем права пользователя
    if (p.required_permission === PERMISSIONS.VIEW_BASIC_DOCS) {
      return hasPermission(PERMISSIONS.VIEW_BASIC_DOCS);
    }
    
    if (p.required_permission === PERMISSIONS.VIEW_LEGAL_DOCS) {
      return hasPermission(PERMISSIONS.VIEW_LEGAL_DOCS);
    }
    
    if (p.required_permission === PERMISSIONS.MANAGE_LEGAL_DOCS) {
      return hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS);
    }
    
    return false;
  });
});

onMounted(async () => {
  try {
    pages.value = await pagesService.getInternalPages();
  } catch (e) {
    pages.value = [];
  }
});
</script>

<style scoped>
.list-page { padding: 20px; width: 100%; }
.page-header { display:flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #f0f0f0; }
.header-content h1 { color: var(--color-primary); font-size: 2.2rem; margin: 0 0 8px 0; }
.header-content p { color: var(--color-grey-dark); margin: 0; }
.close-btn { background:none; border:none; font-size: 1.5rem; cursor:pointer; color:#888; }

/* Переиспользуем стили из TemplatesListView */
.content-block { background: #f8f9fa; border-radius: var(--radius-lg); padding: 25px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.section-header { display:flex; justify-content: space-between; align-items:center; margin-bottom: 20px; }
.section-header h2 { color: var(--color-primary); margin: 0; }
.filters { display: flex; gap: 20px; align-items: center; }
.filter-group { display: flex; align-items: center; gap: 8px; }
.filter-group label { color: var(--color-grey-dark); font-weight: 500; }
.filter-select { padding: 8px 12px; border: 1px solid #e9ecef; border-radius: var(--radius-sm); background: #fff; font-size: 1rem; }
.search-box { position: relative; width: 300px; }
.search-input { width: 100%; padding: 10px 40px 10px 15px; border: 1px solid #e9ecef; border-radius: var(--radius-sm); font-size: 1rem; }
.search-icon { position: absolute; right: 15px; top: 50%; transform: translateY(-50%); color: var(--color-grey-dark); }
.pages-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; margin-top: 10px; }
.page-card { background: #fff; border: 1px solid #e9ecef; border-radius: var(--radius-sm); padding: 16px; cursor: pointer; transition: all 0.2s; }
.page-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-2px); }
.page-card-header h3 { margin: 0; color: var(--color-primary); font-size: 1.2rem; }
.page-summary { color: var(--color-grey-dark); margin: 8px 0 12px; }
.page-meta { display:flex; gap: 12px; font-size: 0.9rem; color: var(--color-grey-dark); align-items: center; flex-wrap: wrap; }
.page-status i { margin-right: 6px; }
.page-status.published i { color: #4caf50; }
.page-status.draft i { color: #ff9800; }
.empty-state { text-align:center; padding: 60px 20px; }
.empty-icon { font-size: 3rem; color: var(--color-grey-dark); margin-bottom: 10px; }
</style>


