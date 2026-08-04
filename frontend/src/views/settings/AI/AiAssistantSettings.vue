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
    <div class="ai-assistant-settings-block panel page-with-close">
      <PageCloseButton fallback="/settings/ai" />
      <h2>{{ $t('settings.ai.assistant.pageTitle') }}</h2>
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
                :disabled="channelStatusLoading[channel.key] || settings.enabled_channels?.[channel.key]"
                @click="setChannelStatus(channel.key, true)"
              >
                {{ $t('settings.ai.assistant.enable') }}
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-sm status-disable"
                :disabled="channelStatusLoading[channel.key] || !settings.enabled_channels?.[channel.key]"
                @click="setChannelStatus(channel.key, false)"
              >
                {{ $t('settings.ai.assistant.disable') }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="ai-assistant-settings settings-panel">
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
          <!-- Настройки Ollama (инфраструктура) -->
          <div class="ollama-settings settings-section panel">
            <h3>{{ $t('settings.ai.assistant.ollamaInfra') }}</h3>
            <p class="section-description">{{ $t('settings.ai.assistant.ollamaInfraDesc') }}</p>
            
            <div class="form-group">
              <label class="form-label">{{ $t('settings.ai.assistant.ollamaBaseUrl') }}</label>
              <input type="text" v-model="ollamaConfig.baseUrl" class="form-control" placeholder="http://ollama:11434" />
              <small class="form-hint">{{ $t('settings.ai.assistant.ollamaBaseUrlHelp') }}</small>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">{{ $t('settings.ai.assistant.llmModelDefault') }}</label>
                <input type="text" v-model="ollamaConfig.llmModel" class="form-control" placeholder="qwen2.5:1.5b" />
                <small class="form-hint">{{ $t('settings.ai.assistant.llmModelDefaultHelp') }}</small>
              </div>
              <div class="form-group">
                <label class="form-label">{{ $t('settings.ai.assistant.embeddingModelDefault') }}</label>
                <input type="text" v-model="ollamaConfig.embeddingModel" class="form-control" placeholder="mxbai-embed-large:latest" />
                <small class="form-hint">{{ $t('settings.ai.assistant.embeddingModelDefaultHelp') }}</small>
              </div>
            </div>
          </div>

          <!-- Настройки Vector Search -->
          <div class="vector-search-settings settings-section panel">
            <h3>{{ $t('settings.ai.assistant.vectorSearchTitle') }}</h3>
            
            <div class="form-group">
              <label class="form-label">{{ $t('settings.ai.assistant.vectorSearchUrl') }}</label>
              <input type="text" v-model="vectorSearchConfig.url" class="form-control" placeholder="http://vector-search:8001" />
              <small class="form-hint">{{ $t('settings.ai.assistant.vectorSearchUrlHelp') }}</small>
            </div>
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
          
          <!-- Настройки RAG поиска -->
          <div class="rag-search-settings settings-section panel">
            <h3>{{ $t('settings.ai.assistant.ragSearchTitle') }}</h3>
            
            <!-- Порог расстояния (threshold) -->
            <label class="form-label">{{ $t('settings.ai.assistant.ragThreshold') }}</label>
            <input type="number" v-model.number="ragSettings.threshold" class="form-control form-control--narrow" min="0" max="1000" step="10" />
            <small class="form-hint">{{ $t('settings.ai.assistant.ragThresholdHelp') }}</small>
            
            <!-- Метод поиска -->
            <label class="form-label">{{ $t('settings.ai.assistant.searchMethod') }}</label>
            <select v-model="ragSettings.searchMethod" class="form-control">
              <option value="semantic">{{ $t('settings.ai.assistant.searchSemantic') }}</option>
              <option value="keyword">{{ $t('settings.ai.assistant.searchKeyword') }}</option>
              <option value="hybrid">{{ $t('settings.ai.assistant.searchHybrid') }}</option>
            </select>
            
            <!-- Количество результатов -->
            <label class="form-label">{{ $t('settings.ai.assistant.maxResults') }}</label>
            <input type="number" v-model.number="ragSettings.maxResults" class="form-control form-control--narrow" min="1" max="20" />
            
            <!-- Порог релевантности -->
            <label class="form-label">{{ $t('settings.ai.assistant.relevanceThreshold', { value: ragSettings.relevanceThreshold }) }}</label>
            <input type="range" v-model.number="ragSettings.relevanceThreshold" 
                   min="0.01" max="1.0" step="0.01" />
            
            <!-- Настройки извлечения ключевых слов -->
            <div class="keyword-settings">
              <h4>{{ $t('settings.ai.assistant.keywordExtraction') }}</h4>
              <label class="checkbox-label">
                <input type="checkbox" v-model="ragSettings.keywordExtraction.enabled" />
                {{ $t('settings.ai.assistant.enableKeywordExtraction') }}
              </label>
              
              <label class="form-label">{{ $t('settings.ai.assistant.minWordLength') }}</label>
              <input type="number" v-model="ragSettings.keywordExtraction.minWordLength" class="form-control form-control--narrow"
                     min="2" max="10" />
              
              <label class="form-label">{{ $t('settings.ai.assistant.maxKeywords') }}</label>
              <input type="number" v-model="ragSettings.keywordExtraction.maxKeywords" class="form-control form-control--narrow"
                     min="5" max="20" />
              
              <label class="checkbox-label">
                <input type="checkbox" v-model="ragSettings.keywordExtraction.removeStopWords" />
                {{ $t('settings.ai.assistant.removeStopWords') }}
              </label>
            </div>
            
            <!-- Веса для гибридного поиска -->
            <div v-if="ragSettings.searchMethod === 'hybrid'" class="search-weights">
              <h4>{{ $t('settings.ai.assistant.searchWeights') }}</h4>
              <label class="form-label">{{ $t('settings.ai.assistant.semanticWeight', { value: ragSettings.searchWeights.semantic }) }}</label>
              <input type="range" v-model="ragSettings.searchWeights.semantic" 
                     min="0" max="100" />
              
              <label class="form-label">{{ $t('settings.ai.assistant.keywordWeight', { value: ragSettings.searchWeights.keyword }) }}</label>
              <input type="range" v-model="ragSettings.searchWeights.keyword" 
                     min="0" max="100" />
            </div>
            
            <!-- Дополнительные настройки -->
            <div class="advanced-settings">
              <h4>{{ $t('settings.ai.assistant.advancedSettings') }}</h4>
              <label class="checkbox-label">
                <input type="checkbox" v-model="ragSettings.advanced.enableFuzzySearch" />
                {{ $t('settings.ai.assistant.fuzzySearch') }}
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="ragSettings.advanced.enableStemming" />
                {{ $t('settings.ai.assistant.stemming') }}
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="ragSettings.advanced.enableSynonyms" />
                {{ $t('settings.ai.assistant.synonyms') }}
              </label>
            </div>
          </div>

          <!-- Настройки LLM параметров -->
          <div class="llm-parameters-settings settings-section panel">
            <h3>{{ $t('settings.ai.assistant.llmParamsTitle') }}</h3>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">{{ $t('settings.ai.assistant.temperature') }}</label>
                <input type="number" v-model.number="llmParameters.temperature" class="form-control form-control--narrow" min="0" max="2" step="0.1" />
                <small class="form-hint">{{ $t('settings.ai.assistant.temperatureHelp') }}</small>
              </div>
              <div class="form-group">
                <label class="form-label">{{ $t('settings.ai.assistant.maxTokens') }}</label>
                <input type="number" v-model.number="llmParameters.maxTokens" class="form-control form-control--narrow" min="1" max="4000" />
                <small class="form-hint">{{ $t('settings.ai.assistant.maxTokensHelp') }}</small>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">{{ $t('settings.ai.assistant.topP') }}</label>
                <input type="number" v-model.number="llmParameters.top_p" class="form-control form-control--narrow" min="0" max="1" step="0.01" />
                <small class="form-hint">{{ $t('settings.ai.assistant.topPHelp') }}</small>
              </div>
              <div class="form-group">
                <label class="form-label">{{ $t('settings.ai.assistant.topK') }}</label>
                <input type="number" v-model.number="llmParameters.top_k" class="form-control form-control--narrow" min="1" max="100" />
                <small class="form-hint">{{ $t('settings.ai.assistant.topKHelp') }}</small>
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">{{ $t('settings.ai.assistant.repeatPenalty') }}</label>
              <input type="number" v-model.number="llmParameters.repeat_penalty" class="form-control form-control--narrow" min="1.0" max="2.0" step="0.1" />
              <small class="form-hint">{{ $t('settings.ai.assistant.repeatPenaltyHelp') }}</small>
            </div>
          </div>

          <!-- Настройки Qwen -->
          <div class="qwen-parameters-settings settings-section panel">
            <h3>{{ $t('settings.ai.assistant.qwenParamsTitle') }}</h3>
            
            <div class="form-group">
              <label class="form-label">{{ $t('settings.ai.assistant.format') }}</label>
              <select v-model="qwenParameters.format" class="form-control">
                <option :value="null">{{ $t('settings.ai.assistant.formatAuto') }}</option>
                <option value="json">{{ $t('settings.ai.assistant.formatJson') }}</option>
              </select>
              <small class="form-hint">{{ $t('settings.ai.assistant.formatHelp') }}</small>
            </div>
          </div>

          <!-- Настройки Embedding -->
          <div class="embedding-parameters-settings settings-section panel">
            <h3>{{ $t('settings.ai.assistant.embeddingParamsTitle') }}</h3>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">{{ $t('settings.ai.assistant.batchSize') }}</label>
                <input type="number" v-model.number="embeddingParameters.batch_size" class="form-control form-control--narrow" min="1" max="128" />
                <small class="form-hint">{{ $t('settings.ai.assistant.batchSizeHelp') }}</small>
              </div>
              <div class="form-group">
                <label class="form-label">{{ $t('settings.ai.assistant.dimension') }}</label>
                <input type="number" v-model.number="embeddingParameters.dimension" class="form-control form-control--narrow" min="0" :placeholder="$t('settings.ai.assistant.dimensionPlaceholder')" />
                <small class="form-hint">{{ $t('settings.ai.assistant.dimensionHelp') }}</small>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">{{ $t('settings.ai.assistant.pooling') }}</label>
                <select v-model="embeddingParameters.pooling" class="form-control">
                  <option value="mean">{{ $t('settings.ai.assistant.poolingMean') }}</option>
                  <option value="max">{{ $t('settings.ai.assistant.poolingMax') }}</option>
                  <option value="cls">{{ $t('settings.ai.assistant.poolingCls') }}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="embeddingParameters.normalize" />
                  {{ $t('settings.ai.assistant.normalizeVectors') }}
                </label>
              </div>
            </div>
          </div>

          <!-- Настройки кэша -->
          <div class="cache-settings settings-section panel">
            <h3>{{ $t('settings.ai.assistant.cacheTitle') }}</h3>
            
            <label class="checkbox-label">
              <input type="checkbox" v-model="cacheSettings.enabled" />
              {{ $t('settings.ai.assistant.enableCache') }}
            </label>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">{{ $t('settings.ai.assistant.llmTtl') }}</label>
                <input type="number" v-model.number="cacheSettings.llmTTL" class="form-control form-control--narrow" min="0" step="1000" />
                <small class="form-hint">{{ $t('settings.ai.assistant.llmTtlHelp') }}</small>
              </div>
              <div class="form-group">
                <label class="form-label">{{ $t('settings.ai.assistant.ragTtl') }}</label>
                <input type="number" v-model.number="cacheSettings.ragTTL" class="form-control form-control--narrow" min="0" step="1000" />
                <small class="form-hint">{{ $t('settings.ai.assistant.ragTtlHelp') }}</small>
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">{{ $t('settings.ai.assistant.cacheMaxSize') }}</label>
              <input type="number" v-model.number="cacheSettings.maxSize" class="form-control form-control--narrow" min="1" max="10000" />
              <small class="form-hint">{{ $t('settings.ai.assistant.cacheMaxSizeHelp') }}</small>
            </div>
          </div>

          <!-- Настройки очереди -->
          <div class="queue-settings settings-section panel">
            <h3>{{ $t('settings.ai.assistant.queueTitle') }}</h3>
            
            <label class="checkbox-label">
              <input type="checkbox" v-model="queueSettings.enabled" />
              {{ $t('settings.ai.assistant.enableQueue') }}
            </label>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">{{ $t('settings.ai.assistant.queueTimeout') }}</label>
                <input type="number" v-model.number="queueSettings.timeout" class="form-control form-control--narrow" min="1000" step="1000" />
                <small class="form-hint">{{ $t('settings.ai.assistant.queueTimeoutHelp') }}</small>
              </div>
              <div class="form-group">
                <label class="form-label">{{ $t('settings.ai.assistant.queueMaxSize') }}</label>
                <input type="number" v-model.number="queueSettings.maxSize" class="form-control form-control--narrow" min="1" max="1000" />
                <small class="form-hint">{{ $t('settings.ai.assistant.queueMaxSizeHelp') }}</small>
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">{{ $t('settings.ai.assistant.queueInterval') }}</label>
              <input type="number" v-model.number="queueSettings.interval" class="form-control form-control--narrow" min="10" step="10" />
              <small class="form-hint">{{ $t('settings.ai.assistant.queueIntervalHelp') }}</small>
            </div>
          </div>

          <!-- Настройки дедупликации -->
          <div class="deduplication-settings settings-section panel">
            <h3>{{ $t('settings.ai.assistant.dedupTitle') }}</h3>
            
            <label class="checkbox-label">
              <input type="checkbox" v-model="deduplicationSettings.enabled" />
              {{ $t('settings.ai.assistant.enableDedup') }}
            </label>
            
            <div class="form-group">
              <label class="form-label">{{ $t('settings.ai.assistant.dedupTtl') }}</label>
              <input type="number" v-model.number="deduplicationSettings.ttl" class="form-control form-control--narrow" min="1000" step="1000" />
              <small class="form-hint">{{ $t('settings.ai.assistant.dedupTtlHelp') }}</small>
            </div>
          </div>

          <!-- Настройки RAG поведения -->
          <div class="rag-behavior-settings settings-section panel">
            <h3>{{ $t('settings.ai.assistant.ragBehaviorTitle') }}</h3>
            
            <label class="checkbox-label">
              <input type="checkbox" v-model="ragBehavior.upsertOnQuery" />
              {{ $t('settings.ai.assistant.upsertOnQuery') }}
            </label>
            
            <label class="checkbox-label">
              <input type="checkbox" v-model="ragBehavior.autoIndexOnTableChange" />
              {{ $t('settings.ai.assistant.autoIndexOnChange') }}
            </label>
          </div>

          <!-- Настройки таймаутов -->
          <div class="timeouts-settings settings-section panel">
            <h3>{{ $t('settings.ai.assistant.timeoutsTitle') }}</h3>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">{{ $t('settings.ai.assistant.timeoutOllamaChat') }}</label>
                <input type="number" v-model.number="timeouts.ollamaChat" class="form-control form-control--narrow" min="1000" step="1000" />
                <small class="form-hint">{{ $t('settings.ai.assistant.timeoutOllamaChatHelp') }}</small>
              </div>
              <div class="form-group">
                <label class="form-label">{{ $t('settings.ai.assistant.timeoutOllamaEmbedding') }}</label>
                <input type="number" v-model.number="timeouts.ollamaEmbedding" class="form-control form-control--narrow" min="1000" step="1000" />
                <small class="form-hint">{{ $t('settings.ai.assistant.timeoutOllamaEmbeddingHelp') }}</small>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">{{ $t('settings.ai.assistant.timeoutVectorSearch') }}</label>
                <input type="number" v-model.number="timeouts.vectorSearch" class="form-control form-control--narrow" min="1000" step="1000" />
                <small class="form-hint">{{ $t('settings.ai.assistant.timeoutVectorSearchHelp') }}</small>
              </div>
              <div class="form-group">
                <label class="form-label">{{ $t('settings.ai.assistant.timeoutVectorUpsert') }}</label>
                <input type="number" v-model.number="timeouts.vectorUpsert" class="form-control form-control--narrow" min="1000" step="1000" />
                <small class="form-hint">{{ $t('settings.ai.assistant.timeoutVectorUpsertHelp') }}</small>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">{{ $t('settings.ai.assistant.timeoutVectorHealth') }}</label>
                <input type="number" v-model.number="timeouts.vectorHealth" class="form-control form-control--narrow" min="1000" step="1000" />
                <small class="form-hint">{{ $t('settings.ai.assistant.timeoutVectorHealthHelp') }}</small>
              </div>
              <div class="form-group">
                <label class="form-label">{{ $t('settings.ai.assistant.timeoutOllamaHealth') }}</label>
                <input type="number" v-model.number="timeouts.ollamaHealth" class="form-control form-control--narrow" min="1000" step="1000" />
                <small class="form-hint">{{ $t('settings.ai.assistant.timeoutOllamaHealthHelp') }}</small>
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">{{ $t('settings.ai.assistant.timeoutOllamaTags') }}</label>
              <input type="number" v-model.number="timeouts.ollamaTags" class="form-control form-control--narrow" min="1000" step="1000" />
              <small class="form-hint">{{ $t('settings.ai.assistant.timeoutOllamaTagsHelp') }}</small>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">{{ $t('common.save') }}</button>
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
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import BaseLayout from '@/components/BaseLayout.vue';
import { useRouter } from 'vue-router';
import { ref, onMounted, computed, onBeforeUnmount } from 'vue';
import axios from 'axios';
import RuleEditor from '@/components/ai-assistant/RuleEditor.vue';
import SystemMonitoring from '@/components/ai-assistant/SystemMonitoring.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
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
  llmModel: 'qwen2.5:1.5b',
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
  background: var(--color-light);
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
  background: var(--color-light);
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
  background: var(--color-light);
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
</style> 