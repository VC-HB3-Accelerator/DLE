/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

import api from '../api/axios';
import { setEnabledLocalesCache } from '../config/enabledLocalesCache';
import { setSidebarAuthMethodsCache } from '../config/sidebarAuthMethodsCache';
import { SUPPORTED } from '../locales';
import eventBus from '../utils/eventBus';

function applyLocalesFromData(data) {
  if (data?.locales) {
    setEnabledLocalesCache(data.locales);
  }
  if (data?.authMethods) {
    setSidebarAuthMethodsCache(data.authMethods);
  }
  eventBus.emit('sidebar-nav-saved', data);
  return data;
}

export async function fetchSidebarNav() {
  const response = await api.get('/settings/sidebar-nav');
  const data = response.data?.data || {
    buttons: { repositories: false },
    locales: [...SUPPORTED],
    authMethods: { wallet: true, telegram: false, email: false, password: false },
    knownButtons: ['repositories'],
    knownLocales: [...SUPPORTED],
    gitea: { state: 'unknown' },
  };
  return applyLocalesFromData(data);
}

export async function saveSidebarNav(buttons) {
  const response = await api.put('/settings/sidebar-nav', { buttons });
  return applyLocalesFromData(response.data?.data);
}

export async function saveSidebarLocales(locales) {
  const response = await api.put('/settings/sidebar-nav', { locales });
  return applyLocalesFromData(response.data?.data);
}

export async function saveSidebarAuthMethods(authMethods) {
  const response = await api.put('/settings/sidebar-nav', { authMethods });
  return applyLocalesFromData(response.data?.data);
}
