/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Копия shared/conferenceSpeechLanguages.js для Vite.
 * Языки речи Qwen3-Omni-Flash-Realtime (озвучка / лайв-синхрон).
 */

export const CONFERENCE_SPEECH_LANGUAGES = Object.freeze([
  { value: 'zh', label: '中文 (zh)' },
  { value: 'en', label: 'English (en)' },
  { value: 'fr', label: 'Français (fr)' },
  { value: 'de', label: 'Deutsch (de)' },
  { value: 'ru', label: 'Русский (ru)' },
  { value: 'it', label: 'Italiano (it)' },
  { value: 'es', label: 'Español (es)' },
  { value: 'pt', label: 'Português (pt)' },
  { value: 'ja', label: '日本語 (ja)' },
  { value: 'ko', label: '한국어 (ko)' },
  { value: 'th', label: 'ไทย (th)' },
  { value: 'id', label: 'Bahasa Indonesia (id)' },
  { value: 'ar', label: 'العربية (ar)' },
  { value: 'vi', label: 'Tiếng Việt (vi)' },
  { value: 'tr', label: 'Türkçe (tr)' },
  { value: 'fi', label: 'Suomi (fi)' },
  { value: 'pl', label: 'Polski (pl)' },
  { value: 'hi', label: 'हिन्दी (hi)' },
  { value: 'nl', label: 'Nederlands (nl)' },
  { value: 'cs', label: 'Čeština (cs)' },
  { value: 'ur', label: 'اردو (ur)' },
  { value: 'tl', label: 'Tagalog (tl)' },
  { value: 'sv', label: 'Svenska (sv)' },
  { value: 'da', label: 'Dansk (da)' },
  { value: 'he', label: 'עברית (he)' },
  { value: 'is', label: 'Íslenska (is)' },
  { value: 'ms', label: 'Bahasa Melayu (ms)' },
  { value: 'no', label: 'Norsk (no)' },
  { value: 'fa', label: 'فارسی (fa)' }
]);

const SPEECH_LANG_CODES = new Set(CONFERENCE_SPEECH_LANGUAGES.map((l) => l.value));

export function isConferenceSpeechLanguage(code) {
  const lang = String(code || '')
    .trim()
    .toLowerCase()
    .slice(0, 2);
  return SPEECH_LANG_CODES.has(lang);
}

export function normalizeConferenceSpeechLanguage(value, fallback = 'en') {
  const raw = String(value || '').trim().toLowerCase();
  const code = raw.slice(0, 2);
  if (SPEECH_LANG_CODES.has(code)) return code;
  const fb = String(fallback || 'en')
    .trim()
    .toLowerCase()
    .slice(0, 2);
  return SPEECH_LANG_CODES.has(fb) ? fb : 'en';
}
