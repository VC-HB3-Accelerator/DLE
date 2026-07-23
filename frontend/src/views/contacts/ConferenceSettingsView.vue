<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="conference-section" v-loading="loading">
    <div class="conference-section-header">
      <h2>{{ t('contacts.conference.settings.title') }}</h2>
      <p>{{ t('contacts.conference.settings.description') }}</p>
    </div>

    <el-alert
      v-if="blockedGuest"
      type="error"
      :closable="false"
      show-icon
      class="conference-alert"
    >
      <template #title>{{ t('contacts.conference.guestNotAllowed') }}</template>
    </el-alert>

    <template v-else>
      <div class="top-actions">
        <el-button
          type="primary"
          :disabled="!connectTargetId"
          :loading="connecting"
          @click="connect(connectTargetId)"
        >
          {{ t('contacts.conference.actions.connect') }}
        </el-button>
        <el-button @click="startCreate">
          {{ t('contacts.conference.actions.create') }}
        </el-button>
        <el-button :disabled="loading" @click="load">
          {{ t('common.refresh') }}
        </el-button>
      </div>

      <section class="list-block">
        <h3>{{ t('contacts.conference.list.title') }}</h3>
        <p class="list-hint">{{ t('contacts.conference.list.hint') }}</p>

        <el-empty v-if="!upcomingList.length" :description="t('contacts.conference.list.empty')" />

        <div v-else class="session-list">
          <div
            v-for="item in upcomingList"
            :key="item.id"
            class="session-row"
            :class="{ 'is-selected': selectedId === item.id }"
            @click="selectSession(item)"
          >
            <div class="session-main">
              <div class="session-title">
                {{ item.title || t('contacts.conference.live.untitled') }}
                <span class="session-id">#{{ item.id }}</span>
              </div>
              <div class="session-meta">
                <el-tag size="small">{{ t(`contacts.conference.status.${item.status}`) }}</el-tag>
                <span v-if="item.scheduled_at">{{ formatDate(item.scheduled_at) }}</span>
                <span>{{ item.guest_language }} / {{ item.host_language }}</span>
              </div>
            </div>
            <el-button
              type="primary"
              size="small"
              :loading="connecting && connectingId === item.id"
              @click.stop="connect(item.id)"
            >
              {{ t('contacts.conference.actions.connect') }}
            </el-button>
          </div>
        </div>
      </section>

      <section v-if="showForm" ref="formBlockRef" class="form-block">
        <h3>
          {{ isCreateMode
            ? t('contacts.conference.form.createTitle')
            : t('contacts.conference.form.editTitle') }}
        </h3>

        <el-alert
          v-if="form.notify_email && warnings.missingEmail"
          type="warning"
          :closable="false"
          show-icon
          class="conference-alert"
        >
          <template #title>{{ t('contacts.conference.settings.missingEmail') }}</template>
        </el-alert>

        <el-alert
          v-if="form.notify_telegram && warnings.missingTelegram"
          type="warning"
          :closable="false"
          show-icon
          class="conference-alert"
        >
          <template #title>{{ t('contacts.conference.settings.missingTelegram') }}</template>
        </el-alert>

        <el-form class="conference-form" label-position="top" @submit.prevent>
          <el-form-item :label="t('contacts.conference.settings.titleField')">
            <el-input v-model="form.title" maxlength="200" show-word-limit />
          </el-form-item>

          <div class="settings-grid">
            <el-form-item :label="t('contacts.conference.settings.scheduledAt')">
              <el-date-picker
                v-model="form.scheduled_at"
                type="datetime"
                :placeholder="t('contacts.conference.settings.scheduledAtPlaceholder')"
                style="width: 100%"
              />
            </el-form-item>

            <el-form-item :label="t('contacts.conference.settings.status')">
              <el-tag>{{ statusLabel }}</el-tag>
            </el-form-item>
          </div>

          <div class="settings-grid">
            <el-form-item :label="t('contacts.conference.settings.guestLanguage')" required>
              <el-select v-model="form.guest_language" style="width: 100%">
                <el-option
                  v-for="lang in languageOptions"
                  :key="`guest-${lang.value}`"
                  :label="lang.label"
                  :value="lang.value"
                />
              </el-select>
            </el-form-item>

            <el-form-item :label="t('contacts.conference.settings.hostLanguage')" required>
              <el-select v-model="form.host_language" style="width: 100%">
                <el-option
                  v-for="lang in languageOptions"
                  :key="`host-${lang.value}`"
                  :label="lang.label"
                  :value="lang.value"
                />
              </el-select>
            </el-form-item>
          </div>

          <el-form-item :label="t('contacts.conference.settings.agentVoice')">
            <el-input
              v-model="form.agent_voice"
              :placeholder="t('contacts.conference.settings.agentVoicePlaceholder')"
            />
          </el-form-item>

          <el-form-item :label="t('contacts.conference.settings.presentationOutline')">
            <el-input
              v-model="form.presentation_outline"
              type="textarea"
              :rows="6"
              :placeholder="t('contacts.conference.settings.presentationOutlinePlaceholder')"
            />
          </el-form-item>

          <el-form-item :label="t('contacts.conference.settings.notes')">
            <el-input v-model="form.notes" type="textarea" :rows="3" maxlength="2000" show-word-limit />
          </el-form-item>

          <div class="notify-row">
            <el-checkbox v-model="form.notify_email">
              {{ t('contacts.conference.settings.notifyEmail') }}
            </el-checkbox>
            <el-checkbox v-model="form.notify_telegram">
              {{ t('contacts.conference.settings.notifyTelegram') }}
            </el-checkbox>
          </div>

          <section v-if="selectedId && !isCreateMode" class="participants-block">
            <h4>{{ t('contacts.conference.participants.title') }}</h4>
            <p class="list-hint">
              {{ t('contacts.conference.participants.hint', { max: maxParticipants }) }}
            </p>
            <ul v-if="participants.length" class="participants-list">
              <li v-for="p in participants" :key="p.user_id" class="participant-row">
                <div class="participant-main">
                  <strong>{{ p.name || p.email || `#${p.user_id}` }}</strong>
                  <span class="participant-meta">
                    {{ p.role }}
                    <el-tag v-if="p.is_primary" size="small" type="success">
                      {{ t('contacts.conference.participants.primary') }}
                    </el-tag>
                  </span>
                  <span v-if="p.email" class="participant-email">{{ p.email }}</span>
                </div>
                <div class="participant-actions">
                  <el-button
                    v-if="p.role === 'participant'"
                    size="small"
                    :loading="inviteUserId === p.user_id"
                    @click="inviteParticipant(p.user_id)"
                  >
                    {{ t('contacts.conference.participants.invite') }}
                  </el-button>
                  <el-button
                    v-if="p.role === 'participant' && !p.is_primary"
                    size="small"
                    type="danger"
                    plain
                    :loading="removingUserId === p.user_id"
                    @click="removeParticipant(p.user_id)"
                  >
                    {{ t('contacts.conference.participants.remove') }}
                  </el-button>
                </div>
              </li>
            </ul>
            <div class="add-participant-row">
              <el-select
                v-model="addUserId"
                filterable
                remote
                clearable
                :remote-method="searchUsers"
                :loading="searchingUsers"
                :placeholder="t('contacts.conference.participants.searchPlaceholder')"
                style="flex: 1"
              >
                <el-option
                  v-for="u in userOptions"
                  :key="u.id"
                  :label="userOptionLabel(u)"
                  :value="u.id"
                />
              </el-select>
              <el-button
                type="primary"
                :disabled="!addUserId"
                :loading="addingParticipant"
                @click="addParticipant"
              >
                {{ t('contacts.conference.participants.add') }}
              </el-button>
            </div>
          </section>

          <el-alert type="info" :closable="false" show-icon class="conference-alert">
            <template #title>{{ t('contacts.conference.settings.notifyStub') }}</template>
          </el-alert>

          <div class="form-actions">
            <el-button type="primary" :loading="saving" @click="save(false)">
              {{ t('contacts.conference.settings.save') }}
            </el-button>
            <el-button :loading="saving" :disabled="!form.scheduled_at" @click="save(true)">
              {{ t('contacts.conference.settings.saveSchedule') }}
            </el-button>
            <el-button
              :loading="sendingLink"
              :disabled="!selectedId || isCreateMode"
              @click="sendMagicLink"
            >
              {{ t('contacts.conference.actions.sendMagicLink') }}
            </el-button>
            <el-button @click="cancelForm">{{ t('common.cancel') }}</el-button>
          </div>

          <el-alert
            v-if="lastMagicLinkUrl"
            type="warning"
            :closable="true"
            show-icon
            class="conference-alert"
            @close="lastMagicLinkUrl = ''"
          >
            <template #title>{{ t('contacts.conference.actions.magicLinkManual') }}</template>
            <code class="magic-link-url">{{ lastMagicLinkUrl }}</code>
          </el-alert>
        </el-form>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import conferenceService from '@/services/conferenceService';
