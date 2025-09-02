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
  <div class="system-monitoring">
    <h3>🔍 Мониторинг системы</h3>
    
    <div class="monitoring-controls">
      <button @click="refreshStatus" :disabled="loading" class="refresh-btn">
        {{ loading ? '🔄 Обновление...' : '🔄 Обновить статус' }}
      </button>
      <span class="last-update">
        Последнее обновление: {{ lastUpdate }}
      </span>
    </div>

    <div class="status-grid">
      <div 
        v-for="service in serviceList" 
        :key="service.key"
        :class="['status-card', getStatusClass(service.status)]"
      >
        <h4>
          <span :class="['status-indicator', getStatusClass(service.status)]"></span>
          {{ service.label }}
        </h4>
        <div class="details">
          <div class="status-text">
            Статус: {{ getStatusText(service.status) }}
          </div>
          <div class="service-details" v-if="service.details">
            {{ service.details }}
          </div>
        </div>
      </div>
    </div>

    <div class="rag-test-section">
      <h4>🧠 Тест RAG-функциональности</h4>
      

      
      <!-- Выбор RAG-таблицы -->
      <div class="rag-table-selection">
        <label>Выберите RAG-таблицу:</label>
        <div class="rag-table-controls">
          <select v-model="selectedRagTable" class="rag-table-select">
            <option v-if="availableRagTables.length === 0" value="" disabled>
              Нет доступных RAG-таблиц
            </option>
            <option v-for="table in availableRagTables" :key="table.id" :value="table.id">
              {{ table.name }} (ID: {{ table.id }})
            </option>
          </select>
          <button @click="loadRagTables" class="refresh-tables-btn" title="Обновить список таблиц">
            🔄
          </button>
        </div>
        <div v-if="availableRagTables.length === 0" class="no-rag-tables">
          <p>Для тестирования RAG необходимо создать таблицу и установить её как источник для ИИ-ассистента.</p>
          <p>Перейдите в <router-link to="/tables">Таблицы</router-link> и создайте таблицу с вопросами и ответами.</p>
        </div>
      </div>
      
      <div class="rag-test-controls">
        <input 
          v-model="ragQuestion" 
          placeholder="Введите вопрос" 
          class="rag-input"
        />
        <button @click="testRAG" :disabled="ragTesting || !selectedRagTable" class="rag-test-btn">
          {{ ragTesting ? 'Тестирование...' : 'Тестировать RAG' }}
        </button>
      </div>
      
      <!-- Прогресс-бар и статус -->
      <div v-if="ragTesting" class="rag-progress-section">
        <div class="rag-status">{{ ragStatus }}</div>
        <div class="rag-progress-bar">
          <div class="rag-progress-fill" :style="{ width: ragProgress + '%' }"></div>
        </div>
        <div class="rag-progress-text">{{ Math.round(ragProgress) }}%</div>
      </div>
      
      <div v-if="ragResult" :class="['rag-result', getRagResultClass()]">
        <div v-if="ragResult.success">
          <strong>✅ Успешно!</strong><br>
          Таблица: {{ availableRagTables.find(t => t.id === selectedRagTable)?.name || 'Неизвестно' }}<br>
          Вопрос: "{{ ragQuestion }}"<br>
          Ответ: "{{ ragResult.answer || 'Нет ответа' }}"<br>
          Score: {{ ragResult.score || 'N/A' }}

        </div>
        <div v-else>
          <strong>❌ Ошибка!</strong><br>
          {{ ragResult.error }}

        </div>
      </div>
      

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import axios from 'axios';

const loading = ref(false);
const lastUpdate = ref('никогда');
const ragQuestion = ref('Как работает ИИ-ассистент?');
const ragTesting = ref(false);
const ragResult = ref(null);
const monitoringData = ref(null);
const availableRagTables = ref([]);
const selectedRagTable = ref(null);
const ragProgress = ref(0);
const ragStatus = ref('');

const serviceLabels = {
  backend: 'Backend',
  vectorSearch: 'Vector Search',
  ollama: 'Ollama',
  postgres: 'PostgreSQL',
};

const serviceList = computed(() => {
  if (!monitoringData.value) return [];
  return Object.entries(monitoringData.value.services).map(([key, val]) => ({
    key,
    label: serviceLabels[key] || key,
    status: val.status,
    details: val.status === 'ok'
      ? (key === 'ollama' && val.models !== undefined ? `Доступно моделей: ${val.models}` : 'Работает')
      : val.error || 'Ошибка',
  }));
});

const getStatusClass = (status) => {
  switch (status) {
    case 'ok':
    case 'healthy': return 'healthy';
    case 'warning': return 'warning';
    case 'error': return 'error';
    default: return 'unknown';
  }
};

const getStatusText = (status) => {
  switch (status) {
    case 'ok':
    case 'healthy': return 'Работает';
    case 'warning': return 'Предупреждение';
    case 'error': return 'Ошибка';
    default: return 'Неизвестно';
  }
};

const getRagResultClass = () => {
  if (!ragResult.value) return '';
  return ragResult.value.success ? 'success' : 'error';
};

const loadRagTables = async () => {
  try {
    const response = await axios.get('/tables');
    const tables = response.data || [];
    
    // Фильтруем только таблицы, которые являются источниками для RAG
    const ragTables = tables.filter(table => table.is_rag_source_id === 1);
    
    availableRagTables.value = ragTables;
    
    // Если есть доступные таблицы, выбираем первую по умолчанию
    if (availableRagTables.value.length > 0 && !selectedRagTable.value) {
      selectedRagTable.value = availableRagTables.value[0].id;
    }
  } catch (e) {
    availableRagTables.value = [];
  }
};

