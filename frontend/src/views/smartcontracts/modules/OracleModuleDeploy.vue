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
    <div class="module-deploy-page">
      <!-- Заголовок -->
      <div class="page-header">
        <div class="header-content">
          <h1>🔗 Деплой OracleModule</h1>
          <p>Модуль для интеграции с внешними данными и автоматизации DLE</p>
          <div v-if="selectedDle" class="dle-info">
            <span class="dle-name">{{ selectedDle.name }} ({{ selectedDle.symbol }})</span>
            <span class="dle-address">{{ selectedDle.dleAddress }}</span>
          </div>
        </div>
        <button class="close-btn" @click="router.push(`/management/modules?address=${route.query.address}`)">×</button>
      </div>

      <!-- Описание модуля -->
      <div class="module-description">
        <div class="description-card">
          <h3>📋 Описание OracleModule</h3>
          <div class="description-content">
            <p><strong>OracleModule</strong> - это модуль для интеграции DLE с внешними источниками данных и автоматизации процессов на основе реальных событий.</p>
            
            <h4>🔧 Основная функциональность:</h4>
            <ul>
              <li><strong>Интеграция с IoT:</strong> Получение данных от датчиков, производственных линий, оборудования</li>
              <li><strong>API интеграция:</strong> Подключение к внешним системам, ERP, CRM, аналитическим платформам</li>
              <li><strong>Автоматические триггеры:</strong> Создание предложений на основе внешних событий</li>
              <li><strong>Валидация данных:</strong> Проверка достоверности полученной информации</li>
              <li><strong>Множественные оракулы:</strong> Подтверждение данных от нескольких источников</li>
            </ul>

            <h4>🏭 Примеры применения:</h4>
            <ul>
              <li><strong>Производственные токены:</strong> Автоматический выпуск токенов за завершение партий продукции</li>
              <li><strong>Качественные бонусы:</strong> Токены за высокое качество продукции на основе данных датчиков</li>
              <li><strong>Экологические токены:</strong> Вознаграждения за снижение энергопотребления и выбросов</li>
              <li><strong>Инновационные токены:</strong> Токены за внедрение новых технологий и процессов</li>
              <li><strong>Рыночные корректировки:</strong> Автоматическая адаптация стратегии на основе рыночных данных</li>
            </ul>

            <h4>🔐 Безопасность и контроль:</h4>
            <ul>
              <li>Все оракулы должны быть авторизованы через governance</li>
              <li>Данные валидируются перед обработкой</li>
              <li>Критические решения требуют множественного подтверждения</li>
              <li>История всех оракульных данных сохраняется в блокчейне</li>
              <li>Возможность отключения оракулов в экстренных случаях</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Архитектура модуля -->
      <div class="module-architecture">
        <div class="architecture-card">
          <h3>🏗️ Архитектура OracleModule</h3>
          <div class="architecture-content">
            <div class="architecture-diagram">
              <div class="diagram-row">
                <div class="diagram-item external">
                  <h5>🌐 Внешние источники</h5>
                  <ul>
                    <li>IoT датчики</li>
                    <li>Производственные линии</li>
                    <li>ERP/CRM системы</li>
                    <li>Аналитические платформы</li>
                    <li>Рыночные данные</li>
                  </ul>
                </div>
                <div class="diagram-arrow">→</div>
                <div class="diagram-item oracle">
                  <h5>🔗 OracleModule</h5>
                  <ul>
                    <li>Получение данных</li>
                    <li>Валидация</li>
                    <li>Обработка</li>
                    <li>Создание предложений</li>
                  </ul>
                </div>
                <div class="diagram-arrow">→</div>
                <div class="diagram-item dle">
                  <h5>🏛️ DLE Governance</h5>
                  <ul>
                    <li>Предложения</li>
                    <li>Голосование</li>
                    <li>Исполнение</li>
                    <li>Выпуск токенов</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Типы оракулов -->
      <div class="oracle-types">
        <div class="types-card">
          <h3>📊 Типы оракулов</h3>
          <div class="types-grid">
            <div class="type-item">
              <h4>🏭 Производственные оракулы</h4>
              <p>Данные от производственных линий, оборудования, датчиков качества</p>
              <ul>
                <li>Завершение партий продукции</li>
                <li>Показатели качества</li>
                <li>Энергопотребление</li>
                <li>Время простоя</li>
              </ul>
            </div>
            
            <div class="type-item">
              <h4>📈 Рыночные оракулы</h4>
              <p>Рыночные данные, цены, спрос, конкуренция</p>
              <ul>
                <li>Цены на сырье</li>
                <li>Спрос на продукцию</li>
                <li>Конкурентные данные</li>
                <li>Экономические индикаторы</li>
              </ul>
            </div>
            
            <div class="type-item">
              <h4>🌱 Экологические оракулы</h4>
              <p>Данные об экологическом воздействии и устойчивости</p>
              <ul>
                <li>Выбросы CO2</li>
                <li>Потребление энергии</li>
                <li>Переработка отходов</li>
                <li>Использование возобновляемых ресурсов</li>
              </ul>
            </div>
            
            <div class="type-item">
              <h4>💼 Бизнес-оракулы</h4>
              <p>Бизнес-метрики, продажи, удовлетворенность клиентов</p>
              <ul>
                <li>Объемы продаж</li>
                <li>Удовлетворенность клиентов</li>
                <li>Эффективность процессов</li>
                <li>Финансовые показатели</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Примеры использования -->
      <div class="usage-examples">
        <div class="examples-card">
          <h3>💡 Примеры использования</h3>
          <div class="examples-content">
            <div class="example-item">
              <h4>🏭 Автоматические производственные токены</h4>
              <div class="example-code">
                <pre><code>// При завершении партии продукции
