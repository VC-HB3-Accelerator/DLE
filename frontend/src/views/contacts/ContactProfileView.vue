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
  <div class="contact-profile">
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
          <span class="info-value">
            <input
              v-if="canEditContacts"
              v-model="draftEmail"
              class="edit-input"
              type="email"
              :placeholder="t('contacts.email')"
              @blur="saveIdentityField('email')"
              @keyup.enter="saveIdentityField('email')"
            />
            <span
              v-else
              class="info-value personal-field"
              :class="{ 'personal-field--revealed': isFieldRevealed('email') }"
              :title="getFieldTitle('email', contact.email)"
              @click="toggleFieldReveal('email')"
            >{{ getPersonalFieldDisplay('email', contact.email) }}</span>
          </span>
        </div>

        <div class="info-row">
          <span class="info-label">{{ t('contacts.details.telegram') }}</span>
          <span class="info-value">
            <input
              v-if="canEditContacts"
              v-model="draftTelegram"
              class="edit-input"
              :placeholder="t('contacts.telegram')"
              @blur="saveIdentityField('telegram')"
              @keyup.enter="saveIdentityField('telegram')"
            />
            <span
              v-else
              class="info-value personal-field"
              :class="{ 'personal-field--revealed': isFieldRevealed('telegram') }"
              :title="getFieldTitle('telegram', contact.telegram)"
              @click="toggleFieldReveal('telegram')"
            >{{ getPersonalFieldDisplay('telegram', contact.telegram) }}</span>
          </span>
        </div>

        <div class="info-row">
          <span class="info-label">{{ t('contacts.details.wallet') }}</span>
          <span class="info-value">
            <input
              v-if="canEditContacts"
              v-model="draftWallet"
              class="edit-input"
              :placeholder="t('contacts.wallet')"
              @blur="saveIdentityField('wallet')"
              @keyup.enter="saveIdentityField('wallet')"
            />
            <span
              v-else
              class="info-value personal-field"
              :class="{ 'personal-field--revealed': isFieldRevealed('wallet') }"
              :title="getFieldTitle('wallet', contact.wallet)"
              @click="toggleFieldReveal('wallet')"
            >{{ getPersonalFieldDisplay('wallet', contact.wallet) }}</span>
          </span>
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

        <div v-if="!isCreateMode" class="info-row info-row--meta">
          <span class="info-label">{{ t('contacts.details.createdAt') }}</span>
          <span class="info-value info-value--meta">{{ formatDate(contact.created_at) }}</span>
        </div>

        <div v-if="!isCreateMode" class="info-row info-row--meta">
          <span class="info-label">{{ t('contacts.details.lastMessageDate') }}</span>
          <span class="info-value info-value--meta">{{ formatDate(lastMessageDate) }}</span>
        </div>

        <div v-if="!isCreateMode" class="info-row info-row--tags">
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

        <div v-if="!isCreateMode" class="info-row">
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

      <div v-if="isCreateMode && canEditContacts" class="contact-actions">
        <div class="contact-actions__buttons">
          <el-button type="primary" :loading="isSavingCreate" @click="saveNewContact">
            {{ t('contacts.create.save') }}
          </el-button>
          <el-button @click="cancelCreate">{{ t('contacts.create.cancel') }}</el-button>
        </div>
      </div>

      <div v-else-if="canDeleteData" class="contact-actions">
        <div class="contact-actions__buttons">
          <el-button type="warning" plain @click="deleteMessagesHistory">
            {{ t('contacts.details.deleteHistory') }}
          </el-button>
          <el-button type="danger" plain @click="deleteContact">
            {{ t('contacts.details.deleteContact') }}
          </el-button>
        </div>
      </div>
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
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { getAddress } from 'ethers';
import contactsService from '@/services/contactsService.js';
import messagesService from '@/services/messagesService.js';
import { getConversationByUserId, getMessagesByConversationId } from '@/services/messagesService.js';
import { usePermissions } from '@/composables/usePermissions';
import { useContactDetailsContext } from '@/composables/useContactDetails';
import tablesService from '@/services/tablesService';
import { useTagsWebSocket } from '@/composables/useTagsWebSocket';
import { getClientTagsTableMeta, findClientTagsTableInList, loadClientTagsList } from '@/utils/clientTagsTable';

