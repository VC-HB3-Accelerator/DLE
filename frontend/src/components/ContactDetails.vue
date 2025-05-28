<template>
  <div class="contact-details-modal">
    <div class="contact-details-header">
      <h2>Детали контакта</h2>
      <button class="close-btn" @click="$emit('close')">×</button>
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
      <button class="delete-btn" @click="deleteContact">Удалить контакт</button>
    </div>
    <div class="messages-block">
      <h3>История сообщений</h3>
      <div v-if="isLoading" class="loading">Загрузка...</div>
      <div v-else-if="messages.length === 0" class="empty">Нет сообщений</div>
      <div v-else class="messages-list">
        <Message v-for="msg in messages" :key="msg.id" :message="msg" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import Message from './Message.vue';
import messagesService from '../services/messagesService';
import contactsService from '../services/contactsService';
const props = defineProps({
  contact: { type: Object, required: true }
});
const emit = defineEmits(['close', 'contact-deleted', 'contact-updated']);
const messages = ref([]);
const isLoading = ref(false);
const lastMessageDate = ref(null);
const editableName = ref(props.contact.name || '');
const isSavingName = ref(false);
const isSavingLangs = ref(false);

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
const selectedLanguages = ref(Array.isArray(props.contact.language) ? props.contact.language : (props.contact.language ? [props.contact.language] : []));
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
  contactsService.updateContact(props.contact.id, { language: selectedLanguages.value })
    .then(() => emit('contact-updated'))
    .finally(() => { isSavingLangs.value = false; });
}

// --- Имя ---
function saveName() {
  if (editableName.value !== props.contact.name) {
    isSavingName.value = true;
    contactsService.updateContact(props.contact.id, { name: editableName.value })
      .then(() => emit('contact-updated'))
      .finally(() => { isSavingName.value = false; });
  }
}

// --- Удаление ---
function deleteContact() {
  if (confirm('Удалить контакт?')) {
    contactsService.deleteContact(props.contact.id)
      .then(() => emit('contact-deleted', props.contact.id))
      .catch(() => alert('Ошибка удаления контакта'));
  }
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}
async function loadMessages() {
  if (!props.contact || !props.contact.id) return;
  isLoading.value = true;
  try {
    messages.value = await messagesService.getMessagesByUserId(props.contact.id);
    if (messages.value.length > 0) {
      lastMessageDate.value = messages.value[messages.value.length - 1].created_at;
    } else {
      lastMessageDate.value = null;
    }
  } catch (e) {
    messages.value = [];
    lastMessageDate.value = null;
  } finally {
    isLoading.value = false;
  }
}
onMounted(loadMessages);
watch(() => props.contact, loadMessages);
</script>

<style scoped>
.contact-details-modal {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.12);
  padding: 32px 24px 24px 24px;
  max-width: 700px;
  margin: 40px auto;
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
</style> 