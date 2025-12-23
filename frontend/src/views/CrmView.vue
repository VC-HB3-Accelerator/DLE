<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="crm-management">
      <!-- Блоки CRM -->
      <div class="management-blocks">
        <!-- Столбец 1 -->
        <div class="blocks-column">
          <div class="management-block">
            <h3>Контакты</h3>
            <p>Управление контактной базой, клиентами и партнерами</p>
            <button class="details-btn" @click="goToContactsList">
              Подробнее
            </button>
          </div>
          
          <div class="management-block">
            <h3>Таблицы</h3>
            <p>Создание и управление таблицами данных</p>
            <button class="details-btn" @click="goToTables">Подробнее</button>
          </div>
        </div>

        <!-- Столбец 2 -->
        <div class="blocks-column">
          <div class="management-block">
            <h3>Контент</h3>
            <p>Управление контентом, страницами и публикациями</p>
            <button class="details-btn" @click="goToContent">Подробнее</button>
          </div>
          
          <div class="management-block">
            <h3>Управление</h3>
            <p>Администрирование системы и настройки</p>
            <button class="details-btn" @click="goToManagement">Подробнее</button>
          </div>
        </div>

        <!-- Столбец 3 -->
        <div class="blocks-column">
          <div class="management-block">
            <h3>VDS Сервер</h3>
            <p>Настройки и управление</p>
            <button class="details-btn" @click="goToWeb3App">Подробнее</button>
          </div>
          
          <div class="management-block">
            <h3>Группы</h3>
            <p>Создание и управление</p>
            <button class="details-btn" @click="goToAcceleratorRegistration">Подробнее</button>
          </div>
        </div>
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
  router.push({ name: 'vds-management' });
}

function goToAcceleratorRegistration() {
  router.push({ name: 'groups' });
}
</script>

<style scoped>
.crm-management {
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  min-height: 100vh;
}

.management-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e9ecef;
}

.header-content h1 {
  margin: 0;
  color: var(--color-primary);
  font-size: 2rem;
  font-weight: 700;
}

.crm-description {
  margin: 0.5rem 0 0 0;
  color: #666;
  font-size: 1.1rem;
}

.management-blocks {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}

.blocks-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: stretch;
}

.management-block {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 250px;
}

.management-block:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
  border-color: var(--color-primary);
}

.management-block h3 {
  margin: 0 0 1rem 0;
  color: var(--color-primary);
  font-size: 1.5rem;
  font-weight: 600;
  flex-shrink: 0;
}

.management-block p {
  margin: 0 0 1.5rem 0;
  color: #666;
  font-size: 1rem;
  line-height: 1.5;
  flex-grow: 1;
}

.details-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.2s;
  min-width: 120px;
  flex-shrink: 0;
  margin-top: auto;
}

.details-btn:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

/* Адаптивность */
@media (max-width: 1024px) {
  .management-blocks {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .management-blocks {
    grid-template-columns: 1fr;
  }
  
  .management-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .header-content h1 {
    font-size: 1.5rem;
  }
}
</style> 