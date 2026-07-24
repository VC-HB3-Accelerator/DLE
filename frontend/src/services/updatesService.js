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
  const response = await api.get(`/updates/apply-here/${encodeURIComponent(jobId)}`);
  return response.data?.data;
}

export async function fetchHubSettings() {
  const response = await api.get('/updates/admin/hub-settings');
  return response.data?.data || {};
}

export async function saveHubSettings(payload) {
  const response = await api.put('/updates/admin/hub-settings', payload);
  return response.data?.data || {};
}
