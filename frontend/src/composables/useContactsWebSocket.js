import { ref, onMounted, onUnmounted } from 'vue';
import { getContacts } from '../services/contactsService';
import { getAllMessages } from '../services/messagesService';
import axios from 'axios';

export function useContactsAndMessagesWebSocket() {
  const contacts = ref([]);
  const messages = ref([]);
  const readContacts = ref([]); // id просмотренных контактов
  const newContacts = ref([]);
  const newMessages = ref([]);
  const readUserIds = ref([]);
  const lastReadMessageDate = ref({});
  let ws = null;
  let lastMessageDate = null;

  // Загружаем прочитанные userId из localStorage при инициализации
  try {
    const stored = localStorage.getItem('readUserIds');
    if (stored) {
      readUserIds.value = JSON.parse(stored);
    }
  } catch (e) {
    readUserIds.value = [];
  }

  // Загружаем lastReadMessageDate из localStorage при инициализации
  try {
    const stored = localStorage.getItem('lastReadMessageDate');
    if (stored) {
      lastReadMessageDate.value = JSON.parse(stored);
    }
  } catch (e) {
    lastReadMessageDate.value = {};
  }

  async function fetchContacts() {
    const all = await getContacts();
    contacts.value = all;
    updateNewContacts();
  }

  async function fetchContactsReadStatus() {
    try {
      const { data } = await axios.get('/api/users/read-contacts-status');
      readContacts.value = data || [];
    } catch (e) {
      readContacts.value = [];
    }
    updateNewContacts();
  }

  function updateNewContacts() {
    if (!contacts.value.length) {
      newContacts.value = [];
      return;
    }
    newContacts.value = contacts.value.filter(c => !readContacts.value.includes(c.id));
  }

  async function markContactAsRead(contactId) {
    try {
      await axios.post('/api/users/mark-contact-read', { contactId });
      if (!readContacts.value.includes(contactId)) {
        readContacts.value.push(contactId);
        updateNewContacts();
      }
    } catch (e) {}
  }

  async function fetchReadStatus() {
    try {
      const { data } = await axios.get('/api/messages/read-status');
      lastReadMessageDate.value = data || {};
    } catch (e) {
      lastReadMessageDate.value = {};
    }
  }

  async function fetchMessages() {
    const all = await getAllMessages();
    messages.value = all;
    filterNewMessages();
  }

  function markMessagesAsRead() {
    if (messages.value.length) {
      lastMessageDate = Math.max(...messages.value.map(m => new Date(m.created_at).getTime()));
      newMessages.value = [];
    }
  }

  async function markMessagesAsReadForUser(userId) {
    // Найти максимальный created_at для сообщений этого пользователя
    const userMessages = messages.value.filter(m => m.user_id === userId && m.sender_type === 'user');
    if (userMessages.length) {
      const maxDate = Math.max(...userMessages.map(m => new Date(m.created_at).getTime()));
      const maxDateISO = new Date(maxDate).toISOString();
      try {
        await axios.post('/api/messages/mark-read', { userId, lastReadAt: maxDateISO });
        lastReadMessageDate.value[userId] = maxDateISO;
      } catch (e) {}
    }
    filterNewMessages();
  }

  function filterNewMessages() {
    newMessages.value = messages.value.filter(m => {
      if (m.sender_type !== 'user') return false;
      const lastRead = lastReadMessageDate.value[m.user_id];
      if (!lastRead) return true;
      return new Date(m.created_at).getTime() > new Date(lastRead).getTime();
    });
  }

  function setupWebSocket() {
    ws = new WebSocket('ws://localhost:8000');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'contacts-updated') {
        fetchContacts();
      }
      if (data.type === 'messages-updated') {
        fetchMessages();
      }
    };
  }

  onMounted(async () => {
    await fetchContactsReadStatus();
    await fetchContacts();
    await fetchReadStatus();
    await fetchMessages();
    setupWebSocket();
  });
  onUnmounted(() => {
    if (ws) ws.close();
  });

  return {
    contacts,
    newContacts,
    messages,
    newMessages,
    markContactAsRead,
    markMessagesAsRead,
    markMessagesAsReadForUser,
    readUserIds
  };
} 