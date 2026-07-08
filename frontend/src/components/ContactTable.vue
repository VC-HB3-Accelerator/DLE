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
  <div class="contacts-section">
    <div class="contacts-toolbar contacts-toolbar--primary">
      <div class="toolbar-group-actions">
        <el-button v-if="canChatWithAdmins" @click="goToPersonalMessages">
          {{ t('contacts.personalMessages') }}
          <el-badge v-if="privateUnreadCount > 0" :value="privateUnreadCount" class="notification-badge" />
        </el-button>
        <el-button v-if="canSendToUsers" :disabled="!hasSelectedEditor" @click="sendPublicMessage">
          {{ t('contacts.publicMessage') }}
        </el-button>
        <el-button v-if="canViewContacts" :disabled="!hasSelectedEditor" @click="sendPrivateMessage">
          {{ t('contacts.privateMessage') }}
        </el-button>
        <el-button v-if="canEditData" @click="showImportModal = true">{{ t('contacts.import') }}</el-button>
      </div>
    </div>

    <div v-if="selectedCount > 0 && hasBulkActions" class="contacts-toolbar contacts-toolbar--context">
      <span class="selection-info">{{ t('common.selected', { count: selectedCount }) }}</span>
      <div class="toolbar-group-actions">
        <el-button v-if="canManageTags" type="primary" @click="openBulkTagsDialog">
          {{ t('contacts.addTags') }}
        </el-button>
        <el-button v-if="canBroadcast" @click="goToBroadcastPage">
          {{ t('contacts.broadcast.button') }}
        </el-button>
        <el-button v-if="canDeleteMessages" type="danger" plain @click="deleteMessagesSelected">
          {{ t('contacts.deleteMessages') }}
        </el-button>
        <el-button v-if="canDeleteData" type="danger" @click="deleteSelected">
          {{ t('contacts.delete') }}
        </el-button>
        <el-button link @click="clearSelection">{{ t('contacts.clearSelection') }}</el-button>
      </div>
    </div>

    <el-form class="filters-form" label-position="top" @submit.prevent>
      <div class="filters-row filters-row--primary" :class="{ 'filters-row--compact': !isEditorRole }">
        <template v-if="isEditorRole">
          <el-form-item :label="t('contacts.search')" class="filter-search">
            <el-input v-model="filterSearch" :placeholder="t('contacts.searchPlaceholder')" clearable @input="onSearchInput" />
          </el-form-item>
          <el-form-item :label="t('contacts.contactType')">
            <el-select v-model="filterContactType" :placeholder="t('common.all')" class="filter-field" @change="() => applyFilters(true)">
              <el-option :label="t('common.all')" value="all" />
              <el-option :label="t('contacts.email')" value="email" />
              <el-option :label="t('contacts.telegram')" value="telegram" />
              <el-option :label="t('contacts.wallet')" value="wallet" />
            </el-select>
          </el-form-item>
        </template>
        <el-form-item v-if="isEditorRole" class="filters-actions" :label="'\u00a0'">
          <div class="filters-actions-buttons">
            <el-button :type="showAdvancedFilters ? 'primary' : 'default'" plain @click="toggleAdvancedFilters">
              {{ showAdvancedFilters ? t('contacts.lessFilters') : t('contacts.moreFilters') }}
              <span v-if="hasAdvancedFilters && !showAdvancedFilters" class="filters-active-dot" />
            </el-button>
            <el-button @click="resetFilters">{{ t('common.resetFilters') }}</el-button>
          </div>
        </el-form-item>
      </div>

      <div v-if="isEditorRole && showAdvancedFilters" class="filters-row filters-row--advanced">
        <el-form-item :label="t('contacts.createdDateFrom')">
          <el-date-picker v-model="filterCreatedDateFrom" type="date" :placeholder="t('contacts.createdDateFrom')" clearable class="filter-field" @change="() => applyFilters(true)" />
        </el-form-item>
        <el-form-item :label="t('contacts.createdDateTo')">
          <el-date-picker v-model="filterCreatedDateTo" type="date" :placeholder="t('contacts.createdDateTo')" clearable class="filter-field" @change="() => applyFilters(true)" />
        </el-form-item>
        <el-form-item :label="t('contacts.messageDateFrom')">
          <el-date-picker v-model="filterMessageDateFrom" type="date" :placeholder="t('contacts.messageDateFrom')" clearable class="filter-field" @change="() => applyFilters(true)" />
        </el-form-item>
        <el-form-item :label="t('contacts.messageDateTo')">
          <el-date-picker v-model="filterMessageDateTo" type="date" :placeholder="t('contacts.messageDateTo')" clearable class="filter-field" @change="() => applyFilters(true)" />
        </el-form-item>
        <el-form-item :label="t('contacts.newMessagesOnly')">
          <el-select v-model="filterNewMessages" :placeholder="t('common.no')" class="filter-field" @change="() => applyFilters(true)">
            <el-option :label="t('common.no')" :value="''" />
            <el-option :label="t('common.yes')" value="yes" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('contacts.blocked')">
          <el-select v-model="filterBlocked" :placeholder="t('common.all')" class="filter-field" @change="() => applyFilters(true)">
            <el-option :label="t('common.all')" value="all" />
            <el-option :label="t('contacts.blockedOnly')" value="blocked" />
            <el-option :label="t('contacts.unblockedOnly')" value="unblocked" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('contacts.tags')" class="filter-tags">
          <el-select
            v-model="selectedTagIds"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            :placeholder="availableTags.length ? t('contacts.selectTags') : t('contacts.noTagsAvailable')"
            :disabled="!availableTags.length"
            class="filter-field"
            @change="() => applyFilters(true)"
          >
            <el-option
              v-for="tag in availableTags"
              :key="tag.id"
              :label="tag.description ? `${tag.name} (${tag.description})` : tag.name"
              :value="tag.id"
            />
          </el-select>
        </el-form-item>
      </div>
    </el-form>

    <div class="contacts-pagination">
      <div class="contacts-pagination__size">
        <span class="contacts-pagination__label">{{ t('common.perPage') }}</span>
        <el-select
          v-model="pageSize"
          :disabled="isLoadingContacts"
          class="contacts-pagination__select"
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
        v-if="totalContacts > 0"
        :current-page="currentPage"
        :page-size="pageSize"
        :total="totalContacts"
        :disabled="isLoadingContacts"
        :hide-on-single-page="false"
        layout="total, prev, pager, next"
        @current-change="onPageChange"
      />
    </div>

    <div class="table-card">
      <div class="table-scroll-wrapper">
        <table class="contact-table" :class="{ 'is-resizing': isResizing }">
          <colgroup>
            <col v-if="canViewContacts" :style="columnWidthStyle('checkbox')" />
            <col v-if="isColumnVisible('id')" :style="columnWidthStyle('id')" />
            <col v-if="isColumnVisible('type')" :style="columnWidthStyle('type')" />
            <col v-if="isColumnVisible('name')" :style="columnWidthStyle('name')" />
            <col v-if="isColumnVisible('email')" :style="columnWidthStyle('email')" />
            <col v-if="isColumnVisible('telegram')" :style="columnWidthStyle('telegram')" />
            <col v-if="isColumnVisible('wallet')" :style="columnWidthStyle('wallet')" />
            <col v-if="isColumnVisible('date')" :style="columnWidthStyle('date')" />
            <col v-if="isColumnVisible('tags')" :style="columnWidthStyle('tags')" />
            <col v-if="isColumnVisible('blocked')" :style="columnWidthStyle('blocked')" />
            <col v-if="isColumnVisible('languages')" :style="columnWidthStyle('languages')" />
            <col v-if="isColumnVisible('lastMessageAt')" :style="columnWidthStyle('lastMessageAt')" />
            <col v-if="isEditorRole" :style="columnWidthStyle('settings')" />
          </colgroup>
          <thead>
            <tr>
              <th v-if="canViewContacts" class="col-checkbox resizable-th">
                <span class="th-label">
                  <input
                    ref="selectAllCheckboxRef"
                    type="checkbox"
                    :checked="selectAll"
                    @change="onSelectAllChange"
                  />
                </span>
                <span
                  class="col-resize-handle"
                  :title="t('contacts.resizeColumn')"
                  @mousedown="startResize('checkbox', $event)"
                />
              </th>
              <th v-if="isColumnVisible('id')" class="col-id resizable-th">
                <span class="th-label">{{ t('contacts.id') }}</span>
                <span
                  class="col-resize-handle"
                  :title="t('contacts.resizeColumn')"
                  @mousedown="startResize('id', $event)"
                />
              </th>
              <th v-if="isColumnVisible('type')" class="col-type resizable-th">
                <span class="th-label">{{ t('contacts.type') }}</span>
                <span
                  class="col-resize-handle"
                  :title="t('contacts.resizeColumn')"
                  @mousedown="startResize('type', $event)"
                />
              </th>
              <th v-if="isColumnVisible('name')" class="col-name resizable-th">
                <span class="th-label">{{ t('contacts.name') }}</span>
                <span
                  class="col-resize-handle"
                  :title="t('contacts.resizeColumn')"
                  @mousedown="startResize('name', $event)"
                />
              </th>
              <th v-if="isColumnVisible('email')" class="col-email resizable-th">
                <span class="th-label">{{ t('contacts.email') }}</span>
                <span
                  class="col-resize-handle"
                  :title="t('contacts.resizeColumn')"
                  @mousedown="startResize('email', $event)"
                />
              </th>
              <th v-if="isColumnVisible('telegram')" class="col-telegram resizable-th">
                <span class="th-label">{{ t('contacts.telegram') }}</span>
                <span
                  class="col-resize-handle"
                  :title="t('contacts.resizeColumn')"
                  @mousedown="startResize('telegram', $event)"
                />
              </th>
              <th v-if="isColumnVisible('wallet')" class="col-wallet resizable-th">
                <span class="th-label">{{ t('contacts.wallet') }}</span>
                <span
                  class="col-resize-handle"
                  :title="t('contacts.resizeColumn')"
                  @mousedown="startResize('wallet', $event)"
                />
              </th>
              <th v-if="isColumnVisible('date')" class="col-date resizable-th">
                <span class="th-label">{{ t('contacts.createdAt') }}</span>
                <span
                  class="col-resize-handle"
                  :title="t('contacts.resizeColumn')"
                  @mousedown="startResize('date', $event)"
                />
              </th>
              <th v-if="isColumnVisible('tags')" class="col-tags resizable-th">
                <span class="th-label">{{ t('contacts.tags') }}</span>
                <span
                  class="col-resize-handle"
                  :title="t('contacts.resizeColumn')"
                  @mousedown="startResize('tags', $event)"
                />
              </th>
              <th v-if="isColumnVisible('blocked')" class="col-blocked resizable-th">
                <span class="th-label">{{ t('contacts.blocked') }}</span>
                <span
                  class="col-resize-handle"
                  :title="t('contacts.resizeColumn')"
                  @mousedown="startResize('blocked', $event)"
                />
              </th>
              <th v-if="isColumnVisible('languages')" class="col-languages resizable-th">
                <span class="th-label">{{ t('contacts.languages') }}</span>
                <span
                  class="col-resize-handle"
                  :title="t('contacts.resizeColumn')"
                  @mousedown="startResize('languages', $event)"
                />
              </th>
              <th v-if="isColumnVisible('lastMessageAt')" class="col-last-message resizable-th">
                <span class="th-label">{{ t('contacts.lastMessageAt') }}</span>
                <span
                  class="col-resize-handle"
                  :title="t('contacts.resizeColumn')"
                  @mousedown="startResize('lastMessageAt', $event)"
                />
              </th>
              <th v-if="isEditorRole" class="col-settings">
                <el-popover placement="bottom-end" :width="240" trigger="click">
                  <template #reference>
                    <button type="button" class="columns-menu-btn" :title="t('contacts.columnsSettings')">
                      {{ t('contacts.columnsSettings') }}
                    </button>
                  </template>
                  <div class="columns-menu">
                    <p class="columns-menu__title">{{ t('contacts.columnsSettings') }}</p>
                    <el-checkbox-group v-model="visibleColumnKeys" class="columns-menu__list" @change="saveVisibleColumns">
                      <el-checkbox
                        v-for="column in toggleableColumns"
                        :key="column.key"
                        :value="column.key"
                      >
                        {{ t(column.labelKey) }}
                      </el-checkbox>
                    </el-checkbox-group>
                    <el-button class="columns-menu__reset" size="small" link @click="resetVisibleColumns">
                      {{ t('contacts.columnsReset') }}
                    </el-button>
                  </div>
                </el-popover>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoadingContacts">
              <td :colspan="tableColspan" class="loading-row">{{ t('contacts.loading') }}</td>
            </tr>
            <tr v-else-if="!pageContacts.length">
              <td :colspan="tableColspan" class="loading-row">{{ t('contacts.notFound') }}</td>
            </tr>
            <tr
              v-for="contact in pageContacts"
              :key="contact.id"
              class="contact-row"
              :class="{ 'new-contact-row': newIds.includes(contact.id) }"
              @click="goToContactDetails(contact.id)"
            >
              <td v-if="canViewContacts" class="col-checkbox" @click.stop>
                <input
                  type="checkbox"
                  :checked="isContactSelected(contact.id)"
                  @change="onContactCheckboxChange(contact, $event)"
                />
              </td>
              <td v-if="isColumnVisible('id')" class="col-id">{{ contact.id }}</td>
              <td v-if="isColumnVisible('type')" class="col-type">
                <span
                  v-if="getRoleDisplayName(contact.role)"
                  :class="getRoleClass(contact.role)"
                >
                  {{ getRoleDisplayName(contact.role) }}
                </span>
                <span v-else class="user-badge">{{ t('common.unknown') }}</span>
              </td>
              <td v-if="isColumnVisible('name')" class="col-name">{{ contact.name || '-' }}</td>
              <td
                v-if="isColumnVisible('email')"
                class="col-email personal-field"
                :class="{ 'personal-field--revealed': isFieldRevealed(contact.id, 'email') }"
                :title="getFieldTitle(contact.id, 'email', contact.email)"
                @click.stop="toggleFieldReveal(contact.id, 'email')"
              >{{ getPersonalFieldDisplay(contact.id, 'email', contact.email) }}</td>
              <td
                v-if="isColumnVisible('telegram')"
                class="col-telegram personal-field"
                :class="{ 'personal-field--revealed': isFieldRevealed(contact.id, 'telegram') }"
                :title="getFieldTitle(contact.id, 'telegram', contact.telegram)"
                @click.stop="toggleFieldReveal(contact.id, 'telegram')"
              >{{ getPersonalFieldDisplay(contact.id, 'telegram', contact.telegram) }}</td>
              <td
                v-if="isColumnVisible('wallet')"
                class="col-wallet personal-field"
                :class="{ 'personal-field--revealed': isFieldRevealed(contact.id, 'wallet') }"
                :title="getFieldTitle(contact.id, 'wallet', contact.wallet)"
                @click.stop="toggleFieldReveal(contact.id, 'wallet')"
              >{{ getPersonalFieldDisplay(contact.id, 'wallet', contact.wallet) }}</td>
              <td v-if="isColumnVisible('date')" class="col-date">{{ formatContactDate(contact.created_at) }}</td>
              <td v-if="isColumnVisible('tags')" class="col-tags">{{ formatContactTags(contact) }}</td>
              <td v-if="isColumnVisible('blocked')" class="col-blocked">{{ formatContactBlocked(contact) }}</td>
              <td v-if="isColumnVisible('languages')" class="col-languages">{{ formatContactLanguages(contact) }}</td>
              <td v-if="isColumnVisible('lastMessageAt')" class="col-last-message">{{ formatContactLastMessageAt(contact) }}</td>
              <td v-if="isEditorRole" class="col-settings" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ImportContactsModal v-if="showImportModal" @close="showImportModal = false" @imported="onImported" />

    <el-dialog
      v-model="bulkTagsDialogVisible"
      :title="t('contacts.bulkAddTagsTitle', { count: selectedCount })"
      width="480px"
    >
      <p class="bulk-tags-hint">{{ t('contacts.bulkAddTagsHint') }}</p>
      <el-select
        v-model="bulkSelectedTagIds"
        multiple
        filterable
        collapse-tags
        collapse-tags-tooltip
        :placeholder="availableTags.length ? t('contacts.selectTags') : t('contacts.noTagsAvailable')"
        :disabled="!availableTags.length || bulkTagsLoading"
        class="bulk-tags-select"
      >
        <el-option
          v-for="tag in availableTags"
          :key="tag.id"
          :label="tag.description ? `${tag.name} (${tag.description})` : tag.name"
          :value="tag.id"
        />
      </el-select>
      <template #footer>
        <el-button :disabled="bulkTagsLoading" @click="bulkTagsDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button
          type="primary"
          :loading="bulkTagsLoading"
          :disabled="!bulkSelectedTagIds.length"
          @click="applyBulkTags"
        >
          {{ t('contacts.bulkAddTagsApply') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { defineProps, computed, ref, onMounted, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ElSelect, ElOption, ElForm, ElFormItem, ElInput, ElDatePicker, ElButton, ElMessageBox, ElMessage, ElPagination, ElPopover, ElCheckbox, ElCheckboxGroup } from 'element-plus';
import ImportContactsModal from './ImportContactsModal.vue';
import messagesService from '../services/messagesService';
import { getContacts } from '../services/contactsService';
import contactsService from '../services/contactsService';
import { usePermissions } from '@/composables/usePermissions';
import { useAuthContext } from '@/composables/useAuth';
import { getPrivateUnreadCount } from '../services/messagesService';
import { useRoles } from '@/composables/useRoles';
import { loadClientTagsList, resolveClientTagsTableId } from '../utils/clientTagsTable';
import websocketServiceModule from '../services/websocketService';
import { useTagsWebSocket } from '../composables/useTagsWebSocket';
import { useResizableColumns } from '@/composables/useResizableColumns';
import { useContactTableColumns, CONTACT_TABLE_COLUMNS } from '@/composables/useContactTableColumns';

const CONTACT_TABLE_COLUMN_WIDTHS = {
  checkbox: 44,
  id: 72,
  type: 104,
  name: 180,
  email: 150,
  telegram: 130,
  wallet: 150,
  date: 168,
  tags: 180,
  blocked: 120,
  languages: 140,
  lastMessageAt: 168,
  settings: 120
};

const {
  visibleColumnKeys,
  toggleableColumns,
  isColumnVisible: isSavedColumnVisible,
  saveVisibleColumns,
  resetVisibleColumns
} = useContactTableColumns();

function isColumnVisible(key) {
  if (!isEditorRole.value) {
    const column = CONTACT_TABLE_COLUMNS.find((item) => item.key === key);
    return column?.defaultVisible ?? false;
  }
  return isSavedColumnVisible(key);
}

const { startResize, columnWidthStyle, isResizing } = useResizableColumns(
  'contact-table-column-widths',
  CONTACT_TABLE_COLUMN_WIDTHS
);

const { t } = useI18n();
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
const { canViewContacts, canSendToUsers, canDeleteData, canDeleteMessages, canBroadcast, canChatWithAdmins, canEditData, canManageTags } = usePermissions();
const { userAccessLevel, userId, isAuthenticated } = useAuthContext();
const { getRoleDisplayName, getRoleClass, fetchRoles } = useRoles();
const { onTagsUpdate } = useTagsWebSocket();
const { onTableUpdate } = websocketServiceModule;

let unsubscribeTagsTableUpdate = null;

async function setupTagsTableWebSocket() {
  if (unsubscribeTagsTableUpdate) {
    unsubscribeTagsTableUpdate();
    unsubscribeTagsTableUpdate = null;
  }

  if (!isEditorRole.value) {
    return;
  }

  try {
    const tableId = await resolveClientTagsTableId();
    if (!tableId) {
      return;
    }
    unsubscribeTagsTableUpdate = onTableUpdate(tableId, () => {
      loadAvailableTags();
    });
  } catch (error) {
    console.error('[ContactTable] Ошибка подписки на таблицу тегов:', error);
  }
}

const pageContacts = ref([]);
const totalContacts = ref(0);
const currentPage = ref(1);
const pageSize = ref(100);
const isLoadingContacts = ref(false);
const selectedContactsCache = ref({});

// Фильтры
const filterSearch = ref('');
const filterContactType = ref('all');
const filterCreatedDateFrom = ref('');
const filterCreatedDateTo = ref('');
const filterMessageDateFrom = ref('');
const filterMessageDateTo = ref('');
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

const availableTags = ref([]);
const selectedTagIds = ref([]);
const isLoadingTags = ref(false);

async function loadAvailableTags() {
  if (!isEditorRole.value) {
    availableTags.value = [];
    return;
  }

  isLoadingTags.value = true;
  try {
    availableTags.value = await loadClientTagsList();
  } catch (error) {
    console.error('[ContactTable] Ошибка загрузки тегов:', error);
    availableTags.value = [];
  } finally {
    isLoadingTags.value = false;
  }
}

onTagsUpdate(() => {
  loadAvailableTags();
});

const showImportModal = ref(false);
const bulkTagsDialogVisible = ref(false);
const bulkSelectedTagIds = ref([]);
const bulkTagsLoading = ref(false);

const selectedIds = ref([]);
const selectAll = ref(false);
const selectAllCheckboxRef = ref(null);
const revealedFields = ref({});
let searchDebounceTimer = null;

function normalizeContactId(id) {
  return id == null ? '' : String(id);
}

const selectedCount = computed(() => {
  const unique = new Set(selectedIds.value.map(normalizeContactId).filter(Boolean));
  return unique.size;
});

const selectedIdsForActions = computed(() => {
  const seen = new Set();
  const result = [];
  for (const id of selectedIds.value) {
    const norm = normalizeContactId(id);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    result.push(id);
  }
  return result;
});

/** Только зарегистрированные пользователи (гости guest_* не поддерживают теги/рассылку) */
const selectedRegisteredUserIds = computed(() => (
  selectedIdsForActions.value.filter((id) => {
    const n = Number(id);
    return Number.isInteger(n) && n > 0;
  })
));

const selectedGuestCount = computed(() => (
  selectedIdsForActions.value.length - selectedRegisteredUserIds.value.length
));

function isContactSelected(id) {
  const norm = normalizeContactId(id);
  return selectedIds.value.some(sid => normalizeContactId(sid) === norm);
}

function addIdsToSelection(ids) {
  const existing = new Set(selectedIds.value.map(normalizeContactId));
  const next = [...selectedIds.value];
  for (const id of ids) {
    const norm = normalizeContactId(id);
    if (!norm || existing.has(norm)) continue;
    existing.add(norm);
    next.push(id);
  }
  selectedIds.value = next;
}

function removeIdsFromSelection(ids) {
  const removeSet = new Set(ids.map(normalizeContactId));
  selectedIds.value = selectedIds.value.filter(id => !removeSet.has(normalizeContactId(id)));
}

function onContactCheckboxChange(contact, event) {
  if (event.target.checked) {
    addIdsToSelection([contact.id]);
    cacheContacts([contact]);
  } else {
    removeIdsFromSelection([contact.id]);
  }
  updateSelectAllState();
}

function onSelectAllChange(event) {
  const checked = event.target.checked;
  selectAll.value = checked;
  const pageIds = pageContacts.value.map(c => c.id);
  if (checked) {
    addIdsToSelection(pageIds);
    cacheContacts(pageContacts.value);
  } else {
    removeIdsFromSelection(pageIds);
  }
}

function personalFieldKey(contactId, field) {
  return `${contactId}:${field}`;
}

function isFieldRevealed(contactId, field) {
  return Boolean(revealedFields.value[personalFieldKey(contactId, field)]);
}

function toggleFieldReveal(contactId, field) {
  const key = personalFieldKey(contactId, field);
  if (revealedFields.value[key]) {
    const next = { ...revealedFields.value };
    delete next[key];
    revealedFields.value = next;
    return;
  }
  revealedFields.value = {
    ...revealedFields.value,
    [key]: true
  };
}

function clearRevealedFields() {
  revealedFields.value = {};
}

function getCompactMask(field, value) {
  if (field === 'email') return '•••@•••';
  if (field === 'telegram') return String(value).startsWith('@') ? '@•••' : '•••';
  if (field === 'wallet') return String(value).startsWith('0x') ? '0x•••' : '•••';
  return '••••';
}

function getPersonalFieldDisplay(contactId, field, value) {
  if (!value || value === '-') return '-';
  if (isFieldRevealed(contactId, field)) return value;
  return getCompactMask(field, value);
}

function getFieldTitle(contactId, field, value) {
  if (!value || value === '-') return '';
  return isFieldRevealed(contactId, field) ? t('contacts.clickToHide') : t('contacts.clickToReveal');
}

function clearSelection() {
  selectedIds.value = [];
  selectAll.value = false;
  updateSelectAllIndeterminate();
}

function cacheContacts(contacts) {
  for (const contact of contacts) {
    selectedContactsCache.value[normalizeContactId(contact.id)] = contact;
  }
}

function getContactByIdLocal(id) {
  const norm = normalizeContactId(id);
  if (selectedContactsCache.value[norm]) {
    return selectedContactsCache.value[norm];
  }
  return pageContacts.value.find(c => normalizeContactId(c.id) === norm) || null;
}

const hasSelectedEditor = computed(() => (
  selectedIdsForActions.value.some(id => getContactByIdLocal(id)?.role === 'editor')
));

const hasBulkActions = computed(() => canManageTags.value || canBroadcast.value || canDeleteMessages.value || canDeleteData.value);

const showAdvancedFilters = ref(false);

const hasAdvancedFilters = computed(() => Boolean(
  filterCreatedDateFrom.value
  || filterCreatedDateTo.value
  || filterMessageDateFrom.value
  || filterMessageDateTo.value
  || filterNewMessages.value
  || (filterBlocked.value && filterBlocked.value !== 'all')
  || selectedTagIds.value.length > 0
));

function toggleAdvancedFilters() {
  showAdvancedFilters.value = !showAdvancedFilters.value;
}

const isEditorRole = computed(() => userAccessLevel.value?.level === 'editor');

const tableColspan = computed(() => {
  let count = isEditorRole.value
    ? visibleColumnKeys.value.length
    : CONTACT_TABLE_COLUMNS.filter((column) => column.defaultVisible).length;
  if (canViewContacts.value) count += 1;
  if (isEditorRole.value) count += 1;
  return Math.max(count, 1);
});

const tagNameById = computed(() => {
  const map = new Map();
  availableTags.value.forEach((tag) => {
    map.set(tag.id, tag.name);
  });
  return map;
});

function formatContactDate(value) {
  return value ? new Date(value).toLocaleString() : '-';
}

function formatContactTags(contact) {
  const tagIds = Array.isArray(contact.tag_ids) ? contact.tag_ids : [];
  if (!tagIds.length) return '-';
  const names = tagIds
    .map((tagId) => tagNameById.value.get(tagId) || `#${tagId}`)
    .filter(Boolean);
  return names.length ? names.join(', ') : '-';
}

function formatContactBlocked(contact) {
  if (contact.is_blocked) return t('contacts.blockedYes');
  return t('contacts.blockedNo');
}

function formatContactLanguages(contact) {
  const languages = Array.isArray(contact.preferred_language) ? contact.preferred_language : [];
  return languages.length ? languages.join(', ') : '-';
}

function formatContactLastMessageAt(contact) {
  const value = contact.last_message_at || contact.guest_info?.last_message_at;
  return formatContactDate(value);
}

watch(visibleColumnKeys, (keys) => {
  if (!isEditorRole.value) return;
  if (!keys.length) {
    visibleColumnKeys.value = ['id'];
    saveVisibleColumns();
  }
}, { deep: true });

watch(showAdvancedFilters, (isOpen) => {
  if (isOpen) {
    loadAvailableTags();
  }
});

watch(isEditorRole, async (isEditor) => {
  if (isEditor) {
    await loadAvailableTags();
    await setupTagsTableWebSocket();
  } else {
    availableTags.value = [];
    if (unsubscribeTagsTableUpdate) {
      unsubscribeTagsTableUpdate();
      unsubscribeTagsTableUpdate = null;
    }
  }
});

function buildFilterParams() {
  const limit = PAGE_SIZE_OPTIONS.includes(Number(pageSize.value))
    ? Number(pageSize.value)
    : 100;
  const params = {
    limit,
    offset: Math.max(0, (currentPage.value - 1) * limit)
  };
  if (selectedTagIds.value.length > 0) params.tagIds = selectedTagIds.value.join(',');
  if (filterCreatedDateFrom.value) params.createdDateFrom = formatDateOnly(filterCreatedDateFrom.value);
  if (filterCreatedDateTo.value) params.createdDateTo = formatDateOnly(filterCreatedDateTo.value);
  if (filterMessageDateFrom.value) params.messageDateFrom = formatDateOnly(filterMessageDateFrom.value);
  if (filterMessageDateTo.value) params.messageDateTo = formatDateOnly(filterMessageDateTo.value);
  if (filterContactType.value && filterContactType.value !== 'all') params.contactType = filterContactType.value;
  if (filterSearch.value) params.search = filterSearch.value;
  if (filterNewMessages.value) params.newMessages = filterNewMessages.value;
  if (filterBlocked.value && filterBlocked.value !== 'all') params.blocked = filterBlocked.value;
  return params;
}

async function loadContactsPage(options = {}) {
  if (!isAuthenticated.value) return;
  isLoadingContacts.value = true;
  try {
    const result = await getContacts(buildFilterParams());
    pageContacts.value = result.contacts || [];
    totalContacts.value = result.total || 0;

    const limit = PAGE_SIZE_OPTIONS.includes(Number(pageSize.value))
      ? Number(pageSize.value)
      : 100;
    const maxPage = Math.max(1, Math.ceil(totalContacts.value / limit) || 1);
    if (currentPage.value > maxPage && !options.clampRetried) {
      currentPage.value = maxPage;
      isLoadingContacts.value = false;
      return loadContactsPage({ clampRetried: true });
    }

    cacheContacts(pageContacts.value);
    clearRevealedFields();
    updateSelectAllState();
    updateSelectAllIndeterminate();
  } catch (error) {
    console.error('[ContactTable] Ошибка загрузки контактов:', error);
    ElMessage.error(t('crm.loadContactsError'));
    pageContacts.value = [];
    totalContacts.value = 0;
  } finally {
    isLoadingContacts.value = false;
  }
}

function updateSelectAllState() {
  const pageIds = pageContacts.value.map(c => normalizeContactId(c.id));
  if (!pageIds.length) {
    selectAll.value = false;
    return;
  }
  const selectedOnPage = selectedIds.value.map(normalizeContactId);
  selectAll.value = pageIds.every(id => selectedOnPage.includes(id));
}

function applyFilters(resetPage = true) {
  if (resetPage) currentPage.value = 1;
  clearSelection();
  clearRevealedFields();
  loadContactsPage();
}

function onSearchInput() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => applyFilters(true), 350);
}

