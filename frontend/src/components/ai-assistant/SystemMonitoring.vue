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
      <div class="rag-test-controls">
        <input 
          v-model="ragQuestion" 
          placeholder="Введите вопрос" 
          class="rag-input"
        />
        <button @click="testRAG" :disabled="ragTesting" class="rag-test-btn">
          {{ ragTesting ? 'Тестирование...' : 'Тестировать RAG' }}
        </button>
      </div>
      <div v-if="ragResult" :class="['rag-result', getRagResultClass()]">
        <div v-if="ragResult.success">
          <strong>✅ Успешно!</strong><br>
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
const ragQuestion = ref('вопрос 1');
const ragTesting = ref(false);
const ragResult = ref(null);
const monitoringData = ref(null);

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
  ragTesting.value = true;
  ragResult.value = null;
  try {
    const response = await axios.post('/rag/answer', {
      tableId: 28,
      question: ragQuestion.value,
      product: null
    });
    ragResult.value = {
      success: true,
      answer: response.data.answer,
      score: response.data.score,
      llmResponse: response.data.llmResponse
    };
  } catch (error) {
    ragResult.value = {
      success: false,
      error: error.response?.data?.error || error.message || 'Неизвестная ошибка'
    };
  }
  ragTesting.value = false;
};

onMounted(() => {
  refreshStatus();
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