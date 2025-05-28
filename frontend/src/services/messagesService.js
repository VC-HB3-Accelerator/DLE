import axios from 'axios';

export default {
  async getMessagesByUserId(userId) {
    if (!userId) return [];
    const { data } = await axios.get(`/api/messages?userId=${userId}`);
    return data;
  }
}; 