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
    <div v-if="!canRead" class="empty-table-placeholder">Нет доступа</div>
    <div v-else class="contact-details-page">
    <div v-if="isLoading">Загрузка...</div>
    <div v-else-if="!contact">Контакт не найден</div>
    <div v-else class="contact-details-content">
      <div class="contact-details-header">
        <h2>Детали контакта</h2>
          <button class="close-btn" @click="goBack">×</button>
      </div>
      <div class="contact-info-block">
        <div>
          <strong>Имя:</strong>
            <template v-if="canEdit">
          <input v-model="editableName" class="edit-input" @blur="saveName" @keyup.enter="saveName" />
          <span v-if="isSavingName" class="saving">Сохранение...</span>
            </template>
            <template v-else>
              {{ contact.name }}
            </template>
        </div>
        <div><strong>Email:</strong> {{ contact.email || '-' }}</div>
        <div><strong>Telegram:</strong> {{ contact.telegram || '-' }}</div>
        <div><strong>Кошелек:</strong> {{ contact.wallet || '-' }}</div>
        <div>
          <strong>Язык:</strong>
          <div class="multi-select">
            <div class="selected-langs">
              <span v-for="lang in selectedLanguages" :key="lang" class="lang-tag">
                {{ getLanguageLabel(lang) }}
                <span v-if="canEdit" class="remove-tag" @click="removeLanguage(lang)">×</span>
              </span>
              <input
                v-if="canEdit"
                v-model="langInput"
                @focus="showLangDropdown = true"
                @input="showLangDropdown = true"
                @keydown.enter.prevent="addLanguageFromInput"
                class="lang-input"
                placeholder="Добавить язык..."
              />
            </div>
            <ul v-if="showLangDropdown && canEdit" class="lang-dropdown">
              <li
                v-for="lang in filteredLanguages"
                :key="lang.value"
                @mousedown.prevent="addLanguage(lang.value)"
                :class="{ selected: selectedLanguages.includes(lang.value) }"
              >
                {{ lang.label }}
              </li>
            </ul>
          </div>
          <span v-if="isSavingLangs" class="saving">Сохранение...</span>
        </div>
        <div><strong>Дата создания:</strong> {{ formatDate(contact.created_at) }}</div>
        <div><strong>Дата последнего сообщения:</strong> {{ formatDate(lastMessageDate) }}</div>
        <div class="user-tags-block">
          <strong>Теги пользователя:</strong>
          <span v-for="tag in userTags" :key="tag.id" class="user-tag">
            {{ tag.name }}
            <span v-if="canEdit" class="remove-tag" @click="removeUserTag(tag.id)">×</span>
          </span>
          <button v-if="canEdit" class="add-tag-btn" @click="openTagModal">Добавить тег</button>
        </div>
        <div class="block-user-section">
          <strong>Статус блокировки:</strong>
          <span v-if="contact.is_blocked" class="blocked-status">Заблокирован</span>
          <span v-else class="unblocked-status">Не заблокирован</span>
          <template v-if="canEdit">
            <el-button
              v-if="!contact.is_blocked"
              type="danger"
              size="small"
              @click="blockUser"
              style="margin-left: 1em;"
            >Заблокировать</el-button>
            <el-button
              v-else
              type="success"
              size="small"
              @click="unblockUser"
              style="margin-left: 1em;"
            >Разблокировать</el-button>
          </template>
        </div>
        <div class="delete-actions">
          <button class="delete-history-btn" @click="deleteMessagesHistory">Удалить историю сообщений</button>
          <button class="delete-btn" @click="deleteContact">Удалить контакт</button>
        </div>
      </div>
      <div class="messages-block">
        <h3>Чат с пользователем</h3>
        <ChatInterface
          :messages="messages"
          :isLoading="isLoadingMessages"
          :attachments="chatAttachments"
          :newMessage="chatNewMessage"
          :isAdmin="canEdit"
          @send-message="handleSendMessage"
          @update:newMessage="val => chatNewMessage = val"
          @update:attachments="val => chatAttachments = val"
          @ai-reply="handleAiReply"
        />
      </div>
      <el-dialog v-if="canEdit" v-model="showTagModal" title="Добавить тег пользователю">
        <div v-if="allTags.length">
          <el-select
            v-model="selectedTags"
            multiple
            filterable
            placeholder="Выберите теги"
            @change="addTagsToUser"
          >
            <el-option
              v-for="tag in allTags"
              :key="tag.id"
              :label="tag.name"
              :value="tag.id"
            />
          </el-select>
          <div style="margin-top: 1em; color: #888; font-size: 0.95em;">
            <strong>Существующие теги:</strong>
            <span v-for="tag in allTags" :key="'list-' + tag.id" style="margin-right: 0.7em;">
              {{ tag.name }}<span v-if="tag.description"> ({{ tag.description }})</span>
            </span>
          </div>
        </div>
        <div style="margin-top: 1em;">
          <el-input v-model="newTagName" placeholder="Новый тег" />
          <el-input v-model="newTagDescription" placeholder="Описание" />
          <el-button type="primary" @click="createTag">Создать тег</el-button>
        </div>
      </el-dialog>
    </div>
  </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import Message from '../../components/Message.vue';
