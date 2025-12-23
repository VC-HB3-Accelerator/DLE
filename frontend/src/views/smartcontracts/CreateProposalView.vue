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
    <div class="create-proposal-page">
      <!-- Информация для неавторизованных пользователей -->
      <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div v-if="selectedDle?.dleAddress" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ selectedDle.dleAddress }}
        </div>
        <div v-else-if="dleAddress" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ dleAddress }}
        </div>
        <div v-else-if="isLoadingDle" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          Загрузка...
        </div>
        <button class="close-btn" @click="goBackToBlocks">×</button>
      </div>
      <div v-if="!props.isAuthenticated" class="auth-notice">
        <div class="alert alert-info">
          <i class="fas fa-info-circle"></i>
          <strong>Для создания предложений необходимо авторизоваться в приложении</strong>
          <p class="mb-0 mt-2">Подключите кошелек в сайдбаре для создания новых предложений</p>
        </div>
      </div>
      
      <!-- Блоки операций -->
      <div class="operations-grid">
          <!-- Основные операции DLE -->
          <div class="operation-category">
            <h5>Основные операции DLE</h5>
            <div class="operation-blocks">
              <div class="operation-block">
                <h6>Передача токенов</h6>
                <p>Перевод токенов DLE другому адресу через governance</p>
                <button class="create-btn" @click="openTransferForm" :disabled="!props.isAuthenticated">
                  Создать
                </button>
              </div>
              <div class="operation-block">
                <h6>Обновить данные DLE</h6>
                <p>Изменение основной информации о DLE (название, символ, адрес и т.д.)</p>
                <button class="create-btn" @click="openUpdateDLEInfoForm" :disabled="!props.isAuthenticated">
                  Создать
                </button>
              </div>
              <div class="operation-block">
                <h6>Изменить кворум</h6>
                <p>Изменение процента голосов, необходимого для принятия решений</p>
                <button class="create-btn" @click="openUpdateQuorumForm" :disabled="!props.isAuthenticated">
                  Создать
                </button>
              </div>
              <div class="operation-block">
                <h6>Изменить время голосования</h6>
                <p>Настройка минимального и максимального времени голосования</p>
                <button class="create-btn" @click="openUpdateVotingDurationsForm" :disabled="!props.isAuthenticated">
                  Создать
                </button>
              </div>
              <div class="operation-block">
                <h6>Оффчейн действие</h6>
                <p>Создание предложения для выполнения оффчейн операций в приложении</p>
                <button class="create-btn" @click="openOffchainActionForm" :disabled="!props.isAuthenticated">
                  Создать
                </button>
              </div>
              <div class="operation-block">
                <h6>Добавить модуль</h6>
                <p>Добавление нового модуля в DLE контракт</p>
                <button class="create-btn" @click="openAddModuleForm" :disabled="!props.isAuthenticated">
                  Создать
                </button>
              </div>
              <div class="operation-block">
                <h6>Удалить модуль</h6>
                <p>Удаление существующего модуля из DLE контракта</p>
                <button class="create-btn" @click="openRemoveModuleForm" :disabled="!props.isAuthenticated">
                  Создать
                </button>
              </div>
              <div class="operation-block">
                <h6>Добавить сеть</h6>
                <p>Добавление новой поддерживаемой блокчейн сети</p>
                <button class="create-btn" @click="openAddChainForm" :disabled="!props.isAuthenticated">
                  Создать
                </button>
              </div>
              <div class="operation-block">
                <h6>Удалить сеть</h6>
                <p>Удаление поддерживаемой блокчейн сети</p>
                <button class="create-btn" @click="openRemoveChainForm" :disabled="!props.isAuthenticated">
                  Создать
                </button>
              </div>
              <div class="operation-block">
                <h6>Изменить логотип</h6>
                <p>Обновление URI логотипа DLE для отображения в блокчейн-сканерах</p>
                <button class="create-btn" @click="openSetLogoURIForm" :disabled="!props.isAuthenticated">
                  Создать
                </button>
              </div>
            </div>
          </div>

          <!-- Операции модулей (динамические) -->
          <div v-if="isLoadingModuleOperations" class="loading-modules">
            Загрузка операций модулей...
          </div>
          
          <div 
            v-for="moduleOperation in moduleOperations" 
            :key="moduleOperation.moduleType"
            class="operation-category"
          >
            <h5>{{ getModuleIcon(moduleOperation.moduleType) }} {{ moduleOperation.moduleName }}</h5>
            <p class="module-description">{{ moduleOperation.moduleDescription }}</p>
            <div class="operation-blocks">
              <div 
                v-for="operation in moduleOperation.operations" 
                :key="operation.id"
                class="operation-block module-operation-block"
              >
                <h6>{{ operation.name }}</h6>
                <p>{{ operation.description }}</p>
                <button 
                  class="create-btn" 
                  @click="openModuleOperationForm(moduleOperation.moduleType, operation)" 
                  :disabled="!props.isAuthenticated || isLoadingModuleOperations"
                >
                  <span v-if="isLoadingModuleOperations">Загрузка...</span>
                  <span v-else>Создать</span>
                </button>
              </div>
            </div>
          </div>

      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, defineProps, defineEmits, inject } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthContext } from '../../composables/useAuth';
