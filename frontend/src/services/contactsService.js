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
      console.log('Ответ на удаление контакта:', res.status, res.data);
      return res.data;
    } catch (err) {
      console.error('Ошибка при удалении контакта:', err.response?.status, err.response?.data, err);
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
  }
}; 

export async function getContacts() {
  const res = await fetch('/api/users');
  const data = await res.json();
  if (data && data.success) {
    return data.contacts;
  }
  return [];
} 