import ChatInterface from '../../components/ChatInterface.vue';
import contactsService from '../../services/contactsService.js';
import messagesService from '../../services/messagesService.js';
import { useAuthContext } from '@/composables/useAuth';
import { usePermissions } from '@/composables/usePermissions';
import { ElMessageBox } from 'element-plus';
import tablesService from '../../services/tablesService';
import { useTagsWebSocket } from '../../composables/useTagsWebSocket';

const route = useRoute();
const router = useRouter();
const userId = computed(() => route.params.id);
const contact = ref(null);
const isLoading = ref(true);
const isLoadingMessages = ref(false);
const lastMessageDate = ref(null);
const editableName = ref('');
const isSavingName = ref(false);
const isSavingLangs = ref(false);
const userTags = ref([]);
const allTags = ref([]);
const selectedTags = ref([]);
const showTagModal = ref(false);
const newTagName = ref('');
const newTagDescription = ref('');
const messages = ref([]);
const chatAttachments = ref([]);
const chatNewMessage = ref('');
const { isAdmin } = useAuthContext();
const { canRead, canEdit, canDelete } = usePermissions();
const isAiLoading = ref(false);
const conversationId = ref(null);

// id таблицы тегов (будет найден или создан)
const tagsTableId = ref(null);

// WebSocket для тегов
const { onTagsUpdate } = useTagsWebSocket();
let unsubscribeFromTags = null;

async function ensureTagsTable() {
  // Получаем все пользовательские таблицы
  const tables = await tablesService.getTables();
  let tagsTable = tables.find(t => t.name === 'Теги клиентов');
  
  if (!tagsTable) {
    // Если таблицы нет — создаём
    tagsTable = await tablesService.createTable({
      name: 'Теги клиентов',
      description: 'Справочник тегов для контактов',
      isRagSourceId: 2 // не источник для RAG по умолчанию
    });
    
    // Добавляем столбцы параллельно
    await Promise.all([
      tablesService.addColumn(tagsTable.id, { name: 'Название', type: 'text' }),
      tablesService.addColumn(tagsTable.id, { name: 'Описание', type: 'text' })
    ]);
  } else {
    // Проверяем, есть ли нужные столбцы, если таблица уже была создана
    const table = await tablesService.getTable(tagsTable.id);
    const hasName = table.columns.some(col => col.name === 'Название');
    const hasDesc = table.columns.some(col => col.name === 'Описание');
    
    // Добавляем недостающие столбцы параллельно
    const addColumnPromises = [];
    if (!hasName) addColumnPromises.push(tablesService.addColumn(tagsTable.id, { name: 'Название', type: 'text' }));
    if (!hasDesc) addColumnPromises.push(tablesService.addColumn(tagsTable.id, { name: 'Описание', type: 'text' }));
    
    if (addColumnPromises.length > 0) {
      await Promise.all(addColumnPromises);
  }
  }
  
  tagsTableId.value = tagsTable.id;
  return tagsTable.id;
}

