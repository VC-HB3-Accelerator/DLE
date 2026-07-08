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
  <BaseLayout>
    <div class="contact-details-page">
      <div v-if="isLoading" class="page-state">{{ t('common.loading') }}</div>
      <div v-else-if="!contact" class="page-state">{{ t('contacts.contactNotFound') }}</div>
      <div v-else class="contact-details-content">
        <header class="contact-details-header">
          <div class="header-main">
            <h1>{{ contact.name || t('contacts.details.title') }}</h1>
            <p class="header-subtitle">{{ t('contacts.details.userId') }} {{ contact.id }}</p>
          </div>
          <el-button class="back-btn" @click="goBack">{{ t('contacts.details.backToList') }}</el-button>
        </header>

        <section class="info-card">
          <div class="info-grid">
            <div class="info-row">
              <span class="info-label">{{ t('contacts.details.name') }}</span>
              <span class="info-value">
                <template v-if="canEditContacts">
                  <input v-model="editableName" class="edit-input" @blur="saveName" @keyup.enter="saveName" />
                  <span v-if="isSavingName" class="saving">{{ t('common.saving') }}</span>
                </template>
                <template v-else>{{ contact.name || '-' }}</template>
              </span>
            </div>

            <div class="info-row">
              <span class="info-label">{{ t('contacts.details.email') }}</span>
              <span
                class="info-value personal-field"
                :class="{ 'personal-field--revealed': isFieldRevealed('email') }"
                :title="getFieldTitle('email', contact.email)"
                @click="toggleFieldReveal('email')"
              >{{ getPersonalFieldDisplay('email', contact.email) }}</span>
            </div>

            <div class="info-row">
              <span class="info-label">{{ t('contacts.details.telegram') }}</span>
              <span
                class="info-value personal-field"
                :class="{ 'personal-field--revealed': isFieldRevealed('telegram') }"
                :title="getFieldTitle('telegram', contact.telegram)"
                @click="toggleFieldReveal('telegram')"
              >{{ getPersonalFieldDisplay('telegram', contact.telegram) }}</span>
            </div>

            <div class="info-row">
              <span class="info-label">{{ t('contacts.details.wallet') }}</span>
              <span
                class="info-value personal-field"
                :class="{ 'personal-field--revealed': isFieldRevealed('wallet') }"
                :title="getFieldTitle('wallet', contact.wallet)"
                @click="toggleFieldReveal('wallet')"
              >{{ getPersonalFieldDisplay('wallet', contact.wallet) }}</span>
            </div>

            <div class="info-row">
              <span class="info-label">{{ t('contacts.details.language') }}</span>
              <span class="info-value">
                <div class="multi-select">
                  <div class="selected-langs">
                    <span v-for="lang in selectedLanguages" :key="lang" class="lang-tag">
                      {{ getLanguageLabel(lang) }}
                      <span v-if="canEditContacts" class="remove-tag" @click="removeLanguage(lang)">×</span>
                    </span>
                    <input
                      v-if="canEditContacts"
                      v-model="langInput"
                      @focus="showLangDropdown = true"
                      @input="showLangDropdown = true"
                      @keydown.enter.prevent="addLanguageFromInput"
                      class="lang-input"
                      :placeholder="t('contacts.details.addLanguage')"
                    />
                  </div>
                  <ul v-if="showLangDropdown && canEditContacts" class="lang-dropdown">
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
                <span v-if="isSavingLangs" class="saving">{{ t('common.saving') }}</span>
              </span>
            </div>

            <div class="info-row">
              <span class="info-label">{{ t('contacts.details.createdAt') }}</span>
              <span class="info-value">{{ formatDate(contact.created_at) }}</span>
            </div>

            <div class="info-row">
              <span class="info-label">{{ t('contacts.details.lastMessageDate') }}</span>
              <span class="info-value">{{ formatDate(lastMessageDate) }}</span>
            </div>

            <div class="info-row info-row--tags">
              <span class="info-label">{{ t('contacts.details.userTags') }}</span>
              <span class="info-value">
                <span v-for="tag in userTags" :key="tag.id" class="user-tag">
                  {{ tag.name }}
                  <span v-if="canManageTags" class="remove-tag" @click="removeUserTag(tag.id)">×</span>
                </span>
                <el-button v-if="canManageTags" size="small" type="primary" plain @click="openTagModal">
                  {{ t('contacts.details.addTag') }}
                </el-button>
              </span>
            </div>

            <div class="info-row">
              <span class="info-label">{{ t('contacts.details.blockStatus') }}</span>
              <span class="info-value block-user-value">
                <span v-if="contact.is_blocked" class="blocked-status">{{ t('contacts.details.blocked') }}</span>
                <span v-else class="unblocked-status">{{ t('contacts.details.unblocked') }}</span>
                <template v-if="canBlockUsers">
                  <el-button v-if="!contact.is_blocked" type="danger" size="small" plain @click="blockUser">
                    {{ t('contacts.details.block') }}
                  </el-button>
                  <el-button v-else type="success" size="small" plain @click="unblockUser">
                    {{ t('contacts.details.unblock') }}
                  </el-button>
                </template>
              </span>
            </div>
          </div>
        </section>

        <div v-if="canDeleteData" class="contact-actions">
          <el-button type="warning" plain size="small" @click="deleteMessagesHistory">
            {{ t('contacts.details.deleteHistory') }}
          </el-button>
          <el-button type="danger" plain size="small" @click="deleteContact">
            {{ t('contacts.details.deleteContact') }}
          </el-button>
        </div>

        <section class="contact-chat-panel">
          <ChatInterface
            embedded
            :messages="messages"
            :isLoading="isLoadingMessages"
            :attachments="chatAttachments"
            :newMessage="chatNewMessage"
            :canSend="canSendToUsers && !!address"
            :canGenerateAI="canGenerateAI"
            :canSelectMessages="canGenerateAI"
            :currentUserId="currentUserId"
            @send-message="handleSendMessage"
            @update:newMessage="val => chatNewMessage = val"
            @update:attachments="val => chatAttachments = val"
            @ai-reply="handleAiReply"
          />
        </section>

        <el-dialog v-if="canManageTags" v-model="showTagModal" :title="t('contacts.details.addTagTitle')">
          <div v-if="allTags.length">
            <el-select
              v-model="selectedTags"
              multiple
              filterable
              :placeholder="t('contacts.details.selectTags')"
              class="tag-modal-select"
              @change="addTagsToUser"
            >
              <el-option
                v-for="tag in allTags"
                :key="tag.id"
                :label="tag.name"
                :value="tag.id"
              />
            </el-select>
            <div class="tag-modal-hint">
              <strong>{{ t('contacts.details.existingTags') }}</strong>
              <span v-for="tag in allTags" :key="'list-' + tag.id" class="tag-modal-tag-item">
                {{ tag.name }}<span v-if="tag.description"> ({{ tag.description }})</span>
              </span>
            </div>
          </div>
          <div class="tag-modal-create">
            <el-input v-model="newTagName" :placeholder="t('contacts.details.newTag')" />
            <el-input v-model="newTagDescription" :placeholder="t('contacts.details.tagDescription')" />
            <el-button type="primary" @click="createTag">{{ t('contacts.details.createTag') }}</el-button>
          </div>
        </el-dialog>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import ChatInterface from '../../components/ChatInterface.vue';
