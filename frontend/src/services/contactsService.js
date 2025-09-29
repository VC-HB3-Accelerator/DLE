/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/HB3-ACCELERATOR
 */

import api from '../api/axios';

export default {
  async getContacts() {
    const res = await api.get('/users');
    if (res.data && res.data.success) {
      return res.data.contacts;
    }
    return [];
  },
  async updateContact(id, data) {
    const res = await api.patch(`/users/${id}`, data);
    return res.data;
  },
  async deleteContact(id) {
    try {
      const res = await api.delete(`/users/${id}`);
      // console.log('Ответ на удаление контакта:', res.status, res.data);
      return res.data;
    } catch (err) {
              // console.error('Ошибка при удалении контакта:', err.response?.status, err.response?.data, err);
      
      // Если пользователь уже удален (404), считаем это успехом
      if (err.response?.status === 404) {
        return { success: true, deleted: 0, message: 'Пользователь уже удален' };
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
  // --- Работа с тегами пользователя ---
  async addTagsToContact(contactId, tagIds) {
  // PATCH /tags/user/:id { tags: [...] }
  const res = await api.patch(`/tags/user/${contactId}`, { tags: tagIds });
  return res.data;
},
async getContactTags(contactId) {
  // GET /tags/user/:id
  const res = await api.get(`/tags/user/${contactId}`);
  return res.data.tags || [];
},
async removeTagFromContact(contactId, tagId) {
  // DELETE /tags/user/:id/tag/:tagId
  const res = await api.delete(`/tags/user/${contactId}/tag/${tagId}`);
  return res.data;
}
};

export async function getContacts() {
  const res = await fetch('/users');
  const data = await res.json();
  if (data && data.success) {
    return data.contacts;
  }
  return [];
} 