import contactsService from '@/services/contactsService';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();

const loading = ref(false);
const saving = ref(false);
const connecting = ref(false);
const connectingId = ref(null);
const sendingLink = ref(false);
const lastMagicLinkUrl = ref('');
const blockedGuest = ref(false);
const showForm = ref(false);
const isCreateMode = ref(false);
const selectedId = ref(null);
const sessionStatus = ref('draft');
const history = ref([]);
const participants = ref([]);
const maxParticipants = ref(3);
const addUserId = ref(null);
const userOptions = ref([]);
const searchingUsers = ref(false);
const addingParticipant = ref(false);
const removingUserId = ref(null);
const inviteUserId = ref(null);
const formBlockRef = ref(null);

const warnings = reactive({
  missingEmail: false,
  missingTelegram: false
});

const form = reactive({
  title: '',
  scheduled_at: null,
  notify_email: true,
  notify_telegram: false,
  guest_language: 'en',
  host_language: 'ru',
  agent_voice: '',
  presentation_outline: '',
  notes: ''
});

const languageOptions = [
  { value: 'ru', label: 'Русский (ru)' },
  { value: 'en', label: 'English (en)' },
  { value: 'de', label: 'Deutsch (de)' },
  { value: 'fr', label: 'Français (fr)' },
  { value: 'es', label: 'Español (es)' },
  { value: 'zh', label: '中文 (zh)' },
];

