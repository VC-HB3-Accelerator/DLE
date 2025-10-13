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
      const { data } = await axios.get('/users/read-contacts-status');
      readContacts.value = data || [];
    } catch (e) {
      readContacts.value = [];
    }
    updateNewContacts();
  }

  function updateNewContacts() {
    console.log('[useContactsWebSocket] updateNewContacts called');
    console.log('[useContactsWebSocket] contacts:', contacts.value.length);
    console.log('[useContactsWebSocket] readContacts:', readContacts.value);
    
    if (!contacts.value.length) {
      newContacts.value = [];
      console.log('[useContactsWebSocket] No contacts, newContacts cleared');
      return;
    }
    
    const beforeCount = newContacts.value.length;
    newContacts.value = contacts.value.filter(c => !readContacts.value.includes(String(c.id)));
    console.log('[useContactsWebSocket] newContacts updated:', beforeCount, '->', newContacts.value.length);
  }

  async function markContactAsRead(contactId) {
    try {
      console.log('[useContactsWebSocket] Marking contact as read:', contactId);
      const response = await axios.post('/users/mark-contact-read', { contactId });
      console.log('[useContactsWebSocket] Mark contact response:', response.data);
      
      // Приводим contactId к строке для совместимости с readContacts
      const contactIdStr = String(contactId);
      console.log('[useContactsWebSocket] Converting contactId to string:', contactId, '->', contactIdStr);
      
      if (!readContacts.value.includes(contactIdStr)) {
        readContacts.value.push(contactIdStr);
        updateNewContacts();
        console.log('[useContactsWebSocket] Contact marked as read, updated newContacts');
      } else {
        console.log('[useContactsWebSocket] Contact already marked as read:', contactIdStr);
      }
    } catch (e) {
      console.error('[useContactsWebSocket] Error marking contact as read:', e);
      console.error('[useContactsWebSocket] Error response:', e.response?.data);
    }
  }

  async function fetchReadStatus() {
    try {
      const { data } = await axios.get('/messages/read-status');
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
        await axios.post('/messages/mark-read', { userId, lastReadAt: maxDateISO });
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
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${wsProtocol}://${window.location.host}/ws`);
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

  function clearContactsData() {
    contacts.value = [];
    messages.value = [];
    readContacts.value = [];
    newContacts.value = [];
    newMessages.value = [];
    readUserIds.value = [];
    lastReadMessageDate.value = {};
  }

  // Централизованная подписка на изменения аутентификации
  onMounted(async () => {
    await fetchContactsReadStatus();
    await fetchContacts();
    await fetchReadStatus();
    await fetchMessages();
    setupWebSocket();
    
    // Подписываемся на централизованные события очистки и обновления данных
    window.addEventListener('clear-application-data', () => {
      console.log('[useContactsWebSocket] Clearing contacts data');
      clearContactsData(); // Очищаем данные при выходе из системы
    });
    
    window.addEventListener('refresh-application-data', () => {
      console.log('[useContactsWebSocket] Refreshing contacts data');
      fetchContacts(); // Обновляем данные при входе в систему
    });
  });
  onUnmounted(() => {
    if (ws) ws.close();
  });

  // Логика обновления данных централизована в useAuth.js через события

  return {
    contacts,
    newContacts,
    messages,
    newMessages,
    markContactAsRead,
    markMessagesAsRead,
    markMessagesAsReadForUser,
    readUserIds,
    fetchContacts,
    clearContactsData
  };
} 