function onPageChange(page) {
  if (page === currentPage.value) return;
  currentPage.value = page;
  loadContactsPage();
}

function onPageSizeChange(size) {
  const nextSize = Number(size);
  pageSize.value = PAGE_SIZE_OPTIONS.includes(nextSize) ? nextSize : 100;
  currentPage.value = 1;
  loadContactsPage();
}

function updateSelectAllIndeterminate() {
  const el = selectAllCheckboxRef.value;
  if (!el) return;
  const pageIds = pageContacts.value.map(c => normalizeContactId(c.id));
  if (!pageIds.length) {
    el.indeterminate = false;
    return;
  }
  const selectedOnPageCount = pageIds.filter(id => isContactSelected(id)).length;
  el.indeterminate = selectedOnPageCount > 0 && selectedOnPageCount < pageIds.length;
}

watch(selectedIds, () => {
  const selectedOnPage = pageContacts.value.filter(c => isContactSelected(c.id));
  cacheContacts(selectedOnPage);
  updateSelectAllState();
  updateSelectAllIndeterminate();
}, { deep: true });

watch(pageContacts, () => {
  updateSelectAllState();
  updateSelectAllIndeterminate();
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
      await loadAvailableTags();
      await setupTagsTableWebSocket();
      await loadContactsPage();
      if (hasAdvancedFilters.value) {
        showAdvancedFilters.value = true;
      }
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
      await loadAvailableTags();
      await setupTagsTableWebSocket();
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
  if (unsubscribeTagsTableUpdate) {
    unsubscribeTagsTableUpdate();
    unsubscribeTagsTableUpdate = null;
  }
});

