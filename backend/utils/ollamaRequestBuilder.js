/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

/**
 * Ollama Request Builder
 * Утилита для формирования тела запроса к Ollama API
 * Устраняет дублирование кода между ragService.js и ai-queue.js
 */

/**
 * Построить тело запроса для Ollama API
 * @param {Object} options - Опции запроса
 * @param {Array} options.messages - Массив сообщений для LLM
 * @param {string} options.model - Название модели (опционально, будет использован дефолтный)
 * @param {Object} options.llmParameters - Параметры LLM (temperature, maxTokens, top_p, top_k, repeat_penalty)
 * @param {Object} options.qwenParameters - Специфичные параметры qwen (format)
 * @param {string} options.defaultModel - Дефолтная модель (если model не указан)
 * @param {Array} options.tools - Массив определений функций для function calling (опционально)
 * @param {string} options.tool_choice - Выбор функции ("auto", "none", или конкретная функция) (опционально)
 * @param {boolean} options.stream - Потоковая передача (по умолчанию false)
 * @returns {Object} Тело запроса для Ollama API
 */
function buildOllamaRequest(options = {}) {
  const {
    messages,
    model,
    llmParameters,
    qwenParameters,
    defaultModel,
    tools = null,
    tool_choice = null,
    stream = false
  } = options;

  if (!messages || !Array.isArray(messages)) {
    throw new Error('messages обязателен и должен быть массивом');
  }

  if (!llmParameters) {
    throw new Error('llmParameters обязателен');
  }

  // Формируем базовое тело запроса
  const requestBody = {
    model: model || defaultModel,
    messages: messages,
    stream: stream,
    // Общие параметры LLM
    temperature: llmParameters.temperature,
    num_predict: llmParameters.maxTokens, // Ollama использует num_predict вместо maxTokens
    top_p: llmParameters.top_p,
    top_k: llmParameters.top_k,
    repeat_penalty: llmParameters.repeat_penalty
  };

  // Добавляем специфичные параметры qwen (если они заданы)
  if (qwenParameters && qwenParameters.format !== null && qwenParameters.format !== undefined) {
    requestBody.format = qwenParameters.format;
  }

  // Добавляем tools для function calling (если переданы)
  if (tools && Array.isArray(tools) && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = tool_choice || "auto";
  }

  return requestBody;
}

module.exports = {
  buildOllamaRequest
};

