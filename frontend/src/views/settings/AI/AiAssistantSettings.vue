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
  <BaseLayout>
    <div class="ai-assistant-settings-block">
      <button class="close-btn" @click="goBack">×</button>
      <h2>ИИ-ассистент: интеграция и настройки</h2>
      <div class="assistant-status">
        <h3>Управление каналами ассистента</h3>
        <div class="status-list">
          <div class="status-item" v-for="channel in assistantChannels" :key="channel.key">
            <div class="status-info">
              <div class="status-name">{{ channel.label }}</div>
              <div
                class="status-value"
                :class="settings.enabled_channels?.[channel.key] ? 'status-enabled' : 'status-disabled'"
              >
                {{ settings.enabled_channels?.[channel.key] ? 'Включен' : 'Отключен' }}
              </div>
            </div>
            <div class="status-actions">
              <button
                type="button"
                class="status-button enable"
                :disabled="channelStatusLoading[channel.key] || settings.enabled_channels?.[channel.key]"
                @click="setChannelStatus(channel.key, true)"
              >
                Включить
              </button>
              <button
                type="button"
                class="status-button disable"
                :disabled="channelStatusLoading[channel.key] || !settings.enabled_channels?.[channel.key]"
                @click="setChannelStatus(channel.key, false)"
              >
                Отключить
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="ai-assistant-settings settings-panel">
        <form @submit.prevent="saveSettings">
          <label>Системный промт</label>
          <textarea v-model="settings.system_prompt" rows="3" />
          <!-- Блок плейсхолдеров -->
          <div class="placeholders-block">
            <h4>Плейсхолдеры пользовательских таблиц</h4>
            <div v-if="placeholders.length === 0" class="empty-placeholder">Нет пользовательских плейсхолдеров</div>
            <table v-else class="placeholders-table">
              <thead>
                <tr>
                  <th>Плейсхолдер</th>
                  <th>Столбец</th>
                  <th>Таблица</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ph in placeholders" :key="ph.column_id">
                  <td><code>{ {{ ph.placeholder }} }</code></td>
                  <td>{{ ph.column_name }}</td>
                  <td>{{ ph.table_name }}</td>
                  <td><button type="button" @click="openEditPlaceholder(ph)">Редактировать</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Модалка редактирования плейсхолдера -->
          <div v-if="editingPlaceholder" class="modal-bg">
            <div class="modal">
              <h4>Редактировать плейсхолдер</h4>
              <div><b>Таблица:</b> {{ editingPlaceholder.table_name }}</div>
              <div><b>Столбец:</b> {{ editingPlaceholder.column_name }}</div>
              <label>Плейсхолдер</label>
              <input v-model="editingPlaceholderValue" />
              <div class="actions">
                <button type="button" @click="savePlaceholderEdit">Сохранить</button>
                <button type="button" @click="closeEditPlaceholder">Отмена</button>
              </div>
            </div>
          </div>
          <!-- Настройки Ollama (инфраструктура) -->
          <div class="ollama-settings">
            <h3>Настройки Ollama (инфраструктура)</h3>
            <p class="section-description">Настройки подключения к Ollama серверу. Используются как дефолтные значения для всех операций с Ollama, если не указана конкретная модель в настройках AI ассистента ниже.</p>
            
            <div class="form-group">
              <label>Ollama Base URL</label>
              <input type="text" v-model="ollamaConfig.baseUrl" placeholder="http://ollama:11434" />
              <small>Базовый URL для Ollama API</small>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>LLM Model (Ollama) - дефолтная</label>
                <input type="text" v-model="ollamaConfig.llmModel" placeholder="qwen2.5:7b" />
                <small>Название LLM модели по умолчанию (используется, если не выбрана модель ниже)</small>
              </div>
              <div class="form-group">
                <label>Embedding Model (Ollama) - дефолтная</label>
                <input type="text" v-model="ollamaConfig.embeddingModel" placeholder="mxbai-embed-large:latest" />
                <small>Название Embedding модели по умолчанию (используется, если не выбрана модель ниже)</small>
              </div>
            </div>
          </div>

          <!-- Настройки Vector Search -->
          <div class="vector-search-settings">
            <h3>Настройки Vector Search</h3>
            
            <div class="form-group">
              <label>Vector Search URL</label>
              <input type="text" v-model="vectorSearchConfig.url" placeholder="http://vector-search:8001" />
              <small>URL для сервиса векторного поиска</small>
            </div>
          </div>

          <!-- Выбор модели для AI ассистента -->
          <div class="model-selection-settings">
            <h3>Выбор модели для AI ассистента</h3>
            <p class="section-description">Выберите конкретную модель из списка доступных провайдеров. Если модель не выбрана, будет использована дефолтная модель Ollama из настроек выше.</p>
            
            <label>LLM-модель для AI ассистента</label>
          <select v-if="llmModels.length" v-model="settings.model">
              <option value="">Использовать дефолтную модель Ollama</option>
            <option v-for="m in llmModels" :key="m.id" :value="m.id">{{ m.id }} ({{ m.provider }})</option>
          </select>
          <input v-else v-model="settings.model" placeholder="qwen2.5" />
            <small v-if="!settings.model">Будет использована: {{ ollamaConfig.llmModel }}</small>
            
            <label>Embedding-модель для AI ассистента</label>
          <select v-if="filteredEmbeddingModels.length" v-model="settings.embedding_model">
              <option value="">Использовать дефолтную модель Ollama</option>
            <option v-for="m in filteredEmbeddingModels" :key="m.id" :value="m.id">{{ m.id }} ({{ m.provider }})</option>
          </select>
          <input v-else v-model="settings.embedding_model" placeholder="bge-base-zh" />
            <small v-if="!settings.embedding_model">Будет использована: {{ ollamaConfig.embeddingModel }}</small>
          </div>
          <label>Выбранные RAG-таблицы</label>
          <select v-model="settings.selected_rag_tables" :multiple="false">
            <option value="">Выберите таблицу</option>
            <option v-for="table in ragTables" :key="table.id" :value="table.id">
              {{ getTableDisplayName(table) }}
            </option>
          </select>
          <label>Набор правил</label>
          <div class="rules-row">
            <select v-model="settings.rules_id">
              <option value="">Выберите набор правил</option>
              <option v-for="rule in rulesList" :key="rule.id" :value="rule.id">
                {{ getRuleDisplayName(rule) }}
              </option>
            </select>
            <button type="button" @click="openRuleEditor()">Создать</button>
            <button type="button" :disabled="!settings.rules_id" @click="openRuleEditor(settings.rules_id)">Редактировать</button>
            <button type="button" :disabled="!settings.rules_id" @click="deleteRule(settings.rules_id)">Удалить</button>
          </div>
          <div v-if="selectedRule">
            <p><b>Описание:</b> {{ selectedRule.description }}</p>
            <pre class="rules-json">{{ JSON.stringify(selectedRule.rules, null, 2) }}</pre>
          </div>
          <label>Telegram-бот</label>
          <select v-model="settings.telegram_settings_id">
            <option v-for="tg in telegramBots" :key="tg.id" :value="tg.id">
              {{ tg.bot_username }}
            </option>
          </select>
          <label>Email для связи</label>
          <select v-model="settings.email_settings_id">
            <option v-for="em in emailList" :key="em.id" :value="em.id">
              {{ em.from_email }}
            </option>
          </select>
          
          <!-- Настройки RAG поиска -->
          <div class="rag-search-settings">
            <h3>Настройки RAG поиска</h3>
            
            <!-- Порог расстояния (threshold) -->
            <label>Порог расстояния для векторного поиска (threshold)</label>
            <input type="number" v-model.number="ragSettings.threshold" min="0" max="1000" step="10" />
            <small>Минимальное расстояние для включения результата в ответ (меньше = строже)</small>
            
            <!-- Метод поиска -->
            <label>Метод поиска</label>
            <select v-model="ragSettings.searchMethod">
              <option value="semantic">Только семантический поиск</option>
              <option value="keyword">Только поиск по ключевым словам</option>
              <option value="hybrid">Гибридный поиск</option>
            </select>
            
            <!-- Количество результатов -->
            <label>Максимальное количество результатов поиска</label>
            <input type="number" v-model.number="ragSettings.maxResults" min="1" max="20" />
            
            <!-- Порог релевантности -->
            <label>Порог релевантности ({{ ragSettings.relevanceThreshold }})</label>
            <input type="range" v-model.number="ragSettings.relevanceThreshold" 
                   min="0.01" max="1.0" step="0.01" />
            
            <!-- Настройки извлечения ключевых слов -->
            <div class="keyword-settings">
              <h4>Извлечение ключевых слов</h4>
              <label class="checkbox-label">
                <input type="checkbox" v-model="ragSettings.keywordExtraction.enabled" />
                Включить извлечение ключевых слов
              </label>
              
              <label>Минимальная длина слова</label>
              <input type="number" v-model="ragSettings.keywordExtraction.minWordLength" 
                     min="2" max="10" />
              
              <label>Максимальное количество ключевых слов</label>
              <input type="number" v-model="ragSettings.keywordExtraction.maxKeywords" 
                     min="5" max="20" />
              
              <label class="checkbox-label">
                <input type="checkbox" v-model="ragSettings.keywordExtraction.removeStopWords" />
                Удалять стоп-слова
              </label>
            </div>
            
            <!-- Веса для гибридного поиска -->
            <div v-if="ragSettings.searchMethod === 'hybrid'" class="search-weights">
              <h4>Веса поиска</h4>
              <label>Семантический поиск: {{ ragSettings.searchWeights.semantic }}%</label>
              <input type="range" v-model="ragSettings.searchWeights.semantic" 
                     min="0" max="100" />
              
              <label>Поиск по ключевым словам: {{ ragSettings.searchWeights.keyword }}%</label>
              <input type="range" v-model="ragSettings.searchWeights.keyword" 
                     min="0" max="100" />
            </div>
            
            <!-- Дополнительные настройки -->
            <div class="advanced-settings">
              <h4>Дополнительные настройки</h4>
              <label class="checkbox-label">
                <input type="checkbox" v-model="ragSettings.advanced.enableFuzzySearch" />
                Нечеткий поиск
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="ragSettings.advanced.enableStemming" />
                Стемминг слов
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="ragSettings.advanced.enableSynonyms" />
                Поиск синонимов
              </label>
            </div>
          </div>

          <!-- Настройки LLM параметров -->
          <div class="llm-parameters-settings">
            <h3>Параметры LLM</h3>
            
            <div class="form-row">
              <div class="form-group">
                <label>Temperature (0.0-2.0)</label>
                <input type="number" v-model.number="llmParameters.temperature" min="0" max="2" step="0.1" />
                <small>Креативность ответов (выше = более креативно)</small>
              </div>
              <div class="form-group">
                <label>Max Tokens</label>
                <input type="number" v-model.number="llmParameters.maxTokens" min="1" max="4000" />
                <small>Максимальная длина ответа</small>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>Top P (0.0-1.0)</label>
                <input type="number" v-model.number="llmParameters.top_p" min="0" max="1" step="0.01" />
                <small>Ядро выборки (nucleus sampling)</small>
              </div>
              <div class="form-group">
                <label>Top K</label>
                <input type="number" v-model.number="llmParameters.top_k" min="1" max="100" />
                <small>Количество лучших токенов для выборки</small>
              </div>
            </div>
            
            <div class="form-group">
              <label>Repeat Penalty (1.0-2.0)</label>
              <input type="number" v-model.number="llmParameters.repeat_penalty" min="1.0" max="2.0" step="0.1" />
              <small>Штраф за повторения (выше = меньше повторений)</small>
            </div>
          </div>

          <!-- Настройки Qwen -->
          <div class="qwen-parameters-settings">
            <h3>Параметры Qwen</h3>
            
            <div class="form-group">
              <label>Format</label>
              <select v-model="qwenParameters.format">
                <option :value="null">Автоматически (null)</option>
                <option value="json">JSON</option>
              </select>
              <small>Формат ответа (json для структурированных ответов)</small>
            </div>
          </div>

          <!-- Настройки Embedding -->
          <div class="embedding-parameters-settings">
            <h3>Параметры Embedding модели</h3>
            
            <div class="form-row">
              <div class="form-group">
                <label>Batch Size</label>
                <input type="number" v-model.number="embeddingParameters.batch_size" min="1" max="128" />
                <small>Размер батча для обработки</small>
              </div>
              <div class="form-group">
                <label>Dimension</label>
                <input type="number" v-model.number="embeddingParameters.dimension" min="0" :placeholder="'Авто (null)'" />
                <small>Размерность вектора (0 = авто)</small>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>Pooling</label>
                <select v-model="embeddingParameters.pooling">
                  <option value="mean">Mean (среднее)</option>
                  <option value="max">Max (максимум)</option>
                  <option value="cls">CLS</option>
                </select>
              </div>
              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="embeddingParameters.normalize" />
                  Нормализация векторов
                </label>
              </div>
            </div>
          </div>

          <!-- Настройки кэша -->
          <div class="cache-settings">
            <h3>Настройки кэширования</h3>
            
            <label class="checkbox-label">
              <input type="checkbox" v-model="cacheSettings.enabled" />
              Включить кэширование
            </label>
            
            <div class="form-row">
              <div class="form-group">
                <label>LLM TTL (мс)</label>
                <input type="number" v-model.number="cacheSettings.llmTTL" min="0" step="1000" />
                <small>Время жизни кэша для LLM ответов</small>
              </div>
              <div class="form-group">
                <label>RAG TTL (мс)</label>
                <input type="number" v-model.number="cacheSettings.ragTTL" min="0" step="1000" />
                <small>Время жизни кэша для RAG результатов</small>
              </div>
            </div>
            
            <div class="form-group">
              <label>Max Size</label>
              <input type="number" v-model.number="cacheSettings.maxSize" min="1" max="10000" />
              <small>Максимальный размер кэша (количество записей)</small>
            </div>
          </div>

          <!-- Настройки очереди -->
          <div class="queue-settings">
            <h3>Настройки очереди запросов</h3>
            
            <label class="checkbox-label">
              <input type="checkbox" v-model="queueSettings.enabled" />
              Включить очередь
            </label>
            
            <div class="form-row">
              <div class="form-group">
                <label>Timeout (мс)</label>
                <input type="number" v-model.number="queueSettings.timeout" min="1000" step="1000" />
                <small>Таймаут обработки запроса</small>
              </div>
              <div class="form-group">
                <label>Max Size</label>
                <input type="number" v-model.number="queueSettings.maxSize" min="1" max="1000" />
                <small>Максимальный размер очереди</small>
              </div>
            </div>
            
            <div class="form-group">
              <label>Interval (мс)</label>
              <input type="number" v-model.number="queueSettings.interval" min="10" step="10" />
              <small>Интервал обработки очереди</small>
            </div>
          </div>

          <!-- Настройки дедупликации -->
          <div class="deduplication-settings">
            <h3>Настройки дедупликации сообщений</h3>
            
            <label class="checkbox-label">
              <input type="checkbox" v-model="deduplicationSettings.enabled" />
              Включить дедупликацию
            </label>
            
            <div class="form-group">
              <label>TTL (мс)</label>
              <input type="number" v-model.number="deduplicationSettings.ttl" min="1000" step="1000" />
              <small>Время жизни записи о сообщении</small>
            </div>
          </div>

          <!-- Настройки RAG поведения -->
          <div class="rag-behavior-settings">
            <h3>Поведение RAG</h3>
            
            <label class="checkbox-label">
              <input type="checkbox" v-model="ragBehavior.upsertOnQuery" />
              Автоматически индексировать при запросе
            </label>
            
            <label class="checkbox-label">
              <input type="checkbox" v-model="ragBehavior.autoIndexOnTableChange" />
              Автоматически индексировать при изменении таблицы
            </label>
          </div>

          <!-- Настройки таймаутов -->
          <div class="timeouts-settings">
            <h3>Таймауты для операций (мс)</h3>
            
            <div class="form-row">
              <div class="form-group">
                <label>Ollama Chat</label>
                <input type="number" v-model.number="timeouts.ollamaChat" min="1000" step="1000" />
                <small>Таймаут для LLM чата</small>
              </div>
              <div class="form-group">
                <label>Ollama Embedding</label>
                <input type="number" v-model.number="timeouts.ollamaEmbedding" min="1000" step="1000" />
                <small>Таймаут для embedding</small>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>Vector Search</label>
                <input type="number" v-model.number="timeouts.vectorSearch" min="1000" step="1000" />
                <small>Таймаут для поиска</small>
              </div>
              <div class="form-group">
                <label>Vector Upsert</label>
                <input type="number" v-model.number="timeouts.vectorUpsert" min="1000" step="1000" />
                <small>Таймаут для индексации</small>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>Vector Health</label>
                <input type="number" v-model.number="timeouts.vectorHealth" min="1000" step="1000" />
                <small>Таймаут для health check</small>
              </div>
              <div class="form-group">
                <label>Ollama Health</label>
                <input type="number" v-model.number="timeouts.ollamaHealth" min="1000" step="1000" />
                <small>Таймаут для health check</small>
              </div>
            </div>
            
            <div class="form-group">
              <label>Ollama Tags</label>
              <input type="number" v-model.number="timeouts.ollamaTags" min="1000" step="1000" />
              <small>Таймаут для получения тегов</small>
            </div>
          </div>
          
          <div class="actions">
            <button type="submit">Сохранить</button>
            <button type="button" @click="goBack">Отмена</button>
          </div>
        </form>
        <RuleEditor v-if="showRuleEditor" :rule="editingRule" @close="onRuleEditorClose" />
      </div>
      
      <!-- Системный мониторинг -->
      <SystemMonitoring />
    </div>
  </BaseLayout>
