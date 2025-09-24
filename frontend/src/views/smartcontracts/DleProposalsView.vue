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
    <div class="dle-proposals-management">
      <!-- Заголовок в стиле настроек -->
      <div class="page-header">
        <div class="header-content">
          <h1>Предложения DLE</h1>
          <p v-if="selectedDle">{{ selectedDle.name }} ({{ selectedDle.symbol }}) - {{ selectedDle.dleAddress }}</p>
          <p v-else-if="isLoadingDle">Загрузка...</p>
          <p v-else>DLE не выбран</p>
        </div>
        <button class="close-btn" @click="goBackToBlocks">×</button>
        </div>

      <!-- Фильтры и управление -->
      <div class="controls-section">
        <div class="controls-header">
          <h3>Фильтры</h3>
        </div>
        <div class="controls-content">
          <div class="filters-row">
            <select v-model="statusFilter" class="form-control">
              <option value="">Все статусы</option>
              <option value="active">Активные</option>
              <option value="pending">Ожидающие</option>
              <option value="succeeded">Принятые</option>
              <option value="defeated">Отклоненные</option>
              <option value="executed">Выполненные</option>
              <option value="canceled">Отмененные</option>
            </select>
            <button 
              class="btn btn-sm btn-outline-secondary" 
              @click="loadDleData"
              :disabled="isLoadingDle"
            >
              <i class="fas fa-sync-alt"></i> Обновить
            </button>
      </div>
        </div>
      </div>

      <div v-if="filteredProposals.length === 0" class="no-proposals">
        <p>Предложений пока нет</p>
      </div>

      <div v-else class="proposals-grid">
        <div 
          v-for="proposal in filteredProposals" 
          :key="proposal.id" 
          class="proposal-card"
          :class="proposal.status"
        >

          <div class="proposal-header">
            <h5>{{ getProposalTitle(proposal) }}</h5>
            <span class="proposal-status" :class="proposal.status">
              {{ getProposalStatusText(proposal.status) }}
            </span>
          </div>

          <div class="proposal-details">
            <div class="detail-item">
              <strong>ID:</strong> #{{ proposal.id }}
            </div>
            <div class="detail-item">
              <strong>Создатель:</strong> {{ shortenAddress(proposal.initiator) }}
            </div>
            <div class="detail-item">
              <strong>Создано:</strong> {{ formatDate(proposal.blockNumber ? proposal.blockNumber * 1000 : Date.now()) }}
            </div>
            <div class="detail-item">
              <strong>Цепочка:</strong> {{ getChainName(proposal.governanceChainId) || 'Неизвестная сеть' }}
            </div>
            <div class="detail-item">
              <strong>Дедлайн:</strong> {{ formatDate(proposal.deadline) }}
            </div>
            
            <!-- Детальная информация о модуле -->
            <div v-if="proposal.decodedData" class="module-details">
              <div class="detail-item">
                <strong>Тип модуля:</strong> {{ getModuleName(proposal.decodedData.moduleId) }}
              </div>
              <div class="detail-item">
                <strong>Адрес модуля:</strong> 
                <a :href="getEtherscanUrl(proposal.decodedData.moduleAddress, proposal.decodedData.chainId)" 
                   target="_blank" class="address-link">
                  {{ shortenAddress(proposal.decodedData.moduleAddress) }}
                </a>
              </div>
              <div class="detail-item">
                <strong>Сеть:</strong> {{ getChainName(proposal.decodedData.chainId) }}
              </div>
              <div class="detail-item">
                <strong>Длительность:</strong> {{ formatDuration(proposal.decodedData.duration) }}
              </div>
            </div>
            
            <div class="detail-item">
              <strong>Голоса:</strong> 
              <div class="votes-container">
                <div class="votes-info">
                  <span class="for">За: {{ formatVotes(proposal.forVotes) }}</span>
                  <span class="against">Против: {{ formatVotes(proposal.againstVotes) }}</span>
                </div>
                <div class="quorum-info">
                  <span class="quorum-percentage">Кворум: {{ getQuorumPercentage(proposal) }}% из {{ getRequiredQuorum(proposal) }}%</span>
                </div>
                <div class="quorum-progress">
                  <div class="progress-bar">
                    <div 
                      class="progress-fill" 
                      :style="{ width: getQuorumProgress(proposal) + '%' }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            <div class="detail-item" v-if="proposal.operation && proposal.operation !== '0x'">
              <strong>Операция:</strong> 
              <span class="operation">{{ decodeOperation(proposal.operation) }}</span>
            </div>
            <div class="detail-item" v-if="getOperationDetails(proposal.operation, proposal)">
              <strong>Детали операции:</strong> 
              <span class="operation-details">{{ getOperationDetails(proposal.operation, proposal) }}</span>
            </div>
          </div>

          <div class="proposal-actions">
            <button 
              v-if="canSign(proposal) && props.isAuthenticated && hasAdminRights()"
              class="btn btn-sm btn-success" 
              @click="signProposalLocal(proposal.id)"
              :disabled="hasSigned(proposal.id)"
            >
              <i class="fas fa-signature"></i> Подписать
      </button>
            <button 
              v-if="canVoteAgainst(proposal) && props.isAuthenticated && hasAdminRights()"
              class="btn btn-sm btn-warning" 
              @click="cancelSignatureLocal(proposal.id)"
              :disabled="hasVotedAgainst(proposal.id)"
            >
              <i class="fas fa-times"></i> Против
            </button>
            <button 
              v-if="canExecute(proposal) && props.isAuthenticated"
              class="btn btn-sm btn-primary" 
              @click="executeProposalLocal(proposal.id)"
            >
              <i class="fas fa-play"></i> Исполнить
            </button>
            
            <!-- Информация для не-инициаторов -->
            <div v-else-if="proposal.state === 5 && !proposal.executed && props.isAuthenticated" class="execution-notice">
              <small class="text-muted">
                <i class="fas fa-info-circle"></i> 
                Только инициатор предложения может его исполнить
              </small>
            </div>
            
            <!-- Информация для неавторизованных пользователей -->
            <div v-if="!props.isAuthenticated" class="auth-notice">
              <small class="text-muted">
                <i class="fas fa-info-circle"></i> 
                Для участия в голосовании необходимо авторизоваться
              </small>
            </div>
            <div v-else-if="!hasAdminRights()" class="auth-notice">
              <small class="text-muted">
                <i class="fas fa-lock"></i> 
                Для участия в голосовании необходимы права администратора
              </small>
    </div>

          </div>
        </div>
      </div>
    </div>

    <!-- Форма создания предложения (всегда внизу страницы) -->
    <div class="create-proposal-form">
      <div class="form-header">
        <h4>📝 Создание нового предложения</h4>
        <!-- Кнопка закрытия больше не нужна -->
      </div>
      
      <!-- Информация для неавторизованных пользователей -->
      <div v-if="!props.isAuthenticated" class="auth-notice-form">
        <div class="alert alert-info">
          <i class="fas fa-info-circle"></i>
          <strong>Для создания предложений необходимо авторизоваться в приложении</strong>
          <p class="mb-0 mt-2">Подключите кошелек в сайдбаре для создания новых предложений</p>
        </div>
      </div>
      
      <!-- Форма только для авторизованных пользователей -->
      <div v-else>
      
      <div class="form-content">
        <!-- Основная информация -->
        <div class="form-section">
          <h5>📋 Основная информация</h5>
          
          <div class="form-group">
            <label for="proposalDescription">Описание предложения:</label>
            <textarea 
              id="proposalDescription" 
              v-model="newProposal.description" 
              class="form-control" 
              rows="3"
              placeholder="Опишите, что нужно сделать..."
            ></textarea>
          </div>
          
          <div class="form-group">
            <label for="proposalDuration">Длительность голосования (дни):</label>
            <input 
              type="number" 
              id="proposalDuration" 
              v-model.number="newProposal.duration" 
              class="form-control"
              min="1"
              max="30"
              placeholder="7"
            >
          </div>
        </div>

        <!-- Timelock -->
        <div class="form-section">
          <h5>⏳ Timelock</h5>
          <div class="form-group-inline">
            <label for="timelockHours">Задержка исполнения (часы):</label>
            <input id="timelockHours" type="number" min="0" step="1" v-model.number="newProposal.timelockHours" class="form-control small" />
          </div>
        </div>

        <!-- Выбор цепочки для кворума -->
        <div class="form-section">
          <h5>🔗 Выбор цепочки для кворума</h5>
          <p class="form-help">Выберите цепочку, в которой будет происходить сбор голосов</p>
          
          <div class="chains-grid">
            <div 
              v-for="chain in availableChains" 
              :key="chain.chainId"
              class="chain-option"
              :class="{ 'selected': newProposal.governanceChainId === chain.chainId }"
              @click="newProposal.governanceChainId = chain.chainId"
            >
              <div class="chain-info">
                <h6>{{ chain.name }}</h6>
                <span class="chain-id">Chain ID: {{ chain.chainId }}</span>
                <p class="chain-description">{{ chain.description }}</p>
              </div>
              <div class="chain-status">
                <i v-if="newProposal.governanceChainId === chain.chainId" class="fas fa-check"></i>
              </div>
            </div>
          </div>
        </div>

        

        <!-- Целевые сети для исполнения (мультиселект) -->
        <div class="form-section" v-if="showTargetChains">
          <h5>🎯 Целевые сети для исполнения</h5>
          <div class="targets-grid">
            <label v-for="chain in availableChains" :key="chain.chainId" class="target-item">
              <input type="checkbox" :value="chain.chainId" v-model="newProposal.targetChains" />
              <span>{{ chain.name }} ({{ chain.chainId }})</span>
            </label>
          </div>
          <small class="text-muted">Выберите хотя бы одну целевую сеть для исполнения операции.</small>
          <div v-if="showTargetChains && newProposal.targetChains.length === 0" class="form-error">
            <small class="text-danger">⚠️ Необходимо выбрать хотя бы одну целевую сеть</small>
          </div>
        </div>

        

        <!-- Тип операции (последним блоком) -->
        <div class="form-section">
          <h5>⚙️ Тип операции</h5>
          
          <div class="operation-types">
            <div class="form-group">
              <label for="operationType">Выберите тип операции:</label>
              <select id="operationType" v-model="newProposal.operationType" class="form-control">
                <option value="">-- Выберите тип --</option>
                <option value="transfer">Передача токенов</option>
                <option value="mint">Минтинг токенов</option>
                <option value="burn">Сжигание токенов</option>
                <option value="updateDLEInfo">Обновить данные DLE</option>
                <option value="updateQuorum">Изменить кворум</option>
                <option value="updateChain">Изменить текущую цепочку</option>
                <option value="custom">Пользовательская операция</option>
              </select>
            </div>

            <!-- Параметры для передачи токенов -->
            <div v-if="newProposal.operationType === 'transfer'" class="operation-params">
              <div class="form-group">
                <label for="transferTo">Адрес получателя:</label>
                <input 
                  type="text" 
                  id="transferTo" 
                  v-model="newProposal.operationParams.to" 
                  class="form-control"
                  placeholder="0x1234567890abcdef1234567890abcdef12345678"
                  :class="{ 'is-invalid': newProposal.operationParams.to && !validateAddress(newProposal.operationParams.to) }"
                >
                <small class="form-text text-muted">Введите корректный Ethereum адрес (42 символа, начинается с 0x)</small>
              </div>
              <div class="form-group">
                <label for="transferAmount">Количество токенов:</label>
                <input 
                  type="number" 
                  id="transferAmount" 
                  v-model.number="newProposal.operationParams.amount" 
                  class="form-control"
                  min="1"
                  placeholder="100"
                  :class="{ 'is-invalid': newProposal.operationParams.amount <= 0 }"
                >
                <small class="form-text text-muted">Введите количество токенов для передачи</small>
              </div>
            </div>

            <!-- Параметры для минтинга -->
            <div v-if="newProposal.operationType === 'mint'" class="operation-params">
              <div class="form-group">
                <label for="mintTo">Адрес получателя:</label>
                <input 
                  type="text" 
                  id="mintTo" 
                  v-model="newProposal.operationParams.to" 
                  class="form-control"
                  placeholder="0x..."
                >
              </div>
              <div class="form-group">
                <label for="mintAmount">Количество токенов:</label>
                <input 
                  type="number" 
                  id="mintAmount" 
                  v-model.number="newProposal.operationParams.amount" 
                  class="form-control"
                  min="1"
                  placeholder="1000"
                >
              </div>
            </div>

            <!-- Параметры для сжигания -->
            <div v-if="newProposal.operationType === 'burn'" class="operation-params">
              <div class="form-group">
                <label for="burnFrom">Адрес владельца:</label>
                <input 
                  type="text" 
                  id="burnFrom" 
                  v-model="newProposal.operationParams.from" 
                  class="form-control"
                  placeholder="0x..."
                >
              </div>
              <div class="form-group">
                <label for="burnAmount">Количество токенов:</label>
                <input 
                  type="number" 
                  id="burnAmount" 
                  v-model.number="newProposal.operationParams.amount" 
                  class="form-control"
                  min="1"
                  placeholder="100"
                >
              </div>
            </div>

            <!-- Пользовательская операция -->
            <div v-if="newProposal.operationType === 'custom'" class="operation-params">
              <div class="form-group">
                <label for="customOperation">Пользовательская операция (hex):</label>
                <textarea 
                  id="customOperation" 
                  v-model="newProposal.operationParams.customData" 
                  class="form-control"
                  rows="3"
                  placeholder="0x..."
                ></textarea>
              </div>
            </div>

            <!-- Параметры для обновления данных DLE -->
            <div v-if="newProposal.operationType === 'updateDLEInfo'" class="operation-params">
              <div class="form-group">
                <label for="dleName">Новое название DLE:</label>
                <input 
                  type="text" 
                  id="dleName" 
                  v-model="newProposal.operationParams.name" 
                  class="form-control"
                  placeholder="Новое название"
                >
              </div>
              <div class="form-group">
                <label for="dleSymbol">Новый символ токена:</label>
                <input 
                  type="text" 
                  id="dleSymbol" 
                  v-model="newProposal.operationParams.symbol" 
                  class="form-control"
                  placeholder="Новый символ"
                >
              </div>
              <div class="form-group">
                <label for="dleLocation">Новое местонахождение:</label>
                <input 
                  type="text" 
                  id="dleLocation" 
                  v-model="newProposal.operationParams.location" 
                  class="form-control"
                  placeholder="Новое местонахождение"
                >
              </div>
              <div class="form-group">
                <label for="dleCoordinates">Новые координаты:</label>
                <input 
                  type="text" 
                  id="dleCoordinates" 
                  v-model="newProposal.operationParams.coordinates" 
                  class="form-control"
                  placeholder="44.0422736,43.062124"
                >
              </div>
              <div class="form-group">
                <label for="dleJurisdiction">Новая юрисдикция:</label>
                <input 
                  type="number" 
                  id="dleJurisdiction" 
                  v-model.number="newProposal.operationParams.jurisdiction" 
                  class="form-control"
                  placeholder="643"
                >
              </div>
              <div class="form-group">
                <label for="dleOktmo">Новый ОКТМО:</label>
                <input 
                  type="number" 
                  id="dleOktmo" 
                  v-model.number="newProposal.operationParams.oktmo" 
                  class="form-control"
                  placeholder="45000000000"
                >
              </div>
              <div class="form-group">
                <label for="dleKpp">Новый КПП:</label>
                <input 
                  type="number" 
                  id="dleKpp" 
                  v-model.number="newProposal.operationParams.kpp" 
                  class="form-control"
                  placeholder="770101001"
                >
              </div>
            </div>

            <!-- Параметры для изменения кворума -->
            <div v-if="newProposal.operationType === 'updateQuorum'" class="operation-params">
              <div class="form-group">
                <label for="newQuorum">Новый процент кворума:</label>
                <input 
                  type="number" 
                  id="newQuorum" 
                  v-model.number="newProposal.operationParams.quorumPercentage" 
                  class="form-control"
                  min="1"
                  max="100"
                  placeholder="51"
                >
                <small class="form-text text-muted">Процент от общего количества токенов (1-100%)</small>
              </div>
            </div>

            <!-- Параметры для изменения текущей цепочки -->
            <div v-if="newProposal.operationType === 'updateChain'" class="operation-params">
              <div class="form-group">
                <label for="newChainId">Новая текущая цепочка:</label>
                <select id="newChainId" v-model="newProposal.operationParams.chainId" class="form-control">
                  <option value="">-- Выберите цепочку --</option>
                  <option v-for="chain in availableChains" :key="chain.chainId" :value="chain.chainId">
                    {{ chain.name }} ({{ chain.chainId }})
                  </option>
                </select>
                <small class="form-text text-muted">Выберите новую цепочку для управления DLE</small>
              </div>
            </div>
          </div>
        </div>

        <!-- Действия -->
        <div class="form-actions">
          <button 
            class="btn btn-success" 
            @click="createProposal" 
            :disabled="!isFormValid || isCreating"
          >
            <i class="fas fa-paper-plane"></i> 
            {{ isCreating ? 'Создание...' : 'Создать предложение' }}
          </button>
          <button class="btn btn-secondary" @click="resetForm">
            <i class="fas fa-undo"></i> Сбросить
          </button>
        </div>

        <!-- Предварительный просмотр (в конце формы) -->
        <div class="form-section">
          <h5>👁️ Предварительный просмотр</h5>
          <div class="preview-card">
            <div class="preview-item">
              <strong>Описание:</strong> {{ newProposal.description || 'Не указано' }}
            </div>
            <div class="preview-item">
              <strong>Длительность:</strong> {{ newProposal.duration || 7 }} дней
            </div>
            <div class="preview-item">
              <strong>Цепочка для кворума:</strong> 
              {{ getChainName(newProposal.governanceChainId) || 'Не выбрана' }}
            </div>
            <div class="preview-item">
              <strong>Тип операции:</strong> {{ getOperationTypeName(newProposal.operationType) || 'Не выбран' }}
            </div>
            <div v-if="newProposal.operationType" class="preview-item">
              <strong>Параметры:</strong> {{ getOperationParamsPreview() }}
            </div>
          </div>
        </div>
      </div>
      </div> <!-- Закрываем div для авторизованных пользователей -->
  </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, defineProps, defineEmits, inject } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthContext } from '../../composables/useAuth';
