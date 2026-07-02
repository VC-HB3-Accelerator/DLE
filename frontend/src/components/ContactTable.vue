<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <div class="contact-table-modal">
    <div class="contact-table-header">
      <!-- Кнопка "Личные сообщения" для всех пользователей -->
      <el-button v-if="canChatWithAdmins" type="info" @click="goToPersonalMessages" style="margin-right: 1em;">
        Личные сообщения
        <el-badge v-if="privateUnreadCount > 0" :value="privateUnreadCount" class="notification-badge" />
      </el-button>
      <el-button v-if="canSendToUsers" type="success" :disabled="!hasSelectedEditor" @click="sendPublicMessage" style="margin-right: 1em;">Публичное сообщение</el-button>
      <el-button v-if="canViewContacts" type="warning" :disabled="!hasSelectedEditor" @click="sendPrivateMessage" style="margin-right: 1em;">Приватное сообщение</el-button>
      <el-button v-if="canManageSettings" type="info" :disabled="!selectedIds.length" @click="goToBroadcastPage" style="margin-right: 1em;">Рассылка</el-button>
      <el-button v-if="canDeleteMessages" type="warning" :disabled="!selectedIds.length" @click="deleteMessagesSelected" style="margin-right: 1em;">Удалить сообщения</el-button>
      <el-button v-if="canDeleteData" type="danger" :disabled="!selectedIds.length" @click="deleteSelected" style="margin-right: 1em;">Удалить</el-button>
      <el-button v-if="canEditData" type="primary" @click="showImportModal = true" style="margin-right: 1em;">Импорт</el-button>
      <span v-if="selectedIds.length" class="selection-info">Выбрано: {{ selectedIds.length }}</span>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>
    <el-form v-if="isEditorRole" :inline="true" class="filters-form" label-position="top">
      <el-form-item label="Поиск">
        <el-input v-model="filterSearch" placeholder="Поиск по имени, email, telegram, кошельку" clearable @input="onSearchInput" />
      </el-form-item>
      <el-form-item label="Тип контакта">
        <el-select v-model="filterContactType" placeholder="Все" style="min-width:120px;" @change="() => applyFilters(true)">
          <el-option label="Все" value="all" />
          <el-option label="Email" value="email" />
          <el-option label="Telegram" value="telegram" />
          <el-option label="Кошелек" value="wallet" />
        </el-select>
      </el-form-item>
      <el-form-item label="Дата от">
        <el-date-picker v-model="filterDateFrom" type="date" placeholder="Дата от" clearable style="width: 100%;" @change="() => applyFilters(true)" />
      </el-form-item>
      <el-form-item label="Дата до">
        <el-date-picker v-model="filterDateTo" type="date" placeholder="Дата до" clearable style="width: 100%;" @change="() => applyFilters(true)" />
      </el-form-item>
      <el-form-item label="Только с новыми сообщениями">
        <el-select v-model="filterNewMessages" placeholder="Нет" style="min-width:110px;" @change="() => applyFilters(true)">
          <el-option label="Нет" :value="''" />
          <el-option label="Да" value="yes" />
        </el-select>
      </el-form-item>
      <el-form-item label="Блокировка">
        <el-select v-model="filterBlocked" placeholder="Все" style="min-width:120px;" @change="() => applyFilters(true)">
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
          @change="() => applyFilters(true)"
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
            <th v-if="canViewContacts"><input type="checkbox" v-model="selectAll" @change="toggleSelectAll" /></th>
            <th>ID</th>
            <th>Тип</th>
            <th>Имя</th>
            <th>Email</th>
            <th>Telegram</th>
            <th>Кошелек</th>
            <th>Дата создания</th>
          </tr>
        </thead>
      <tbody>
        <tr v-if="isLoadingContacts">
          <td :colspan="canViewContacts ? 8 : 7" class="loading-row">Загрузка контактов...</td>
        </tr>
        <tr v-else-if="!pageContacts.length">
          <td :colspan="canViewContacts ? 8 : 7" class="loading-row">Контакты не найдены</td>
        </tr>
        <tr v-for="contact in pageContacts" :key="contact.id" :class="{ 'new-contact-row': newIds.includes(contact.id) }" @click="goToContactDetails(contact.id)" style="cursor: pointer;">
          <td v-if="canViewContacts" @click.stop><input type="checkbox" v-model="selectedIds" :value="contact.id" /></td>
          <td>{{ contact.id }}</td>
          <td>
            <span 
              v-if="getRoleDisplayName(contact.role)" 
              :class="getRoleClass(contact.role)"
            >
              {{ getRoleDisplayName(contact.role) }}
            </span>
            <span v-else class="user-badge">Неизвестно</span>
          </td>
          <td>{{ contact.name || '-' }}</td>
          <td>{{ maskPersonalData(contact.email) }}</td>
          <td>{{ maskPersonalData(contact.telegram) }}</td>
          <td>{{ maskPersonalData(contact.wallet) }}</td>
          <td>{{ contact.created_at ? new Date(contact.created_at).toLocaleString() : '-' }}</td>
        </tr>
      </tbody>
    </table>
    <div v-if="totalContacts > 0" class="contacts-pagination">
      <div class="pagination-size">
        <span class="pagination-size-label">На странице:</span>
        <el-select
          v-model="pageSize"
          :disabled="isLoadingContacts"
          style="min-width: 100px;"
          @change="onPageSizeChange"
        >
          <el-option
            v-for="size in PAGE_SIZE_OPTIONS"
            :key="size"
            :label="String(size)"
            :value="size"
          />
        </el-select>
      </div>
      <el-pagination
        v-if="totalContacts > pageSize"
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="totalContacts"
        layout="total, prev, pager, next"
        @current-change="onPageChange"
      />
    </div>
    <ImportContactsModal v-if="showImportModal" @close="showImportModal = false" @imported="onImported" />
  </div>
