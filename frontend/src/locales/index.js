import { createI18n } from 'vue-i18n';
import ruBase from './ru.json';
import enBase from './en.json';
import settingsRu from './settings.ru.json';
import settingsEn from './settings.en.json';
import deployRu from './deploy.ru.json';
import deployEn from './deploy.en.json';
import elementPlusRu from 'element-plus/dist/locale/ru.mjs';
import elementPlusEn from 'element-plus/dist/locale/en.mjs';

function mergeLocale(base, settings, deploy) {
  return {
    ...base,
    settings: { ...(base.settings || {}), ...settings },
    deploy,
  };
}

const ru = mergeLocale(ruBase, settingsRu, deployRu);
const en = mergeLocale(enBase, settingsEn, deployEn);

const STORAGE_KEY = 'dle-ui-locale';
const STORAGE_EXPLICIT_KEY = 'dle-ui-locale-explicit';
const SUPPORTED = ['en', 'ru'];
const DEFAULT_LOCALE = 'en';

function hostnameOf(hostname) {
  return String(hostname || '').replace(/^www\./i, '').toLowerCase();
}

function isRuHost(hostname) {
  const host = hostnameOf(hostname);
  return host === 'ru' || host.startsWith('ru.');
}

function isLocalHost(hostname) {
  const host = hostnameOf(hostname);
  return host === 'localhost' || host === '127.0.0.1';
}

/** ru.example.com → ru; en.example.com и apex (hb3-accelerator.com) → en */
export function localeFromHostname(hostname) {
  if (isLocalHost(hostname)) {
    return localeFromEnv();
  }
  if (isRuHost(hostname)) {
    return 'ru';
  }
  return 'en';
}

function localeFromEnv() {
  const fromEnv = import.meta.env.VITE_DEFAULT_LOCALE;
  if (fromEnv && SUPPORTED.includes(fromEnv)) {
    return fromEnv;
  }
  return DEFAULT_LOCALE;
}

function resolveInitialLocale() {
  if (typeof window === 'undefined') {
    return localeFromEnv();
  }
  const host = window.location.hostname;
  if (isRuHost(host)) {
    return 'ru';
  }
  const hostDefault = localeFromHostname(host);
  const explicit = localStorage.getItem(STORAGE_EXPLICIT_KEY) === '1';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (explicit && stored && SUPPORTED.includes(stored)) {
    return stored;
  }
  return hostDefault;
}

export const i18n = createI18n({
  legacy: false,
  locale: resolveInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: { ru, en },
});

export const elementPlusLocales = {
  ru: elementPlusRu,
  en: elementPlusEn,
};

export function setAppLocale(locale, { explicit = false } = {}) {
  if (!SUPPORTED.includes(locale)) {
    return;
  }
  if (typeof window !== 'undefined' && isRuHost(window.location.hostname)) {
    locale = 'ru';
  }
  i18n.global.locale.value = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  if (explicit) {
    localStorage.setItem(STORAGE_EXPLICIT_KEY, '1');
  }
  document.documentElement.lang = locale;
}

export { STORAGE_KEY, SUPPORTED };
