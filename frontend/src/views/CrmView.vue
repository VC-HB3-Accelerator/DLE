<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="crm-view-container">
      <h1>Управление DLE</h1>
      <div v-if="isLoading">
        <p>Загрузка данных DLE...</p>
        <div class="loading-spinner"></div>
      </div>
      <div v-else-if="!auth.isAuthenticated.value">
        <p>Для доступа к управлению DLE необходимо <button @click="goToHomeAndShowSidebar">войти</button>.</p>
      </div>
      <div v-else>
        <!-- Секция со списком DLE -->
        <div class="dle-list-section">
          <h2>Ваши DLE</h2>
          <div v-if="dleList.length === 0" class="no-dle-message">
            <p>У вас пока нет созданных DLE.</p>
            <button @click="goToBlockchainSettings" class="btn btn-primary">
              <i class="fas fa-plus"></i> Создать новое DLE
            </button>
        </div>
        <div v-else>
            <div class="dle-list">
              <div v-for="(dle, index) in dleList" :key="index" class="dle-card"
                   :class="{ 'active': selectedDleIndex === index }"
                   @click="selectDle(index)">
                <h3>{{ dle.name }} ({{ dle.symbol }})</h3>
                <p><strong>Адрес:</strong> {{ shortenAddress(dle.tokenAddress) }}</p>
                <p><strong>Местонахождение:</strong> {{ dle.location }}</p>
                <div class="dle-card-actions">
                  <button class="btn btn-sm btn-info">
                    <i class="fas fa-info-circle"></i> Подробнее
                  </button>
                  <button v-if="!dle.name || !dle.name.trim() || !dle.tokenAddress" class="btn btn-sm btn-danger" @click.stop="deleteDLE(index, dle)">
                    <i class="fas fa-trash"></i> Удалить
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Секция с деталями выбранного DLE -->
        <div v-if="selectedDle" class="dle-details-section">
          <h2>Управление "{{ selectedDle.name }}"</h2>
          
          <div class="dle-tabs">
            <div class="tab-header">
              <div class="tab-button" 
                   :class="{ 'active': activeTab === 'info' }"
                   @click="activeTab = 'info'">
                <i class="fas fa-info-circle"></i> Основная информация
              </div>
              <div class="tab-button" 
                   :class="{ 'active': activeTab === 'proposals' }"
                   @click="activeTab = 'proposals'">
                <i class="fas fa-tasks"></i> Предложения
              </div>
              <div class="tab-button" 
                   :class="{ 'active': activeTab === 'governance' }"
                   @click="activeTab = 'governance'">
                <i class="fas fa-balance-scale"></i> Управление
              </div>
              <div class="tab-button" 
                   :class="{ 'active': activeTab === 'modules' }"
                   @click="activeTab = 'modules'">
                <i class="fas fa-puzzle-piece"></i> Модули
              </div>
            </div>
            
            <!-- Вкладка информации -->
            <div class="tab-content" v-if="activeTab === 'info'">
              <div class="info-card">
                <h3>Основная информация</h3>
                <div class="info-row">
                  <span class="info-label">Название:</span>
                  <span class="info-value">{{ selectedDle.name }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Символ токена:</span>
                  <span class="info-value">{{ selectedDle.symbol }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Местонахождение:</span>
                  <span class="info-value">{{ selectedDle.location }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Коды деятельности:</span>
                  <span class="info-value">{{ selectedDle.isicCodes && selectedDle.isicCodes.length ? selectedDle.isicCodes.join(', ') : 'Не указаны' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Дата создания:</span>
                  <span class="info-value">{{ formatDate(selectedDle.creationTimestamp) }}</span>
                </div>
              </div>
              
              <div class="contract-cards">
                <div class="contract-card">
                  <h4>Токен управления</h4>
                  <p class="address">{{ selectedDle.tokenAddress }}</p>
                  <div class="contract-actions">
                    <button class="btn btn-sm btn-secondary" @click="copyToClipboard(selectedDle.tokenAddress)">
                      <i class="fas fa-copy"></i> Копировать адрес
                    </button>
                    <button class="btn btn-sm btn-info" @click="viewOnExplorer(selectedDle.tokenAddress)">
                      <i class="fas fa-external-link-alt"></i> Обзор
                    </button>
                  </div>
                </div>
                
                <div class="contract-card">
                  <h4>Таймлок</h4>
                  <p class="address">{{ selectedDle.timelockAddress }}</p>
                  <div class="contract-actions">
                    <button class="btn btn-sm btn-secondary" @click="copyToClipboard(selectedDle.timelockAddress)">
                      <i class="fas fa-copy"></i> Копировать адрес
                    </button>
                    <button class="btn btn-sm btn-info" @click="viewOnExplorer(selectedDle.timelockAddress)">
                      <i class="fas fa-external-link-alt"></i> Обзор
                    </button>
                  </div>
                </div>
                
                <div class="contract-card">
                  <h4>Governor</h4>
                  <p class="address">{{ selectedDle.governorAddress }}</p>
                  <div class="contract-actions">
                    <button class="btn btn-sm btn-secondary" @click="copyToClipboard(selectedDle.governorAddress)">
                      <i class="fas fa-copy"></i> Копировать адрес
                    </button>
                    <button class="btn btn-sm btn-info" @click="viewOnExplorer(selectedDle.governorAddress)">
                      <i class="fas fa-external-link-alt"></i> Обзор
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Вкладка предложений -->
            <div class="tab-content" v-if="activeTab === 'proposals'">
              <h3>Предложения</h3>
              <div class="proposals-actions">
                <button class="btn btn-primary" @click="showCreateProposalForm = true">
                  <i class="fas fa-plus"></i> Создать предложение
                </button>
              </div>
              
              <div v-if="showCreateProposalForm" class="create-proposal-form">
                <h4>Новое предложение</h4>
                <div class="form-group">
                  <label for="proposalTitle">Заголовок:</label>
                  <input type="text" id="proposalTitle" v-model="newProposal.title" class="form-control">
                </div>
                <div class="form-group">
                  <label for="proposalDescription">Описание:</label>
                  <textarea id="proposalDescription" v-model="newProposal.description" class="form-control" rows="3"></textarea>
                </div>
                <div class="form-actions">
                  <button class="btn btn-success" @click="createProposal" :disabled="isCreatingProposal">
                    <i class="fas fa-paper-plane"></i> {{ isCreatingProposal ? 'Отправка...' : 'Отправить' }}
                  </button>
                  <button class="btn btn-secondary" @click="showCreateProposalForm = false">
                    <i class="fas fa-times"></i> Отмена
                  </button>
                </div>
              </div>
              
              <div class="proposals-list">
                <p v-if="proposals.length === 0">Предложений пока нет</p>
                <div v-else v-for="(proposal, index) in proposals" :key="index" class="proposal-card">
                  <h4>{{ proposal.title }}</h4>
                  <p>{{ proposal.description }}</p>
                  <div class="proposal-status" :class="proposal.status">
                    {{ getProposalStatusText(proposal.status) }}
                  </div>
                  <div class="proposal-actions">
                    <button class="btn btn-sm btn-primary" @click="voteForProposal(proposal.id, true)" :disabled="!canVote(proposal)">
                      <i class="fas fa-thumbs-up"></i> За
                    </button>
                    <button class="btn btn-sm btn-danger" @click="voteForProposal(proposal.id, false)" :disabled="!canVote(proposal)">
                      <i class="fas fa-thumbs-down"></i> Против
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Вкладка управления -->
            <div class="tab-content" v-if="activeTab === 'governance'">
              <h3>Управление</h3>
              <div class="governance-info">
                <div class="info-card">
                  <h4>Настройки Governor</h4>
                  <div class="info-row">
                    <span class="info-label">Порог предложения:</span>
                    <span class="info-value">100,000 GT</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Кворум:</span>
                    <span class="info-value">4%</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Задержка голосования:</span>
                    <span class="info-value">1 день</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Период голосования:</span>
                    <span class="info-value">7 дней</span>
                  </div>
                </div>
                
                <div class="info-card">
                  <h4>Статистика голосований</h4>
                  <div class="info-row">
                    <span class="info-label">Всего предложений:</span>
                    <span class="info-value">{{ proposals.length }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Активных предложений:</span>
                    <span class="info-value">{{ getProposalsByStatus('active').length }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Успешных предложений:</span>
                    <span class="info-value">{{ getProposalsByStatus('succeeded').length }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Отклоненных предложений:</span>
                    <span class="info-value">{{ getProposalsByStatus('defeated').length }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Вкладка модулей -->
            <div class="tab-content" v-if="activeTab === 'modules'">
              <h3>Подключение модулей</h3>
              <p>Здесь вы можете подключить дополнительные модули к вашему DLE.</p>
              
              <div class="modules-list">
                <div v-for="(module, index) in availableModules" :key="index" class="module-card">
                  <h4>{{ module.name }}</h4>
                  <p>{{ module.description }}</p>
                  <div class="module-status" :class="{ 'installed': module.installed }">
                    {{ module.installed ? 'Установлен' : 'Доступен' }}
                  </div>
                  <div class="module-actions">
                    <button v-if="!module.installed" class="btn btn-success" @click="installModule(module)">
                      <i class="fas fa-plus"></i> Установить
                    </button>
                    <button v-else class="btn btn-danger" @click="uninstallModule(module)">
                      <i class="fas fa-trash"></i> Удалить
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
         </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, defineProps, defineEmits, computed } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useRouter } from 'vue-router';
import { setToStorage } from '../utils/storage';
import BaseLayout from '../components/BaseLayout.vue';
import eventBus from '../utils/eventBus';
import dleService from '../services/dleService';

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
const activeTab = ref('info');

// Для создания предложений
const showCreateProposalForm = ref(false);
const newProposal = ref({ title: '', description: '' });
const isCreatingProposal = ref(false);

// Список доступных модулей
const availableModules = ref([
  {
    name: 'Контракт на активы',
    description: 'Позволяет токенизировать физические активы и управлять ими через DLE.',
    installed: false
  },
  {
    name: 'Мультиподпись',
    description: 'Добавляет функциональность мультиподписи для повышенной безопасности.',
    installed: false
  },
  {
    name: 'Дивиденды',
    description: 'Позволяет распределять дивиденды между держателями токенов.',
    installed: false
  },
  {
    name: 'Стейкинг',
    description: 'Добавляет возможность стейкинга токенов для получения наград.',
    installed: false
  }
]);

// Список предложений (в реальном приложении будет загружаться из смарт-контракта)
const proposals = ref([]);

const selectedDle = computed(() => {
  if (selectedDleIndex.value !== null && dleList.value.length > selectedDleIndex.value) {
    return dleList.value[selectedDleIndex.value];
  }
  return null;
});

// Функция для перехода на домашнюю страницу и открытия боковой панели
const goToHomeAndShowSidebar = () => {
  setToStorage('showWalletSidebar', true);
  router.push({ name: 'home' });
};

// Функция для перехода на страницу настроек блокчейна
const goToBlockchainSettings = () => {
  router.push({ name: 'settings-blockchain' });
};

// Функция для выбора DLE
const selectDle = (index) => {
  selectedDleIndex.value = index;
  activeTab.value = 'info'; // При выборе нового DLE сбрасываем на вкладку информации
};

// Форматирование адреса (сокращение)
const shortenAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Форматирование даты из timestamp
const formatDate = (timestamp) => {
  if (!timestamp) return 'N/A';
  return new Date(timestamp * 1000).toLocaleString();
};

// Копирование в буфер обмена
const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text)
    .then(() => {
      alert('Адрес скопирован в буфер обмена');
    })
    .catch(err => {
      console.error('Ошибка при копировании текста: ', err);
    });
};

// Открытие адреса в обозревателе блокчейна
const viewOnExplorer = (address) => {
  // Используем Sepolia Etherscan как пример
  window.open(`https://sepolia.etherscan.io/address/${address}`, '_blank');
};

// Создание нового предложения
const createProposal = async () => {
  if (!newProposal.value.title || !newProposal.value.description) {
    alert('Пожалуйста, заполните все поля');
    return;
  }
  
  isCreatingProposal.value = true;
  
  try {
    // В реальном приложении здесь будет вызов смарт-контракта
    // Пока просто добавляем в локальный массив
    proposals.value.push({
      id: Date.now().toString(),
      title: newProposal.value.title,
      description: newProposal.value.description,
      status: 'pending',
      votes: { for: 0, against: 0 }
    });
    
    showCreateProposalForm.value = false;
    newProposal.value = { title: '', description: '' };
    
    alert('Предложение создано!');
  } catch (error) {
    console.error('Ошибка при создании предложения:', error);
    alert('Ошибка при создании предложения');
  } finally {
    isCreatingProposal.value = false;
  }
};

// Голосование за предложение
const voteForProposal = async (proposalId, isFor) => {
  try {
    // В реальном приложении здесь будет вызов смарт-контракта
    // Пока просто обновляем локальный массив
    const proposal = proposals.value.find(p => p.id === proposalId);
    if (proposal) {
      if (isFor) {
        proposal.votes.for += 1;
      } else {
        proposal.votes.against += 1;
      }
      
      // Обновляем статус в зависимости от голосов
      if (proposal.votes.for > proposal.votes.against && proposal.votes.for >= 3) {
        proposal.status = 'succeeded';
      } else if (proposal.votes.against > proposal.votes.for && proposal.votes.against >= 3) {
        proposal.status = 'defeated';
      } else {
        proposal.status = 'active';
      }
      
      alert('Ваш голос учтен!');
    }
  } catch (error) {
    console.error('Ошибка при голосовании:', error);
    alert('Ошибка при голосовании');
  }
};

// Проверка возможности голосования
const canVote = (proposal) => {
  return proposal.status === 'active' || proposal.status === 'pending';
};

// Получение текстового статуса предложения
const getProposalStatusText = (status) => {
  const statusMap = {
    'pending': 'Ожидает',
    'active': 'Активно',
    'succeeded': 'Принято',
    'defeated': 'Отклонено',
    'executed': 'Выполнено'
  };
  return statusMap[status] || status;
};

// Фильтрация предложений по статусу
const getProposalsByStatus = (status) => {
  return proposals.value.filter(p => p.status === status);
};

// Установка модуля
const installModule = (module) => {
  // В реальном приложении здесь будет вызов смарт-контракта
  module.installed = true;
  alert(`Модуль "${module.name}" успешно установлен!`);
};

// Удаление модуля
const uninstallModule = (module) => {
  // В реальном приложении здесь будет вызов смарт-контракта
  module.installed = false;
  alert(`Модуль "${module.name}" удален.`);
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

// Функция для удаления DLE
const deleteDLE = async (index, dle) => {
  if (!confirm(`Вы уверены, что хотите удалить DLE "${dle.name || 'без имени'}"?`)) {
    return;
  }
  
  try {
    if (dle.tokenAddress) {
      // Если есть адрес токена, удаляем через основной метод
      await dleService.deleteDLE(dle.tokenAddress);
    } else if (dle._fileName) {
      // Если нет адреса токена, но есть имя файла, удаляем как пустое DLE
      await dleService.deleteEmptyDLE(dle._fileName);
    } else {
      // Если нет ни адреса токена, ни имени файла, просто удаляем из списка
      console.warn('DLE не имеет ни адреса токена, ни имени файла. Удаляется только из локального списка.');
    }
    
    // Удаляем из локального списка
    dleList.value.splice(index, 1);
    
    // Если был выбран этот DLE, сбрасываем выбор
    if (selectedDleIndex.value === index) {
      selectedDleIndex.value = null;
    } else if (selectedDleIndex.value > index) {
      // Если был выбран DLE с большим индексом, корректируем индекс
      selectedDleIndex.value--;
    }
    
    alert(`DLE успешно удалено`);
  } catch (error) {
    console.error('Ошибка при удалении DLE:', error);
    alert(`Ошибка при удалении DLE: ${error.message || 'Неизвестная ошибка'}`);
  }
};
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

/* Стили для секции списка DLE */
.dle-list-section {
  margin-bottom: 30px;
}

.dle-list {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-top: 20px;
}

.dle-card {
  width: 300px;
  padding: 15px;
  border: 1px solid var(--color-grey-light);
  border-radius: var(--radius-md);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.2s ease;
}

.dle-card:hover {
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.dle-card.active {
  border-color: var(--color-primary);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.dle-card h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: var(--color-primary);
}

.dle-card-actions {
  margin-top: 15px;
  text-align: right;
}

/* Стили для секции деталей DLE */
.dle-details-section {
  margin-top: 30px;
  border-top: 1px solid var(--color-grey-light);
  padding-top: 20px;
}

/* Стили для вкладок */
.dle-tabs {
  margin-top: 20px;
}

.tab-header {
  display: flex;
  border-bottom: 1px solid var(--color-grey-light);
  margin-bottom: 20px;
}

.tab-button {
  padding: 10px 20px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
}

.tab-button:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

.tab-button.active {
  border-bottom-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 500;
}

.tab-content {
  padding: 10px;
}

/* Стили для информационных карточек */
.info-card {
  background-color: #f8f9fa;
  border-radius: var(--radius-md);
  padding: 15px;
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  margin-bottom: 10px;
  align-items: baseline;
}

.info-label {
  font-weight: 500;
  width: 200px;
  color: var(--color-dark);
}

.info-value {
  flex: 1;
}

/* Стили для карточек контрактов */
.contract-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-top: 20px;
}

.contract-card {
  flex: 1;
  min-width: 250px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: var(--radius-md);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.contract-card h4 {
  margin-top: 0;
  margin-bottom: 10px;
  color: var(--color-primary);
}

.contract-card .address {
  font-family: monospace;
  word-break: break-all;
  padding: 5px;
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 4px;
}

.contract-actions {
  margin-top: 15px;
  display: flex;
  gap: 10px;
}

/* Стили для формы создания предложения */
.create-proposal-form {
  background-color: #f8f9fa;
  border-radius: var(--radius-md);
  padding: 20px;
  margin-top: 20px;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}

.form-control {
  display: block;
  width: 100%;
  padding: 0.375rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  color: #495057;
  background-color: #fff;
  background-clip: padding-box;
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

/* Стили для списка предложений */
.proposal-card {
  background-color: #f8f9fa;
  border-radius: var(--radius-md);
  padding: 15px;
  margin-bottom: 15px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.proposal-status {
  display: inline-block;
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 0.8rem;
  margin-top: 10px;
  margin-bottom: 10px;
  font-weight: 500;
}

.proposal-status.pending {
  background-color: #ffeeba;
  color: #856404;
}

.proposal-status.active {
  background-color: #d1ecf1;
  color: #0c5460;
}

.proposal-status.succeeded {
  background-color: #d4edda;
  color: #155724;
}

.proposal-status.defeated {
  background-color: #f8d7da;
  color: #721c24;
}

.proposal-status.executed {
  background-color: #d4edda;
  color: #155724;
}

.proposal-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

/* Стили для секции модулей */
.modules-list {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-top: 20px;
}

.module-card {
  width: 300px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: var(--radius-md);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.module-status {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  margin-top: 10px;
  margin-bottom: 10px;
  background-color: #f8d7da;
  color: #721c24;
}

.module-status.installed {
  background-color: #d4edda;
  color: #155724;
}

.module-actions {
  margin-top: 15px;
}

/* Стили для случая отсутствия DLE */
.no-dle-message {
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: var(--radius-md);
  text-align: center;
}

.no-dle-message p {
  margin-bottom: 15px;
}

/* Стили для секции управления */
.governance-info {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.governance-info .info-card {
  flex: 1;
  min-width: 250px;
}
</style> 