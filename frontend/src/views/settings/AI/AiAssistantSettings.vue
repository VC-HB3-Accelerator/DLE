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
  <BaseLayout>
    <AdminPageShell
      :title="$t('settings.ai.assistant.pageTitle')"
      :show-close="true"
      fallback="/settings/ai"
      variant="panel"
    >
      <div class="assistant-status panel">
        <h3>{{ $t('settings.ai.assistant.channelManagement') }}</h3>
        <div class="status-list">
          <div class="status-item" v-for="channel in assistantChannels" :key="channel.key">
            <div class="status-info">
              <div class="status-name">{{ channel.label }}</div>
              <div
                class="status-value"
                :class="settings.enabled_channels?.[channel.key] ? 'status-enabled' : 'status-disabled'"
              >
                {{ settings.enabled_channels?.[channel.key] ? $t('settings.ai.assistant.enabled') : $t('settings.ai.assistant.disabled') }}
              </div>
            </div>
            <div class="status-actions btn-row">
              <button
                type="button"
                class="btn btn-primary btn-sm"
                :disabled="!settingsLoaded || channelStatusLoading[channel.key] || settings.enabled_channels?.[channel.key]"
                @click="setChannelStatus(channel.key, true)"
              >
                {{ $t('settings.ai.assistant.enable') }}
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-sm status-disable"
                :disabled="!settingsLoaded || channelStatusLoading[channel.key] || !settings.enabled_channels?.[channel.key]"
                @click="setChannelStatus(channel.key, false)"
              >
                {{ $t('settings.ai.assistant.disable') }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="ai-assistant-settings">
        <form @submit.prevent="saveSettings">
          <label class="form-label">{{ $t('settings.ai.assistant.systemPrompt') }}</label>
          <div class="prompt-actions">
            <button type="button" class="linkish" @click="applyRecommendedPrompt">
              {{ $t('settings.ai.assistant.applyRecommendedPrompt') }}
            </button>
          </div>
          <textarea
            v-model="settings.system_prompt"
            class="form-control"
            rows="12"
            :placeholder="$t('settings.ai.assistant.systemPromptPlaceholder')"
          />
          <small class="form-hint">{{ $t('settings.ai.assistant.systemPromptHelp') }}</small>
          <!-- Блок плейсхолдеров -->
          <div class="placeholders-block">
            <h4>{{ $t('settings.ai.assistant.placeholdersTitle') }}</h4>
            <div v-if="placeholders.length === 0" class="empty-placeholder">{{ $t('settings.ai.assistant.noPlaceholders') }}</div>
            <table v-else class="placeholders-table">
              <thead>
                <tr>
                  <th>{{ $t('settings.ai.assistant.placeholderCol') }}</th>
                  <th>{{ $t('settings.ai.assistant.columnCol') }}</th>
                  <th>{{ $t('settings.ai.assistant.tableCol') }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ph in placeholders" :key="ph.column_id">
                  <td><code>{ {{ ph.placeholder }} }</code></td>
                  <td>{{ ph.column_name }}</td>
                  <td>{{ ph.table_name }}</td>
                  <td><button type="button" class="btn btn-outline btn-sm" @click="openEditPlaceholder(ph)">{{ $t('common.edit') }}</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Модалка редактирования плейсхолдера -->
          <div v-if="editingPlaceholder" class="modal-bg">
            <div class="modal panel">
              <h4>{{ $t('settings.ai.assistant.editPlaceholder') }}</h4>
              <div><b>{{ $t('settings.ai.assistant.tableLabel') }}</b> {{ editingPlaceholder.table_name }}</div>
              <div><b>{{ $t('settings.ai.assistant.columnLabel') }}</b> {{ editingPlaceholder.column_name }}</div>
              <label class="form-label">{{ $t('settings.ai.assistant.placeholderCol') }}</label>
              <input v-model="editingPlaceholderValue" class="form-control" />
              <div class="form-actions">
                <button type="button" class="btn btn-primary" @click="savePlaceholderEdit">{{ $t('common.save') }}</button>
                <button type="button" class="btn btn-ghost" @click="closeEditPlaceholder">{{ $t('common.cancel') }}</button>
              </div>
            </div>
          </div>
          <div class="rag-infra-link settings-section panel">
            <h3>{{ $t('settings.ai.rag.linkFromAssistantTitle') }}</h3>
            <p class="section-description">{{ $t('settings.ai.rag.linkFromAssistantDesc') }}</p>
            <router-link class="btn btn-outline btn-sm" to="/settings/ai/rag">{{ $t('settings.ai.rag.openPage') }}</router-link>
          </div>
          <div class="rag-infra-link settings-section panel">
            <h3>{{ $t('settings.ai.agentAccess.linkFromAssistantTitle') }}</h3>
            <p class="section-description">{{ $t('settings.ai.agentAccess.linkFromAssistantDesc') }}</p>
            <router-link class="btn btn-outline btn-sm" to="/settings/ai/agent-access">{{ $t('settings.ai.agentAccess.openPage') }}</router-link>
          </div>
          <div class="rag-infra-link settings-section panel">
            <h3>{{ $t('settings.ai.voiceCall.linkFromAssistantTitle') }}</h3>
            <p class="section-description">{{ $t('settings.ai.voiceCall.linkFromAssistantDesc') }}</p>
            <router-link class="btn btn-outline btn-sm" to="/settings/ai/voice-call">{{ $t('settings.ai.voiceCall.openPage') }}</router-link>
          </div>

          <!-- Выбор модели для AI ассистента -->
          <div class="model-selection-settings settings-section panel">
            <h3>{{ $t('settings.ai.assistant.modelSelectionTitle') }}</h3>
            <p class="section-description">{{ $t('settings.ai.assistant.modelSelectionDesc') }}</p>
            
            <label class="form-label">{{ $t('settings.ai.assistant.llmForAssistant') }}</label>
          <select v-if="llmModels.length" v-model="settings.model" class="form-control">
              <option value="">{{ $t('settings.ai.assistant.useDefaultOllama') }}</option>
            <option v-for="m in llmModels" :key="m.id" :value="m.id">{{ m.id }} ({{ m.provider }})</option>
          </select>
          <input v-else v-model="settings.model" class="form-control" placeholder="qwen2.5" />
            <small v-if="!settings.model" class="form-hint">{{ $t('settings.ai.assistant.willUseLlm', { model: ollamaConfig.llmModel }) }}</small>
            <div v-if="modelCapsLabel" class="model-caps">
              <span class="model-caps__badge">{{ $t('settings.ai.assistant.modelUnderstands', { caps: modelCapsLabel.input }) }}</span>
              <span class="model-caps__badge">{{ $t('settings.ai.assistant.modelReplies', { caps: modelCapsLabel.output }) }}</span>
              <p v-if="modelCapsLabel.textOnly" class="form-hint">{{ $t('settings.ai.assistant.modelTextOnlyHint') }}</p>
            </div>

            <fieldset class="accept-input" :disabled="!settingsLoaded">
              <legend>{{ $t('settings.ai.assistant.acceptInputTitle') }}</legend>
              <label v-for="key in acceptInputKeys" :key="key" class="accept-input__row">
                <input v-model="settings.accept_input[key]" type="checkbox">
                <span>{{ $t(`settings.ai.assistant.acceptKeys.${key}`) }}</span>
              </label>
              <p class="form-hint">{{ $t('settings.ai.assistant.acceptInputHint') }}</p>
            </fieldset>
            
            <label class="form-label">{{ $t('settings.ai.assistant.embeddingForAssistant') }}</label>
          <select v-if="filteredEmbeddingModels.length" v-model="settings.embedding_model" class="form-control">
              <option value="">{{ $t('settings.ai.assistant.useDefaultOllama') }}</option>
            <option v-for="m in filteredEmbeddingModels" :key="m.id" :value="m.id">{{ m.id }} ({{ m.provider }})</option>
          </select>
          <input v-else v-model="settings.embedding_model" class="form-control" placeholder="bge-base-zh" />
            <small v-if="!settings.embedding_model" class="form-hint">{{ $t('settings.ai.assistant.willUseEmbedding', { model: ollamaConfig.embeddingModel }) }}</small>
          </div>
          <label class="form-label">{{ $t('settings.ai.assistant.ragTables') }}</label>
          <select v-model="settings.selected_rag_tables" class="form-control" :multiple="false">
            <option value="">{{ $t('settings.ai.assistant.selectTable') }}</option>
            <option v-for="table in ragTables" :key="table.id" :value="table.id">
              {{ getTableDisplayName(table) }}
            </option>
          </select>
          <label class="form-label">{{ $t('settings.ai.assistant.rulesSet') }}</label>
          <div class="rules-row btn-row">
            <select v-model="settings.rules_id" class="form-control">
              <option value="">{{ $t('settings.ai.assistant.selectRules') }}</option>
              <option v-for="rule in rulesList" :key="rule.id" :value="rule.id">
                {{ getRuleDisplayName(rule) }}
              </option>
            </select>
            <button type="button" class="btn btn-primary btn-sm" @click="openRuleEditor()">{{ $t('common.create') }}</button>
            <button type="button" class="btn btn-outline btn-sm" :disabled="!settings.rules_id" @click="openRuleEditor(settings.rules_id)">{{ $t('common.edit') }}</button>
            <button type="button" class="btn btn-danger btn-sm" :disabled="!settings.rules_id" @click="deleteRule(settings.rules_id)">{{ $t('common.delete') }}</button>
          </div>
          <div v-if="selectedRule">
            <p><b>{{ $t('settings.ai.assistant.descriptionLabel') }}</b> {{ selectedRule.description }}</p>
            <p v-if="selectedRule.tag_ids?.length">
              <b>{{ $t('settings.ai.assistant.boundTags') }}</b> {{ selectedRule.tag_ids.join(', ') }}
            </p>
            <pre class="rules-json">{{ JSON.stringify(selectedRule.rules, null, 2) }}</pre>
          </div>
          <label class="form-label">{{ $t('settings.ai.assistant.telegramBot') }}</label>
          <select v-model="settings.telegram_settings_id" class="form-control">
            <option v-for="tg in telegramBots" :key="tg.id" :value="tg.id">
              {{ tg.bot_username }}
            </option>
          </select>
          <label class="form-label">{{ $t('settings.ai.assistant.contactEmail') }}</label>
          <select v-model="settings.email_settings_id" class="form-control">
            <option v-for="em in emailList" :key="em.id" :value="em.id">
              {{ em.from_email }}
            </option>
          </select>
          
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" :disabled="!settingsLoaded || saving">
              {{ saving ? $t('common.saving') : $t('common.save') }}
            </button>
          </div>
        </form>
        <RuleEditor v-if="showRuleEditor" :rule="editingRule" @close="onRuleEditorClose" />
      </div>
      
    </AdminPageShell>
  </BaseLayout>
</template>
<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import BaseLayout from '@/components/BaseLayout.vue';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';
import { useRouter } from 'vue-router';
import { ref, onMounted, computed, onBeforeUnmount } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import RuleEditor from '@/components/ai-assistant/RuleEditor.vue';
import { resolveModelCapabilities, hasMultimodalInput, hasMultimodalOutput } from '@/shared/modelCapabilities.js';
import { ACCEPT_INPUT_KEYS, cloneDefaultAcceptInput, normalizeAcceptInput } from '@/shared/assistantAcceptInput.js';
const router = useRouter();
function goBack() {
  router.push('/settings/ai');
}
const defaultEnabledChannels = { web: true, telegram: true, email: true };
const settings = ref({
  system_prompt: '',
  model: '',
  selected_rag_tables: [],
  rules_id: null,
  enabled_channels: { ...defaultEnabledChannels },
  accept_input: cloneDefaultAcceptInput()
});
const settingsLoaded = ref(false);
const saving = ref(false);
const acceptInputKeys = ACCEPT_INPUT_KEYS;
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
const modelCapsLabel = computed(() => {
  const modelId = settings.value.model || ollamaConfig.value?.llmModel || '';
  if (!modelId) return null;
  const caps = resolveModelCapabilities(modelId);
  const input = ['text', caps.input.audio && 'audio', caps.input.video && 'video', caps.input.image && 'image'].filter(Boolean).join(' / ');
  const output = ['text', caps.output.audio && 'audio', caps.output.video && 'video'].filter(Boolean).join(' / ');
  return {
    input,
    output,
    textOnly: !hasMultimodalInput(caps) && !hasMultimodalOutput(caps)
  };
});
const filteredEmbeddingModels = computed(() => embeddingModels.value);
const placeholders = ref([]);
const editingPlaceholder = ref(null);
const editingPlaceholderValue = ref('');
const channelStatusLoading = ref({ web: false, telegram: false, email: false });
const assistantChannels = computed(() => [
  { key: 'web', label: t('settings.ai.assistant.channels.web') },
  { key: 'telegram', label: t('settings.ai.assistant.channels.telegram') },
  { key: 'email', label: t('settings.ai.assistant.channels.email') }
]);

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
  maxTokens: 8000,
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
  llmModel: 'qwen2.5:1.5b',
  embeddingModel: 'mxbai-embed-large:latest'
});

