/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const KEY = 'voiceCallReturnUrl';

export function setVoiceCallReturnUrl(url) {
  const value = String(url || '').trim();
  if (
    !/^\/book-call(?:\?.*)?$/.test(value)
    && !/^\/contacts\/\d+\/(?:conference|profile)(?:\?.*)?$/.test(value)
  ) return;
  sessionStorage.setItem(KEY, value);
}

export function consumeVoiceCallReturnUrl() {
  const value = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  if (
    !value
    || (
      !/^\/book-call(?:\?.*)?$/.test(value)
      && !/^\/contacts\/\d+\/(?:conference|profile)(?:\?.*)?$/.test(value)
    )
  ) return null;
  return value;
}