const contactId = computed(() => route.params.id);

const statusLabel = computed(() =>
  t(`contacts.conference.status.${sessionStatus.value}`, sessionStatus.value)
);

const upcomingList = computed(() =>
  (history.value || []).filter((s) => ['draft', 'scheduled', 'live'].includes(s.status))
);

const connectTargetId = computed(() => {
  if (selectedId.value) return selectedId.value;
  const live = upcomingList.value.find((s) => s.status === 'live');
  if (live) return live.id;
  const scheduled = upcomingList.value.find((s) => s.status === 'scheduled');
  if (scheduled) return scheduled.id;
  return upcomingList.value[0]?.id || null;
});

function formatDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(locale.value || 'ru', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function resetFormDefaults() {
  form.title = '';
  form.scheduled_at = null;
  form.notify_email = true;
  form.notify_telegram = false;
  form.guest_language = 'en';
  form.host_language = 'ru';
  form.agent_voice = '';
  form.presentation_outline = '';
  form.notes = '';
  sessionStatus.value = 'draft';
}

function applySession(session) {
  if (!session) {
    resetFormDefaults();
    selectedId.value = null;
    return;
  }
  selectedId.value = session.id;
  form.title = session.title || '';
  form.scheduled_at = session.scheduled_at ? new Date(session.scheduled_at) : null;
  form.notify_email = Boolean(session.notify_email);
  form.notify_telegram = Boolean(session.notify_telegram);
  form.guest_language = session.guest_language || 'en';
  form.host_language = session.host_language || 'ru';
  form.agent_voice = session.agent_voice || '';
  form.presentation_outline = session.presentation_outline || '';
  form.notes = session.notes || '';
  sessionStatus.value = session.status || 'draft';
}

function selectSession(item) {
  isCreateMode.value = false;
  showForm.value = ['draft', 'scheduled'].includes(item.status);
  applySession(item);
  loadParticipants();
}

function scrollFormIntoView() {
  requestAnimationFrame(() => {
    formBlockRef.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  });
}

/** Открывает форму новой конференции (без записи в БД — сохранение по «Сохранить»). */
function startCreate() {
  isCreateMode.value = true;
  showForm.value = true;
  selectedId.value = null;
  participants.value = [];
  resetFormDefaults();
  scrollFormIntoView();
}

function cancelForm() {
  showForm.value = false;
  isCreateMode.value = false;
  if (upcomingList.value.length) {
    applySession(upcomingList.value[0]);
    loadParticipants();
  } else {
    resetFormDefaults();
    selectedId.value = null;
    participants.value = [];
  }
}

async function loadParticipants() {
  if (!selectedId.value || isCreateMode.value) {
    participants.value = [];
    return;
  }
  try {
    const data = await conferenceService.listParticipants(selectedId.value);
    participants.value = data.participants || [];
    maxParticipants.value = data.maxParticipants || 3;
  } catch {
    participants.value = [];
  }
}

function userOptionLabel(u) {
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  const email = u.email || u.identities?.email || '';
  return [name || `#${u.id}`, email].filter(Boolean).join(' — ');
}

async function searchUsers(query) {
  const q = String(query || '').trim();
  if (q.length < 2) {
    userOptions.value = [];
    return;
  }
  searchingUsers.value = true;
  try {
    const data = await contactsService.getContacts({
      search: q,
      limit: 20,
      offset: 0
    });
    const primaryId = Number(contactId.value);
    userOptions.value = (data.contacts || []).filter((c) => {
      if (String(c.id).startsWith('guest_')) return false;
      return Number(c.id) !== primaryId;
    });
  } catch {
    userOptions.value = [];
  } finally {
    searchingUsers.value = false;
  }
}

async function addParticipant() {
  if (!selectedId.value || !addUserId.value) return;
  addingParticipant.value = true;
  try {
    const data = await conferenceService.addParticipant(selectedId.value, addUserId.value);
    participants.value = data.participants || [];
    maxParticipants.value = data.maxParticipants || 3;
    addUserId.value = null;
    ElMessage.success(t('contacts.conference.participants.added'));
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.participants.addError'));
  } finally {
    addingParticipant.value = false;
  }
}

async function removeParticipant(userId) {
  removingUserId.value = userId;
  try {
    const data = await conferenceService.removeParticipant(selectedId.value, userId);
    participants.value = data.participants || [];
    ElMessage.success(t('contacts.conference.participants.removed'));
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.participants.removeError'));
  } finally {
    removingUserId.value = null;
  }
}

async function inviteParticipant(userId) {
  inviteUserId.value = userId;
  lastMagicLinkUrl.value = '';
  try {
    const data = await conferenceService.sendMagicLink(selectedId.value, {
      send: true,
      userId,
      email: Boolean(form.notify_email),
      telegram: Boolean(form.notify_telegram)
    });
    if (data.emailed || data.telegramSent) {
      ElMessage.success(t('contacts.conference.actions.magicLinkSent'));
    } else if (data.linkUrl) {
      lastMagicLinkUrl.value = data.linkUrl;
      ElMessage.warning(t('contacts.conference.actions.magicLinkCreated'));
    }
    await loadParticipants();
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.actions.magicLinkError'));
  } finally {
    inviteUserId.value = null;
  }
}

async function applyParticipantIdsFromQuery() {
  const raw = route.query.participantIds;
  if (!raw || !selectedId.value) return;

  const ids = String(raw)
    .split(',')
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isInteger(n) && n > 0 && n !== Number(contactId.value));

  const unique = [...new Set(ids)].slice(0, 2); // primary уже есть → ещё до 2
  if (!unique.length) {
    clearParticipantQuery();
    return;
  }

  let added = 0;
  for (const uid of unique) {
    try {
      const data = await conferenceService.addParticipant(selectedId.value, uid);
      participants.value = data.participants || [];
      maxParticipants.value = data.maxParticipants || 3;
      added += 1;
    } catch (e) {
      ElMessage.warning(
        e?.response?.data?.error || t('contacts.conference.participants.addError')
      );
    }
  }
  if (added) {
    ElMessage.success(t('contacts.conference.bulk.participantsApplied', { count: added }));
  }
  clearParticipantQuery();
}

