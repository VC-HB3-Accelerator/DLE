import { i18n } from '@/locales/index.js';

/** System table identifiers are stored in DB using the Russian canonical locale. */
const TAGS_TABLE_LOCALE = 'ru';

export function getClientTagsTableMeta() {
  const t = (key) => i18n.global.t(`contacts.tagsTable.${key}`, {}, { locale: TAGS_TABLE_LOCALE });
  return {
    name: t('name'),
    description: t('description'),
    columnName: t('columnName'),
    columnDescription: t('columnDescription'),
  };
}
