<template>
  <BaseLayout>
    <div class="content-page-block">
      <h2>Контент</h2>
      <form class="content-form" @submit.prevent>
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
        <div class="form-group">
          <label for="image">Изображение/обложка</label>
          <input v-model="form.image" id="image" type="text" placeholder="URL или имя файла" />
        </div>
        <div class="form-group">
          <label for="tags">Теги</label>
          <div class="tags-input">
            <input
              v-model="tagInput"
              @keydown.enter.prevent="addTag"
              @blur="addTag"
              placeholder="Введите тег и нажмите Enter"
            />
            <div class="tags-list">
              <span v-for="(tag, idx) in form.tags" :key="tag" class="tag">
                {{ tag }}
                <button type="button" @click="removeTag(idx)">&times;</button>
              </span>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label for="category">Категория</label>
          <select v-model="form.category" id="category">
            <option value="">Не выбрано</option>
            <option value="О компании">О компании</option>
            <option value="Продукты">Продукты</option>
            <option value="Блог">Блог</option>
            <option value="FAQ">FAQ</option>
          </select>
        </div>
        <div class="form-group">
          <label for="addToChat">Добавить в чат</label>
          <select v-model="form.addToChat" id="addToChat">
            <option value="yes">Да</option>
            <option value="no">Нет</option>
          </select>
        </div>
        <div class="form-group">
          <label for="rag">Интегрировать с RAG</label>
          <select v-model="form.rag" id="rag">
            <option value="yes">Да</option>
            <option value="no">Нет</option>
          </select>
        </div>
        <button class="submit-btn" type="submit">Сохранить</button>
      </form>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref } from 'vue';
import BaseLayout from '../components/BaseLayout.vue';

const form = ref({
  title: '',
  summary: '',
  content: '',
  image: '',
  tags: [],
  category: '',
  addToChat: 'yes',
  rag: 'yes',
});

const tagInput = ref('');

function addTag() {
  const tag = tagInput.value.trim();
  if (tag && !form.value.tags.includes(tag)) {
    form.value.tags.push(tag);
  }
  tagInput.value = '';
}

function removeTag(idx) {
  form.value.tags.splice(idx, 1);
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
</style> 