</template>

<script setup>
import { defineProps, computed, ref, onMounted, watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElSelect, ElOption, ElForm, ElFormItem, ElInput, ElDatePicker, ElButton, ElMessageBox, ElMessage, ElPagination } from 'element-plus';
import ImportContactsModal from './ImportContactsModal.vue';
import messagesService from '../services/messagesService';
import { getContacts } from '../services/contactsService';
import { usePermissions } from '@/composables/usePermissions';
import { useAuthContext } from '@/composables/useAuth';
import { PERMISSIONS } from './permissions.js';
import { getPrivateUnreadCount } from '../services/messagesService';
import { useRoles } from '@/composables/useRoles';
const props = defineProps({
  contacts: { type: Array, default: () => [] },
  newContacts: { type: Array, default: () => [] },
  newMessages: { type: Array, default: () => [] },
  markMessagesAsReadForUser: { type: Function, default: null },
  markContactAsRead: { type: Function, default: null }
});

const PAGE_SIZE_OPTIONS = [100, 500, 1000];
const newIds = computed(() => props.newContacts.map(c => c.id));
const router = useRouter();
const { canViewContacts, canSendToUsers, canDeleteData, canDeleteMessages, canManageSettings, canChatWithAdmins, canEditData, hasPermission } = usePermissions();
const { userAccessLevel, userId, isAuthenticated } = useAuthContext();
const { getRoleDisplayName, getRoleClass, fetchRoles } = useRoles();

const pageContacts = ref([]);
const totalContacts = ref(0);
const currentPage = ref(1);
const pageSize = ref(1000);
const isLoadingContacts = ref(false);
const selectedContactsCache = ref({});

// Фильтры
const filterSearch = ref('');
const filterContactType = ref('all');
const filterDateFrom = ref('');
const filterDateTo = ref('');
const filterNewMessages = ref('');
const filterBlocked = ref('all');

// Уведомления для приватных сообщений
const privateUnreadCount = ref(0);

// Функция для загрузки количества непрочитанных приватных сообщений
async function loadPrivateUnreadCount() {
  try {
    const response = await getPrivateUnreadCount();
    if (response.success) {
      privateUnreadCount.value = response.unreadCount || 0;
    }
  } catch (error) {
    console.error('[ContactTable] Ошибка загрузки непрочитанных сообщений:', error);
    privateUnreadCount.value = 0;
  }
}