const refreshStatus = async () => {
  loading.value = true;
  try {
    const response = await axios.get('/monitoring');
    monitoringData.value = response.data;
    lastUpdate.value = new Date().toLocaleString('ru-RU');
  } catch (e) {
    monitoringData.value = null;
    lastUpdate.value = 'Ошибка';
  }
  loading.value = false;
};

const testRAG = async () => {
  if (!ragQuestion.value.trim()) return;
  
  if (!selectedRagTable.value) {
    ragResult.value = {
      success: false,
      error: 'Не выбрана RAG-таблица для тестирования'
    };
    return;
  }
  
  ragTesting.value = true;
  ragResult.value = null;
  ragProgress.value = 0;
  ragStatus.value = '🔍 Ищем ответ в базе знаний...';
  
  // Симуляция прогресса для лучшего UX
  const progressInterval = setInterval(() => {
    if (ragProgress.value < 90) {
      ragProgress.value += Math.random() * 15;
    }
  }, 1000);
  
  try {
    ragStatus.value = '🤖 Генерируем ответ с помощью ИИ...';
    
    const response = await axios.post('/rag/answer', {
      tableId: selectedRagTable.value,
      question: ragQuestion.value,
      product: null
    });
    
    clearInterval(progressInterval);
    ragProgress.value = 100;
    ragStatus.value = '✅ Готово!';
    
    ragResult.value = {
      success: true,
      answer: response.data.answer,
      score: response.data.score,
      llmResponse: response.data.llmResponse
    };
    
    // Обновляем список таблиц после успешного тестирования
    await loadRagTables();
  } catch (error) {
    clearInterval(progressInterval);
    ragProgress.value = 0;
    ragStatus.value = '';
    
    ragResult.value = {
      success: false,
      error: error.response?.data?.error || error.message || 'Неизвестная ошибка'
    };
  }
  
  ragTesting.value = false;
};

onMounted(() => {
  refreshStatus();
  loadRagTables();
  
  // Подписываемся на обновление плейсхолдеров (когда создаются новые таблицы)
  window.addEventListener('placeholders-updated', loadRagTables);
});

onUnmounted(() => {
  // Отписываемся от события
  window.removeEventListener('placeholders-updated', loadRagTables);
});
</script>

<style scoped>
.system-monitoring {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  margin-top: 20px;
  border: 1px solid #e9ecef;
}

.system-monitoring h3 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 1.2rem;
}

.monitoring-controls {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.refresh-btn {
  background: #2196F3;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #1976D2;
}

.refresh-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.last-update {
  color: #666;
  font-size: 14px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.status-card {
  background: white;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border-left: 4px solid #ddd;
}

.status-card.healthy {
  border-left-color: #4CAF50;
}

.status-card.warning {
  border-left-color: #FF9800;
}

.status-card.error {
  border-left-color: #f44336;
}

.status-card.unknown {
  border-left-color: #9e9e9e;
}

.status-card h4 {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 1rem;
  display: flex;
  align-items: center;
}

.status-indicator {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 8px;
}

.status-indicator.healthy {
  background-color: #4CAF50;
}

.status-indicator.warning {
  background-color: #FF9800;
}

.status-indicator.error {
  background-color: #f44336;
}

.status-indicator.unknown {
  background-color: #9e9e9e;
}

.details {
  font-size: 13px;
  color: #666;
}

.status-text {
  font-weight: 500;
  margin-bottom: 5px;
}

.service-details {
  margin-bottom: 5px;
}

.service-info {
  margin-top: 8px;
}

.info-item {
  margin-bottom: 3px;
  font-size: 12px;
}

.rag-test-section {
  background: white;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.rag-table-selection {
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.rag-table-selection label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.rag-table-controls {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.rag-table-select {
  flex: 1;
  min-width: 200px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.refresh-tables-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s;
}

.refresh-tables-btn:hover {
  background: #5a6268;
}

.no-rag-tables {
  padding: 15px;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  color: #856404;
}

.no-rag-tables p {
  margin: 5px 0;
  font-size: 14px;
}

.no-rag-tables a {
  color: #007bff;
  text-decoration: none;
}

.no-rag-tables a:hover {
  text-decoration: underline;
}

.rag-progress-section {
  margin: 20px 0;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.rag-status {
  text-align: center;
  font-weight: 500;
  color: #333;
  margin-bottom: 15px;
  font-size: 16px;
}

.rag-progress-bar {
  width: 100%;
  height: 20px;
  background: #e9ecef;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 10px;
}

.rag-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #28a745, #20c997);
  border-radius: 10px;
  transition: width 0.3s ease;
  position: relative;
}

.rag-progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.rag-progress-text {
  text-align: center;
  font-weight: 600;
  color: #28a745;
  font-size: 14px;
}



.rag-test-section h4 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 1rem;
}

.rag-test-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.rag-input {
  flex: 1;
  min-width: 200px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.rag-test-btn {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.rag-test-btn:hover:not(:disabled) {
  background: #45a049;
}

.rag-test-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.rag-result {
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
  border-left: 4px solid #ddd;
}

.rag-result.success {
  background: #e8f5e8;
  border-left-color: #4CAF50;
}

.rag-result.error {
  background: #ffebee;
  border-left-color: #f44336;
}

@media (max-width: 768px) {
  .status-grid {
    grid-template-columns: 1fr;
  }
  
  .monitoring-controls {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .rag-test-controls {
    flex-direction: column;
  }
  
  .rag-input {
    min-width: auto;
  }
}
</style> 