async function loadAllTags() {
  // Убедимся, что таблица тегов есть
  const tableId = await ensureTagsTable();
  // Загружаем все строки из таблицы тегов
  const table = await tablesService.getTable(tableId);
  // Ожидаем, что первый столбец — название тега, второй — описание (если есть)
  const nameCol = table.columns[0];
  const descCol = table.columns[1];
  allTags.value = table.rows.map(row => {
    const nameCell = table.cellValues.find(c => c.row_id === row.id && c.column_id === nameCol.id);
    const descCell = descCol ? table.cellValues.find(c => c.row_id === row.id && c.column_id === descCol.id) : null;
    return {
      id: row.id,
      name: nameCell ? nameCell.value : '',
      description: descCell ? descCell.value : ''
    };
  });
}

function openTagModal() {
  if (!canEdit.value) return;
  showTagModal.value = true;
  loadAllTags();
}

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value;
}

// --- Языки ---
const allLanguages = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'zh', label: '中文' },
  { value: 'ar', label: 'العربية' },
  { value: 'pt', label: 'Português' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: '日本語' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'pl', label: 'Polski' },
  { value: 'uk', label: 'Українська' },
  { value: 'other', label: 'Другое' }
];
const selectedLanguages = ref([]);
const langInput = ref('');
const showLangDropdown = ref(false);
const filteredLanguages = computed(() => {
  const input = langInput.value.toLowerCase();
  return allLanguages.filter(
    l => !selectedLanguages.value.includes(l.value) && l.label.toLowerCase().includes(input)
  );
});
function getLanguageLabel(val) {
  const found = allLanguages.find(l => l.value === val);
  return found ? found.label : val;
}
function addLanguage(lang) {
  if (!canEdit.value) return;
  if (!selectedLanguages.value.includes(lang)) {
    selectedLanguages.value.push(lang);
    saveLanguages();
  }
  langInput.value = '';
  showLangDropdown.value = false;
}
function addLanguageFromInput() {
  if (!canEdit.value) return;
  const found = filteredLanguages.value[0];
  if (found) addLanguage(found.value);
}
function removeLanguage(lang) {
  if (!canEdit.value) return;
  selectedLanguages.value = selectedLanguages.value.filter(l => l !== lang);
  saveLanguages();
}
function saveLanguages() {
  if (!canEdit.value) return;
  isSavingLangs.value = true;
  contactsService.updateContact(contact.value.id, { language: selectedLanguages.value })
    .then(() => reloadContact())
    .finally(() => { isSavingLangs.value = false; });
}

// --- Имя ---
function saveName() {
  if (editableName.value !== contact.value.name) {
    isSavingName.value = true;
    contactsService.updateContact(contact.value.id, { name: editableName.value })
      .then(() => reloadContact())
      .finally(() => { isSavingName.value = false; });
  }
}

// --- Удаление ---
async function deleteMessagesHistory() {
  if (!contact.value || !contact.value.id) return;
  
  try {
    const confirmed = await ElMessageBox.confirm(
      'Вы действительно хотите удалить всю историю сообщений этого пользователя? Это действие необратимо.',
      'Подтверждение удаления',
      {
        confirmButtonText: 'Удалить',
        cancelButtonText: 'Отмена',
        type: 'warning'
      }
    );
    
    if (confirmed) {
      const result = await messagesService.deleteMessagesHistory(contact.value.id);
      if (result.success) {
        ElMessageBox.alert(
          `История сообщений успешно удалена. Удалено сообщений: ${result.deletedMessages}, бесед: ${result.deletedConversations}`,
          'Успех',
          { type: 'success' }
        );
        // Обновляем список сообщений
        await loadMessages();
      } else {
        throw new Error('Не удалось удалить историю сообщений');
      }
    }
  } catch (e) {
    if (e !== 'cancel') {
      ElMessageBox.alert(
        'Ошибка при удалении истории сообщений: ' + (e?.response?.data?.error || e?.message || e),
        'Ошибка',
        { type: 'error' }
      );
    }
  }
}

