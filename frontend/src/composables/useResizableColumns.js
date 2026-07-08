import { ref, onMounted, onUnmounted } from 'vue';

const MIN_COLUMN_WIDTH = 48;

export function useResizableColumns(storageKey, defaultWidths) {
  const colWidths = ref({ ...defaultWidths });
  const isResizing = ref(false);

  let resizing = null;

  function loadWidths() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      colWidths.value = { ...defaultWidths, ...parsed };
    } catch {
      colWidths.value = { ...defaultWidths };
    }
  }

  function saveWidths() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(colWidths.value));
    } catch {
      // ignore quota errors
    }
  }

  function stopResize() {
    if (!resizing) return;
    resizing = null;
    isResizing.value = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', stopResize);
    saveWidths();
  }

  function onMouseMove(event) {
    if (!resizing) return;
    const delta = event.clientX - resizing.startX;
    const nextWidth = Math.max(MIN_COLUMN_WIDTH, resizing.startWidth + delta);
    colWidths.value = {
      ...colWidths.value,
      [resizing.key]: nextWidth
    };
  }

  function startResize(key, event) {
    event.preventDefault();
    event.stopPropagation();
    stopResize();

    resizing = {
      key,
      startX: event.clientX,
      startWidth: colWidths.value[key] ?? defaultWidths[key] ?? MIN_COLUMN_WIDTH
    };
    isResizing.value = true;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', stopResize);
  }

  function resetWidths() {
    colWidths.value = { ...defaultWidths };
    saveWidths();
  }

  function columnWidthStyle(key) {
    const width = colWidths.value[key] ?? defaultWidths[key];
    return { width: `${width}px` };
  }

  onMounted(loadWidths);
  onUnmounted(stopResize);

  return {
    colWidths,
    isResizing,
    startResize,
    resetWidths,
    columnWidthStyle
  };
}
