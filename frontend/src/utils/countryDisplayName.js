/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Название страны для UI: в JSON только русские title.
 * Для английского интерфейса — Intl по ISO 3166-1 alpha-2.
 */

export function countryDisplayName(country, locale) {
  if (!country) return '';
  const lang = String(locale || '').toLowerCase().startsWith('en') ? 'en' : 'ru';
  const code = String(country.code || '').toUpperCase();
  if (lang === 'en' && /^[A-Z]{2}$/.test(code)) {
    try {
      const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
      if (name) return name;
    } catch {
      /* fallback to JSON title */
    }
  }
  return country.title || code;
}