function deleteContact() {
  router.push({ name: 'contact-delete-confirm', params: { id: contact.value.id } });
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}
async function loadMessages() {
  if (!contact.value || !contact.value.id) return;
  
  console.log('[ContactDetailsView] 📥 loadMessages START for:', contact.value.id);
  isLoadingMessages.value = true;
  try {
    // Загружаем ВСЕ публичные сообщения этого пользователя (как на главной странице)
    const loadedMessages = await messagesService.getMessagesByUserId(contact.value.id);
    console.log('[ContactDetailsView] 📩 Loaded messages:', loadedMessages.length, 'for', contact.value.id);
    
    messages.value = loadedMessages;
    
    if (messages.value.length > 0) {
      lastMessageDate.value = messages.value[messages.value.length - 1].created_at;
    } else {
      lastMessageDate.value = null;
    }
    
    // Получаем conversationId только для зарегистрированных пользователей
    // Гости не имеют conversations
    if (!contact.value.id.startsWith('guest_')) {
      try {
        const conv = await messagesService.getConversationByUserId(contact.value.id);
        conversationId.value = conv?.id || null;
      } catch (convError) {
        console.warn('[ContactDetailsView] Не удалось загрузить conversationId:', convError.message);
        conversationId.value = null;
      }
    } else {
      conversationId.value = null; // Гости не имеют conversationId
    }
    
    console.log('[ContactDetailsView] ✅ loadMessages DONE, messages count:', messages.value.length);
  } catch (e) {
    console.error('[ContactDetailsView] ❌ Ошибка загрузки сообщений:', e);
    messages.value = [];
    lastMessageDate.value = null;
    conversationId.value = null;
  } finally {
    isLoadingMessages.value = false;
  }
}

async function reloadContact() {
  isLoading.value = true;
  try {
    contact.value = await contactsService.getContactById(userId.value);
    editableName.value = contact.value?.name || '';
    selectedLanguages.value = Array.isArray(contact.value?.preferred_language)
      ? contact.value.preferred_language
      : (contact.value?.preferred_language ? [contact.value.preferred_language] : []);
  } catch (e) {
    contact.value = null;
  } finally {
    isLoading.value = false;
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push({ name: 'crm' });
  }
}

async function handleSendMessage({ message, attachments }) {
  if (!contact.value || !contact.value.id) return;
  if (contact.value.is_blocked) {
    if (typeof ElMessageBox === 'function') {
      ElMessageBox.alert('Пользователь заблокирован. Отправка сообщений невозможна.', 'Ошибка', { type: 'error' });
    } else {
      console.error('Пользователь заблокирован. Отправка сообщений невозможна.');
    }
    return;
  }
  // Проверка наличия хотя бы одного идентификатора
  const hasAnyId = contact.value.email || contact.value.telegram || contact.value.wallet;
  if (!hasAnyId) {
    if (typeof ElMessageBox === 'function') {
      ElMessageBox.alert('У пользователя нет ни одного идентификатора (email, telegram, wallet). Сообщение не может быть отправлено.', 'Ошибка', { type: 'warning' });
    } else {
      console.error('У пользователя нет ни одного идентификатора (email, telegram, wallet). Сообщение не может быть отправлено.');
    }
    return;
  }
  try {
    const result = await messagesService.broadcastMessage({
      userId: contact.value.id,
      message,
      attachments
    });
    // Формируем текст результата для отображения админу
    let resultText = '';
    if (result && Array.isArray(result.results)) {
      resultText = 'Результат рассылки по каналам:';
      for (const r of result.results) {
        resultText += `\n${r.channel}: ${(r.status === 'sent' || r.status === 'saved') ? 'Успех' : 'Ошибка'}${r.error ? ' (' + r.error + ')' : ''}`;
      }
    } else {
      resultText = 'Не удалось получить подробный ответ от сервера.';
    }
    if (typeof ElMessageBox === 'function') {
      ElMessageBox.alert(resultText, 'Результат рассылки', { type: 'info' });
    } else {
      console.log('Результат рассылки:', resultText);
    }
    await loadMessages();
  } catch (e) {
    if (typeof ElMessageBox === 'function') {
      ElMessageBox.alert('Ошибка отправки: ' + (e?.response?.data?.error || e?.message || e), 'Ошибка', { type: 'error' });
    } else {
      console.error('Ошибка отправки:', e?.response?.data?.error || e?.message || e);
    }
  }
}

