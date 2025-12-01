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
    <div class="add-module-page">
      <!-- Заголовок -->
      <div class="page-header">
        <div class="header-content">
          <h1>Добавление модуля в DLE</h1>
          <p v-if="selectedDle">{{ selectedDle.name }} ({{ selectedDle.symbol }}) - {{ selectedDle.dleAddress }}</p>
          <p v-else-if="isLoadingDle">Загрузка...</p>
          <p v-else>DLE не выбран (Адрес: {{ dleAddress }})</p>
        </div>
        <button class="close-btn" @click="goBackToProposals">×</button>
      </div>

      <!-- Информация для неавторизованных пользователей -->
      <div v-if="!props.isAuthenticated" class="auth-notice">
        <div class="alert alert-info">
          <i class="fas fa-info-circle"></i>
          <strong>Для создания предложений необходимо авторизоваться в приложении</strong>
          <p class="mb-0 mt-2">Подключите кошелек в сайдбаре для создания новых предложений</p>
        </div>
      </div>

      <!-- Форма добавления модуля -->
      <div v-if="props.isAuthenticated" class="add-module-form">
        <form @submit.prevent="submitForm" class="form-container">
          <!-- Тип модуля -->
          <div class="form-group">
            <label for="moduleType" class="form-label">
              <i class="fas fa-cube"></i>
              Тип модуля *
            </label>
            <select 
              id="moduleType" 
              v-model="formData.moduleType" 
              @change="onModuleTypeChange"
              class="form-select"
              :disabled="isLoadingModules"
              required
            >
              <option value="">Выберите тип модуля</option>
              <option 
                v-for="module in availableModules" 
                :key="module.moduleType" 
                :value="module.moduleType"
              >
                {{ getModuleDisplayName(module.moduleName) }} - {{ module.moduleDescription }}
              </option>
            </select>
            <div v-if="availableModules.length === 0 && !isLoadingModules" class="no-modules-warning">
              <i class="fas fa-exclamation-triangle"></i>
              Нет доступных модулей для выбора ({{ availableModules.length }} модулей)
              <button @click="loadAvailableModules" class="btn-reload-modules">
                <i class="fas fa-sync-alt"></i>
                Перезагрузить
              </button>
            </div>
            <div v-if="isLoadingModules" class="loading-indicator">
              <i class="fas fa-spinner fa-spin"></i>
              Загрузка модулей...
            </div>
          </div>

          <!-- Адреса модуля (автоматически выбранные) -->
          <div class="form-group" v-if="formData.moduleType && selectedModuleAddresses.length > 0">
            <label class="form-label">
              <i class="fas fa-map-marker-alt"></i>
              Адреса модуля (автоматически выбраны)
            </label>
            <div class="module-addresses">
              <div 
                v-for="address in selectedModuleAddresses" 
                :key="`${address.chainId}-${address.address}`"
                class="address-item"
              >
                <div class="address-info">
                  <strong>{{ address.networkName }} ({{ address.chainId }}):</strong>
                  <span class="address-value">{{ address.address }}</span>
                </div>
                <div class="address-status">
                  <span v-if="address.isActive" class="status-badge active">Активен</span>
                  <span v-else class="status-badge inactive">Неактивен</span>
                </div>
              </div>
            </div>
            <div class="input-hint">
              Модуль будет добавлен во все {{ selectedModuleAddresses.length }} поддерживаемых сетей DLE
            </div>
          </div>


          <!-- Сеть для голосования -->
          <div class="form-group">
            <label for="votingChain" class="form-label">
              <i class="fas fa-network-wired"></i>
              Сеть для голосования *
            </label>
            <select 
              id="votingChain" 
              v-model="formData.votingChain" 
              class="form-select"
              required
            >
              <option value="">Выберите сеть для голосования</option>
              <option 
                v-for="chain in supportedChains" 
                :key="chain.chainId" 
                :value="chain.chainId"
              >
                {{ chain.name }} ({{ chain.chainId }})
              </option>
            </select>
            <div class="input-hint">
              Голосование будет проводиться в выбранной сети, но модуль добавится во все сети
            </div>
          </div>

          <!-- Длительность голосования -->
          <div class="form-group">
            <label for="votingDuration" class="form-label">
              <i class="fas fa-clock"></i>
              Длительность голосования (дни) *
            </label>
            <input 
              type="number" 
              id="votingDuration" 
              v-model.number="formData.votingDuration" 
              min="1" 
              max="365" 
              class="form-input"
              placeholder="Введите количество дней (1-365)"
              required
            />
            <div class="input-hint">От 1 до 365 дней</div>
          </div>

          <!-- Описание предложения -->
          <div class="form-group">
            <label for="description" class="form-label">
              <i class="fas fa-file-text"></i>
              Описание предложения *
            </label>
            <textarea 
              id="description" 
              v-model="formData.description" 
              class="form-textarea"
              placeholder="Опишите цель добавления модуля..."
              maxlength="500"
              rows="4"
              required
            ></textarea>
            <div class="input-hint">
              {{ formData.description.length }}/500 символов
            </div>
          </div>


          <!-- Предварительный просмотр -->
          <div v-if="showPreview" class="preview-section">
            <h3>Предварительный просмотр</h3>
            <div class="preview-content">
              <div class="preview-item">
                <strong>Тип модуля:</strong> {{ getSelectedModuleName() }}
              </div>
              <div class="preview-item">
                <strong>Адреса модуля:</strong> {{ selectedModuleAddresses.length }} сетей
                <ul class="preview-networks">
                  <li v-for="address in selectedModuleAddresses" :key="address.chainId">
                    {{ address.networkName }}: {{ address.address }}
                  </li>
                </ul>
              </div>
              <div class="preview-item">
                <strong>Сеть для голосования:</strong> {{ getSelectedChainName() }}
              </div>
              <div class="preview-item">
                <strong>Мультичейн деплой:</strong> {{ supportedChains.length }} сетей
                <ul class="preview-networks">
                  <li v-for="chain in supportedChains" :key="chain.chainId">
                    {{ chain.name }} ({{ chain.chainId }})
                  </li>
                </ul>
              </div>
              <div class="preview-item">
                <strong>Длительность:</strong> {{ formData.votingDuration }} дней
              </div>
              <div class="preview-item">
                <strong>Описание:</strong> {{ formData.description }}
              </div>
            </div>
          </div>


          <!-- Кнопки действий -->
          <div class="form-actions">
            <button 
              type="button" 
              @click="togglePreview" 
              class="btn btn-secondary"
              :disabled="!isFormValid"
            >
              <i class="fas fa-eye"></i>
              {{ showPreview ? 'Скрыть' : 'Предварительный просмотр' }}
            </button>
            
            <button 
              type="submit" 
              class="btn btn-primary"
              :disabled="!isFormValid || isSubmitting"
            >
              <i v-if="isSubmitting" class="fas fa-spinner fa-spin"></i>
              <i v-else class="fas fa-plus"></i>
              {{ isSubmitting ? 'Создание предложения...' : 'Создать предложение' }}
            </button>
          </div>
        </form>
        </div>
      </div>

      <!-- Модалка успеха -->
      <div v-if="showSuccessModal" class="modal-overlay" @click="closeSuccessModal">
        <div class="success-modal" @click.stop>
          <div class="success-header">
            <div class="success-icon">
              <i class="fas fa-check-circle"></i>
            </div>
            <h2>Предложение успешно создано!</h2>
          </div>
          
          <div class="success-content">
            <div class="success-details">
              <div class="detail-item">
                <i class="fas fa-hashtag"></i>
                <span class="label">ID предложения:</span>
                <span class="value">{{ successData.proposalId === 'неизвестно' ? 'неизвестно' : (Number(successData.proposalId) + 1) }}</span>
              </div>
              
              <div class="detail-item">
                <i class="fas fa-link"></i>
                <span class="label">Хеш транзакции:</span>
                <div class="value">
                  <span class="transaction-hash">{{ successData.transactionHash }}</span>
                  <a 
                    :href="getEtherscanUrl(successData.transactionHash, successData.votingChain)" 
                    target="_blank" 
                    class="etherscan-link"
                    title="Открыть в блокчейн-эксплорере"
                  >
                    <i class="fas fa-external-link-alt"></i>
                  </a>
                </div>
              </div>
              
              <div class="detail-item">
                <i class="fas fa-gas-pump"></i>
                <span class="label">Потрачено газа:</span>
                <span class="value">{{ successData.gasUsed }}</span>
              </div>

              <div class="detail-item">
                <i class="fas fa-network-wired"></i>
                <span class="label">Сеть голосования:</span>
                <span class="value">{{ successData.votingNetwork }}</span>
              </div>

              <div class="detail-item">
                <i class="fas fa-clock"></i>
                <span class="label">Длительность:</span>
                <span class="value">{{ successData.duration }} дней</span>
              </div>

              <div class="detail-item">
                <i class="fas fa-cube"></i>
                <span class="label">Тип модуля:</span>
                <span class="value">{{ successData.moduleType }}</span>
              </div>

              <div class="detail-item">
                <i class="fas fa-building"></i>
                <span class="label">Адрес DLE:</span>
                <span class="value dle-address">{{ successData.dleAddress }}</span>
              </div>

              <div class="detail-item">
                <i class="fas fa-map-marker-alt"></i>
                <span class="label">Адреса модуля:</span>
                <div class="value module-addresses-list">
                  <div v-for="addr in successData.moduleAddresses" :key="`${addr.chainId}-${addr.address}`" class="module-address-item">
                    <strong>{{ addr.networkName }}:</strong> {{ addr.address }}
                  </div>
                </div>
              </div>

              <div class="detail-item">
                <i class="fas fa-file-alt"></i>
                <span class="label">Описание:</span>
                <span class="value description-text">{{ successData.description }}</span>
              </div>
            </div>
            
            <div class="success-message">
              <p><strong>Мультичейн инициализация:</strong></p>
              <p>После успешного голосования модуль будет добавлен во все {{ successData.networksCount }} поддерживаемых сетей DLE:</p>
              <ul class="networks-list">
                <li v-for="network in successData.networks" :key="network.chainId">
                  <i class="fas fa-link"></i>
                  {{ network.name }} ({{ network.chainId }})
                </li>
              </ul>
            </div>
          </div>
          
          <div class="success-actions">
            <button @click="closeSuccessModal" class="btn btn-secondary">
              <i class="fas fa-times"></i>
              Закрыть
            </button>
            <button @click="openProposals" class="btn btn-primary">
              <i class="fas fa-external-link-alt"></i>
              Открыть предложения
            </button>
          </div>
        </div>
      </div>
    </BaseLayout>
  </template>