</template>
<script setup>
import BaseLayout from '@/components/BaseLayout.vue';
import { useRouter } from 'vue-router';
import { ref, onMounted, computed, onBeforeUnmount } from 'vue';
import axios from 'axios';
import RuleEditor from '@/components/ai-assistant/RuleEditor.vue';
import SystemMonitoring from '@/components/ai-assistant/SystemMonitoring.vue';
const router = useRouter();
const goBack = () => router.push('/settings/ai');
const defaultEnabledChannels = { web: true, telegram: true, email: true };
const settings = ref({
  system_prompt: '',
  model: '',
  selected_rag_tables: [],
  rules_id: null,
  enabled_channels: { ...defaultEnabledChannels }
});
const userTables = ref([]);
const ragTables = computed(() => userTables.value.filter(t => t.is_rag_source_id === 1));
const rulesList = ref([]);
const showRuleEditor = ref(false);
const editingRule = ref(null);
const telegramBots = ref([]);
const emailList = ref([]);
const llmModels = ref([]);
const embeddingModels = ref([]);
const selectedRule = computed(() => rulesList.value.find(r => r.id === settings.value.rules_id) || null);
const selectedLLM = computed(() => llmModels.value.find(m => m.id === settings.value.model));
const filteredEmbeddingModels = computed(() => {
  if (!selectedLLM.value) return embeddingModels.value;
  return embeddingModels.value.filter(m => m.provider === selectedLLM.value.provider);
});
const placeholders = ref([]);
const editingPlaceholder = ref(null);
const editingPlaceholderValue = ref('');
const channelStatusLoading = ref({ web: false, telegram: false, email: false });
const assistantChannels = [
  { key: 'web', label: 'Web-чат' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'email', label: 'Email' }
];

