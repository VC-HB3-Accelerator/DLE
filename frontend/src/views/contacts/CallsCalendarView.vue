<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Календарь назначения звонка (1:1 или мульти) — TZ_CALL_SYSTEM.
-->

<template>
  <BaseLayout>
    <AdminPageShell
      :title="pageTitle"
      :show-close="true"
      :fallback="{ name: 'contacts-list' }"
      variant="panel"
    >
      <div class="panel section-card" v-loading="loading">
        <p class="section-description">{{ pageHint }}</p>
        <p v-if="!peerIds.length" class="error">{{ t('contacts.calls.calendar.noPeers') }}</p>
        <p v-else-if="loadError" class="error">{{ loadError }}</p>
        <p v-else-if="!slots.length && !loading" class="section-description">
          {{ t('chat.voiceCall.noSlots') }}
        </p>
        <VoiceCallCalendar
          v-else-if="peerIds.length"
          v-model="selectedSlot"
          :slots="slots"
          :occupied="occupied"
          :time-zone="timeZone"
          :empty-day-text="t('chat.voiceCall.noSlotsDay')"
          @month-change="onMonthChange"
        />
        <div class="btn-row">
          <el-button
            type="primary"
            :disabled="!selectedSlot || busy || !peerIds.length"
            :loading="busy"
            @click="book"
          >
            {{ t('contacts.calls.calendar.confirm') }}
          </el-button>
        </div>
      </div>
    </AdminPageShell>
  </BaseLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import BaseLayout from '@/components/BaseLayout.vue';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';
import VoiceCallCalendar from '@/components/chat/VoiceCallCalendar.vue';
import conferenceService from '@/services/conferenceService';
import { monthBoundsIso } from '@/utils/voiceCallCalendar';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const slots = ref([]);
const occupied = ref([]);
const selectedSlot = ref('');
const timeZone = ref('Europe/Moscow');
const loadError = ref('');
const busy = ref(false);
const loading = ref(false);
const year = ref(new Date().getFullYear());
const month = ref(new Date().getMonth() + 1);

const peerIds = computed(() => {
  const raw = route.query.ids;
  return String(raw || '')
    .split(',')
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 3);
});

const pageTitle = computed(() => (
  peerIds.value.length > 1
    ? t('contacts.calls.calendar.titleMulti')
    : t('contacts.calls.calendar.titleOne')
));

const pageHint = computed(() => (
  peerIds.value.length > 1
    ? t('contacts.calls.calendar.hintMulti', { count: peerIds.value.length })
    : t('contacts.calls.calendar.hintOne')
));

async function loadSlots() {
  if (!peerIds.value.length) {
    slots.value = [];
    occupied.value = [];
    return;
  }
  loading.value = true;
  loadError.value = '';
  try {
    const { from, to } = monthBoundsIso(year.value, month.value);
    const data = await conferenceService.getCallCalendarSlots({
      ids: peerIds.value,
      from,
      to
    });
    slots.value = data.slots || [];
    occupied.value = data.occupied || [];
    timeZone.value = data.time_zone || data.booking_hours?.timeZone || timeZone.value;
  } catch (error) {
    loadError.value = error.response?.data?.error || t('chat.voiceCall.slotsError');
    slots.value = [];
    occupied.value = [];
  } finally {
    loading.value = false;
  }
}

function onMonthChange({ year: y, month: m }) {
  year.value = y;
  month.value = m;
  selectedSlot.value = '';
  loadSlots();
}

async function book() {
  if (!selectedSlot.value || !peerIds.value.length) return;
  busy.value = true;
  loadError.value = '';
  try {
    await conferenceService.scheduleCall({
      userIds: peerIds.value,
      scheduled_at: selectedSlot.value
    });
    ElMessage.success(t('contacts.calls.calendar.created'));
    await router.push({ name: 'personal-calls' });
  } catch (error) {
    loadError.value = error.response?.data?.error || t('contacts.calls.calendar.createError');
  } finally {
    busy.value = false;
  }
}

onMounted(loadSlots);
</script>

<style scoped>
.section-description {
  margin: 0 0 12px;
  color: var(--color-grey);
}

.error {
  color: var(--color-danger, #c0392b);
  margin-bottom: 12px;
}

.btn-row {
  margin-top: 16px;
}

.section-card {
  padding: 4px 0;
}
</style>
