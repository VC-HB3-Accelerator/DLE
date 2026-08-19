<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="call-cal">
    <div class="call-cal__nav">
      <button type="button" class="call-cal__nav-btn" @click="shiftMonth(-1)">‹</button>
      <strong>{{ monthLabel }}</strong>
      <button type="button" class="call-cal__nav-btn" @click="shiftMonth(1)">›</button>
    </div>
    <div class="call-cal__weekdays">
      <span v-for="wd in weekdayLabels" :key="wd">{{ wd }}</span>
    </div>
    <div class="call-cal__grid">
      <button
        v-for="(cell, idx) in cells"
        :key="idx"
        type="button"
        class="call-cal__day"
        :class="{
          empty: cell == null,
          selected: cell != null && dayKeyOf(cell) === selectedDay,
          has: cell != null && (dayCount(cell) > 0 || dayOccupied(cell)),
          today: cell != null && dayKeyOf(cell) === todayKey
        }"
        :disabled="cell == null || (!dayCount(cell) && !dayOccupied(cell))"
        @click="selectDay(cell)"
      >
        <span v-if="cell != null">{{ cell }}</span>
        <i v-if="cell != null && dayCount(cell)" class="call-cal__dot" />
      </button>
    </div>
    <p v-if="selectedDay && !daySlots.length" class="call-cal__hint">{{ emptyDayText }}</p>
    <div v-else class="call-cal__times">
      <button
        v-for="iso in daySlots"
        :key="iso"
        type="button"
        class="call-cal__time"
        :class="{ active: modelValue === iso }"
        @click="$emit('update:modelValue', iso)"
      >
        {{ formatSlotTime(iso, timeZone) }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  dayKey,
  formatSlotTime,
  groupSlotsByDay,
  monthCells,
  partsInZone
} from '@/utils/voiceCallCalendar';

const props = defineProps({
  slots: { type: Array, default: () => [] },
  occupied: { type: Array, default: () => [] },
  timeZone: { type: String, default: 'Europe/Moscow' },
  modelValue: { type: String, default: '' },
  emptyDayText: { type: String, default: '' }
});

const emit = defineEmits(['update:modelValue', 'month-change', 'day-change']);

const { locale } = useI18n();
const nowParts = partsInZone(new Date(), props.timeZone);
const viewYear = ref(nowParts.year);
const viewMonth = ref(nowParts.month);
const selectedDay = ref('');

const weekdayLabels = computed(() => {
  const base = new Date(Date.UTC(2026, 7, 17));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base.getTime() + i * 86400000);
    return new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'ru-RU', { weekday: 'short' }).format(d);
  });
});

const monthLabel = computed(() =>
  new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'ru-RU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(viewYear.value, viewMonth.value - 1, 1)))
);

const cells = computed(() => monthCells(viewYear.value, viewMonth.value));
const byDay = computed(() => groupSlotsByDay(props.slots, props.timeZone));
const occupiedByDay = computed(() => groupSlotsByDay(props.occupied, props.timeZone));
const todayKey = computed(() => dayKey(new Date().toISOString(), props.timeZone));

function dayKeyOf(day) {
  return `${viewYear.value}-${String(viewMonth.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dayCount(day) {
  return (byDay.value.get(dayKeyOf(day)) || []).length;
}

function dayOccupied(day) {
  return (occupiedByDay.value.get(dayKeyOf(day)) || []).length;
}

const daySlots = computed(() => byDay.value.get(selectedDay.value) || []);

function selectDay(day) {
  if (day == null) return;
  selectedDay.value = dayKeyOf(day);
  emit('update:modelValue', '');
  emit('day-change', selectedDay.value);
}

function shiftMonth(delta) {
  const d = new Date(Date.UTC(viewYear.value, viewMonth.value - 1 + delta, 1));
  viewYear.value = d.getUTCFullYear();
  viewMonth.value = d.getUTCMonth() + 1;
  selectedDay.value = '';
  emit('update:modelValue', '');
  emit('month-change', { year: viewYear.value, month: viewMonth.value });
}

watch(
  () => props.slots,
  (list) => {
    if (selectedDay.value && byDay.value.get(selectedDay.value)?.length) return;
    const first = (list || [])[0]?.starts_at || (list || [])[0];
    if (first) selectedDay.value = dayKey(first, props.timeZone);
  },
  { immediate: true }
);

defineExpose({ viewYear, viewMonth });
</script>

<style scoped>
.call-cal {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.call-cal__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
}
.call-cal__nav-btn {
  width: 2.2rem;
  height: 2.2rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 8px);
  background: var(--color-white);
  cursor: pointer;
}
.call-cal__weekdays,
.call-cal__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}
.call-cal__weekdays span {
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-grey);
}
.call-cal__day {
  position: relative;
  min-height: 2.4rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 8px);
  background: var(--color-white);
  cursor: pointer;
}
.call-cal__day.empty,
.call-cal__day:disabled {
  background: transparent;
  border-color: transparent;
  cursor: default;
  color: var(--color-grey);
}
.call-cal__day.has {
  font-weight: 600;
}
.call-cal__day.selected {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.call-cal__day.today:not(.selected) {
  background: color-mix(in srgb, var(--color-primary) 8%, white);
}
.call-cal__dot {
  display: block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-primary);
  margin: 2px auto 0;
}
.call-cal__times {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}
.call-cal__time {
  min-width: 4.5rem;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 8px);
  background: var(--color-white);
  cursor: pointer;
}
.call-cal__time.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.call-cal__hint {
  margin: 0;
  color: var(--color-grey);
  font-size: var(--font-size-sm);
}
</style>
