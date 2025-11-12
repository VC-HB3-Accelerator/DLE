/**
 * Сервис для работы с системными сообщениями
 */

import api from '../api/axios';

const BASE_URL = '/system-messages';

export default {
  async getSystemMessages(params = {}) {
    const response = await api.get(BASE_URL, { params });
    return response.data;
  },

  async getPublishedSystemMessages(params = {}) {
    const response = await api.get(`${BASE_URL}/published`, { params });
    return response.data;
  },

  async getSystemMessage(id) {
    const response = await api.get(`${BASE_URL}/${id}`);
    return response.data;
  },

  async createSystemMessage(payload) {
    const response = await api.post(BASE_URL, payload);
    return response.data;
  },

  async updateSystemMessage(id, payload) {
    const response = await api.patch(`${BASE_URL}/${id}`, payload);
    return response.data;
  },

  async deleteSystemMessage(id) {
    const response = await api.delete(`${BASE_URL}/${id}`);
    return response.data;
  },

  async bulkPublish(ids) {
    const response = await api.post(`${BASE_URL}/bulk/publish`, { ids });
    return response.data;
  },

  async bulkUnpublish(ids) {
    const response = await api.post(`${BASE_URL}/bulk/unpublish`, { ids });
    return response.data;
  },

  async bulkDelete(ids) {
    const response = await api.post(`${BASE_URL}/bulk/delete`, { ids });
    return response.data;
  }
};

