import api from '../api/axios';

export default {
  async getContacts() {
    const res = await api.get('/api/users');
    if (res.data && res.data.success) {
      return res.data.contacts;
    }
    return [];
  }
}; 