// Функция маскировки персональных данных для читателей
function maskPersonalData(data) {
  if (!data || data === '-') return '-';
  
  // Если пользователь имеет права редактора, показываем полные данные
  if (hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS)) {
    return data;
  }
  
  // Для читателей маскируем данные полностью звездочками
  return '***';
}

// Новый фильтр тегов через мультисвязи
const availableTags = ref([]);
const selectedTagIds = ref([]);

const showImportModal = ref(false);

const selectedIds = ref([]);
const selectAll = ref(false);
let searchDebounceTimer = null;

function cacheContacts(contacts) {
  for (const contact of contacts) {
    selectedContactsCache.value[contact.id] = contact;
  }
}

function getContactByIdLocal(id) {
  return selectedContactsCache.value[id] || pageContacts.value.find(c => c.id === id);
}

const hasSelectedEditor = computed(() => {
  return selectedIds.value.some(id => getContactByIdLocal(id)?.role === 'editor');
});

const isEditorRole = computed(() => userAccessLevel.value?.level === 'editor');

function buildFilterParams() {
  const params = {
    limit: pageSize.value,
    offset: (currentPage.value - 1) * pageSize.value
  };
  if (selectedTagIds.value.length > 0) params.tagIds = selectedTagIds.value.join(',');
  if (filterDateFrom.value) params.dateFrom = formatDateOnly(filterDateFrom.value);
  if (filterDateTo.value) params.dateTo = formatDateOnly(filterDateTo.value);
  if (filterContactType.value && filterContactType.value !== 'all') params.contactType = filterContactType.value;
  if (filterSearch.value) params.search = filterSearch.value;
  if (filterNewMessages.value) params.newMessages = filterNewMessages.value;
  if (filterBlocked.value && filterBlocked.value !== 'all') params.blocked = filterBlocked.value;
  return params;
}

async function loadContactsPage() {
  if (!isAuthenticated.value) return;
  isLoadingContacts.value = true;
  try {
    const result = await getContacts(buildFilterParams());
    pageContacts.value = result.contacts || [];
    totalContacts.value = result.total || 0;
    cacheContacts(pageContacts.value);
    updateSelectAllState();
  } catch (error) {
    console.error('[ContactTable] Ошибка загрузки контактов:', error);
    pageContacts.value = [];
    totalContacts.value = 0;
  } finally {
    isLoadingContacts.value = false;
  }
}

function updateSelectAllState() {
  const pageIds = pageContacts.value.map(c => c.id);
  selectAll.value = pageIds.length > 0 && pageIds.every(id => selectedIds.value.includes(id));
}

function applyFilters(resetPage = true) {
  if (resetPage) currentPage.value = 1;
  selectedIds.value = [];
  selectAll.value = false;
  loadContactsPage();
}

function onSearchInput() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => applyFilters(true), 350);
}

function onPageChange(page) {
  currentPage.value = page;
  loadContactsPage();
}

function onPageSizeChange() {
  if (!PAGE_SIZE_OPTIONS.includes(pageSize.value)) {
    pageSize.value = 1000;
  }
  currentPage.value = 1;
  loadContactsPage();
}

watch(selectedIds, () => {
  cacheContacts(pageContacts.value.filter(c => selectedIds.value.includes(c.id)));
  updateSelectAllState();
}, { deep: true });

// WebSocket для обновления контактов в реальном времени
let ws = null;

function setupContactsWebSocket() {
  if (ws) {
    ws.close();
  }
  
  const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${wsProtocol}://${window.location.host}/ws`);
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'contacts-updated') {
      fetchRoles();
      loadContactsPage();
    }
  };
  
  ws.onopen = () => {
    console.log('[ContactTable] WebSocket подключен для обновления контактов');
  };
  
  ws.onerror = (error) => {
    console.error('[ContactTable] WebSocket ошибка:', error);
  };
}