import contactsService from '../../services/contactsService.js';
import messagesService from '../../services/messagesService.js';
import { getConversationByUserId, getMessagesByConversationId, sendMessage } from '../../services/messagesService.js';
import { useAuthContext } from '@/composables/useAuth';
import { usePermissions } from '@/composables/usePermissions';
import { useContactsAndMessagesWebSocket } from '@/composables/useContactsWebSocket';
import websocketServiceModule from '@/services/websocketService';
const { t } = useI18n();
const { canEditContacts, canDeleteData, canManageTags, canBlockUsers, canSendToUsers, canGenerateAI, canViewContacts } = usePermissions();
const { address, userId: currentUserId } = useAuthContext();
const { markContactAsRead } = useContactsAndMessagesWebSocket();
const { websocketService } = websocketServiceModule;

// Подписываемся на централизованные события очистки и обновления данных
onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    console.log('[ContactDetailsView] Clearing contact data');
    // Очищаем данные при выходе из системы
    contact.value = null;
    messages.value = [];
  });
  
  window.addEventListener('refresh-application-data', () => {
    console.log('[ContactDetailsView] Refreshing contact data');
    reloadContact(); // Обновляем данные при входе в систему
  });
});
import { ElMessageBox } from 'element-plus';
import tablesService from '../../services/tablesService';
import { useTagsWebSocket } from '../../composables/useTagsWebSocket';
import { getClientTagsTableMeta, findClientTagsTableInList, loadClientTagsList } from '../../utils/clientTagsTable';

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
const isAiLoading = ref(false);
const conversationId = ref(null);
const revealedFields = ref({});

