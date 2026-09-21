<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="agenda-cal">
    <div v-if="!hideToolbar" class="agenda-cal__toolbar">
      <div class="agenda-cal__modes" role="group" :aria-label="t('contacts.conference.calendar.viewLabel')">
        <button
          v-for="opt in viewOptions"
          :key="opt.value"
          type="button"
          class="agenda-cal__btn"
          :class="{ 'is-active': currentView === opt.value }"
          @click="setView(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
      <div class="agenda-cal__nav">
        <button
          type="button"
          class="agenda-cal__btn agenda-cal__btn--icon"
          :aria-label="t('common.prev')"
          @click="goPrev"
        >
          ‹
        </button>
        <button
          type="button"
          class="agenda-cal__btn agenda-cal__btn--icon"
          :aria-label="t('common.next')"
          @click="goNext"
        >
          ›
        </button>
        <button type="button" class="agenda-cal__btn" @click="goToday">
          {{ t('contacts.conference.calendar.today') }}
        </button>
        <router-link
          v-if="settingsTo"
          :to="settingsTo"
          class="agenda-cal__btn agenda-cal__btn--icon"
          :title="t('contacts.conference.nav.availability')"
          :aria-label="t('contacts.conference.nav.availability')"
        >
          <UiGlyph name="settings" :size="18" />
        </router-link>
      </div>
    </div>

    <template v-if="isMonthView">
      <div class="agenda-cal__heading">{{ monthTitle }}</div>
      <div class="agenda-cal__weekdays">
        <span v-for="wd in weekdayLabels" :key="wd">{{ wd }}</span>
      </div>
      <div class="agenda-cal__days">
        <div v-for="(cell, idx) in monthCellsList" :key="idx" class="agenda-cal__day-wrap">
          <button
            type="button"
            class="agenda-cal__day"
            :class="dayCellClass(cell)"
            :disabled="cell == null"
            @click="openDay(dayKeyOf(cell))"
          >
            <span v-if="cell != null">{{ cell }}</span>
          </button>
          <span v-if="cell != null" class="agenda-cal__marks">
            <i v-if="hasPending(dayKeyOf(cell))" class="agenda-cal__mark agenda-cal__mark--pending" />
            <i v-if="hasScheduled(dayKeyOf(cell))" class="agenda-cal__mark agenda-cal__mark--event" />
          </span>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="agenda-cal__heading">{{ weekTitle }}</div>
      <div class="agenda-cal__weekstrip">
        <div v-for="key in weekKeys" :key="key" class="agenda-cal__strip-col">
          <span class="agenda-cal__strip-wd">{{ weekdayShort(key) }}</span>
          <button
            type="button"
            class="agenda-cal__day agenda-cal__day--strip"
            :class="stripDayClass(key)"
            @click="openDay(key, { stayInDay: true })"
          >
            {{ dayNumber(key) }}
          </button>
          <span class="agenda-cal__marks">
            <i v-if="hasPending(key)" class="agenda-cal__mark agenda-cal__mark--pending" />
            <i v-if="hasScheduled(key)" class="agenda-cal__mark agenda-cal__mark--event" />
          </span>
        </div>
      </div>
      <div class="agenda-cal__day-head">{{ dayTitle }}</div>
      <p v-if="!dayItems.length" class="agenda-cal__hint">
        {{
          isPastKey(focusKey)
            ? t('contacts.conference.calendar.emptyPastDay')
            : t('contacts.conference.calendar.emptyDay')
        }}
      </p>
      <div v-else class="agenda-cal__slots">
        <button
          v-for="item in dayItems"
          :key="item.id"
          type="button"
          class="agenda-cal__slot"
          :class="{
            'is-selected': item.kind === 'free' && item.iso === selectedIso,
            'is-session': item.kind === 'session' && item.tone !== 'pending',
            'is-pending': item.kind === 'session' && item.tone === 'pending',
            'is-busy': item.kind === 'busy',
          }"
          :disabled="
            item.kind === 'busy' ||
            (item.kind === 'free' && (!canSelectSlot || isPastKey(focusKey) || isPastSlot(item.iso)))
          "
          @click="onDayItemClick(item)"
        >
          {{ item.label }}
        </button>
      </div>
    </template>

    <ul v-if="showLegend" class="agenda-cal__legend">
      <li>
        <i class="agenda-cal__legend-swatch agenda-cal__legend-swatch--free" />
        {{ t('contacts.conference.calendar.legendFree') }}
      </li>
      <li>
        <i class="agenda-cal__legend-swatch agenda-cal__legend-swatch--event" />
        {{ t('contacts.conference.calendar.legendScheduled') }}
      </li>
      <li>
        <i class="agenda-cal__legend-swatch agenda-cal__legend-swatch--pending" />
        {{ t('contacts.conference.calendar.legendPending') }}
      </li>
    </ul>
  </div>