// Настройки RAG поиска (загружаются из ai_config)
const ragSettings = ref({
  threshold: 300,
  searchMethod: 'hybrid',
  maxResults: 3,
  relevanceThreshold: 0.1,
  keywordExtraction: {
    enabled: true,
    minWordLength: 3,
    maxKeywords: 10,
    removeStopWords: true,
    language: 'ru'
  },
  searchWeights: {
    semantic: 70,
    keyword: 30
  },
  advanced: {
    enableFuzzySearch: true,
    enableStemming: true,
    enableSynonyms: false
  }
});

// LLM параметры
const llmParameters = ref({
  temperature: 0.3,
  maxTokens: 150,
  top_p: 0.9,
  top_k: 40,
  repeat_penalty: 1.1
});

// Qwen специфичные параметры
const qwenParameters = ref({
  format: null
});

// Embedding параметры
const embeddingParameters = ref({
  batch_size: 32,
  normalize: true,
  dimension: null,
  pooling: 'mean'
});

// Настройки кэша
const cacheSettings = ref({
  enabled: true,
  llmTTL: 86400000,
  ragTTL: 300000,
  maxSize: 1000
});

// Настройки очереди
const queueSettings = ref({
  enabled: true,
  timeout: 180000,
  maxSize: 100,
  interval: 100
});