// Таймауты
const timeouts = ref({
  ollamaChat: 180000,
  ollamaEmbedding: 90000,
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
  settingsLoaded.value = false;
  try {
    const { data } = await axios.get('/settings/ai-assistant', {
      headers: { 'Cache-Control': 'no-store' }
    });
    if (!data.success) {
      throw new Error('load failed');
    }
    const settingsData = data.settings ? { ...data.settings } : {};
    if (Array.isArray(settingsData.selected_rag_tables) && settingsData.selected_rag_tables.length > 0) {
      settingsData.selected_rag_tables = settingsData.selected_rag_tables[0];
    } else if (!Array.isArray(settingsData.selected_rag_tables)) {
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
    settingsData.accept_input = normalizeAcceptInput(settingsData.accept_input);

    settings.value = settingsData;
    settingsLoaded.value = true;

    await loadRAGSettings();

    console.log('[AiAssistantSettings] Loaded settings:', settings.value);
    console.log('[AiAssistantSettings] Loaded RAG settings:', ragSettings.value);
  } catch (error) {
    console.error('[AiAssistantSettings] Не удалось загрузить настройки:', error);
    ElMessage.error(t('settings.ai.assistant.loadFailed'));
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
          maxTokens: 8000,
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
      
      // Таймауты
      if (data.config.timeouts) {
        timeouts.value = {
          ollamaChat: 180000,
          ollamaEmbedding: 90000,
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
  if (!settingsLoaded.value || saving.value) return;
  const settingsToSave = buildSettingsPayload();
  saving.value = true;
  try {
    console.log('[AiAssistantSettings] Saving settings:', settingsToSave);
    await axios.put('/settings/ai-assistant', settingsToSave);
    goBack();
  } catch (error) {
    console.error('[AiAssistantSettings] Save failed:', error);
    ElMessage.error(t('settings.ai.assistant.saveFailed'));
  } finally {
    saving.value = false;
  }
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
  payload.accept_input = normalizeAcceptInput(payload.accept_input);

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
  if (!settingsLoaded.value) {
    return;
  }
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
    alert(t('settings.ai.assistant.channelUpdateError', { channel: channelKey }));
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

function applyRecommendedPrompt() {
  const text = t('settings.ai.assistant.recommendedSystemPrompt');
  if (!text || text === 'settings.ai.assistant.recommendedSystemPrompt') return;
  settings.value.system_prompt = text;
}
async function deleteRule(ruleId) {
  if (!confirm(t('settings.ai.assistant.confirmDeleteRules'))) return;
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
  return table.name || t('settings.ai.assistant.tableFallback', { id: table.id });
}

function getRuleDisplayName(rule) {
  if (!rule) return '';
  return rule.name || t('settings.ai.assistant.rulesFallback', { id: rule.id });
}
</script>

<style scoped>
.ai-assistant-settings-block {
  margin-top: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  position: relative;
  overflow-x: auto;
}

.page-with-close {
  position: relative;
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
  border: none !important;
}

.assistant-status {
  margin: var(--spacing-xl) 0;
  background: color-mix(in srgb, var(--color-secondary) 8%, white);
  border-color: color-mix(in srgb, var(--color-secondary) 25%, white);
}

.assistant-status h3 {
  margin: 0 0 var(--spacing-md);
  font-size: var(--font-size-lg);
  color: var(--color-text);
}

.assistant-status .status-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.assistant-status .status-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md) var(--spacing-lg);
}

.assistant-status .status-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.assistant-status .status-name {
  font-weight: 600;
  color: var(--color-text);
}

.assistant-status .status-value {
  font-weight: 500;
}

.assistant-status .status-enabled {
  color: var(--color-primary);
}

.assistant-status .status-disabled {
  color: var(--color-danger);
}

.status-disable {
  color: var(--color-danger);
}

.rules-row {
  margin-bottom: var(--spacing-sm);
}

.rules-row .form-control {
  flex: 1;
  min-width: 200px;
}

.prompt-actions {
  margin: var(--spacing-xs) 0 var(--spacing-sm);
}

.prompt-actions .linkish {
  background: transparent;
  border: none;
  color: var(--color-primary);
  padding: 0;
  cursor: pointer;
  font-size: var(--font-size-sm);
  text-decoration: underline;
}

.rules-json {
  background: var(--theme-bg, #fff);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
  font-size: var(--font-size-sm);
  margin-top: var(--spacing-sm);
  white-space: pre-wrap;
}

.modal-bg {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(31, 41, 55, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  min-width: 320px;
  max-width: 420px;
}

.placeholders-block {
  margin: var(--spacing-xl) 0;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
}

.placeholders-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: var(--spacing-sm);
  background: var(--color-white);
}

.placeholders-table th,
.placeholders-table td {
  border: 1px solid var(--color-border);
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-md);
}

.placeholders-table th {
  background: var(--color-light);
  font-weight: 600;
}

.empty-placeholder {
  color: var(--color-text-light);
  font-size: var(--font-size-md);
  margin: var(--spacing-md) 0;
}

.section-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-light);
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-md);
  background: transparent;
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--color-secondary);
}

