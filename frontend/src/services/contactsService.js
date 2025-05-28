import api from '../api/axios';

export default {
  async getContacts() {
    const res = await api.get('/api/users');
    if (res.data && res.data.success) {
      return res.data.contacts;
    }
    return [];
  },
  async updateContact(id, data) {
    const res = await api.patch(`/api/users/${id}`, data);
    return res.data;
  },
  async deleteContact(id) {
    const res = await api.delete(`/api/users/${id}`);
    return res.data;
  }
}; 