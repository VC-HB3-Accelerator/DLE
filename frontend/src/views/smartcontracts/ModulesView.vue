<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
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
    <div class="modules-management">
      <!-- Модальное окно деплоя -->
      <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 20px;">
          <div v-if="selectedDle?.dleAddress" style="color: var(--color-grey-dark); font-size: 0.9rem;">
            {{ selectedDle.dleAddress }}
          </div>
          <div v-else-if="isLoadingDle" style="color: var(--color-grey-dark); font-size: 0.9rem;">
            Загрузка...
          </div>
          <div class="websocket-status" :class="{ connected: isWSConnected }" title="WebSocket соединение для обновления модулей">
            <i class="fas fa-circle" :class="isWSConnected ? 'fa-solid' : 'fa-light'"></i>
            <span>{{ isWSConnected ? 'Подключено' : 'Отключено' }}</span>
          </div>
        </div>
        <button class="close-btn" @click="goBackToBlocks">×</button>
      </div>
      <div v-if="showDeploymentModal" class="modal-overlay" @click="moduleDeploymentStatus === 'error' || !isDeploying ? closeDeploymentModal() : null">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <div class="header-content">
              <h3>🚀 Деплой модуля {{ currentDeployingModule }}</h3>
              <div class="websocket-status" :class="{ connected: isWSConnected }">
                <i class="fas fa-circle" :class="isWSConnected ? 'fa-solid' : 'fa-light'"></i>
                <span>{{ isWSConnected ? 'Подключено' : 'Отключено' }}</span>
            </div>
            </div>
            <button 
              class="modal-close" 
              @click="closeDeploymentModal" 
              v-if="moduleDeploymentStatus === 'error' || !isDeploying"
            >
              <i class="fas fa-times"></i>
            </button>
            </div>
          
          <div class="modal-body">
            <!-- Статус деплоя -->
            <div class="deployment-status-card">
              <div class="status-icon" :class="moduleDeploymentStatus">
                <i class="fas fa-spinner fa-spin" v-if="moduleDeploymentStatus === 'starting'"></i>
                <i class="fas fa-check-circle" v-else-if="moduleDeploymentStatus === 'success'"></i>
                <i class="fas fa-exclamation-circle" v-else-if="moduleDeploymentStatus === 'error'"></i>
                <i class="fas fa-rocket" v-else></i>
            </div>
              <div class="status-content">
                <h4>{{ getStatusTitle() }}</h4>
                <p>{{ deploymentProgress || 'Подготовка к деплою...' }}</p>
          </div>
        </div>

            <!-- Прогресс-бар -->
            <div class="progress-section" v-if="isDeploying">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
              </div>
              <div class="progress-text">{{ progressPercentage }}%</div>
      </div>

            <!-- Детали процесса -->
            <div class="deployment-details">
              <div class="detail-step" :class="{ active: deploymentStep >= 1, completed: deploymentStep > 1 }">
                <div class="step-icon">
                  <i class="fas fa-cog" v-if="deploymentStep < 1"></i>
                  <i class="fas fa-spinner fa-spin" v-else-if="deploymentStep === 1"></i>
                  <i class="fas fa-check" v-else></i>
                </div>
                <div class="step-content">
                  <h5>Инициализация</h5>
                  <p>Загрузка параметров из базы данных</p>
                </div>
              </div>

              <div class="detail-step" :class="{ active: deploymentStep >= 2, completed: deploymentStep > 2 }">
                <div class="step-icon">
                  <i class="fas fa-cog" v-if="deploymentStep < 2"></i>
                  <i class="fas fa-spinner fa-spin" v-else-if="deploymentStep === 2"></i>
                  <i class="fas fa-check" v-else></i>
                </div>
                <div class="step-content">
                  <h5>Компиляция</h5>
                  <p>Компиляция смарт-контракта модуля</p>
                </div>
              </div>

              <div class="detail-step" :class="{ active: deploymentStep >= 3, completed: deploymentStep > 3 }">
                <div class="step-icon">
                  <i class="fas fa-cog" v-if="deploymentStep < 3"></i>
                  <i class="fas fa-spinner fa-spin" v-else-if="deploymentStep === 3"></i>
                  <i class="fas fa-check" v-else></i>
                </div>
                <div class="step-content">
                  <h5>Деплой в сетях</h5>
                  <p>Развертывание контракта во всех сетях</p>
                </div>
              </div>

              <div class="detail-step" :class="{ active: deploymentStep >= 4, completed: deploymentStep > 4 }">
                <div class="step-icon">
                  <i class="fas fa-cog" v-if="deploymentStep < 4"></i>
                  <i class="fas fa-spinner fa-spin" v-else-if="deploymentStep === 4"></i>
                  <i class="fas fa-check" v-else></i>
                </div>
                <div class="step-content">
                  <h5>Верификация</h5>
                  <p>Верификация контракта в блокчейн-сканерах</p>
                </div>
              </div>

              <div class="detail-step" :class="{ active: deploymentStep >= 5, completed: deploymentStep > 5 }">
                <div class="step-icon">
                  <i class="fas fa-cog" v-if="deploymentStep < 5"></i>
                  <i class="fas fa-spinner fa-spin" v-else-if="deploymentStep === 5"></i>
                  <i class="fas fa-check" v-else></i>
                </div>
                <div class="step-content">
                  <h5>Завершение</h5>
                  <p>Сохранение результатов и обновление интерфейса</p>
                </div>
              </div>
            </div>

            <!-- Лог процесса -->
            <div class="deployment-log" v-if="deploymentLogs.length > 0">
              <h5>Лог процесса:</h5>
              <div class="log-container">
                <div 
                  v-for="(log, index) in deploymentLogs" 
                  :key="index" 
                  class="log-entry"
                  :class="log.type"
                >
                  <span class="log-time">{{ log.time }}</span>
                  <span class="log-message">{{ log.message }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer" v-if="moduleDeploymentStatus === 'success'">
            <div class="success-message">
              <i class="fas fa-check-circle"></i>
              <span>Деплой завершен! Окно закроется автоматически...</span>
            </div>
          </div>
        </div>
      </div>


      <!-- Блоки для деплоя стандартных модулей -->
      <div class="standard-modules">
        <div class="modules-grid">
          <!-- TreasuryModule -->
          <div class="module-deploy-card">
            <div class="module-content">
              <h4>TreasuryModule</h4>
              <p>Казначейство DLE - управление финансами, депозиты, выводы, дивиденды</p>
              <div class="module-features">
                <span class="feature-tag">Финансы</span>
                <span class="feature-tag">Бюджет</span>
                <span class="feature-tag">Дивиденды</span>
              </div>
            </div>
            <div class="module-actions">
              <button 
                class="btn btn-primary btn-deploy" 
                @click="deployModule('treasury')"
                :disabled="isDeploying"
              >
                <i class="fas fa-rocket" v-if="!isDeploying"></i>
                <i class="fas fa-spinner fa-spin" v-else></i>
                {{ isDeploying ? 'Деплой...' : 'Деплой' }}
              </button>
            </div>
          </div>

          <!-- TimelockModule -->
          <div class="module-deploy-card">
            <div class="module-content">
              <h4>TimelockModule</h4>
              <p>Задержки исполнения - безопасность критических операций через таймлоки</p>
              <div class="module-features">
                <span class="feature-tag">Безопасность</span>
                <span class="feature-tag">Таймлок</span>
                <span class="feature-tag">Аудит</span>
              </div>
            </div>
            <div class="module-actions">
              <button 
                class="btn btn-primary btn-deploy" 
                @click="deployModule('timelock')"
                :disabled="isDeploying"
              >
                <i class="fas fa-rocket" v-if="!isDeploying"></i>
                <i class="fas fa-spinner fa-spin" v-else></i>
                {{ isDeploying ? 'Деплой...' : 'Деплой' }}
              </button>
            </div>
          </div>

          <!-- DLEReader -->
          <div class="module-deploy-card">
            <div class="module-content">
              <h4>DLEReader</h4>
              <p>Чтение данных DLE - API для получения информации о контракте и предложениях</p>
              <div class="module-features">
                <span class="feature-tag">API</span>
                <span class="feature-tag">Чтение</span>
                <span class="feature-tag">Данные</span>
                <span class="feature-tag">Интеграция</span>
              </div>
            </div>
            <div class="module-actions">
              <button 
                class="btn btn-primary btn-deploy" 
                @click="deployModule('reader')"
                :disabled="isDeploying"
              >
                <i class="fas fa-rocket" v-if="!isDeploying"></i>
                <i class="fas fa-spinner fa-spin" v-else></i>
                {{ isDeploying ? 'Деплой...' : 'Деплой' }}
              </button>
            </div>
          </div>

          <!-- CommunicationModule -->
          <div class="module-deploy-card">
            <div class="module-content">
              <h4>CommunicationModule</h4>
              <p>Коммуникации - сообщения, звонки, история общения между участниками</p>
              <div class="module-features">
                <span class="feature-tag">Сообщения</span>
                <span class="feature-tag">Звонки</span>
                <span class="feature-tag">История</span>
              </div>
            </div>
            <div class="module-actions">
              <button 
                class="btn btn-primary btn-deploy" 
                @click="deployModule('communication')"
                :disabled="isDeploying"
              >
                <i class="fas fa-rocket" v-if="!isDeploying"></i>
                <i class="fas fa-spinner fa-spin" v-else></i>
                {{ isDeploying ? 'Деплой...' : 'Деплой' }}
              </button>
            </div>
          </div>

          <!-- ApplicationModule -->
          <div class="module-deploy-card">
            <div class="module-content">
              <h4>ApplicationModule</h4>
              <p>Управление вызовом функций приложения через предложения и голосование</p>
              <div class="module-features">
                <span class="feature-tag">API</span>
                <span class="feature-tag">Голосование</span>
                <span class="feature-tag">Управление</span>
              </div>
            </div>
            <div class="module-actions">
              <button 
                class="btn btn-primary btn-deploy" 
                @click="deployModule('application')"
                :disabled="isDeploying"
              >
                <i class="fas fa-rocket" v-if="!isDeploying"></i>
                <i class="fas fa-spinner fa-spin" v-else></i>
                {{ isDeploying ? 'Деплой...' : 'Деплой' }}
              </button>
            </div>
          </div>

          <!-- MintModule -->
          <div class="module-deploy-card">
            <div class="module-content">
              <h4>MintModule</h4>
              <p>Выпуск новых токенов DLE - создание дополнительных токенов через governance</p>
              <div class="module-features">
                <span class="feature-tag">Минтинг</span>
                <span class="feature-tag">Токены</span>
                <span class="feature-tag">Governance</span>
              </div>
            </div>
            <div class="module-actions">
              <button 
                class="btn btn-primary btn-deploy" 
                @click="deployModule('mint')"
                :disabled="isDeploying"
              >
                <i class="fas fa-rocket" v-if="!isDeploying"></i>
                <i class="fas fa-spinner fa-spin" v-else></i>
                {{ isDeploying ? 'Деплой...' : 'Деплой' }}
              </button>
            </div>
          </div>

          <!-- BurnModule -->
          <div class="module-deploy-card">
            <div class="module-content">
              <h4>BurnModule</h4>
              <p>Сжигание токенов DLE - уменьшение общего предложения через governance</p>
              <div class="module-features">
                <span class="feature-tag">Сжигание</span>
                <span class="feature-tag">Токены</span>
                <span class="feature-tag">Governance</span>
              </div>
            </div>
            <div class="module-actions">
              <button 
                class="btn btn-primary btn-deploy" 
                @click="deployModule('burn')"
                :disabled="isDeploying"
              >
                <i class="fas fa-rocket" v-if="!isDeploying"></i>
                <i class="fas fa-spinner fa-spin" v-else></i>
                {{ isDeploying ? 'Деплой...' : 'Деплой' }}
              </button>
            </div>
          </div>

          <!-- OracleModule -->
          <div class="module-deploy-card">
            <div class="module-content">
              <h4>OracleModule</h4>
              <p>Интеграция с внешними данными - автоматизация на основе IoT, API, датчиков</p>
              <div class="module-features">
                <span class="feature-tag">Оракулы</span>
                <span class="feature-tag">Автоматизация</span>
                <span class="feature-tag">IoT</span>
                <span class="feature-tag">API</span>
              </div>
            </div>
            <div class="module-actions">
              <button 
                class="btn btn-primary btn-deploy" 
                @click="deployModule('oracle')"
                :disabled="isDeploying"
              >
                <i class="fas fa-rocket" v-if="!isDeploying"></i>
                <i class="fas fa-spinner fa-spin" v-else></i>
                {{ isDeploying ? 'Деплой...' : 'Деплой' }}
              </button>
            </div>
          </div>

          <!-- InheritanceModule -->
          <div class="module-deploy-card">
            <div class="module-content">
              <h4>InheritanceModule</h4>
              <p>Наследование токенов - автоматическая передача токенов наследникам</p>
              <div class="module-features">
                <span class="feature-tag">Наследование</span>
                <span class="feature-tag">Безопасность</span>
                <span class="feature-tag">Юридические</span>
                <span class="feature-tag">Автоматизация</span>
              </div>
            </div>
            <div class="module-actions">
              <button 
                class="btn btn-primary btn-deploy" 
                @click="deployModule('inheritance')"
                :disabled="isDeploying"
              >
                <i class="fas fa-rocket" v-if="!isDeploying"></i>
                <i class="fas fa-spinner fa-spin" v-else></i>
                {{ isDeploying ? 'Деплой...' : 'Деплой' }}
              </button>
            </div>
          </div>

          <!-- VestingModule -->
          <div class="module-deploy-card">
            <div class="module-content">
              <h4>VestingModule</h4>
              <p>Вестинг токенов - постепенное разблокирование токенов по расписанию</p>
              <div class="module-features">
                <span class="feature-tag">Вестинг</span>
                <span class="feature-tag">Мотивация</span>
                <span class="feature-tag">Удержание</span>
                <span class="feature-tag">Расписание</span>
              </div>
            </div>
            <div class="module-actions">
              <button 
                class="btn btn-primary btn-deploy" 
                @click="deployModule('vesting')"
                :disabled="isDeploying"
              >
                <i class="fas fa-rocket" v-if="!isDeploying"></i>
                <i class="fas fa-spinner fa-spin" v-else></i>
                {{ isDeploying ? 'Деплой...' : 'Деплой' }}
              </button>
            </div>
          </div>

          <!-- StakingModule -->
          <div class="module-deploy-card">
            <div class="module-content">
              <h4>StakingModule</h4>
              <p>Стейкинг токенов - заработок на удержании токенов</p>
              <div class="module-features">
                <span class="feature-tag">Стейкинг</span>
                <span class="feature-tag">Доход</span>
                <span class="feature-tag">Ликвидность</span>
                <span class="feature-tag">APY</span>
              </div>
            </div>
            <div class="module-actions">
              <button 
                class="btn btn-primary btn-deploy" 
                @click="deployModule('staking')"
                :disabled="isDeploying"
              >
                <i class="fas fa-rocket" v-if="!isDeploying"></i>
                <i class="fas fa-spinner fa-spin" v-else></i>
                {{ isDeploying ? 'Деплой...' : 'Деплой' }}
              </button>
            </div>
          </div>

          <!-- InsuranceModule -->
          <div class="module-deploy-card">
            <div class="module-content">
              <h4>InsuranceModule</h4>
              <p>Страхование токенов - защита от рисков и потерь</p>
              <div class="module-features">
                <span class="feature-tag">Страхование</span>
                <span class="feature-tag">Защита</span>
                <span class="feature-tag">Риски</span>
                <span class="feature-tag">Безопасность</span>
              </div>
            </div>
            <div class="module-actions">
              <button 
                class="btn btn-primary btn-deploy" 
                @click="deployModule('insurance')"
                :disabled="isDeploying"
              >
                <i class="fas fa-rocket" v-if="!isDeploying"></i>
                <i class="fas fa-spinner fa-spin" v-else></i>
                {{ isDeploying ? 'Деплой...' : 'Деплой' }}
              </button>
            </div>
          </div>

          <!-- ComplianceModule -->
          <div class="module-deploy-card">
            <div class="module-content">
              <h4>ComplianceModule</h4>
              <p>Соответствие требованиям - KYC/AML, налоги, аудит</p>
              <div class="module-features">
                <span class="feature-tag">KYC/AML</span>
                <span class="feature-tag">Налоги</span>
                <span class="feature-tag">Аудит</span>
                <span class="feature-tag">Регуляторы</span>
              </div>
            </div>
            <div class="module-actions">
              <button 
                class="btn btn-primary btn-deploy" 
                @click="deployModule('compliance')"
                :disabled="isDeploying"
              >
                <i class="fas fa-rocket" v-if="!isDeploying"></i>
                <i class="fas fa-spinner fa-spin" v-else></i>
                {{ isDeploying ? 'Деплой...' : 'Деплой' }}
              </button>
            </div>
          </div>

          <!-- SupplyChainModule -->
          <div class="module-deploy-card">
            <div class="module-content">
              <h4>SupplyChainModule</h4>
              <p>Цепочка поставок - отслеживание и токенизация логистики</p>
              <div class="module-features">
                <span class="feature-tag">Логистика</span>
                <span class="feature-tag">Отслеживание</span>
                <span class="feature-tag">Качество</span>
                <span class="feature-tag">Прозрачность</span>
              </div>
            </div>
            <div class="module-actions">
              <button 
                class="btn btn-primary btn-deploy" 
                @click="deployModule('supplychain')"
                :disabled="isDeploying"
              >
                <i class="fas fa-rocket" v-if="!isDeploying"></i>
                <i class="fas fa-spinner fa-spin" v-else></i>
                {{ isDeploying ? 'Деплой...' : 'Деплой' }}
              </button>
            </div>
          </div>

          <!-- EventModule -->
          <div class="module-deploy-card">
            <div class="module-content">
              <h4>EventModule</h4>
              <p>Событийный модуль - токенизация мероприятий и событий</p>
              <div class="module-features">
                <span class="feature-tag">События</span>
                <span class="feature-tag">NFT-билеты</span>
                <span class="feature-tag">Мероприятия</span>
                <span class="feature-tag">VR/AR</span>
              </div>
            </div>
            <div class="module-actions">
              <button 
                class="btn btn-primary btn-deploy" 
                @click="deployModule('event')"
                :disabled="isDeploying"
              >
                <i class="fas fa-rocket" v-if="!isDeploying"></i>
                <i class="fas fa-spinner fa-spin" v-else></i>
                {{ isDeploying ? 'Деплой...' : 'Деплой' }}
              </button>
            </div>
          </div>

          <!-- HierarchicalVotingModule -->
          <div class="module-deploy-card">
            <div class="module-content">
              <h4>HierarchicalVotingModule</h4>
              <p>Иерархическое голосование - DLE может голосовать в других DLE на основе владения токенами</p>
              <div class="module-features">
                <span class="feature-tag">Голосование</span>
                <span class="feature-tag">Иерархия</span>
                <span class="feature-tag">Токены</span>
                <span class="feature-tag">Governance</span>
              </div>
            </div>
            <div class="module-actions">
              <button 
                class="btn btn-primary btn-deploy" 
                @click="deployModule('hierarchicalVoting')"
                :disabled="isDeploying"
              >
                <i class="fas fa-rocket" v-if="!isDeploying"></i>
                <i class="fas fa-spinner fa-spin" v-else></i>
                {{ isDeploying ? 'Деплой...' : 'Деплой' }}
              </button>
            </div>
          </div>
        </div>
      </div>


      <!-- Список модулей -->
      <div class="modules-list">
        <div class="list-header">
          <h3>📋 Модули DLE</h3>
          <button class="btn btn-sm btn-outline-secondary" @click="loadModules" :disabled="isLoadingModules || isLoadingDeploymentStatus">
            <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoadingModules || isLoadingDeploymentStatus }"></i> Обновить
          </button>
        </div>

        <!-- Статус деплоя -->
        <div v-if="isLoadingDeploymentStatus" class="deployment-status">
          <div class="status-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Проверка статуса деплоя...</span>
          </div>
        </div>

        <div v-else-if="!canShowModules" class="deployment-status">
          <div class="status-message" :class="deploymentStatus">
            <div class="status-icon">
              <i v-if="deploymentStatus === 'completed'" class="fas fa-check-circle"></i>
              <i v-else-if="deploymentStatus === 'in_progress'" class="fas fa-spinner fa-spin"></i>
              <i v-else-if="deploymentStatus === 'failed'" class="fas fa-exclamation-triangle"></i>
              <i v-else-if="deploymentStatus === 'not_started'" class="fas fa-play-circle"></i>
              <i v-else class="fas fa-question-circle"></i>
            </div>
            <div class="status-content">
              <h4>{{ deploymentStatusMessage }}</h4>
              <p v-if="deploymentStatus === 'not_started'">
                Для активации модулей необходимо запустить поэтапный деплой DLE.
              </p>
              <p v-else-if="deploymentStatus === 'failed'">
                Проверьте логи деплоя и повторите попытку через форму деплоя.
              </p>
              <p v-else-if="deploymentStatus === 'in_progress'">
                Дождитесь завершения деплоя. Модули станут доступны автоматически.
              </p>
            </div>
          </div>
        </div>

        <div v-else-if="isLoadingModules" class="loading-modules">
          <p>Загрузка модулей...</p>
        </div>

        <div v-else-if="modules.length === 0" class="no-modules">
          <p>Модулей пока нет</p>
          <p>Используйте форму выше для добавления первого модуля</p>
        </div>

        <div v-else-if="canShowModules && modules.length > 0" class="modules-grid">
          <div 
            v-for="module in modules" 
            :key="module.moduleId" 
            class="module-card"
            :class="{ 'active': module.isActive, 'inactive': !module.isActive }"
          >
            <div class="module-header">
              <h5>{{ module.moduleName || 'Неизвестный модуль' }}</h5>
              <span class="module-status" :class="{ 'active': module.isActive, 'inactive': !module.isActive }">
                {{ module.isActive ? 'Активен' : 'Неактивен' }}
              </span>
            </div>

            <div class="module-details">
              <div class="detail-item" v-if="module.moduleDescription">
                <strong>Описание:</strong> 
                <span>{{ module.moduleDescription }}</span>
              </div>
              
              <!-- Адреса модуля в разных сетях -->
              <div class="detail-item">
                <strong>Адреса в сетях:</strong>
                <div class="addresses-list">
                  <div 
                    v-for="addr in module.addresses" 
                    :key="`${module.moduleId}-${addr.networkIndex}`"
                    class="address-item"
                  >
                    <span class="network-badge">{{ addr.networkName }}</span>
                    <a 
                      :href="getEtherscanUrl(addr.address, addr.networkIndex, addr.chainId)" 
                      target="_blank" 
                      class="address-link"
                    >
                      {{ shortenAddress(addr.address) }}
                      <i class="fas fa-external-link-alt"></i>
                    </a>
                    <span class="verification-status" :class="addr.verificationStatus">
                      <i class="fas fa-check-circle" v-if="addr.verificationStatus === 'success'"></i>
                      <i class="fas fa-times-circle" v-else-if="addr.verificationStatus === 'failed'"></i>
                      <i class="fas fa-clock" v-else></i>
                    </span>
                  </div>
                </div>
              </div>
              
              <div class="detail-item" v-if="module.deployedAt">
                <strong>Дата деплоя:</strong> 
                <span>{{ formatDate(module.deployedAt) }}</span>
              </div>
              
              <!-- Информация о DLE -->
              <div class="detail-item" v-if="module.dleName">
                <strong>DLE:</strong> 
                <span>{{ module.dleName }} ({{ module.dleSymbol }})</span>
              </div>
              
              <div class="detail-item" v-if="module.dleLocation">
                <strong>Местоположение:</strong> 
                <span>{{ module.dleLocation }}</span>
              </div>
              
              <div class="detail-item" v-if="module.dleJurisdiction">
                <strong>Юрисдикция:</strong> 
                <span>{{ module.dleJurisdiction }}</span>
              </div>
              
              <div class="detail-item" v-if="module.dleOkvedCodes && module.dleOkvedCodes.length > 0">
                <strong>ОКВЭД:</strong> 
                <span>{{ module.dleOkvedCodes.join(', ') }}</span>
              </div>
              
              <div class="detail-item" v-if="module.dleOktmo">
                <strong>ОКТМО:</strong> 
                <span>{{ module.dleOktmo }}</span>
              </div>
            </div>

            <div class="module-actions">
              <button 
                v-if="!module.isActive"
                class="btn btn-sm btn-success" 
                @click="activateModule(module.moduleId)"
                :disabled="isActivating === module.moduleId"
              >
                <i class="fas fa-check"></i> 
                {{ isActivating === module.moduleId ? 'Активация...' : 'Активировать' }}
                </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </BaseLayout>