function resetFilters() {
  filterSearch.value = '';
  filterContactType.value = 'all';
  filterCreatedDateFrom.value = '';
  filterCreatedDateTo.value = '';
  filterMessageDateFrom.value = '';
  filterMessageDateTo.value = '';
  filterNewMessages.value = '';
  filterBlocked.value = 'all';
  selectedTagIds.value = [];
  showAdvancedFilters.value = false;
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
  if (!selectedIdsForActions.value.length) return;
  
  const contactId = selectedIdsForActions.value[0];
  
  // Находим контакт в списке
  const contact = getContactByIdLocal(contactId);
  if (!contact) return;
  
  // Открываем чат с этим контактом (user_chat)
  await goToContactDetails(contact.id);
}

// Новая функция для отправки публичного сообщения
function sendPublicMessage() {
  if (!selectedIdsForActions.value.length) {
    ElMessage.warning(t('contacts.selectContactPublic'));
    return;
  }
  
  const contactId = selectedIdsForActions.value[0];
  const contact = getContactByIdLocal(contactId);
  if (!contact) {
    ElMessage.error(t('contacts.contactNotFound'));
    return;
  }
  
  // Открываем страницу детали контакта с чатом для публичных сообщений
  goToContactDetails(contactId);
}

// Функция для открытия приватного чата
function sendPrivateMessage() {
  if (!selectedIdsForActions.value.length) {
    ElMessage.warning(t('contacts.selectContactPrivate'));
    return;
  }
  
  // Открываем приватный чат вместо отправки через prompt
  openPrivateChatForSelected();
}

