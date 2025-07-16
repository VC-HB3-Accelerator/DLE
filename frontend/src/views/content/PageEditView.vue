<template>
  <BaseLayout>
    <div v-if="page" class="page-edit-block">
      <h2>Редактировать страницу</h2>
      <form @submit.prevent="save">
        <label>Заголовок</label>
        <input v-model="page.title" required />
        <label>Описание</label>
        <textarea v-model="page.summary" />
        <label>Контент</label>
        <textarea v-model="page.content" />
        <button type="submit">Сохранить</button>
        <button type="button" @click="goBack">Отмена</button>
      </form>
    </div>
    <div v-else>Загрузка...</div>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import pagesService from '../../services/pagesService';

const route = useRoute();
const router = useRouter();
const page = ref(null);

onMounted(async () => {
  page.value = await pagesService.getPage(route.params.id);
});

async function save() {
  await pagesService.updatePage(route.params.id, {
    title: page.value.title,
    summary: page.value.summary,
    content: page.value.content
  });
  router.push({ name: 'page-view', params: { id: route.params.id } });
}

function goBack() {
  router.push({ name: 'page-view', params: { id: route.params.id } });
}
</script> 