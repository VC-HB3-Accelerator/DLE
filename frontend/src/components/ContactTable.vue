<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
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
      <el-button v-if="canManageSettings" type="info" :disabled="!selectedIds.length" @click="showBroadcastModal = true" style="margin-right: 1em;">Рассылка</el-button>
      <el-button v-if="canDeleteMessages" type="warning" :disabled="!selectedIds.length" @click="deleteMessagesSelected" style="margin-right: 1em;">Удалить сообщения</el-button>
      <el-button v-if="canDeleteData" type="danger" :disabled="!selectedIds.length" @click="deleteSelected" style="margin-right: 1em;">Удалить</el-button>
      <el-button v-if="canEditData" type="primary" @click="showImportModal = true" style="margin-right: 1em;">Импорт</el-button>
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
        <tr v-for="contact in filteredContacts" :key="contact.id" :class="{ 'new-contact-row': newIds.includes(contact.id) }" @click="goToContactDetails(contact.id)" style="cursor: pointer;">
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
import { useContactsAndMessagesWebSocket } from '../composables/useContactsWebSocket';
import { usePermissions } from '@/composables/usePermissions';
import { useAuthContext } from '@/composables/useAuth';
import { PERMISSIONS } from './permissions.js';
import api from '../api/axios';
import { sendMessage, getPrivateUnreadCount } from '../services/messagesService';
import { useRoles } from '@/composables/useRoles';
const props = defineProps({
  contacts: { type: Array, default: () => [] },
  newContacts: { type: Array, default: () => [] },
  newMessages: { type: Array, default: () => [] },
  markMessagesAsReadForUser: { type: Function, default: null },
  markContactAsRead: { type: Function, default: null }
});
// Используем переданные через props данные вместо создания собственного массива
const contactsArray = computed(() => props.contacts || []);
const newIds = computed(() => props.newContacts.map(c => c.id));
const newMsgUserIds = computed(() => props.newMessages.map(m => String(m.user_id)));
const router = useRouter();
const { canViewContacts, canSendToUsers, canDeleteData, canDeleteMessages, canManageSettings, canChatWithAdmins, canEditData, hasPermission } = usePermissions();
const { userAccessLevel, userId, isAuthenticated } = useAuthContext();
const { roles, getRoleDisplayName, getRoleClass, fetchRoles, clearRoles } = useRoles();

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
const showBroadcastModal = ref(false);

const selectedIds = ref([]);
const selectAll = ref(false);

// Проверяем, есть ли среди выбранных контактов editor
const hasSelectedEditor = computed(() => {
  return selectedIds.value.some(id => {
    const contact = contactsArray.value.find(c => c.id === id);
    return contact?.role === 'editor';
  });
});

// Фильтрация контактов для USER - видит только editor админов и себя
const filteredContacts = computed(() => {
  console.log('[ContactTable] 🔍 Фильтрация контактов:');
  console.log('[ContactTable] userAccessLevel:', userAccessLevel.value);
  console.log('[ContactTable] userId:', userId.value);
  console.log('[ContactTable] Все контакты:', contactsArray.value);
  
  if (userAccessLevel.value?.level === 'user') {
    // USER видит только editor админов и себя
    const filtered = contactsArray.value.filter(contact => {
      const isEditor = contact.role === 'editor';  // Используем role вместо contact_type
      const isSelf = contact.id === userId.value;
      console.log(`[ContactTable] Контакт ${contact.id}: role=${contact.role}, contact_type=${contact.contact_type}, isEditor=${isEditor}, isSelf=${isSelf}`);
      console.log(`[ContactTable] Полный объект контакта:`, contact);
      return isEditor || isSelf;
    });
    console.log('[ContactTable] Отфильтрованные контакты:', filtered);
    return filtered;
  }
  
  // READONLY и EDITOR видят всех
  console.log('[ContactTable] Показываем всех (не user роль)');
  return contactsArray.value;
});

// WebSocket для тегов - ОТКЛЮЧАЕМ из-за циклических запросов
// const { onTagsUpdate } = useTagsWebSocket();
// let unsubscribeFromTags = null;
let lastTagsHash = ref(''); // Хеш последних загруженных тегов
let tagsUpdateInterval = null; // Интервал для периодического обновления тегов