function isFieldRevealed(field) {
  return Boolean(revealedFields.value[field]);
}

function toggleFieldReveal(field) {
  if (revealedFields.value[field]) {
    const next = { ...revealedFields.value };
    delete next[field];
    revealedFields.value = next;
    return;
  }
  revealedFields.value = { ...revealedFields.value, [field]: true };
}

function getCompactMask(field, value) {
  if (field === 'email') return '•••@•••';
  if (field === 'telegram') return String(value).startsWith('@') ? '@•••' : '•••';
  if (field === 'wallet') return String(value).startsWith('0x') ? '0x•••' : '•••';
  return '••••';
}

function getPersonalFieldDisplay(field, value) {
  if (!value || value === '-') return '-';
  if (isFieldRevealed(field)) return value;
  return getCompactMask(field, value);
}

function getFieldTitle(field, value) {
  if (!value || value === '-') return '';
  return isFieldRevealed(field) ? t('contacts.clickToHide') : t('contacts.clickToReveal');
}

// id таблицы тегов (будет найден или создан)
const tagsTableId = ref(null);

// WebSocket для тегов
const { onTagsUpdate } = useTagsWebSocket();
let unsubscribeFromTags = null;

// Обработчик обновления контактов через WebSocket
const handleContactsUpdate = async () => {
  console.log('[ContactDetailsView] Получено обновление контакта, перезагружаем данные');
  await reloadContact();
  await loadUserTags();
};

async function ensureTagsTable() {
  const tagsMeta = getClientTagsTableMeta();
  const tables = await tablesService.getTables();
  let tagsTable = findClientTagsTableInList(tables);
  
  if (!tagsTable) {
    // Если таблицы нет — создаём
    tagsTable = await tablesService.createTable({
      name: tagsMeta.name,
      description: tagsMeta.description,
      isRagSourceId: 2 // не источник для RAG по умолчанию
    });
    
    // Добавляем столбцы параллельно
    await Promise.all([
      tablesService.addColumn(tagsTable.id, { name: tagsMeta.columnName, type: 'text' }),
      tablesService.addColumn(tagsTable.id, { name: tagsMeta.columnDescription, type: 'text' })
    ]);
  } else {
    // Проверяем, есть ли нужные столбцы, если таблица уже была создана
    const table = await tablesService.getTable(tagsTable.id);
    const hasName = table.columns.some(col => col.name === tagsMeta.columnName);
    const hasDesc = table.columns.some(col => col.name === tagsMeta.columnDescription);
    
    // Добавляем недостающие столбцы параллельно
    const addColumnPromises = [];
    if (!hasName) addColumnPromises.push(tablesService.addColumn(tagsTable.id, { name: tagsMeta.columnName, type: 'text' }));
    if (!hasDesc) addColumnPromises.push(tablesService.addColumn(tagsTable.id, { name: tagsMeta.columnDescription, type: 'text' }));
    
    if (addColumnPromises.length > 0) {
      await Promise.all(addColumnPromises);
  }
  }
  
  tagsTableId.value = tagsTable.id;
  return tagsTable.id;
}

async function loadAllTags() {
  await ensureTagsTable();
  allTags.value = await loadClientTagsList();
}

function openTagModal() {
  if (!canManageTags.value) return;
  showTagModal.value = true;
  loadAllTags();
}

