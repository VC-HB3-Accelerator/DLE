/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const KEY = 'voiceCallReturnUrl';

export function setVoiceCallReturnUrl(url) {
  const value = String(url || '').trim();
  if (!/^\/contacts\/\d+\/conference(?:\?.*)?$/.test(value)) return;
  sessionStorage.setItem(KEY, value);
}

export function consumeVoiceCallReturnUrl() {
  const value = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  if (!value || !/^\/contacts\/\d+\/conference(?:\?.*)?$/.test(value)) return null;
  return value;
}
