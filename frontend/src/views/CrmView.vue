<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="crm-view-container">

      <div class="crm-contacts-block">
        <h2>Контакты</h2>
        <button class="details-btn" @click="goToContactsList">
          Подробнее
        </button>
      </div>
      <div class="crm-tables-block">
        <h2>Таблицы</h2>
        <button class="details-btn" @click="goToTables">
          Подробнее
        </button>
      </div>
      <!-- Новый блок Контент -->
      <div class="crm-content-block">
        <h2>Контент</h2>
        <button class="details-btn" @click="goToContent">
          Подробнее
        </button>
      </div>
      <!-- Новый блок Управление -->
      <div class="crm-management-block">
        <h2>Управление</h2>
        <button class="details-btn" @click="goToManagement">
          Подробнее
        </button>
      </div>
      <!-- Блок Веб3 приложение -->
      <div class="crm-web3-block">
        <h2>Веб3 приложение</h2>
        <button class="details-btn" @click="goToWeb3App">
          Подробнее
        </button>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, defineProps, defineEmits, computed, watch } from 'vue';
import { useAuthContext } from '../composables/useAuth';
import { useRouter } from 'vue-router';
import { setToStorage } from '../utils/storage';
import BaseLayout from '../components/BaseLayout.vue';
import eventBus from '../utils/eventBus';
import ContactTable from '../components/ContactTable.vue';
import contactsService from '../services/contactsService.js';
import { getAllDLEs } from '../services/dleV2Service.js';

// Определяем props
const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

// Определяем emits
const emit = defineEmits(['auth-action-completed']);

const auth = useAuthContext();
const router = useRouter();
const isLoading = ref(true);

// Подписываемся на централизованные события очистки и обновления данных
onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    console.log('[CrmView] Clearing CRM data');
    // Очищаем данные при выходе из системы
    contacts.value = [];
  });
  
  window.addEventListener('refresh-application-data', () => {
    console.log('[CrmView] Refreshing CRM data');
    loadContacts(); // Обновляем данные при входе в систему
  });
});
const dleList = ref([]);
const selectedDleIndex = ref(null);

const showDleManagement = ref(false);
const showContacts = ref(false);
const contacts = ref([]);
const isLoadingContacts = ref(false);
const selectedContact = ref(null);
const showContactDetails = ref(false);
const showTables = ref(false);

let ws = null;

function connectWebSocket() {
  if (ws) ws.close();
  const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${wsProtocol}://${window.location.host}/ws`);
  ws.onopen = () => {
    // console.log('[CRM] WebSocket соединение установлено');
  };
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'contacts-updated') {
        // console.log('[CRM] Получено событие contacts-updated, обновляем контакты');
        loadContacts();
      }
    } catch (e) {
      // console.error('[CRM] Ошибка обработки сообщения WebSocket:', e);
    }
  };
  ws.onclose = () => {
    // console.log('[CRM] WebSocket соединение закрыто');
  };
  ws.onerror = (e) => {
    // console.error('[CRM] WebSocket ошибка:', e);
  };
}

// Функция для перехода на домашнюю страницу и открытия боковой панели
const goToHomeAndShowSidebar = () => {
  router.push({ name: 'home' });
};

// Функция для перехода на страницу настроек блокчейна
const goToBlockchainSettings = () => {
  router.push({ name: 'settings-blockchain' });
};

// Загрузка списка DLE
const loadDLEs = async () => {
  isLoading.value = true;
  try {
    const result = await getAllDLEs();
    dleList.value = result || [];
    
    // Выбираем первый DLE, если есть
    if (dleList.value.length > 0) {
      selectedDleIndex.value = 0;
    }
  } catch (error) {
    // console.error('Ошибка при загрузке списка DLE:', error);
  } finally {
    isLoading.value = false;
  }
};

// Обработчик события изменения авторизации
const handleAuthEvent = (eventData) => {
  // console.log('[CrmView] Получено событие изменения авторизации:', eventData);
  if (eventData.isAuthenticated) {
    loadDLEs();
  }
};

// Регистрация и очистка обработчика событий
let unsubscribe = null;

onMounted(() => {
  // console.log('[CrmView] Компонент загружен');
  
  // Загружаем DLE для всех пользователей (авторизованных и неавторизованных)
  loadDLEs();
  
  // Подписка на события авторизации
  unsubscribe = eventBus.on('auth-state-changed', handleAuthEvent);
  
  connectWebSocket();
});

onBeforeUnmount(() => {
  // Отписка от события при удалении компонента
  if (unsubscribe) {
    unsubscribe();
  }
  
  if (ws) ws.close();
});

async function loadContacts() {
  isLoadingContacts.value = true;
  try {
    contacts.value = await contactsService.getContacts();
  } catch (e) {
    contacts.value = [];
    alert('Ошибка загрузки контактов');
  } finally {
    isLoadingContacts.value = false;
  }
}

watch(showContacts, (val) => {
  if (val) loadContacts();
});

function openContactDetails(contact) {
  selectedContact.value = contact;
  showContactDetails.value = true;
}

function onContactDeleted() {
  showContactDetails.value = false;
  loadContacts();
}

function goToTables() {
  router.push({ name: 'tables-list' });
}



function goToContactsList() {
  router.push({ name: 'contacts-list' });
}

function goToContent() {
  router.push({ name: 'content-list' });
}

function goToManagement() {
  router.push({ name: 'management' });
}

function goToWeb3App() {
  router.push({ name: 'vds-mock' });
}
</script>

<style scoped>
.crm-view-container {
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
  margin-bottom: 20px;
}

h1, h2, h3, h4 {
  color: var(--color-dark);
  margin-bottom: 16px;
}

p {
  line-height: 1.6;
  margin-bottom: 10px;
}

strong {
 color: var(--color-primary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 20px auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.details-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
  margin: 0;
}

.details-btn:hover {
  background: var(--color-primary-dark);
}

.details-btn-secondary {
  background: #6c757d;
}

.details-btn-secondary:hover {
  background: #5a6268;
}



.crm-contacts-block {
  margin: 32px 0 24px 0;
  padding: 24px;
  background: #f8fafc;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.crm-contacts-block h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
}
.crm-contacts-block .details-btn {
  margin-top: 0;
}

.crm-tables-block {
  margin: 32px 0 24px 0;
  padding: 24px;
  background: #f8fafc;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.crm-tables-block h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
}
.crm-tables-block .details-btn {
  margin-top: 0;
}

.crm-content-block {
  margin: 32px 0 24px 0;
  padding: 24px;
  background: #f8fafc;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.crm-content-block h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
}
.crm-content-block .details-btn {
  margin-top: 0;
}

.crm-management-block {
  margin: 32px 0 24px 0;
  padding: 24px;
  background: #f8fafc;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.crm-management-block h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
}
.crm-management-block .details-btn {
  margin-top: 0;
}

.crm-web3-block {
  margin: 32px 0 24px 0;
  padding: 24px;
  background: #f8fafc;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.crm-web3-block h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
}
.crm-web3-block .details-btn {
  margin-top: 0;
}
</style> 