</template>

<script setup>
import { defineProps, defineEmits, ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import { 
  isModuleActive,
  getModuleAddress,
  getAllModules,
  getNetworksInfo,
  getDeploymentStatus
} from '../../services/modulesService.js';
import api from '../../api/axios';
import wsClient from '../../utils/websocket';

// Определяем props
const props = defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false }
});

// Определяем emits
const emit = defineEmits(['auth-action-completed']);

const router = useRouter();
const route = useRoute();

// Получаем адрес DLE из URL
const dleAddress = computed(() => {
  return route.query.address;
});

// Функция возврата к блокам управления
const goBackToBlocks = () => {
  if (dleAddress.value) {
    router.push(`/management/dle-blocks?address=${dleAddress.value}`);
  } else {
    router.push('/management');
  }
};

// Состояние
const selectedDle = ref(null);
const isLoadingDle = ref(false);
const modules = ref([]);
const supportedNetworks = ref([]);
const isLoadingModules = ref(false);
const isActivating = ref(null);

// Состояние деплоя модулей
const isDeploying = ref(false);
const deploymentProgress = ref(null);
const moduleDeploymentStatus = ref(null);

// Состояние модального окна деплоя
const showDeploymentModal = ref(false);
const currentDeployingModule = ref('');
const deploymentStep = ref(0);
const progressPercentage = ref(0);
const deploymentLogs = ref([]);