import BaseLayout from '../../components/BaseLayout.vue';
import { getDLEInfo, getSupportedChains } from '../../services/dleV2Service.js';
import { getProposals, createProposal as createProposalAPI, voteOnProposal as voteForProposalAPI, executeProposal as executeProposalAPI, decodeProposalData } from '../../services/proposalsService.js';
import api from '../../api/axios';
const showTargetChains = computed(() => {
  // Для offchain-действий не требуется ончейн исполнение (здесь типы пока ончейн)
  // Можно расширить логику при появлении offchain типа
  return true;
});
import wsClient from '../../utils/websocket.js';
import { ethers } from 'ethers';

// Best Practice: WebSocket-based подписка на обновления голосования
function subscribeToVoteUpdates(txHash, proposalId, actionType) {
  console.log('[DleProposalsView] Подписываемся на WebSocket уведомления для:', { txHash, proposalId, actionType });
  
  // Создаем уникальный обработчик для этой транзакции
  const voteHandler = (data) => {
    console.log('[DleProposalsView] Получено WebSocket уведомление о голосовании:', data);
    
    // Проверяем, что это наша транзакция
    if (data.txHash === txHash || data.proposalId === proposalId) {
      console.log('[DleProposalsView] Найдено совпадение транзакции, обновляем данные');
      
      // Обновляем данные
      loadDleData().then(() => {
        // Показываем успешное уведомление
        showSuccessNotification(txHash, actionType);
      });
      
      // Отписываемся от уведомлений
      wsClient.off('proposal_voted', voteHandler);
    }
  };
  
  // Подписываемся на уведомления о голосовании
  wsClient.on('proposal_voted', voteHandler);
  
  // Устанавливаем таймаут на случай, если WebSocket не сработает
  setTimeout(() => {
    console.warn('[DleProposalsView] Таймаут WebSocket уведомлений, отписываемся');
    wsClient.off('proposal_voted', voteHandler);
    
    // Fallback: обновляем данные в любом случае
    loadDleData().then(() => {
      showTimeoutNotification(txHash, actionType);
    });
  }, 60000); // 60 секунд таймаут
}

