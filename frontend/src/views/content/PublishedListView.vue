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
    <div class="list-page">
      <div class="page-header">
        <div class="header-content">
          <h1>Публичные документы</h1>
          <p>Публичные документы, доступные пользователям</p>
        </div>
        <button class="close-btn" @click="goBack">×</button>
      </div>
      <div class="content-block">
        <div class="section-header">
          <h2>Список документов</h2>
          <div class="search-box">
            <input v-model="search" type="text" placeholder="Поиск..." class="search-input" />
            <i class="fas fa-search search-icon"></i>
          </div>
        </div>
        <div v-if="filtered.length" class="pages-grid">
          <div v-for="p in filtered" :key="p.id" class="page-card" @click="openPublic(p.id)">
            <div class="page-card-header">
              <h3>{{ p.title }}</h3>
            </div>
            <div class="page-card-content">
              <p class="page-summary">{{ p.summary || 'Без описания' }}</p>
              <div class="page-meta">
                <span class="page-status published"><i class="fas fa-circle"></i>Опубликовано</span>
                <span class="page-status"><i class="fas fa-file"></i>{{ p.format || 'html' }}</span>
              </div>
              <div v-if="canManageLegalDocs && address" class="page-actions">
                <button class="action-btn primary" title="Индексировать" @click.stop="reindex(p.id)"><i class="fas fa-sync"></i><span>Индекс</span></button>
                <button class="action-btn primary" title="Редактировать" @click.stop="goEdit(p.id)"><i class="fas fa-edit"></i><span>Ред.</span></button>
                <button class="action-btn danger" title="Удалить" @click.stop="doDelete(p.id)"><i class="fas fa-trash"></i><span>Удалить</span></button>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <div class="empty-icon"><i class="fas fa-file-alt"></i></div>
          <h3>Нет опубликованных документов</h3>
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
import api from '../../api/axios';
import { useAuthContext } from '../../composables/useAuth';
import { usePermissions } from '../../composables/usePermissions';
import { PERMISSIONS as SHARED_PERMISSIONS } from './permissions.js';

const props = defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});

const router = useRouter();
const search = ref('');
const pages = ref([]);
const { address } = useAuthContext();
const { hasPermission } = usePermissions();
const canManageLegalDocs = computed(() => hasPermission(SHARED_PERMISSIONS.MANAGE_LEGAL_DOCS));

function goBack() { router.push({ name: 'content-list' }); }
function openPublic(id) { router.push({ name: 'public-page-view', params: { id } }); }
function goEdit(id) { router.push({ name: 'page-edit', params: { id } }); }
async function reindex(id) {
  try {
    await api.post(`/pages/${id}/reindex`);
    alert('Индексация выполнена');
  } catch (e) {
    alert('Ошибка индексации: ' + (e?.response?.data?.error || e.message));
  }
}
async function doDelete(id) {
  if (!confirm('Удалить документ?')) return;
  try {
    await pagesService.deletePage(id);
    pages.value = await pagesService.getPublicPages();
  } catch (e) {
    alert('Ошибка удаления: ' + (e?.response?.data?.error || e.message));
  }
}

const filtered = computed(() => {
  return pages.value.filter(p => 
    p.visibility === 'public' &&
    p.status === 'published' &&
    (!search.value || p.title?.toLowerCase().includes(search.value.toLowerCase()))
  );
});

onMounted(async () => {
  try {
    pages.value = await pagesService.getPublicPages();
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
.page-actions { display:flex; gap: 10px; margin-top: 12px; }
.action-btn { display:inline-flex; align-items:center; gap:6px; background: #fff; color:#333; border: 1px solid #d0d7de; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 0.95rem; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
.action-btn i { font-size: 0.95rem; }
.action-btn:hover { background: #f6f8fa; border-color: #c2cbd3; }
.action-btn.primary { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.action-btn.primary:hover { background: var(--color-primary-dark); }
.action-btn.danger { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
.action-btn.danger:hover { background: #fee2e2; }
.empty-state { text-align:center; padding: 60px 20px; }
.empty-icon { font-size: 3rem; color: var(--color-grey-dark); margin-bottom: 10px; }
</style>