function onBatchCompleted(uint256 quantity, uint256 quality) {
    uint256 tokens = quantity * quality * 10;
    createMintProposal(tokens, "Production reward");
}</code></pre>
              </div>
            </div>
            
            <div class="example-item">
              <h4>🌱 Экологические бонусы</h4>
              <div class="example-code">
                <pre><code>// При снижении энергопотребления
function onEnergyReduction(uint256 savedEnergy) {
    uint256 tokens = savedEnergy * 5;
    createMintProposal(tokens, "Energy efficiency bonus");
}</code></pre>
              </div>
            </div>
            
            <div class="example-item">
              <h4>📈 Рыночная адаптация</h4>
              <div class="example-code">
                <pre><code>// При изменении рыночных условий
function onMarketChange(uint256 priceChange) {
    if (priceChange > 10) {
        createStrategyProposal("Increase production");
    }
}</code></pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Статус разработки -->
      <div class="development-status">
        <div class="status-card">
          <h3>🚧 Статус разработки</h3>
          <div class="status-content">
            <p><strong>OracleModule находится в стадии планирования.</strong></p>
            <p>Модуль будет включать:</p>
            <ul>
              <li>✅ Систему авторизации оракулов</li>
              <li>✅ Валидацию и обработку данных</li>
              <li>✅ Интеграцию с IoT и API</li>
              <li>✅ Автоматические триггеры</li>
              <li>✅ Множественное подтверждение данных</li>
              <li>✅ Аудит и мониторинг</li>
            </ul>
            <p><em>Модуль будет доступен в следующих обновлениях DLE.</em></p>
          </div>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BaseLayout from '../../../components/BaseLayout.vue';
import api from '../../../api/axios';

