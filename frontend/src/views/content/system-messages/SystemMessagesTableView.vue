<!--
  Управление системными сообщениями (табличный вид)
-->

<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="system-messages-page">
      <div class="page-header">
        <div class="header-content">
          <h1>Системные сообщения</h1>
          <p v-if="canManageSystemMessages">
            Создавайте и управляйте уведомлениями, которые видят пользователи в чате и интерфейсе DLE
          </p>
          <p v-else>
            Для работы с системными сообщениями требуются права редактора.
          </p>
        </div>
        <div class="header-actions">
          <button class="close-btn" @click="goBack">×</button>
        </div>
      </div>

      <section v-if="!canManageSystemMessages" class="permission-warning">
        <p>У вас нет прав для просмотра и редактирования системных сообщений.</p>
      </section>

      <section v-else class="table-section">
        <div class="toolbar">
          <div class="search-group">
            <label class="sr-only" for="system-message-search">Поиск</label>
            <input
              id="system-message-search"
              v-model="searchTerm"
              type="search"
              placeholder="Поиск по заголовку..."
              class="search-input"
            />
          </div>

          <div class="filters">
            <label class="filter-control">
              <span>Статус</span>
              <select v-model="statusFilter" class="filter-select">
                <option value="all">Все</option>
                <option value="published">Опубликовано</option>
                <option value="draft">Черновик</option>
              </select>
            </label>

            <label class="filter-control">
              <span>Аудитория</span>
              <select v-model="audienceFilter" class="filter-select">
                <option value="all">Все</option>
                <option value="authenticated">Только авторизованные</option>
                <option value="guests">Только гости</option>
              </select>
            </label>
          </div>

          <div class="toolbar-actions">
            <button class="btn primary" type="button" @click="openCreateMessage">
              Создать сообщение
            </button>
            <button class="btn outline" type="button" @click="refresh">
              Обновить
            </button>
          </div>
        </div>

        <transition name="fade">
          <div v-if="notification.message" :class="['notification', notification.type]">
            {{ notification.message }}
            <button class="notification-close" @click="notification.message = ''" type="button">×</button>
          </div>
        </transition>

        <div
          v-if="selectedRows.length"
          class="bulk-actions"
        >
          <span>Выбрано: {{ selectedRows.length }}</span>
          <div class="bulk-buttons">
            <button
              class="btn outline"
              type="button"
              :disabled="isBulkProcessing"
              @click="handleBulkPublish"
            >
              Опубликовать
            </button>
            <button
              class="btn outline"
              type="button"
              :disabled="isBulkProcessing"
              @click="handleBulkUnpublish"
            >
              Снять с публикации
            </button>
            <button
              class="btn destructive"
              type="button"
              :disabled="isBulkProcessing"
              @click="handleBulkDelete"
            >
              Удалить
            </button>
            <button
              class="btn text"
              type="button"
              :disabled="isBulkProcessing"
              @click="selectedRows = []"
            >
              Сбросить выбор
            </button>
          </div>
        </div>

        <div class="table-container" v-if="filteredMessages.length">
          <table class="system-messages-table">
            <thead>
              <tr>
                <th class="checkbox-cell">
                  <input
                    type="checkbox"
                    :checked="allRowsSelected"
                    :indeterminate.prop="isIndeterminate"
                    @change="toggleSelectAll"
                  />
                </th>
                <th>Заголовок</th>
                <th>Статус</th>
                <th>Тип ответа</th>
                <th>Аудитория</th>
                <th>Срок действия</th>
                <th>Обновлено</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="message in filteredMessages"
                :key="message.id"
                :class="{ selected: isSelected(message.id) }"
              >
                <td class="checkbox-cell">
                  <input
                    type="checkbox"
                    :value="message.id"
                    v-model="selectedRows"
                  />
                </td>
                <td>
                  <button class="title-button" type="button" @click="openDetails(message.id)">
                    {{ message.title }}
                  </button>
                  <p class="summary" v-if="message.summary">{{ message.summary }}</p>
                </td>
                <td>
                  <span :class="['status-badge', message.status]">
                    {{ formatStatus(message.status) }}
                  </span>
                </td>
                <td>
                  <span :class="['reply-type-badge', message.reply_type || message.replyType || 'inline']">
                    {{ formatReplyType(message.reply_type || message.replyType) }}
                  </span>
                </td>
                <td>
                  <span class="audience-label">{{ formatAudience(message.visible_for || message.visibleFor) }}</span>
                </td>
                <td>
                  <div class="period">
                    <span v-if="message.publish_at || message.publishAt">
                      c {{ formatDate(message.publish_at || message.publishAt) }}
                    </span>
                    <span v-if="message.expire_at || message.expireAt">
                      по {{ formatDate(message.expire_at || message.expireAt) }}
                    </span>
                    <span v-if="!message.publish_at && !message.publishAt && !message.expire_at && !message.expireAt">
                      Без ограничений
                    </span>
                  </div>
                </td>
                <td>
                  {{ formatDate(message.updated_at || message.updatedAt || message.created_at || message.createdAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="empty-state">
          <p v-if="isLoading">Загрузка системных сообщений...</p>
          <p v-else>Системные сообщения ещё не созданы.</p>
        </div>
      </section>
    </div>
  </BaseLayout>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import BaseLayout from '../../../components/BaseLayout.vue';
import systemMessagesService from '../../../services/systemMessagesService';
import { usePermissions } from '../../../composables/usePermissions';

const props = defineProps({
  isAuthenticated: {
    type: Boolean,
    default: false
  },
  identities: {
    type: Array,
    default: () => []
  },
  tokenBalances: {
    type: Object,
    default: () => ({})
  },
  isLoadingTokens: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['auth-action-completed']);

const router = useRouter();
const { hasPermission, PERMISSIONS } = usePermissions();

const canManageSystemMessages = computed(() => hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS));

const systemMessages = ref([]);
const isLoading = ref(false);
const isBulkProcessing = ref(false);
const searchTerm = ref('');
const statusFilter = ref('all');
const audienceFilter = ref('all');
const selectedRows = ref([]);
const notification = reactive({
  type: '',
  message: ''
});

const filteredMessages = computed(() => {
  const term = searchTerm.value.trim().toLowerCase();
  const status = statusFilter.value;
  const audience = audienceFilter.value;

  return systemMessages.value.filter((message) => {
    const matchesTerm =
      !term ||
      message.title?.toLowerCase().includes(term) ||
      message.summary?.toLowerCase().includes(term);

    const matchesStatus = status === 'all' || message.status === status;

    const messageAudience = message.visible_for || message.visibleFor || 'all';
    const matchesAudience = audience === 'all' || messageAudience === audience;

    return matchesTerm && matchesStatus && matchesAudience;
  });
});

const allRowsSelected = computed(() => {
  const totalFiltered = filteredMessages.value.length;
  return Boolean(totalFiltered) && selectedRows.value.length === totalFiltered;
});

const isIndeterminate = computed(() => {
  const totalFiltered = filteredMessages.value.length;
  return selectedRows.value.length > 0 && selectedRows.value.length < totalFiltered;
});

watch(canManageSystemMessages, (allowed) => {
  if (allowed) {
    fetchMessages();
  }
}, { immediate: true });

async function fetchMessages() {
  if (!canManageSystemMessages.value || isLoading.value) {
    return;
  }

  isLoading.value = true;
  notification.message = '';

  try {
    const response = await systemMessagesService.getSystemMessages();
    systemMessages.value = Array.isArray(response?.items) ? response.items : (Array.isArray(response) ? response : []);
  } catch (error) {
    console.error('[SystemMessagesTableView] Ошибка загрузки системных сообщений', error);
    showNotification('error', 'Не удалось загрузить системные сообщения. Попробуйте обновить страницу.');
  } finally {
    isLoading.value = false;
  }
}

function goBack() {
  router.push({ name: 'content-list' });
}

function refresh() {
  fetchMessages();
}

function openCreateMessage() {
  showNotification('info', 'Форма создания системного сообщения будет добавлена позднее.');
}

function openDetails(id) {
  showNotification('info', `Детальный просмотр сообщения ${id} находится в разработке.`);
}

function toggleSelectAll(event) {
  if (event.target.checked) {
    selectedRows.value = filteredMessages.value.map((message) => message.id);
  } else {
    selectedRows.value = [];
  }
}

function isSelected(id) {
  return selectedRows.value.includes(id);
}

async function handleBulkPublish() {
  await handleBulkAction('publish', systemMessagesService.bulkPublish, 'Сообщения опубликованы');
}

async function handleBulkUnpublish() {
  await handleBulkAction('unpublish', systemMessagesService.bulkUnpublish, 'Публикация снята');
}

async function handleBulkDelete() {
  await handleBulkAction('delete', systemMessagesService.bulkDelete, 'Сообщения удалены');
}

async function handleBulkAction(actionName, actionFn, successMessage) {
  if (!selectedRows.value.length || isBulkProcessing.value) {
    return;
  }

  isBulkProcessing.value = true;

  try {
    await actionFn(selectedRows.value);
    showNotification('success', successMessage);
    selectedRows.value = [];
    await fetchMessages();
  } catch (error) {
    console.error(`[SystemMessagesTableView] Ошибка массового действия (${actionName})`, error);
    showNotification('error', 'Не удалось выполнить операцию. Проверьте подключение и права доступа.');
  } finally {
    isBulkProcessing.value = false;
  }
}

function formatStatus(status) {
  switch (status) {
    case 'published':
      return 'Опубликовано';
    case 'draft':
      return 'Черновик';
    default:
      return 'Неизвестно';
  }
}

function formatReplyType(type = 'inline') {
  switch (type) {
    case 'assistant_reply':
      return 'Ответ ассистента';
    case 'inline':
      return 'Показать в чате';
    default:
      return 'Показать в чате';
  }
}

function formatAudience(audience = 'all') {
  switch (audience) {
    case 'authenticated':
      return 'Только авторизованные';
    case 'guests':
      return 'Только гости';
    case 'all':
    default:
      return 'Все пользователи';
  }
}

function formatDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString();
}

function showNotification(type, message) {
  notification.type = type;
  notification.message = message;
}
</script>

<style scoped>
.system-messages-page {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 16px;
  border-bottom: 2px solid #f0f0f0;
}

.header-content h1 {
  margin: 0 0 8px 0;
  color: var(--color-primary);
  font-size: 2.25rem;
}

.header-content p {
  margin: 0;
  color: var(--color-grey-dark);
  font-size: 1rem;
}

.header-actions .close-btn {
  background: none;
  border: none;
  font-size: 1.75rem;
  cursor: pointer;
  color: var(--color-grey-dark);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: background 0.2s;
}

.header-actions .close-btn:hover {
  background: #f0f0f0;
  color: var(--color-primary);
}

.permission-warning {
  padding: 24px;
  background: #fff3cd;
  border: 1px solid #ffeeba;
  border-radius: var(--radius-md);
  color: #856404;
}

.table-section {
  background: #f8f9fa;
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.search-group {
  flex: 1;
  min-width: 220px;
}

.search-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #ced4da;
  border-radius: var(--radius-sm);
  font-size: 1rem;
}

.filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-control {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
  color: var(--color-grey-dark);
}

.filter-select {
  margin-top: 4px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid #ced4da;
  background: #fff;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn {
  border: none;
  border-radius: var(--radius-sm);
  padding: 10px 18px;
  cursor: pointer;
  font-weight: 600;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn.primary {
  background: var(--color-primary);
  color: #fff;
}

.btn.primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn.outline {
  background: transparent;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
}

.btn.outline:hover:not(:disabled) {
  background: rgba(45, 114, 217, 0.08);
}

.btn.destructive {
  background: #ff4d4f;
  color: #fff;
}

.btn.destructive:hover:not(:disabled) {
  background: #d9363e;
}

.btn.text {
  background: none;
  color: var(--color-grey-dark);
}

.btn.text:hover:not(:disabled) {
  text-decoration: underline;
}

.bulk-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-md);
  padding: 12px 16px;
}

.bulk-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.table-container {
  overflow-x: auto;
  background: #fff;
  border-radius: var(--radius-md);
  border: 1px solid #e9ecef;
}

.system-messages-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 960px;
}