const { t } = useI18n();
const router = useRouter();
const { canEditContacts, canDeleteData, canManageTags, canBlockUsers } = usePermissions();
const { contact, userId, isCreateMode, reloadContact } = useContactDetailsContext();

const lastMessageDate = ref(null);
const editableName = ref('');
const draftEmail = ref('');
const draftTelegram = ref('');
const draftWallet = ref('');
const isSavingCreate = ref(false);
const isSavingName = ref(false);
const isSavingIdentity = ref(null);
const isSavingLangs = ref(false);
const userTags = ref([]);
const allTags = ref([]);
const selectedTags = ref([]);
const showTagModal = ref(false);
const newTagName = ref('');
const newTagDescription = ref('');
const revealedFields = ref({});
const tagsTableId = ref(null);

const { onTagsUpdate } = useTagsWebSocket();
let unsubscribeFromTags = null;

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
  { value: 'other', label: t('common.languages.other') },
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

function syncFormFromContact() {
  if (!contact.value) return;
  editableName.value = contact.value.name || '';
  draftEmail.value = contact.value.email || '';
  draftTelegram.value = contact.value.telegram || '';
  draftWallet.value = contact.value.wallet || '';
  selectedLanguages.value = Array.isArray(contact.value.preferred_language)
    ? contact.value.preferred_language
    : (contact.value.preferred_language ? [contact.value.preferred_language] : []);
}

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

function getLanguageLabel(val) {
  const found = allLanguages.value.find(l => l.value === val);
  return found ? found.label : val;
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}

async function loadLastMessageDate() {
  if (!contact.value?.id) {
    lastMessageDate.value = null;
    return;
  }

  if (String(contact.value.id).startsWith('guest_')) {
    lastMessageDate.value = null;
    return;
  }

  try {
    const convData = await getConversationByUserId(contact.value.id);
    const convId = convData?.conversations?.[0]?.id || convData?.id || null;
    if (!convId) {
      lastMessageDate.value = null;
      return;
    }

    const response = await getMessagesByConversationId(convId, { limit: 1, offset: 0 });
    const msgs = response?.messages || [];
    lastMessageDate.value = msgs.length ? msgs[msgs.length - 1].created_at : null;
  } catch {
    lastMessageDate.value = null;
  }
}

