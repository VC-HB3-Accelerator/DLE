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
  <div class="ai-queue-monitor">
    <div class="monitor-header">
      <h3>{{ t('ai.queue.title') }}</h3>
      <div class="refresh-controls">
        <button @click="refreshStats" :disabled="loading" class="btn btn-primary btn-sm">
          <UiGlyph name="sync" :spin="loading" />
          {{ t('ai.queue.refresh') }}
        </button>
        <label class="auto-refresh">
          <input type="checkbox" v-model="autoRefresh" />
          {{ t('ai.queue.autoRefresh') }}
        </label>
      </div>
    </div>

    <div class="stats-grid">
      <!-- Основная статистика -->
      <div class="stat-card">
        <div class="stat-title">{{ t('ai.queue.queueStatus') }}</div>
        <div class="stat-value" :class="queueStatusClass">
          {{ queueStatus }}
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-title">{{ t('ai.queue.tasksInQueue') }}</div>
        <div class="stat-value">{{ stats.currentQueueSize }}</div>
      </div>

      <div class="stat-card">
        <div class="stat-title">{{ t('ai.queue.running') }}</div>
        <div class="stat-value">{{ stats.runningTasks }}</div>
      </div>

      <div class="stat-card">
        <div class="stat-title">{{ t('ai.queue.successRate') }}</div>
        <div class="stat-value" :class="successRateClass">
          {{ successRate }}%
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-title">{{ t('ai.queue.avgTime') }}</div>
        <div class="stat-value">{{ t('ai.queue.avgTimeSec', { time: averageTime }) }}</div>
      </div>

      <div class="stat-card">
        <div class="stat-title">{{ t('ai.queue.totalProcessed') }}</div>
        <div class="stat-value">{{ stats.totalProcessed }}</div>
      </div>
    </div>

    <!-- Детальная информация -->
    <div class="detailed-stats">
      <h4>{{ t('ai.queue.detailedStats') }}</h4>
      <div class="stats-table">
        <div class="stat-row">
          <span class="stat-label">{{ t('ai.queue.totalTasks') }}</span>
          <span class="stat-value">{{ stats.totalProcessed }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">{{ t('ai.queue.successful') }}</span>
          <span class="stat-value success">{{ stats.totalProcessed - stats.totalFailed }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">{{ t('ai.queue.errors') }}</span>
          <span class="stat-value error">{{ stats.totalFailed }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">{{ t('ai.queue.avgProcessingTime') }}</span>
          <span class="stat-value">{{ t('ai.queue.avgProcessingMs', { time: Math.round(stats.averageProcessingTime) }) }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">{{ t('ai.queue.lastProcessed') }}</span>
          <span class="stat-value">{{ lastProcessedTime }}</span>
        </div>
      </div>
    </div>

    <!-- Управление очередью (только для админов) -->
    <div v-if="canManageSettings" class="queue-controls">
      <h4>{{ t('ai.queue.queueControl') }}</h4>
      <div class="control-buttons">
        <button @click="controlQueue('pause')" class="btn btn-sm btn-pause">
          <UiGlyph name="pause" />
          {{ t('ai.queue.pause') }}
        </button>
        <button @click="controlQueue('resume')" class="btn btn-success btn-sm">
          <UiGlyph name="play" />
          {{ t('ai.queue.resume') }}
        </button>
        <button @click="controlQueue('clear')" class="btn btn-danger btn-sm">
          <UiGlyph name="trash" />
          {{ t('ai.queue.clear') }}
        </button>
      </div>
    </div>

    <!-- График производительности -->
    <div class="performance-chart">
      <h4>{{ t('ai.queue.performance') }}</h4>
      <div class="chart-container">
        <canvas ref="performanceChart"></canvas>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import Chart from 'chart.js/auto'
import { usePermissions } from '@/composables/usePermissions'
import UiGlyph from './UiGlyph.vue'

export default {
  name: 'AIQueueMonitor',
  setup() {
    const { t } = useI18n();
    const { canManageSettings } = usePermissions();
    const stats = ref({
      totalProcessed: 0,
      totalFailed: 0,
      averageProcessingTime: 0,
      currentQueueSize: 0,
      runningTasks: 0,
      lastProcessedAt: null,
      isInitialized: false
    })
    
    const loading = ref(false)
    const autoRefresh = ref(true)
    const refreshInterval = ref(null)
    const performanceChart = ref(null)
    const chartInstance = ref(null)

    // Вычисляемые свойства
    const queueStatus = computed(() => {
      if (!stats.value.isInitialized) return t('ai.queue.notInitialized')
      if (stats.value.currentQueueSize === 0 && stats.value.runningTasks === 0) return t('ai.queue.empty')
      if (stats.value.runningTasks > 0) return t('ai.queue.working')
      return t('ai.queue.waiting')
    })

    const queueStatusClass = computed(() => {
      if (!stats.value.isInitialized) return 'status-error'
      if (stats.value.currentQueueSize === 0 && stats.value.runningTasks === 0) return 'status-idle'
      if (stats.value.runningTasks > 0) return 'status-active'
      return 'status-waiting'
    })

    const successRate = computed(() => {
      if (stats.value.totalProcessed === 0) return 0
      return Math.round(((stats.value.totalProcessed - stats.value.totalFailed) / stats.value.totalProcessed) * 100)
    })

    const successRateClass = computed(() => {
      if (successRate.value >= 95) return 'success'
      if (successRate.value >= 80) return 'warning'
      return 'error'
    })

    const averageTime = computed(() => {
      return Math.round(stats.value.averageProcessingTime / 1000)
    })

    const lastProcessedTime = computed(() => {
      if (!stats.value.lastProcessedAt) return t('ai.queue.noData')
      return new Date(stats.value.lastProcessedAt).toLocaleString('ru-RU')
    })

    // Методы
    const fetchStats = async () => {
      try {
        loading.value = true
        const response = await axios.get('/ai-queue/stats')
        if (response.data.success) {
          stats.value = response.data.data
        }
      } catch (error) {
        // console.error('Error fetching queue stats:', error)
      } finally {
        loading.value = false
      }
    }

    const refreshStats = () => {
      fetchStats()
    }

    const controlQueue = async (action) => {
      try {
        const response = await axios.post('/ai-queue/control', { action })
        if (response.data.success) {
          await fetchStats()
        }
      } catch (error) {
        // console.error(`Error controlling queue (${action}):`, error)
      }
    }

    const initChart = () => {
      const ctx = performanceChart.value.getContext('2d')
      chartInstance.value = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: t('ai.queue.processingTimeMs'),
            data: [],
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            tension: 0.1
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      })
    }

    const updateChart = () => {
      if (chartInstance.value) {
        const now = new Date().toLocaleTimeString('ru-RU')
        chartInstance.value.data.labels.push(now)
        chartInstance.value.data.datasets[0].data.push(stats.value.averageProcessingTime)

        // Ограничиваем количество точек на графике
        if (chartInstance.value.data.labels.length > 20) {
          chartInstance.value.data.labels.shift()
          chartInstance.value.data.datasets[0].data.shift()
        }

        chartInstance.value.update()
      }
    }

    // Наблюдатели
    watch(autoRefresh, (newValue) => {
      if (newValue) {
        refreshInterval.value = setInterval(fetchStats, 5000)
      } else {
        if (refreshInterval.value) {
          clearInterval(refreshInterval.value)
          refreshInterval.value = null
        }
      }
    })

    // Жизненный цикл
    onMounted(() => {
      fetchStats()
      initChart()
      
      if (autoRefresh.value) {
        refreshInterval.value = setInterval(fetchStats, 5000)
      }
    })

    onUnmounted(() => {
      if (refreshInterval.value) {
        clearInterval(refreshInterval.value)
      }
      if (chartInstance.value) {
        chartInstance.value.destroy()
      }
    })

    return {
      t,
      canManageSettings,
      stats,
      loading,
      autoRefresh,
      performanceChart,
      queueStatus,
      queueStatusClass,
      successRate,
      successRateClass,
      averageTime,
      lastProcessedTime,
      refreshStats,
      controlQueue
    }
  }
}
</script>

<style scoped>
.ai-queue-monitor {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  margin: 20px 0;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.monitor-header h3 {
  margin: 0;
  color: #333;
}

.refresh-controls {
  display: flex;
  align-items: center;
  gap: 15px;
}

.auto-refresh {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: center;
}

.stat-title {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.status-active {
  color: var(--color-success);
}

.status-waiting {
  color: var(--color-warning);
}

.status-idle {
  color: #6c757d;
}

.status-error {
  color: var(--color-danger);
}

.success {
  color: var(--color-success);
}

.warning {
  color: var(--color-warning);
}

.error {
  color: var(--color-danger);
}

.detailed-stats {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 30px;
}

.detailed-stats h4 {
  margin: 0 0 15px 0;
  color: #333;
}

.stats-table {
  display: grid;
  gap: 10px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.stat-row:last-child {
  border-bottom: none;
}

.stat-label {
  color: #666;
}

.queue-controls {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 30px;
}

.queue-controls h4 {
  margin: 0 0 15px 0;
  color: #333;
}

.control-buttons {
  display: flex;
  gap: 10px;
}

.btn-pause {
  background: var(--color-warning);
  border-color: var(--color-warning);
  color: var(--color-dark);
}

.btn-pause:hover:not(:disabled):not(.is-disabled) {
  background: color-mix(in srgb, var(--color-warning) 85%, black);
  border-color: color-mix(in srgb, var(--color-warning) 85%, black);
}

.performance-chart {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.performance-chart h4 {
  margin: 0 0 15px 0;
  color: #333;
}

.chart-container {
  height: 300px;
  position: relative;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .monitor-header {
    flex-direction: column;
    gap: 15px;
    align-items: flex-start;
  }
  
  .control-buttons {
    flex-direction: column;
  }
}


/* TZ package G/SC stack */
@media (max-width: 768px) {
  [class*="grid"], .form-row, .management-blocks {
    grid-template-columns: 1fr !important;
  }
  .row, .actions, .toolbar, .filters, .form-actions {
    flex-wrap: wrap;
  }
}
</style> 