// Настройки дедупликации
const deduplicationSettings = ref({
  enabled: true,
  ttl: 300000
});

// Поведение RAG
const ragBehavior = ref({
  upsertOnQuery: false,
  autoIndexOnTableChange: true
});

// Ollama настройки
const ollamaConfig = ref({
  baseUrl: 'http://ollama:11434',
  llmModel: 'qwen2.5:7b',
  embeddingModel: 'mxbai-embed-large:latest'
});

// Vector Search настройки
const vectorSearchConfig = ref({
  url: 'http://vector-search:8001'
});

// Таймауты
const timeouts = ref({
  ollamaChat: 180000,
  ollamaEmbedding: 90000,
  vectorSearch: 90000,
  vectorUpsert: 90000,
  vectorHealth: 5000,
  ollamaHealth: 5000,
  ollamaTags: 10000
});

async function loadUserTables() {
  const { data } = await axios.get('/tables');
  userTables.value = Array.isArray(data) ? data : [];
}
async function loadRules() {
  const { data } = await axios.get('/settings/ai-assistant-rules');
  rulesList.value = data.rules || [];
}
async function loadSettings() {
  const { data } = await axios.get('/settings/ai-assistant');
  if (data.success && data.settings) {
    // Обрабатываем selected_rag_tables - если это массив, берем первый элемент для single select
    const settingsData = { ...data.settings };
    if (Array.isArray(settingsData.selected_rag_tables) && settingsData.selected_rag_tables.length > 0) {
      // Для single select берем первый элемент массива
      settingsData.selected_rag_tables = settingsData.selected_rag_tables[0];
    } else if (!Array.isArray(settingsData.selected_rag_tables)) {
      // Если это не массив, устанавливаем пустое значение
      settingsData.selected_rag_tables = '';
    }

    let incomingChannels = settingsData.enabled_channels;
    if (typeof incomingChannels === 'string') {
      try {
        incomingChannels = JSON.parse(incomingChannels);
      } catch (error) {
        console.error('[AiAssistantSettings] Не удалось распарсить enabled_channels:', error);
        incomingChannels = null;
      }
    }
    settingsData.enabled_channels = normalizeEnabledChannels(incomingChannels);

    settings.value = settingsData;
    
    // Загружаем настройки RAG из ai_config (централизованные настройки)
    await loadRAGSettings();
    
    console.log('[AiAssistantSettings] Loaded settings:', settings.value);
    console.log('[AiAssistantSettings] Loaded RAG settings:', ragSettings.value);
  }
}

