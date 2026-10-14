'use strict';

/**
 * Live AI credentials for orchestrator / listing batch.
 * Source of truth: Settings UI → ai_providers_settings (qwencloud, deepseek).
 * Env (.env) is LAB/CLI fallback only.
 */
const {
  getProviderSettings,
  getProviderModels,
} = require('./aiProviderSettingsService');

const QWEN_COMPAT_DEFAULT = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

function resolveQwenBase(baseUrl) {
  const t = String(baseUrl || '').trim();
  return t || QWEN_COMPAT_DEFAULT;
}

function resolveDeepseekBase(baseUrl) {
  const t = String(baseUrl || '').trim();
  return t || 'https://api.deepseek.com';
}

function maskKey(key) {
  const s = String(key || '');
  if (s.length < 8) return s ? '***' : null;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

/**
 * Snapshot for UI / orchestrator awareness (no raw secrets).
 */
async function getOrchCapabilitySnapshot() {
  const qwen = await getProviderSettings('qwencloud').catch(() => null);
  const deepseek = await getProviderSettings('deepseek').catch(() => null);

  let qwenModels = [];
  if (qwen?.api_key) {
    try {
      const list = await getProviderModels('qwencloud', qwen);
      qwenModels = (list || []).map((m) => String(m.id || m)).filter(Boolean).slice(0, 80);
    } catch {
      qwenModels = [];
    }
  }

  const envFallback = {
    qwen_token: Boolean(process.env.QWEN_TOKEN_API_KEY && process.env.QWEN_TOKEN_BASE_URL),
    qwen_paygo: Boolean(process.env.QWEN_PAYGO_API_KEY && process.env.QWEN_PAYGO_BASE_URL),
    deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
  };

  return {
    source: 'ai_providers_settings',
    providers: {
      qwencloud: {
        configured: Boolean(qwen?.api_key),
        base_url: qwen?.api_key ? resolveQwenBase(qwen.base_url) : null,
        selected_model: qwen?.selected_model || null,
        key_hint: qwen?.api_key ? maskKey(qwen.api_key) : null,
        models_sample: qwenModels.slice(0, 12),
        models_count: qwenModels.length,
      },
      deepseek: {
        configured: Boolean(deepseek?.api_key),
        base_url: deepseek?.api_key ? resolveDeepseekBase(deepseek.base_url) : null,
        selected_model: deepseek?.selected_model || null,
        key_hint: deepseek?.api_key ? maskKey(deepseek.api_key) : null,
      },
    },
    env_fallback: envFallback,
    image_model: process.env.QWEN_IMAGE_MODEL || null,
    chat_ready: Boolean(qwen?.api_key || deepseek?.api_key || envFallback.qwen_token || envFallback.deepseek),
    image_ready: Boolean(qwen?.api_key || envFallback.qwen_token || envFallback.qwen_paygo),
    routing: null, // filled by getRoutingTable on demand (avoid nested models.list)
  };
}

/**
 * Hydrate process.env from Settings so existing orch llm/wanImage pickProvider works.
 * Prefer Settings over empty env; do not overwrite explicit non-empty env (CLI lab).
 */
async function applyLiveProvidersToEnv({ force = false } = {}) {
  const qwen = await getProviderSettings('qwencloud').catch(() => null);
  const deepseek = await getProviderSettings('deepseek').catch(() => null);
  const applied = [];

  function setIf(key, value) {
    if (!value) return;
    if (!force && process.env[key]) return;
    process.env[key] = value;
    applied.push(key);
  }

  if (qwen?.api_key) {
    const base = resolveQwenBase(qwen.base_url);
    setIf('QWEN_TOKEN_API_KEY', qwen.api_key);
    setIf('QWEN_TOKEN_BASE_URL', base);
    if (qwen.selected_model) setIf('QWEN_CHAT_MODEL', qwen.selected_model);
    // QWEN_IMAGE_MODEL / QWEN_VIDEO_MODEL — только orchModelRouter по каталогу ключа
    if (!process.env.ORCH_VISION_PROVIDER) {
      process.env.ORCH_VISION_PROVIDER = 'qwen_token';
      applied.push('ORCH_VISION_PROVIDER');
    }
  }

  if (deepseek?.api_key) {
    setIf('DEEPSEEK_API_KEY', deepseek.api_key);
    setIf('DEEPSEEK_BASE_URL', resolveDeepseekBase(deepseek.base_url));
    if (deepseek.selected_model) setIf('DEEPSEEK_MODEL', deepseek.selected_model);
  }

  return {
    ok: Boolean(qwen?.api_key || deepseek?.api_key || process.env.QWEN_TOKEN_API_KEY),
    source: qwen?.api_key ? 'settings:qwencloud' : deepseek?.api_key ? 'settings:deepseek' : 'env',
    applied,
    snapshot: await getOrchCapabilitySnapshot(),
  };
}

/**
 * Chat completion preferring Settings qwencloud → deepseek → orch env providers.
 */
async function chatWithLive(messages, opts = {}) {
  // Lazy import avoids the module cycle: the router imports bridge helpers.
  // Model/provider fallback policy belongs only to orchModelRouter.
  const router = require('./orchModelRouter');
  const result = await router.chatForRole('brief_chat', messages, opts);
  return {
    ...result,
    provider: result.route?.provider,
  };
}

module.exports = {
  getOrchCapabilitySnapshot,
  applyLiveProvidersToEnv,
  chatWithLive,
  resolveQwenBase,
  resolveDeepseekBase,
};
