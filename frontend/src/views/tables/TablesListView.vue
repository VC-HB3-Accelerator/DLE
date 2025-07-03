<template>
  <BaseLayout>
    <div class="tables-list-block">
      <button class="close-btn" @click="goBack">×</button>
    <h2>Список таблиц</h2>
    <UserTablesList v-if="isAdmin" />
    <div v-else class="empty-table-placeholder">Нет данных для отображения</div>
    </div>
  </BaseLayout>
</template>

<script setup>
import BaseLayout from '../../components/BaseLayout.vue';
import UserTablesList from '../../components/tables/UserTablesList.vue';
import { useRouter } from 'vue-router';
import { useAuthContext } from '@/composables/useAuth';
// import TagsTableView from '../../components/tables/TagsTableView.vue'; // больше не используется
const router = useRouter();
const { isAdmin } = useAuthContext();
function goBack() {
  router.push({ name: 'crm' });
}
</script> 

<style scoped>
.tables-list-block {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.12);
  padding: 32px 24px 24px 24px;
  width: 100%;
  margin-top: 40px;
  position: relative;
  overflow-x: auto;
}
.close-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #bbb;
  transition: color 0.2s;
}
.close-btn:hover {
  color: #333;
}
</style> 