// WebSocket соединение (используем глобальный wsClient)
const isWSConnected = ref(false);

// Debounce для предотвращения частых вызовов loadModules
let loadModulesTimeout = null;

// Состояние деплоя
const deploymentStatus = ref('unknown'); // 'unknown', 'completed', 'in_progress', 'failed', 'not_started'
const isLoadingDeploymentStatus = ref(false);
// Вычисляемые свойства

// Статус деплоя
const canShowModules = computed(() => deploymentStatus.value === 'completed');
const deploymentStatusMessage = computed(() => {
  switch (deploymentStatus.value) {
    case 'completed':
      return 'Деплой завершен. Модули готовы к использованию.';
    case 'in_progress':
      return 'Деплой в процессе. Модули будут доступны после завершения.';
    case 'failed':
      return 'Деплой не удался. Проверьте логи и повторите попытку.';
    case 'not_started':
      return 'Деплой не начат. Запустите деплой для активации модулей.';
    default:
      return 'Статус деплоя неизвестен. Проверьте состояние системы.';
  }
});

// Загрузка данных DLE
async function loadDleData() {
  try {
    isLoadingDle.value = true;
    const dleAddress = route.query.address;
    
    if (!dleAddress) {
      console.error('Адрес DLE не указан');
      return;
    }

    console.log('[ModulesView] Загрузка данных DLE:', dleAddress);
    
    // Читаем данные из блокчейна
    const response = await api.post('/blockchain/read-dle-info', {
      dleAddress: dleAddress
    });
    
    if (response.data.success) {
      selectedDle.value = response.data.data;
      console.log('[ModulesView] Данные DLE загружены:', selectedDle.value);
    } else {
      console.error('[ModulesView] Ошибка загрузки DLE:', response.data.error);
    }
  } catch (error) {
    console.error('[ModulesView] Ошибка загрузки DLE:', error);
  } finally {
    isLoadingDle.value = false;
  }
}

