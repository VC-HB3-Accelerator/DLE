import api from '../api/axios';

export default {
  async getPages() {
    const res = await api.get('/pages');
    return res.data;
  },
  async createPage(data) {
    const res = await api.post('/pages', data);
    return res.data;
  },
  async getPage(id) {
    const res = await api.get(`/pages/${id}`);
    return res.data;
  },
  async updatePage(id, data) {
    const res = await api.patch(`/pages/${id}`, data);
    return res.data;
  },
  async deletePage(id) {
    const res = await api.delete(`/pages/${id}`);
    return res.data;
  },
}; 