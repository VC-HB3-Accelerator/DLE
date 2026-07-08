import { i18n } from '@/locales/index.js';
import tablesService from '@/services/tablesService';

/**
 * Системная таблица «Теги клиентов» — не привязана к числовому ID.
 * На разных инсталляциях это может быть таблица #3, #14 и т.д.
 * Идентификация: каноническое имя/описание/структура (колонка userTags).
 */
const TAGS_TABLE_LOCALE = 'ru';
const LEGACY_TAGS_VALUE_COLUMN = 'Список тегов';

export function getClientTagsTableMeta() {
  const t = (key) => i18n.global.t(`contacts.tagsTable.${key}`, {}, { locale: TAGS_TABLE_LOCALE });
  return {
    name: t('name'),
    description: t('description'),
    columnName: t('columnName'),
    columnDescription: t('columnDescription'),
  };
}

function getKnownSystemTableNames() {
  const meta = getClientTagsTableMeta();
  const enName = i18n.global.t('contacts.tagsTable.name', {}, { locale: 'en' });
  return [...new Set([meta.name, enName].filter(Boolean))];
}

function getCellValue(cellValues, rowId, columnId) {
  return cellValues.find(cell => cell.row_id === rowId && cell.column_id === columnId)?.value || '';
}

function getTagNameColumns(columns, tagsMeta) {
  const ordered = [];
  const pushUnique = (col) => {
    if (col && !ordered.some(item => item.id === col.id)) {
      ordered.push(col);
    }
  };

  pushUnique(columns.find(col => col.name === tagsMeta.columnName));
  pushUnique(columns.find(col => col.options?.purpose === 'userTags'));
  pushUnique(columns.find(col => col.name === LEGACY_TAGS_VALUE_COLUMN));
  columns.forEach(col => {
    if (col.type === 'text') pushUnique(col);
  });

  return ordered;
}

function getTagDescriptionColumn(columns, tagsMeta, nameColumns) {
  const usedIds = new Set(nameColumns.map(col => col.id));
  const descCol = columns.find(col => col.name === tagsMeta.columnDescription);
  if (descCol && !usedIds.has(descCol.id)) {
    return descCol;
  }
  return columns.find(col => !usedIds.has(col.id) && col.type === 'text') || null;
}

/**
 * Находит системную таблицу тегов в списке таблиц (без запроса по ID).
 */
export function findClientTagsTableInList(tables = []) {
  const meta = getClientTagsTableMeta();
  const knownNames = getKnownSystemTableNames();

  const byName = tables.find(table => knownNames.includes(table.name));
  if (byName) {
    return byName;
  }

  if (meta.description) {
    const byDescription = tables.find(table => table.description === meta.description);
    if (byDescription) {
      return byDescription;
    }
  }

  return null;
}

function parseTagsFromTable(table) {
  const tagsMeta = getClientTagsTableMeta();
  const nameColumns = getTagNameColumns(table.columns || [], tagsMeta);
  const descColumn = getTagDescriptionColumn(table.columns || [], tagsMeta, nameColumns);

  if (!nameColumns.length) {
    return [];
  }

  return (table.rows || [])
    .map(row => {
      let name = '';
      for (const col of nameColumns) {
        const value = String(getCellValue(table.cellValues, row.id, col.id)).trim();
        if (value) {
          name = value;
          break;
        }
      }

      const description = descColumn
        ? String(getCellValue(table.cellValues, row.id, descColumn.id)).trim()
        : '';

      return {
        id: row.id,
        name,
        description
      };
    })
    .filter(tag => tag.name);
}

/**
 * Возвращает ID системной таблицы тегов.
 * 1) Явный override через VITE_CLIENT_TAGS_TABLE_ID (только если задан в env)
 * 2) Поиск по системному имени «Теги клиентов»
 * 3) Поиск по описанию справочника
 */
export async function resolveClientTagsTableId() {
  const rawEnvId = import.meta.env.VITE_CLIENT_TAGS_TABLE_ID;
  if (rawEnvId !== undefined && rawEnvId !== '') {
    const envId = Number(rawEnvId);
    if (Number.isInteger(envId) && envId > 0) {
      try {
        const table = await tablesService.getTable(envId);
        if (table?.rows) {
          return envId;
        }
      } catch (error) {
        console.warn('[clientTagsTable] VITE_CLIENT_TAGS_TABLE_ID не найден:', envId, error);
      }
    }
  }

  const tables = await tablesService.getTables();
  const systemTable = findClientTagsTableInList(tables);
  return systemTable?.id ?? null;
}

export async function loadClientTagsList() {
  const tableId = await resolveClientTagsTableId();
  if (!tableId) {
    console.warn('[clientTagsTable] Системная таблица тегов не найдена');
    return [];
  }

  const table = await tablesService.getTable(tableId);
  return parseTagsFromTable(table);
}
