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
  <div class="contact-table-modal">
    <div class="contact-table-header">
      <el-button v-if="canRead" type="info" @click="goToPersonalMessages" style="margin-right: 1em;">Личные сообщения</el-button>
      <el-button v-if="canEdit" type="success" :disabled="!selectedIds.length" @click="() => openChatForSelected()" style="margin-right: 1em;">Публичное сообщение</el-button>
      <el-button v-if="canRead" type="warning" :disabled="!selectedIds.length" @click="() => openPrivateChatForSelected()" style="margin-right: 1em;">Приватное сообщение</el-button>
      <el-button v-if="canManageSettings" type="info" :disabled="!selectedIds.length" @click="showBroadcastModal = true" style="margin-right: 1em;">Рассылка</el-button>
      <el-button v-if="canDelete" type="warning" :disabled="!selectedIds.length" @click="deleteMessagesSelected" style="margin-right: 1em;">Удалить сообщения</el-button>
      <el-button v-if="canDelete" type="danger" :disabled="!selectedIds.length" @click="deleteSelected" style="margin-right: 1em;">Удалить</el-button>
      <el-button v-if="canEdit" type="primary" @click="showImportModal = true" style="margin-right: 1em;">Импорт</el-button>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>
    <el-form :inline="true" class="filters-form" label-position="top">
      <el-form-item label="Поиск">
        <el-input v-model="filterSearch" placeholder="Поиск по имени, email, telegram, кошельку" clearable @input="onAnyFilterChange" />
      </el-form-item>
      <el-form-item label="Тип контакта">
        <el-select v-model="filterContactType" placeholder="Все" style="min-width:120px;" @change="onAnyFilterChange">
          <el-option label="Все" value="all" />
          <el-option label="Email" value="email" />
          <el-option label="Telegram" value="telegram" />
          <el-option label="Кошелек" value="wallet" />
        </el-select>
      </el-form-item>
      <el-form-item label="Дата от">
        <el-date-picker v-model="filterDateFrom" type="date" placeholder="Дата от" clearable style="width: 100%;" @change="onAnyFilterChange" />
      </el-form-item>
      <el-form-item label="Дата до">
        <el-date-picker v-model="filterDateTo" type="date" placeholder="Дата до" clearable style="width: 100%;" @change="onAnyFilterChange" />
      </el-form-item>
      <el-form-item label="Только с новыми сообщениями">
        <el-select v-model="filterNewMessages" placeholder="Нет" style="min-width:110px;" @change="onAnyFilterChange">
          <el-option label="Нет" :value="''" />
          <el-option label="Да" value="yes" />
        </el-select>
      </el-form-item>
      <el-form-item label="Блокировка">
        <el-select v-model="filterBlocked" placeholder="Все" style="min-width:120px;" @change="onAnyFilterChange">
          <el-option label="Все" value="all" />
          <el-option label="Только заблокированные" value="blocked" />
          <el-option label="Только не заблокированные" value="unblocked" />
        </el-select>
      </el-form-item>
      <el-form-item label="Теги" v-if="availableTags.length">
        <el-select
          v-model="selectedTagIds"
          multiple
          filterable
          placeholder="Выберите теги"
          style="min-width:180px;"
          @change="onAnyFilterChange"
        >
          <el-option
            v-for="tag in availableTags"
            :key="tag.id"
            :label="tag.name"
            :value="tag.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="resetFilters" type="default">Сбросить фильтры</el-button>
      </el-form-item>
    </el-form>
    <table class="contact-table">
        <thead>
          <tr>
            <th v-if="canRead"><input type="checkbox" v-model="selectAll" @change="toggleSelectAll" /></th>
            <th>Тип</th>
            <th>Имя</th>
            <th>Email</th>
            <th>Telegram</th>
            <th>Кошелек</th>
            <th>Дата создания</th>
            <th>Действие</th>
          </tr>
        </thead>
      <tbody>
        <tr v-for="contact in contactsArray" :key="contact.id" :class="{ 'new-contact-row': newIds.includes(contact.id) }">
          <td v-if="canRead"><input type="checkbox" v-model="selectedIds" :value="contact.id" /></td>
          <td>
            <span v-if="contact.contact_type === 'admin'" class="admin-badge">Админ</span>
            <span v-else class="user-badge">Пользователь</span>
          </td>
          <td>{{ contact.name || '-' }}</td>
          <td>{{ contact.email || '-' }}</td>
          <td>{{ contact.telegram || '-' }}</td>
          <td>{{ contact.wallet || '-' }}</td>
          <td>{{ contact.created_at ? new Date(contact.created_at).toLocaleString() : '-' }}</td>
          <td>
            <span v-if="newMsgUserIds.includes(String(contact.id))" class="new-msg-icon" title="Новое сообщение">✉️</span>
            <button class="details-btn" @click="showDetails(contact)">Подробнее</button>
          </td>
        </tr>
      </tbody>
    </table>
    <ImportContactsModal v-if="showImportModal" @close="showImportModal = false" @imported="onImported" />
    <BroadcastModal v-if="showBroadcastModal" :user-ids="selectedIds" @close="showBroadcastModal = false" />
  </div>
