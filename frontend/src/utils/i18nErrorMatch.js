import { i18n } from '@/locales/index.js';

/**
 * Check if an error message matches any locale variant of an i18n key.
 */
export function errorMessageMatches(message, key) {
  if (message == null || message === '') return false;
  const msg = String(message).toLowerCase();
  for (const locale of i18n.global.availableLocales) {
    const text = String(i18n.global.t(key, {}, { locale })).toLowerCase();
    if (!text) continue;
    if (msg.includes(text)) return true;
    const snippet = text.split(/[.!?\n]/)[0]?.trim();
    if (snippet && snippet.length >= 5 && msg.includes(snippet)) return true;
  }
  return false;
}

export function errorMessageMatchesAny(message, keys) {
  return keys.some((key) => errorMessageMatches(message, key));
}