async function handleAiReply(selectedMessages = []) {
      // console.log('[AI-ASSISTANT] Кнопка нажата, messages:', messages.value);
  if (isAiLoading.value) {
          // console.log('[AI-ASSISTANT] Уже идёт генерация, выход');
    return;
  }
  if (!Array.isArray(selectedMessages) || selectedMessages.length === 0) {
    alert('Выберите хотя бы одно сообщение пользователя для генерации ответа.');
    return;
  }
  isAiLoading.value = true;
  try {
    // Генерируем черновик ответа через новый endpoint
    const draftResp = await messagesService.generateAiDraft(conversationId.value, selectedMessages);
    if (draftResp && draftResp.success && draftResp.aiMessage) {
      chatNewMessage.value = draftResp.aiMessage;
      // console.log('[AI-ASSISTANT] Черновик сгенерирован:', draftResp.aiMessage);
    } else {
      alert('Не удалось сгенерировать ответ ИИ.');
    }
  } catch (e) {
    alert('Ошибка генерации ответа ИИ: ' + (e?.message || e));
  } finally {
    isAiLoading.value = false;
    // console.log('[AI-ASSISTANT] Генерация завершена');
  }
}

function showBlockStatusMessage(msg, type = 'info') {
  if (typeof ElMessageBox === 'function') {
    ElMessageBox.alert(msg, 'Статус блокировки', { type });
  } else {
    alert(msg);
  }
}

async function blockUser() {
  if (!contact.value) return;
  try {
    await contactsService.blockContact(contact.value.id);
    contact.value.is_blocked = true;
    showBlockStatusMessage('Пользователь заблокирован', 'success');
  } catch (e) {
    showBlockStatusMessage('Ошибка блокировки пользователя', 'error');
  }
}

async function unblockUser() {
  if (!contact.value) return;
  try {
    await contactsService.unblockContact(contact.value.id);
    contact.value.is_blocked = false;
    showBlockStatusMessage('Пользователь разблокирован', 'success');
  } catch (e) {
    showBlockStatusMessage('Ошибка разблокировки пользователя', 'error');
  }
}

// --- Теги ---
async function createTag() {
  if (!canEdit.value) return;
  if (!newTagName.value) return;
  const tableId = await ensureTagsTable();
  const table = await tablesService.getTable(tableId);
  const nameCol = table.columns[0];
  const descCol = table.columns[1];
  // 1. Создаём строку
  const newRow = await tablesService.addRow(tableId);
      // console.log('DEBUG newRow:', newRow);
  if (!newRow || !newRow.id) {
          // console.error('Ошибка: не удалось получить id новой строки', newRow);
    alert('Ошибка: не удалось получить id новой строки. См. консоль.');
    return;
  }
  const newRowId = newRow.id;
  // 2. Сохраняем имя
  await tablesService.saveCell({
    table_id: tableId,
    row_id: newRowId,
    column_id: nameCol.id,
    value: newTagName.value
  });
  // 3. Сохраняем описание (если есть столбец)
  if (descCol && newTagDescription.value) {
    await tablesService.saveCell({
      table_id: tableId,
      row_id: newRowId,
      column_id: descCol.id,
      value: newTagDescription.value
    });
  }
  // 4. Обновляем список тегов
  await loadAllTags();
  // 5. Автоматически выбираем новый тег для пользователя
  selectedTags.value = [...selectedTags.value, newRowId];
  await addTagsToUser();
  // 6. Очищаем поля
  newTagName.value = '';
  newTagDescription.value = '';
}

async function loadUserTags() {
  if (!contact.value || !contact.value.id) {
    userTags.value = [];
    return;
  }
  // Получаем id тегов пользователя
  const tagIds = await contactsService.getContactTags(contact.value.id);
  if (!Array.isArray(tagIds) || tagIds.length === 0) {
    userTags.value = [];
    return;
  }
  // Загружаем справочник тегов
  await loadAllTags();
  // Сопоставляем id с объектами тегов
  userTags.value = allTags.value.filter(tag => tagIds.includes(tag.id));
}

// После добавления/удаления тегов всегда обновляем userTags
async function addTagsToUser() {
  if (!canEdit.value) return;
  if (!contact.value || !contact.value.id) return;
  if (!selectedTags.value || selectedTags.value.length === 0) return;
  try {
    await contactsService.addTagsToContact(contact.value.id, selectedTags.value);
    await loadUserTags();
    showTagModal.value = false;
    ElMessageBox.alert('Теги успешно добавлены.', 'Успех', { type: 'success' });
  } catch (e) {
    ElMessageBox.alert('Ошибка добавления тегов: ' + (e?.response?.data?.error || e?.message || e), 'Ошибка', { type: 'error' });
  }
}

