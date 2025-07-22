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
  <BaseLayout>
    <div class="content-page-block">
      <div class="content-header-nav">
        <button class="nav-btn" @click="goToCreate">Создать</button>
        <button class="nav-btn" @click="goToList">Список страниц</button>
        <button class="nav-btn" @click="goToSettings">Настройки</button>
      </div>
      <router-view />
      <form class="content-form" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="title">Заголовок страницы *</label>
          <input v-model="form.title" id="title" type="text" required />
        </div>
        <div class="form-group">
          <label for="summary">Краткое описание *</label>
          <textarea v-model="form.summary" id="summary" required rows="2" />
        </div>
        <div class="form-group">
          <label for="content">Основной контент *</label>
          <textarea v-model="form.content" id="content" required rows="6" />
        </div>
        <button class="submit-btn" type="submit">Сохранить</button>
      </form>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import BaseLayout from '../components/BaseLayout.vue';
import pagesService from '../services/pagesService';

const router = useRouter();
function goToCreate() { router.push({ name: 'content-create' }); }
function goToList() { router.push({ name: 'content-list' }); }
function goToSettings() { router.push({ name: 'content-settings' }); }

const form = ref({
  title: '',
  summary: '',
  content: ''
});

async function handleSubmit() {
  console.log('handleSubmit called', form.value);
  try {
    if (!form.value.title) {
      alert('Заполните заголовок страницы!');
      return;
    }
    // Создаём страницу через pagesService
    const page = await pagesService.createPage({
      title: form.value.title,
      summary: form.value.summary,
      content: form.value.content
    });
    console.log('createPage result:', page);
    if (!page || !page.id) {
      alert('Ошибка: страница не создана!');
      return;
    }
    router.push({ name: 'content-list' });
  } catch (e) {
    alert('Ошибка при создании страницы: ' + (e?.message || e));
    console.error('Ошибка при создании страницы:', e);
  }
}
</script>

<style scoped>
.content-page-block {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.12);
  padding: 32px 24px 24px 24px;
  width: 100%;
  margin-top: 40px;
  position: relative;
  overflow-x: auto;
}
.content-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 24px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
input[type="text"], textarea, select {
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 1rem;
  width: 100%;
}
.tags-input {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tag {
  background: #f0f0f0;
  border-radius: 4px;
  padding: 2px 8px;
  display: flex;
  align-items: center;
  font-size: 0.95em;
}
.tag button {
  background: none;
  border: none;
  color: #888;
  margin-left: 4px;
  cursor: pointer;
  font-size: 1.1em;
}
.submit-btn {
  background: #2d72d9;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 10px 0;
  font-size: 1.1em;
  cursor: pointer;
  margin-top: 12px;
  transition: background 0.2s;
}
.submit-btn:hover {
  background: #1a4e96;
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
</style> 