async function openPrivateChatForSelected(contact = null) {
  let targetContact = contact;
  
  // Если контакт не передан, берем из выбранных
  if (!targetContact) {
    if (!selectedIdsForActions.value.length) {
      console.error('[ContactTable] Нет выбранных контактов');
      return;
    }
    
    const contactId = selectedIdsForActions.value[0];
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
  if (!selectedRegisteredUserIds.value.length) {
    if (selectedGuestCount.value > 0) {
      ElMessage.warning(t('contacts.guestsExcludedFromBroadcast'));
    } else {
      ElMessage.warning(t('contacts.selectForBroadcast'));
    }
    return;
  }
  if (selectedGuestCount.value > 0) {
    ElMessage.info(t('contacts.guestsExcludedFromBroadcast'));
  }
  router.push({
    name: 'contacts-broadcast',
    query: { ids: selectedRegisteredUserIds.value.join(',') }
  });
}

async function openBulkTagsDialog() {
  if (!selectedRegisteredUserIds.value.length) {
    if (selectedGuestCount.value > 0) {
      ElMessage.warning(t('contacts.guestsExcludedFromTags'));
    } else {
      ElMessage.warning(t('contacts.selectForTags'));
    }
    return;
  }
  if (selectedGuestCount.value > 0) {
    ElMessage.info(t('contacts.guestsExcludedFromTags'));
  }

  bulkSelectedTagIds.value = [];
  bulkTagsDialogVisible.value = true;

  if (!availableTags.value.length) {
    await loadAvailableTags();
  }
}

async function applyBulkTags() {
  if (!selectedRegisteredUserIds.value.length || !bulkSelectedTagIds.value.length) {
    return;
  }

  bulkTagsLoading.value = true;
  try {
    await contactsService.addTagsToContactsBulk(
      selectedRegisteredUserIds.value,
      bulkSelectedTagIds.value
    );
    ElMessage.success(t('contacts.bulkAddTagsSuccess', {
      users: selectedRegisteredUserIds.value.length,
      tags: bulkSelectedTagIds.value.length
    }));
    bulkTagsDialogVisible.value = false;
    bulkSelectedTagIds.value = [];
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || t('contacts.bulkAddTagsError'));
  } finally {
    bulkTagsLoading.value = false;
  }
}

