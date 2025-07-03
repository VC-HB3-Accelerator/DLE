<template>
  <BaseLayout>
    <div class="table-block-wrapper">
    <div class="tableview-header-row">
      <button class="nav-btn" @click="goToTables">Таблицы</button>
      <button class="nav-btn" @click="goToCreate">Создать таблицу</button>
      <button class="close-btn" @click="closeTable">Закрыть</button>
      <button v-if="isAdmin" class="action-btn" @click="goToEdit">Редактировать</button>
      <button v-if="isAdmin" class="danger-btn" @click="goToDelete">Удалить</button>
    </div>
    <UserTableView v-if="isAdmin" :table-id="Number($route.params.id)" />
    <div v-else class="empty-table-placeholder">Нет данных для отображения</div>
    </div>
  </BaseLayout>
</template>

<script setup>
import BaseLayout from '../../components/BaseLayout.vue';
import UserTableView from '../../components/tables/UserTableView.vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthContext } from '@/composables/useAuth';
const $route = useRoute();
const router = useRouter();
const { isAdmin } = useAuthContext();

function closeTable() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push({ name: 'home' });
  }
}

function goToEdit() {
  router.push({ name: 'edit-table', params: { id: $route.params.id } });
}

function goToDelete() {
  router.push({ name: 'delete-table', params: { id: $route.params.id } });
}

function goToTables() {
  router.push({ name: 'tables-list' });
}

function goToCreate() {
  router.push({ name: 'create-table' });
}
</script>

<style scoped>
.table-block-wrapper {
  background: #fff;
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-top: 20px;
  margin-bottom: 20px;
  width: 100%;
  position: relative;
  overflow-x: auto;
  margin-left: 0;
  margin-right: 0;
}
.tableview-header-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin: 1.2em 0 0.5em 0;
}
.close-btn {
  background: #ff4d4f;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.5em 1.2em;
  font-weight: 600;
  cursor: pointer;
  font-size: 1em;
  transition: background 0.2s;
}
.close-btn:hover {
  background: #d9363e;
}
.action-btn {
  background: #2ecc40;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.5em 1.2em;
  font-weight: 600;
  cursor: pointer;
  font-size: 1em;
  margin-left: 0.7em;
  transition: background 0.2s;
}
.action-btn:hover {
  background: #27ae38;
}
.danger-btn {
  background: #ff4d4f;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.5em 1.2em;
  font-weight: 600;
  cursor: pointer;
  font-size: 1em;
  margin-left: 0.7em;
  transition: background 0.2s;
}
.danger-btn:hover {
  background: #d9363e;
}
.nav-btn {
  background: #eaeaea;
  color: #333;
  border: none;
  border-radius: 8px;
  padding: 0.5em 1.2em;
  font-weight: 500;
  cursor: pointer;
  font-size: 1em;
  transition: background 0.2s;
  margin-right: 0.7em;
}
.nav-btn:hover {
  background: #d5d5d5;
}
</style> 