// WebSocket-based подписка на обновления исполнения
function subscribeToExecutionUpdates(txHash, proposalId) {
  console.log('[DleProposalsView] Подписываемся на WebSocket уведомления для исполнения:', { txHash, proposalId });
  
  // Создаем уникальный обработчик для этой транзакции
  const executionHandler = (data) => {
    console.log('[DleProposalsView] Получено WebSocket уведомление об исполнении:', data);
    
    // Проверяем, что это наша транзакция
    if (data.txHash === txHash || data.proposalId === proposalId) {
      console.log('[DleProposalsView] Найдено совпадение транзакции исполнения, обновляем данные');
      
      // Обновляем данные
      loadDleData().then(() => {
        // Показываем успешное уведомление
        showSuccessNotification(txHash, 'execution');
      });
      
      // Отписываемся от уведомлений
      wsClient.off('proposal_executed', executionHandler);
    }
  };
  
  // Подписываемся на уведомления об исполнении
  wsClient.on('proposal_executed', executionHandler);
  
  // Устанавливаем таймаут на случай, если WebSocket не сработает
  setTimeout(() => {
    console.warn('[DleProposalsView] Таймаут WebSocket уведомлений об исполнении, отписываемся');
    wsClient.off('proposal_executed', executionHandler);
    
    // Fallback: обновляем данные в любом случае
    loadDleData().then(() => {
      showTimeoutNotification(txHash, 'execution');
    });
  }, 60000); // 60 секунд таймаут
}

// Функция для отслеживания транзакции исполнения на backend
async function trackExecutionTransaction(txHash, dleAddress, proposalId) {
  try {
    console.log('[DleProposalsView] Запускаем отслеживание транзакции исполнения на backend:', { txHash, dleAddress, proposalId });
    
    const response = await api.post('/dle-proposals/track-execution-transaction', {
      txHash: txHash,
      dleAddress: dleAddress,
      proposalId: proposalId
    });
    
    if (response.data.success) {
      console.log('[DleProposalsView] Backend подтвердил транзакцию исполнения:', response.data);
    } else {
      console.warn('[DleProposalsView] Backend не смог подтвердить транзакцию исполнения:', response.data.error);
    }
  } catch (error) {
    console.error('[DleProposalsView] Ошибка при отслеживании транзакции исполнения на backend:', error);
  }
}

// Функция для отслеживания транзакции голосования на backend
async function trackVoteTransaction(txHash, dleAddress, proposalId, support) {
  try {
    console.log('[DleProposalsView] Запускаем отслеживание транзакции на backend:', { txHash, dleAddress, proposalId, support });
    
    const response = await api.post('/dle-proposals/track-vote-transaction', {
      txHash: txHash,
      dleAddress: dleAddress,
      proposalId: proposalId,
      support: support
    });
    
    if (response.data.success) {
      console.log('[DleProposalsView] Backend подтвердил транзакцию:', response.data);
    } else {
      console.warn('[DleProposalsView] Backend не смог подтвердить транзакцию:', response.data.error);
    }
  } catch (error) {
    console.error('[DleProposalsView] Ошибка при отслеживании транзакции на backend:', error);
  }
}

// Показ уведомления о транзакции
function showTransactionNotification(txHash, message) {
  // Создаем уведомление с ссылкой на Etherscan
  const etherscanUrl = `https://sepolia.etherscan.io/tx/${txHash}`;
  
  // Можно использовать toast-библиотеку или создать кастомное уведомление
  const notification = document.createElement('div');
  notification.className = 'transaction-notification';
  notification.innerHTML = `
    <div class="notification-content">
      <div class="notification-header">
        <span class="notification-icon">⏳</span>
        <span class="notification-title">${message}</span>
      </div>
      <div class="notification-body">
        <p>Ожидаем подтверждения транзакции...</p>
        <a href="${etherscanUrl}" target="_blank" class="etherscan-link">
          Посмотреть в Etherscan
        </a>
      </div>
    </div>
  `;
  
  // Добавляем стили
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    max-width: 300px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  document.body.appendChild(notification);
  
  // Автоматически удаляем через 10 секунд
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 10000);
}

// Показ успешного уведомления
function showSuccessNotification(txHash, actionType) {
  const actionText = actionType === 'vote' ? 'Голосование подтверждено!' : 'Голосование "против" подтверждено!';
  const etherscanUrl = `https://sepolia.etherscan.io/tx/${txHash}`;
  
  const notification = document.createElement('div');
  notification.className = 'success-notification';
  notification.innerHTML = `
    <div class="notification-content">
      <div class="notification-header">
        <span class="notification-icon">✅</span>
        <span class="notification-title">${actionText}</span>
      </div>
      <div class="notification-body">
        <p>Данные обновлены</p>
        <a href="${etherscanUrl}" target="_blank" class="etherscan-link">
          Посмотреть в Etherscan
        </a>
      </div>
    </div>
  `;
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #d4edda;
    border: 1px solid #c3e6cb;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    max-width: 300px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
}

// Показ уведомления об ошибке
function showErrorNotification(txHash, message) {
  const etherscanUrl = `https://sepolia.etherscan.io/tx/${txHash}`;
  
  const notification = document.createElement('div');
  notification.className = 'error-notification';
  notification.innerHTML = `
    <div class="notification-content">
      <div class="notification-header">
        <span class="notification-icon">❌</span>
        <span class="notification-title">${message}</span>
      </div>
      <div class="notification-body">
        <a href="${etherscanUrl}" target="_blank" class="etherscan-link">
          Посмотреть в Etherscan
        </a>
      </div>
    </div>
  `;
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    max-width: 300px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 8000);
}

// Показ уведомления о таймауте
function showTimeoutNotification(txHash, actionType) {
  const actionText = actionType === 'vote' ? 'Голосование' : 'Голосование "против"';
  const etherscanUrl = `https://sepolia.etherscan.io/tx/${txHash}`;
  
  const notification = document.createElement('div');
  notification.className = 'timeout-notification';
  notification.innerHTML = `
    <div class="notification-content">
      <div class="notification-header">
        <span class="notification-icon">⏰</span>
        <span class="notification-title">${actionText} отправлено</span>
      </div>
      <div class="notification-body">
        <p>Подтверждение не получено, но данные обновлены</p>
        <a href="${etherscanUrl}" target="_blank" class="etherscan-link">
          Посмотреть в Etherscan
        </a>
      </div>
    </div>
  `;
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    max-width: 300px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 8000);
}

