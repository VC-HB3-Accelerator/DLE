<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <BaseLayout>
    <AdminPageShell
      :title="$t('chat.voiceCall.bookPageTitle')"
      :show-close="true"
      fallback="/"
      variant="panel"
    >
      <div class="panel section-card" v-loading="loading">
        <template v-if="step === 'form'">
          <p class="section-description">{{ $t('chat.voiceCall.bookFormHint') }}</p>
          <p v-if="selectedSlotLabel" class="selected-hint">
            {{ $t('chat.voiceCall.selectedSlotHint', { time: selectedSlotLabel }) }}
          </p>
          <p v-if="loadError" class="error">{{ loadError }}</p>
          <p v-if="needLogin" class="error">{{ $t('chat.voiceCall.needLogin') }}</p>

          <label class="form-label">{{ $t('contacts.conference.settings.titleField') }}</label>
          <input
            v-model="formTitle"
            type="text"
            class="form-control"
            maxlength="200"
            :placeholder="$t('chat.voiceCall.bookTitlePlaceholder')"
          />

          <label class="form-label">{{ $t('contacts.conference.settings.notes') }}</label>
          <textarea
            v-model="formNotes"
            class="form-control"
            rows="3"
            maxlength="2000"
            :placeholder="$t('chat.voiceCall.bookNotesPlaceholder')"
          />

          <div class="btn-row">
            <button type="button" class="btn btn-outline" :disabled="busy" @click="backToCalendar">
              {{ $t('common.back') }}
            </button>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="!selectedSlot || busy"
              @click="confirmBook"
            >
              {{ $t('chat.voiceCall.bookConfirm') }}
            </button>
          </div>
        </template>

        <template v-else>
          <p class="section-description">{{ $t('chat.voiceCall.bookPageHint') }}</p>
          <p v-if="listingHint" class="section-description listing-hint">{{ listingHint }}</p>
          <p v-if="loadError" class="error">{{ loadError }}</p>
          <p
            v-else-if="!slots.length && !scheduledSessions.length && !loading"
            class="section-description"
          >
            {{ $t('chat.voiceCall.noSlots') }}
          </p>

          <ConferenceAgendaCalendar
            :slots="slots"
            :sessions="scheduledSessions"
            :booking-hours="bookingHours"
            :slot-minutes="slotMinutes"
            :time-zone="timeZone"
            :selected-slot="selectedSlot"
            :can-select-slot="true"
            :show-schedule-view="canSeeScheduled"
            @range-change="onRangeChange"
            @select-slot="onSelectSlot"
            @select-session="onSelectSession"
          />

          <p v-if="selectedSlotLabel" class="section-description selected-hint">
            {{ $t('chat.voiceCall.selectedSlotHint', { time: selectedSlotLabel }) }}
          </p>
          <p v-if="needLogin" class="error">{{ $t('chat.voiceCall.needLogin') }}</p>
          <div class="btn-row">
            <button
              type="button"
              class="btn btn-primary"
              :disabled="!selectedSlot || busy"
              @click="goToForm"
            >
              {{ $t('chat.voiceCall.book') }}
            </button>
          </div>
        </template>
      </div>
    </AdminPageShell>
  </BaseLayout>
</template>