.settings-section {
  margin: var(--spacing-xl) 0;
}

.settings-section h3 {
  margin-top: 0;
  margin-bottom: var(--spacing-lg);
  color: var(--color-text);
  font-size: var(--font-size-lg);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--spacing-sm);
}

.keyword-settings,
.search-weights,
.advanced-settings {
  margin: var(--spacing-md) 0;
  padding: var(--spacing-lg);
  background: var(--color-white);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.keyword-settings h4,
.search-weights h4,
.advanced-settings h4 {
  margin-top: 0;
  margin-bottom: var(--spacing-md);
  color: var(--color-text);
  font-size: var(--font-size-md);
}

.search-weights input[type="range"],
.rag-search-settings input[type="range"] {
  width: 100%;
  margin: var(--spacing-sm) 0;
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: var(--spacing-sm);
  margin: var(--spacing-sm) 0;
  font-weight: normal;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  margin: 0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
  margin: var(--spacing-md) 0;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-control--narrow {
  max-width: 200px;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .assistant-status .status-item {
    flex-direction: column;
    align-items: stretch;
  }

  .assistant-status .status-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .form-control--narrow {
    max-width: 100%;
  }
}

.model-caps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.model-caps__badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-sm, 6px);
  background: var(--color-surface-muted, #f1f5f9);
  font-size: var(--font-size-sm, 13px);
}

.accept-input {
  margin: 1rem 0 0.25rem;
  padding: 0.85rem 1rem 0.5rem;
  border: 1px solid var(--color-border, #e9ecef);
  border-radius: var(--radius-sm, 8px);
  background: var(--color-surface, #fff);
}

.accept-input legend {
  padding: 0 0.4rem;
  font-weight: 600;
  color: var(--theme-text, #222);
}

.accept-input__row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0.45rem 0;
  cursor: pointer;
  color: #334155;
}

.accept-input__row input {
  width: 16px;
  height: 16px;
}

.accept-input:disabled,
.accept-input:disabled .accept-input__row {
  cursor: not-allowed;
  opacity: 0.65;
}
</style> 