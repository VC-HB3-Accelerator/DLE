<template>
  <BaseLayout>
  <div class="contact-details-page">
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
          <input v-model="editableName" class="edit-input" @blur="saveName" @keyup.enter="saveName" />
          <span v-if="isSavingName" class="saving">Сохранение...</span>
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
                <span class="remove-tag" @click="removeLanguage(lang)">×</span>
              </span>
              <input
                v-model="langInput"
                @focus="showLangDropdown = true"
                @input="showLangDropdown = true"
                @keydown.enter.prevent="addLanguageFromInput"
                class="lang-input"
                placeholder="Добавить язык..."
              />
            </div>
            <ul v-if="showLangDropdown" class="lang-dropdown">
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
            <span class="remove-tag" @click="removeUserTag(tag.id)">×</span>
          </span>
          <button class="add-tag-btn" @click="openTagModal">Добавить тег</button>
        </div>
        <button class="delete-btn" @click="deleteContact">Удалить контакт</button>
      </div>
      <div class="messages-block">
        <h3>История сообщений</h3>
        <div v-if="isLoadingMessages" class="loading">Загрузка...</div>
        <div v-else-if="messages.length === 0" class="empty">Нет сообщений</div>
        <div v-else class="messages-list">
          <Message v-for="msg in messages" :key="msg.id" :message="msg" />
        </div>
      </div>
      <el-dialog v-model="showTagModal" title="Добавить тег пользователю">
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
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import Message from '../../components/Message.vue';
import contactsService from '../../services/contactsService.js';
import messagesService from '../../services/messagesService.js';

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
  if (!selectedLanguages.value.includes(lang)) {
    selectedLanguages.value.push(lang);
    saveLanguages();
  }
  langInput.value = '';
  showLangDropdown.value = false;
}
function addLanguageFromInput() {
  const found = filteredLanguages.value[0];
  if (found) addLanguage(found.value);
}
function removeLanguage(lang) {
  selectedLanguages.value = selectedLanguages.value.filter(l => l !== lang);
  saveLanguages();
}
function saveLanguages() {
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
function deleteContact() {
  router.push({ name: 'contact-delete-confirm', params: { id: contact.value.id } });
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}
async function loadMessages() {
  if (!contact.value || !contact.value.id) return;
  isLoadingMessages.value = true;
  try {
    messages.value = await messagesService.getMessagesByUserId(contact.value.id);
    if (messages.value.length > 0) {
      lastMessageDate.value = messages.value[messages.value.length - 1].created_at;
    } else {
      lastMessageDate.value = null;
    }
  } catch (e) {
    messages.value = [];
    lastMessageDate.value = null;
  } finally {
    isLoadingMessages.value = false;
  }
}

async function loadUserTags() {
  if (!contact.value) return;
  const res = await fetch(`/api/users/${contact.value.id}/tags`);
  userTags.value = await res.json();
  selectedTags.value = userTags.value.map(t => t.id);
}

async function openTagModal() {
  await fetch('/api/tags/init', { method: 'POST' })
  const res = await fetch('/api/tags')
  allTags.value = await res.json()
  await loadUserTags()
  showTagModal.value = true
}

async function createTag() {
  const res = await fetch('/api/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newTagName.value, description: newTagDescription.value })
  });
  const newTag = await res.json();
  await fetch(`/api/users/${contact.value.id}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag_id: newTag.id })
  });
  const tagsRes = await fetch('/api/tags');
  allTags.value = await tagsRes.json();
  await loadUserTags();
  newTagName.value = '';
  newTagDescription.value = '';
}

async function addTagsToUser() {
  for (const tagId of selectedTags.value) {
    await fetch(`/api/users/${contact.value.id}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: tagId })
    })
  }
  await loadUserTags()
}

async function removeUserTag(tagId) {
  await fetch(`/api/users/${contact.value.id}/tags/${tagId}`, {
    method: 'DELETE'
  });
  await loadUserTags();
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

onMounted(async () => {
  await reloadContact();
  await loadMessages();
  await loadUserTags();
});
watch(userId, async () => {
  await reloadContact();
  await loadMessages();
  await loadUserTags();
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
.delete-btn {
  background: #dc3545;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 7px 18px;
  cursor: pointer;
  font-size: 1rem;
  margin-top: 18px;
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
</style> 