// Загрузить все настройки из ai_config
async function loadRAGSettings() {
  try {
    const { data } = await axios.get('/settings/ai-config');
    if (data.success && data.config) {
      // RAG настройки
      if (data.config.rag_settings) {
        ragSettings.value = {
          threshold: 300,
          searchMethod: 'hybrid',
          maxResults: 3,
          relevanceThreshold: 0.1,
          keywordExtraction: {
            enabled: true,
            minWordLength: 3,
            maxKeywords: 10,
            removeStopWords: true,
            language: 'ru'
          },
          searchWeights: {
            semantic: 70,
            keyword: 30
          },
          advanced: {
            enableFuzzySearch: true,
            enableStemming: true,
            enableSynonyms: false
          },
          ...data.config.rag_settings
        };
      }
      
      // LLM параметры
      if (data.config.llm_parameters) {
        llmParameters.value = {
          temperature: 0.3,
          maxTokens: 150,
          top_p: 0.9,
          top_k: 40,
          repeat_penalty: 1.1,
          ...data.config.llm_parameters
        };
      }
      
      // Qwen параметры
      if (data.config.qwen_specific_parameters) {
        qwenParameters.value = {
          format: null,
          ...data.config.qwen_specific_parameters
        };
      }
      
      // Embedding параметры
      if (data.config.embedding_parameters) {
        embeddingParameters.value = {
          batch_size: 32,
          normalize: true,
          dimension: null,
          pooling: 'mean',
          ...data.config.embedding_parameters
        };
      }
      
      // Cache настройки
      if (data.config.cache_settings) {
        cacheSettings.value = {
          enabled: true,
          llmTTL: 86400000,
          ragTTL: 300000,
          maxSize: 1000,
          ...data.config.cache_settings
        };
      }
      
      // Queue настройки
      if (data.config.queue_settings) {
        queueSettings.value = {
          enabled: true,
          timeout: 180000,
          maxSize: 100,
          interval: 100,
          ...data.config.queue_settings
        };
      }
      
      // Deduplication настройки
      if (data.config.deduplication_settings) {
        deduplicationSettings.value = {
          enabled: true,
          ttl: 300000,
          ...data.config.deduplication_settings
        };
      }
      
      // RAG behavior
      if (data.config.rag_behavior) {
        ragBehavior.value = {
          upsertOnQuery: false,
          autoIndexOnTableChange: true,
          ...data.config.rag_behavior
        };
      }
      
      // Ollama настройки
      if (data.config.ollama_base_url) {
        ollamaConfig.value.baseUrl = data.config.ollama_base_url;
      }
      if (data.config.ollama_llm_model) {
        ollamaConfig.value.llmModel = data.config.ollama_llm_model;
      }
      if (data.config.ollama_embedding_model) {
        ollamaConfig.value.embeddingModel = data.config.ollama_embedding_model;
      }
      
      // Vector Search настройки
      if (data.config.vector_search_url) {
        vectorSearchConfig.value.url = data.config.vector_search_url;
      }
      
      // Таймауты
      if (data.config.timeouts) {
        timeouts.value = {
          ollamaChat: 180000,
          ollamaEmbedding: 90000,
          vectorSearch: 90000,
          vectorUpsert: 90000,
          vectorHealth: 5000,
          ollamaHealth: 5000,
          ollamaTags: 10000,
          ...data.config.timeouts
        };
      }
    }
  } catch (error) {
    console.error('[AiAssistantSettings] Ошибка загрузки настроек из ai_config:', error);
    // Используем дефолтные значения при ошибке
  }
}
async function loadTelegramBots() {
  try {
    const { data } = await axios.get('/settings/telegram-settings/list');
    telegramBots.value = data.items || [];
  } catch (error) {
    console.error('[AiAssistantSettings] Ошибка загрузки telegram bots:', error);
    telegramBots.value = [];
  }
}
async function loadEmailList() {
  try {
    const { data } = await axios.get('/settings/email-settings/list');
    emailList.value = data.items || [];
  } catch (error) {
    console.error('[AiAssistantSettings] Ошибка загрузки email list:', error);
    emailList.value = [];
  }
}
async function loadLLMModels() {
  const { data } = await axios.get('/settings/llm-models');
  llmModels.value = data.models || [];
}
async function loadEmbeddingModels() {
  const { data } = await axios.get('/settings/embedding-models');
  embeddingModels.value = data.models || [];
}
async function loadPlaceholders() {
  try {
  const { data } = await axios.get('/tables/placeholders/all');
  const allPlaceholders = Array.isArray(data) ? data : [];
  
    // Показываем все плейсхолдеры из всех пользовательских таблиц
    // Если выбрана RAG таблица, можно добавить фильтрацию по желанию
    placeholders.value = allPlaceholders;
    
    // Если нужно показывать только плейсхолдеры выбранной RAG таблицы, раскомментируйте:
    // if (settings.value.selected_rag_tables) {
    //   const selectedTableId = typeof settings.value.selected_rag_tables === 'object' 
    //     ? settings.value.selected_rag_tables[0] 
    //     : settings.value.selected_rag_tables;
    //   placeholders.value = allPlaceholders.filter(ph => ph.table_id === Number(selectedTableId));
    // } else {
    //   placeholders.value = [];
    // }
  } catch (error) {
    console.error('[AiAssistantSettings] Ошибка загрузки плейсхолдеров:', error);
    placeholders.value = [];
  }
}
function openEditPlaceholder(ph) {
  editingPlaceholder.value = { ...ph };
  editingPlaceholderValue.value = ph.placeholder;
}
function closeEditPlaceholder() {
  editingPlaceholder.value = null;
  editingPlaceholderValue.value = '';
}
async function savePlaceholderEdit() {
  if (!editingPlaceholder.value) return;
  await axios.patch(`/tables/column/${editingPlaceholder.value.column_id}`, { placeholder: editingPlaceholderValue.value });
  await loadPlaceholders();
  closeEditPlaceholder();
}
// Обновляем плейсхолдеры при изменении выбранной RAG таблицы
// Убрали автоматическую перезагрузку плейсхолдеров при изменении RAG таблицы
// Теперь показываем все плейсхолдеры из всех таблиц
// watch(() => settings.value.selected_rag_tables, () => {
//   loadPlaceholders();
// });