</template>

<script setup>
import { defineProps, computed, ref, onMounted, watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElSelect, ElOption, ElForm, ElFormItem, ElInput, ElDatePicker, ElCheckbox, ElButton, ElMessageBox, ElMessage } from 'element-plus';
import ImportContactsModal from './ImportContactsModal.vue';
import BroadcastModal from './BroadcastModal.vue';
import tablesService from '../services/tablesService';
import messagesService from '../services/messagesService';
import { useTagsWebSocket } from '../composables/useTagsWebSocket';
import { usePermissions } from '@/composables/usePermissions';
import api from '../api/axios';
const props = defineProps({
  contacts: { type: Array, default: () => [] },
  newContacts: { type: Array, default: () => [] },
  newMessages: { type: Array, default: () => [] },
  markMessagesAsReadForUser: { type: Function, default: null },
  markContactAsRead: { type: Function, default: null }
});
const contactsArray = ref([]); // теперь управляем вручную
const newIds = computed(() => props.newContacts.map(c => c.id));
const newMsgUserIds = computed(() => props.newMessages.map(m => String(m.user_id)));
const router = useRouter();
const { canRead, canEdit, canDelete, canManageSettings } = usePermissions();

// Фильтры
const filterSearch = ref('');
const filterContactType = ref('all');
const filterDateFrom = ref('');
const filterDateTo = ref('');
const filterNewMessages = ref('');
const filterBlocked = ref('all');

// Новый фильтр тегов через мультисвязи
const availableTags = ref([]);
const selectedTagIds = ref([]);

const showImportModal = ref(false);
const showBroadcastModal = ref(false);

const selectedIds = ref([]);
const selectAll = ref(false);

// WebSocket для тегов - ОТКЛЮЧАЕМ из-за циклических запросов
// const { onTagsUpdate } = useTagsWebSocket();
// let unsubscribeFromTags = null;
let lastTagsHash = ref(''); // Хеш последних загруженных тегов
let tagsUpdateInterval = null; // Интервал для периодического обновления тегов

onMounted(async () => {
  await fetchContacts();
  // ВРЕМЕННО ОТКЛЮЧАЕМ - await loadAvailableTags();
  
  // ВРЕМЕННО ОТКЛЮЧАЕМ - Вместо WebSocket используем периодическое обновление каждые 30 секунд
  // tagsUpdateInterval = setInterval(async () => {
  //   console.log('[ContactTable] Периодическое обновление тегов');
  //   await loadAvailableTags();
  // }, 30000); // 30 секунд
  
  // Подписываемся на обновления тегов - ОТКЛЮЧАЕМ
  // unsubscribeFromTags = onTagsUpdate(async () => {
  //   console.log('[ContactTable] Получено обновление тегов, проверяем необходимость перезагрузки');
  //   await loadAvailableTags();
  // });
});

onUnmounted(() => {
  // Отписываемся от WebSocket при размонтировании - ОТКЛЮЧАЕМ
  // if (unsubscribeFromTags) {
  //   unsubscribeFromTags();
  // }
  
  // Очищаем интервал
  if (tagsUpdateInterval) {
    clearInterval(tagsUpdateInterval);
    tagsUpdateInterval = null;
  }
});