// Проверка статуса деплоя
async function checkDeploymentStatus() {
  try {
    isLoadingDeploymentStatus.value = true;
    const dleAddress = route.query.address;
    
    if (!dleAddress) {
      console.warn('[ModulesView] Адрес DLE не найден для проверки статуса деплоя');
      deploymentStatus.value = 'unknown';
      return;
    }

    console.log('[ModulesView] Проверка статуса деплоя для DLE:', dleAddress);
    
    const statusResponse = await getDeploymentStatus(dleAddress);
    console.log('[ModulesView] Статус деплоя:', statusResponse);
    
    if (statusResponse.success) {
      deploymentStatus.value = statusResponse.data.status || 'unknown';
    } else {
      deploymentStatus.value = 'unknown';
    }
    
  } catch (error) {
    console.error('[ModulesView] Ошибка при проверке статуса деплоя:', error);
    deploymentStatus.value = 'unknown';
  } finally {
    isLoadingDeploymentStatus.value = false;
  }
}

// Загрузка модулей
// Debounced версия loadModules для предотвращения частых вызовов
function loadModulesDebounced() {
  if (loadModulesTimeout) {
    clearTimeout(loadModulesTimeout);
  }
  
  loadModulesTimeout = setTimeout(() => {
    loadModules();
  }, 1000); // Задержка 1 секунда
}

