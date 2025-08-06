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
    <div class="analytics-container">
      <!-- Заголовок -->
      <div class="page-header">
        <div class="header-content">
          <h1>Аналитика</h1>
          <p>Графики, статистика и отчеты DLE</p>
        </div>
        <button class="close-btn" @click="router.push('/management')">×</button>
      </div>

      <!-- Ключевые метрики -->
      <div class="metrics-section">
        <h2>Ключевые метрики</h2>
        <div class="metrics-grid">
          <div class="metric-card">
            <h3>Общая стоимость</h3>
            <p class="metric-value">${{ totalValue.toLocaleString() }}</p>
            <p class="metric-change positive">+{{ valueChange }}% (30д)</p>
          </div>
          <div class="metric-card">
            <h3>Активные участники</h3>
            <p class="metric-value">{{ activeParticipants }}</p>
            <p class="metric-change positive">+{{ participantsChange }} (30д)</p>
          </div>
          <div class="metric-card">
            <h3>Предложения</h3>
            <p class="metric-value">{{ totalProposals }}</p>
            <p class="metric-change positive">+{{ proposalsChange }} (30д)</p>
          </div>
          <div class="metric-card">
            <h3>Доходность</h3>
            <p class="metric-value">{{ yieldRate }}%</p>
            <p class="metric-change positive">+{{ yieldChange }}% (30д)</p>
          </div>
        </div>
      </div>

      <!-- Графики -->
      <div class="charts-section">
        <h2>Графики</h2>
        <div class="charts-grid">
          <!-- График стоимости токенов -->
          <div class="chart-card">
            <h3>Стоимость токенов</h3>
            <div class="chart-placeholder">
              <div class="chart-line">
                <div class="chart-point" style="left: 10%; top: 80%"></div>
                <div class="chart-point" style="left: 25%; top: 60%"></div>
                <div class="chart-point" style="left: 40%; top: 40%"></div>
                <div class="chart-point" style="left: 55%; top: 30%"></div>
                <div class="chart-point" style="left: 70%; top: 20%"></div>
                <div class="chart-point" style="left: 85%; top: 10%"></div>
                <div class="chart-point" style="left: 100%; top: 5%"></div>
              </div>
            </div>
            <div class="chart-legend">
              <span class="legend-item">
                <span class="legend-color" style="background: var(--color-primary)"></span>
                Стоимость токена
              </span>
            </div>
          </div>

          <!-- График активности -->
          <div class="chart-card">
            <h3>Активность участников</h3>
            <div class="activity-chart">
              <div class="activity-bar" style="height: 60%">
                <span class="bar-label">Пн</span>
              </div>
              <div class="activity-bar" style="height: 80%">
                <span class="bar-label">Вт</span>
              </div>
              <div class="activity-bar" style="height: 45%">
                <span class="bar-label">Ср</span>
              </div>
              <div class="activity-bar" style="height: 90%">
                <span class="bar-label">Чт</span>
              </div>
              <div class="activity-bar" style="height: 75%">
                <span class="bar-label">Пт</span>
              </div>
              <div class="activity-bar" style="height: 55%">
                <span class="bar-label">Сб</span>
              </div>
              <div class="activity-bar" style="height: 40%">
                <span class="bar-label">Вс</span>
              </div>
            </div>
            <div class="chart-legend">
              <span class="legend-item">
                <span class="legend-color" style="background: var(--color-secondary)"></span>
                Количество операций
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Статистика -->
      <div class="statistics-section">
        <h2>Статистика</h2>
        <div class="stats-grid">
          <div class="stats-card">
            <h3>Распределение токенов</h3>
            <div class="distribution-chart">
              <div class="pie-segment" style="--percentage: 40; --color: #007bff">
                <span class="segment-label">Крупные держатели</span>
                <span class="segment-value">40%</span>
              </div>
              <div class="pie-segment" style="--percentage: 30; --color: #28a745">
                <span class="segment-label">Средние держатели</span>
                <span class="segment-value">30%</span>
              </div>
              <div class="pie-segment" style="--percentage: 20; --color: #ffc107">
                <span class="segment-label">Малые держатели</span>
                <span class="segment-value">20%</span>
              </div>
              <div class="pie-segment" style="--percentage: 10; --color: #dc3545">
                <span class="segment-label">Резерв</span>
                <span class="segment-value">10%</span>
              </div>
            </div>
          </div>

          <div class="stats-card">
            <h3>Топ участников</h3>
            <div class="top-participants">
              <div 
                v-for="participant in topParticipants" 
                :key="participant.address"
                class="participant-item"
              >
                <div class="participant-info">
                  <span class="participant-rank">#{{ participant.rank }}</span>
                  <span class="participant-address">{{ formatAddress(participant.address) }}</span>
                </div>
                <div class="participant-stats">
                  <span class="participant-balance">{{ participant.balance }} токенов</span>
                  <span class="participant-percentage">{{ participant.percentage }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Отчеты -->
      <div class="reports-section">
        <h2>Отчеты</h2>
        <div class="reports-grid">
          <div class="report-card">
            <h3>Ежемесячный отчет</h3>
            <p>Подробный анализ деятельности DLE за последний месяц</p>
            <div class="report-actions">
              <button class="btn-secondary">Просмотреть</button>
              <button class="btn-secondary">Скачать PDF</button>
            </div>
          </div>

          <div class="report-card">
            <h3>Финансовый отчет</h3>
            <p>Анализ финансового состояния и доходности</p>
            <div class="report-actions">
              <button class="btn-secondary">Просмотреть</button>
              <button class="btn-secondary">Скачать PDF</button>
            </div>
          </div>

          <div class="report-card">
            <h3>Отчет по предложениям</h3>
            <p>Статистика и анализ предложений за период</p>
            <div class="report-actions">
              <button class="btn-secondary">Просмотреть</button>
              <button class="btn-secondary">Скачать PDF</button>
            </div>
          </div>

          <div class="report-card">
            <h3>Отчет по активности</h3>
            <p>Анализ активности участников и операций</p>
            <div class="report-actions">
              <button class="btn-secondary">Просмотреть</button>
              <button class="btn-secondary">Скачать PDF</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, defineProps, defineEmits } from 'vue';
