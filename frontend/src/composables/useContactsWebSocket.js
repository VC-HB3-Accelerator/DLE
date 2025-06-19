import { ref, onMounted, onUnmounted } from 'vue';
import { getContacts } from '../services/contactsService';
import { getAllMessages } from '../services/messagesService';

export function useContactsAndMessagesWebSocket() {
  const contacts = ref([]);
  const messages = ref([]);
  const newContacts = ref([]);
  const newMessages = ref([]);
  let ws = null;
  let lastContactId = null;
  let lastMessageId = null;

  async function fetchContacts() {
    const all = await getContacts();
    contacts.value = all;
    if (lastContactId) {
      newContacts.value = all.filter(c => c.id > lastContactId);
    } else {
      newContacts.value = [];
    }
    if (all.length) lastContactId = Math.max(...all.map(c => c.id));
  }

  async function fetchMessages() {
    const all = await getAllMessages();
    messages.value = all;
    if (lastMessageId) {
      newMessages.value = all.filter(m => m.id > lastMessageId);
    } else {
      newMessages.value = [];
    }
    if (all.length) lastMessageId = Math.max(...all.map(m => m.id));
  }

  onMounted(() => {
    fetchContacts();
    fetchMessages();
    ws = new WebSocket('ws://localhost:8000');
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'contacts-updated') fetchContacts();
        if (data.type === 'messages-updated') fetchMessages();
      } catch (e) {}
    };
  });

  onUnmounted(() => { if (ws) ws.close(); });

  function markContactsAsRead() { newContacts.value = []; }
  function markMessagesAsRead() { newMessages.value = []; }

  return { contacts, messages, newContacts, newMessages, markContactsAsRead, markMessagesAsRead };
} 