onMounted(async () => {
  await loadSettings();
  await loadUserTables();
  await loadRules();
  await loadTelegramBots();
  await loadEmailList();
  await loadLLMModels();
  await loadEmbeddingModels();
  await loadPlaceholders();
  // Подписка на глобальное событие обновления плейсхолдеров
  window.addEventListener('placeholders-updated', loadPlaceholders);
});

onBeforeUnmount(() => {
  window.removeEventListener('placeholders-updated', loadPlaceholders);
});
async function saveSettings() {
  const settingsToSave = buildSettingsPayload();

  console.log('[AiAssistantSettings] Saving settings:', settingsToSave);
  await axios.put('/settings/ai-assistant', settingsToSave);
  
  // Сохраняем все настройки в ai_config (централизованные настройки)
  console.log('[AiAssistantSettings] Saving all settings to ai_config');
  await axios.put('/settings/ai-config', {
    ollama_base_url: ollamaConfig.value.baseUrl,
    ollama_llm_model: ollamaConfig.value.llmModel,
    ollama_embedding_model: ollamaConfig.value.embeddingModel,
    vector_search_url: vectorSearchConfig.value.url,
    rag_settings: ragSettings.value,
    llm_parameters: llmParameters.value,
    qwen_specific_parameters: qwenParameters.value,
    embedding_parameters: embeddingParameters.value,
    cache_settings: cacheSettings.value,
    queue_settings: queueSettings.value,
    deduplication_settings: deduplicationSettings.value,
    rag_behavior: ragBehavior.value,
    timeouts: timeouts.value
  });
  
  goBack();
}

