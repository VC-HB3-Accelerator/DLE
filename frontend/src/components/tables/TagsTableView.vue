<template>
  <div class="tags-table-wrapper">
    <div class="tableview-header-row">
      <button class="nav-btn" @click="goToTables">Таблицы</button>
      <button class="nav-btn" @click="goToCreate">Создать таблицу</button>
      <button class="close-btn" @click="closeTable">Закрыть</button>
      <button class="action-btn" disabled>Редактировать</button>
      <button class="danger-btn" disabled>Удалить</button>
    </div>
    <div class="tags-header-row">
      <h3>Теги</h3>
    </div>
    <table class="tags-table">
      <thead>
        <tr>
          <th>Название</th>
          <th>Описание</th>
          <th style="width:110px;">Действия</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="tag in tags" :key="tag.id">
          <td v-if="editId !== tag.id">{{ tag.name }}</td>
          <td v-else><input v-model="editName" class="edit-input" /></td>

          <td v-if="editId !== tag.id">{{ tag.description || '—' }}</td>
          <td v-else><input v-model="editDescription" class="edit-input" /></td>

          <td>
            <template v-if="editId === tag.id">
              <button class="save-btn" @click="saveEdit(tag)">Сохранить</button>
              <button class="cancel-btn" @click="cancelEdit">Отмена</button>
            </template>
            <template v-else>
              <button class="edit-btn" @click="startEdit(tag)" title="Редактировать">✏️</button>
              <button class="delete-btn" @click="deleteTag(tag)" title="Удалить">🗑</button>
            </template>
          </td>
        </tr>
        <tr v-if="tags.length === 0">
          <td colspan="3" style="text-align:center; color:#888;">Нет тегов</td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td style="text-align:center;">
            <button class="edit-btn" @click="showAddTagModal = true" title="Добавить тег">➕</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-if="showAddTagModal" class="modal-backdrop">
      <div class="modal">
        <h4>Добавить тег</h4>
        <input v-model="newTagName" class="edit-input" placeholder="Название" />
        <input v-model="newTagDescription" class="edit-input" placeholder="Описание" style="margin-top:0.7em;" />
        <div class="modal-actions">
          <button class="save-btn" @click="createTag">Создать</button>
          <button class="cancel-btn" @click="showAddTagModal = false">Отмена</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
const tags = ref([]);
const editId = ref(null);
const editName = ref('');
const editDescription = ref('');
const router = useRouter();

const showAddTagModal = ref(false);
const newTagName = ref('');
const newTagDescription = ref('');

function goToTables() {
  router.push({ name: 'tables-list' });
}
function goToCreate() {
  router.push({ name: 'create-table' });
}
function closeTable() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push({ name: 'home' });
  }
}

async function loadTags() {
  const res = await fetch('/api/tags');
  tags.value = await res.json();
}

function startEdit(tag) {
  editId.value = tag.id;
  editName.value = tag.name;
  editDescription.value = tag.description || '';
}

function cancelEdit() {
  editId.value = null;
  editName.value = '';
  editDescription.value = '';
}

async function saveEdit(tag) {
  await fetch(`/api/tags/${tag.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: editName.value, description: editDescription.value })
  });
  await loadTags();
  cancelEdit();
}

async function deleteTag(tag) {
  if (!confirm(`Удалить тег "${tag.name}"?`)) return;
  await fetch(`/api/tags/${tag.id}`, { method: 'DELETE' });
  await loadTags();
}

async function createTag() {
  if (!newTagName.value.trim()) return;
  await fetch('/api/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newTagName.value, description: newTagDescription.value })
  });
  newTagName.value = '';
  newTagDescription.value = '';
  showAddTagModal.value = false;
  await loadTags();
}

onMounted(loadTags);
</script>

<style scoped>
.tableview-header-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin: 1.2em 0 0.5em 0;
}
.tags-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1em;
}
.add-plus-btn, .edit-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1em;
  margin-right: 0.5em;
  color: #2ecc40;
  transition: color 0.2s;
}
.add-plus-btn:hover, .edit-btn:hover, .save-btn:hover {
  color: #138496;
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
.tags-table-wrapper {
  margin: 2em 0;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  padding: 1.5em 1em;
}
.tags-table {
  width: 100%;
  border-collapse: collapse;
}
.tags-table th, .tags-table td {
  border: 1px solid #ececec;
  padding: 0.6em 1em;
  font-size: 1.05em;
}
.tags-table th {
  background: #f7f7f7;
  font-weight: 600;
}
.delete-btn {
  color: #dc3545;
}
.cancel-btn {
  color: #888;
}
.edit-input {
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 1em;
  min-width: 120px;
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
  display: flex;
  flex-direction: column;
  gap: 0.7em;
}
.modal-actions {
  display: flex;
  gap: 1em;
  margin-top: 1em;
  justify-content: flex-end;
}
</style> 