async function ensureTagsTable() {
  const tagsMeta = getClientTagsTableMeta();
  const tables = await tablesService.getTables();
  let tagsTable = findClientTagsTableInList(tables);

  if (!tagsTable) {
    tagsTable = await tablesService.createTable({
      name: tagsMeta.name,
      description: tagsMeta.description,
      isRagSourceId: 2,
    });

    await Promise.all([
      tablesService.addColumn(tagsTable.id, { name: tagsMeta.columnName, type: 'text' }),
      tablesService.addColumn(tagsTable.id, { name: tagsMeta.columnDescription, type: 'text' }),
    ]);
  } else {
    const table = await tablesService.getTable(tagsTable.id);
    const hasName = table.columns.some(col => col.name === tagsMeta.columnName);
    const hasDesc = table.columns.some(col => col.name === tagsMeta.columnDescription);
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

function addLanguage(lang) {
  if (!canEditContacts.value) return;
  if (!selectedLanguages.value.includes(lang)) {
    selectedLanguages.value.push(lang);
    if (!isCreateMode.value) {
      saveLanguages();
    }
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
  if (!isCreateMode.value) {
    saveLanguages();
  }
}

function saveLanguages() {
  if (!canEditContacts.value || isCreateMode.value) return;
  isSavingLangs.value = true;
  contactsService.updateContact(contact.value.id, { language: selectedLanguages.value })
    .then(() => reloadContact())
    .finally(() => { isSavingLangs.value = false; });
}

function normalizeIdentityDraft(field, value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';

  if (field === 'telegram') {
    return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  }

  if (field === 'wallet') {
    try {
      return getAddress(trimmed).toLowerCase();
    } catch {
      return trimmed.toLowerCase();
    }
  }

  return trimmed.toLowerCase();
}

function getDraftIdentityValue(field) {
  if (field === 'email') return draftEmail.value;
  if (field === 'telegram') return draftTelegram.value;
  return draftWallet.value;
}

function hasAtLeastOneIdentifier({ email, telegram, wallet }) {
  return Boolean(email?.trim() || telegram?.trim() || wallet?.trim());
}

async function saveIdentityField(field) {
  if (!canEditContacts.value || isCreateMode.value || !contact.value?.id) return;
  if (isSavingIdentity.value) return;

  const draftValue = getDraftIdentityValue(field);
  const currentValue = contact.value[field] || '';

  if (normalizeIdentityDraft(field, draftValue) === normalizeIdentityDraft(field, currentValue)) {
    return;
  }

  const nextValues = {
    email: field === 'email' ? draftValue : (contact.value.email || ''),
    telegram: field === 'telegram' ? draftValue : (contact.value.telegram || ''),
    wallet: field === 'wallet' ? draftValue : (contact.value.wallet || ''),
  };

  if (!hasAtLeastOneIdentifier(nextValues)) {
    ElMessageBox.alert(
      t('contacts.details.identifierRequired'),
      t('common.error'),
      { type: 'warning' }
    );
    syncFormFromContact();
    return;
  }

  isSavingIdentity.value = field;
  try {
    await contactsService.updateContact(contact.value.id, {
      [field]: draftValue.trim() || null,
    });
    await reloadContact();
  } catch (e) {
    ElMessageBox.alert(
      t('contacts.details.identitySaveError', {
        error: e?.response?.data?.error || e?.message || e,
      }),
      t('common.error'),
      { type: 'error' }
    );
    syncFormFromContact();
  } finally {
    isSavingIdentity.value = null;
  }
}

function saveName() {
  if (isCreateMode.value || editableName.value === contact.value.name) return;
  isSavingName.value = true;
  contactsService.updateContact(contact.value.id, { name: editableName.value })
    .then(() => reloadContact())
    .finally(() => { isSavingName.value = false; });
}

async function saveNewContact() {
  const email = draftEmail.value.trim();
  const telegram = draftTelegram.value.trim();
  const wallet = draftWallet.value.trim();

  if (!email && !telegram && !wallet) {
    ElMessageBox.alert(
      t('contacts.create.identifierRequired'),
      t('common.error'),
      { type: 'warning' }
    );
    return;
  }

  isSavingCreate.value = true;
  try {
    const result = await contactsService.createContact({
      name: editableName.value.trim(),
      email: email || undefined,
      telegram: telegram || undefined,
      wallet: wallet || undefined,
      language: selectedLanguages.value,
    });

    if (result?.success && result.contact?.id) {
      router.push({ name: 'contact-profile', params: { id: result.contact.id } });
      return;
    }

    throw new Error(result?.error || t('common.unknownError'));
  } catch (e) {
    ElMessageBox.alert(
      t('contacts.create.error', { error: e?.response?.data?.error || e?.message || e }),
      t('common.error'),
      { type: 'error' }
    );
  } finally {
    isSavingCreate.value = false;
  }
}

function cancelCreate() {
  router.push({ name: 'contacts-list' });
}

async function deleteMessagesHistory() {
  if (!contact.value?.id) return;

  try {
    const confirmed = await ElMessageBox.confirm(
      t('contacts.details.confirmDeleteHistory'),
      t('contacts.details.confirmDeleteHistoryTitle'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
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
        await loadLastMessageDate();
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

function showBlockStatusMessage(msg, type = 'info') {
  ElMessageBox.alert(msg, t('contacts.details.blockStatusTitle'), { type });
}

async function blockUser() {
  if (!contact.value) return;
  try {
    await contactsService.blockContact(contact.value.id);
    contact.value.is_blocked = true;
    showBlockStatusMessage(t('contacts.details.blockSuccess'), 'success');
  } catch {
    showBlockStatusMessage(t('contacts.details.blockError'), 'error');
  }
}

async function unblockUser() {
  if (!contact.value) return;
  try {
    await contactsService.unblockContact(contact.value.id);
    contact.value.is_blocked = false;
    showBlockStatusMessage(t('contacts.details.unblockSuccess'), 'success');
  } catch {
    showBlockStatusMessage(t('contacts.details.unblockError'), 'error');
  }
}

async function createTag() {
  if (!canManageTags.value || !newTagName.value) return;

  const tableId = await ensureTagsTable();
  const table = await tablesService.getTable(tableId);
  const nameCol = table.columns[0];
  const descCol = table.columns[1];
  const newRow = await tablesService.addRow(tableId);

  if (!newRow?.id) {
    alert(t('contacts.details.tagRowError'));
    return;
  }

  await tablesService.saveCell({
    table_id: tableId,
    row_id: newRow.id,
    column_id: nameCol.id,
    value: newTagName.value,
  });

  if (descCol && newTagDescription.value) {
    await tablesService.saveCell({
      table_id: tableId,
      row_id: newRow.id,
      column_id: descCol.id,
      value: newTagDescription.value,
    });
  }

  await loadAllTags();
  selectedTags.value = [...selectedTags.value, newRow.id];
  await addTagsToUser();
  newTagName.value = '';
  newTagDescription.value = '';
}

async function loadUserTags() {
  if (!contact.value?.id) {
    userTags.value = [];
    return;
  }

  const tagIds = await contactsService.getContactTags(contact.value.id);
  if (!Array.isArray(tagIds) || tagIds.length === 0) {
    userTags.value = [];
    return;
  }

  await loadAllTags();
  userTags.value = allTags.value.filter(tag => tagIds.includes(tag.id));
}

async function addTagsToUser() {
  if (!canManageTags.value || !contact.value?.id || !selectedTags.value?.length) return;

  try {
    await contactsService.addTagsToContact(contact.value.id, selectedTags.value);
    await loadUserTags();
    showTagModal.value = false;
    ElMessageBox.alert(t('contacts.details.tagsAdded'), t('common.success'), { type: 'success' });
  } catch (e) {
    ElMessageBox.alert(
      t('contacts.details.tagsAddError', { error: e?.response?.data?.error || e?.message || e }),
      t('common.error'),
      { type: 'error' }
    );
  }
}

async function removeUserTag(tagId) {
  if (!canManageTags.value || !contact.value?.id) return;

  try {
    await contactsService.removeTagFromContact(contact.value.id, tagId);
    await loadUserTags();
    ElMessageBox.alert(t('contacts.details.tagRemoved'), t('common.success'), { type: 'success' });
  } catch (e) {
    ElMessageBox.alert(
      t('contacts.details.tagRemoveError', { error: e?.response?.data?.error || e?.message || e }),
      t('common.error'),
      { type: 'error' }
    );
  }
}

async function loadProfileData() {
  syncFormFromContact();
  if (isCreateMode.value) return;
  await Promise.all([loadUserTags(), loadLastMessageDate()]);
}

onMounted(async () => {
  await loadProfileData();
  unsubscribeFromTags = onTagsUpdate(async () => {
    await loadAllTags();
    await loadUserTags();
  });
});

onUnmounted(() => {
  if (unsubscribeFromTags) {
    unsubscribeFromTags();
  }
});

watch(userId, () => {
  revealedFields.value = {};
  loadProfileData();
});

watch(contact, () => {
  syncFormFromContact();
}, { deep: true });
</script>

<style scoped>
.contact-profile {
  width: 100%;
}

.info-card {
  border: 1px solid var(--color-border);
  border-radius: var(--block-radius);
  background: var(--color-white);
  box-shadow: var(--shadow-sm);
  padding: var(--spacing-lg);
  overflow: hidden;
}

.contact-actions {
  display: grid;
  grid-template-columns: minmax(140px, 200px) 1fr;
  gap: 12px 20px;
  margin-top: 4px;
  padding-top: 12px;
}

.contact-actions__buttons {
  grid-column: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-start;
}

.info-grid {
  display: flex;
  flex-direction: column;
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

.info-value--meta {
  color: var(--color-grey);
  font-size: var(--font-size-md);
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
  max-width: 420px;
  width: 100%;
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
  gap: 12px;
}

.blocked-status {
  color: var(--color-danger);
  font-weight: 600;
}

.unblocked-status {
  color: var(--color-primary-dark);
  font-weight: 600;
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
  box-shadow: var(--shadow-sm);
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
  .info-row,
  .contact-actions {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .contact-actions__buttons {
    grid-column: 1;
  }
}
</style>