<script setup>
import { ref, computed, onMounted, defineProps, defineEmits } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import { getAllModules, getDeploymentId } from '../../services/modulesService.js';
import { createAddModuleProposal } from '../../utils/dle-contract.js';
import api from '../../api/axios';
import { ethers } from 'ethers';

const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

const emit = defineEmits(['auth-action-completed']);

const router = useRouter();
const route = useRoute();

// Получаем адрес DLE из URL
const dleAddress = computed(() => {
  const address = route.query.address;
  console.log('DLE Address from URL:', address);
  return address;
});

// Состояние DLE
const selectedDle = ref(null);
const isLoadingDle = ref(false);

// Доступные модули
const availableModules = ref([]);
const isLoadingModules = ref(false);

// Адреса модулей
const moduleAddresses = ref([]);
const isLoadingModuleAddresses = ref(false);

// Поддерживаемые сети (загружаются из API)
const supportedChains = ref([]);

// Данные формы
const formData = ref({
  moduleType: '',
  moduleAddress: '',
  votingChain: '',
  votingDuration: 7,
  description: ''
});

// Состояние UI
const showPreview = ref(false);
const isSubmitting = ref(false);
const deploymentId = ref(null);
const showSuccessModal = ref(false);
const successData = ref({
  proposalId: '',
  transactionHash: '',
  gasUsed: '',
  votingNetwork: '',
  duration: 0,
  moduleType: '',
  networksCount: 0,
  networks: []
});