async function loadModules() {
  try {
    isLoadingModules.value = true;
    const dleAddress = route.query.address;
    
    if (!dleAddress) {
      console.error('[ModulesView] Адрес DLE не указан');
      modules.value = [];
      supportedNetworks.value = [];
      return;
    }

    console.log('[ModulesView] Загрузка модулей для DLE:', dleAddress);
    
    // Проверяем статус деплоя (но не блокируем загрузку модулей)
    try {
    await checkDeploymentStatus();
    } catch (error) {
      console.warn('[ModulesView] Ошибка при проверке статуса деплоя, устанавливаем completed:', error);
      deploymentStatus.value = 'completed'; // Устанавливаем статус как завершенный при ошибке
    }
    
    // Загружаем модули и информацию о сетях параллельно
    const [modulesResponse, networksResponse] = await Promise.all([
      getAllModules(dleAddress),
      getNetworksInfo(dleAddress)
    ]);
    
    console.log('[ModulesView] Ответ от API модулей:', modulesResponse);
    console.log('[ModulesView] Ответ от API сетей:', networksResponse);
    
    if (modulesResponse.success) {
      modules.value = modulesResponse.data.modules || [];
      console.log('[ModulesView] Модули загружены успешно:', {
        count: modules.value.length,
        modules: modules.value.map(m => ({ 
          name: m.moduleName, 
          addresses: m.addresses?.length || 0,
          active: m.isActive,
          id: m.moduleId 
        })),
        requiresGovernance: modulesResponse.data.requiresGovernance,
        totalModules: modulesResponse.data.totalModules,
        activeModules: modulesResponse.data.activeModules
      });
      
      // Обновляем счетчики
      if (modulesResponse.data.requiresGovernance === true) {
        console.log('[ModulesView] Модули требуют инициализации через governance');
      }
      
    } else {
      console.error('[ModulesView] Ошибка загрузки модулей:', modulesResponse.error);
      modules.value = [];
    }

    if (networksResponse.success) {
      supportedNetworks.value = networksResponse.data.networks || [];
      console.log('[ModulesView] Сети загружены успешно:', {
        count: supportedNetworks.value.length,
        networks: supportedNetworks.value.map(n => ({
          name: n.networkName,
          chainId: n.chainId
        }))
      });
    } else {
      console.error('[ModulesView] Ошибка загрузки сетей:', networksResponse.error);
      supportedNetworks.value = [];
    }
    
  } catch (error) {
    console.error('[ModulesView] Ошибка загрузки модулей:', error);
    console.error('[ModulesView] Детали ошибки:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    modules.value = [];
    supportedNetworks.value = [];
  } finally {
    isLoadingModules.value = false;
  }
}



// Активация модуля (заглушка)
async function activateModule(moduleId) {
  try {
    isActivating.value = moduleId;
    console.log('[ModulesView] Активация модуля:', moduleId);
    
    // Здесь нужно будет реализовать активацию модуля
    alert('Функция активации модуля будет реализована позже');
    
  } catch (error) {
    console.error('[ModulesView] Ошибка активации модуля:', error);
    alert('❌ Ошибка активации модуля: ' + error.message);
  } finally {
    isActivating.value = null;
  }
}



// Утилиты
function getEtherscanUrl(address, networkIndex, chainId) {
  // Если есть chainId, ищем информацию о сети в supportedNetworks
  if (chainId && supportedNetworks.value.length > 0) {
    const network = supportedNetworks.value.find(n => n.chainId === chainId);
    if (network && network.etherscanUrl) {
      return `${network.etherscanUrl}/address/${address}`;
    }
  }
  
  // Fallback на старую логику по networkIndex (для обратной совместимости)
  const networkUrls = {
    0: `https://sepolia.etherscan.io/address/${address}`,      // Sepolia
    1: `https://mumbai.polygonscan.com/address/${address}`,   // Mumbai
    2: `https://testnet.bscscan.com/address/${address}`,      // BSC Testnet
    3: `https://sepolia.arbiscan.io/address/${address}`       // Arbitrum Sepolia
  };
  
  return networkUrls[networkIndex] || networkUrls[0]; // fallback на Sepolia
}

function shortenAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return dateString;
  }
}

