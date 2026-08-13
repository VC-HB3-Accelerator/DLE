/**
 * Роутинг LLM для Live-чата: Ollama (локально) vs DeepSeek / Qwen Cloud (OpenAI-compatible API).
 * Embeddings / vector-search не трогает.
 */

const OpenAI = require('openai');
const logger = require('../utils/logger');
const { getProviderSettings } = require('./aiProviderSettingsService');

const DEEPSEEK_DEFAULT_BASE_URL = 'https://api.deepseek.com';
const QWENCLOUD_DEFAULT_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

function isDeepseekModelName(modelName) {
  const name = String(modelName || '').trim().toLowerCase();
  return name.startsWith('deepseek');
}

/**
 * Cloud Qwen (DashScope): qwen-plus, qwen-max, qwen3.5-plus и т.п.
 * Локальный Ollama обычно с тегом `name:tag` (двоеточие) — его сюда не пускаем.
 */
function isQwenCloudModelName(modelName) {
  const name = String(modelName || '').trim().toLowerCase();
  if (!name || name.includes(':')) return false;
  return name.startsWith('qwen') || name.startsWith('qwq');
}

function isOpenAiModelName(modelName) {
  const name = String(modelName || '').trim().toLowerCase();
  return name.startsWith('gpt-') || name.startsWith('o1') || name.startsWith('o3') || name.startsWith('o4');
}

/**
 * @param {string|null|undefined} modelName
 * @returns {Promise<{ provider: 'deepseek'|'qwencloud'|'ollama', model: string|null, settings?: object }>}
 */
async function resolveChatLlmRoute(modelName) {
  const model = String(modelName || '').trim() || null;
  if (!model) {
    return { provider: 'ollama', model: null };
  }
  if (isDeepseekModelName(model)) {
    const settings = await getProviderSettings('deepseek');
    return { provider: 'deepseek', model, settings };
  }
  if (isQwenCloudModelName(model)) {
    const settings = await getProviderSettings('qwencloud');
    return { provider: 'qwencloud', model, settings };
  }
  if (isOpenAiModelName(model)) {
    const settings = await getProviderSettings('openai');
    return { provider: 'openai', model, settings };
  }
  return { provider: 'ollama', model };
}

function createDeepseekClient(settings) {
  if (!settings?.api_key) {
    const err = new Error('DeepSeek API key не настроен (Settings → AI → DeepSeek)');
    err.status = 400;
    err.code = 'DEEPSEEK_KEY_MISSING';
    throw err;
  }
  const baseURL = String(settings.base_url || '').trim() || DEEPSEEK_DEFAULT_BASE_URL;
  return new OpenAI({ apiKey: settings.api_key, baseURL });
}

function createQwenCloudClient(settings) {
  if (!settings?.api_key) {
    const err = new Error('Qwen Cloud API key не настроен (Settings → AI → Qwen Cloud)');
    err.status = 400;
    err.code = 'QWENCLOUD_KEY_MISSING';
    throw err;
  }
  const baseURL = String(settings.base_url || '').trim() || QWENCLOUD_DEFAULT_BASE_URL;
  return new OpenAI({ apiKey: settings.api_key, baseURL });
}

function normalizeToolCallForExecute(toolCall) {
  const fn = toolCall?.function || {};
  let args = fn.arguments;
  if (typeof args === 'string') {
    try {
      args = args.trim() ? JSON.parse(args) : {};
    } catch (_) {
      args = {};
    }
  }
  return {
    id: toolCall.id,
    type: toolCall.type || 'function',
    function: {
      name: fn.name,
      arguments: args && typeof args === 'object' ? args : {}
    }
  };
}

function toOpenAiToolMessage(toolCall, result) {
  const content = typeof result === 'string' ? result : JSON.stringify(result ?? null);
  return {
    role: 'tool',
    tool_call_id: toolCall.id,
    content
  };
}

/**
 * Один/два раунда chat.completions для OpenAI-compatible cloud (DeepSeek / Qwen Cloud).
 * @returns {Promise<string>}
 */
async function generateOpenAiCompatibleChatResponse({
  providerLabel,
  client,
  messages,
  model,
  tools = null,
  tool_choice = 'auto',
  llmParameters = {},
  userId = null,
  executeToolCall,
  extraPayload = {},
  returnMeta = false
}) {
  const temperature = Number.isFinite(Number(llmParameters.temperature))
    ? Number(llmParameters.temperature)
    : 0.3;
  const maxTokens = Number(llmParameters.maxTokens) > 0
    ? Number(llmParameters.maxTokens)
    : 800;

  const basePayload = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    ...extraPayload
  };

  if (tools && Array.isArray(tools) && tools.length > 0) {
    basePayload.tools = tools;
    basePayload.tool_choice = tool_choice || 'auto';
  }

  logger.info(`[chatLlmRouter] ${providerLabel} chat model=${model} messages=${messages.length} tools=${tools ? tools.length : 0}`);

  const first = await client.chat.completions.create(basePayload);
  const firstMsg = first.choices?.[0]?.message || {};
  const toolCalls = firstMsg.tool_calls;

  if (toolCalls && toolCalls.length > 0 && typeof executeToolCall === 'function' && userId) {
    logger.info(`[chatLlmRouter] ${providerLabel} tool_calls: ${toolCalls.length}`);
    const toolResults = [];
    for (const tc of toolCalls) {
      const normalized = normalizeToolCallForExecute(tc);
      const result = await executeToolCall(normalized, userId);
      toolResults.push(toOpenAiToolMessage(tc, result));
    }

    const followMessages = [
      ...messages,
      {
        role: 'assistant',
        content: firstMsg.content || null,
        tool_calls: toolCalls
      },
      ...toolResults
    ];

    const second = await client.chat.completions.create({
      model,
      messages: followMessages,
      temperature,
      max_tokens: maxTokens,
      ...extraPayload
    });
    const secondMsg = second.choices?.[0]?.message || {};
    if (returnMeta) return { text: secondMsg.content || '', message: secondMsg };
    return secondMsg.content || '';
  }

  if (returnMeta) return { text: firstMsg.content || '', message: firstMsg };
  return firstMsg.content || '';
}

/**
 * DeepSeek: thinking выключен — иначе пустой content на V4.
 */
async function generateDeepseekChatResponse(opts) {
  const client = createDeepseekClient(opts.settings);
  return generateOpenAiCompatibleChatResponse({
    ...opts,
    providerLabel: 'DeepSeek',
    client,
    extraPayload: { thinking: { type: 'disabled' }, ...(opts.extraPayload || {}) }
  });
}

async function generateQwenCloudChatResponse(opts) {
  const client = createQwenCloudClient(opts.settings);
  return generateOpenAiCompatibleChatResponse({
    ...opts,
    providerLabel: 'QwenCloud',
    client
  });
}

async function generateOpenAiChatResponse(opts) {
  const openaiProxy = require('./openaiProxy');
  if (!opts.settings?.api_key) {
    const err = new Error('OpenAI API key не настроен (Settings → AI → OpenAI)');
    err.status = 400;
    err.code = 'OPENAI_KEY_MISSING';
    throw err;
  }
  const client = openaiProxy.createOpenAIClient(opts.settings, { timeout: 120000 });
  return generateOpenAiCompatibleChatResponse({
    ...opts,
    providerLabel: 'OpenAI',
    client
  });
}

module.exports = {
  isDeepseekModelName,
  isQwenCloudModelName,
  isOpenAiModelName,
  resolveChatLlmRoute,
  generateDeepseekChatResponse,
  generateQwenCloudChatResponse,
  generateOpenAiChatResponse
};