// Вычисляемые свойства
const selectedModuleAddresses = computed(() => {
  if (!formData.value.moduleType) return [];
  
  const selectedModule = availableModules.value.find(m => m.moduleType === formData.value.moduleType);
  return selectedModule?.addresses || [];
});

const isFormValid = computed(() => {
  return formData.value.moduleType && 
         selectedModuleAddresses.value.length > 0 &&
         formData.value.votingChain && 
         formData.value.votingDuration >= 1 && 
         formData.value.votingDuration <= 365 &&
         formData.value.description.trim().length > 0;
});

// Функции
const goBackToProposals = () => {
  if (dleAddress.value) {
    router.push(`/management/create-proposal?address=${dleAddress.value}`);
  } else {
    router.push('/management/create-proposal');
  }
};

const loadDleData = async () => {
  if (!dleAddress.value) {
    console.warn('Адрес DLE не указан');
    return;
  }

  console.log('Начинаем загрузку данных DLE для адреса:', dleAddress.value);
  isLoadingDle.value = true;
  try {
    const response = await api.post('/blockchain/read-dle-info', {
      dleAddress: dleAddress.value
    });
    
    console.log('Ответ от API DLE:', response.data);
    
    if (response.data.success) {
      selectedDle.value = response.data.data;
      console.log('Загружены данные DLE:', selectedDle.value);
    } else {
      console.error('Ошибка загрузки DLE:', response.data.error);
    }
  } catch (error) {
    console.error('Ошибка загрузки данных DLE:', error);
  } finally {
    isLoadingDle.value = false;
  }
};

