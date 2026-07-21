import { computed, ref, onMounted } from 'vue';

export const CONTACT_TABLE_COLUMNS = [
  { key: 'id', labelKey: 'contacts.id', defaultVisible: true },
  { key: 'type', labelKey: 'contacts.type', defaultVisible: true },
  { key: 'name', labelKey: 'contacts.name', defaultVisible: true },
  { key: 'email', labelKey: 'contacts.email', defaultVisible: true },
  { key: 'telegram', labelKey: 'contacts.telegram', defaultVisible: true },
  { key: 'wallet', labelKey: 'contacts.wallet', defaultVisible: true },
  { key: 'date', labelKey: 'contacts.createdAt', defaultVisible: true },
  { key: 'tags', labelKey: 'contacts.tags', defaultVisible: false },
  { key: 'blocked', labelKey: 'contacts.blocked', defaultVisible: false },
  { key: 'languages', labelKey: 'contacts.languages', defaultVisible: false },
  { key: 'lastMessageAt', labelKey: 'contacts.lastMessageAt', defaultVisible: false },
  { key: 'comment', labelKey: 'contacts.comment', defaultVisible: true },
  { key: 'link', labelKey: 'contacts.link', defaultVisible: true },
  { key: 'file', labelKey: 'contacts.file', defaultVisible: true }
];

const STORAGE_KEY = 'contact-table-visible-columns';

function getDefaultVisibleKeys() {
  return CONTACT_TABLE_COLUMNS
    .filter((column) => column.defaultVisible)
    .map((column) => column.key);
}

export function useContactTableColumns() {
  const visibleColumnKeys = ref(getDefaultVisibleKeys());

  function loadVisibleColumns() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return;

      const allowed = new Set(CONTACT_TABLE_COLUMNS.map((column) => column.key));
      const filtered = parsed.filter((key) => allowed.has(key));
      if (filtered.length) {
        visibleColumnKeys.value = filtered;
      }
    } catch {
      visibleColumnKeys.value = getDefaultVisibleKeys();
    }
  }

  function saveVisibleColumns() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumnKeys.value));
    } catch {
      // ignore quota errors
    }
  }

  function resetVisibleColumns() {
    visibleColumnKeys.value = getDefaultVisibleKeys();
    saveVisibleColumns();
  }

  function isColumnVisible(key) {
    return visibleColumnKeys.value.includes(key);
  }

  const visibleColumns = computed(() => (
    CONTACT_TABLE_COLUMNS.filter((column) => visibleColumnKeys.value.includes(column.key))
  ));

  const toggleableColumns = computed(() => CONTACT_TABLE_COLUMNS);

  const visibleColumnCount = computed(() => visibleColumnKeys.value.length);

  onMounted(loadVisibleColumns);

  return {
    visibleColumnKeys,
    visibleColumns,
    toggleableColumns,
    visibleColumnCount,
    isColumnVisible,
    saveVisibleColumns,
    resetVisibleColumns
  };
}
