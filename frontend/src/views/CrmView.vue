<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="crm-view-container">
      <div class="dle-management-block">
        <h2>Управление DLE</h2>
        <button class="btn btn-info" @click="showDleManagement = true">
          <i class="fas fa-cogs"></i> Подробнее
        </button>
      </div>
      <DleManagement v-if="showDleManagement" :dle-list="dleList" :selected-dle-index="selectedDleIndex" @close="showDleManagement = false" />
      <div class="crm-contacts-block">
        <h2>Контакты</h2>
        <button class="btn btn-info" @click="showContacts = true">
          <i class="fas fa-address-book"></i> Подробнее
        </button>
      </div>
      <ContactTable v-if="showContacts" :contacts="contacts" @close="showContacts = false" @show-details="openContactDetails" />
      <ContactDetails v-if="showContactDetails" :contact="selectedContact" @close="showContactDetails = false" @contact-deleted="onContactDeleted" />
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, defineProps, defineEmits, computed, watch } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useRouter } from 'vue-router';
import { setToStorage } from '../utils/storage';
import BaseLayout from '../components/BaseLayout.vue';
import eventBus from '../utils/eventBus';
import dleService from '../services/dleService';
import ContactTable from '../components/ContactTable.vue';
import contactsService from '../services/contactsService.js';
import DleManagement from '../components/DleManagement.vue';
import ContactDetails from '../components/ContactDetails.vue';

// Определяем props
const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

// Определяем emits
const emit = defineEmits(['auth-action-completed']);

const auth = useAuth();
const router = useRouter();
const isLoading = ref(true);
const dleList = ref([]);
const selectedDleIndex = ref(null);

const showDleManagement = ref(false);
const showContacts = ref(false);
const contacts = ref([]);
const isLoadingContacts = ref(false);
const selectedContact = ref(null);
const showContactDetails = ref(false);

// Функция для перехода на домашнюю страницу и открытия боковой панели
const goToHomeAndShowSidebar = () => {
  setToStorage('showWalletSidebar', true);
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
    const result = await dleService.getAllDLEs();
    dleList.value = result || [];
    
    // Выбираем первый DLE, если есть
    if (dleList.value.length > 0) {
      selectedDleIndex.value = 0;
    }
  } catch (error) {
    console.error('Ошибка при загрузке списка DLE:', error);
  } finally {
    isLoading.value = false;
  }
};

// Обработчик события изменения авторизации
const handleAuthEvent = (eventData) => {
  console.log('[CrmView] Получено событие изменения авторизации:', eventData);
  if (eventData.isAuthenticated) {
    loadDLEs();
  }
};

// Регистрация и очистка обработчика событий
let unsubscribe = null;

onMounted(() => {
  console.log('[CrmView] Компонент загружен');
  
  // Если пользователь авторизован, загружаем данные
  if (auth.isAuthenticated.value) {
    loadDLEs();
  } else {
  isLoading.value = false;
  }
  
  // Подписка на события авторизации
  unsubscribe = eventBus.on('auth-state-changed', handleAuthEvent);
});

onBeforeUnmount(() => {
  // Отписка от события при удалении компонента
  if (unsubscribe) {
    unsubscribe();
  }
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

.btn {
  display: inline-block;
  font-weight: 400;
  text-align: center;
  white-space: nowrap;
  vertical-align: middle;
  user-select: none;
  border: 1px solid transparent;
  padding: 0.375rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  border-radius: 0.25rem;
  transition: all 0.15s ease-in-out;
  cursor: pointer;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  line-height: 1.5;
  border-radius: 0.2rem;
}

.btn-primary {
  color: #fff;
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

.btn-secondary {
  color: #fff;
  background-color: var(--color-grey-dark);
  border-color: var(--color-grey-dark);
}

.btn-success {
  color: #fff;
  background-color: #28a745;
  border-color: #28a745;
}

.btn-danger {
  color: #fff;
  background-color: #dc3545;
  border-color: #dc3545;
}

.btn-info {
  color: #fff;
  background-color: #17a2b8;
  border-color: #17a2b8;
}

.dle-management-block {
  margin: 32px 0 24px 0;
  padding: 24px;
  background: #f8fafc;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.dle-management-block h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
}
.dle-management-block .btn {
  font-size: 1rem;
  padding: 8px 18px;
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
.crm-contacts-block .btn {
  font-size: 1rem;
  padding: 8px 18px;
}
</style> 