<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <BaseLayout :is-authenticated="isAuthenticated" :identities="identities" :token-balances="tokenBalances" :is-loading-tokens="isLoadingTokens" @auth-action-completed="$emit('auth-action-completed')">
    <div class="list-page">
      <div class="page-header">
        <div class="header-content">
          <h1>Шаблоны документов</h1>
          <p>Системные шаблоны для персонализации и публикации.</p>
        </div>
        <div class="header-actions">
          <button class="close-btn" @click="goBack">×</button>
        </div>
      </div>

      <div class="content-block">
        <div class="section-header">
          <h2>Список шаблонов</h2>
          <div class="filters">
            <div class="filter-group">
              <label for="visibility-filter">Видимость:</label>
              <select v-model="visibilityFilter" id="visibility-filter" class="filter-select">
                <option value="">Все</option>
                <option value="public">Публичные</option>
                <option value="internal">Внутренние</option>
              </select>
            </div>
            <div class="search-box">
              <input v-model="search" type="text" placeholder="Поиск шаблонов..." class="search-input" />
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
                <span class="page-status draft"><i class="fas fa-circle"></i>Черновик</span>
                <span class="page-status"><i class="fas fa-cube"></i>Шаблон</span>
                <span class="page-status" :class="p.visibility"><i class="fas fa-eye"></i>{{ p.visibility === 'internal' ? 'Внутренний' : 'Публичный' }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <div class="empty-icon"><i class="fas fa-file-alt"></i></div>
          <h3>Шаблонов не найдено</h3>
          <p v-if="!canEditData || !address">Требуются права редактора и подключённый кошелёк для просмотра системных шаблонов.</p>
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

const props = defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});

const router = useRouter();
const search = ref('');
const visibilityFilter = ref('');
const pages = ref([]);
const { address } = useAuthContext();
const { canEditData } = usePermissions();

function goBack() { router.push({ name: 'content-list' }); }
function open(id) { 
  if (canEditData.value && address.value) {
    router.push({ name: 'page-view', params: { id } });
  } else {
    router.push({ name: 'public-page-view', params: { id } });
  }
}

const filtered = computed(() => {
  return pages.value.filter(p => 
    (p.is_system_template === true) &&
    (p.visibility === 'public' || p.visibility === 'internal') &&
    (!visibilityFilter.value || p.visibility === visibilityFilter.value) &&
    (!search.value || p.title?.toLowerCase().includes(search.value.toLowerCase()))
  );
});

onMounted(async () => {
  try {
    if (canEditData.value && address.value) {
      try {
        pages.value = await pagesService.getPages();
      } catch (e) {
        pages.value = [];
      }
    } else {
      pages.value = [];
    }
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

/* Переиспользуем стили из ContentListView */
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
.page-status.draft i { color: #ff9800; }
.empty-state { text-align:center; padding: 60px 20px; }
.empty-icon { font-size: 3rem; color: var(--color-grey-dark); margin-bottom: 10px; }
</style>