</template>

<script setup>
  import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { useConferenceAgendaView } from '@/composables/useConferenceAgendaView';
  import UiGlyph from '@/components/UiGlyph.vue';
  import {
    dayKey,
    formatSlotTime,
    groupSlotsByDay,
    isPastSlot,
    monthBoundsIso,
    monthCells,
    shiftDayKey,
    shiftMonthParts,
    weekBoundsIso,
    weekDayKeys,
  } from '@/utils/voiceCallCalendar';

  const props = defineProps({
    slots: { type: Array, default: () => [] },
    sessions: { type: Array, default: () => [] },
    occupied: { type: Array, default: () => [] },
    bookingHours: { type: Object, default: null },
    slotMinutes: { type: Number, default: 30 },
    timeZone: { type: String, default: 'Europe/Moscow' },
    canSelectSlot: { type: Boolean, default: true },
    selectedSlot: { type: String, default: '' },
    showScheduleView: { type: Boolean, default: false },
    hideToolbar: { type: Boolean, default: false },
    settingsTo: { type: [String, Object], default: null },
  });

  const emit = defineEmits(['range-change', 'select-slot', 'select-session']);

  const { t, locale } = useI18n();
  const { viewMode: sharedViewMode, showScheduleView: sharedShowSchedule } =
    useConferenceAgendaView();

  const DEFAULT_VIEW = 'dayGridMonth';
  const currentView = ref(DEFAULT_VIEW);
  const lastRangeKey = ref('');
  const keepSelectionOnce = ref(false);

  const todayKey = computed(() => dayKey(new Date().toISOString(), props.timeZone));
  const focusKey = ref(todayKey.value);

  const loc = computed(() => (locale.value === 'en' ? 'en-GB' : 'ru-RU'));
  const isMonthView = computed(() => currentView.value === DEFAULT_VIEW);
  const showLegend = computed(() => Boolean(props.showScheduleView));

  const viewOptions = computed(() => [
    { value: 'dayGridMonth', label: t('contacts.conference.calendar.views.month') },
    { value: 'timeGridDay', label: t('contacts.conference.calendar.views.day') },
  ]);

  const selectedIso = computed(() =>
    props.selectedSlot ? new Date(props.selectedSlot).toISOString() : ''
  );

  const viewYear = computed(() => Number(String(focusKey.value).slice(0, 4)));
  const viewMonth = computed(() => Number(String(focusKey.value).slice(5, 7)));

  const weekdayLabels = computed(() => {
    const base = new Date(Date.UTC(2026, 7, 17));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base.getTime() + i * 86400000);
      return new Intl.DateTimeFormat(loc.value, { weekday: 'short' }).format(d);
    });
  });

  const monthTitle = computed(() => {
    const raw = new Intl.DateTimeFormat(loc.value, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(viewYear.value, viewMonth.value - 1, 1)));
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  });

  const weekKeys = computed(() => weekDayKeys(focusKey.value));

  const weekTitle = computed(() => {
    const start = weekKeys.value[0];
    const end = weekKeys.value[6];
    const fmt = (key, withYear) => {
      const [y, m, d] = key.split('-').map(Number);
      return new Intl.DateTimeFormat(loc.value, {
        day: 'numeric',
        month: 'short',
        ...(withYear ? { year: 'numeric' } : {}),
        timeZone: 'UTC',
      }).format(new Date(Date.UTC(y, m - 1, d)));
    };
    return `${fmt(start, false)} – ${fmt(end, true)}`;
  });

  const dayTitle = computed(() => {
    const [y, m, d] = focusKey.value.split('-').map(Number);
    const raw = new Intl.DateTimeFormat(loc.value, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(y, m - 1, d)));
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  });

  const monthCellsList = computed(() => monthCells(viewYear.value, viewMonth.value));

  const freeByDay = computed(() => groupSlotsByDay(props.slots, props.timeZone));

  const sessionsByDay = computed(() => {
    const map = new Map();
    for (const session of props.sessions || []) {
      if (!session?.scheduled_at) continue;
      const key = dayKey(session.scheduled_at, props.timeZone);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(session);
    }
    return map;
  });

  const sessionIds = computed(() => {
    const set = new Set();
    for (const s of props.sessions || []) {
      if (s?.id != null) set.add(String(s.id));
    }
    return set;
  });

  const dayItems = computed(() => {
    const key = focusKey.value;
    const past = isPastKey(key);
    const items = [];
    const taken = new Set();

    for (const session of sessionsByDay.value.get(key) || []) {
      const iso = new Date(session.scheduled_at).toISOString();
      taken.add(iso);
      const tone = sessionTone(session);
      const title = session.title || t('contacts.conference.live.untitled');
      let badge = '';
      if (tone === 'pending') badge = ` · ${t('contacts.conference.calendar.pendingBadge')}`;
      else if (tone === 'ended') badge = ` · ${t('contacts.conference.status.ended')}`;
      items.push({
        id: `session-${session.id}`,
        kind: 'session',
        tone,
        iso,
        session,
        label: `${formatSlotTime(iso, props.timeZone)} · ${title}${badge}`,
        sort: new Date(iso).getTime(),
      });
    }

    if (!past) {
      for (const item of props.occupied || []) {
        const startIso = item?.starts_at || item;
        if (!startIso) continue;
        if (dayKey(startIso, props.timeZone) !== key) continue;
        const iso = new Date(startIso).toISOString();
        if (taken.has(iso)) continue;
        const confId = item?.conference_id;
        if (confId != null && sessionIds.value.has(String(confId))) continue;
        taken.add(iso);
        items.push({
          id: `busy-${iso}`,
          kind: 'busy',
          iso,
          label: `${formatSlotTime(iso, props.timeZone)} · ${t('contacts.conference.calendar.busySlot')}`,
          sort: new Date(iso).getTime(),
        });
      }

      for (const raw of freeByDay.value.get(key) || []) {
        const iso = new Date(raw).toISOString();
        if (taken.has(iso)) continue;
        if (isPastSlot(iso)) continue;
        items.push({
          id: `free-${iso}`,
          kind: 'free',
          iso,
          label: formatSlotTime(iso, props.timeZone),
          sort: new Date(iso).getTime(),
        });
      }
    }

    return items.sort((a, b) => a.sort - b.sort);
  });

  function normalizeViewType(type) {
    if (type === 'timeGridDay' || type === 'dayGridDay' || type === 'listDay') {
      return 'timeGridDay';
    }
    return DEFAULT_VIEW;
  }

  function dayKeyOf(day) {
    if (day == null) return '';
    return `${viewYear.value}-${String(viewMonth.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function dayNumber(key) {
    return Number(String(key).slice(8, 10));
  }

  function isPastKey(key) {
    return Boolean(key) && key < todayKey.value;
  }

  function isWeekendKey(key) {
    const [y, m, d] = String(key).split('-').map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return dow === 0 || dow === 6;
  }

  function sessionTone(session) {
    const status = String(session?.status || '').toLowerCase();
    if (status === 'ended') return 'ended';
    if (status === 'draft' || String(session?.id || '').startsWith('booking-')) {
      return 'pending';
    }
    return 'scheduled';
  }

  function hasFreeSlots(key) {
    if (!key || isPastKey(key)) return false;
    return (freeByDay.value.get(key) || []).some((iso) => !isPastSlot(iso));
  }

  function hasPending(key) {
    if (!key) return false;
    return (sessionsByDay.value.get(key) || []).some((s) => sessionTone(s) === 'pending');
  }

  function hasScheduled(key) {
    if (!key) return false;
    return (sessionsByDay.value.get(key) || []).some((s) => sessionTone(s) !== 'pending');
  }

  function hasAvailability(key) {
    return hasFreeSlots(key) || hasPending(key) || hasScheduled(key);
  }

  function weekdayShort(key) {
    const [y, m, d] = String(key).split('-').map(Number);
    return new Intl.DateTimeFormat(loc.value, {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(y, m - 1, d)));
  }

  function dayCellClass(cell) {
    if (cell == null) return { 'is-empty': true };
    const key = dayKeyOf(cell);
    return {
      'is-selected': key === focusKey.value,
      'is-today': key === todayKey.value,
      'is-available': hasFreeSlots(key),
      'is-event': hasScheduled(key),
      'is-pending': hasPending(key),
      'is-past': isPastKey(key),
      'is-muted': (isWeekendKey(key) || isPastKey(key)) && !hasAvailability(key),
    };
  }

  function stripDayClass(key) {
    return {
      'is-selected': key === focusKey.value,
      'is-today': key === todayKey.value && key !== focusKey.value,
      'is-available': hasFreeSlots(key) && key !== focusKey.value,
      'is-past': isPastKey(key),
      'is-muted': (isWeekendKey(key) || isPastKey(key)) && key !== focusKey.value,
    };
  }

  function emitRange() {
    const bounds = isMonthView.value
      ? monthBoundsIso(viewYear.value, viewMonth.value)
      : weekBoundsIso(focusKey.value);
    const key = `${bounds.from}|${bounds.to}|${currentView.value}`;
    if (key === lastRangeKey.value) return;
    lastRangeKey.value = key;
    const preserveSelection = keepSelectionOnce.value;
    keepSelectionOnce.value = false;
    emit('range-change', { ...bounds, preserveSelection });
  }

  function setView(view) {
    currentView.value = normalizeViewType(view);
    emitRange();
  }

  function clampMonthDay(year, month, day) {
    const max = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const d = Math.min(Math.max(1, Number(day) || 1), max);
    return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function goPrev() {
    if (isMonthView.value) {
      const next = shiftMonthParts(viewYear.value, viewMonth.value, -1);
      focusKey.value = clampMonthDay(next.year, next.month, dayNumber(focusKey.value));
    } else {
      focusKey.value = shiftDayKey(focusKey.value, -7);
    }
    emitRange();
  }

  function goNext() {
    if (isMonthView.value) {
      const next = shiftMonthParts(viewYear.value, viewMonth.value, 1);
      focusKey.value = clampMonthDay(next.year, next.month, dayNumber(focusKey.value));
    } else {
      focusKey.value = shiftDayKey(focusKey.value, 7);
    }
    emitRange();
  }

  function openDay(key, options = {}) {
    if (!key) return;
    keepSelectionOnce.value = true;
    focusKey.value = key;
    if (!options.stayInDay) {
      currentView.value = 'timeGridDay';
    }
    emitRange();
  }

  function goToday() {
    focusKey.value = todayKey.value;
    emitRange();
  }

  function onDayItemClick(item) {
    if (!item) return;
    if (item.kind === 'session' && item.session) {
      emit('select-session', item.session);
      return;
    }
    if (
      item.kind === 'free' &&
      props.canSelectSlot &&
      item.iso &&
      !isPastKey(focusKey.value) &&
      !isPastSlot(item.iso)
    ) {
      emit('select-slot', item.iso);
    }
  }

  watch(currentView, (val) => {
    if (sharedViewMode.value !== val) sharedViewMode.value = val;
  });

  watch(sharedViewMode, (val) => {
    const next = normalizeViewType(val);
    if (currentView.value === next) return;
    currentView.value = next;
    emitRange();
  });

  watch(
    () => props.showScheduleView,
    (allowed) => {
      sharedShowSchedule.value = Boolean(allowed);
    },
    { immediate: true }
  );

  watch(
    () => props.selectedSlot,
    (iso) => {
      if (!iso) return;
      const key = dayKey(iso, props.timeZone);
      if (key && currentView.value === 'timeGridDay') {
        focusKey.value = key;
      }
    }
  );

  onMounted(() => {
    sharedShowSchedule.value = Boolean(props.showScheduleView);
    const fromSlot = props.selectedSlot ? dayKey(props.selectedSlot, props.timeZone) : '';
    focusKey.value = fromSlot || todayKey.value;
    currentView.value = normalizeViewType(sharedViewMode.value || DEFAULT_VIEW);
    sharedViewMode.value = currentView.value;
    emitRange();
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
    gap: var(--spacing-md);
    width: 100%;
    max-width: 520px;
    min-width: 0;
    margin-inline: auto;
  }

  .agenda-cal__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }

  .agenda-cal__modes,
  .agenda-cal__nav {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .agenda-cal__btn {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    min-height: 40px;
    min-width: 40px;
    padding: 0 14px;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: var(--color-white);
    color: var(--color-text);
    font: inherit;
    font-size: var(--font-size-sm);
    line-height: 1;
    cursor: pointer;
    text-decoration: none;
  }

  .agenda-cal__btn--icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    width: 40px;
    font-size: 1.25rem;
    text-decoration: none;
  }

  .agenda-cal__btn:hover,
  .agenda-cal__btn:focus {
    background: var(--color-light);
  }

  .agenda-cal__btn.is-active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-white);
  }

  .agenda-cal__heading {
    margin: 4px 0 0;
    text-align: center;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-text);
  }

  .agenda-cal__weekdays,
  .agenda-cal__days {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
    justify-items: center;
  }

  .agenda-cal__day-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    min-height: 48px;
  }

  .agenda-cal__marks {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 3px;
    min-height: 6px;
  }

  .agenda-cal__mark {
    display: block;
    width: 5px;
    height: 5px;
    border-radius: 50%;
  }

  .agenda-cal__mark--event {
    background: var(--color-primary);
  }

  .agenda-cal__mark--pending {
    background: var(--color-warning);
  }

  .agenda-cal__weekdays span {
    font-size: var(--font-size-sm);
    color: var(--color-grey);
    text-align: center;
  }

  .agenda-cal__day {
    box-sizing: border-box;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--color-text);
    font: inherit;
    font-size: var(--font-size-md);
    cursor: pointer;
  }

  .agenda-cal__day.is-empty,
  .agenda-cal__day:disabled {
    background: transparent;
    color: var(--color-grey);
    cursor: default;
    opacity: 0.45;
  }

  .agenda-cal__day.is-available {
    background: var(--color-light);
  }

  .agenda-cal__day.is-muted {
    color: var(--color-grey);
  }

  .agenda-cal__day.is-past:not(.is-selected) {
    opacity: 0.62;
  }

  .agenda-cal__day.is-today:not(.is-selected) {
    box-shadow: inset 0 0 0 1px var(--color-primary);
  }

  .agenda-cal__day.is-selected {
    background: var(--color-primary);
    color: var(--color-white);
    opacity: 1;
  }

  .agenda-cal__weekstrip {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--color-border);
  }

  .agenda-cal__strip-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .agenda-cal__strip-wd {
    font-size: var(--font-size-xs);
    color: var(--color-grey);
  }

  .agenda-cal__day-head {
    font-weight: 600;
    font-size: var(--font-size-md);
  }

  .agenda-cal__hint {
    margin: 0;
    color: var(--color-grey);
    font-size: var(--font-size-sm);
  }

  .agenda-cal__slots {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .agenda-cal__slot {
    width: 100%;
    min-height: 48px;
    padding: 12px 16px;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: var(--color-white);
    color: var(--color-text);
    font: inherit;
    font-size: var(--font-size-md);
    cursor: pointer;
  }

  .agenda-cal__slot:hover:not(:disabled) {
    border-color: var(--color-primary);
  }

  .agenda-cal__slot.is-selected {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-white);
    font-weight: 600;
  }

  .agenda-cal__slot.is-session {
    border-color: var(--color-primary);
    font-weight: 600;
  }

  .agenda-cal__slot.is-pending {
    border-color: var(--color-warning);
  }

  .agenda-cal__slot.is-busy,
  .agenda-cal__slot:disabled {
    cursor: default;
    color: var(--color-grey);
    background: var(--color-light);
  }

  .agenda-cal__legend {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    font-size: var(--font-size-sm);
    color: var(--color-grey);
  }

  .agenda-cal__legend li {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .agenda-cal__legend-swatch {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex: 0 0 auto;
  }

  .agenda-cal__legend-swatch--free {
    background: var(--color-light);
    box-shadow: inset 0 0 0 1px var(--color-border);
  }

  .agenda-cal__legend-swatch--event {
    background: var(--color-primary);
  }

  .agenda-cal__legend-swatch--pending {
    background: var(--color-warning);
  }

  @media (max-width: 768px) {
    .agenda-cal {
      max-width: 100%;
    }

    .agenda-cal__toolbar {
      flex-wrap: nowrap;
    }

    .agenda-cal__btn {
      flex: 0 0 auto;
    }
  }

  @media (max-width: 480px) {
    .agenda-cal__toolbar {
      flex-wrap: wrap;
    }
  }
</style>
