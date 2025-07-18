import axios from 'axios';

export default {
  async getMessagesByUserId(userId) {
    if (!userId) return [];
    const { data } = await axios.get(`/messages?userId=${userId}`);
    return data;
  },
  async sendMessage({ conversationId, message, attachments = [], toUserId }) {
    const formData = new FormData();
    if (conversationId) formData.append('conversationId', conversationId);
    if (message) formData.append('message', message);
    if (toUserId) formData.append('toUserId', toUserId);
    attachments.forEach(file => {
      formData.append('attachments', file);
    });
    const { data } = await axios.post('/chat/message', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      withCredentials: true
    });
    return data;
  },
  async getMessagesByConversationId(conversationId) {
    if (!conversationId) return [];
    const { data } = await axios.get(`/messages?conversationId=${conversationId}`);
    return data;
  },
  async getConversationByUserId(userId) {
    if (!userId) return null;
    const { data } = await axios.get(`/messages/conversations?userId=${userId}`);
    return data;
  },
  async generateAiDraft(conversationId, messages, language = 'auto') {
    const { data } = await axios.post('/chat/ai-draft', { conversationId, messages, language });
    return data;
  },
  async broadcastMessage({ userId, message }) {
    const { data } = await axios.post('/messages/broadcast', {
      user_id: userId,
      content: message
    }, {
      withCredentials: true
    });
    return data;
  },
  async deleteMessagesHistory(userId) {
    const { data } = await axios.delete(`/messages/history/${userId}`, {
      withCredentials: true
    });
    return data;
  }
};

export async function getAllMessages() {
  const { data } = await axios.get('/messages');
  return data;
} 