import BaseLayout from '../../components/BaseLayout.vue';
import { getDLEInfo, getSupportedChains } from '../../services/dleV2Service.js';
import { createProposal as createProposalAPI } from '../../services/proposalsService.js';
import { getModuleOperations } from '../../services/moduleOperationsService.js';
import api from '../../api/axios';
import wsClient from '../../utils/websocket.js';
import { ethers } from 'ethers';

const showTargetChains = computed(() => {
  // Для offchain-действий не требуется ончейн исполнение (здесь типы пока ончейн)
  // Можно расширить логику при появлении offchain типа
  return true;
});

const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

const emit = defineEmits(['auth-action-completed']);

const { address, isAuthenticated, tokenBalances, checkTokenBalances } = useAuthContext();
const router = useRouter();
const route = useRoute();

// Подписываемся на централизованные события очистки и обновления данных
onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    console.log('[CreateProposalView] Clearing DLE proposal data');
    // Очищаем данные при выходе из системы
    dleInfo.value = null;
  });
  
  window.addEventListener('refresh-application-data', () => {
    console.log('[CreateProposalView] Refreshing DLE proposal data');
    loadDLEInfo(); // Обновляем данные при входе в систему
  });
});

// Получаем адрес DLE из URL
const dleAddress = computed(() => {
  const address = route.query.address || props.dleAddress;
  console.log('DLE Address from URL:', address);
  return address;
});

// Функция возврата к блокам управления
const goBackToBlocks = () => {
  if (dleAddress.value) {
    router.push(`/management/dle-blocks?address=${dleAddress.value}`);
  } else {
    router.push('/management');
  }
};

// Состояние DLE
const selectedDle = ref(null);
const isLoadingDle = ref(false);

// Доступные цепочки (загружаются из конфигурации)
const availableChains = ref([]);

// Состояние модулей и их операций
const moduleOperations = ref([]);
const isLoadingModuleOperations = ref(false);
const isModulesWSConnected = ref(false);

// Функции для открытия отдельных форм операций
function openTransferForm() {
  // TODO: Открыть форму для передачи токенов
  alert('Форма передачи токенов будет реализована');
}

function openAddModuleForm() {
  if (dleAddress.value) {
    router.push(`/management/add-module?address=${dleAddress.value}`);
  } else {
    router.push('/management/add-module');
  }
}

function openRemoveModuleForm() {
  // TODO: Открыть форму для удаления модуля
  alert('Форма удаления модуля будет реализована');
}

function openAddChainForm() {
  // TODO: Открыть форму для добавления сети
  alert('Форма добавления сети будет реализована');
}

function openRemoveChainForm() {
  // TODO: Открыть форму для удаления сети
  alert('Форма удаления сети будет реализована');
}


function openUpdateDLEInfoForm() {
  // TODO: Открыть форму для обновления данных DLE
  alert('Форма обновления данных DLE будет реализована');
}

function openUpdateQuorumForm() {
  // TODO: Открыть форму для изменения кворума
  alert('Форма изменения кворума будет реализована');
}

function openUpdateVotingDurationsForm() {
  // TODO: Открыть форму для изменения времени голосования
  alert('Форма изменения времени голосования будет реализована');
}

function openSetLogoURIForm() {
  // TODO: Открыть форму для изменения логотипа
  alert('Форма изменения логотипа будет реализована');
}

function openOffchainActionForm() {
  // TODO: Открыть форму для оффчейн действий
  alert('Форма оффчейн действий будет реализована');
}

// Функция для создания предложения операции модуля
function openModuleOperationForm(moduleType, operation) {
  console.log('[CreateProposalView] Открытие формы для операции модуля:', { moduleType, operation });
  
  // TODO: Открыть форму для создания предложения операции модуля
  // Пока показываем alert с информацией об операции
  alert(`Создание предложения для операции "${operation.name}" модуля ${moduleType}.\n\nОписание: ${operation.description}\nФункция: ${operation.functionName}\nКатегория: ${operation.category}`);
}