// ВРЕМЕННО ОТКЛЮЧАЕМ - async function loadAvailableTags() {
//   try {
//     // Получаем все пользовательские таблицы и ищем "Теги клиентов"
//     const tables = await tablesService.getTables();
//     const tagsTable = tables.find(t => t.name === 'Теги клиентов');
//     
//     if (tagsTable) {
//       // Загружаем данные таблицы тегов
//       const table = await tablesService.getTable(tagsTable.id);
//       const nameColumn = table.columns.find(col => col.name === 'Название') || table.columns[0];
//       
//       if (nameColumn) {
//         // Формируем список тегов
//         const newTags = table.rows.map(row => {
//           const nameCell = table.cellValues.find(c => c.row_id === row.id && c.column_id === nameColumn.id);
//           return {
//             id: row.id,
//             name: nameCell ? nameCell.value : `Тег ${row.id}`
//           };
//         }).filter(tag => tag.name.trim()); // Исключаем пустые названия
//         
//         // Создаем хеш для сравнения
//         const newTagsHash = JSON.stringify(newTags.map(t => `${t.id}:${t.name}`).sort());
//         
//         // Обновляем только если данные действительно изменились
//         if (newTagsHash !== lastTagsHash.value) {
//           console.log('[ContactTable] Теги изменились, обновляем список');
//           availableTags.value = newTags;
//           lastTagsHash.value = newTagsHash;
//         } else {
//           console.log('[ContactTable] Теги не изменились, пропускаем обновление');
//         }
//       }
//     }
//   } catch (e) {
//     console.error('Ошибка загрузки тегов:', e);
//     availableTags.value = [];
//   }
// }

function buildQuery() {
  const params = new URLSearchParams();
  if (selectedTagIds.value.length > 0) params.append('tagIds', selectedTagIds.value.join(','));
  if (filterDateFrom.value) params.append('dateFrom', formatDateOnly(filterDateFrom.value));
  if (filterDateTo.value) params.append('dateTo', formatDateOnly(filterDateTo.value));
  if (filterContactType.value && filterContactType.value !== 'all') params.append('contactType', filterContactType.value);
  if (filterSearch.value) params.append('search', filterSearch.value);
  if (filterNewMessages.value) params.append('newMessages', filterNewMessages.value);
  if (filterBlocked.value && filterBlocked.value !== 'all') params.append('blocked', filterBlocked.value);
  return params.toString();
}

async function fetchContacts() {
  try {
    // Загружаем обычные контакты
    let url = '/users';
    const query = buildQuery();
    if (query) url += '?' + query;
    console.log('[ContactTable] Загружаем контакты по URL:', url);
    const res = await api.get(url);
    console.log('[ContactTable] Получен ответ:', res.data);
    contactsArray.value = res.data.contacts || [];
    console.log('[ContactTable] Загружено контактов:', contactsArray.value.length);
    console.log('[ContactTable] Первые 3 контакта:', contactsArray.value.slice(0, 3));
  } catch (error) {
    console.error('[ContactTable] Ошибка загрузки контактов:', error);
    contactsArray.value = [];
  }
}

function onAnyFilterChange() {
  fetchContacts();
}

function resetFilters() {
  filterSearch.value = '';
  filterContactType.value = 'all';
  filterDateFrom.value = '';
  filterDateTo.value = '';
  filterNewMessages.value = '';
  filterBlocked.value = 'all';
  selectedTagIds.value = []; // Сбрасываем выбранные теги
  fetchContacts();
}

function formatDateOnly(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}
async function showDetails(contact) {
  if (props.markContactAsRead) {
    await props.markContactAsRead(contact.id);
  }
  if (props.markMessagesAsReadForUser) {
    props.markMessagesAsReadForUser(contact.id);
  }
  router.push({ name: 'contact-details', params: { id: contact.id } });
}

function onImported() {
  showImportModal.value = false;
  fetchContacts();
}

async function openChatForSelected() {
  if (selectedIds.value.length === 0) return;
  
  // Берем первый выбранный контакт
  const contactId = selectedIds.value[0];
  
  // Находим контакт в списке
  const contact = contactsArray.value.find(c => c.id === contactId);
  if (!contact) return;
  
  // Открываем чат с этим контактом (user_chat)
  await showDetails(contact);
}

async function openPrivateChatForSelected(contact = null) {
  let targetContact = contact;
  
  // Если контакт не передан, берем из выбранных
  if (!targetContact) {
    if (selectedIds.value.length === 0) {
      console.error('[ContactTable] Нет выбранных контактов');
      return;
    }
    
    // Берем первый выбранный контакт
    const contactId = selectedIds.value[0];
    console.log('[ContactTable] Ищем контакт с ID:', contactId);
    console.log('[ContactTable] Доступные контакты:', contactsArray.value.map(c => ({ id: c.id, name: c.name })));
    
    // Находим контакт в списке
    targetContact = contactsArray.value.find(c => c.id === contactId);
    if (!targetContact) {
      console.error('[ContactTable] Контакт не найден с ID:', contactId);
      return;
    }
  }
  
  // Проверяем, что у контакта есть ID
  if (!targetContact.id) {
    console.error('[ContactTable] У контакта нет ID:', targetContact);
    return;
  }
  
  console.log('[ContactTable] Открываем приватный чат с контактом:', targetContact);
  
  // Открываем приватный чат с этим контактом (admin_chat)
  router.push({ name: 'admin-chat', params: { adminId: targetContact.id } });
}