<script setup>
  import { computed, onMounted, ref, watch } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { useRoute, useRouter } from 'vue-router';
  import { ElMessage } from 'element-plus';
  import api from '@/api/axios';
  import BaseLayout from '@/components/BaseLayout.vue';
  import AdminPageShell from '@/components/admin/AdminPageShell.vue';
  import ConferenceAgendaCalendar from '@/components/chat/ConferenceAgendaCalendar.vue';
  import conferenceService from '@/services/conferenceService';
  import { usePermissions } from '@/composables/usePermissions';
  import { useAuthContext } from '@/composables/useAuth';
  import { useConferenceAgendaView } from '@/composables/useConferenceAgendaView';
  import { monthBoundsIso } from '@/utils/voiceCallCalendar';
  import {
    buildBookCallReturnUrl,
    clearVoiceCallBookingDraft,
    peekVoiceCallBookingDraft,
    setVoiceCallBookingDraft,
    setVoiceCallReturnUrl,
  } from '@/utils/voiceCallReturnUrl';

  const { t, locale } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const { isEditor } = usePermissions();
  const { isAuthenticated } = useAuthContext();
  const { viewMode } = useConferenceAgendaView();

  const slots = ref([]);
  const bookings = ref([]);
  const selectedSlot = ref('');
  const timeZone = ref('Europe/Moscow');
  const bookingHours = ref(null);
  const slotMinutes = ref(30);
  const loadError = ref('');
  const needLogin = ref(false);
  const busy = ref(false);
  const loading = ref(false);
  const calendarRange = ref(null);
  const connectingId = ref(null);
  const step = ref('calendar');
  const formTitle = ref('');
  const formNotes = ref('');

  const canSeeScheduled = computed(() => isEditor.value);

  const listingPageId = computed(() => {
    const raw = route.query.page ?? route.query.page_id;
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
  });

  const listingHint = computed(() => {
    if (!listingPageId.value) return '';
    return t('blog.listingContact.bookCallHint', { id: listingPageId.value });
  });

  const scheduledSessions = computed(() => {
    if (!canSeeScheduled.value) return [];
    const fromMs = calendarRange.value?.from
      ? new Date(calendarRange.value.from).getTime()
      : null;
    const toMs = calendarRange.value?.to ? new Date(calendarRange.value.to).getTime() : null;

    return (bookings.value || [])
      .filter((b) => b?.starts_at)
      .filter((b) => {
        const ts = new Date(b.starts_at).getTime();
        if (Number.isNaN(ts)) return false;
        if (fromMs != null && ts < fromMs) return false;
        if (toMs != null && ts >= toMs) return false;
        return true;
      })
      .map((b) => ({
        id: b.id,
        title:
          b.conference_title ||
          b.guest_name ||
          b.guest_email ||
          t('contacts.conference.calendar.busySlot'),
        scheduled_at: b.starts_at,
        status: b.conference_status || b.status || 'scheduled',
        conference_id: b.conference_id,
        guest_user_id: b.guest_user_id,
      }));
  });

  const selectedSlotLabel = computed(() => {
    if (!selectedSlot.value) return '';
    try {
      return new Intl.DateTimeFormat(locale.value || 'ru', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: timeZone.value,
      }).format(new Date(selectedSlot.value));
    } catch {
      return selectedSlot.value;
    }
  });

  function persistDraft(extra = {}) {
    setVoiceCallBookingDraft({
      scheduledAt: selectedSlot.value,
      viewMode: viewMode.value,
      pageId: listingPageId.value,
      step: step.value,
      ...extra,
    });
  }

  function syncUrl() {
    const nextQuery = {};
    if (listingPageId.value) nextQuery.page = String(listingPageId.value);
    if (selectedSlot.value) nextQuery.scheduledAt = selectedSlot.value;
    if (viewMode.value) nextQuery.view = viewMode.value;
    if (step.value === 'form') nextQuery.step = 'form';
    const cur = route.query;
    const same =
      String(cur.page || '') === String(nextQuery.page || '') &&
      String(cur.scheduledAt || '') === String(nextQuery.scheduledAt || '') &&
      String(cur.view || '') === String(nextQuery.view || '') &&
      String(cur.step || '') === String(nextQuery.step || '');
    if (!same) {
      router.replace({ query: nextQuery });
    }
  }

  function restoreFromQueryAndDraft() {
    const draft = peekVoiceCallBookingDraft() || {};
    const qSlot = String(route.query.scheduledAt || draft.scheduledAt || '').trim();
    const qView = String(route.query.view || draft.viewMode || '').trim();
    const qStep = String(route.query.step || draft.step || '').trim();

    if (qView) viewMode.value = qView;
    if (qSlot && !Number.isNaN(new Date(qSlot).getTime())) {
      selectedSlot.value = new Date(qSlot).toISOString();
    }
    if (qStep === 'form' && selectedSlot.value) {
      step.value = 'form';
    }
    persistDraft();
  }

  async function loadScheduled() {
    if (!canSeeScheduled.value) {
      bookings.value = [];
      return;
    }
    try {
      const { data } = await api.get('/ai-calls/booking/schedule');
      bookings.value = data.data?.bookings || [];
    } catch {
      bookings.value = [];
    }
  }

  async function loadSlots(range) {
    loading.value = true;
    loadError.value = '';
    try {
      const bounds =
        range?.from && range?.to
          ? { from: range.from, to: range.to }
          : calendarRange.value?.from && calendarRange.value?.to
            ? calendarRange.value
            : monthBoundsIso(new Date().getFullYear(), new Date().getMonth() + 1);

      const { data } = await api.get('/ai-calls/booking/slots', {
        params: { from: bounds.from, to: bounds.to },
      });
      const pack = data.data || {};
      slots.value = pack.slots || [];
      timeZone.value = pack.time_zone || pack.booking_hours?.timeZone || timeZone.value;
      bookingHours.value = pack.booking_hours || null;
      slotMinutes.value = Number(pack.slot_minutes) || 30;
      await loadScheduled();
    } catch (error) {
      loadError.value = error.response?.data?.error || t('chat.voiceCall.slotsError');
      slots.value = [];
      bookings.value = [];
    } finally {
      loading.value = false;
    }
  }

  function onRangeChange({ from, to, preserveSelection }) {
    calendarRange.value = { from, to };
    if (!preserveSelection && selectedSlot.value) {
      const ts = new Date(selectedSlot.value).getTime();
      const fromMs = new Date(from).getTime();
      const toMs = new Date(to).getTime();
      if (Number.isNaN(ts) || ts < fromMs || ts >= toMs) {
        selectedSlot.value = '';
        if (step.value === 'form') step.value = 'calendar';
      }
    }
    persistDraft();
    syncUrl();
    loadSlots({ from, to });
  }

  function onSelectSlot(iso) {
    selectedSlot.value = iso || '';
    needLogin.value = false;
    persistDraft();
    syncUrl();
  }

  function requireAuthForBooking() {
    if (isAuthenticated.value) return true;
    const returnUrl = buildBookCallReturnUrl({
      pageId: listingPageId.value,
      scheduledAt: selectedSlot.value,
      viewMode: viewMode.value,
      step: 'form',
    });
    persistDraft({ step: 'form' });
    setVoiceCallReturnUrl(returnUrl);
    needLogin.value = true;
    ElMessage.warning(t('chat.voiceCall.needLogin'));
    return false;
  }

  function goToForm() {
    if (!selectedSlot.value) return;
    persistDraft({ step: 'form' });
    if (!requireAuthForBooking()) {
      syncUrl();
      return;
    }
    step.value = 'form';
    needLogin.value = false;
    persistDraft({ step: 'form' });
    syncUrl();
  }

  function backToCalendar() {
    step.value = 'calendar';
    persistDraft({ step: 'calendar' });
    syncUrl();
  }

  async function onSelectSession(session) {
    if (!canSeeScheduled.value || !session) return;
    const conferenceId = session.conference_id;
    if (!conferenceId) {
      ElMessage.info(t('contacts.conference.calendar.busySlot'));
      return;
    }
    if (connectingId.value) return;
    connectingId.value = conferenceId;
    try {
      const data = await conferenceService.startSession(conferenceId);
      const liveId = data.session?.id || conferenceId;
      ElMessage.success(t('contacts.conference.actions.connected'));
      router.push({
        name: 'conference-participant-live',
        params: { sessionId: String(liveId) },
      });
    } catch (e) {
      ElMessage.error(e?.response?.data?.error || t('contacts.conference.actions.connectError'));
    } finally {
      connectingId.value = null;
    }
  }

  async function confirmBook() {
    if (!selectedSlot.value) return;
    if (!requireAuthForBooking()) return;

    busy.value = true;
    needLogin.value = false;
    loadError.value = '';
    try {
      const payload = { starts_at: selectedSlot.value };
      if (listingPageId.value) payload.page_id = listingPageId.value;
      if (formTitle.value.trim()) payload.title = formTitle.value.trim();
      if (formNotes.value.trim()) payload.notes = formNotes.value.trim();
      const { data } = await api.post('/ai-calls/booking', payload);
      clearVoiceCallBookingDraft();
      const url = data.data?.returnUrl;
      if (url) router.push(url);
    } catch (error) {
      if (error.response?.status === 401) {
        requireAuthForBooking();
        return;
      }
      loadError.value = error.response?.data?.error || t('chat.voiceCall.bookError');
    } finally {
      busy.value = false;
    }
  }

  watch(viewMode, () => {
    persistDraft();
    syncUrl();
  });

  watch(isAuthenticated, (ok) => {
    if (!ok) return;
    const draft = peekVoiceCallBookingDraft();
    if (draft?.scheduledAt && !selectedSlot.value) {
      selectedSlot.value = draft.scheduledAt;
    }
    if (draft?.viewMode) viewMode.value = draft.viewMode;
    if ((route.query.step === 'form' || draft?.step === 'form') && selectedSlot.value) {
      step.value = 'form';
      needLogin.value = false;
      persistDraft({ step: 'form' });
      syncUrl();
    }
  });

  onMounted(() => {
    restoreFromQueryAndDraft();
    loadSlots();
  });
</script>

<style scoped>
  .section-card {
    margin-top: var(--spacing-md);
  }

  .btn-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: var(--spacing-lg);
  }

  .error {
    color: var(--color-danger, #b42318);
  }

  .listing-hint {
    font-weight: 600;
  }

  .selected-hint {
    margin-top: 12px;
    font-weight: 600;
  }

  .section-description {
    margin: 0 0 12px;
    color: var(--color-grey, #666);
  }

  .form-label {
    display: block;
    margin: 12px 0 6px;
    font-size: 0.9rem;
  }

  .form-control {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    border: 1px solid var(--color-border, #d0d5dd);
    border-radius: 6px;
    font: inherit;
    background: var(--color-surface, #fff);
    color: inherit;
  }
</style>