const loadAvailableModules = async () => {
  if (!dleAddress.value) {
    console.warn('Адрес DLE не указан для загрузки модулей');
    return;
  }

  isLoadingModules.value = true;
  try {
    const response = await getAllModules(dleAddress.value);
    console.log('Ответ от API модулей:', response);
    
    if (response.success && response.data && response.data.modules) {
      console.log('Модули из API:', response.data.modules);
      
      // Загружаем поддерживаемые сети
      if (response.data.supportedNetworks) {
        supportedChains.value = response.data.supportedNetworks.map(network => ({
          chainId: network.chainId,
          name: network.networkName,
          etherscanUrl: network.etherscanUrl
        }));
        console.log('Поддерживаемые сети:', supportedChains.value);
      }
      
      // Преобразуем данные из API в нужный формат
      const modules = response.data.modules.map(module => {
        // Создаем правильный moduleType из moduleName
        let moduleType = '';
        switch(module.moduleName) {
          case 'TREASURY':
            moduleType = 'treasury';
            break;
          case 'TIMELOCK':
            moduleType = 'timelock';
            break;
          case 'READER':
            moduleType = 'reader';
            break;
          case 'HIERARCHICALVOTING':
            moduleType = 'hierarchical-voting';
            break;
          default:
            moduleType = module.moduleName.toLowerCase();
        }
        
        console.log('Преобразование модуля:', module.moduleName, '->', moduleType);
        return {
          moduleType: moduleType,
          moduleName: module.moduleName,
          moduleDescription: module.moduleDescription,
          addresses: module.addresses || []
        };
      });
      
      console.log('Преобразованные модули:', modules);
      availableModules.value = modules;
    } else {
      console.error('Ошибка загрузки модулей:', response.error);
      availableModules.value = [];
    }
  } catch (error) {
    console.error('Ошибка загрузки модулей:', error);
    availableModules.value = [];
  } finally {
    isLoadingModules.value = false;
  }
};


const onModuleTypeChange = () => {
  // Автозаполнение описания
  const selectedModule = availableModules.value.find(m => m.moduleType === formData.value.moduleType);
  if (selectedModule) {
    formData.value.description = `Добавление модуля ${selectedModule.moduleName} для расширения функциональности DLE контракта. Модуль будет добавлен во все поддерживаемые сети DLE.`;
  }
};