const props = defineProps({
  dleAddress: { type: String, required: false, default: null },
  dleContract: { type: Object, required: false, default: null },
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

// Получаем данные из BaseLayout через inject
const injectedIsAuthenticated = inject('isAuthenticated', computed(() => false));
const injectedIdentities = inject('identities', computed(() => []));
const injectedTokenBalances = inject('tokenBalances', computed(() => null));
const injectedIsLoadingTokens = inject('isLoadingTokens', computed(() => false));

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

// Состояние формы
// const showCreateForm = ref(false); // Больше не нужно - форма всегда видна
const isCreating = ref(false);
const statusFilter = ref('');

// Новое предложение
const newProposal = ref({
  description: '',
  duration: 7,
  governanceChainId: null,
  timelockHours: 0,
  targetChains: [],
  operationType: '',
  operationParams: {
    to: '',
    from: '',
    amount: 0,
    customData: '',
    name: '',
    symbol: '',
    location: '',
    coordinates: '',
    jurisdiction: 0,
    oktmo: 0,
    kpp: 0,
    chainId: ''
  }
});

// Доступные цепочки (загружаются из конфигурации)
const availableChains = ref([]);

// Предложения
const proposals = ref([]);



// Вычисляемые свойства
const isFormValid = computed(() => {
  return (
    newProposal.value.description &&
    newProposal.value.duration > 0 &&
    newProposal.value.governanceChainId &&
    newProposal.value.operationType &&
    newProposal.value.timelockHours >= 0 &&
    validateOperationParams() &&
    validateTargetChains()
  );
});

const filteredProposals = computed(() => {
  console.log('[Frontend] Фильтрация предложений. Всего:', proposals.value.length);
  console.log('[Frontend] Фильтр статуса:', statusFilter.value);
  
  if (!statusFilter.value) {
    console.log('[Frontend] Возвращаем все предложения:', proposals.value);
    return proposals.value;
  }
  
  const filtered = proposals.value.filter(p => p.status === statusFilter.value);
  console.log('[Frontend] Отфильтрованные предложения:', filtered);
  return filtered;
});

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
    
    // Загружаем предложения
    const proposalsResponse = await getProposals(dleAddress.value);
    console.log('[Frontend] Загруженные предложения из API:', proposalsResponse);
    
    // Извлекаем массив предложений из ответа API
    const proposalsData = proposalsResponse.data?.proposals || [];
    console.log('[Frontend] Массив предложений:', proposalsData);
    
    // Преобразуем данные из API в формат для frontend
    proposals.value = await Promise.all(proposalsData.map(async (proposal) => {
      const transformedProposal = {
        ...proposal,
        status: getProposalStatus(proposal),
        deadline: proposal.deadline || 0
      };

      // Если есть transactionHash, декодируем данные предложения
      if (proposal.transactionHash) {
        try {
          console.log('[Frontend] Декодируем данные предложения:', proposal.transactionHash);
          const decodedData = await decodeProposalData(proposal.transactionHash);
          if (decodedData.success) {
            transformedProposal.decodedData = decodedData.data;
            console.log('[Frontend] Декодированные данные:', decodedData.data);
          }
        } catch (error) {
          console.error('[Frontend] Ошибка декодирования данных предложения:', error);
        }
      }

      console.log('[Frontend] Преобразованное предложение:', transformedProposal);
      return transformedProposal;
    }));
    
    console.log('[Frontend] Итоговый список предложений:', proposals.value);
    
    // Загружаем поддерживаемые цепочки
    const chainsResponse = await getSupportedChains(dleAddress.value);
    availableChains.value = chainsResponse.data?.chains || [];
    

  } catch (error) {
    console.error('Ошибка загрузки данных DLE из блокчейна:', error);
  } finally {
    isLoadingDle.value = false;
  }
}

function validateOperationParams() {
  const params = newProposal.value.operationParams;
  
  switch (newProposal.value.operationType) {
    case 'transfer':
    case 'mint':
      return validateAddress(params.to) && params.amount > 0;
    case 'burn':
      return validateAddress(params.from) && params.amount > 0;
    case 'custom':
      return params.customData && params.customData.startsWith('0x') && params.customData.length >= 10;
    case 'updateDLEInfo':
      return params.name && params.symbol && params.location && params.coordinates && params.jurisdiction && params.oktmo && params.kpp;
    case 'updateQuorum':
      return params.quorumPercentage >= 1 && params.quorumPercentage <= 100;
    case 'updateChain':
      return params.chainId && params.chainId !== '';
    default:
      return false;
  }
}

function validateTargetChains() {
  // Если показываем целевые сети, то должна быть выбрана хотя бы одна
  if (showTargetChains.value) {
    return newProposal.value.targetChains.length > 0;
  }
  return true;
}

function validateAddress(address) {
  if (!address) return false;
  // Проверяем формат Ethereum адреса
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  return addressRegex.test(address);
}

function getChainName(chainId) {
  // Сначала ищем в availableChains
  if (Array.isArray(availableChains.value)) {
    const chain = availableChains.value.find(c => c.chainId === chainId);
    if (chain) return chain.name;
  }
  
  // Если не найдено, используем известные chain ID
  const knownChains = {
    1: 'Ethereum Mainnet',
    11155111: 'Sepolia Testnet',
    137: 'Polygon',
    56: 'BSC',
    42161: 'Arbitrum One'
  };
  
  return knownChains[chainId] || `Chain ID: ${chainId}`;
}

function getOperationTypeName(type) {
  const types = {
    'transfer': 'Передача токенов',
    'mint': 'Минтинг токенов',
    'burn': 'Сжигание токенов',
    'custom': 'Пользовательская операция',
    'updateDLEInfo': 'Обновить данные DLE',
    'updateQuorum': 'Изменить кворум',
    'updateChain': 'Изменить текущую цепочку'
  };
  return types[type] || 'Неизвестный тип';
}

function getOperationParamsPreview() {
  const params = newProposal.value.operationParams;
  
  switch (newProposal.value.operationType) {
    case 'transfer':
      return `Кому: ${shortenAddress(params.to)}, Количество: ${params.amount}`;
    case 'mint':
      return `Кому: ${shortenAddress(params.to)}, Количество: ${params.amount}`;
    case 'burn':
      return `От: ${shortenAddress(params.from)}, Количество: ${params.amount}`;
    case 'custom':
      return `Данные: ${params.customData.substring(0, 20)}...`;
    case 'updateDLEInfo':
      return `Название: ${params.name}, Символ: ${params.symbol}, Местонахождение: ${params.location}, Координаты: ${params.coordinates}, Юрисдикция: ${params.jurisdiction}, ОКТМО: ${params.oktmo}, КПП: ${params.kpp}`;
    case 'updateQuorum':
      return `Процент кворума: ${params.quorumPercentage}%`;
    case 'updateChain':
      return `Новая цепочка: ${getChainName(params.chainId) || 'Не выбрана'}`;
    default:
      return 'Не указаны';
  }
}

function shortenAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp * 1000).toLocaleString();
}

function getProposalStatus(proposal) {
  const now = Math.floor(Date.now() / 1000);
  const deadline = proposal.deadline || 0;
  
  // Проверяем отменено ли предложение
  if (proposal.canceled) {
    return 'canceled';
  }
  
  // Проверяем выполнено ли предложение
  if (proposal.executed) {
    return 'executed';
  }
  
  // Проверяем дедлайн
  if (deadline > 0 && now >= deadline) {
    // Если дедлайн истек, определяем результат по голосам
    const forVotes = Number(proposal.forVotes) || 0;
    const againstVotes = Number(proposal.againstVotes) || 0;
    
    if (forVotes > againstVotes) {
      return 'succeeded';
    } else {
      return 'defeated';
    }
  }
  
  // Если дедлайн не истек, но есть голоса, определяем текущий статус
  const forVotes = Number(proposal.forVotes) || 0;
  const againstVotes = Number(proposal.againstVotes) || 0;
  
  // Проверяем, достигнут ли кворум
  const quorumPercentage = getQuorumPercentage(proposal);
  const requiredQuorum = getRequiredQuorum(proposal);
  const quorumReached = quorumPercentage >= requiredQuorum;
  
  // Если есть голоса И кворум достигнут, определяем результат
  if ((forVotes > 0 || againstVotes > 0) && quorumReached) {
    if (forVotes > againstVotes) {
      return 'succeeded';
    } else if (againstVotes > forVotes) {
      return 'defeated';
    }
  }
  
  // Если кворум не достигнут или нет голосов, предложение активно
  return 'active';
}

