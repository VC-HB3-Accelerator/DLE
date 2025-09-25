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
    <div class="create-proposal-page">
      <!-- Заголовок -->
      <div class="page-header">
        <div class="header-content">
          <h1>Создание предложения</h1>
          <p v-if="selectedDle">{{ selectedDle.name }} ({{ selectedDle.symbol }}) - {{ selectedDle.dleAddress }}</p>
          <p v-else-if="isLoadingDle">Загрузка...</p>
          <p v-else>DLE не выбран</p>
        </div>
        <button class="close-btn" @click="goBackToBlocks">×</button>
      </div>

      <!-- Блоки операций DLE -->
      <div class="operations-blocks">
        <div class="blocks-header">
          <h4>Типы операций DLE контракта</h4>
          <p>Выберите тип операции для создания предложения</p>
        </div>
        
        <!-- Информация для неавторизованных пользователей -->
        <div v-if="!props.isAuthenticated" class="auth-notice">
          <div class="alert alert-info">
            <i class="fas fa-info-circle"></i>
            <strong>Для создания предложений необходимо авторизоваться в приложении</strong>
            <p class="mb-0 mt-2">Подключите кошелек в сайдбаре для создания новых предложений</p>
          </div>
        </div>
        
        <!-- Блоки операций -->
        <div class="operations-grid">
          <!-- Управление токенами -->
          <div class="operation-category">
            <h5>💸 Управление токенами</h5>
            <div class="operation-blocks">
              <div class="operation-block">
                <div class="operation-icon">💸</div>
                <h6>Передача токенов</h6>
                <p>Перевод токенов DLE другому адресу через governance</p>
                <button class="create-btn" @click="openTransferForm" :disabled="!props.isAuthenticated">
                  Создать
                </button>
              </div>
            </div>
          </div>

          <!-- Управление модулями -->
          <div class="operation-category">
            <h5>🔧 Управление модулями</h5>
            <div class="operation-blocks">
              <div class="operation-block">
                <div class="operation-icon">➕</div>
                <h6>Добавить модуль</h6>
                <p>Добавление нового модуля в DLE контракт</p>
                <button class="create-btn" @click="openAddModuleForm" :disabled="!props.isAuthenticated">
                  Создать
                </button>
              </div>
              <div class="operation-block">
                <div class="operation-icon">➖</div>
                <h6>Удалить модуль</h6>
                <p>Удаление существующего модуля из DLE контракта</p>
                <button class="create-btn" @click="openRemoveModuleForm" :disabled="!props.isAuthenticated">
                  Создать
                </button>
              </div>
            </div>
          </div>

          <!-- Управление сетями -->
          <div class="operation-category">
            <h5>🌐 Управление сетями</h5>
            <div class="operation-blocks">
              <div class="operation-block">
                <div class="operation-icon">➕</div>
                <h6>Добавить сеть</h6>
                <p>Добавление новой поддерживаемой блокчейн сети</p>
                <button class="create-btn" @click="openAddChainForm" :disabled="!props.isAuthenticated">
                  Создать
                </button>
              </div>
              <div class="operation-block">
                <div class="operation-icon">➖</div>
                <h6>Удалить сеть</h6>
                <p>Удаление поддерживаемой блокчейн сети</p>
                <button class="create-btn" @click="openRemoveChainForm" :disabled="!props.isAuthenticated">
                  Создать
                </button>
              </div>
            </div>
          </div>

          <!-- Управление настройками DLE -->
          <div class="operation-category">
            <h5>⚙️ Настройки DLE</h5>
            <div class="operation-blocks">
              <div class="operation-block">
                <div class="operation-icon">📝</div>
                <h6>Обновить данные DLE</h6>
                <p>Изменение основной информации о DLE (название, символ, адрес и т.д.)</p>
                <button class="create-btn" @click="openUpdateDLEInfoForm" :disabled="!props.isAuthenticated">
                  Создать
                </button>
              </div>
              <div class="operation-block">
                <div class="operation-icon">📊</div>
                <h6>Изменить кворум</h6>
                <p>Изменение процента голосов, необходимого для принятия решений</p>
                <button class="create-btn" @click="openUpdateQuorumForm" :disabled="!props.isAuthenticated">
                  Создать
                </button>
              </div>
              <div class="operation-block">
                <div class="operation-icon">⏰</div>
                <h6>Изменить время голосования</h6>
                <p>Настройка минимального и максимального времени голосования</p>
                <button class="create-btn" @click="openUpdateVotingDurationsForm" :disabled="!props.isAuthenticated">
                  Создать
                </button>
              </div>
              <div class="operation-block">
                <div class="operation-icon">🖼️</div>
                <h6>Изменить логотип</h6>
                <p>Обновление URI логотипа DLE для отображения в блокчейн-сканерах</p>
                <button class="create-btn" @click="openSetLogoURIForm" :disabled="!props.isAuthenticated">
                  Создать
                </button>
              </div>
            </div>
          </div>

          <!-- Оффчейн операции -->
          <div class="operation-category">
            <h5>📋 Оффчейн операции</h5>
            <div class="operation-blocks">
              <div class="operation-block">
                <div class="operation-icon">📄</div>
                <h6>Оффчейн действие</h6>
                <p>Создание предложения для выполнения оффчейн операций в приложении</p>
                <button class="create-btn" @click="openOffchainActionForm" :disabled="!props.isAuthenticated">
                  Создать
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted, defineProps, defineEmits, inject } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthContext } from '../../composables/useAuth';
import BaseLayout from '../../components/BaseLayout.vue';
import { getDLEInfo, getSupportedChains } from '../../services/dleV2Service.js';
import { createProposal as createProposalAPI } from '../../services/proposalsService.js';
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