// Функции для работы с WebSocket
function connectWebSocket() {
  // Используем глобальный wsClient
  wsClient.connect();
  isWSConnected.value = wsClient.isConnected;
  
  // Подписываемся на события модулей
  wsClient.subscribe('subscribed', handleWebSocketMessage);
  wsClient.subscribe('deployment_started', handleWebSocketMessage);
  wsClient.subscribe('deployment_status', handleWebSocketMessage);
  wsClient.subscribe('deployment_log', handleWebSocketMessage);
  wsClient.subscribe('deployment_finished', handleWebSocketMessage);
  wsClient.subscribe('error', handleWebSocketMessage);
  wsClient.subscribe('modules_updated', handleWebSocketMessage);
  wsClient.subscribe('module_verified', handleWebSocketMessage);
  wsClient.subscribe('module_deployment_error', handleWebSocketMessage);
  
  // Подписываемся на деплой для текущего DLE
  if (dleAddress.value) {
    console.log('[ModulesView] Подписываемся на DLE:', dleAddress.value);
    wsClient.ws.send(JSON.stringify({
      type: 'subscribe',
      dleAddress: dleAddress.value
    }));
  } else {
    console.warn('[ModulesView] dleAddress не найден для подписки');
  }
}

function handleWebSocketMessage(data) {
  console.log('[ModulesView] WebSocket сообщение:', data);
  
  // Проверяем, что data существует и имеет type
  if (!data || !data.type) {
    console.warn('[ModulesView] Получены некорректные данные WebSocket:', data);
    return;
  }
  
  console.log('[ModulesView] Тип сообщения:', data.type);
  console.log('[ModulesView] DLE адрес в сообщении:', data.dleAddress);
  console.log('[ModulesView] Текущий DLE адрес:', dleAddress.value);
  
  switch (data.type) {
    case 'subscribed':
      addLog('info', `Подписка на деплой активирована для DLE: ${data.dleAddress}`);
      break;
      
    case 'deployment_started':
      console.log('[ModulesView] Показываем модалку деплоя');
      showDeploymentModal.value = true;
      deploymentStep.value = 1;
      progressPercentage.value = 10;
      moduleDeploymentStatus.value = 'starting';
      deploymentProgress.value = data.message;
      addLog('info', data.message);
      break;
      
    case 'deployment_status':
      updateDeploymentProgress(data);
      break;
      
    case 'deployment_log':
      console.log('[ModulesView] Получен лог деплоя:', data.log);
      addLog(data.log.type, data.log.message);
      break;
      
    case 'deployment_finished':
      deploymentStep.value = 5;
      progressPercentage.value = 100;
      moduleDeploymentStatus.value = data.status;
      deploymentProgress.value = data.message;
      addLog(data.status === 'completed' ? 'success' : 'error', data.message);
      
      // Автоматически закрываем модальное окно через 3 секунды
      if (data.status === 'completed') {
        setTimeout(async () => {
          loadModulesDebounced();
          setTimeout(() => {
            closeDeploymentModal();
          }, 2000);
        }, 3000);
      }
      break;
      
    case 'error':
      addLog('error', data.message);
      break;
      
    // Обработка сообщений модулей
    case 'modules_updated':
      // Автоматически обновляем список модулей
      console.log('[ModulesView] Получено уведомление об обновлении модулей');
      loadModulesDebounced();
      break;
      
    case 'module_verified':
      console.log('[ModulesView] Модуль верифицирован:', data);
      addLog('success', `Модуль ${data.moduleType} верифицирован в сети ${data.network}`);
      break;
      
    case 'module_deployment_error':
      console.log('[ModulesView] Ошибка деплоя модуля:', data);
      addLog('error', `Ошибка деплоя модуля ${data.moduleType}: ${data.error}`);
      break;
      
    default:
      console.log('[ModulesView] Неизвестный тип сообщения:', data.type, data);
      // Для неизвестных типов просто логируем
      if (data.log) {
        addLog(data.log.type || 'info', data.log.message);
      }
      break;
  }
}

function updateDeploymentProgress(data) {
  if (data.status) {
    moduleDeploymentStatus.value = data.status;
  }
  if (data.progress !== undefined) {
    progressPercentage.value = data.progress;
  }
  if (data.step !== undefined) {
    deploymentStep.value = data.step;
  }
  if (data.message) {
    deploymentProgress.value = data.message;
  }
}