async function deleteSelected() {
  if (!selectedIdsForActions.value.length) return;
  try {
    await ElMessageBox.confirm(
      t('contacts.confirmDelete', { count: selectedIdsForActions.value.length }),
      t('contacts.confirmDeleteTitle'),
      { type: 'warning' }
    );
    for (const id of selectedIdsForActions.value) {
      await fetch(`/api/users/${id}`, { method: 'DELETE' });
    }
    ElMessage.success(t('contacts.deleted'));
    selectedIds.value = [];
    selectAll.value = false;
    await loadContactsPage();
  } catch (e) {
    // Отмена
  }
}

async function deleteMessagesSelected() {
  if (!selectedIdsForActions.value.length) return;
  try {
    await ElMessageBox.confirm(
      t('contacts.confirmDeleteMessages', { count: selectedIdsForActions.value.length }),
      t('contacts.confirmDeleteMessagesTitle'),
      { type: 'warning' }
    );
    
    let deletedMessages = 0;
    let deletedConversations = 0;
    
    for (const id of selectedIdsForActions.value) {
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
    
    ElMessage.success(t('contacts.deletedMessages', { messages: deletedMessages, conversations: deletedConversations }));
    selectedIds.value = [];
    selectAll.value = false;
  } catch (e) {
    // Отмена
  }
}
</script>

<style scoped>
.contacts-section {
  width: 100%;
}

.contacts-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.contacts-toolbar--primary {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
}

.contacts-toolbar--context {
  padding: 12px 16px;
  background: #f0faf0;
  border: 1px solid rgba(76, 175, 80, 0.35);
  border-radius: var(--block-radius);
  margin-bottom: 16px;
}

.contacts-toolbar--context .selection-info {
  margin-right: 8px;
  font-weight: 600;
  color: var(--color-primary-dark);
  white-space: nowrap;
}

.toolbar-group-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.contacts-toolbar--context .toolbar-group-actions {
  flex: 1;
}

.selection-info {
  font-weight: 600;
  color: var(--color-primary);
  white-space: nowrap;
}

.filters-form {
  background: var(--color-light);
  border: 1px solid var(--color-border);
  border-radius: var(--block-radius);
  padding: var(--spacing-md) var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: 0;
}

.filters-form :deep(.el-form-item) {
  margin-bottom: 0;
  margin-right: 0;
  width: 100%;
  min-width: 0;
}

.filters-form :deep(.el-form-item__content) {
  width: 100%;
  min-width: 0;
}

.filters-row {
  display: grid;
  align-items: end;
  gap: 12px 16px;
  width: 100%;
}

.filters-row--primary {
  grid-template-columns: minmax(180px, 2fr) minmax(120px, 1fr) auto;
}

.filters-row--compact {
  grid-template-columns: 1fr;
}

.contacts-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  margin-bottom: var(--spacing-md);
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--block-radius);
  background: var(--color-white);
}