const getSelectedModuleName = () => {
  const selectedModule = availableModules.value.find(m => m.moduleType === formData.value.moduleType);
  return selectedModule ? selectedModule.moduleName : '';
};

const getSelectedChainName = () => {
  const selectedChain = supportedChains.value.find(c => c.chainId === formData.value.votingChain);
  return selectedChain ? selectedChain.name : '';
};

const getModuleDisplayName = (moduleName) => {
  switch(moduleName) {
    case 'TREASURY':
      return 'Treasury Module';
    case 'TIMELOCK':
      return 'Timelock Module';
    case 'READER':
      return 'Reader Module';
    case 'HIERARCHICALVOTING':
      return 'Hierarchical Voting Module';
    default:
      return moduleName;
  }
};

const togglePreview = () => {
  showPreview.value = !showPreview.value;
};

const closeSuccessModal = () => {
  showSuccessModal.value = false;
  goBackToProposals();
};

const openProposals = () => {
  const proposalsUrl = `http://localhost:5173/management/proposals?address=${dleAddress.value}`;
  window.open(proposalsUrl, '_blank');
  closeSuccessModal();
};

// Функция для получения URL explorer'а на основе chainId
const getEtherscanUrl = (txHash, chainId) => {
  // Получаем информацию о сети из загруженных данных
  const networkInfo = supportedChains.value.find(chain => chain.chainId === chainId);
  
  if (networkInfo && networkInfo.etherscanUrl) {
    return `${networkInfo.etherscanUrl}/tx/${txHash}`;
  }
  
  // Fallback для известных сетей по chainId
  const fallbackUrls = {
    11155111: 'https://sepolia.etherscan.io',      // Sepolia
    80001: 'https://mumbai.polygonscan.com',       // Mumbai
    97: 'https://testnet.bscscan.com',             // BSC Testnet
    421614: 'https://sepolia.arbiscan.io'          // Arbitrum Sepolia
  };
  
  if (fallbackUrls[chainId]) {
    return `${fallbackUrls[chainId]}/tx/${txHash}`;
  }
  
  // Fallback для неизвестных сетей
  return `https://etherscan.io/tx/${txHash}`;
};



