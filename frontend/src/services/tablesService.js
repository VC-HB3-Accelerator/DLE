import api from '../api/axios';

const tablesApi = '/tables';

export default {
  async getTables() {
    const res = await api.get(`${tablesApi}?_t=${Date.now()}`);
    return res.data;
  },
  async createTable(data) {
    const res = await api.post(tablesApi, data);
    return res.data;
  },
  async getTable(id) {
    const res = await api.get(`${tablesApi}/${id}`);
    return res.data;
  },
  async addColumn(tableId, data) {
    const res = await api.post(`${tablesApi}/${tableId}/columns`, data);
    return res.data;
  },
  async addRow(tableId) {
    const res = await api.post(`${tablesApi}/${tableId}/rows`);
    return res.data;
  },
  async saveCell(data) {
    const res = await api.post(`${tablesApi}/cell`, data);
    return res.data;
  },
  async deleteColumn(columnId) {
    const res = await api.delete(`${tablesApi}/column/${columnId}`);
    return res.data;
  },
  async deleteRow(rowId) {
    const res = await api.delete(`${tablesApi}/row/${rowId}`);
    return res.data;
  },
  async updateColumn(columnId, data) {
    const res = await api.patch(`${tablesApi}/column/${columnId}`, data);
    return res.data;
  },
  async updateTable(id, data) {
    const res = await api.patch(`${tablesApi}/${id}`, data);
    return res.data;
  },
  async deleteTable(id) {
    console.log('tablesService.deleteTable called with id:', id);
    try {
      const res = await api.delete(`${tablesApi}/${id}`);
      console.log('Delete response:', res.data);
      return res.data;
    } catch (error) {
      console.error('Error in deleteTable service:', error);
      throw error;
    }
  }
}; 