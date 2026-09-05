/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Текст транскрипта/чата на языке зрителя (host vs participant).
 * Держать в sync с backend/utils/conferenceInterpretDisplay.js
 */

export function displayTextForViewer(item, { isHostViewer = false } = {}) {
  if (!item) return '';
  const role = item.role;
  const original = item.text || '';
  const translated = item.text_translated || '';

  if (role === 'participant') {
    return isHostViewer ? (translated || original) : original;
  }
  if (role === 'host') {
    return isHostViewer ? original : (translated || original);
  }
  if (role === 'agent') {
    return isHostViewer ? (translated || original) : original;
  }
  return original;
}

export function subtitleTextForViewer(item, { isHostViewer = false } = {}) {
  if (!item?.text_translated) return '';
  const shown = displayTextForViewer(item, { isHostViewer });
  const original = item.text || '';
  if (shown === original) return '';
  return original;
}