function clearParticipantQuery() {
  if (!route.query.participantIds) return;
  const nextQuery = { ...route.query };
  delete nextQuery.participantIds;
  router.replace({ query: nextQuery });
}

async function load() {
  loading.value = true;
  blockedGuest.value = false;
  try {
    const data = await conferenceService.getContactSession(contactId.value);
    history.value = data.history || [];
    warnings.missingEmail = Boolean(data.warnings?.missingEmail);
    warnings.missingTelegram = Boolean(data.warnings?.missingTelegram);

    if (data.session && ['draft', 'scheduled'].includes(data.session.status)) {
      applySession(data.session);
      showForm.value = Boolean(route.query.participantIds) || false;
      isCreateMode.value = false;
      await loadParticipants();
    } else if (upcomingList.value.length) {
      selectedId.value = upcomingList.value[0].id;
      applySession(upcomingList.value[0]);
      showForm.value = Boolean(route.query.participantIds);
      isCreateMode.value = false;
      await loadParticipants();
    } else {
      // Нет сессии — создаём черновик, чтобы можно было добавить участников из списка
      if (route.query.participantIds) {
        const created = await conferenceService.saveContactSession(contactId.value, {
          create_new: true,
          title: '',
          notify_email: true,
          notify_telegram: false,
          guest_language: 'en',
          host_language: 'ru'
        });
        history.value = (await conferenceService.getContactSession(contactId.value)).history || [];
        if (created.session) {
          applySession(created.session);
          showForm.value = true;
          isCreateMode.value = false;
          await loadParticipants();
        }
      } else {
        showForm.value = true;
        isCreateMode.value = true;
        resetFormDefaults();
        participants.value = [];
      }
    }

    await applyParticipantIdsFromQuery();
  } catch (e) {
    const code = e?.response?.data?.code;
    const msg = e?.response?.data?.error || t('contacts.conference.settings.loadError');
    if (code === 'GUEST_NOT_ALLOWED' || e?.response?.status === 403) {
      blockedGuest.value = true;
    }
    ElMessage.error(msg);
  } finally {
    loading.value = false;
  }
}

