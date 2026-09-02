/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

import api from '../api/axios';

export async function fetchUpdatesStatus() {
  const response = await api.get('/updates/status');
  return response.data?.data || {};
}

export async function fetchLatestUpdate() {
  try {
    const response = await api.get('/updates/latest');
    return response.data?.data || null;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/** Скачать pack в папку приложения и запустить update.sh на этом инстансе. */
export async function applyUpdateHere({ dleContract, fromVersion }) {
  const response = await api.post('/updates/apply-here', { dleContract, fromVersion });
  return response.data?.data;
}

export async function fetchApplyJob(jobId) {
  const response = await api.get(`/updates/apply-here/${encodeURIComponent(jobId)}`, {
    timeout: 8000,
  });
  return response.data?.data;
}

/** Короткий ping, пока backend/nginx поднимаются после recreate. */
export async function fetchInstanceHealth(timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('/api/health', {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return false;
    const type = response.headers.get('content-type') || '';
    if (!type.includes('application/json')) return false;
    const data = await response.json();
    return data?.status === 'ok' || data?.status === 'warning';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchHubSettings() {
  const response = await api.get('/updates/admin/hub-settings');
  return response.data?.data || {};
}

export async function saveHubSettings(payload) {
  const response = await api.put('/updates/admin/hub-settings', payload);
  return response.data?.data || {};
}