function buildSettingsPayload(overrides = {}) {
  const payload = { ...settings.value, ...overrides };

  if (!Array.isArray(payload.selected_rag_tables)) {
    if (payload.selected_rag_tables === '' || payload.selected_rag_tables === null || payload.selected_rag_tables === undefined) {
      payload.selected_rag_tables = [];
    } else {
      payload.selected_rag_tables = [payload.selected_rag_tables];
    }
  }

  payload.selected_rag_tables = payload.selected_rag_tables
    .map(value => Number(value))
    .filter(value => !Number.isNaN(value));

  payload.enabled_channels = normalizeEnabledChannels(payload.enabled_channels);

  return payload;
}

function normalizeEnabledChannels(channels) {
  if (!channels || typeof channels !== 'object') {
    return { ...defaultEnabledChannels };
  }

  const normalized = { ...defaultEnabledChannels };

  Object.keys(defaultEnabledChannels).forEach(key => {
    if (key in channels) {
      normalized[key] = Boolean(channels[key]);
    }
  });

  Object.keys(channels).forEach(key => {
    if (!(key in normalized)) {
      normalized[key] = Boolean(channels[key]);
    }
  });

  return normalized;
}

async function setChannelStatus(channelKey, isEnabled) {
  if (!assistantChannels.some(channel => channel.key === channelKey)) {
    return;
  }

  if (channelStatusLoading.value[channelKey]) {
    return;
  }

  channelStatusLoading.value = {
    ...channelStatusLoading.value,
    [channelKey]: true
  };

  try {
    const updatedChannels = {
      ...normalizeEnabledChannels(settings.value.enabled_channels),
      [channelKey]: isEnabled
    };
    const payload = buildSettingsPayload({ enabled_channels: updatedChannels });
    console.log('[AiAssistantSettings] Update assistant channel status:', channelKey, payload.enabled_channels[channelKey]);
    await axios.put('/settings/ai-assistant', payload);
    settings.value.enabled_channels = { ...updatedChannels };
  } catch (error) {
    console.error('[AiAssistantSettings] Не удалось обновить статус ассистента для канала', channelKey, error);
    alert(`Не удалось обновить статус ассистента для канала ${channelKey}. Проверьте логи.`);
  } finally {
    channelStatusLoading.value = {
      ...channelStatusLoading.value,
      [channelKey]: false
    };
  }
}
function openRuleEditor(ruleId = null) {
  if (ruleId) {
    editingRule.value = rulesList.value.find(r => r.id === ruleId) || null;
  } else {
    editingRule.value = null;
  }
  showRuleEditor.value = true;
}
async function deleteRule(ruleId) {
  if (!confirm('Удалить этот набор правил?')) return;
      await axios.delete(`/settings/ai-assistant-rules/${ruleId}`);
  await loadRules();
  if (settings.value.rules_id === ruleId) settings.value.rules_id = null;
}
async function onRuleEditorClose(updated) {
  showRuleEditor.value = false;
  editingRule.value = null;
  if (updated) await loadRules();
}

function getTableDisplayName(table) {
  if (!table) return '';
  return table.name || `Таблица ${table.id}`;
}

function getRuleDisplayName(rule) {
  if (!rule) return '';
  return rule.name || `Набор правил ${rule.id}`;
}
</script>