async function save(schedule) {
  saving.value = true;
  try {
    const payload = {
      title: form.title,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      notify_email: form.notify_email,
      notify_telegram: form.notify_telegram,
      guest_language: form.guest_language,
      host_language: form.host_language,
      agent_voice: form.agent_voice || null,
      presentation_outline: form.presentation_outline,
      notes: form.notes,
      schedule: Boolean(schedule),
      create_new: Boolean(isCreateMode.value),
      session_id: !isCreateMode.value && selectedId.value ? selectedId.value : undefined
    };
    const data = await conferenceService.saveContactSession(contactId.value, payload);
    ElMessage.success(
      schedule
        ? t('contacts.conference.settings.scheduledSaved')
        : t('contacts.conference.settings.saved')
    );
    if (schedule && data.notificationResult) {
      if (data.notificationResult.emailed) {
        ElMessage.success(t('contacts.conference.actions.magicLinkSent'));
      } else if (data.notificationResult.linkUrl) {
        lastMagicLinkUrl.value = data.notificationResult.linkUrl;
        ElMessage.warning(t('contacts.conference.actions.magicLinkEmailFailed'));
      }
    }
    await load();
    if (data.session) {
      selectedId.value = data.session.id;
      applySession(data.session);
      showForm.value = false;
      isCreateMode.value = false;
      await loadParticipants();
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.settings.saveError'));
  } finally {
    saving.value = false;
  }
}

async function connect(sessionId) {
  if (!sessionId) {
    ElMessage.warning(t('contacts.conference.actions.noSession'));
    return;
  }
  connecting.value = true;
  connectingId.value = sessionId;
  try {
    const data = await conferenceService.startSession(sessionId);
    const liveId = data.session?.id;
    if (!liveId) {
      throw new Error(t('contacts.conference.actions.connectError'));
    }
    ElMessage.success(t('contacts.conference.actions.connected'));
    router.push({
      name: 'contact-conference-live',
      params: { id: contactId.value, sessionId: String(liveId) }
    });
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.actions.connectError'));
  } finally {
    connecting.value = false;
    connectingId.value = null;
  }
}

async function sendMagicLink() {
  if (!selectedId.value || isCreateMode.value) {
    ElMessage.warning(t('contacts.conference.actions.saveBeforeMagic'));
    return;
  }
  sendingLink.value = true;
  lastMagicLinkUrl.value = '';
  try {
    const data = await conferenceService.sendMagicLink(selectedId.value, {
      send: true,
      email: Boolean(form.notify_email),
      telegram: Boolean(form.notify_telegram)
    });
    if (data.emailed || data.telegramSent) {
      ElMessage.success(t('contacts.conference.actions.magicLinkSent'));
    } else {
      ElMessage.warning(
        data.emailError
          ? t('contacts.conference.actions.magicLinkEmailFailed')
          : t('contacts.conference.actions.magicLinkCreated')
      );
      if (data.linkUrl) lastMagicLinkUrl.value = data.linkUrl;
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.actions.magicLinkError'));
  } finally {
    sendingLink.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.conference-section-header h2 {
  margin: 0 0 6px;
}

.conference-section-header p {
  margin: 0 0 16px;
  color: var(--color-grey, #606266);
}

.conference-alert {
  margin-bottom: 14px;
}

.top-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.list-block,
.form-block {
  margin-bottom: 24px;
}

.list-block h3,
.form-block h3 {
  margin: 0 0 6px;
  font-size: 1.1rem;
}

.list-hint {
  margin: 0 0 12px;
  color: var(--color-grey, #606266);
  font-size: 0.9rem;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--color-border, #dcdfe6);
  border-radius: var(--block-radius, 8px);
  background: var(--color-white, #fff);
  cursor: pointer;
}

.session-row.is-selected {
  border-color: var(--color-primary, #409eff);
  box-shadow: 0 0 0 1px var(--color-primary, #409eff);
}

.session-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.session-id {
  margin-left: 6px;
  font-weight: 400;
  color: var(--color-grey, #606266);
  font-size: 0.85rem;
}

.session-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  color: var(--color-grey, #606266);
  font-size: 0.85rem;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.notify-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 12px;
}

.participants-block {
  margin: 16px 0;
  padding: 12px;
  border: 1px solid var(--color-border, #dcdfe6);
  border-radius: var(--block-radius, 8px);
}

.participants-block h4 {
  margin: 0 0 6px;
}

.participants-list {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
}

.participant-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border, #ebeef5);
}

.participant-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.participant-meta,
.participant-email {
  font-size: 0.85rem;
  color: var(--color-grey, #606266);
}

.participant-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.add-participant-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.magic-link-url {
  display: block;
  margin-top: 8px;
  word-break: break-all;
  font-size: 0.85rem;
}

@media (max-width: 700px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }

  .session-row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
