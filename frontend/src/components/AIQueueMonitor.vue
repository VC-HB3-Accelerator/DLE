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
  <div class="ai-queue-monitor">
    <div class="monitor-header">
      <h3>Мониторинг AI Очереди</h3>
      <div class="refresh-controls">
        <button @click="refreshStats" :disabled="loading" class="btn-refresh">
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i>
          Обновить
        </button>
        <label class="auto-refresh">
          <input type="checkbox" v-model="autoRefresh" />
          Автообновление
        </label>
      </div>
    </div>

    <div class="stats-grid">
      <!-- Основная статистика -->
      <div class="stat-card">
        <div class="stat-title">Статус очереди</div>
        <div class="stat-value" :class="queueStatusClass">
          {{ queueStatus }}
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-title">Задач в очереди</div>
        <div class="stat-value">{{ stats.currentQueueSize }}</div>
      </div>

      <div class="stat-card">
        <div class="stat-title">Выполняется</div>
        <div class="stat-value">{{ stats.runningTasks }}</div>
      </div>

      <div class="stat-card">
        <div class="stat-title">Успешность</div>
        <div class="stat-value" :class="successRateClass">
          {{ successRate }}%
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-title">Среднее время</div>
        <div class="stat-value">{{ averageTime }}с</div>
      </div>

      <div class="stat-card">
        <div class="stat-title">Всего обработано</div>
        <div class="stat-value">{{ stats.totalProcessed }}</div>
      </div>
    </div>

    <!-- Детальная информация -->
    <div class="detailed-stats">
      <h4>Детальная статистика</h4>
      <div class="stats-table">
        <div class="stat-row">
          <span class="stat-label">Всего задач:</span>
          <span class="stat-value">{{ stats.totalProcessed }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Успешных:</span>
          <span class="stat-value success">{{ stats.totalProcessed - stats.totalFailed }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Ошибок:</span>
          <span class="stat-value error">{{ stats.totalFailed }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Среднее время обработки:</span>
          <span class="stat-value">{{ Math.round(stats.averageProcessingTime) }}мс</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Последняя обработка:</span>
          <span class="stat-value">{{ lastProcessedTime }}</span>
        </div>
      </div>
    </div>

    <!-- Управление очередью (только для админов) -->
    <div v-if="isAdmin" class="queue-controls">
      <h4>Управление очередью</h4>
      <div class="control-buttons">
        <button @click="controlQueue('pause')" class="btn-control btn-pause">
          <i class="fas fa-pause"></i>
          Пауза
        </button>
        <button @click="controlQueue('resume')" class="btn-control btn-resume">
          <i class="fas fa-play"></i>
          Возобновить
        </button>
        <button @click="controlQueue('clear')" class="btn-control btn-clear">
          <i class="fas fa-trash"></i>
          Очистить
        </button>
      </div>
    </div>

    <!-- График производительности -->
    <div class="performance-chart">
      <h4>Производительность</h4>
      <div class="chart-container">
        <canvas ref="performanceChart"></canvas>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import axios from 'axios'
import Chart from 'chart.js/auto'

export default {
  name: 'AIQueueMonitor',
  props: {
    isAdmin: {
      type: Boolean,
      default: false
    }
  },
  setup() {
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
      if (!stats.value.isInitialized) return 'Не инициализирована'
      if (stats.value.currentQueueSize === 0 && stats.value.runningTasks === 0) return 'Пуста'
      if (stats.value.runningTasks > 0) return 'Работает'
      return 'Ожидает'
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
      if (!stats.value.lastProcessedAt) return 'Нет данных'
      return new Date(stats.value.lastProcessedAt).toLocaleString('ru-RU')
    })

    // Методы
    const fetchStats = async () => {
      try {
        loading.value = true
        const response = await axios.get('/api/ai-queue/stats')
        if (response.data.success) {
          stats.value = response.data.data
        }
      } catch (error) {
        console.error('Error fetching queue stats:', error)
      } finally {
        loading.value = false
      }
    }

    const refreshStats = () => {
      fetchStats()
    }

    const controlQueue = async (action) => {
      try {
        const response = await axios.post('/api/ai-queue/control', { action })
        if (response.data.success) {
          await fetchStats()
        }
      } catch (error) {
        console.error(`Error controlling queue (${action}):`, error)
      }
    }

    const initChart = () => {
      const ctx = performanceChart.value.getContext('2d')
      chartInstance.value = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Время обработки (мс)',
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

.btn-refresh {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-refresh:hover {
  background: #0056b3;
}

.btn-refresh:disabled {
  background: #6c757d;
  cursor: not-allowed;
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
  color: #28a745;
}

.status-waiting {
  color: #ffc107;
}

.status-idle {
  color: #6c757d;
}

.status-error {
  color: #dc3545;
}

.success {
  color: #28a745;
}

.warning {
  color: #ffc107;
}

.error {
  color: #dc3545;
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

.btn-control {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.btn-pause {
  background: #ffc107;
  color: #333;
}

.btn-pause:hover {
  background: #e0a800;
}

.btn-resume {
  background: #28a745;
  color: white;
}

.btn-resume:hover {
  background: #218838;
}

.btn-clear {
  background: #dc3545;
  color: white;
}

.btn-clear:hover {
  background: #c82333;
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
</style> 