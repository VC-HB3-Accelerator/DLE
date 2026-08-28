/**
 * Крестик закрытия страницы в Header (рядом с бургером).
 * Источники: route.meta.closeFallback и стек регистраций из PageCloseButton.
 */
import { computed, ref, unref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

/**
 * @typedef {{
 *   id: symbol,
 *   fallback?: string|object|null,
 *   onNavigate?: Function|null,
 *   preferBack?: boolean,
 *   onClose?: Function|null,
 * }} PageCloseEntry
 */

/** @type {import('vue').Ref<PageCloseEntry[]>} */
const stack = ref([]);

function resolveMetaTarget(metaValue) {
  if (metaValue == null || metaValue === '') return null;
  if (typeof metaValue === 'string' && !metaValue.startsWith('/')) {
    return { name: metaValue };
  }
  return metaValue;
}

function hasHistoryBack() {
  try {
    const state = window.history.state;
    if (state && state.back != null) return true;
  } catch {
    /* ignore */
  }
  return window.history.length > 1;
}

export function usePageClose() {
  const route = useRoute();
  const router = useRouter();

  const metaFallback = computed(() => {
    return resolveMetaTarget(route.meta?.closeFallback);
  });

  const active = computed(() => {
    const list = stack.value;
    return list.length ? list[list.length - 1] : null;
  });

  const showClose = computed(() => {
    if (active.value) return true;
    return metaFallback.value != null;
  });

  /**
   * @param {Omit<PageCloseEntry, 'id'>} config
   * @returns {() => void} unregister
   */
  function registerPageClose(config) {
    const id = Symbol('page-close');
    stack.value = [...stack.value, { id, ...config }];
    return () => {
      stack.value = stack.value.filter((entry) => entry.id !== id);
    };
  }

  function goFallback(target) {
    const dest = target != null && target !== '' ? target : '/';
    router.push(unref(dest));
  }

  function closePage() {
    const cfg = active.value;
    if (typeof cfg?.onClose === 'function') {
      cfg.onClose();
    }
    if (typeof cfg?.onNavigate === 'function') {
      cfg.onNavigate();
      return;
    }
    if (cfg?.preferBack && hasHistoryBack()) {
      router.back();
      return;
    }
    if (cfg?.fallback != null && cfg.fallback !== '') {
      goFallback(cfg.fallback);
      return;
    }
    if (metaFallback.value != null) {
      goFallback(metaFallback.value);
      return;
    }
    goFallback('/');
  }

  return {
    showClose,
    closePage,
    registerPageClose,
    metaFallback,
  };
}
