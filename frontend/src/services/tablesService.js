import axios from 'axios';

const api = '/api/tables';

export default {
  async getTables() {
    const res = await axios.get(`${api}?_t=${Date.now()}`);
    return res.data;
  },
  async createTable(data) {
    const res = await axios.post(api, data);
    return res.data;
  },
  async getTable(id) {
    const res = await axios.get(`${api}/${id}`);
    return res.data;
  },
  async addColumn(tableId, data) {
    const res = await axios.post(`${api}/${tableId}/columns`, data);
    return res.data;
  },
  async addRow(tableId) {
    const res = await axios.post(`${api}/${tableId}/rows`);
    return res.data;
  },
  async saveCell(data) {
    const res = await axios.post(`${api}/cell`, data);
    return res.data;
  },
  async deleteColumn(columnId) {
    const res = await axios.delete(`${api}/column/${columnId}`);
    return res.data;
  },
  async deleteRow(rowId) {
    const res = await axios.delete(`${api}/row/${rowId}`);
    return res.data;
  },
  async updateColumn(columnId, data) {
    const res = await axios.patch(`${api}/column/${columnId}`, data);
    return res.data;
  },
  async updateTable(id, data) {
    const res = await axios.patch(`${api}/${id}`, data);
    return res.data;
  },
  async deleteTable(id) {
    console.log('tablesService.deleteTable called with id:', id);
    try {
      const res = await axios.delete(`${api}/${id}`);
      console.log('Delete response:', res.data);
      return res.data;
    } catch (error) {
      console.error('Error in deleteTable service:', error);
      throw error;
    }
  }
}; 