.system-messages-table th,
.system-messages-table td {
  padding: 14px 16px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
  vertical-align: top;
}

.system-messages-table tbody tr:hover {
  background: rgba(45, 114, 217, 0.04);
}

.system-messages-table tbody tr.selected {
  background: rgba(45, 114, 217, 0.08);
}

.checkbox-cell {
  width: 56px;
  text-align: center;
}

.title-button {
  background: none;
  border: none;
  color: var(--color-primary);
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.title-button:hover {
  text-decoration: underline;
}

.summary {
  margin-top: 6px;
  color: var(--color-grey-dark);
  font-size: 0.9rem;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.status-badge.published {
  background: rgba(76, 175, 80, 0.15);
  color: #2e7d32;
}

.status-badge.draft {
  background: rgba(255, 152, 0, 0.15);
  color: #e65100;
}

.reply-type-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  background: rgba(45, 114, 217, 0.08);
  color: var(--color-primary);
}

.reply-type-badge.assistant_reply {
  background: rgba(255, 99, 132, 0.15);
  color: #c62828;
}

.audience-label {
  font-size: 0.95rem;
  color: var(--color-grey-dark);
}

.period {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.9rem;
  color: var(--color-grey-dark);
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  background: #fff;
  border-radius: var(--radius-md);
  border: 1px dashed #ced4da;
  padding: 48px 16px;
  color: var(--color-grey-dark);
  font-size: 1.05rem;
}

.notification {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  font-size: 0.95rem;
}

.notification.success {
  background: rgba(76, 175, 80, 0.1);
  color: #2e7d32;
}

.notification.error {
  background: rgba(244, 67, 54, 0.1);
  color: #c62828;
}

.notification.info {
  background: rgba(33, 150, 243, 0.1);
  color: #1565c0;
}

.notification-close {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: inherit;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 1024px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .filters,
  .toolbar-actions {
    width: 100%;
    justify-content: space-between;
  }

  .bulk-actions {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 16px;
  }

  .header-actions {
    align-self: flex-end;
  }

  .filters {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-actions {
    flex-direction: column;
  }
}
</style>