<style scoped>
.ai-assistant-settings-block {
  background: #fff;
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-top: 20px;
  margin-bottom: 20px;
  width: 100%;
  position: relative;
  overflow-x: auto;
}
.close-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #bbb;
  transition: color 0.2s;
}
.close-btn:hover {
  color: #333;
}
h2 {
  margin-bottom: 0;
}
.ai-assistant-settings.settings-panel {
  background: none !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  margin-top: 0 !important;
  max-width: 100% !important;
  padding: 0 !important;
}
.assistant-status {
  margin: 1.5rem 0;
  padding: 1.5rem;
  background: #f4f8ff;
  border: 1px solid #d9e8ff;
  border-radius: 8px;
}
.assistant-status h3 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  color: #2c3e50;
}
.assistant-status .status-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.assistant-status .status-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
  background: #fff;
  border: 1px solid #e3ecff;
  border-radius: 8px;
  padding: 0.9rem 1.1rem;
}
.assistant-status .status-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.assistant-status .status-name {
  font-weight: 600;
  color: #2c3e50;
}
.assistant-status .status-value {
  font-weight: 500;
}
.assistant-status .status-enabled {
  color: #2ecc40;
}
.assistant-status .status-disabled {
  color: #e74c3c;
}
.assistant-status .status-actions {
  display: flex;
  gap: 0.75rem;
}
.assistant-status .status-button {
  min-width: 130px;
  border-radius: 6px;
  padding: 0.45rem 1rem;
  font-size: 0.95rem;
  transition: opacity 0.2s, transform 0.1s;
}
.assistant-status .status-button.enable {
  background: var(--color-primary);
  color: #fff;
}
.assistant-status .status-button.disable {
  background: #ffeded;
  color: #c0392b;
}
.assistant-status .status-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}
.assistant-status .status-button:not(:disabled):active {
  transform: scale(0.98);
}
label {
  display: block;
  margin-top: 1rem;
  font-weight: 500;
}
textarea, input, select {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px solid #ddd;
  font-size: 1rem;
}
select[multiple] {
  min-height: 80px;
}
.rules-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}
.rules-json {
  background: #f7f7f7;
  border-radius: 6px;
  padding: 0.5rem;
  font-size: 0.95em;
  margin-top: 0.5rem;
  white-space: pre-wrap;
}
.actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}
button[type="submit"], .actions button {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
}
button[type="button"] {
  background: #eee;
  color: #333;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
}
.modal-bg {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.12);
  padding: 2rem;
  min-width: 320px;
  max-width: 420px;
}
.error {
  color: #c00;
  margin-top: 0.5rem;
}
.rag-table-list {
  list-style: none;
  padding: 0;
  margin: 0 0 1em 0;
}
.rag-table-link {
  color: #2ecc40;
  text-decoration: underline;
  cursor: pointer;
  font-weight: 500;
}
.rag-table-link:hover {
  color: #27ae38;
}
.placeholders-block {
  margin: 1.5em 0 2em 0;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1em 1.5em;
}
.placeholders-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.5em;
  background: #fff;
}
.placeholders-table th, .placeholders-table td {
  border: 1px solid #ececec;
  padding: 0.5em 0.7em;
  font-size: 1em;
}
.placeholders-table th {
  background: #f7f7f7;
  font-weight: 600;
}
.empty-placeholder {
  color: #888;
  font-size: 1em;
  margin: 0.7em 0;
}

/* Стили для описаний секций */
.section-description {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #f0f0f0;
  border-radius: 4px;
  border-left: 3px solid #4a90e2;
}

/* Блок выбора модели */
.model-selection-settings {
  margin: 2rem 0;
  padding: 1.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fafafa;
}

.model-selection-settings h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #333;
  font-size: 1.2rem;
  border-bottom: 2px solid #ddd;
  padding-bottom: 0.5rem;
}

.model-selection-settings label {
  display: block;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.model-selection-settings small {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.85rem;
  color: #666;
  font-style: italic;
}

/* Общие стили для секций настроек */
.ollama-settings,
.vector-search-settings,
.rag-search-settings,
.llm-parameters-settings,
.qwen-parameters-settings,
.embedding-parameters-settings,
.cache-settings,
.queue-settings,
.deduplication-settings,
.rag-behavior-settings,
.timeouts-settings {
  margin: 2rem 0;
  padding: 1.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fafafa;
}

.ollama-settings h3,
.vector-search-settings h3,
.rag-search-settings h3,
.llm-parameters-settings h3,
.qwen-parameters-settings h3,
.embedding-parameters-settings h3,
.cache-settings h3,
.queue-settings h3,
.deduplication-settings h3,
.rag-behavior-settings h3,
.timeouts-settings h3 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  color: #333;
  font-size: 1.2rem;
  border-bottom: 2px solid #ddd;
  padding-bottom: 0.5rem;
}

/* Стили для настроек RAG поиска */
.rag-search-settings {
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.rag-search-settings h3 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  color: #333;
  font-size: 1.2rem;
}

.keyword-settings, .search-weights, .advanced-settings {
  margin: 1rem 0;
  padding: 1rem;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.keyword-settings h4, .search-weights h4, .advanced-settings h4 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #555;
  font-size: 1rem;
}

.search-weights input[type="range"] {
  width: 100%;
  margin: 0.5rem 0;
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0;
  font-weight: normal;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  margin: 0;
}

.rag-search-settings input[type="range"] {
  width: 100%;
  margin: 0.5rem 0;
}

.rag-search-settings input[type="number"] {
  width: 100px;
  margin-right: 1rem;
}

/* Стили для form-row и form-group */
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin: 1rem 0;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-top: 0;
  margin-bottom: 0.5rem;
}

.form-group small {
  font-size: 0.85rem;
  color: #666;
  margin-top: 0.25rem;
  font-style: italic;
}

/* Улучшенные стили для всех секций */
.keyword-settings, .search-weights, .advanced-settings {
  margin: 1rem 0;
  padding: 1rem;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.keyword-settings h4, .search-weights h4, .advanced-settings h4 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #555;
  font-size: 1rem;
}

/* Стили для input и select в секциях настроек */
.llm-parameters-settings input[type="number"],
.qwen-parameters-settings input[type="number"],
.embedding-parameters-settings input[type="number"],
.cache-settings input[type="number"],
.queue-settings input[type="number"],
.deduplication-settings input[type="number"] {
  width: 100%;
  max-width: 200px;
}

.llm-parameters-settings select,
.qwen-parameters-settings select,
.embedding-parameters-settings select {
  width: 100%;
  max-width: 300px;
}
</style> 