// Реактивная загрузка ролей и контактов при авторизации
watch(isAuthenticated, async (newValue) => {
  if (newValue) {
    console.log('[ContactTable] Пользователь авторизован, загружаем роли');
    try {
      await fetchRoles();
      // Контакты загружаются автоматически через useContactsAndMessagesWebSocket
    } catch (error) {
      console.log('[ContactTable] Ошибка загрузки ролей (возможно, пользователь не авторизован):', error.message);
    }
  }
});

// Контакты обновляются автоматически через useContactsAndMessagesWebSocket при смене пользователя

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
      console.log('[ContactTable] Получено WebSocket уведомление об обновлении контактов');
      // Контакты обновляются автоматически через useContactsAndMessagesWebSocket
      fetchRoles(); // Обновляем роли
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
  // Контакты загружаются автоматически через useContactsAndMessagesWebSocket
  // Загружаем роли только если пользователь авторизован
  if (isAuthenticated.value) {
    try {
      await fetchRoles();
      await loadPrivateUnreadCount();
    } catch (error) {
      console.log('[ContactTable] Ошибка загрузки ролей в onMounted:', error.message);
    }
  }
  
  // Настраиваем WebSocket для обновления контактов в реальном времени
  setupContactsWebSocket();
  
  // ContactTable - дочерний компонент, данные управляются через props
  // Централизованные события обрабатываются в родительском компоненте (ContactsView)
  // Здесь только очищаем локальные состояния таблицы при изменении props.contacts
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
  
  // Закрываем WebSocket для контактов
  if (ws) {
    ws.close();
    ws = null;
  }
  
  // Удаляем обработчики централизованных событий
  window.removeEventListener('clear-application-data', () => {});
  window.removeEventListener('refresh-application-data', () => {});
  
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

// Функция fetchContacts больше не нужна - данные загружаются через useContactsAndMessagesWebSocket

// Фильтрация происходит реактивно через computed свойство filteredContacts

function resetFilters() {
  filterSearch.value = '';
  filterContactType.value = 'all';
  filterDateFrom.value = '';
  filterDateTo.value = '';
  filterNewMessages.value = '';
  filterBlocked.value = 'all';
  selectedTagIds.value = []; // Сбрасываем выбранные теги
  // Фильтрация происходит реактивно через computed свойство filteredContacts
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
  // Контакты обновляются автоматически через useContactsAndMessagesWebSocket
}

async function openChatForSelected() {
  if (selectedIds.value.length === 0) return;
  
  // Берем первый выбранный контакт
  const contactId = selectedIds.value[0];
  
  // Находим контакт в списке
  const contact = filteredContacts.value.find(c => c.id === contactId);
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
  const contact = filteredContacts.value.find(c => c.id === contactId);
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
    console.log('[ContactTable] Ищем контакт с ID:', contactId);
    console.log('[ContactTable] Доступные контакты:', contactsArray.value.map(c => ({ id: c.id, name: c.name })));
    
    // Находим контакт в списке
    targetContact = filteredContacts.value.find(c => c.id === contactId);
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
    selectedIds.value = filteredContacts.value.map(c => c.id);
  } else {
    selectedIds.value = [];
  }
}

watch(contactsArray, (newContacts, oldContacts) => {
  console.log('[ContactTable] Contacts array changed:', {
    oldLength: oldContacts?.length || 0,
    newLength: newContacts?.length || 0
  });
  
  // Сбросить выбор при обновлении данных
  selectedIds.value = [];
  selectAll.value = false;
  
  // Если контакты очищены (например, при отключении кошелька), очищаем и локальные фильтры
  if (newContacts?.length === 0 && oldContacts?.length > 0) {
    console.log('[ContactTable] Contacts cleared, resetting filters');
    filterSearch.value = '';
    filterContactType.value = 'all';
    filterDateFrom.value = null;
    filterDateTo.value = null;
    filterNewMessages.value = '';
    filterBlocked.value = 'all';
  }
});

// Функция для обработки изменений фильтров
const onAnyFilterChange = () => {
  // Просто сбрасываем выбор при изменении фильтров
  selectedIds.value = [];
  selectAll.value = false;
};

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
    // Контакты обновляются автоматически через useContactsAndMessagesWebSocket
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