function goToPersonalMessages() {
  router.push({ name: 'personal-messages' });
}

function toggleSelectAll() {
  if (selectAll.value) {
    selectedIds.value = contactsArray.value.map(c => c.id);
  } else {
    selectedIds.value = [];
  }
}

watch(contactsArray, () => {
  // Сбросить выбор при обновлении данных
  selectedIds.value = [];
  selectAll.value = false;
});

async function deleteSelected() {
  if (!selectedIds.value.length) return;
  try {
    await ElMessageBox.confirm(
      `Вы действительно хотите удалить ${selectedIds.value.length} контакт(ов)?`,
      'Подтверждение удаления',
      { type: 'warning' }
    );
    for (const id of selectedIds.value) {
      await fetch(`/api/users/${id}`, { method: 'DELETE' });
    }
    ElMessage.success('Контакты удалены');
    fetchContacts();
    selectedIds.value = [];
    selectAll.value = false;
  } catch (e) {
    // Отмена
  }
}

async function deleteMessagesSelected() {
  if (!selectedIds.value.length) return;
  try {
    await ElMessageBox.confirm(
      `Вы действительно хотите удалить историю сообщений для ${selectedIds.value.length} контакт(ов)? Это действие необратимо.`,
      'Подтверждение удаления сообщений',
      { type: 'warning' }
    );
    
    let deletedMessages = 0;
    let deletedConversations = 0;
    
    for (const id of selectedIds.value) {
      try {
        const result = await messagesService.deleteMessagesHistory(id);
        if (result.success) {
          deletedMessages += result.deletedMessages || 0;
          deletedConversations += result.deletedConversations || 0;
        }
      } catch (error) {
        // console.error(`Ошибка при удалении сообщений для контакта ${id}:`, error);
      }
    }
    
    ElMessage.success(`Удалено сообщений: ${deletedMessages}, бесед: ${deletedConversations}`);
    selectedIds.value = [];
    selectAll.value = false;
  } catch (e) {
    // Отмена
  }
}
</script>

<style scoped>
.contact-table-modal {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.12);
  padding: 32px 24px 24px 24px;
  width: 100%;
  margin-top: 40px;
  position: relative;
  overflow-x: auto;
}
.contact-table-header {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
  position: relative;
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
.contact-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  font-size: 1.05rem;
}
.contact-table thead th {
  position: sticky;
  top: 0;
  background: #f5f7fa;
  font-weight: 700;
  padding: 14px 12px;
  border-bottom: 2px solid #e5e7eb;
  z-index: 2;
}
.contact-table tbody tr {
  transition: background 0.18s;
}
.contact-table tbody tr:nth-child(even) {
  background: #f8fafc;
}
.contact-table tbody tr:hover {
  background: #e6f7ff;
}
.contact-table td {
  padding: 12px 12px;
  border-bottom: 1px solid #f0f0f0;
  vertical-align: middle;
  word-break: break-word;
}
.contact-table th:first-child, .contact-table td:first-child {
  border-top-left-radius: 8px;
}
.contact-table th:last-child, .contact-table td:last-child {
  border-top-right-radius: 8px;
}
@media (max-width: 700px) {
  .contact-table-modal {
    padding: 12px 2px;
    max-width: 100vw;
  }
  .contact-table th, .contact-table td {
    padding: 8px 4px;
    font-size: 0.95rem;
  }
  .contact-table-header h2 {
    font-size: 1.1rem;
  }
}
.details-btn {
  background: #17a2b8;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  cursor: pointer;
  font-size: 0.98rem;
  transition: background 0.2s;
}
.details-btn:hover {
  background: #138496;
}
.new-contact-row {
  background: #e6ffe6 !important;
  transition: background 0.3s;
}
.filters-form {
  display: flex;
  flex-wrap: wrap;
  gap: 1.2em 1.5em;
  align-items: flex-end;
  background: #f7f9fa;
  border-radius: 12px;
  padding: 1.2em 1em 0.7em 1em;
  margin-bottom: 1.2em;
}
@media (max-width: 900px) {
  .filters-form {
    flex-direction: column;
    gap: 0.7em 0;
  }
}
.new-msg-icon {
  color: #ff9800;
  font-size: 1.2em;
  margin-left: 4px;
}

.admin-badge {
  background: #e3f2fd;
  color: #1976d2;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.85em;
  font-weight: 500;
}

.user-badge {
  background: #f3e5f5;
  color: #7b1fa2;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.85em;
  font-weight: 500;
}
</style> 