onMounted(async () => {
  if (isAuthenticated.value) {
    try {
      await fetchRoles();
      await loadPrivateUnreadCount();
      await loadContactsPage();
    } catch (error) {
      console.log('[ContactTable] Ошибка загрузки в onMounted:', error.message);
    }
  }
  setupContactsWebSocket();
});

watch(isAuthenticated, async (newValue) => {
  if (newValue) {
    try {
      await fetchRoles();
      await loadContactsPage();
    } catch (error) {
      console.log('[ContactTable] Ошибка загрузки после авторизации:', error.message);
    }
  } else {
    pageContacts.value = [];
    totalContacts.value = 0;
    selectedIds.value = [];
    selectAll.value = false;
  }
});

onUnmounted(() => {
  if (ws) {
    ws.close();
    ws = null;
  }
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
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

function resetFilters() {
  filterSearch.value = '';
  filterContactType.value = 'all';
  filterDateFrom.value = '';
  filterDateTo.value = '';
  filterNewMessages.value = '';
  filterBlocked.value = 'all';
  selectedTagIds.value = [];
  applyFilters(true);
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
async function goToContactDetails(contactId) {
  if (props.markContactAsRead) {
    await props.markContactAsRead(contactId);
  }
  if (props.markMessagesAsReadForUser) {
    props.markMessagesAsReadForUser(contactId);
  }
  router.push({ name: 'contact-details', params: { id: contactId } });
}

function onImported() {
  showImportModal.value = false;
  applyFilters(true);
}

async function openChatForSelected() {
  if (selectedIds.value.length === 0) return;
  
  // Берем первый выбранный контакт
  const contactId = selectedIds.value[0];
  
  // Находим контакт в списке
  const contact = getContactByIdLocal(contactId);
  if (!contact) return;
  
  // Открываем чат с этим контактом (user_chat)
  await goToContactDetails(contact.id);
}

// Новая функция для отправки публичного сообщения
function sendPublicMessage() {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('Выберите контакт для отправки публичного сообщения');
    return;
  }
  
  const contactId = selectedIds.value[0];
  const contact = getContactByIdLocal(contactId);
  if (!contact) {
    ElMessage.error('Контакт не найден');
    return;
  }
  
  // Открываем страницу детали контакта с чатом для публичных сообщений
  goToContactDetails(contactId);
}

// Функция для открытия приватного чата
function sendPrivateMessage() {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('Выберите контакт для отправки приватного сообщения');
    return;
  }
  
  // Открываем приватный чат вместо отправки через prompt
  openPrivateChatForSelected();
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
    targetContact = getContactByIdLocal(contactId);
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

function goToBroadcastPage() {
  if (!selectedIds.value.length) {
    ElMessage.warning('Выберите пользователей для рассылки');
    return;
  }
  router.push({
    name: 'contacts-broadcast',
    query: { ids: selectedIds.value.join(',') }
  });
}

function toggleSelectAll() {
  const pageIds = pageContacts.value.map(c => c.id);
  if (selectAll.value) {
    selectedIds.value = [...new Set([...selectedIds.value, ...pageIds])];
    cacheContacts(pageContacts.value);
  } else {
    selectedIds.value = selectedIds.value.filter(id => !pageIds.includes(id));
  }
}

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
    selectedIds.value = [];
    selectAll.value = false;
    await loadContactsPage();
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
  flex-wrap: wrap;
  gap: 0.5em;
  margin-bottom: 24px;
  position: relative;
}
.selection-info {
  margin-left: auto;
  margin-right: 3rem;
  font-weight: 600;
  color: var(--color-primary, #409eff);
}
.contacts-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 24px;
}
.pagination-size {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pagination-size-label {
  font-size: 0.95rem;
  color: #606266;
  white-space: nowrap;
}
.loading-row {
  text-align: center;
  padding: 24px;
  color: #888;
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
}

.editor-badge {
  background: #f3e5f5;
  color: #7b1fa2;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.85em;
}

.readonly-badge {
  background: #e8f5e8;
  color: #2e7d32;
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

.notification-badge {
  margin-left: 8px;
}
</style> 