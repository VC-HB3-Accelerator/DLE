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
      <div class="panel section-card">
        <p class="section-description">{{ $t('chat.voiceCall.bookPageHint') }}</p>
        <p v-if="loadError" class="error">{{ loadError }}</p>
        <p v-else-if="!slots.length && !loading" class="section-description">{{ $t('chat.voiceCall.noSlots') }}</p>
        <VoiceCallCalendar
          v-else
          v-model="selectedSlot"
          :slots="slots"
          :time-zone="timeZone"
          :empty-day-text="$t('chat.voiceCall.noSlotsDay')"
          @month-change="onMonthChange"
        />
        <p v-if="needLogin" class="error">{{ $t('chat.voiceCall.needLogin') }}</p>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" :disabled="!selectedSlot || busy" @click="book">
            {{ $t('chat.voiceCall.book') }}
          </button>
        </div>
      </div>
    </AdminPageShell>
  </BaseLayout>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import api from '@/api/axios';
import BaseLayout from '@/components/BaseLayout.vue';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';
import VoiceCallCalendar from '@/components/chat/VoiceCallCalendar.vue';
import { monthBoundsIso } from '@/utils/voiceCallCalendar';
import { setVoiceCallReturnUrl } from '@/utils/voiceCallReturnUrl';

const { t } = useI18n();
const router = useRouter();
const slots = ref([]);
const selectedSlot = ref('');
const timeZone = ref('Europe/Moscow');
const loadError = ref('');
const needLogin = ref(false);
const busy = ref(false);
const loading = ref(false);
const year = ref(new Date().getFullYear());
const month = ref(new Date().getMonth() + 1);

async function loadSlots() {
  loading.value = true;
  loadError.value = '';
  try {
    const { from, to } = monthBoundsIso(year.value, month.value);
    const { data } = await api.get('/ai-calls/booking/slots', { params: { from, to } });
    slots.value = data.data?.slots || [];
    timeZone.value = data.data?.time_zone || data.data?.booking_hours?.timeZone || timeZone.value;
  } catch (error) {
    loadError.value = error.response?.data?.error || t('chat.voiceCall.slotsError');
    slots.value = [];
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
  if (!selectedSlot.value) return;
  busy.value = true;
  needLogin.value = false;
  loadError.value = '';
  try {
    const { data } = await api.post('/ai-calls/booking', { starts_at: selectedSlot.value });
    const url = data.data?.returnUrl;
    if (url) router.push(url);
  } catch (error) {
    if (error.response?.status === 401) {
      setVoiceCallReturnUrl('/book-call');
      needLogin.value = true;
      return;
    }
    loadError.value = error.response?.data?.error || t('chat.voiceCall.bookError');
  } finally {
    busy.value = false;
  }
}

onMounted(loadSlots);
</script>

<style scoped>
.section-card {
  margin-top: var(--spacing-md);
}
.btn-row {
  margin-top: var(--spacing-lg);
}
.error {
  color: var(--color-danger, #b42318);
}
</style>
