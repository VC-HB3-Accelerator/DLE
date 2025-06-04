<template>
  <BaseLayout>
    <div class="edit-table-form">
      <h2>Редактировать таблицу</h2>
      <form @submit.prevent="save">
        <label>Название</label>
        <input v-model="name" required />
        <label>Описание</label>
        <textarea v-model="description" />
        <label>Источник для ИИ ассистента</label>
        <select v-model="isRagSourceId" required>
          <option :value="1">Да</option>
          <option :value="2">Нет</option>
        </select>
        <div class="actions">
          <button type="submit">Сохранить</button>
          <button type="button" @click="cancel">Отмена</button>
        </div>
      </form>
    </div>
  </BaseLayout>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import axios from 'axios';
const $route = useRoute();
const router = useRouter();
const name = ref('');
const description = ref('');
const isRagSourceId = ref(2);

onMounted(async () => {
  const { data } = await axios.get(`/api/tables/${$route.params.id}`);
  name.value = data.name;
  description.value = data.description;
  isRagSourceId.value = data.is_rag_source_id || 2;
});

async function save() {
  await axios.patch(`/api/tables/${$route.params.id}`, {
    name: name.value,
    description: description.value,
    isRagSourceId: isRagSourceId.value
  });
  router.push({ name: 'user-table-view', params: { id: $route.params.id } });
}
function cancel() {
  router.push({ name: 'user-table-view', params: { id: $route.params.id } });
}
</script>
<style scoped>
.edit-table-form {
  max-width: 400px;
  margin: 2em auto;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.07);
  padding: 2em 1.5em;
}
.edit-table-form label {
  display: block;
  margin-top: 1em;
  font-weight: 500;
}
.edit-table-form input, .edit-table-form textarea {
  width: 100%;
  margin-top: 0.5em;
  padding: 0.5em;
  border-radius: 6px;
  border: 1px solid #ddd;
  font-size: 1em;
}
.actions {
  display: flex;
  gap: 1em;
  margin-top: 2em;
  justify-content: flex-end;
}
</style> 