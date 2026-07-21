/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

import api from '../api/axios';

export default {
  async getSettings() {
    const { data } = await api.get('/contact-site-parser/settings', { withCredentials: true });
    return data;
  },
  async saveSettings(payload = {}) {
    const { data } = await api.put('/contact-site-parser/settings', payload, { withCredentials: true });
    return data;
  },
  async getModels(provider) {
    const { data } = await api.get('/contact-site-parser/models', {
      params: provider ? { provider } : undefined,
      withCredentials: true
    });
    return data;
  },
  async startJob({ userIds, force = true } = {}) {
    const { data } = await api.post('/contact-site-parser/jobs', { userIds, force }, { withCredentials: true });
    return data;
  },
  async listJobs({ limit = 20 } = {}) {
    const { data } = await api.get('/contact-site-parser/jobs', {
      params: { limit, _ts: Date.now() },
      withCredentials: true,
      headers: { 'Cache-Control': 'no-cache' }
    });
    return data;
  },
  async getJob(jobId) {
    const { data } = await api.get(`/contact-site-parser/jobs/${jobId}`, {
      params: { _ts: Date.now() },
      withCredentials: true,
      headers: { 'Cache-Control': 'no-cache' }
    });
    return data;
  }
};