.contacts-pagination__size {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.contacts-pagination__label {
  font-size: var(--font-size-sm);
  color: var(--color-grey);
  white-space: nowrap;
}

.contacts-pagination__select {
  width: 96px;
}

.contacts-pagination__summary {
  font-size: var(--font-size-sm);
  color: var(--color-grey);
}

.contacts-pagination :deep(.el-pagination) {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.filters-row--advanced {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--color-grey-light);
}

.filter-field {
  width: 100%;
}

.filter-search {
  min-width: 0;
}

.filter-tags {
  grid-column: 1 / -1;
  max-width: 520px;
}

.filters-actions {
  justify-self: end;
}

.filters-actions :deep(.el-form-item__label) {
  color: transparent;
  user-select: none;
}

.filters-actions :deep(.el-form-item__content) {
  width: auto;
}

.filters-actions-buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.filters-active-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-left: 6px;
  border-radius: 50%;
  background: var(--color-primary);
  vertical-align: middle;
}

.table-card {
  border: 1px solid var(--color-border);
  border-radius: var(--block-radius);
  background: var(--color-white);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.table-scroll-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.contact-table {
  width: 100%;
  min-width: 720px;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: var(--font-size-md);
}

.contact-table thead th {
  background: var(--color-light);
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-dark);
  padding: 10px 12px;
  border-bottom: 2px solid var(--color-border);
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
}

