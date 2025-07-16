<template>
  <BaseLayout>
    <div class="content-list-block">
      <div class="content-header-nav">
        <button class="nav-btn" @click="goToCreate">Создать</button>
        <button class="nav-btn" @click="goToList">Список страниц</button>
        <button class="nav-btn" @click="goToSettings">Настройки</button>
      </div>
      <h2>Список страниц</h2>
      <ul v-if="pages.length" class="pages-list">
        <li v-for="page in pages" :key="page.id">
          <router-link :to="{ name: 'page-view', params: { id: page.id } }">{{ page.title }}</router-link>
        </li>
      </ul>
      <div v-else class="empty-list-placeholder">Нет созданных страниц.</div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import pagesService from '../../services/pagesService';
const router = useRouter();
function goToCreate() { router.push({ name: 'content-create' }); }
function goToList() { router.push({ name: 'content-list' }); }
function goToSettings() { router.push({ name: 'content-settings' }); }

const pages = ref([]);
onMounted(async () => {
  pages.value = await pagesService.getPages();
});
</script>

<style scoped>
.content-list-block {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.12);
  padding: 32px 24px 24px 24px;
  width: 100%;
  margin-top: 40px;
  position: relative;
  overflow-x: auto;
}
.content-header-nav {
  display: flex;
  gap: 12px;
  margin-bottom: 18px;
}
.nav-btn {
  background: #f5f5f5;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  padding: 7px 18px;
  font-size: 1em;
  cursor: pointer;
  transition: background 0.2s;
}
.nav-btn:hover {
  background: #e0e0e0;
}
.empty-list-placeholder {
  color: #888;
  font-size: 1.1em;
  margin-top: 2em;
}
.pages-list {
  margin-top: 1.5em;
  padding-left: 0;
  list-style: none;
}
.pages-list li {
  padding: 0.5em 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 1.08em;
}
.pages-list li:last-child {
  border-bottom: none;
}
</style> 