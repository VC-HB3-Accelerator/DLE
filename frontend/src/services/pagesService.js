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