// Props
const props = defineProps({
  isAuthenticated: {
    type: Boolean,
    default: false
  },
  identities: {
    type: Array,
    default: () => []
  },
  tokenBalances: {
    type: Object,
    default: () => ({})
  },
  isLoadingTokens: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits(['auth-action-completed']);

// Router
const route = useRoute();
const router = useRouter();

// Состояние
const selectedDle = ref(null);
const isLoadingDle = ref(false);

// Получаем адрес DLE из URL
const dleAddress = computed(() => route.query.address);

// Загрузка данных DLE
const loadDleData = async () => {
  if (!dleAddress.value) return;
  
  try {
    isLoadingDle.value = true;
    const response = await api.post('/blockchain/read-dle-info', {
      dleAddress: dleAddress.value
    });
    
    if (response.data.success) {
      selectedDle.value = response.data.data;
    }
  } catch (error) {
    console.error('Ошибка загрузки данных DLE:', error);
  } finally {
    isLoadingDle.value = false;
  }
};

// Загружаем данные при монтировании
onMounted(() => {
  loadDleData();
});
</script>

<style scoped>
.module-deploy-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.header-content h1 {
  color: var(--color-primary);
  font-size: 2.5rem;
  margin: 0 0 10px 0;
}

.header-content p {
  color: var(--color-grey-dark);
  font-size: 1.1rem;
  margin: 0 0 15px 0;
}

.dle-info {
  display: flex;
  gap: 15px;
  align-items: center;
}

.dle-name {
  font-weight: 600;
  color: var(--color-primary);
}

.dle-address {
  font-family: monospace;
  color: var(--color-grey-dark);
  font-size: 0.9rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  color: var(--color-grey-dark);
  cursor: pointer;
  padding: 5px;
}

.close-btn:hover {
  color: var(--color-primary);
}

.module-description,
.module-architecture,
.oracle-types,
.usage-examples,
.development-status {
  margin-bottom: 30px;
}

.description-card,
.architecture-card,
.types-card,
.examples-card,
.status-card {
  background: #f8f9fa;
  padding: 25px;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
}

.description-card h3,
.architecture-card h3,
.types-card h3,
.examples-card h3,
.status-card h3 {
  color: var(--color-primary);
  margin: 0 0 20px 0;
}

.description-content h4 {
  color: var(--color-grey-dark);
  margin: 20px 0 10px 0;
}

.description-content ul {
  margin: 10px 0;
  padding-left: 20px;
}

.description-content li {
  margin: 5px 0;
  line-height: 1.5;
}

/* Архитектурная диаграмма */
.architecture-diagram {
  margin: 20px 0;
}

.diagram-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}

.diagram-item {
  flex: 1;
  padding: 20px;
  border-radius: var(--radius-sm);
  text-align: center;
  min-height: 150px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.diagram-item.external {
  background: #e3f2fd;
  border: 2px solid #2196f3;
}

.diagram-item.oracle {
  background: #f3e5f5;
  border: 2px solid #9c27b0;
}

.diagram-item.dle {
  background: #e8f5e8;
  border: 2px solid #4caf50;
}

.diagram-item h5 {
  margin: 0 0 15px 0;
  font-weight: 600;
}

.diagram-item ul {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.9rem;
}

.diagram-item li {
  margin: 5px 0;
}

.diagram-arrow {
  font-size: 2rem;
  color: var(--color-primary);
  font-weight: bold;
}

/* Типы оракулов */
.types-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.type-item {
  background: white;
  padding: 20px;
  border-radius: var(--radius-sm);
  border: 1px solid #e9ecef;
}

.type-item h4 {
  color: var(--color-primary);
  margin: 0 0 10px 0;
}

.type-item p {
  color: var(--color-grey-dark);
  margin: 0 0 15px 0;
  font-size: 0.9rem;
}

.type-item ul {
  margin: 0;
  padding-left: 20px;
  font-size: 0.9rem;
}

.type-item li {
  margin: 5px 0;
  color: var(--color-grey-dark);
}

/* Примеры использования */
.examples-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.example-item {
  background: white;
  padding: 20px;
  border-radius: var(--radius-sm);
  border: 1px solid #e9ecef;
}

.example-item h4 {
  color: var(--color-primary);
  margin: 0 0 15px 0;
}

.example-code {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-sm);
  padding: 15px;
  overflow-x: auto;
}

.example-code pre {
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  color: #333;
}

.example-code code {
  background: none;
  padding: 0;
}

/* Статус разработки */
.status-content {
  background: white;
  padding: 20px;
  border-radius: var(--radius-sm);
  border: 1px solid #e9ecef;
}

.status-content p {
  margin: 0 0 15px 0;
  line-height: 1.6;
}

.status-content ul {
  margin: 15px 0;
  padding-left: 20px;
}

.status-content li {
  margin: 5px 0;
  color: var(--color-grey-dark);
}

.status-content em {
  color: var(--color-primary);
  font-style: italic;
}

@media (max-width: 768px) {
  .diagram-row {
    flex-direction: column;
    gap: 15px;
  }
  
  .diagram-arrow {
    transform: rotate(90deg);
  }
  
  .types-grid {
    grid-template-columns: 1fr;
  }
  
  .dle-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
}
</style>
