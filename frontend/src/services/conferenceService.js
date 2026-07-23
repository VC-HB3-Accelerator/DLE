/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

import api from '@/api/axios';

export default {
  async getContactSession(contactId) {
    const { data } = await api.get(`/conference/contact/${contactId}`, { withCredentials: true });
    return data;
  },
  async saveContactSession(contactId, payload) {
    const { data } = await api.put(`/conference/contact/${contactId}`, payload, { withCredentials: true });
    return data;
  },
  async getSession(id) {
    const { data } = await api.get(`/conference/${id}`, { withCredentials: true });
    return data;
  },
  async createMultiSession(userIds, payload = {}) {
    const { data } = await api.post(
      '/conference/multi',
      { userIds, ...payload },
      { withCredentials: true }
    );
    return data;
  },
  async listMultiSessions() {
    const { data } = await api.get('/conference/multi', { withCredentials: true });
    return data;
  },
  async updateSessionSettings(id, payload) {
    const { data } = await api.put(`/conference/${id}/settings`, payload, { withCredentials: true });
    return data;
  },
  async getAgentSettings() {
    const { data } = await api.get('/conference/ai-agent/settings', { withCredentials: true });
    return data;
  },
  async saveAgentSettings(payload) {
    const { data } = await api.put('/conference/ai-agent/settings', payload, { withCredentials: true });
    return data;
  },
  async getAgentModels(provider) {
    const { data } = await api.get('/conference/ai-agent/models', {
      withCredentials: true,
      params: provider ? { provider } : undefined
    });
    return data;
  },
  async getRagTables() {
    const { data } = await api.get('/conference/ai-agent/rag-tables', { withCredentials: true });
    return data;
  },
  async startSession(id) {
    const { data } = await api.post(`/conference/${id}/start`, {}, { withCredentials: true });
    return data;
  },
  async joinSession(id) {
    const { data } = await api.post(`/conference/${id}/join`, {}, { withCredentials: true });
    return data;
  },
  async endSession(id) {
    const sid = Number(id);
    if (!Number.isInteger(sid) || sid <= 0) {
      throw new Error('Некорректный id конференции');
    }
    const { data } = await api.post(`/conference/${sid}/end`, {}, { withCredentials: true });
    return data;
  },
  async sendMagicLink(id, payload = {}) {
    const { data } = await api.post(`/conference/${id}/magic-link`, payload, { withCredentials: true });
    return data;
  },
  async listParticipants(id) {
    const { data } = await api.get(`/conference/${id}/participants`, { withCredentials: true });
    return data;
  },
  async addParticipant(id, userId) {
    const { data } = await api.post(
      `/conference/${id}/participants`,
      { userId },
      { withCredentials: true }
    );
    return data;
  },
  async removeParticipant(id, userId) {
    const { data } = await api.delete(`/conference/${id}/participants/${userId}`, {
      withCredentials: true
    });
    return data;
  },
  async getSummary(id) {
    const { data } = await api.get(`/conference/${id}/summary`, { withCredentials: true });
    return data;
  },
  async consumeMagicLink(token) {
    const { data } = await api.post('/conference/magic/consume', { token }, { withCredentials: true });
    return data;
  },
  async getLive(id, { drain = false } = {}) {
    const { data } = await api.get(`/conference/${id}/live`, {
      params: drain ? { drain: 1 } : undefined,
      withCredentials: true
    });
    return data;
  },
  async createRealtimeSession(id) {
    const { data } = await api.post(`/conference/${id}/realtime/session`, {}, { withCredentials: true });
    return data;
  },
  async startAgent(id) {
    const { data } = await api.post(`/conference/${id}/agent/start`, {}, { withCredentials: true });
    return data;
  },
  async muteAgent(id, muted = true) {
    const { data } = await api.post(`/conference/${id}/agent/mute`, { muted }, { withCredentials: true });
    return data;
  },
  async sendCoach(id, text) {
    const { data } = await api.post(`/conference/${id}/coach`, { text }, { withCredentials: true });
    return data;
  },
  async searchDocs(id, query) {
    const { data } = await api.post(`/conference/${id}/tools/search_docs`, { query }, { withCredentials: true });
    return data;
  },
  async appendTranscript(id, payload) {
    const { data } = await api.post(`/conference/${id}/transcript`, payload, { withCredentials: true });
    return data;
  },
  async getLivekitToken(id) {
    const { data } = await api.post(`/conference/${id}/livekit/token`, {}, { withCredentials: true });
    return data;
  },
  async listMyInvites() {
    const { data } = await api.get('/conference/invites/mine', { withCredentials: true });
    return data;
  },
  async notifyMulti(id) {
    const { data } = await api.post(`/conference/${id}/notify`, {}, { withCredentials: true });
    return data;
  }
};