async function removeUserTag(tagId) {
  if (!canEdit.value) return;
  if (!contact.value || !contact.value.id) return;
  try {
    await contactsService.removeTagFromContact(contact.value.id, tagId);
    await loadUserTags();
    ElMessageBox.alert('Тег успешно удален.', 'Успех', { type: 'success' });
  } catch (e) {
    ElMessageBox.alert('Ошибка удаления тега: ' + (e?.response?.data?.error || e?.message || e), 'Ошибка', { type: 'error' });
  }
}

onMounted(async () => {
  await reloadContact();
  await loadUserTags();
  await loadMessages();
  
  // Подписываемся на обновления тегов
  unsubscribeFromTags = onTagsUpdate(async () => {
    // console.log('[ContactDetailsView] Получено обновление тегов, перезагружаем списки тегов');
    await loadAllTags();
    await loadUserTags();
  });
});

onUnmounted(() => {
  // Отписываемся от WebSocket при размонтировании
  if (unsubscribeFromTags) {
    unsubscribeFromTags();
  }
});
watch(userId, async () => {
  await reloadContact();
  await loadUserTags();
  await loadMessages();
});
</script>

<style scoped>
.contact-details-page {
  padding: 32px 0;
}
.contact-details-content {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.12);
  padding: 32px 24px 24px 24px;
  width: 100%;
  margin-top: 40px;
  position: relative;
  overflow-x: auto;
}
.contact-details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}
.close-btn {
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
.contact-info-block {
  margin-bottom: 18px;
  font-size: 1.08rem;
  line-height: 1.7;
}
.edit-input {
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 1rem;
  margin-left: 8px;
  min-width: 120px;
}
.saving {
  color: #17a2b8;
  font-size: 0.95rem;
  margin-left: 8px;
}
.delete-actions {
  display: flex;
  gap: 12px;
  margin-top: 18px;
}

.delete-history-btn {
  background: #ff9800;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 7px 18px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.delete-history-btn:hover {
  background: #f57c00;
}

.delete-btn {
  background: #dc3545;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 7px 18px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.delete-btn:hover {
  background: #b52a37;
}
.multi-select {
  position: relative;
  display: inline-block;
  min-width: 220px;
}
.selected-langs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-height: 36px;
  background: #f5f7fa;
  border-radius: 6px;
  padding: 4px 8px;
  border: 1px solid #ccc;
}
.lang-tag {
  background: #e6f7ff;
  color: #138496;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 0.97rem;
  display: flex;
  align-items: center;
}
.remove-tag {
  margin-left: 4px;
  cursor: pointer;
  color: #888;
  font-weight: bold;
}
.remove-tag:hover {
  color: #dc3545;
}
.lang-input {
  border: none;
  outline: none;
  background: transparent;
  font-size: 1rem;
  min-width: 80px;
  margin-left: 4px;
}
.lang-dropdown {
  position: absolute;
  left: 0;
  top: 100%;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  z-index: 10;
  min-width: 180px;
  max-height: 180px;
  overflow-y: auto;
  margin-top: 2px;
  padding: 0;
  list-style: none;
}
.lang-dropdown li {
  padding: 7px 14px;
  cursor: pointer;
  font-size: 1rem;
}
.lang-dropdown li.selected {
  background: #e6f7ff;
  color: #138496;
}
.lang-dropdown li:hover {
  background: #f0f0f0;
}
.messages-block {
  background: #f8fafc;
  border-radius: 10px;
  padding: 18px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.messages-list {
  max-height: 350px;
  overflow-y: auto;
  margin-top: 10px;
}
.loading, .empty {
  color: #888;
  text-align: center;
  margin: 20px 0;
}
.user-tags-block {
  margin: 1em 0;
}
.user-tag {
  display: inline-block;
  background: #e0f7fa;
  color: #00796b;
  border-radius: 6px;
  padding: 0.2em 0.7em;
  margin-right: 0.5em;
  font-size: 0.95em;
}
.add-tag-btn {
  margin-left: 1em;
  background: #2ecc40;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.3em 1em;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.add-tag-btn:hover {
  background: #27ae38;
}
.block-user-section {
  margin-top: 1em;
  margin-bottom: 1em;
}
.blocked-status {
  color: #d32f2f;
  font-weight: bold;
}
.unblocked-status {
  color: #388e3c;
  font-weight: bold;
}
</style> 