function getProposalStatusText(status) {
  const statusMap = {
    'pending': 'Ожидает',
    'active': 'Активно',
    'succeeded': 'Принято',
    'defeated': 'Отклонено',
    'executed': 'Выполнено',
    'canceled': 'Отменено'
  };
  return statusMap[status] || status;
}

function getProposalTitle(proposal) {
  // Если есть декодированные данные, показываем детальную информацию
  if (proposal.decodedData) {
    const { moduleId, moduleAddress, chainId, duration } = proposal.decodedData;
    
    // Декодируем moduleId из hex в строку
    let moduleName = 'Неизвестный модуль';
    try {
      moduleName = ethers.toUtf8String(moduleId).replace(/\0/g, '');
    } catch (e) {
      console.log('Не удалось декодировать moduleId:', moduleId);
    }
    
    return `Добавить модуль: ${moduleName}`;
  }
  
  // Иначе показываем обычное описание
  return proposal.description || 'Без описания';
}

function getModuleName(moduleId) {
  try {
    return ethers.toUtf8String(moduleId).replace(/\0/g, '');
  } catch (e) {
    return 'Неизвестный модуль';
  }
}

function getEtherscanUrl(address, chainId) {
  const chainMap = {
    1: 'https://etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
    17000: 'https://holesky.etherscan.io',
    421614: 'https://sepolia.arbiscan.io',
    84532: 'https://sepolia.basescan.org'
  };
  
  const baseUrl = chainMap[chainId] || 'https://etherscan.io';
  return `${baseUrl}/address/${address}`;
}

