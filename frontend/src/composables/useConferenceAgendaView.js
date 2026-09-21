/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Общий режим вида FullCalendar + сохранение между перезагрузкой / входом.
 */

import { ref, watch } from 'vue';
import { peekVoiceCallBookingDraft, setVoiceCallBookingDraft } from '@/utils/voiceCallReturnUrl';

const STORAGE_VIEW = 'conferenceAgendaViewMode.v3';
const DEFAULT_VIEW = 'dayGridMonth';

function readStoredView() {
  try {
    // Черновик /book-call не подмешиваем сюда — иначе после клика «день» режим
    // залипает на всех календарях, а сетка может остаться на месяце.
    return sessionStorage.getItem(STORAGE_VIEW) || DEFAULT_VIEW;
  } catch {
    return DEFAULT_VIEW;
  }
}

const viewMode = ref(readStoredView());
const showScheduleView = ref(false);

watch(viewMode, (val) => {
  const next = String(val || DEFAULT_VIEW);
  try {
    sessionStorage.setItem(STORAGE_VIEW, next);
    const draft = peekVoiceCallBookingDraft() || {};
    setVoiceCallBookingDraft({ ...draft, viewMode: next });
  } catch {
    /* ignore */
  }
});

export function useConferenceAgendaView() {
  return {
    viewMode,
    showScheduleView,
  };
}