const submitForm = async () => {
  if (!isFormValid.value) return;

  isSubmitting.value = true;
  try {
    console.log('Создание предложения с данными:', formData.value);
    console.log('Выбранные адреса модуля:', selectedModuleAddresses.value);
    
    // Для мультичейн деплоя нужно передать все адреса модуля
    // Создаем предложение с первым адресом (для голосования)
    const primaryAddress = selectedModuleAddresses.value.find(addr => addr.chainId === formData.value.votingChain);
    
    if (!primaryAddress) {
      throw new Error('Не найден адрес модуля для выбранной сети голосования');
    }
    
    // Получаем deploymentId если он еще не получен
    if (!deploymentId.value) {
      console.log('Получаем deploymentId для автоматической оплаты газа...');
      const deploymentResult = await getDeploymentId(dleAddress.value);
      if (deploymentResult.success) {
        deploymentId.value = deploymentResult.data.deploymentId;
        console.log('DeploymentId получен:', deploymentId.value);
      } else {
        console.warn('DeploymentId не найден, будет использован PRIVATE_KEY из переменных окружения');
      }
    }
    
    // Преобразуем moduleType в bytes32 для смарт-контракта
    const moduleId = ethers.encodeBytes32String(formData.value.moduleType);
    
    // Создаем предложение с автоматической оплатой газа
    const result = await createAddModuleProposal(
      dleAddress.value,
      formData.value.description,
      formData.value.votingDuration * 24 * 60 * 60, // Конвертируем дни в секунды
      moduleId,
      primaryAddress.address,
      formData.value.votingChain,
      deploymentId.value // Передаем deploymentId для автоматической оплаты газа
    );
    
    console.log('Предложение создано:', result);
    
    // Получаем название сети голосования
    const votingNetworkName = getSelectedChainName();
    
    // Получаем название типа модуля
    const moduleTypeName = getSelectedModuleName();
    
    // Показываем красивую модалку об успехе
    showSuccessModal.value = true;
    successData.value = {
      proposalId: result.proposalId || 'неизвестно',
      transactionHash: result.transactionHash,
      gasUsed: result.gasUsed || 'неизвестно',
      votingNetwork: votingNetworkName,
      votingChain: formData.value.votingChain, // Добавляем chainId для explorer'а
      duration: formData.value.votingDuration,
      moduleType: moduleTypeName,
      dleAddress: dleAddress.value,
      moduleAddresses: selectedModuleAddresses.value,
      description: formData.value.description,
      networksCount: selectedModuleAddresses.value.length,
      networks: selectedModuleAddresses.value.map(addr => ({
        name: addr.networkName,
        chainId: addr.chainId
      }))
    };
    
  } catch (error) {
    console.error('Ошибка создания предложения:', error);
    alert('Ошибка при создании предложения: ' + error.message);
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(async () => {
  console.log('Компонент AddModuleFormView смонтирован');
  console.log('Адрес DLE из URL:', dleAddress.value);
  
  if (dleAddress.value) {
    console.log('Загружаем данные DLE и модули...');
    await Promise.all([
      loadDleData(),
      loadAvailableModules()
    ]);
  } else {
    console.warn('Адрес DLE не найден в URL');
    // Если адрес не передан, используем тестовый адрес
    const testAddress = '0x40A99dBEC8D160a226E856d370dA4f3C67713940';
    console.log('Используем тестовый адрес DLE:', testAddress);
    
    // Обновляем URL с тестовым адресом
    router.replace(`/management/add-module?address=${testAddress}`);
    
    // Загружаем данные с тестовым адресом
    await Promise.all([
      loadDleData(),
      loadAvailableModules()
    ]);
  }
});
</script>

<style scoped>
.add-module-page {
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

/* Уведомление об авторизации */
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

/* Форма */
.add-module-form {
  max-width: 800px;
  margin: 0 auto;
}

.form-container {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid #e9ecef;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.form-label i {
  color: var(--color-primary);
  width: 16px;
}

.form-select,
.form-input,
.form-textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s;
  background: white;
}

.form-select:focus,
.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.form-select:disabled,
.form-input:disabled,
.form-textarea:disabled {
  background: #f8f9fa;
  cursor: not-allowed;
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.input-hint {
  font-size: 0.875rem;
  color: #6c757d;
  margin-top: 0.25rem;
}

.loading-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-primary);
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.no-modules-warning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #dc3545;
  font-size: 0.875rem;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  flex-wrap: wrap;
}

.btn-reload-modules {
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
  transition: background-color 0.2s;
}

.btn-reload-modules:hover {
  background: #c82333;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: 0.5rem;
}

.status-badge.active {
  background: #d4edda;
  color: #155724;
}

.status-badge.inactive {
  background: #f8d7da;
  color: #721c24;
}

/* Информация о мультичейн деплое */
.multichain-info {
  margin: 1.5rem 0;
}

.info-box {
  background: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.info-box i {
  color: #1976d2;
  margin-top: 0.25rem;
  flex-shrink: 0;
}

.info-content {
  flex-grow: 1;
}

.info-content strong {
  color: #1976d2;
  font-weight: 600;
}

.info-content p {
  margin: 0.5rem 0;
  color: #424242;
  font-size: 0.9rem;
}

.networks-list {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
}

.networks-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
  font-size: 0.875rem;
  color: #424242;
}

.networks-list li i {
  color: #1976d2;
  font-size: 0.75rem;
}

/* Адреса модуля */
.module-addresses {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  margin: 0.5rem 0;
}

.address-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid #e9ecef;
}

.address-item:last-child {
  border-bottom: none;
}

.address-info {
  flex-grow: 1;
}

.address-info strong {
  color: #333;
  font-weight: 600;
  display: block;
  margin-bottom: 0.25rem;
}

