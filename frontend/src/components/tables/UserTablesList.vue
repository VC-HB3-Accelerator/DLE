<template>
  <div class="tables-container">
    <header class="tables-header">
      <!-- <h2>Пользовательские таблицы</h2> -->
      <button class="create-btn" @click="createTable">Создать таблицу</button>
    </header>
    <div class="tables-list">
      <div
        v-for="table in tables"
        :key="table.id"
        class="table-card"
        :class="{ selected: table.id === props.selectedTableId }"
        @click="selectTable(table)"
      >
        <div class="table-info">
          <div class="table-title">{{ table.name }}</div>
          <div class="table-desc">{{ table.description }}</div>
        </div>
        <div class="table-actions">
          <button @click.stop="renameTable(table)">Переименовать</button>
          <button class="danger" @click.stop="confirmDelete(table)">Удалить</button>
        </div>
      </div>
      <div v-if="!tables.length" class="empty-state">
        <span>Нет таблиц. Создайте первую!</span>
      </div>
    </div>
    <div v-if="showDeleteModal" class="modal-backdrop">
      <div class="modal">
        <p>Удалить таблицу <b>{{ selectedTable?.name }}</b>?</p>
        <div class="modal-actions">
          <button class="danger" @click="deleteTable(selectedTable)">Удалить</button>
          <button @click="showDeleteModal = false">Отмена</button>
        </div>
      </div>
    </div>
    <UserTableView
      v-if="props.selectedTableId"
      :table-id="props.selectedTableId"
      @close="emit('update:selected-table-id', null)"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import UserTableView from './UserTableView.vue';
import tablesService from '../../services/tablesService';

const props = defineProps({
  selectedTableId: Number
});
const emit = defineEmits(['update:selected-table-id']);

const router = useRouter();

const tables = ref([]);
const showDeleteModal = ref(false);
const selectedTable = ref(null);

async function fetchTables() {
  tables.value = await tablesService.getTables();
}
onMounted(fetchTables);

function selectTable(table) {
  router.push({ name: 'user-table-view', params: { id: table.id } });
}
function createTable() {
  router.push({ name: 'create-table' });
}

function renameTable(table) {
  const name = prompt('Новое имя', table.name);
  if (name && name !== table.name) {
    tablesService.updateTable(table.id, { name }).then(fetchTables);
  }
}
function confirmDelete(table) {
  selectedTable.value = table;
  showDeleteModal.value = true;
}
function deleteTable(table) {
  tablesService.deleteTable(table.id).then(() => {
    showDeleteModal.value = false;
    fetchTables();
    if (props.selectedTableId === table.id) emit('update:selected-table-id', null);
  });
}
</script>

<style scoped>
.tables-container {
  max-width: 600px;
  margin: 2rem auto;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.07);
  padding: 2rem 1.5rem;
}
.tables-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}
.create-btn {
  background: #2ecc40;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.5em 1.2em;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.create-btn:hover {
  background: #27ae38;
}
.tables-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.table-card {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  background: #f8f9fa;
  border-radius: 10px;
  padding: 1rem;
  box-shadow: 0 1px 4px rgba(0,0,0,0.03);
  cursor: pointer;
  border: 2px solid transparent;
  transition: border 0.2s;
}
.table-card.selected {
  border: 2px solid #2ecc40;
}
.table-info {
  flex: 1 1 200px;
}
.table-title {
  font-weight: 600;
  font-size: 1.1em;
}
.table-desc {
  color: #888;
  font-size: 0.95em;
  margin-top: 0.2em;
}
.table-actions {
  display: flex;
  gap: 0.5em;
  margin-top: 0.5em;
}
.table-actions button {
  background: #eaeaea;
  border: none;
  border-radius: 6px;
  padding: 0.4em 1em;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}
.table-actions button:hover {
  background: #d5d5d5;
}
.table-actions .danger {
  background: #ff4d4f;
  color: #fff;
}
.table-actions .danger:hover {
  background: #d9363e;
}
.empty-state {
  text-align: center;
  color: #aaa;
  margin: 2em 0;
  font-size: 1.1em;
}

/* Модалка */
.modal-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  background: #fff;
  border-radius: 12px;
  padding: 2em 1.5em;
  box-shadow: 0 2px 16px rgba(0,0,0,0.13);
  min-width: 260px;
}
.modal-actions {
  display: flex;
  gap: 1em;
  margin-top: 1.5em;
  justify-content: flex-end;
}

/* Адаптивность */
@media (max-width: 600px) {
  .tables-container {
    padding: 1em 0.3em;
  }
  .table-card {
    flex-direction: column;
    gap: 0.7em;
    padding: 0.7em;
  }
  .tables-header {
    flex-direction: column;
    gap: 0.7em;
    align-items: flex-start;
  }
  .table-actions {
    flex-wrap: wrap;
    gap: 0.4em;
  }
}
</style> 