import { useRouter } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';

// Определяем props
const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

// Определяем emits
const emit = defineEmits(['auth-action-completed']);

const router = useRouter();

// Ключевые метрики
const totalValue = ref(2500000);
const valueChange = ref(12.5);
const activeParticipants = ref(156);
const participantsChange = ref(23);
const totalProposals = ref(45);
const proposalsChange = ref(8);
const yieldRate = ref(8.7);
const yieldChange = ref(1.2);

// Топ участников (загружаются из блокчейна)
const topParticipants = ref([]);

// Методы
const formatAddress = (address) => {
  if (!address) return '';
  return address.substring(0, 6) + '...' + address.substring(address.length - 4);
};
</script>

<style scoped>
.analytics-container {
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
  align-items: flex-start;
  margin-bottom: 40px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.header-content {
  flex-grow: 1;
}

.page-header h1 {
  color: var(--color-primary);
  font-size: 2.5rem;
  margin: 0 0 10px 0;
}

.page-header p {
  color: var(--color-grey-dark);
  font-size: 1.1rem;
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

/* Секции */
.metrics-section,
.charts-section,
.statistics-section,
.reports-section {
  margin-bottom: 40px;
}

.metrics-section h2,
.charts-section h2,
.statistics-section h2,
.reports-section h2 {
  color: var(--color-primary);
  margin-bottom: 20px;
  font-size: 1.8rem;
}

/* Ключевые метрики */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.metric-card {
  background: #f8f9fa;
  padding: 25px;
  border-radius: var(--radius-lg);
  border-left: 4px solid var(--color-primary);
  text-align: center;
}

.metric-card h3 {
  color: var(--color-primary);
  margin-bottom: 15px;
  font-size: 1rem;
  text-transform: uppercase;
  font-weight: 600;
}

.metric-value {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 10px 0;
  color: var(--color-primary);
}

.metric-change {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.metric-change.positive {
  color: #28a745;
}

.metric-change.negative {
  color: #dc3545;
}

/* Графики */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 30px;
}

.chart-card {
  background: white;
  padding: 25px;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
}

.chart-card h3 {
  color: var(--color-primary);
  margin-bottom: 20px;
  font-size: 1.3rem;
}

/* График стоимости токенов */
.chart-placeholder {
  height: 200px;
  background: #f8f9fa;
  border-radius: var(--radius-sm);
  position: relative;
  margin-bottom: 15px;
  border: 1px solid #e9ecef;
}

.chart-line {
  position: relative;
  height: 100%;
  width: 100%;
}

.chart-point {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--color-primary);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.chart-point::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 12px;
  height: 12px;
  background: rgba(0, 123, 255, 0.2);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

/* График активности */
.activity-chart {
  height: 200px;
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 15px;
}

.activity-bar {
  background: var(--color-secondary);
  border-radius: 4px 4px 0 0;
  min-width: 30px;
  position: relative;
  transition: all 0.3s ease;
}

.activity-bar:hover {
  background: var(--color-secondary-dark);
}

.bar-label {
  position: absolute;
  bottom: -25px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.8rem;
  color: var(--color-grey-dark);
}

/* Легенда графиков */
.chart-legend {
  display: flex;
  justify-content: center;
  gap: 20px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--color-grey-dark);
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

/* Статистика */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 30px;
}

.stats-card {
  background: white;
  padding: 25px;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
}

.stats-card h3 {
  color: var(--color-primary);
  margin-bottom: 20px;
  font-size: 1.3rem;
}

/* Круговая диаграмма */
.distribution-chart {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.pie-segment {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: #f8f9fa;
  border-radius: var(--radius-sm);
  border-left: 4px solid var(--color);
}

.segment-label {
  font-weight: 600;
  color: var(--color-grey-dark);
}

.segment-value {
  font-weight: 700;
  color: var(--color);
}

/* Топ участников */
.top-participants {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.participant-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: var(--radius-sm);
  transition: all 0.3s ease;
}

.participant-item:hover {
  background: #e9ecef;
}

.participant-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.participant-rank {
  background: var(--color-primary);
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 600;
}

.participant-address {
  font-family: monospace;
  font-size: 0.9rem;
  color: var(--color-grey-dark);
}

.participant-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
}

.participant-balance {
  font-weight: 600;
  color: var(--color-primary);
  font-size: 0.9rem;
}

.participant-percentage {
  font-size: 0.8rem;
  color: var(--color-grey-dark);
}

/* Отчеты */
.reports-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.report-card {
  background: white;
  padding: 25px;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.report-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.report-card h3 {
  color: var(--color-primary);
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.report-card p {
  color: var(--color-grey-dark);
  margin-bottom: 20px;
  line-height: 1.5;
}

.report-actions {
  display: flex;
  gap: 10px;
}

/* Кнопки */
.btn-secondary {
  background: var(--color-secondary);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn-secondary:hover {
  background: var(--color-secondary-dark);
}

/* Адаптивность */
@media (max-width: 768px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .reports-grid {
    grid-template-columns: 1fr;
  }
  
  .report-actions {
    flex-direction: column;
  }
  
  .participant-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .participant-stats {
    align-items: flex-start;
  }
  
  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style> 