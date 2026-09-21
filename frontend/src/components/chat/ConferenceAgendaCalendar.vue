<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="agenda-cal">
    <div v-if="!hideToolbar" class="agenda-cal__toolbar">
      <label class="agenda-cal__view-label" :for="viewSelectId">
        {{ t('contacts.conference.calendar.viewLabel') }}
      </label>
      <select
        :id="viewSelectId"
        v-model="currentView"
        class="agenda-cal__view-select"
        @change="onViewSelect"
      >
        <option v-for="opt in viewOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>
    <p v-if="hourBandMode" class="agenda-cal__hint">
      {{ t('contacts.conference.calendar.hourBandHint', { minutes: slotStep }) }}
    </p>
    <FullCalendar ref="calendarRef" :options="calendarOptions" />

    <el-dialog
      v-model="slotPickerOpen"
      :title="slotPickerTitle"
      width="380px"
      append-to-body
      class="agenda-cal-slot-dialog"
      @closed="onSlotPickerClosed"
    >
      <p class="agenda-cal__picker-hint">
        {{ t('contacts.conference.calendar.hourPickHint', { minutes: slotStep }) }}
      </p>
      <div class="agenda-cal__slot-list">
        <button
          v-for="iso in slotPickerOptions"
          :key="iso"
          type="button"
          class="agenda-cal__slot-btn"
          :class="{ 'is-selected': selectedIso === iso }"
          @click="pickSlot(iso)"
        >
          {{ formatSlotTime(iso) }}
        </button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
  import { computed, reactive, ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
  import { useI18n } from 'vue-i18n';
  import FullCalendar from '@fullcalendar/vue3';
  import dayGridPlugin from '@fullcalendar/daygrid';
  import timeGridPlugin from '@fullcalendar/timegrid';
  import listPlugin from '@fullcalendar/list';
  import multiMonthPlugin from '@fullcalendar/multimonth';
  import interactionPlugin from '@fullcalendar/interaction';
  import ruLocale from '@fullcalendar/core/locales/ru';
  import enGbLocale from '@fullcalendar/core/locales/en-gb';
  import { useConferenceAgendaView } from '@/composables/useConferenceAgendaView';

  /** При шаге ≤ этого — в дне/неделе рисуем часовые зоны + список слотов. */
  const HOUR_BAND_MAX_MINUTES = 15;

  const props = defineProps({
    slots: { type: Array, default: () => [] },
    sessions: { type: Array, default: () => [] },
    occupied: { type: Array, default: () => [] },
    bookingHours: { type: Object, default: null },
    slotMinutes: { type: Number, default: 30 },
    timeZone: { type: String, default: 'Europe/Moscow' },
    canSelectSlot: { type: Boolean, default: true },
    selectedSlot: { type: String, default: '' },
    /** Режим «Расписание» — только владелец календаря (редактор). */
    showScheduleView: { type: Boolean, default: false },
    /** Селект режима вынесен в строку навигации (Звонки / Планировщик). */
    hideToolbar: { type: Boolean, default: false },
  });

  const emit = defineEmits(['range-change', 'select-slot', 'select-session']);

  const { t, locale } = useI18n();
  const { viewMode: sharedViewMode, showScheduleView: sharedShowSchedule } =
    useConferenceAgendaView();
  const calendarRef = ref(null);
  const viewSelectId = `agenda-view-${Math.random().toString(36).slice(2, 9)}`;
  const DEFAULT_VIEW = 'dayGridMonth';
  const currentView = ref(sharedViewMode.value || DEFAULT_VIEW);
  const lastRangeKey = ref('');
  /** Не сбрасывать выбор слота при программном переходе месяц → день. */
  const keepSelectionOnce = ref(false);

  const slotPickerOpen = ref(false);
  const slotPickerOptions = ref([]);
  const slotPickerHourStart = ref(null);

  const ALLOWED_BASE = [
    'timeGridDay',
    'timeGridWeek',
    'timeGridSevenDay',
    'dayGridMonth',
    'multiMonthYear',
  ];

  const slotStep = computed(() => Math.max(10, Number(props.slotMinutes) || 30));

  const selectedIso = computed(() =>
    props.selectedSlot ? new Date(props.selectedSlot).toISOString() : ''
  );

  const hourBandMode = computed(() => {
    if (slotStep.value > HOUR_BAND_MAX_MINUTES) return false;
    if (isMonthLikeView(currentView.value)) return false;
    if (String(currentView.value).startsWith('list')) return false;
    return true;
  });

  const viewOptions = computed(() => {
    const opts = [
      { value: 'timeGridDay', label: t('contacts.conference.calendar.views.day') },
      { value: 'timeGridWeek', label: t('contacts.conference.calendar.views.week') },
      { value: 'timeGridSevenDay', label: t('contacts.conference.calendar.views.sevenDay') },
      { value: 'dayGridMonth', label: t('contacts.conference.calendar.views.month') },
      { value: 'multiMonthYear', label: t('contacts.conference.calendar.views.year') },
    ];
    if (props.showScheduleView) {
      opts.push({
        value: 'listWeek',
        label: t('contacts.conference.calendar.views.schedule'),
      });
    }
    return opts;
  });

  const allowedViews = computed(() => {
    const set = new Set(ALLOWED_BASE);
    if (props.showScheduleView) set.add('listWeek');
    return set;
  });

  const slotPickerTitle = computed(() => {
    if (!slotPickerHourStart.value) {
      return t('contacts.conference.calendar.hourPickTitleFallback');
    }
    const label = new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(slotPickerHourStart.value);
    return t('contacts.conference.calendar.hourPickTitle', { time: label });
  });

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function addMinutesIso(iso, minutes) {
    const start = new Date(iso).getTime();
    if (Number.isNaN(start)) return iso;
    return new Date(start + minutes * 60 * 1000).toISOString();
  }

  function slotEnd(iso) {
    return addMinutesIso(iso, slotStep.value);
  }

  function isMonthLikeView(type) {
    return type === 'dayGridMonth' || String(type || '').startsWith('multiMonth');
  }

  function isTimeGridView(type) {
    return String(type || '').startsWith('timeGrid');
  }

  function normalizeViewType(type) {
    if (allowedViews.value.has(type)) return type;
    if (type === 'dayGridDay' || type === 'listDay') return 'timeGridDay';
    if (type === 'listWeek' && !props.showScheduleView) return DEFAULT_VIEW;
    return DEFAULT_VIEW;
  }

  function hourKeyLocal(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}`;
  }

  function hourBoundsLocal(date) {
    const d = date instanceof Date ? new Date(date) : new Date(date);
    const start = new Date(d);
    start.setMinutes(0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    return { start, end };
  }

  function formatSlotTime(iso) {
    try {
      return new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function freeSlotIsos() {
    return (props.slots || [])
      .map((s) => s?.starts_at || s)
      .filter(Boolean)
      .map((iso) => new Date(iso).toISOString())
      .filter((iso) => !Number.isNaN(new Date(iso).getTime()))
      .sort();
  }

  function freeSlotsInHour(dateLike) {
    const { start, end } = hourBoundsLocal(dateLike);
    const from = start.getTime();
    const to = end.getTime();
    return freeSlotIsos().filter((iso) => {
      const ts = new Date(iso).getTime();
      return ts >= from && ts < to;
    });
  }

  function openHourPicker(dateLike, options) {
    const list = options?.length ? options : freeSlotsInHour(dateLike);
    if (!list.length) return;
    const { start } = hourBoundsLocal(dateLike);
    slotPickerHourStart.value = start;
    slotPickerOptions.value = list;
    slotPickerOpen.value = true;
  }

  function pickSlot(iso) {
    slotPickerOpen.value = false;
    if (iso) emit('select-slot', iso);
  }

  function onSlotPickerClosed() {
    slotPickerOptions.value = [];
    slotPickerHourStart.value = null;
  }

  const businessHoursOption = computed(() => {
    const hours = props.bookingHours;
    if (!hours || typeof hours !== 'object') return true;
    const startHour = Number(hours.startHour ?? hours.startUtc ?? 9);
    const endHour = Number(hours.endHour ?? hours.endUtc ?? 18);
    const weekdays = Array.isArray(hours.weekdays) ? hours.weekdays : [1, 2, 3, 4, 5];
    return {
      daysOfWeek: weekdays,
      startTime: `${pad(startHour)}:00`,
      endTime: `${pad(endHour)}:00`,
    };
  });

  const sessionIds = computed(() => {
    const set = new Set();
    for (const s of props.sessions || []) {
      if (s?.id != null) set.add(String(s.id));
    }
    return set;
  });

  const calendarEvents = computed(() => {
    const events = [];
    const takenStarts = new Set();
    const monthLike = isMonthLikeView(currentView.value);
    const bands = hourBandMode.value;

    for (const session of props.sessions || []) {
      if (!session?.scheduled_at) continue;
      const start = new Date(session.scheduled_at).toISOString();
      takenStarts.add(start);
      events.push({
        id: `session-${session.id}`,
        title: session.title || t('contacts.conference.live.untitled'),
        start,
        end: slotEnd(start),
        display: 'auto',
        classNames: ['agenda-cal__event--session'],
        backgroundColor: '#c0392b',
        borderColor: '#a93226',
        textColor: '#fff',
        extendedProps: { kind: 'session', session },
      });
    }

    for (const item of props.occupied || []) {
      const startIso = item?.starts_at || item;
      if (!startIso) continue;
      const start = new Date(startIso).toISOString();
      if (takenStarts.has(start)) continue;
      const confId = item?.conference_id;
      if (confId != null && sessionIds.value.has(String(confId))) continue;
      takenStarts.add(start);
      events.push({
        id: `busy-${start}`,
        title: t('contacts.conference.calendar.busySlot'),
        start,
        end: slotEnd(start),
        display: 'auto',
        classNames: ['agenda-cal__event--busy'],
        backgroundColor: '#e74c3c',
        borderColor: '#c0392b',
        textColor: '#fff',
        extendedProps: { kind: 'busy' },
      });
    }

    const selected = selectedIso.value;
    if (selected && !takenStarts.has(selected) && !monthLike) {
      // Выбранный слот — заметный блок даже при 10 мин
      events.push({
        id: `selected-${selected}`,
        title: t('contacts.conference.calendar.selectedSlot'),
        start: selected,
        end: slotEnd(selected),
        display: 'auto',
        classNames: ['agenda-cal__event--free', 'agenda-cal__event--selected'],
        backgroundColor: 'rgba(39, 174, 96, 0.7)',
        borderColor: '#1e8449',
        textColor: '#fff',
        extendedProps: { kind: 'free', startsAt: selected },
      });
      takenStarts.add(selected);
    }

    if (bands) {
      const byHour = new Map();
      for (const start of freeSlotIsos()) {
        if (takenStarts.has(start)) continue;
        const key = hourKeyLocal(start);
        if (!byHour.has(key)) {
          const { start: hourStart, end: hourEnd } = hourBoundsLocal(start);
          byHour.set(key, { hourStart, hourEnd, slots: [] });
        }
        byHour.get(key).slots.push(start);
      }
      for (const [key, band] of byHour) {
        const hasSelected = Boolean(selected && band.slots.includes(selected));
        events.push({
          id: `hour-${key}`,
          title: t('contacts.conference.calendar.hourBandCount', { count: band.slots.length }),
          start: band.hourStart.toISOString(),
          end: band.hourEnd.toISOString(),
          display: 'background',
          classNames: hasSelected
            ? ['agenda-cal__event--hour', 'agenda-cal__event--hour-selected']
            : ['agenda-cal__event--hour'],
          backgroundColor: hasSelected ? 'rgba(39, 174, 96, 0.45)' : 'rgba(46, 204, 113, 0.28)',
          extendedProps: {
            kind: 'hour',
            slots: band.slots,
            hourStart: band.hourStart.toISOString(),
          },
        });
      }
      return events;
    }

    for (const start of freeSlotIsos()) {
      if (takenStarts.has(start)) continue;
      const isSelected = Boolean(selected && selected === start);
      const asBackground = monthLike || !isSelected;
      events.push({
        id: `free-${start}`,
        title: isSelected && !monthLike ? t('contacts.conference.calendar.selectedSlot') : '',
        start,
        end: slotEnd(start),
        display: asBackground ? 'background' : 'auto',
        classNames: isSelected
          ? ['agenda-cal__event--free', 'agenda-cal__event--selected']
          : ['agenda-cal__event--free'],
        backgroundColor: isSelected ? 'rgba(39, 174, 96, 0.55)' : 'rgba(46, 204, 113, 0.35)',
        borderColor: isSelected ? '#1e8449' : undefined,
        textColor: '#fff',
        extendedProps: { kind: 'free', startsAt: start },
      });
    }

    return events;
  });

  function getApi() {
    return calendarRef.value?.getApi?.() || null;
  }

  function applyGridSizing() {
    const bands = hourBandMode.value;
    calendarOptions.slotDuration = bands ? '01:00:00' : '00:30:00';
    calendarOptions.slotLabelInterval = '01:00:00';
    calendarOptions.eventMinHeight = 28;
    calendarOptions.slotMinHeight = bands ? 48 : 28;
  }

  function onViewSelect() {
    const api = getApi();
    if (!api) return;
    const view = normalizeViewType(currentView.value);
    currentView.value = view;
    if (api.view?.type !== view) {
      api.changeView(view);
    }
  }

  function openDayView(dateInput) {
    keepSelectionOnce.value = true;
    currentView.value = 'timeGridDay';
    const api = getApi();
    if (!api) return;
    api.changeView('timeGridDay', dateInput);
  }

  function handleDatesSet(info) {
    const rawType = info.view?.type || currentView.value;
    const nextView = normalizeViewType(rawType);

    if (rawType !== nextView) {
      nextTick(() => {
        const api = getApi();
        if (api && api.view?.type !== nextView) {
          api.changeView(nextView, info.start);
        }
      });
      currentView.value = nextView;
      return;
    }

    if (nextView !== currentView.value) {
      currentView.value = nextView;
    }

    applyGridSizing();

    const from = info.start?.toISOString?.() || '';
    const to = info.end?.toISOString?.() || '';
    const key = `${from}|${to}`;
    if (!from || !to || key === lastRangeKey.value) return;
    lastRangeKey.value = key;
    const preserveSelection = keepSelectionOnce.value;
    keepSelectionOnce.value = false;
    emit('range-change', { from, to, preserveSelection });
  }

  function handleEventClick(info) {
    const kind = info.event?.extendedProps?.kind;
    if (kind === 'hour') {
      if (!props.canSelectSlot) return;
      openHourPicker(
        info.event.extendedProps.hourStart || info.event.start,
        info.event.extendedProps.slots || []
      );
      return;
    }
    if (kind === 'free') {
      if (!props.canSelectSlot) return;
      const viewType = info.view?.type || currentView.value;
      if (isMonthLikeView(viewType)) {
        openDayView(info.event.start || info.event.extendedProps.startsAt);
        return;
      }
      if (hourBandMode.value) {
        openHourPicker(info.event.extendedProps.startsAt || info.event.start);
        return;
      }
      const startsAt = info.event.extendedProps.startsAt || info.event.start?.toISOString?.();
      if (startsAt) emit('select-slot', startsAt);
      return;
    }
    if (kind === 'session') {
      const session = info.event.extendedProps.session;
      if (session) emit('select-session', session);
    }
  }

  function handleDateClick(info) {
    if (!info.date) return;
    const viewType = info.view?.type || currentView.value;

    if (isMonthLikeView(viewType)) {
      openDayView(info.date);
      return;
    }

    if (!props.canSelectSlot) return;

    if (hourBandMode.value && isTimeGridView(viewType)) {
      openHourPicker(info.date);
      return;
    }

    const dayStart = info.date.valueOf();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const free = freeSlotIsos()
      .map((iso) => new Date(iso).getTime())
      .filter((ts) => ts >= dayStart && ts < dayEnd)
      .sort((a, b) => a - b);
    if (!free.length) return;
    emit('select-slot', new Date(free[0]).toISOString());
  }

  const calendarOptions = reactive({
    plugins: [dayGridPlugin, timeGridPlugin, listPlugin, multiMonthPlugin, interactionPlugin],
    initialView: DEFAULT_VIEW,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: '',
    },
    height: 620,
    expandRows: true,
    nowIndicator: true,
    allDaySlot: false,
    slotMinTime: '06:00:00',
    slotMaxTime: '22:00:00',
    slotDuration: '00:30:00',
    slotLabelInterval: '01:00:00',
    slotMinHeight: 28,
    eventMinHeight: 28,
    firstDay: 1,
    weekends: true,
    navLinks: false,
    editable: false,
    selectable: false,
    dayMaxEvents: 3,
    eventDisplay: 'auto',
    locales: [ruLocale, enGbLocale],
    locale: locale.value === 'en' ? 'en-gb' : 'ru',
    timeZone: 'local',
    businessHours: businessHoursOption.value,
    events: calendarEvents.value,
    views: {
      timeGridSevenDay: {
        type: 'timeGrid',
        duration: { days: 7 },
        buttonText: '7',
      },
      listWeek: {
        type: 'list',
        duration: { days: 7 },
        noEventsContent: () => t('contacts.conference.calendar.noEvents'),
      },
    },
    datesSet: handleDatesSet,
    eventClick: handleEventClick,
    dateClick: handleDateClick,
  });

  watch(
    () => locale.value,
    (val) => {
      calendarOptions.locale = val === 'en' ? 'en-gb' : 'ru';
    }
  );

  watch(
    () => props.timeZone,
    () => {
      calendarOptions.timeZone = 'local';
    }
  );

  watch(
    businessHoursOption,
    (val) => {
      calendarOptions.businessHours = val;
    },
    { deep: true }
  );

  watch(
    calendarEvents,
    (val) => {
      calendarOptions.events = val;
    },
    { deep: true }
  );

  watch(hourBandMode, () => {
    applyGridSizing();
    nextTick(() => getApi()?.updateSize?.());
  });

  watch(
    () => props.showScheduleView,
    (allowed) => {
      sharedShowSchedule.value = Boolean(allowed);
      if (!allowed && currentView.value === 'listWeek') {
        currentView.value = DEFAULT_VIEW;
        nextTick(() => getApi()?.changeView(DEFAULT_VIEW));
      }
    },
    { immediate: true }
  );

  watch(currentView, (val) => {
    if (sharedViewMode.value !== val) {
      sharedViewMode.value = val;
    }
  });

  watch(sharedViewMode, (val) => {
    const next = normalizeViewType(val);
    if (currentView.value === next) return;
    currentView.value = next;
    nextTick(() => {
      const api = getApi();
      if (api && api.view?.type !== next) api.changeView(next);
    });
  });

  onMounted(() => {
    sharedShowSchedule.value = Boolean(props.showScheduleView);
    // Календарь контакта (hideToolbar): всегда стартуем с месяца, чтобы селект
    // не показывал «День» при сетке месяца после клика по ячейке.
    const next = props.hideToolbar
      ? DEFAULT_VIEW
      : normalizeViewType(sharedViewMode.value || currentView.value);
    currentView.value = next;
    sharedViewMode.value = next;
    applyGridSizing();
    nextTick(() => {
      const api = getApi();
      if (api && api.view?.type !== next) {
        api.changeView(next);
      }
    });
  });

  onUnmounted(() => {
    if (props.hideToolbar) {
      sharedShowSchedule.value = false;
    }
  });
</script>

<style scoped>
  .agenda-cal {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 520px;
  }

  .agenda-cal__toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .agenda-cal__view-label {
    font-size: 0.9rem;
    color: var(--color-grey, #666);
  }

  .agenda-cal__view-select {
    min-width: 160px;
    padding: 6px 10px;
    border: 1px solid var(--color-border, #d0d5dd);
    border-radius: 6px;
    background: var(--color-surface, #fff);
    color: inherit;
    font: inherit;
  }

  .agenda-cal__hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-grey, #666);
  }

  .agenda-cal__picker-hint {
    margin: 0 0 12px;
    font-size: 0.9rem;
    color: var(--color-grey, #666);
  }

  .agenda-cal__slot-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    max-height: 320px;
    overflow: auto;
  }

  .agenda-cal__slot-btn {
    padding: 10px 8px;
    border: 1px solid var(--color-border, #d0d5dd);
    border-radius: 8px;
    background: var(--color-surface, #fff);
    color: inherit;
    font: inherit;
    font-size: 0.95rem;
    cursor: pointer;
  }

  .agenda-cal__slot-btn:hover {
    border-color: #27ae60;
    background: rgba(46, 204, 113, 0.12);
  }

  .agenda-cal__slot-btn.is-selected {
    border-color: #1e8449;
    background: rgba(39, 174, 96, 0.28);
    font-weight: 600;
  }

  .agenda-cal :deep(.fc) {
    --fc-border-color: var(--color-border, #e5e7eb);
    --fc-page-bg-color: transparent;
    --fc-neutral-bg-color: rgba(0, 0, 0, 0.03);
    --fc-today-bg-color: rgba(59, 130, 246, 0.08);
    --fc-business-hours-color: rgba(46, 204, 113, 0.06);
    font-size: 0.9rem;
  }

  .agenda-cal :deep(.fc .fc-toolbar-title) {
    font-size: 1.15rem;
  }

  .agenda-cal :deep(.fc .fc-button) {
    background: var(--color-surface, #fff);
    border-color: var(--color-border, #d0d5dd);
    color: inherit;
    text-transform: none;
    box-shadow: none;
  }

  .agenda-cal :deep(.fc .fc-button:hover),
  .agenda-cal :deep(.fc .fc-button:focus) {
    background: var(--color-neutral-bg, #f3f4f6);
    border-color: var(--color-border, #d0d5dd);
    color: inherit;
  }

  .agenda-cal :deep(.fc .fc-button-primary:not(:disabled).fc-button-active) {
    background: var(--color-primary, #2563eb);
    border-color: var(--color-primary, #2563eb);
    color: #fff;
  }

  .agenda-cal :deep(.agenda-cal__event--free),
  .agenda-cal :deep(.fc-bg-event.agenda-cal__event--free),
  .agenda-cal :deep(.fc-bg-event.agenda-cal__event--hour) {
    cursor: pointer;
  }

  .agenda-cal :deep(.agenda-cal__event--session),
  .agenda-cal :deep(.agenda-cal__event--busy) {
    cursor: pointer;
  }

  .agenda-cal :deep(.fc-timegrid-event.agenda-cal__event--selected),
  .agenda-cal :deep(.fc-timegrid-event.agenda-cal__event--session),
  .agenda-cal :deep(.fc-timegrid-event.agenda-cal__event--busy) {
    font-weight: 600;
    overflow: hidden;
  }
</style>
