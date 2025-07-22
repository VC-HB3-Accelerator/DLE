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
    <div v-if="page" class="page-view-block">
      <h2>{{ page.title }}</h2>
      <p><b>Описание:</b> {{ page.summary }}</p>
      <div><b>Контент:</b> {{ page.content }}</div>
      <button @click="goToEdit">Редактировать</button>
      <button @click="deletePage" style="color:red">Удалить</button>
    </div>
    <div v-else>Загрузка...</div>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import pagesService from '../../services/pagesService';

const route = useRoute();
const router = useRouter();
const page = ref(null);

onMounted(async () => {
  page.value = await pagesService.getPage(route.params.id);
});

function goToEdit() {
  router.push({ name: 'page-edit', params: { id: route.params.id } });
}

async function deletePage() {
  if (confirm('Удалить страницу?')) {
    await pagesService.deletePage(route.params.id);
    router.push({ name: 'content-list' });
  }
}
</script> 