.address-value {
  font-family: monospace;
  font-size: 0.875rem;
  color: #666;
  background: #fff;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

.address-status {
  flex-shrink: 0;
  margin-left: 1rem;
}



/* Модалка успеха */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.success-modal {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.success-header {
  text-align: center;
  padding: 2rem 2rem 1rem;
  border-bottom: 1px solid #e9ecef;
}

.success-icon {
  font-size: 4rem;
  color: #28a745;
  margin-bottom: 1rem;
  animation: successPulse 0.6s ease-out;
}

@keyframes successPulse {
  0% { transform: scale(0.8); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

.success-header h2 {
  color: #28a745;
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.success-content {
  padding: 1.5rem 2rem;
}

.success-details {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.detail-item {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  gap: 0.75rem;
}

.detail-item:last-child {
  margin-bottom: 0;
}

.detail-item i {
  color: #6c757d;
  width: 20px;
  text-align: center;
}

.detail-item .label {
  font-weight: 600;
  color: #495057;
  min-width: 140px;
}

.detail-item .value {
  color: #212529;
  font-family: monospace;
  font-size: 0.9rem;
}

.transaction-hash {
  word-break: break-all;
  background: #e9ecef;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  margin-right: 0.5rem;
}

.etherscan-link {
  color: #007bff;
  text-decoration: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: #e3f2fd;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.etherscan-link:hover {
  background: #bbdefb;
  color: #0056b3;
  transform: translateY(-1px);
}

.dle-address {
  word-break: break-all;
  background: #e3f2fd;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #1976d2;
}

.module-addresses-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.module-address-item {
  background: #f8f9fa;
  padding: 0.5rem;
  border-radius: 6px;
  border-left: 3px solid #007bff;
  font-size: 0.85rem;
}

.module-address-item strong {
  color: #007bff;
  margin-right: 0.5rem;
}

.description-text {
  background: #f8f9fa;
  padding: 0.75rem;
  border-radius: 6px;
  border-left: 3px solid #28a745;
  font-style: italic;
  line-height: 1.4;
  max-height: 100px;
  overflow-y: auto;
}

.success-message {
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  border: 1px solid #2196f3;
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
}

.success-message p {
  margin: 0 0 1rem 0;
  color: #1976d2;
  font-weight: 500;
}

.success-message p:last-child {
  margin-bottom: 0;
}

.networks-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0 0;
  text-align: left;
}

.networks-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(25, 118, 210, 0.1);
}

.networks-list li:last-child {
  border-bottom: none;
}

.networks-list li i {
  color: #1976d2;
  font-size: 0.75rem;
}

.success-actions {
  display: flex;
  gap: 1rem;
  padding: 1.5rem 2rem;
  border-top: 1px solid #e9ecef;
  justify-content: flex-end;
}

.success-actions .btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.2s ease;
  border: none;
  cursor: pointer;
}

.success-actions .btn-secondary {
  background: #6c757d;
  color: white;
}

.success-actions .btn-secondary:hover {
  background: #5a6268;
  transform: translateY(-1px);
}

.success-actions .btn-primary {
  background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
}

.success-actions .btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(0, 123, 255, 0.4);
}

/* Предварительный просмотр */
.preview-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  margin: 1.5rem 0;
  border: 1px solid #e9ecef;
}

.preview-section h3 {
  color: var(--color-primary);
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
}

.preview-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.preview-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e9ecef;
}

.preview-item:last-child {
  border-bottom: none;
}

.preview-item strong {
  color: #333;
  min-width: 150px;
}

.preview-networks {
  list-style: none;
  padding: 0;
  margin: 0.25rem 0 0 0;
  font-size: 0.875rem;
  color: #666;
}

.preview-networks li {
  padding: 0.125rem 0;
  margin-left: 1rem;
}

/* Кнопки действий */
.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e9ecef;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
  transform: translateY(-1px);
}

/* Адаптивность */
@media (max-width: 768px) {
  .form-container {
    padding: 1rem;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
    justify-content: center;
  }
  
  .preview-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
}
</style>