function disconnectWebSocket() {
  // Отписываемся от всех событий модулей
  wsClient.unsubscribe('subscribed', handleWebSocketMessage);
  wsClient.unsubscribe('deployment_started', handleWebSocketMessage);
  wsClient.unsubscribe('deployment_status', handleWebSocketMessage);
  wsClient.unsubscribe('deployment_log', handleWebSocketMessage);
  wsClient.unsubscribe('deployment_finished', handleWebSocketMessage);
  wsClient.unsubscribe('error', handleWebSocketMessage);
  wsClient.unsubscribe('modules_updated', handleWebSocketMessage);
  wsClient.unsubscribe('module_verified', handleWebSocketMessage);
  wsClient.unsubscribe('module_deployment_error', handleWebSocketMessage);
  
  isWSConnected.value = false;
}




// Функции для работы с модальным окном
function openDeploymentModal(moduleType) {
  showDeploymentModal.value = true;
  currentDeployingModule.value = moduleType;
  deploymentStep.value = 0;
  progressPercentage.value = 0;
  deploymentLogs.value = [];
  addLog('info', 'Инициализация деплоя модуля...');
  
  // Подключаемся к WebSocket
  connectWebSocket();
}

function closeDeploymentModal() {
  showDeploymentModal.value = false;
  currentDeployingModule.value = '';
  deploymentStep.value = 0;
  progressPercentage.value = 0;
  deploymentLogs.value = [];
  deploymentProgress.value = null;
  moduleDeploymentStatus.value = null;
  isDeploying.value = false;
  
  // Отключаем WebSocket
  disconnectWebSocket();
}

function addLog(type, message) {
  const now = new Date();
  const time = now.toLocaleTimeString('ru-RU');
  deploymentLogs.value.push({
    type,
    message,
    time
  });
}

function getStatusTitle() {
  switch (moduleDeploymentStatus.value) {
    case 'starting':
      return 'Деплой запущен';
    case 'success':
      return 'Деплой завершен успешно';
    case 'error':
      return 'Ошибка деплоя';
    default:
      return 'Подготовка к деплою';
  }
}


// Функция деплоя модулей
async function deployModule(moduleType) {
  if (isDeploying.value) return;
  
  try {
    // Открываем модальное окно и подключаемся к WebSocket
    openDeploymentModal(moduleType);
    
    isDeploying.value = true;
    deploymentProgress.value = 'Инициализация деплоя...';
    moduleDeploymentStatus.value = 'starting';
    
    console.log(`[ModulesView] Начинаем деплой модуля ${moduleType} для DLE ${dleAddress.value}`);
    
    // Вызываем API для деплоя модуля с данными из БД
    const response = await api.post('/module-deployment/deploy-module-from-db', {
      dleAddress: dleAddress.value,
      moduleType: moduleType
    });
    
    if (response.data.success) {
      if (response.data.status === 'started') {
        addLog('success', 'Деплой успешно запущен. Отслеживание через WebSocket...');
      } else {
        // Если деплой завершился сразу
        deploymentProgress.value = 'Деплой успешно завершен!';
        moduleDeploymentStatus.value = 'success';
        addLog('success', 'Деплой завершен успешно');
        
        // Перезагружаем список модулей
        await loadModules();
        
        // Закрываем модальное окно через 3 секунды
        setTimeout(() => {
          closeDeploymentModal();
        }, 3000);
      }
      
    } else {
      throw new Error(response.data.error || 'Ошибка при деплое модуля');
    }
    
  } catch (error) {
    console.error('[ModulesView] Ошибка при деплое модуля:', error);
    deploymentProgress.value = `Ошибка: ${error.message}`;
    moduleDeploymentStatus.value = 'error';
    addLog('error', `Ошибка: ${error.message}`);
  } finally {
    isDeploying.value = false;
  }
}

// Инициализация
onMounted(() => {
  loadDleData();
  loadModules(); // Первоначальная загрузка без debounce
  
  // Подключаемся к WebSocket (объединенное соединение)
  connectWebSocket();
});

onUnmounted(() => {
  // Отключаем WebSocket при размонтировании компонента
  disconnectWebSocket();
});
</script>

<style scoped>
.modules-management {
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
  margin-bottom: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.page-header h1 {
  color: var(--color-primary);
  font-size: 2rem;
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
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}


.info-card h3 {
  margin: 0 0 15px 0;
  color: var(--color-primary);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.info-item {
  padding: 10px;
  background: white;
  border-radius: var(--radius-sm);
  border: 1px solid #dee2e6;
}

/* Блоки для деплоя стандартных модулей */
.standard-modules {
  background: #f8f9fa;
  border-radius: var(--radius-md);
  padding: 20px;
  margin-bottom: 30px;
  border: 1px solid #e9ecef;
}

.modules-header {
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #dee2e6;
}

.modules-header h3 {
  margin: 0 0 10px 0;
  color: var(--color-primary);
}

.modules-header p {
  margin: 0 0 15px 0;
  color: #666;
}

.module-deploy-card {
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-md);
  margin-bottom: 15px;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.module-deploy-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.module-content {
  flex: 1;
  margin-bottom: 20px;
}

.module-content h4 {
  margin: 0 0 8px 0;
  color: var(--color-primary);
  font-size: 1.2rem;
  font-weight: 600;
}

.module-content p {
  margin: 0 0 12px 0;
  color: #666;
  font-size: 14px;
  line-height: 1.4;
}

.module-features {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.feature-tag {
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
  color: #1976d2;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid #90caf9;
}

.module-actions {
  display: flex;
  justify-content: center;
}

.btn-deploy {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn-deploy:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--color-primary-dark), var(--color-primary));
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  transform: translateY(-1px);
}

.btn-deploy:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Форма добавления модуля */
.add-module-form {
  background: #f8f9fa;
  border-radius: var(--radius-md);
  padding: 20px;
  margin-bottom: 30px;
  border: 1px solid #e9ecef;
}

.form-header h3 {
  margin: 0 0 10px 0;
  color: var(--color-primary);
}

.form-header p {
  margin: 0 0 20px 0;
  color: #666;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #333;
}

.form-control {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: var(--radius-sm);
  font-size: 14px;
}

.form-control:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.1);
}

.form-help {
  display: block;
  margin-top: 5px;
  font-size: 12px;
  color: #666;
}

.form-actions {
  margin-top: 20px;
}

