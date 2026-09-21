<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div v-loading="loading" class="conference-section">
    <div v-if="formOnly" class="conference-section-header">
      <h2>
        {{
          t(
            route.query.sessionId
              ? 'contacts.conference.form.editTitle'
              : 'contacts.conference.form.createTitle'
          )
        }}
      </h2>
    </div>

    <el-alert v-if="blockedGuest" type="error" :closable="false" show-icon class="conference-alert">
      <template #title>{{ t('contacts.conference.guestNotAllowed') }}</template>
    </el-alert>

    <template v-else>
      <template v-if="!formOnly">
        <section class="calendar-block">
          <p v-if="calendarSlotsHint" class="list-hint">{{ calendarSlotsHint }}</p>
          <ConferenceAgendaCalendar
            :slots="calendarSlots"
            :sessions="calendarSessions"
            :occupied="calendarBusySlots"
            :booking-hours="calendarBookingHours"
            :slot-minutes="calendarSlotMinutes"
            :time-zone="calendarTimeZone"
            :can-select-slot="canManageConference"
            :show-schedule-view="canManageConference"
            :settings-to="scheduleSettingsTo"
            @range-change="onCalendarRangeChange"
            @select-slot="selectCalendarSlot"
            @select-session="onCalendarSelectSession"
          />
        </section>
      </template>

      <section v-if="formOnly && showForm" ref="formBlockRef" class="form-block">
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

        <el-form class="conference-form conference-form--simple" label-position="top" @submit.prevent>
          <el-form-item :label="t('contacts.conference.settings.titleField')">
            <el-input
              v-model="form.title"
              maxlength="200"
              :placeholder="t('contacts.conference.settings.titlePlaceholder')"
            />
          </el-form-item>

          <el-form-item :label="t('contacts.conference.settings.notes')">
            <el-input
              v-model="form.notes"
              type="textarea"
              :rows="3"
              maxlength="2000"
              :placeholder="t('contacts.conference.settings.notesPlaceholder')"
            />
          </el-form-item>

          <el-form-item :label="t('contacts.conference.settings.scheduledAt')">
            <el-date-picker
              v-model="form.scheduled_at"
              type="datetime"
              :placeholder="t('contacts.conference.settings.scheduledAtPlaceholder')"
              :disabled-date="disablePastDate"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item :label="t('contacts.conference.settings.notifyLabel')">
            <div class="notify-row">
              <el-checkbox v-model="form.notify_email">
                {{ t('contacts.conference.settings.notifyEmail') }}
              </el-checkbox>
              <el-checkbox v-model="form.notify_telegram">
                {{ t('contacts.conference.settings.notifyTelegram') }}
              </el-checkbox>
            </div>
          </el-form-item>

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
                    <el-tag v-if="p.is_primary" size="small" type="success">
                      {{ t('contacts.conference.participants.primary') }}
                    </el-tag>
                    <span v-else>{{ p.role }}</span>
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
            <p v-else class="list-hint">{{ t('contacts.conference.participants.empty') }}</p>
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
          <p v-else-if="isCreateMode" class="list-hint">
            {{ t('contacts.conference.participants.afterSaveHint') }}
          </p>

          <div class="form-actions">
            <el-button type="primary" :loading="saving" :disabled="!form.scheduled_at" @click="save(true)">
              {{ t('contacts.conference.settings.saveSchedule') }}
            </el-button>
            <el-button :loading="saving" @click="save(false)">
              {{ t('contacts.conference.settings.save') }}
            </el-button>
            <el-button @click="cancelForm">{{ t('common.cancel') }}</el-button>
          </div>
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
  import ConferenceAgendaCalendar from '@/components/chat/ConferenceAgendaCalendar.vue';
  import { usePermissions } from '@/composables/usePermissions';
  import { useAuthContext } from '@/composables/useAuth';
  import { canAccessPath, ensureScreenAccessLoaded } from '@/composables/useScreenAccess.js';
  import { monthBoundsIso } from '@/utils/voiceCallCalendar';
  import api from '@/api/axios';

  const props = defineProps({
    formOnly: { type: Boolean, default: false },
  });

  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const { isEditor } = usePermissions();
  const { userId: sessionUserId } = useAuthContext();
  const canManageConference = computed(() => isEditor.value);
  ensureScreenAccessLoaded();
  const formOnly = computed(() => props.formOnly);

  const loading = ref(false);
  const saving = ref(false);
  const connecting = ref(false);
  const joining = ref(false);
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
  const calendarSlots = ref([]);
  const calendarBusySlots = ref([]);
  const calendarBookingHours = ref(null);
  const calendarSlotMinutes = ref(30);
  const calendarTimeZone = ref('Europe/Moscow');
  const calendarRange = ref(null);
  /** Сессии, где текущий пользователь host (в т.ч. бронь /book-call на карточке гостя). */
  const hostedForCalendar = ref([]);
  /** Записи из ai_call_bookings (календарь сотрудника). */
  const bookingsForCalendar = ref([]);

  const warnings = reactive({
    missingEmail: false,
    missingTelegram: false,
  });

  const form = reactive({
    title: '',
    scheduled_at: null,
    notify_email: true,
    notify_telegram: false,
    guest_language: 'en',
    host_language: 'ru',
    interpretation_enabled: true,
    agent_voice: '',
    presentation_outline: '',
    notes: '',
  });

  const contactId = computed(() => route.params.id);

  const isOwnContactCard = computed(
    () => sessionUserId.value != null && String(sessionUserId.value) === String(contactId.value)
  );

  const scheduleSettingsTo = computed(() => {
    if (
      !isOwnContactCard.value ||
      !isEditor.value ||
      !canAccessPath('/conferences/schedule')
    ) {
      return null;
    }
    return { name: 'hub-conference-schedule' };
  });

  const calendarPeerIds = computed(() => {
    const primary = Number(contactId.value);
    const ids = [];
    if (Number.isInteger(primary) && primary > 0) ids.push(primary);
    const raw = route.query.participantIds;
    if (raw) {
      for (const part of String(raw).split(',')) {
        const n = Number(String(part).trim());
        if (Number.isInteger(n) && n > 0 && !ids.includes(n)) ids.push(n);
      }
    }
    return ids.slice(0, 3);
  });

  const isMultiPeerCalendar = computed(() => calendarPeerIds.value.length > 1);

  const calendarSlotsHint = computed(() => {
    if (isMultiPeerCalendar.value) {
      return t('contacts.conference.calendar.multiPeerHint', {
        count: calendarPeerIds.value.length,
      });
    }
    return '';
  });

  /** Все мероприятия для сетки: история контакта + host-сессии + брони сотрудника. */
  const calendarSessions = computed(() => {
    const byId = new Map();
    const add = (session) => {
      if (!session?.scheduled_at) return;
      const key = String(session.id);
      if (!byId.has(key)) byId.set(key, session);
    };
    for (const session of history.value || []) {
      if (session?.status === 'cancelled') continue;
      add(session);
    }
    for (const session of hostedForCalendar.value) add(session);
    for (const booking of bookingsForCalendar.value) {
      if (!booking?.starts_at) continue;
      const id = booking.conference_id || `booking-${booking.id}`;
      add({
        id,
        title:
          booking.conference_title ||
          booking.guest_name ||
          booking.guest_email ||
          t('contacts.conference.calendar.busySlot'),
        scheduled_at: booking.starts_at,
        status: booking.conference_status || booking.status || 'scheduled',
        conference_id: booking.conference_id,
      });
    }
    return [...byId.values()];
  });

  async function loadHostedForCalendar() {
    if (!canManageConference.value || !isOwnContactCard.value) {
      hostedForCalendar.value = [];
      return;
    }
    try {
      const data = await conferenceService.listHostedSessions();
      hostedForCalendar.value = (data.sessions || []).filter((s) => s.scheduled_at);
    } catch {
      hostedForCalendar.value = [];
    }
  }

  async function loadBookingsForCalendar() {
    if (!canManageConference.value || !isOwnContactCard.value) {
      bookingsForCalendar.value = [];
      return;
    }
    try {
      const { data } = await api.get('/ai-calls/booking/schedule');
      bookingsForCalendar.value = data.data?.bookings || [];
    } catch {
      bookingsForCalendar.value = [];
    }
  }

  async function loadCalendar(range) {
    try {
      const bounds =
        range?.from && range?.to
          ? { from: range.from, to: range.to }
          : calendarRange.value?.from && calendarRange.value?.to
            ? calendarRange.value
            : monthBoundsIso(new Date().getFullYear(), new Date().getMonth() + 1);

      // Обновить личные сессии контакта (host / контакт / участник) для сетки
      try {
        const pack = await conferenceService.getContactSession(contactId.value, {
          historyLimit: 100,
        });
        history.value = pack.history || [];
      } catch {
        /* оставляем текущую history */
      }

      // Общий календарь слотов: 1+ выбранных (не только «своя карточка без peers»)
      const useSharedPeerSlots =
        isMultiPeerCalendar.value || !isOwnContactCard.value;

      if (!useSharedPeerSlots) {
        // Свой календарь сотрудника: окна записи + брони
        await Promise.all([loadHostedForCalendar(), loadBookingsForCalendar()]);
        const { data } = await api.get('/ai-calls/booking/slots', {
          params: { from: bounds.from, to: bounds.to },
        });
        const pack = data.data || {};
        calendarSlots.value = pack.slots || [];
        calendarBusySlots.value = (bookingsForCalendar.value || [])
          .filter((b) => b?.starts_at)
          .map((b) => ({
            starts_at: b.starts_at,
            conference_id: b.conference_id,
          }));
        calendarBookingHours.value = pack.booking_hours || null;
        calendarSlotMinutes.value = Number(pack.slot_minutes) || 30;
        calendarTimeZone.value =
          pack.time_zone || pack.booking_hours?.timeZone || calendarTimeZone.value;
        return;
      }

      if (isOwnContactCard.value) {
        await Promise.all([loadHostedForCalendar(), loadBookingsForCalendar()]);
      } else {
        hostedForCalendar.value = [];
        bookingsForCalendar.value = [];
      }

      const data = await conferenceService.getCallCalendarSlots({
        ids: calendarPeerIds.value,
        from: bounds.from,
        to: bounds.to,
      });
      calendarSlots.value = data.slots || [];
      calendarBusySlots.value = [
        ...(data.occupied || []),
        ...(isOwnContactCard.value
          ? (bookingsForCalendar.value || [])
              .filter((b) => b?.starts_at)
              .map((b) => ({
                starts_at: b.starts_at,
                conference_id: b.conference_id,
              }))
          : []),
      ];
      calendarBookingHours.value = data.booking_hours || null;
      calendarSlotMinutes.value = Number(data.slot_minutes) || 30;
      calendarTimeZone.value =
        data.time_zone || data.booking_hours?.timeZone || calendarTimeZone.value;
    } catch {
      calendarSlots.value = [];
      calendarBusySlots.value = [];
      calendarBookingHours.value = null;
    }
  }

  function onCalendarRangeChange({ from, to }) {
    calendarRange.value = { from, to };
    loadCalendar({ from, to });
  }

  function disablePastDate(date) {
    if (!date) return false;
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return start.getTime() < today.getTime();
  }

  function isPastSchedule(value) {
    if (!value) return false;
    const ts = new Date(value).getTime();
    return !Number.isNaN(ts) && ts <= Date.now();
  }

  function selectCalendarSlot(iso) {
    if (!iso || !canManageConference.value) return;
    if (isPastSchedule(iso)) {
      ElMessage.warning(t('contacts.conference.settings.cannotCreateInPast'));
      return;
    }
    const query = { scheduledAt: iso };
    if (route.query.participantIds) {
      query.participantIds = route.query.participantIds;
    }
    router.push({
      name: 'contact-conference-create',
      params: { id: contactId.value },
      query,
    });
  }

  function onCalendarSelectSession(item) {
    if (!item) return;
    const sessionId = item.conference_id || item.id;
    if (String(sessionId).startsWith('booking-')) {
      ElMessage.info(t('contacts.conference.calendar.busySlot'));
      return;
    }
    const normalized = { ...item, id: sessionId };
    if (canManageConference.value && ['draft', 'scheduled'].includes(normalized.status)) {
      selectSession(normalized);
      return;
    }
    if (canManageConference.value) {
      connect(sessionId);
      return;
    }
    if (isOwnContactCard.value) {
      joinAsParticipant(sessionId);
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
    form.interpretation_enabled = session.interpretation_enabled !== false;
    form.agent_voice = session.agent_voice || '';
    form.presentation_outline = session.presentation_outline || '';
    form.notes = session.notes || '';
    sessionStatus.value = session.status || 'draft';
  }

  function selectSession(item) {
    if (!canManageConference.value || !['draft', 'scheduled'].includes(item.status)) return;
    router.push({
      name: 'contact-conference-create',
      params: { id: contactId.value },
      query: { sessionId: String(item.id) },
    });
  }

  function scrollFormIntoView() {
    requestAnimationFrame(() => {
      formBlockRef.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
  }

  function initializeCreateForm() {
    isCreateMode.value = true;
    showForm.value = true;
    selectedId.value = null;
    participants.value = [];
    resetFormDefaults();
    scrollFormIntoView();
  }

  function cancelForm() {
    router.push({ name: 'contact-conference', params: { id: contactId.value } });
  }

  async function loadParticipants() {
    if (!canManageConference.value || !selectedId.value || isCreateMode.value) {
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
        offset: 0,
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
      ElMessage.error(
        e?.response?.data?.error || t('contacts.conference.participants.removeError')
      );
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
        telegram: Boolean(form.notify_telegram),
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
    if (!canManageConference.value) {
      clearParticipantQuery();
      return;
    }
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
      const data = await conferenceService.getContactSession(contactId.value, {
        historyLimit: 100,
      });
      history.value = data.history || [];
      warnings.missingEmail = Boolean(data.warnings?.missingEmail);
      warnings.missingTelegram = Boolean(data.warnings?.missingTelegram);

      if (formOnly.value) {
        const editId = Number(route.query.sessionId);
        const editSession = Number.isInteger(editId)
          ? history.value.find((session) => Number(session.id) === editId)
          : null;

        if (editSession) {
          applySession(editSession);
          showForm.value = true;
          isCreateMode.value = false;
          await loadParticipants();
        } else {
          // Слот с календаря (+ опционально participantIds) — форма, без мгновенного create
          initializeCreateForm();
          const scheduledAt = String(route.query.scheduledAt || '');
          if (scheduledAt && !Number.isNaN(new Date(scheduledAt).getTime())) {
            form.scheduled_at = new Date(scheduledAt);
          }
        }
      } else {
        showForm.value = false;
        isCreateMode.value = false;
        selectedId.value = null;
        await loadCalendar();
      }
    } catch (e) {
      const code = e?.response?.data?.code;
      const msg = e?.response?.data?.error || t('contacts.conference.settings.loadError');
      if (code === 'GUEST_NOT_ALLOWED') {
        blockedGuest.value = true;
      }
      ElMessage.error(msg);
    } finally {
      loading.value = false;
    }
  }

  async function save(schedule) {
    if (isPastSchedule(form.scheduled_at) && (schedule || isCreateMode.value)) {
      ElMessage.warning(t('contacts.conference.settings.cannotCreateInPast'));
      return;
    }
    saving.value = true;
    try {
      const payload = {
        title: form.title,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        notify_email: form.notify_email,
        notify_telegram: form.notify_telegram,
        guest_language: form.guest_language,
        host_language: form.host_language,
        interpretation_enabled: form.interpretation_enabled,
        agent_voice: form.agent_voice || null,
        presentation_outline: form.presentation_outline,
        notes: form.notes,
        schedule: Boolean(schedule),
        create_new: Boolean(isCreateMode.value),
        session_id: !isCreateMode.value && selectedId.value ? selectedId.value : undefined,
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
      if (data.session) selectedId.value = data.session.id;
      if (route.query.participantIds && selectedId.value) {
        isCreateMode.value = false;
        await applyParticipantIdsFromQuery();
      }
      await router.push({ name: 'contact-conference', params: { id: contactId.value } });
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
        params: { id: contactId.value, sessionId: String(liveId) },
      });
    } catch (e) {
      ElMessage.error(e?.response?.data?.error || t('contacts.conference.actions.connectError'));
    } finally {
      connecting.value = false;
      connectingId.value = null;
    }
  }

  async function joinAsParticipant(sessionId) {
    if (!sessionId) {
      ElMessage.warning(t('contacts.conference.actions.noSession'));
      return;
    }
    joining.value = true;
    connectingId.value = sessionId;
    try {
      const data = await conferenceService.joinSession(sessionId);
      const liveId = data.session?.id || sessionId;
      ElMessage.success(t('contacts.conference.actions.connected'));
      router.push({
        name: 'conference-participant-live',
        params: { sessionId: String(liveId) },
      });
    } catch (e) {
      ElMessage.error(e?.response?.data?.error || t('contacts.conference.participant.startError'));
    } finally {
      joining.value = false;
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
        telegram: Boolean(form.notify_telegram),
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
    margin: 0 0 16px;
  }

  .conference-alert {
    margin-bottom: 14px;
  }

  .form-block {
    margin-bottom: 24px;
    max-width: 560px;
  }

  .calendar-block {
    margin-bottom: 24px;
  }

  .conference-form--simple :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  .calendar-block h3,
  .form-block h3 {
    margin: 0 0 6px;
    font-size: 1.1rem;
  }

  .list-hint {
    margin: 0 0 12px;
    color: var(--color-grey);
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
    border: 1px solid var(--color-border);
    border-radius: var(--block-radius);
    background: var(--color-white);
    cursor: pointer;
  }

  .session-row.is-selected {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary);
  }

  .session-title {
    font-weight: 600;
    margin-bottom: 4px;
  }

  .session-id {
    margin-left: 6px;
    font-weight: 400;
    color: var(--color-grey);
    font-size: 0.85rem;
  }

  .session-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    color: var(--color-grey);
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
    margin: 8px 0 20px;
    padding: 14px 16px;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 10px;
    background: var(--color-neutral-bg, #f9fafb);
  }

  .participants-block h4 {
    margin: 0 0 6px;
    font-size: 1rem;
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
    border-bottom: 1px solid var(--color-border);
  }

  .participant-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .participant-meta,
  .participant-email {
    font-size: 0.85rem;
    color: var(--color-grey);
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

  @media (max-width: 768px) {
    .settings-grid {
      grid-template-columns: 1fr;
    }

    .session-row {
      flex-direction: column;
      align-items: stretch;
    }
  }

  /* TZ package C: bp normalized */

  /* TZ package C stack */
  @media (max-width: 768px) {
    .form-row,
    .live-grid,
    .video-stage-split,
    [class*='-grid']:not([class*='fc-']),
    [class*='Grid']:not([class*='fc-']) {
      grid-template-columns: 1fr !important;
    }
    .row,
    .actions,
    .toolbar,
    .filters,
    .form-actions {
      flex-wrap: wrap;
    }
  }
</style>