// Получить иконку для типа модуля
function getModuleIcon(moduleType) {
  return '';
}

// Функции
async function loadDleData() {
  console.log('loadDleData вызвана с адресом:', dleAddress.value);
  
  if (!dleAddress.value) {
    console.warn('Адрес DLE не указан');
    return;
  }

  isLoadingDle.value = true;
  try {
    // Загружаем данные DLE из блокчейна
    const response = await api.post('/blockchain/read-dle-info', {
      dleAddress: dleAddress.value
    });
    
    if (response.data.success) {
      selectedDle.value = response.data.data;
      console.log('Загружены данные DLE из блокчейна:', selectedDle.value);
    } else {
      console.error('Ошибка загрузки DLE:', response.data.error);
    }
    
    // Загружаем поддерживаемые цепочки
    const chainsResponse = await getSupportedChains(dleAddress.value);
    availableChains.value = chainsResponse.data?.chains || [];

    // Загружаем операции модулей
    await loadModuleOperations();

    // Повторно подписываемся на обновления модулей для нового DLE
    resubscribeToModules();

  } catch (error) {
    console.error('Ошибка загрузки данных DLE из блокчейна:', error);
  } finally {
    isLoadingDle.value = false;
  }
}

// Загрузка операций модулей
async function loadModuleOperations() {
  if (!dleAddress.value) {
    console.warn('Адрес DLE не указан для загрузки операций модулей');
    return;
  }

  isLoadingModuleOperations.value = true;
  try {
    console.log('[CreateProposalView] Загрузка операций модулей для DLE:', dleAddress.value);
    
    const response = await getModuleOperations(dleAddress.value);
    
    if (response.success) {
      moduleOperations.value = response.data.moduleOperations || [];
      console.log('[CreateProposalView] Загружены операции модулей:', moduleOperations.value);
    } else {
      console.error('[CreateProposalView] Ошибка загрузки операций модулей:', response.error);
      moduleOperations.value = [];
    }
  } catch (error) {
    console.error('[CreateProposalView] Ошибка загрузки операций модулей:', error);
    moduleOperations.value = [];
  } finally {
    isLoadingModuleOperations.value = false;
  }
}

// WebSocket функции для модулей
function connectModulesWebSocket() {
  if (isModulesWSConnected.value) {
    return;
  }

  try {
    // Подключаемся через существующий WebSocket клиент
    wsClient.connect();
    
    // Подписываемся на события deployment_update
    wsClient.on('deployment_update', (data) => {
      console.log('[CreateProposalView] Получено обновление деплоя:', data);
      handleModulesWebSocketMessage(data);
    });

    // Подписываемся на подтверждение подписки
    wsClient.on('subscribed', (data) => {
      console.log('[CreateProposalView] Подписка подтверждена:', data);
    });

    // Подписываемся на обновления модулей
    wsClient.on('modules_updated', (data) => {
      console.log('[CreateProposalView] Модули обновлены:', data);
      // Перезагружаем операции модулей при обновлении
      loadModuleOperations();
    });

    // Подписываемся на статус деплоя
    wsClient.on('deployment_status', (data) => {
      console.log('[CreateProposalView] Статус деплоя:', data);
      handleModulesWebSocketMessage(data);
    });

    // Подписываемся на событие подключения
    wsClient.on('connected', () => {
      console.log('[CreateProposalView] WebSocket подключен, подписываемся на модули');
      if (dleAddress.value) {
        wsClient.ws.send(JSON.stringify({
          type: 'subscribe',
          dleAddress: dleAddress.value
        }));
        console.log('[CreateProposalView] Подписка на модули отправлена для DLE:', dleAddress.value);
      }
    });

    isModulesWSConnected.value = true;
    console.log('[CreateProposalView] WebSocket модулей соединение установлено');
  } catch (error) {
    console.error('[CreateProposalView] Ошибка подключения WebSocket модулей:', error);
    isModulesWSConnected.value = false;
    
    // Переподключаемся через 5 секунд
    setTimeout(() => {
      connectModulesWebSocket();
    }, 5000);
  }
}