.resizable-th {
  position: relative;
}

.th-label {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 6px;
}

.col-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  z-index: 2;
  touch-action: none;
}

.col-resize-handle::after {
  content: '';
  position: absolute;
  top: 20%;
  right: 3px;
  width: 2px;
  height: 60%;
  border-radius: 1px;
  background: transparent;
  transition: background var(--transition-fast);
}

.col-resize-handle:hover::after,
.contact-table.is-resizing .col-resize-handle::after {
  background: var(--color-primary);
}

.contact-table tbody tr {
  transition: background var(--transition-fast);
}

.contact-table tbody tr:nth-child(even) {
  background: #fafafa;
}

.contact-row {
  cursor: pointer;
}

.contact-table tbody tr:hover {
  background: #f0faf0;
}

.contact-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-grey-light);
  vertical-align: middle;
  word-break: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-checkbox {
  text-align: center;
}

.col-checkbox .th-label {
  padding-right: 0;
}

.col-id,
.col-type,
.col-date {
  white-space: nowrap;
}

.col-name,
.col-email,
.col-telegram,
.col-wallet,
.col-tags,
.col-languages {
  min-width: 0;
}

.col-settings {
  text-align: center;
  padding: 6px 8px;
  white-space: nowrap;
}

.columns-menu-btn {
  border: 1px solid var(--color-border);
  background: var(--color-white);
  color: var(--color-dark);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.columns-menu-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.columns-menu__title {
  margin: 0 0 10px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-dark);
}

