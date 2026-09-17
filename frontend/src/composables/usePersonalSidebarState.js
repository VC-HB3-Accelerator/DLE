/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Singleton: личный сайдбар один на приложение (не внутри каждого BaseLayout).
 * Иначе при смене роута монтируется второй сайдбар поверх первого.
 */

import { ref, watch } from 'vue';
import { getFromStorage, setToStorage } from '@/utils/storage';

const showPersonalSidebar = ref(false);
let hydrated = false;

function hydrateOnce() {
  if (hydrated) return;
  hydrated = true;
  const saved = getFromStorage('showPersonalSidebar');
  showPersonalSidebar.value = saved !== null ? Boolean(saved) : false;
  watch(showPersonalSidebar, (open) => {
    setToStorage('showPersonalSidebar', open);
  });
}

export function usePersonalSidebarState() {
  hydrateOnce();

  function togglePersonalSidebar() {
    showPersonalSidebar.value = !showPersonalSidebar.value;
  }

  function setPersonalSidebarOpen(open) {
    const next = Boolean(open);
    showPersonalSidebar.value = next;
    // Синхронно в storage: при logout идёт location.replace до flush watch
    setToStorage('showPersonalSidebar', next);
  }

  return {
    showPersonalSidebar,
    togglePersonalSidebar,
    setPersonalSidebarOpen,
  };
}
