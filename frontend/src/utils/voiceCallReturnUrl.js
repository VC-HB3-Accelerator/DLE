/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Возврат на /book-call после входа + черновик слота и режима календаря.
 */

const RETURN_KEY = 'voiceCallReturnUrl';
const DRAFT_KEY = 'voiceCallBookingDraft';

const RETURN_OK =
  /^\/book-call(?:\?.*)?$|^\/contacts\/\d+\/(?:conference|profile)(?:\/create)?(?:\?.*)?$/;

function safeParse(raw) {
  try {
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

export function buildBookCallReturnUrl({ pageId, scheduledAt, viewMode, step } = {}) {
  const q = new URLSearchParams();
  if (pageId) q.set('page', String(pageId));
  if (scheduledAt) q.set('scheduledAt', String(scheduledAt));
  if (viewMode) q.set('view', String(viewMode));
  if (step) q.set('step', String(step));
  const s = q.toString();
  return s ? `/book-call?${s}` : '/book-call';
}

export function setVoiceCallBookingDraft(draft = {}) {
  const payload = {
    scheduledAt: String(draft.scheduledAt || '').trim(),
    viewMode: String(draft.viewMode || 'dayGridMonth').trim() || 'dayGridMonth',
    pageId: draft.pageId != null && Number(draft.pageId) > 0 ? Number(draft.pageId) : null,
    step: draft.step === 'form' ? 'form' : 'calendar',
  };
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function peekVoiceCallBookingDraft() {
  try {
    return safeParse(sessionStorage.getItem(DRAFT_KEY));
  } catch {
    return null;
  }
}

export function clearVoiceCallBookingDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function setVoiceCallReturnUrl(url) {
  const value = String(url || '').trim();
  if (!RETURN_OK.test(value)) return;
  try {
    sessionStorage.setItem(RETURN_KEY, value);
  } catch {
    /* ignore */
  }
}

export function consumeVoiceCallReturnUrl() {
  let value = null;
  try {
    value = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    return null;
  }
  if (!value || !RETURN_OK.test(value)) return null;
  return value;
}