function handleModulesWebSocketMessage(data) {
  console.log('[CreateProposalView] WebSocket модулей сообщение:', data);
  
  switch (data.type) {
    case 'modules_updated':
      // Автоматически обновляем список операций модулей
      console.log('[CreateProposalView] Получено уведомление об обновлении модулей');
      loadModuleOperations();
      break;
      
    case 'module_verified':
      // Обновляем операции модуля
      console.log(`[CreateProposalView] Модуль ${data.moduleType} верифицирован`);
      loadModuleOperations();
      break;
      
    case 'module_status_changed':
      // Обновляем операции модуля
      console.log(`[CreateProposalView] Статус модуля ${data.moduleType} изменен`);
      loadModuleOperations();
      break;
  }
}

function disconnectModulesWebSocket() {
  if (isModulesWSConnected.value) {
    // Отписываемся от всех событий
    wsClient.off('deployment_update');
    wsClient.off('subscribed');
    wsClient.off('modules_updated');
    wsClient.off('deployment_status');
    wsClient.off('connected');
    
    isModulesWSConnected.value = false;
    console.log('[CreateProposalView] WebSocket модулей отключен');
  }
}

// Функция для повторной подписки при изменении DLE адреса
function resubscribeToModules() {
  if (isModulesWSConnected.value && wsClient.ws && wsClient.ws.readyState === WebSocket.OPEN && dleAddress.value) {
    wsClient.ws.send(JSON.stringify({
      type: 'subscribe',
      dleAddress: dleAddress.value
    }));
    console.log('[CreateProposalView] Повторная подписка на модули для DLE:', dleAddress.value);
  } else if (wsClient.ws && wsClient.ws.readyState === WebSocket.CONNECTING) {
    // Если соединение еще устанавливается, ждем события подключения
    console.log('[CreateProposalView] WebSocket еще подключается, ждем события connected');
  }
}

onMounted(async () => {
  // Принудительно загружаем токены, если пользователь аутентифицирован
  if (isAuthenticated.value && address.value) {
    console.log('[CreateProposalView] Принудительная загрузка токенов для адреса:', address.value);
    await checkTokenBalances(address.value);
  }
  
  // Загрузка данных DLE
  if (dleAddress.value) {
    loadDleData();
  }
  
  // Подключаемся к WebSocket для получения обновлений модулей
  connectModulesWebSocket();
});

// Отключаем WebSocket при размонтировании компонента
onUnmounted(() => {
  disconnectModulesWebSocket();
});
</script>

<style scoped>
.create-proposal-page {
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
  margin-bottom: 20px;
}

/* Заголовок */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 15px;
  border-bottom: 1px solid #f0f0f0;
}

.header-content {
  flex-grow: 1;
}

.page-header h1 {
  color: var(--color-primary);
  font-size: 2rem;
  margin: 0 0 5px 0;
}

.page-header p {
  color: var(--color-grey-dark);
  font-size: 1rem;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
  flex-shrink: 0;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}


.auth-notice {
  margin-bottom: 2rem;
}

.alert {
  padding: 1rem 1.5rem;
  border-radius: 8px;
  border: 1px solid transparent;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.alert-info {
  background-color: #d1ecf1;
  border-color: #bee5eb;
  color: #0c5460;
}

.alert i {
  margin-top: 0.25rem;
  flex-shrink: 0;
}

.operations-grid {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.operation-category {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid #e9ecef;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.operation-category h5 {
  color: var(--color-primary);
  margin: 0 0 1.5rem 0;
  font-size: 1.5rem;
  font-weight: 700;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #f0f0f0;
  text-align: center;
}

.operation-blocks {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.operation-block {
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
  min-height: 200px;
}

.operation-block:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
  border-color: var(--color-primary);
}


.operation-block h6 {
  margin: 0 0 1rem 0;
  color: var(--color-primary);
  font-size: 1.5rem;
  font-weight: 600;
  flex-shrink: 0;
}

.operation-block p {
  margin: 0 0 1.5rem 0;
  color: #666;
  font-size: 1rem;
  line-height: 1.5;
  flex-grow: 1;
}

.create-btn {
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
  width: 100%;
  flex-shrink: 0;
  margin-top: auto;
}

.create-btn:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}
.create-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* Стили для модулей */
.module-description {
  color: #666;
  font-size: 0.9rem;
  margin: 0.5rem 0 1rem 0;
  font-style: italic;
}

.module-operation-block {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 200px;
}



/* Индикатор загрузки модулей */
.loading-modules {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #666;
  font-style: italic;
}

.loading-modules::before {
  content: '';
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 0.5rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Адаптивность */
@media (max-width: 768px) {
  .operation-blocks {
    grid-template-columns: 1fr;
  }
  
  .operation-block {
    padding: 1rem;
  }
  
  .operation-category h5 {
    font-size: 1.1rem;
  }
}
</style>
