/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
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

export default {
  // Админские методы (требуют аутентификации и прав админа)
  async getPages() {
    const res = await api.get('/pages');
    return res.data;
  },
  async createPage(data, isFormData = false) {
    const config = isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined;
    const res = await api.post('/pages', data, config);
    return res.data;
  },
  async getPage(id) {
    const res = await api.get(`/pages/${id}`);
    return res.data;
  },
  async updatePage(id, data) {
    console.log('[pagesService] updatePage:', { id, data });
    try {
      const res = await api.patch(`/pages/${id}`, data);
      console.log('[pagesService] updatePage успешно:', res.data);
      return res.data;
    } catch (error) {
      console.error('[pagesService] updatePage ошибка:', error);
      console.error('[pagesService] updatePage ошибка response:', error.response?.data);
      throw error;
    }
  },
  async deletePage(id) {
    const res = await api.delete(`/pages/${id}`);
    return res.data;
  },
  
  // Публичные методы (доступны всем пользователям)
  async getPublicPages(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.category) queryParams.append('category', params.category);
    if (params.parent_id !== undefined) queryParams.append('parent_id', params.parent_id);
    if (params.search) queryParams.append('search', params.search);
    
    const url = `/pages/public/all${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const res = await api.get(url);
    console.log('[pagesService] getPublicPages response:', {
      status: res.status,
      dataLength: Array.isArray(res.data) ? res.data.length : 'not array',
      dataType: typeof res.data,
      firstItem: Array.isArray(res.data) && res.data.length > 0 ? res.data[0] : null
    });
    return res.data;
  },
  async getPublicPagesStructure() {
    const res = await api.get('/pages/public/structure');
    return res.data;
  },
  async getPublicPageNavigation(id) {
    const res = await api.get(`/pages/public/${id}/navigation`);
    return res.data;
  },
  async getInternalPages() {
    const res = await api.get('/pages/internal/all');
    return res.data;
  },
  async getPublicPage(id) {
    const res = await api.get(`/pages/public/${id}`);
    return res.data;
  },
  async getCategories() {
    const res = await api.get('/pages/categories');
    return res.data;
  },
  async createCategory(name, display_name, description, order_index) {
    const res = await api.post('/pages/categories', {
      name,
      display_name,
      description,
      order_index
    });
    return res.data;
  },
  async deleteCategory(name) {
    const res = await api.delete(`/pages/categories/${encodeURIComponent(name)}`);
    return res.data;
  },
}; 