// Функции для открытия отдельных форм операций
function openTransferForm() {
  // TODO: Открыть форму для передачи токенов
  alert('Форма передачи токенов будет реализована');
}

function openAddModuleForm() {
  // TODO: Открыть форму для добавления модуля
  alert('Форма добавления модуля будет реализована');
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
    const response = await api.post('/dle-core/read-dle-info', {
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

  } catch (error) {
    console.error('Ошибка загрузки данных DLE из блокчейна:', error);
  } finally {
    isLoadingDle.value = false;
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

/* Стили для блоков операций */
.operations-blocks {
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  border-radius: 12px;
  padding: 2rem;
  border: 1px solid #e9ecef;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.blocks-header {
  margin-bottom: 2rem;
  text-align: center;
}

.blocks-header h4 {
  color: var(--color-primary);
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.blocks-header p {
  color: #6c757d;
  margin: 0;
  font-size: 1rem;
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
  font-size: 1.25rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #f0f0f0;
}

.operation-blocks {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.operation-block {
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  border: 2px solid #e9ecef;
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.operation-block::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--color-primary), #20c997);
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.operation-block:hover {
  border-color: var(--color-primary);
  box-shadow: 0 8px 25px rgba(0, 123, 255, 0.15);
  transform: translateY(-4px);
}

.operation-block:hover::before {
  transform: scaleX(1);
}

.operation-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  display: block;
}

.operation-block h6 {
  color: #333;
  margin: 0 0 0.75rem 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.operation-block p {
  color: #666;
  margin: 0 0 1.5rem 0;
  font-size: 0.9rem;
  line-height: 1.5;
}

.create-btn {
  background: linear-gradient(135deg, var(--color-primary), #20c997);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;
  position: relative;
  overflow: hidden;
}

.create-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s ease;
}

.create-btn:hover {
  background: linear-gradient(135deg, #0056b3, #1ea085);
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 123, 255, 0.3);
}

.create-btn:hover::before {
  left: 100%;
}

.create-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.create-btn:disabled::before {
  display: none;
}

/* Адаптивность */
@media (max-width: 768px) {
  .operations-blocks {
    padding: 1rem;
  }
  
  .operation-blocks {
    grid-template-columns: 1fr;
  }
  
  .operation-block {
    padding: 1rem;
  }
  
  .operation-icon {
    font-size: 2.5rem;
  }
  
  .blocks-header h4 {
    font-size: 1.25rem;
  }
  
  .operation-category h5 {
    font-size: 1.1rem;
  }
}
</style>
