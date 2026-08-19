<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="schedule" v-loading="loading">
    <p class="hint">{{ t('contacts.conference.schedule.hint') }}</p>
    <p v-if="!form.editor_user_id" class="hint">{{ t('contacts.conference.schedule.noEditor') }}</p>
    <p v-if="errorText" class="error">{{ errorText }}</p>

    <form class="panel form" @submit.prevent="save">
      <label class="form-label">{{ t('contacts.conference.schedule.timeZone') }}</label>
      <select v-model="form.booking_hours.timeZone" class="form-control">
        <option v-for="tz in timeZones" :key="tz" :value="tz">{{ tz }}</option>
      </select>

      <div class="hours-row">
        <div>
          <label class="form-label">{{ t('contacts.conference.schedule.startHour') }}</label>
          <input v-model.number="form.booking_hours.startHour" type="number" min="0" max="23" class="form-control">
        </div>
        <div>
          <label class="form-label">{{ t('contacts.conference.schedule.endHour') }}</label>
          <input v-model.number="form.booking_hours.endHour" type="number" min="1" max="24" class="form-control">
        </div>
        <div>
          <label class="form-label">{{ t('settings.ai.voiceCall.slotMinutes') }}</label>
          <input v-model.number="form.slot_minutes" type="number" min="10" max="180" class="form-control">
        </div>
      </div>

      <p class="form-label">{{ t('contacts.conference.schedule.weekdays') }}</p>
      <div class="weekdays">
        <label v-for="(label, idx) in weekdayLabels" :key="idx" class="check">
          <input v-model="form.booking_hours.weekdays" type="checkbox" :value="idx">
          <span>{{ label }}</span>
        </label>
      </div>

      <button type="submit" class="btn btn-primary" :disabled="saving">{{ t('common.save') }}</button>
    </form>

    <section class="panel preview">
      <h3>{{ t('contacts.conference.schedule.preview') }}</h3>
      <VoiceCallCalendar
        v-model="previewSlot"
        :slots="freeSlots"
        :occupied="bookings"
        :time-zone="form.booking_hours.timeZone"
        :empty-day-text="t('chat.voiceCall.noSlotsDay')"
        @month-change="onMonthChange"
        @day-change="selectedDay = $event"
      />
      <p v-if="dayBookings.length" class="booked-title">{{ t('contacts.conference.schedule.bookedDay') }}</p>
      <ul v-if="dayBookings.length" class="booked-list">
        <li v-for="item in dayBookings" :key="item.id">
          {{ formatSlotTime(item.starts_at, form.booking_hours.timeZone) }}
          · {{ item.minutes }} {{ t('chat.voiceCall.min') }}
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import api from '@/api/axios';
import VoiceCallCalendar from '@/components/chat/VoiceCallCalendar.vue';
import { dayKey, formatSlotTime, monthBoundsIso } from '@/utils/voiceCallCalendar';

const { t, locale } = useI18n();
const loading = ref(false);
const saving = ref(false);
const errorText = ref('');
const previewSlot = ref('');
const selectedDay = ref('');
const freeSlots = ref([]);
const bookings = ref([]);
const timeZones = ref(['Europe/Moscow', 'UTC']);
const form = ref({
  editor_user_id: null,
  slot_minutes: 30,
  booking_hours: {
    startHour: 9,
    endHour: 18,
    timeZone: 'Europe/Moscow',
    weekdays: [1, 2, 3, 4, 5]
  }
});
const year = ref(new Date().getFullYear());
const month = ref(new Date().getMonth() + 1);

const weekdayLabels = computed(() => {
  const base = new Date(Date.UTC(2026, 7, 16));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base.getTime() + i * 86400000);
    return new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'ru-RU', { weekday: 'short' }).format(d);
  });
});

const dayBookings = computed(() => {
  const key = selectedDay.value || (previewSlot.value
    ? dayKey(previewSlot.value, form.value.booking_hours.timeZone)
    : '');
  if (!key) return [];
  return bookings.value.filter((b) => dayKey(b.starts_at, form.value.booking_hours.timeZone) === key);
});

async function loadPreview() {
  try {
    const { from, to } = monthBoundsIso(year.value, month.value);
    const { data } = await api.get('/ai-calls/booking/slots', { params: { from, to } });
    freeSlots.value = data.data?.slots || [];
  } catch (_) {
    freeSlots.value = [];
  }
}

async function load() {
  loading.value = true;
  errorText.value = '';
  try {
    const { data } = await api.get('/ai-calls/booking/schedule');
    const pack = data.data || {};
    form.value.editor_user_id = pack.editor_user_id;
    form.value.slot_minutes = pack.slot_minutes || 30;
    form.value.booking_hours = {
      startHour: pack.booking_hours?.startHour ?? 9,
      endHour: pack.booking_hours?.endHour ?? 18,
      timeZone: pack.booking_hours?.timeZone || 'Europe/Moscow',
      weekdays: [...(pack.booking_hours?.weekdays || [1, 2, 3, 4, 5])]
    };
    timeZones.value = pack.time_zones?.length ? pack.time_zones : timeZones.value;
    if (!timeZones.value.includes(form.value.booking_hours.timeZone)) {
      timeZones.value = [form.value.booking_hours.timeZone, ...timeZones.value];
    }
    bookings.value = pack.bookings || [];
    await loadPreview();
  } catch (error) {
    errorText.value = error.response?.data?.error || t('contacts.conference.schedule.loadFailed');
  } finally {
    loading.value = false;
  }
}

function onMonthChange({ year: y, month: m }) {
  year.value = y;
  month.value = m;
  loadPreview();
}

async function save() {
  saving.value = true;
  errorText.value = '';
  try {
    const { data } = await api.put('/ai-calls/booking/schedule', {
      booking_slot_minutes: form.value.slot_minutes,
      booking_hours: form.value.booking_hours
    });
    form.value.booking_hours = {
      startHour: data.data?.booking_hours?.startHour ?? form.value.booking_hours.startHour,
      endHour: data.data?.booking_hours?.endHour ?? form.value.booking_hours.endHour,
      timeZone: data.data?.booking_hours?.timeZone || form.value.booking_hours.timeZone,
      weekdays: [...(data.data?.booking_hours?.weekdays || form.value.booking_hours.weekdays)]
    };
    ElMessage.success(t('contacts.conference.schedule.saved'));
    await loadPreview();
  } catch (error) {
    errorText.value = error.response?.data?.error || t('contacts.conference.schedule.saveFailed');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.hint {
  margin: 0 0 12px;
  color: var(--color-grey);
  font-size: var(--font-size-sm);
}
.error {
  color: var(--color-danger, #b42318);
}
.form,
.preview {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--block-radius);
  background: var(--color-white);
}
.form-label {
  display: block;
  margin-top: 12px;
  margin-bottom: 4px;
}
.hours-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.weekdays {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 8px 0 16px;
}
.check {
  display: flex;
  gap: 6px;
  align-items: center;
}
.booked-title {
  margin: 16px 0 8px;
  font-weight: 600;
}
.booked-list {
  margin: 0;
  padding-left: 18px;
}
@media (max-width: 768px) {
  .hours-row {
    grid-template-columns: 1fr;
  }
}
</style>