// --- Языки ---
const allLanguages = computed(() => [
  { value: 'ru', label: t('common.languages.ru') },
  { value: 'en', label: t('common.languages.en') },
  { value: 'de', label: t('common.languages.de') },
  { value: 'fr', label: t('common.languages.fr') },
  { value: 'es', label: t('common.languages.es') },
  { value: 'zh', label: t('common.languages.zh') },
  { value: 'ar', label: t('common.languages.ar') },
  { value: 'pt', label: t('common.languages.pt') },
  { value: 'it', label: t('common.languages.it') },
  { value: 'ja', label: t('common.languages.ja') },
  { value: 'tr', label: t('common.languages.tr') },
  { value: 'pl', label: t('common.languages.pl') },
  { value: 'uk', label: t('common.languages.uk') },
  { value: 'other', label: t('common.languages.other') }
]);
const selectedLanguages = ref([]);
const langInput = ref('');
const showLangDropdown = ref(false);
const filteredLanguages = computed(() => {
  const input = langInput.value.toLowerCase();
  return allLanguages.value.filter(
    l => !selectedLanguages.value.includes(l.value) && l.label.toLowerCase().includes(input)
  );
});
function getLanguageLabel(val) {
  const found = allLanguages.value.find(l => l.value === val);
  return found ? found.label : val;
}
function addLanguage(lang) {
  if (!canEditContacts.value) return;
  if (!selectedLanguages.value.includes(lang)) {
    selectedLanguages.value.push(lang);
    saveLanguages();
  }
  langInput.value = '';
  showLangDropdown.value = false;
}
function addLanguageFromInput() {
  if (!canEditContacts.value) return;
  const found = filteredLanguages.value[0];
  if (found) addLanguage(found.value);
}
function removeLanguage(lang) {
  if (!canEditContacts.value) return;
  selectedLanguages.value = selectedLanguages.value.filter(l => l !== lang);
  saveLanguages();
}
function saveLanguages() {
  if (!canEditContacts.value) return;
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
      t('contacts.details.confirmDeleteHistory'),
      t('contacts.details.confirmDeleteHistoryTitle'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    );
    
    if (confirmed) {
      const result = await messagesService.deleteMessagesHistory(contact.value.id);
      if (result.success) {
        ElMessageBox.alert(
          t('contacts.details.historyDeleted', { messages: result.deletedMessages, conversations: result.deletedConversations }),
          t('common.success'),
          { type: 'success' }
        );
        await loadMessages();
      } else {
        throw new Error(t('contacts.details.failedDeleteHistory'));
      }
    }
  } catch (e) {
    if (e !== 'cancel') {
      ElMessageBox.alert(
        t('contacts.details.deleteHistoryError', { error: e?.response?.data?.error || e?.message || e }),
        t('common.error'),
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
    if (String(contact.value.id).startsWith('guest_')) {
      messages.value = [];
      conversationId.value = null;
      lastMessageDate.value = null;
      return;
    }

    const convData = await getConversationByUserId(contact.value.id);
    const convId = convData?.conversations?.[0]?.id || convData?.id || null;
    conversationId.value = convId;

    if (!convId) {
      messages.value = [];
      lastMessageDate.value = null;
      return;
    }

    const response = await getMessagesByConversationId(convId, { limit: 50, offset: 0 });
    messages.value = response?.messages || [];
    lastMessageDate.value = messages.value.length
      ? messages.value[messages.value.length - 1].created_at
      : null;

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
    router.push({ name: 'contacts-list' });
  }
}

async function handleSendMessage({ message, attachments }) {
  if (!contact.value || !contact.value.id) return;
  if (contact.value.is_blocked) {
    if (typeof ElMessageBox === 'function') {
      ElMessageBox.alert(t('contacts.details.userBlocked'), t('common.error'), { type: 'error' });
    } else {
      console.error('Пользователь заблокирован. Отправка сообщений невозможна.');
    }
    return;
  }
  // Проверка наличия хотя бы одного идентификатора
  const hasAnyId = contact.value.email || contact.value.telegram || contact.value.wallet;
  if (!hasAnyId) {
    if (typeof ElMessageBox === 'function') {
      ElMessageBox.alert(t('contacts.details.noIdentifiers'), t('common.error'), { type: 'warning' });
    } else {
      console.error('У пользователя нет ни одного идентификатора (email, telegram, wallet). Сообщение не может быть отправлено.');
    }
    return;
  }
  try {
    const result = await sendMessage({
      recipientId: contact.value.id,
      content: message,
      messageType: 'public'
    });
    
    if (result && result.success) {
      // Очищаем поле ввода после успешной отправки
      chatNewMessage.value = '';
      // Обновляем список сообщений
      await loadMessages();
      if (typeof ElMessageBox === 'function') {
        ElMessageBox.alert(t('contacts.details.sendSuccess'), t('common.success'), { type: 'success' });
      }
    } else {
      throw new Error(result?.message || t('common.unknownError'));
    }
  } catch (e) {
    if (typeof ElMessageBox === 'function') {
      ElMessageBox.alert(t('contacts.details.sendError', { error: e?.response?.data?.error || e?.message || e }), t('common.error'), { type: 'error' });
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
    alert(t('contacts.details.selectMessageForAi'));
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
      alert(t('contacts.details.aiGenerateFailed'));
    }
  } catch (e) {
    alert(t('contacts.details.aiGenerateError', { error: e?.message || e }));
  } finally {
    isAiLoading.value = false;
    // console.log('[AI-ASSISTANT] Генерация завершена');
  }
}

function showBlockStatusMessage(msg, type = 'info') {
  if (typeof ElMessageBox === 'function') {
    ElMessageBox.alert(msg, t('contacts.details.blockStatusTitle'), { type });
  } else {
    alert(msg);
  }
}

async function blockUser() {
  if (!contact.value) return;
  try {
    await contactsService.blockContact(contact.value.id);
    contact.value.is_blocked = true;
    showBlockStatusMessage(t('contacts.details.blockSuccess'), 'success');
  } catch (e) {
    showBlockStatusMessage(t('contacts.details.blockError'), 'error');
  }
}

async function unblockUser() {
  if (!contact.value) return;
  try {
    await contactsService.unblockContact(contact.value.id);
    contact.value.is_blocked = false;
    showBlockStatusMessage(t('contacts.details.unblockSuccess'), 'success');
  } catch (e) {
    showBlockStatusMessage(t('contacts.details.unblockError'), 'error');
  }
}

// --- Теги ---
async function createTag() {
  if (!canManageTags.value) return;
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
    alert(t('contacts.details.tagRowError'));
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
  if (!canManageTags.value) return;
  if (!contact.value || !contact.value.id) return;
  if (!selectedTags.value || selectedTags.value.length === 0) return;
  try {
    await contactsService.addTagsToContact(contact.value.id, selectedTags.value);
    await loadUserTags();
    showTagModal.value = false;
    ElMessageBox.alert(t('contacts.details.tagsAdded'), t('common.success'), { type: 'success' });
  } catch (e) {
    ElMessageBox.alert(t('contacts.details.tagsAddError', { error: e?.response?.data?.error || e?.message || e }), t('common.error'), { type: 'error' });
  }
}

async function removeUserTag(tagId) {
  if (!canManageTags.value) return;
  if (!contact.value || !contact.value.id) return;
  try {
    await contactsService.removeTagFromContact(contact.value.id, tagId);
    await loadUserTags();
    ElMessageBox.alert(t('contacts.details.tagRemoved'), t('common.success'), { type: 'success' });
  } catch (e) {
    ElMessageBox.alert(t('contacts.details.tagRemoveError', { error: e?.response?.data?.error || e?.message || e }), t('common.error'), { type: 'error' });
  }
}

onMounted(async () => {
  await reloadContact();
  await loadUserTags();
  await loadMessages();
  
  // Помечаем контакт как прочитанный при загрузке страницы
  // Для всех админов (EDITOR и READONLY) - каждый видит свой статус просмотра
  console.log('[ContactDetailsView] DEBUG - canViewContacts:', canViewContacts.value);
  console.log('[ContactDetailsView] DEBUG - userId:', userId.value);
  if (userId.value && canViewContacts.value) {
    console.log('[ContactDetailsView] Marking contact as read (admin):', userId.value);
    await markContactAsRead(userId.value);
  } else if (userId.value) {
    console.log('[ContactDetailsView] Skipping markContactAsRead - user is not admin');
  }
  
  // Подписываемся на обновления тегов
  unsubscribeFromTags = onTagsUpdate(async () => {
    // console.log('[ContactDetailsView] Получено обновление тегов, перезагружаем списки тегов');
    await loadAllTags();
    await loadUserTags();
  });
  
  // Подписываемся на обновления контактов (для обновления имени)
  websocketService.on('contacts-updated', handleContactsUpdate);
});

onUnmounted(() => {
  // Отписываемся от WebSocket при размонтировании
  if (unsubscribeFromTags) {
    unsubscribeFromTags();
  }
  websocketService.off('contacts-updated', handleContactsUpdate);
});
watch(userId, async () => {
  await reloadContact();
  await loadUserTags();
  await loadMessages();
});
</script>

<style scoped>
.contact-details-page {
  width: 100%;
}

.page-state {
  padding: var(--spacing-lg);
  color: var(--color-grey);
}

.contact-details-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  width: 100%;
}

