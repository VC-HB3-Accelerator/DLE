/**
 * Роутинг LLM для Live-чата: Ollama (локально) vs DeepSeek / Qwen Cloud (OpenAI-compatible API).
 * Embeddings / pgvector не трогает.
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

function isQwenRealtimeModelName(modelName) {
  const n = String(modelName || '').trim().toLowerCase();
  if (!n.startsWith('qwen')) return false;
  return n.includes('realtime');
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
  return new OpenAI({ apiKey: settings.api_key, baseURL, timeout: 180000 });
}

function createQwenCloudClient(settings) {
  if (!settings?.api_key) {
    const err = new Error('Qwen Cloud API key не настроен (Settings → AI → Qwen Cloud)');
    err.status = 400;
    err.code = 'QWENCLOUD_KEY_MISSING';
    throw err;
  }
  const baseURL = String(settings.base_url || '').trim() || QWENCLOUD_DEFAULT_BASE_URL;
  return new OpenAI({ apiKey: settings.api_key, baseURL, timeout: 180000 });
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
function cloudSafeLlmParameters(llmParameters = {}) {
  const temperature = Number.isFinite(Number(llmParameters.temperature))
    ? Number(llmParameters.temperature)
    : 0.3;
  let maxTokens = Number(llmParameters.maxTokens) > 0
    ? Number(llmParameters.maxTokens)
    : 8000;
  // Дефолт вкладки RAG/Ollama (150) обрезает cloud-ответы — не тащим в DeepSeek/Qwen.
  if (maxTokens < 256) maxTokens = 8000;
  if (maxTokens > 8000) maxTokens = 8000;
  return { temperature, maxTokens };
}

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
  const { temperature, maxTokens } = cloudSafeLlmParameters(llmParameters);

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

function lastUserTextFromMessages(messages) {
  const lastUser = [...(messages || [])].reverse().find((m) => m.role === 'user');
  if (!lastUser) return '';
  if (typeof lastUser.content === 'string') return lastUser.content;
  if (!Array.isArray(lastUser.content)) return '';
  return lastUser.content
    .filter((p) => p && (p.type === 'text' || p.text))
    .map((p) => p.text)
    .join('\n')
    .trim();
}

async function generateQwenCloudChatResponse(opts) {
  if (isQwenRealtimeModelName(opts.model)) {
    const { askQwenRealtime } = require('./qwenRealtimeService');
    const sys = (opts.messages || [])
      .filter((m) => m.role === 'system')
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    const text = await askQwenRealtime({
      settings: opts.settings,
      model: opts.model,
      instructions: sys,
      userText: lastUserTextFromMessages(opts.messages)
    });
    if (opts.returnMeta) return { text, message: { role: 'assistant', content: text } };
    return text;
  }
  const extra = {};
  if (String(opts.model || '').toLowerCase().startsWith('deepseek-v')) {
    extra.thinking = { type: 'disabled' };
  }
  const client = createQwenCloudClient(opts.settings);
  return generateOpenAiCompatibleChatResponse({
    ...opts,
    providerLabel: 'QwenCloud',
    client,
    extraPayload: { ...extra, ...(opts.extraPayload || {}) }
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
  const client = openaiProxy.createOpenAIClient(opts.settings, { timeout: 180000 });
  return generateOpenAiCompatibleChatResponse({
    ...opts,
    providerLabel: 'OpenAI',
    client
  });
}

module.exports = {
  isDeepseekModelName,
  isQwenCloudModelName,
  isQwenRealtimeModelName,
  isOpenAiModelName,
  resolveChatLlmRoute,
  cloudSafeLlmParameters,
  generateDeepseekChatResponse,
  generateQwenCloudChatResponse,
  generateOpenAiChatResponse
};