/* Список модулей */
.modules-list {
  background: white;
  border-radius: var(--radius-md);
  padding: 20px;
  border: 1px solid #e9ecef;
}

/* Статус деплоя */
.deployment-status {
  margin: 20px 0;
}

.status-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.status-loading i {
  color: #007bff;
  font-size: 1.2rem;
}

.status-loading span {
  color: #6c757d;
  font-weight: 500;
}

.status-message {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  padding: 20px;
  border-radius: 12px;
  border: 2px solid;
}

.status-message.completed {
  background-color: #e8f5e8;
  border-color: #28a745;
}

.status-message.in_progress {
  background-color: #e3f2fd;
  border-color: #007bff;
}

.status-message.failed {
  background-color: #ffebee;
  border-color: #dc3545;
}

.status-message.not_started {
  background-color: #fff3cd;
  border-color: #ffc107;
}

.status-message.unknown {
  background-color: #f8f9fa;
  border-color: #6c757d;
}

.status-icon {
  font-size: 2rem;
  margin-top: 5px;
}

.status-message.completed .status-icon {
  color: #28a745;
}

.status-message.in_progress .status-icon {
  color: #007bff;
}

.status-message.failed .status-icon {
  color: #dc3545;
}

.status-message.not_started .status-icon {
  color: #ffc107;
}

.status-message.unknown .status-icon {
  color: #6c757d;
}

.status-content h4 {
  margin: 0 0 10px 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.status-content p {
  margin: 0;
  color: #6c757d;
  line-height: 1.5;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.list-header h3 {
  margin: 0;
  color: var(--color-primary);
}

.loading-modules,
.no-modules {
  text-align: center;
  padding: 40px;
  color: #666;
}

.modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.module-card {
  border: 1px solid #e9ecef;
  border-radius: var(--radius-md);
  padding: 15px;
  transition: all 0.2s;
}

.module-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.module-card.active {
  border-color: #28a745;
  background: #f8fff9;
}

.module-card.inactive {
  border-color: #dc3545;
  background: #fff8f8;
}

.module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.module-header h5 {
  margin: 0;
  font-size: 14px;
  font-family: monospace;
  word-break: break-all;
}

.module-status {
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
}

.module-status.active {
  background: #d4edda;
  color: #155724;
}

.module-status.inactive {
  background: #f8d7da;
  color: #721c24;
}

.module-details {
  margin-bottom: 15px;
}

.detail-item {
  margin-bottom: 5px;
  font-size: 14px;
}

.detail-item strong {
  color: #333;
}

.address-link {
  color: var(--color-primary);
  text-decoration: none;
  font-family: monospace;
}

.address-link:hover {
  text-decoration: underline;
}

.network-badge {
  background: transparent;
  color: var(--color-text);
  padding: 0;
  border-radius: 0;
  font-size: 14px;
  font-weight: normal;
  margin-right: 10px;
}

.addresses-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.address-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.module-actions {
  display: flex;
  gap: 10px;
}

/* Кнопки */
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 5px;
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
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #218838;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-outline-secondary {
  background: transparent;
  color: #6c757d;
  border: 1px solid #6c757d;
}

.btn-outline-secondary:hover:not(:disabled) {
  background: #6c757d;
  color: white;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

/* Модальное окно деплоя */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
}

.modal-content {
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-50px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 15px;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
}

.websocket-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #ffc107;
  font-weight: 500;
}

.websocket-status.connected {
  color: #28a745;
}

.websocket-status i {
  font-size: 8px;
}

.modal-close {
  background: none;
  border: none;
  color: white;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  transition: background 0.2s;
}

.modal-close:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.modal-close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-body {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.deployment-status-card {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: var(--radius-md);
  margin-bottom: 20px;
  border: 1px solid #e9ecef;
}

.status-icon {
  font-size: 2rem;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e9ecef;
}

.status-icon.starting {
  color: #ffc107;
  background: #fff3cd;
}

.status-icon.success {
  color: #28a745;
  background: #d4edda;
}

.status-icon.error {
  color: #dc3545;
  background: #f8d7da;
}

.status-content h4 {
  margin: 0 0 5px 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}

.status-content p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.progress-section {
  margin-bottom: 20px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 4px;
  transition: width 0.5s ease;
}

.progress-text {
  text-align: center;
  font-weight: 600;
  color: #667eea;
  font-size: 14px;
}

.deployment-details {
  margin-bottom: 20px;
}

.detail-step {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  border-radius: var(--radius-md);
  margin-bottom: 10px;
  transition: all 0.3s;
  border: 1px solid #e9ecef;
}

.detail-step.active {
  background: #e3f2fd;
  border-color: #2196f3;
}

.detail-step.completed {
  background: #e8f5e8;
  border-color: #28a745;
}

.step-icon {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e9ecef;
  color: #666;
  font-size: 14px;
}

.detail-step.active .step-icon {
  background: #2196f3;
  color: white;
}

.detail-step.completed .step-icon {
  background: #28a745;
  color: white;
}

.step-content h5 {
  margin: 0 0 5px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.step-content p {
  margin: 0;
  font-size: 12px;
  color: #666;
}

.deployment-log {
  margin-top: 20px;
}

.deployment-log h5 {
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.log-container {
  max-height: 150px;
  overflow-y: auto;
  background: #f8f9fa;
  border-radius: var(--radius-sm);
  padding: 10px;
  border: 1px solid #e9ecef;
}

.log-entry {
  display: flex;
  gap: 10px;
  padding: 5px 0;
  font-size: 12px;
  border-bottom: 1px solid #e9ecef;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  color: #666;
  font-family: monospace;
  min-width: 60px;
}

.log-message {
  flex: 1;
}

.log-entry.info .log-message {
  color: #333;
}

.log-entry.success .log-message {
  color: #28a745;
}

.log-entry.error .log-message {
  color: #dc3545;
}

.modal-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  border-top: 1px solid #e9ecef;
  background: #f8f9fa;
}

.success-message {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #28a745;
  font-weight: 500;
  font-size: 14px;
}

.success-message i {
  font-size: 1.2rem;
}

/* Адаптивность */
@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .modules-grid {
    grid-template-columns: 1fr;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
}

/* Адаптивность для блоков деплоя */
@media (max-width: 768px) {
  .module-deploy-card {
    padding: 15px;
  }
  
  .module-content {
    margin-bottom: 15px;
  }
  
  .btn-deploy {
    width: 100%;
    justify-content: center;
  }
}
</style>