.contact-details-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 16px;
}

.header-main h1 {
  margin: 0 0 4px;
  font-size: var(--font-size-xxl);
  font-weight: 600;
  color: var(--color-dark);
}

.header-subtitle {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-grey);
}

.info-card {
  border: 1px solid var(--color-border);
  border-radius: var(--block-radius);
  background: var(--color-white);
  box-shadow: var(--shadow-sm);
  padding: var(--spacing-lg);
}

.contact-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.info-row {
  display: grid;
  grid-template-columns: minmax(140px, 200px) 1fr;
  gap: 12px 20px;
  align-items: start;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-grey-light);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-grey);
}

.info-value {
  font-size: var(--font-size-md);
  color: var(--color-dark);
  word-break: break-word;
}

.info-row--tags .info-value {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.personal-field {
  cursor: pointer;
  color: var(--color-grey);
  display: inline-block;
  user-select: none;
}

.personal-field--revealed {
  color: var(--color-dark);
  user-select: text;
}

.personal-field:not(.personal-field--revealed):hover {
  color: var(--color-primary-dark);
  background: rgba(76, 175, 80, 0.08);
  border-radius: var(--radius-sm);
  padding: 0 4px;
  margin: 0 -4px;
}

.edit-input {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 6px 10px;
  font-size: var(--font-size-md);
  min-width: 160px;
  max-width: 100%;
}

.saving {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  margin-left: 8px;
}

.block-user-value {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.blocked-status {
  color: var(--color-danger);
  font-weight: 600;
}

.unblocked-status {
  color: var(--color-primary-dark);
  font-weight: 600;
}

.contact-chat-panel {
  border: 1px solid var(--color-border);
  border-radius: var(--block-radius);
  background: var(--color-white);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  min-height: 480px;
  max-height: calc(100vh - 200px);
  display: flex;
  flex-direction: column;
}

.contact-chat-panel :deep(.chat-container) {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}

.multi-select {
  position: relative;
  display: block;
  max-width: 420px;
}

.selected-langs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-height: 36px;
  background: var(--color-light);
  border-radius: var(--radius-md);
  padding: 4px 8px;
  border: 1px solid var(--color-border);
}

.lang-tag {
  background: #e8f5e9;
  color: var(--color-primary-dark);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  font-size: var(--font-size-sm);
  display: flex;
  align-items: center;
}

.remove-tag {
  margin-left: 4px;
  cursor: pointer;
  color: var(--color-grey);
  font-weight: bold;
}

.remove-tag:hover {
  color: var(--color-danger);
}

.lang-input {
  border: none;
  outline: none;
  background: transparent;
  font-size: var(--font-size-md);
  min-width: 80px;
  margin-left: 4px;
}

.lang-dropdown {
  position: absolute;
  left: 0;
  top: 100%;
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
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
  font-size: var(--font-size-md);
}

.lang-dropdown li.selected {
  background: #e8f5e9;
  color: var(--color-primary-dark);
}

.lang-dropdown li:hover {
  background: var(--color-light);
}

.user-tag {
  display: inline-flex;
  align-items: center;
  background: #e8f5e9;
  color: var(--color-primary-dark);
  border-radius: var(--radius-md);
  padding: 2px 10px;
  font-size: var(--font-size-sm);
}

.tag-modal-select {
  width: 100%;
}

.tag-modal-hint {
  margin-top: 1em;
  color: var(--color-grey);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.tag-modal-tag-item {
  margin-right: 0.7em;
}

.tag-modal-create {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 1em;
}

@media (max-width: 768px) {
  .contact-details-header {
    flex-direction: column;
    align-items: stretch;
  }

  .back-btn {
    align-self: flex-start;
  }

  .info-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .contact-chat-panel {
    min-height: 360px;
    max-height: calc(100vh - 160px);
  }
}
</style> 