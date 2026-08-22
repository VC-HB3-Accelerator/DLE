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
const SUPPORTED = ['en', 'ru'];
const DEFAULT_LOCALE = 'en';

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
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED.includes(stored)) {
    return stored;
  }
  return localeFromEnv();
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

export function setAppLocale(locale) {
  if (!SUPPORTED.includes(locale)) {
    return;
  }
  i18n.global.locale.value = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = locale;
}

export { STORAGE_KEY, SUPPORTED };
