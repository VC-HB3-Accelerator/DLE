/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

import api from '../api/axios';
import { i18n } from '@/locales/index.js';

const t = (key, params) => i18n.global.t(key, params);

const EMPTY_RESULT = {
  contacts: [],
  total: 0,
  limit: 1000,
  offset: 0,
  hasMore: false
};

function parseContactsResponse(res) {
  if (res.data && res.data.success) {
    return {
      contacts: res.data.contacts || [],
      total: res.data.total ?? 0,
      limit: res.data.limit ?? 1000,
      offset: res.data.offset ?? 0,
      hasMore: res.data.hasMore ?? false
    };
  }
  return { ...EMPTY_RESULT };
}

export default {
  async getContacts(params = {}) {
    const res = await api.get('/users', { params });
    return parseContactsResponse(res);
  },
  async updateContact(id, data) {
    const res = await api.patch(`/users/${id}`, data);
    return res.data;
  },
  async createContact(data) {
    const res = await api.post('/users/create', data);
    return res.data;
  },
  async deleteContact(id) {
    try {
      const res = await api.delete(`/users/${id}`);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        return { success: true, deleted: 0, message: t('contacts.deleteConfirm.alreadyDeleted') };
      }
      throw err;
    }
  },
  async getContactById(id) {
    const res = await api.get(`/users/${id}`);
    if (res.data && res.data.id) {
      return res.data;
    }
    return null;
  },
  async blockContact(id) {
    const res = await api.patch(`/users/${id}/block`);
    return res.data;
  },
  async unblockContact(id) {
    const res = await api.patch(`/users/${id}/unblock`);
    return res.data;
  },
  async addTagsToContact(contactId, tagIds) {
    const res = await api.patch(`/tags/user/${contactId}`, { tags: tagIds });
    return res.data;
  },
  async getContactTags(contactId) {
    const res = await api.get(`/tags/user/${contactId}`);
    return res.data.tags || [];
  },
  async removeTagFromContact(contactId, tagId) {
    const res = await api.delete(`/tags/user/${contactId}/tag/${tagId}`);
    return res.data;
  },
  async addTagsToContactsBulk(userIds = [], tagIds = []) {
    const res = await api.post('/tags/users/bulk-add', {
      userIds,
      tagIds
    });
    return res.data;
  },
  async removeTagsFromContactsBulk(userIds = [], tagIds = []) {
    const res = await api.post('/tags/users/bulk-remove', {
      userIds,
      tagIds
    });
    return res.data;
  }
};

export async function getContacts(params = {}) {
  const res = await api.get('/users', { params });
  return parseContactsResponse(res);
}