function formatDuration(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days} дн. ${hours} ч.`;
  } else if (hours > 0) {
    return `${hours} ч. ${minutes} мин.`;
  } else {
    return `${minutes} мин.`;
  }
}

function getProposalStatusClass(status) {
  const classMap = {
    'pending': 'status-pending',
    'active': 'status-active',
    'succeeded': 'status-success',
    'defeated': 'status-defeated',
    'executed': 'status-executed',
    'canceled': 'status-canceled'
  };
  return classMap[status] || 'status-default';
}

function decodeOperation(operation) {
  if (!operation || operation === '0x') return 'Нет операции';
  
  // Простое декодирование по селекторам
  const selectors = {
    '0xa9059cbb': 'Transfer',
    '0x40c10f19': 'Mint',
    '0x42966c68': 'Burn (address,uint256)'
  };
  
  const selector = operation.slice(0, 10);
  return selectors[selector] || `Операция (${selector})`;
}

function getQuorumPercentage(proposal) {
  if (!selectedDle.value || !selectedDle.value.totalSupply) {
    console.log('[Quorum] Нет данных DLE или totalSupply');
    return 0;
  }
  
  // Приводим все к одной единице измерения (wei)
  const totalSupplyWei = parseFloat(selectedDle.value.totalSupply) * Math.pow(10, 18);
  const forVotesWei = proposal.forVotes || 0;
  const againstVotesWei = proposal.againstVotes || 0;
  const totalVotesWei = forVotesWei + againstVotesWei;
  
  if (totalSupplyWei === 0) {
    console.log('[Quorum] TotalSupply равен 0');
    return 0;
  }
  
  const percentage = (totalVotesWei / totalSupplyWei) * 100;
  const roundedPercentage = Math.round(percentage * 100) / 100;
  console.log('[Quorum] Расчет процента:', { 
    totalSupplyWei, 
    forVotesWei, 
    againstVotesWei, 
    totalVotesWei, 
    percentage, 
    roundedPercentage 
  });
  return roundedPercentage; // Округляем до 2 знаков
}

function getQuorumProgress(proposal) {
  const percentage = getQuorumPercentage(proposal);
  const requiredQuorum = getRequiredQuorum(proposal);
  const progress = Math.min((percentage / requiredQuorum) * 100, 100);
  console.log('[Quorum] Прогресс кворума:', { percentage, requiredQuorum, progress });
  return progress;
}

function getRequiredQuorum(proposal = null) {
  // Если есть данные о предложении с quorumRequired, используем их
  if (proposal && proposal.quorumRequired && selectedDle.value?.totalSupply) {
    const totalSupplyWei = parseFloat(selectedDle.value.totalSupply) * Math.pow(10, 18);
    const quorumPercentage = (proposal.quorumRequired / totalSupplyWei) * 100;
    console.log('[Quorum] Требуемый кворум из предложения:', quorumPercentage, 'quorumRequired:', proposal.quorumRequired, 'totalSupply:', totalSupplyWei);
    return Math.round(quorumPercentage * 100) / 100;
  }
  
  // Fallback к данным DLE
  const quorum = selectedDle.value?.quorumPercentage || 51;
  console.log('[Quorum] Требуемый кворум из DLE:', quorum, 'DLE данные:', selectedDle.value);
  return quorum;
}

function formatVotes(votes) {
  if (!votes || votes === 0) return '0';
  
  // Конвертируем из wei в токены
  const tokens = votes / Math.pow(10, 18);
  return tokens.toFixed(2);
}

function getOperationDetails(operation, proposal) {
  if (!operation || operation === '0x') return null;
  
  const selector = operation.slice(0, 10);
  const data = operation.slice(10);
  
  try {
    switch (selector) {
      case '0xa9059cbb': // transfer(address,uint256)
        if (data.length >= 128) {
          const to = '0x' + data.slice(24, 64);
          const amount = parseInt(data.slice(64, 128), 16);
          return `Передать ${amount} токенов на адрес ${shortenAddress(to)}`;
        }
        break;
        
      case '0x40c10f19': // mint(address,uint256)
        if (data.length >= 128) {
          const to = '0x' + data.slice(24, 64);
          const amount = parseInt(data.slice(64, 128), 16);
          return `Создать ${amount} токенов для адреса ${shortenAddress(to)}`;
        }
        break;
        
      case '0x42966c68': // burn(address,uint256) или burn(uint256)
        if (data.length >= 128) {
          // Новый формат: burn(address,uint256) - адрес указан в операции
          const from = '0x' + data.slice(24, 64);
          const amount = parseInt(data.slice(64, 128), 16);
          return `Сжечь ${amount} токенов с адреса ${shortenAddress(from)}`;
        } else if (data.length >= 64) {
          // Старый формат: burn(uint256) - сжигает с адреса создателя предложения
          const amount = parseInt(data.slice(0, 64), 16);
          const burnerAddress = proposal.initiator || 'неизвестный адрес';
          return `Сжечь ${amount} токенов с адреса создателя ${shortenAddress(burnerAddress)}`;
        }
        break;
    }
  } catch (error) {
    console.error('Ошибка декодирования операции:', error);
  }
  
  return null;
}

function canSign(proposal) {
  return proposal.status === 'active' && !hasSigned(proposal.id);
}

function canExecute(proposal) {
  const now = Math.floor(Date.now() / 1000);
  const deadline = proposal.deadline || 0;
  
  // Предложение можно выполнить если:
  // 1. Кворум достигнут ИЛИ предложение уже принято (state: 5)
  // 2. Предложение еще не выполнено
  const quorumPercentage = getQuorumPercentage(proposal);
  const requiredQuorum = getRequiredQuorum(proposal);
  const hasReachedQuorum = quorumPercentage >= requiredQuorum;
  const deadlinePassed = deadline > 0 && now >= deadline;
  
  // Если предложение уже принято (state: 5), можно исполнять
  const isProposalPassed = proposal.state === 5 || proposal.isPassed === true;
  
  // Добавляем отладочную информацию
  console.log('[canExecute] Проверка предложения:', {
    proposalId: proposal.id,
    quorumPercentage,
    requiredQuorum,
    hasReachedQuorum,
    deadline,
    now,
    deadlinePassed,
    executed: proposal.executed,
    state: proposal.state,
    isPassed: proposal.isPassed,
    isProposalPassed
  });
  
  // Проверяем, что текущий пользователь - инициатор предложения
  const isInitiator = address.value && proposal.initiator && 
    address.value.toLowerCase() === proposal.initiator.toLowerCase();
  
  console.log('[canExecute] Проверка инициатора:', {
    currentAddress: address.value,
    proposalInitiator: proposal.initiator,
    isInitiator
  });
  
  // Можно исполнять если: 
  // 1. (кворум достигнут И дедлайн истек) ИЛИ предложение уже принято
  // 2. Пользователь - инициатор предложения
  // 3. Предложение не выполнено
  return ((hasReachedQuorum && deadlinePassed) || isProposalPassed) && 
         isInitiator && 
         !proposal.executed;
}

function hasSigned(proposalId) {
  // Здесь должна быть проверка подписи пользователя
  // Пока возвращаем false, так как нет API для проверки
  return false;
}

function canVoteAgainst(proposal) {
  return proposal.status === 'active' && !hasVotedAgainst(proposal.id);
}

function hasVotedAgainst(proposalId) {
  // Здесь должна быть проверка голосования "против" пользователя
  // Пока возвращаем false, так как нет API для проверки
  return false;
}

// Проверяем, голосовал ли пользователь за предложение
function hasVotedFor(proposalId) {
  // Здесь должна быть проверка голосования "за" пользователя
  // Пока возвращаем false, так как нет API для проверки
  return false;
}





// Создание предложения
async function createProposal() {
  // Проверка авторизации для создания предложений
  if (!props.isAuthenticated) {
    alert('❌ Для создания предложений необходимо авторизоваться в приложении');
    return;
  }

  if (!isFormValid.value) {
    alert('Пожалуйста, заполните все обязательные поля');
    return;
  }

  isCreating.value = true;
  
  try {
    // Подготовка данных для смарт-контракта
    const operation = encodeOperation();
    
    // Создаем предложение через API
    const result = await createProposalAPI(dleAddress.value, {
      description: newProposal.value.description,
      duration: newProposal.value.duration * 24 * 60 * 60, // конвертируем в секунды
      operation: operation,
      governanceChainId: newProposal.value.governanceChainId,
      targetChains: showTargetChains.value ? newProposal.value.targetChains : [],
      timelockDelay: (newProposal.value.timelockHours || 0) * 3600
    });
    
    console.log('Предложение создано:', result);
    
    // Отправляем WebSocket уведомление
    wsClient.send('proposal_created', {
      dleAddress: dleAddress.value,
      proposalId: result.proposalId,
      txHash: result.txHash
    });
    
    // Ждем немного, чтобы блокчейн обработал транзакцию
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Обновляем список предложений
    await loadDleData();
    
    // Отправляем WebSocket уведомление о новом предложении
    wsClient.send('proposal_created', {
      dleAddress: dleAddress.value,
      proposalId: result.proposalId,
      txHash: result.txHash
    });
    
    // Сбрасываем форму
    resetForm();
    // showCreateForm.value = false; // Больше не нужно
    
    alert('✅ Предложение успешно создано!');
    
  } catch (error) {
    console.error('Ошибка при создании предложения:', error);
    alert('❌ Ошибка при создании предложения: ' + error.message);
  } finally {
    isCreating.value = false;
  }
}

function encodeOperation() {
  const params = newProposal.value.operationParams;
  
  switch (newProposal.value.operationType) {
    case 'transfer':
      return encodeTransferOperation(params.to, params.amount);
    case 'mint':
      return encodeMintOperation(params.to, params.amount);
    case 'burn':
      return encodeBurnOperation(params.from, params.amount);
    case 'custom':
      return params.customData;
    case 'updateDLEInfo':
      return encodeUpdateDLEInfoOperation(params.name, params.symbol, params.location, params.coordinates, params.jurisdiction, params.oktmo, params.kpp);
    case 'updateQuorum':
      return encodeUpdateQuorumOperation(params.quorumPercentage);
    case 'updateChain':
      return encodeUpdateChainOperation(params.chainId);
    default:
      throw new Error('Неизвестный тип операции');
  }
}

function encodeTransferOperation(to, amount) {
  // Кодировка операции передачи токенов ERC20
  const selector = '0xa9059cbb'; // transfer(address,uint256)
  const paddedAddress = to.slice(2).padStart(64, '0');
  const paddedAmount = BigInt(amount).toString(16).padStart(64, '0');
  return selector + paddedAddress + paddedAmount;
}

function encodeMintOperation(to, amount) {
  // Кодировка операции минтинга токенов
  const selector = '0x40c10f19'; // mint(address,uint256)
  const paddedAddress = to.slice(2).padStart(64, '0');
  const paddedAmount = BigInt(amount).toString(16).padStart(64, '0');
  return selector + paddedAddress + paddedAmount;
}

function encodeBurnOperation(from, amount) {
  // Кодировка операции сжигания токенов
  const selector = '0x42966c68'; // burn(address,uint256)
  const paddedAddress = from.slice(2).padStart(64, '0');
  const paddedAmount = BigInt(amount).toString(16).padStart(64, '0');
  return selector + paddedAddress + paddedAmount;
}

function encodeUpdateDLEInfoOperation(name, symbol, location, coordinates, jurisdiction, oktmo, kpp) {
  // Селектор для _updateDLEInfo(string,string,string,string,uint256,string[],uint256)
  const selector = '0x' + ethers.keccak256(ethers.toUtf8Bytes('_updateDLEInfo(string,string,string,string,uint256,string[],uint256)')).slice(0, 10);
  
  // Кодируем параметры
  const abiCoder = new ethers.AbiCoder();
  const encodedData = abiCoder.encode(
    ['string', 'string', 'string', 'string', 'uint256', 'string[]', 'uint256'],
    [name, symbol, location, coordinates, jurisdiction, [], kpp] // okvedCodes пока пустой массив
  );
  
  return selector + encodedData.slice(2);
}

function encodeUpdateQuorumOperation(quorumPercentage) {
  // Селектор для _updateQuorumPercentage(uint256)
  const selector = '0x' + ethers.keccak256(ethers.toUtf8Bytes('_updateQuorumPercentage(uint256)')).slice(0, 10);
  
  // Кодируем параметр
  const abiCoder = new ethers.AbiCoder();
  const encodedData = abiCoder.encode(['uint256'], [quorumPercentage]);
  
  return selector + encodedData.slice(2);
}

function encodeUpdateChainOperation(chainId) {
  // Селектор для _updateCurrentChainId(uint256)
  const selector = '0x' + ethers.keccak256(ethers.toUtf8Bytes('_updateCurrentChainId(uint256)')).slice(0, 10);
  
  // Кодируем параметр
  const abiCoder = new ethers.AbiCoder();
  const encodedData = abiCoder.encode(['uint256'], [chainId]);
  
  return selector + encodedData.slice(2);
}

// Подпись предложения
async function signProposalLocal(proposalId) {
  // Проверка прав админа для голосования
  if (!props.isAuthenticated) {
    alert('❌ Для участия в голосовании необходимо авторизоваться в приложении');
    return;
  }
  
  // Дополнительная проверка на права админа (можно расширить логику)
  if (!hasAdminRights()) {
    alert('❌ Для участия в голосовании необходимы права администратора');
    return;
  }

  try {
    console.log('[Debug] Попытка подписи для предложения:', proposalId);
    console.log('[Debug] Адрес кошелька:', address.value);
    
    // Получаем данные транзакции от backend
    const result = await voteForProposalAPI(dleAddress.value, proposalId, true);
    
    if (result.success) {
      console.log('[DleProposalsView] Данные транзакции голосования получены:', result);

      // Отправляем транзакцию через MetaMask
      try {
        // Проверяем валидность адреса
        if (!result.data.to || !result.data.to.startsWith('0x') || result.data.to.length !== 42) {
          throw new Error(`Неверный адрес контракта: ${result.data.to}`);
        }

        // Проверяем, что есть подключенный аккаунт
        let accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (!accounts || accounts.length === 0) {
          console.log('[DleProposalsView] Запрашиваем разрешение на подключение к MetaMask');
          accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        }

        if (!accounts || accounts.length === 0) {
          throw new Error('Не удалось получить доступ к аккаунтам MetaMask');
        }

        console.log('[DleProposalsView] Подключенный аккаунт:', accounts[0]);

        // Проверяем подключение к правильной сети
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const expectedChainId = '0xaa36a7'; // Sepolia

        if (chainId !== expectedChainId) {
          console.log(`[DleProposalsView] Переключаемся с сети ${chainId} на ${expectedChainId}`);

          try {
            // Пытаемся переключиться на Sepolia
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: expectedChainId }],
            });
            console.log('[DleProposalsView] Успешно переключились на Sepolia');
          } catch (switchError) {
            // Если сеть не добавлена, добавляем её
            if (switchError.code === 4902) {
              console.log('[DleProposalsView] Добавляем Sepolia сеть');
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: expectedChainId,
                  chainName: 'Sepolia',
                  nativeCurrency: {
                    name: 'SepoliaETH',
                    symbol: 'ETH',
                    decimals: 18
                  },
                  rpcUrls: ['https://eth-sepolia.nodereal.io/v1/56dec8028bae4f26b76099a42dae2b52'],
                  blockExplorerUrls: ['https://sepolia.etherscan.io']
                }]
              });
            } else {
              throw new Error(`Не удалось переключиться на Sepolia: ${switchError.message}`);
            }
          }
        }

        console.log('[DleProposalsView] Отправляем транзакцию голосования:', {
          from: accounts[0],
          to: result.data.to,
          data: result.data.data,
          value: result.data.value,
          gas: result.data.gasLimit
        });

        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: accounts[0],
            to: result.data.to,
            data: result.data.data,
            value: result.data.value,
            gas: result.data.gasLimit
          }]
        });

        console.log('[DleProposalsView] Транзакция голосования отправлена:', txHash);
        
        // Показываем уведомление с возможностью отслеживания
        showTransactionNotification(txHash, 'Голосование отправлено!');
        
        // Подписываемся на WebSocket уведомления о голосовании
        subscribeToVoteUpdates(txHash, proposalId, 'vote');
        
        // Запускаем отслеживание транзакции на backend
        trackVoteTransaction(txHash, dleAddress.value, proposalId, true);

      } catch (txError) {
        console.error('[DleProposalsView] Ошибка отправки транзакции голосования:', txError);
        alert('❌ Ошибка отправки транзакции голосования: ' + txError.message);
      }
    } else {
      alert('❌ Ошибка получения данных транзакции: ' + result.error);
    }
    
  } catch (error) {
    console.error('Ошибка при подписании:', error);
    
    if (error.message.includes('Already voted')) {
      alert('⚠️ Ошибка: Вы уже голосовали за это предложение!\n\nВаш адрес: ' + address.value + '\n\nВозможные причины:\n• Вы уже голосовали с этим кошельком\n• Вы голосовали с другим кошельком ранее\n\nКаждый адрес может голосовать только один раз за предложение.');
    } else {
      alert('❌ Ошибка при подписании: ' + error.message);
    }
  }
}

// Отмена подписи (голос "против")
async function cancelSignatureLocal(proposalId) {
  // Проверка прав админа для голосования
  if (!props.isAuthenticated) {
    alert('❌ Для участия в голосовании необходимо авторизоваться в приложении');
    return;
  }
  
  // Дополнительная проверка на права админа
  if (!hasAdminRights()) {
    alert('❌ Для участия в голосовании необходимы права администратора');
    return;
  }

  try {
    console.log('[Debug] Попытка голосования "против" для предложения:', proposalId);
    console.log('[Debug] Адрес кошелька:', address.value);
    
    // Получаем данные транзакции от backend
    const result = await voteForProposalAPI(dleAddress.value, proposalId, false);
    
    if (result.success) {
      console.log('[DleProposalsView] Данные транзакции голосования "против" получены:', result);

      // Отправляем транзакцию через MetaMask
      try {
        // Проверяем валидность адреса
        if (!result.data.to || !result.data.to.startsWith('0x') || result.data.to.length !== 42) {
          throw new Error(`Неверный адрес контракта: ${result.data.to}`);
        }

        // Проверяем, что есть подключенный аккаунт
        let accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (!accounts || accounts.length === 0) {
          console.log('[DleProposalsView] Запрашиваем разрешение на подключение к MetaMask');
          accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        }

        if (!accounts || accounts.length === 0) {
          throw new Error('Не удалось получить доступ к аккаунтам MetaMask');
        }

        console.log('[DleProposalsView] Подключенный аккаунт:', accounts[0]);

        // Проверяем подключение к правильной сети
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const expectedChainId = '0xaa36a7'; // Sepolia

        if (chainId !== expectedChainId) {
          console.log(`[DleProposalsView] Переключаемся с сети ${chainId} на ${expectedChainId}`);

          try {
            // Пытаемся переключиться на Sepolia
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: expectedChainId }],
            });
            console.log('[DleProposalsView] Успешно переключились на Sepolia');
          } catch (switchError) {
            // Если сеть не добавлена, добавляем её
            if (switchError.code === 4902) {
              console.log('[DleProposalsView] Добавляем Sepolia сеть');
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: expectedChainId,
                  chainName: 'Sepolia',
                  nativeCurrency: {
                    name: 'SepoliaETH',
                    symbol: 'ETH',
                    decimals: 18
                  },
                  rpcUrls: ['https://eth-sepolia.nodereal.io/v1/56dec8028bae4f26b76099a42dae2b52'],
                  blockExplorerUrls: ['https://sepolia.etherscan.io']
                }]
              });
            } else {
              throw new Error(`Не удалось переключиться на Sepolia: ${switchError.message}`);
            }
          }
        }

        console.log('[DleProposalsView] Отправляем транзакцию голосования "против":', {
          from: accounts[0],
          to: result.data.to,
          data: result.data.data,
          value: result.data.value,
          gas: result.data.gasLimit
        });

        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: accounts[0],
            to: result.data.to,
            data: result.data.data,
            value: result.data.value,
            gas: result.data.gasLimit
          }]
        });

        console.log('[DleProposalsView] Транзакция голосования "против" отправлена:', txHash);
        
        // Показываем уведомление с возможностью отслеживания
        showTransactionNotification(txHash, 'Голосование "против" отправлено!');
        
        // Подписываемся на WebSocket уведомления о голосовании
        subscribeToVoteUpdates(txHash, proposalId, 'vote-against');
        
        // Запускаем отслеживание транзакции на backend
        trackVoteTransaction(txHash, dleAddress.value, proposalId, false);

      } catch (txError) {
        console.error('[DleProposalsView] Ошибка отправки транзакции голосования "против":', txError);
        alert('❌ Ошибка отправки транзакции голосования "против": ' + txError.message);
      }
    } else {
      alert('❌ Ошибка получения данных транзакции: ' + result.error);
    }
    
  } catch (error) {
    console.error('Ошибка при голосовании "против":', error);
    
    if (error.message.includes('Already voted')) {
      alert('⚠️ Ошибка: Вы уже голосовали за это предложение!\n\nВаш адрес: ' + address.value + '\n\nВозможные причины:\n• Вы уже голосовали с этим кошельком\n• Вы голосовали с другим кошельком ранее\n\nКаждый адрес может голосовать только один раз за предложение.');
    } else {
      alert('❌ Ошибка при голосовании "против": ' + error.message);
    }
  }
}

// Исполнение предложения
async function executeProposalLocal(proposalId) {
  // Проверка авторизации
  if (!props.isAuthenticated) {
    alert('❌ Для исполнения предложений необходимо авторизоваться в приложении');
    return;
  }
  
  // Проверка, что пользователь - инициатор предложения
  const proposal = proposals.value.find(p => p.id === proposalId);
  if (!proposal) {
    alert('❌ Предложение не найдено');
    return;
  }
  
  const isInitiator = address.value && proposal.initiator && 
    address.value.toLowerCase() === proposal.initiator.toLowerCase();
    
  if (!isInitiator) {
    alert('❌ Только инициатор предложения может его исполнить');
    return;
  }

  try {
    console.log('[Debug] Попытка исполнения предложения:', proposalId);
    console.log('[Debug] Адрес кошелька:', address.value);
    
    // Получаем данные транзакции от backend
    const result = await executeProposalAPI(dleAddress.value, proposalId);
    
    if (result.success) {
      console.log('[DleProposalsView] Данные транзакции исполнения получены:', result);

      // Отправляем транзакцию через MetaMask
      try {
        // Проверяем валидность адреса
        if (!result.data.to || !result.data.to.startsWith('0x') || result.data.to.length !== 42) {
          throw new Error(`Неверный адрес контракта: ${result.data.to}`);
        }

        // Проверяем подключение к MetaMask
        if (!window.ethereum) {
          throw new Error('MetaMask не установлен');
        }

        // Запрашиваем разрешение на подключение к MetaMask
        console.log('[DleProposalsView] Запрашиваем разрешение на подключение к MetaMask');
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        if (accounts.length === 0) {
          throw new Error('Нет подключенных аккаунтов в MetaMask');
        }

        console.log('[DleProposalsView] Подключенный аккаунт:', accounts[0]);

        // Проверяем сеть
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const expectedChainId = '0xaa36a7'; // Sepolia (11155111)
        
        if (chainId !== expectedChainId) {
          console.log(`[DleProposalsView] Неправильная сеть! Текущая: ${chainId}, ожидается: ${expectedChainId}`);
          
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: expectedChainId }],
            });
          } catch (switchError) {
            if (switchError.code === 4902) {
              console.log('[DleProposalsView] Добавляем Sepolia сеть');
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: expectedChainId,
                  chainName: 'Sepolia',
                  nativeCurrency: {
                    name: 'SepoliaETH',
                    symbol: 'ETH',
                    decimals: 18
                  },
                  rpcUrls: ['https://eth-sepolia.nodereal.io/v1/56dec8028bae4f26b76099a42dae2b52'],
                  blockExplorerUrls: ['https://sepolia.etherscan.io']
                }]
              });
            } else {
              throw new Error(`Не удалось переключиться на Sepolia: ${switchError.message}`);
            }
          }
        }

        console.log('[DleProposalsView] Отправляем транзакцию исполнения:', {
          from: accounts[0],
          to: result.data.to,
          data: result.data.data,
          value: result.data.value,
          gas: result.data.gasLimit
        });

        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: accounts[0],
            to: result.data.to,
            data: result.data.data,
            value: result.data.value,
            gas: result.data.gasLimit
          }]
        });

        console.log('[DleProposalsView] Транзакция исполнения отправлена:', txHash);
        
        // Показываем уведомление с возможностью отслеживания
        showTransactionNotification(txHash, 'Исполнение предложения отправлено!');
        
        // Подписываемся на WebSocket уведомления о исполнении
        subscribeToExecutionUpdates(txHash, proposalId);
        
        // Запускаем отслеживание транзакции на backend
        trackExecutionTransaction(txHash, dleAddress.value, proposalId);

      } catch (txError) {
        console.error('[DleProposalsView] Ошибка отправки транзакции исполнения:', txError);
        alert('❌ Ошибка отправки транзакции исполнения: ' + txError.message);
      }
    } else {
      alert('❌ Ошибка получения данных транзакции: ' + result.error);
    }
    
  } catch (error) {
    console.error('Ошибка при исполнении предложения:', error);
    alert('❌ Ошибка при исполнении предложения: ' + error.message);
  }
}



function resetForm() {
  newProposal.value = {
    description: '',
    duration: 7,
    governanceChainId: null,
    operationType: '',
    operationParams: {
      to: '',
      from: '',
      amount: 0,
      customData: '',
      name: '',
      symbol: '',
      location: '',
      coordinates: '',
      jurisdiction: 0,
      oktmo: 0,
      kpp: 0,
      chainId: ''
    }
  };
}

// Проверка прав администратора
function hasAdminRights() {
  console.log('[hasAdminRights] Проверка прав администратора');
  
  // Используем данные из useAuthContext напрямую
const isAuth = isAuthenticated.value;
const tokenBalancesData = tokenBalances.value;
  
  console.log('[hasAdminRights] isAuthenticated:', isAuth);
  console.log('[hasAdminRights] tokenBalances:', tokenBalancesData);
  
  // Базовая проверка - пользователь должен быть авторизован
  if (!isAuth) {
    console.log('[hasAdminRights] Пользователь не авторизован');
    return false;
  }
  
    // Проверяем, есть ли у пользователя админ токены
  if (tokenBalancesData && Array.isArray(tokenBalancesData)) {
    const balances = tokenBalancesData;
    console.log('[hasAdminRights] Балансы токенов:', balances);
    
    // Проверяем, есть ли хотя бы один токен с достаточным балансом
    for (const balance of balances) {
      console.log('[hasAdminRights] Проверяем баланс:', balance);
      // Проверяем баланс напрямую, так как структура данных может отличаться
      const balanceValue = parseFloat(balance.balance || '0');
      const minBalance = parseFloat(balance.minBalance || '0');
      
      if (balanceValue >= minBalance) {
        console.log('[hasAdminRights] Найден токен с достаточным балансом:', balance);
        return true;
      }
    }
  }
  
  console.log('[hasAdminRights] Нет админ токенов, доступ запрещен');
  // Если нет админ токенов, возвращаем false
  return false;
}



// Отслеживаем изменения в адресе DLE
watch(dleAddress, (newAddress) => {
  if (newAddress) {
    loadDleData();
  }
}, { immediate: true });

onMounted(async () => {
  // Принудительно загружаем токены, если пользователь аутентифицирован
  if (isAuthenticated.value && address.value) {
    console.log('[DleProposalsView] Принудительная загрузка токенов для адреса:', address.value);
    await checkTokenBalances(address.value);
  }
  
  // Загрузка данных DLE
  if (dleAddress.value) {
    loadDleData();
  }
  
  // Подписываемся на WebSocket обновления
  wsClient.on('proposal_created', (data) => {
    console.log('[WebSocket] Получено уведомление о новом предложении:', data);
    if (data.dleAddress === dleAddress.value) {
      loadDleData(); // Обновляем список предложений
    }
  });
  
  wsClient.on('proposal_voted', (data) => {
    console.log('[WebSocket] Получено уведомление о подписи:', data);
    if (data.dleAddress === dleAddress.value) {
      loadDleData(); // Обновляем список предложений
    }
  });
  
  wsClient.on('proposal_executed', (data) => {
    console.log('[WebSocket] Получено уведомление об исполнении:', data);
    if (data.dleAddress === dleAddress.value) {
      loadDleData(); // Обновляем список предложений
    }
  });
});

onUnmounted(() => {
  // Отписываемся от WebSocket обновлений
  wsClient.off('proposal_created');
  wsClient.off('proposal_voted');
  wsClient.off('proposal_executed');
});
</script>

<style scoped>
.dle-proposals-management {
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
  margin-bottom: 20px;
}

/* Заголовок в стиле настроек */
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

/* Секция управления */
.controls-section {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: 20px;
}

.controls-header {
  background: #f8f9fa;
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
}

.controls-header h3 {
  color: var(--color-primary);
  margin: 0;
  font-size: 1.2rem;
}

.controls-content {
  padding: 20px;
}

.filters-row {
  display: flex;
  gap: 15px;
  align-items: center;
}

.form-control {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  min-width: 150px;
}

.btn {
  border: none;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.8rem;
}

.btn-outline-secondary {
  background: transparent;
  color: var(--color-secondary);
  border: 1px solid var(--color-secondary);
}

.btn-outline-secondary:hover {
  background: var(--color-secondary);
  color: white;
}

/* Устаревшие стили для совместимости */
.proposals-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.header-info h3 {
  margin: 0;
  color: var(--color-primary);
}

.dle-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dle-name {
  font-weight: 600;
  color: #333;
  font-size: 1rem;
}

.dle-address {
  font-family: monospace;
  font-size: 0.875rem;
  color: #666;
  background: #f8f9fa;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
}

.loading-info,
.no-dle-info {
  font-size: 0.875rem;
  color: #666;
  font-style: italic;
}

.create-proposal-form {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  margin-top: 2rem;
  border-top: 2px solid #e9ecef;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
}

.form-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

.form-section:last-child {
  border-bottom: none;
}

.form-section h5 {
  color: #333;
  margin-bottom: 1rem;
}

.chains-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.chain-option {
  border: 2px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.chain-option:hover {
  border-color: #007bff;
}

.chain-option.selected {
  border-color: #007bff;
  background: #f8f9ff;
}

.chain-info h6 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.chain-id {
  font-size: 0.9rem;
  color: #666;
}

.chain-description {
  font-size: 0.9rem;
  color: #888;
  margin: 0.5rem 0 0 0;
}

.chain-status {
  text-align: right;
  color: #007bff;
}

.operation-types {
  margin-top: 1rem;
}

.operation-params {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.preview-card {
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 1rem;
}

.preview-item {
  margin-bottom: 0.5rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.proposals-list {
  margin-top: 2rem;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.list-filters {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.proposals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.proposal-card {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  background: #fff;
}

.proposal-card.active {
  border-color: #28a745;
}

.proposal-card.succeeded {
  border-color: #007bff;
}

.proposal-card.defeated {
  border-color: #dc3545;
}

.auth-notice {
  text-align: center;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 4px;
  margin-top: 1rem;
}

.auth-notice-form {
  margin-bottom: 1rem;
}

.auth-notice-form .alert {
  margin-bottom: 0;
}

.proposal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.proposal-header h5 {
  margin: 0;
  color: #333;
}

.proposal-status {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
}

.proposal-status.active {
  background: #d4edda;
  color: #155724;
}

.proposal-status.succeeded {
  background: #d1ecf1;
  color: #0c5460;
}

.proposal-status.executed {
  background: #d4edda;
  color: #155724;
}

.proposal-status.defeated {
  background: #f8d7da;
  color: #721c24;
}

.execution-notice {
  margin-top: 8px;
  padding: 8px 12px;
  background: #e2e3e5;
  border-radius: 4px;
  border-left: 3px solid #6c757d;
}

.proposal-status.canceled {
  background: #fff3cd;
  color: #856404;
}

.proposal-details {
  margin-bottom: 1rem;
}

.detail-item {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.module-details {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 1rem;
  margin: 1rem 0;
}

.module-details .detail-item {
  margin-bottom: 0.75rem;
}

.address-link {
  color: #007bff;
  text-decoration: none;
  font-family: monospace;
}

.address-link:hover {
  text-decoration: underline;
}

.votes-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.votes-info {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.votes-info .for {
  color: #28a745;
  font-weight: 500;
}

.votes-info .against {
  color: #dc3545;
  font-weight: 500;
}

.quorum-info {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.quorum-info .quorum-percentage {
  color: #666;
  font-size: 0.9em;
}

.quorum-progress {
  width: 100%;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #28a745, #20c997);
  transition: width 0.3s ease;
}



.proposal-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.no-proposals {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.form-help {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 1rem;
}

/* Стили для валидации */
.form-control.is-invalid {
  border-color: #dc3545;
  box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25);
}

.form-text {
  font-size: 0.875rem;
  color: #6c757d;
  margin-top: 0.25rem;
}

.form-control {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.operation {
  font-family: monospace;
  font-size: 0.9em;
  color: #666;
}

.operation-details {
  font-size: 0.9em;
  color: #28a745;
  font-weight: 500;
}

/* Стили для ошибок валидации */
.form-error {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
}

.text-danger {
  color: #dc3545 !important;
}

.targets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.target-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.target-item:hover {
  background-color: #f8f9fa;
}

.target-item input[type="checkbox"] {
  margin: 0;
}
</style> 