.columns-menu__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
}

.columns-menu__reset {
  margin-top: 10px;
}

.personal-field {
  cursor: pointer;
  color: var(--color-grey);
  font-variant-numeric: tabular-nums;
  user-select: none;
}

.personal-field--revealed {
  color: var(--color-dark);
  word-break: break-all;
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  user-select: text;
}

.personal-field:not(.personal-field--revealed):hover {
  color: var(--color-primary-dark);
  background: rgba(76, 175, 80, 0.08);
}

.loading-row {
  text-align: center;
  padding: 24px;
  color: var(--color-grey);
}

.new-contact-row {
  background: #e8f5e9 !important;
}

.new-contact-row:hover {
  background: #c8e6c9 !important;
}

.admin-badge {
  background: #e3f2fd;
  color: #1976d2;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--font-size-xs);
}

.editor-badge {
  background: #f3e5f5;
  color: #7b1fa2;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--font-size-xs);
}

.readonly-badge {
  background: #e8f5e8;
  color: var(--color-primary-dark);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.user-badge {
  background: var(--color-light);
  color: var(--color-grey);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.notification-badge {
  margin-left: 8px;
}

.bulk-tags-hint {
  margin: 0 0 12px;
  color: var(--color-grey);
  line-height: 1.5;
}

.bulk-tags-select {
  width: 100%;
}

@media (max-width: 900px) {
  .filters-row--primary,
  .filters-row--advanced {
    grid-template-columns: 1fr;
  }

  .contacts-pagination {
    flex-direction: column;
    align-items: stretch;
  }

  .contacts-pagination :deep(.el-pagination) {
    justify-content: center;
  }

  .filters-actions {
    justify-self: stretch;
  }

  .filters-actions-buttons {
    justify-content: flex-start;
  }

  .filter-tags {
    max-width: none;
  }
}

@media (max-width: 700px) {
  .contacts-toolbar {
    gap: 12px;
  }

  .contacts-toolbar--context {
    flex-direction: column;
    align-items: flex-start;
  }

  .contact-table {
    min-width: 640px;
    font-size: var(--font-size-sm);
  }

  .contact-table th,
  .contact-table td {
    padding: 8px;
  }
}
</style> 