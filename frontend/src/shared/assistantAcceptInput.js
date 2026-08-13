/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Копия shared/assistantAcceptInput.js для Vite.
 */

export const ACCEPT_INPUT_KEYS = Object.freeze(['text', 'file', 'video', 'audio']);

export const DEFAULT_ACCEPT_INPUT = Object.freeze({
  text: true,
  file: true,
  video: true,
  audio: true
});

export function cloneDefaultAcceptInput() {
  return { ...DEFAULT_ACCEPT_INPUT };
}

export function normalizeAcceptInput(raw) {
  const out = cloneDefaultAcceptInput();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const key of ACCEPT_INPUT_KEYS) {
    if (raw[key] === false) out[key] = false;
    else if (raw[key] === true) out[key] = true;
  }
  return out;
}
