/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */
import api from '@/api/axios';

const legalPacksService = {
  async list() {
    const res = await api.get('/legal-packs');
    return res.data;
  },
  async getByJurisdiction(numeric) {
    const res = await api.get(`/legal-packs/by-jurisdiction/${encodeURIComponent(numeric)}`);
    return res.data;
  },
  async get(packId) {
    const res = await api.get(`/legal-packs/${encodeURIComponent(packId)}`);
    return res.data;
  },
  async generate(packId, payload) {
    const res = await api.post(`/legal-packs/${encodeURIComponent(packId)}/generate`, payload);
    return res.data;
  },
  async getOperatorSettings() {
    const res = await api.get('/legal-packs/operator-settings');
    return res.data;
  },
  async saveOperatorSettings(payload) {
    const res = await api.put('/legal-packs/operator-settings', payload);
    return res.data;
  },
  async getActivePack() {
    const res = await api.get('/legal-packs/active');
    return res.data;
  },
};

export default legalPacksService;
