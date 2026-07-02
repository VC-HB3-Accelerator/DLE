import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { setAppLocale, SUPPORTED } from '../locales';

export function useLocale() {
  const { locale, t } = useI18n();

  const currentLocale = computed(() => locale.value);

  function setLocale(next) {
    if (SUPPORTED.includes(next)) {
      setAppLocale(next);
    }
  }

  function toggleLocale() {
    setLocale(locale.value === 'ru' ? 'en' : 'ru');
  }

  return {
    currentLocale,
    setLocale,
    toggleLocale,
    t,
  };
}
