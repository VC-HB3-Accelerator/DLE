'use strict';

const observations = require('./orchCapabilityObservations');

const DISCOVERY_TTL_MS = Math.max(
  60_000,
  Number(process.env.ORCH_DISCOVERY_TTL_MS) || 5 * 60_000
);

function qwenKeyType(baseUrl) {
  let hostname = '';
  try {
    hostname = new URL(String(baseUrl || '')).hostname.toLowerCase();
  } catch {
    return 'unknown';
  }
  if (hostname.startsWith('token-plan.')) return 'qwen_token';
  if (hostname.includes('dashscope') || hostname === 'maas.qwencloudapi.com') {
    return 'qwen_paygo';
  }
  return 'unknown';
}

function qwenConnection(settings = {}) {
  const baseUrl = observations.normalizeBaseUrl(settings.base_url);
  const keyType = qwenKeyType(baseUrl);
  return {
    connectionId: `settings:qwencloud:${settings.id || 'default'}`,
    provider: 'qwencloud',
    keyType,
    baseUrl,
    credentialFingerprint: observations.fingerprintCredential({
      apiKey: settings.api_key,
      keyType,
      baseUrl,
    }),
  };
}

function discoveryPlan(connection) {
  if (connection?.keyType === 'qwen_token') {
    return {
      status: 'enabled',
      models: 'compatible_models',
      quotas: 'unsupported',
    };
  }
  if (connection?.keyType === 'qwen_paygo') {
    return {
      status: 'enabled',
      models: 'native_models',
      quotas: 'native_quotas',
    };
  }
  return {
    status: 'blocked',
    reason: 'unknown_key_type',
    models: 'none',
    quotas: 'none',
  };
}

async function persistDiscovery(connection, models, details = {}) {
  const expiresAt = new Date(Date.now() + DISCOVERY_TTL_MS);
  await observations.recordObservation({
    ...connection,
    endpoint: details.endpoint || 'compatible:/models',
    model: '',
    capability: 'catalog',
    outcome: models.length ? 'discovered' : 'catalog_empty',
    latencyMs: details.latencyMs,
    metadata: { model_count: models.length, models, quotas: details.quotas || null },
    expiresAt,
  });
}

function nativeDashscopeOrigin(baseUrl) {
  try {
    const url = new URL(observations.normalizeBaseUrl(baseUrl));
    if (url.hostname.startsWith('token-plan.')) {
      return null;
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

async function fetchNativeQwenCatalog(settings, { capabilities = 'IG,VG,VU' } = {}) {
  const axios = require('axios');
  const origin = nativeDashscopeOrigin(settings.base_url);
  if (!origin) {
    const error = new Error('native catalog is not available for this key type');
    error.code = 'NATIVE_CATALOG_UNSUPPORTED';
    throw error;
  }
  const { data, status } = await axios.get(`${origin}/api/v1/models`, {
    headers: { Authorization: `Bearer ${settings.api_key}` },
    params: { capabilities },
    timeout: 15000,
    validateStatus: () => true,
  });
  if (status >= 400) {
    const error = new Error(data?.message || `native /models HTTP ${status}`);
    error.status = status;
    error.code = data?.code || 'NATIVE_MODELS_HTTP';
    throw error;
  }
  const list = data?.data || data?.models || [];
  return list.map((model) => ({
    id: model.id || model.model_id || model.name,
    capabilities: model.capabilities || model.capability || [],
  })).filter((model) => model.id);
}

async function fetchNativeQwenQuotas(settings) {
  const axios = require('axios');
  const origin = nativeDashscopeOrigin(settings.base_url);
  if (!origin) return { supported: false, quotas: [] };
  const { data, status } = await axios.get(`${origin}/api/v1/quotas`, {
    headers: { Authorization: `Bearer ${settings.api_key}` },
    timeout: 15000,
    validateStatus: () => true,
  });
  if (status >= 400) {
    return {
      supported: true,
      ok: false,
      status,
      code: data?.code || null,
      note: 'quotas are rate/entitlement, not remaining credits',
    };
  }
  return {
    supported: true,
    ok: true,
    quotas: data?.data || data?.quotas || data,
    note: 'quotas are rate/entitlement, not remaining credits',
  };
}

async function discoverQwenConnection(settings, { listModels, listNativeModels, listQuotas } = {}) {
  const connection = qwenConnection(settings);
  const plan = discoveryPlan(connection);
  if (plan.status !== 'enabled') {
    return {
      connection,
      plan,
      models: [],
      persisted: false,
    };
  }
  const listFn = plan.models === 'native_models'
    ? (listNativeModels || listModels)
    : listModels;
  if (typeof listFn !== 'function') {
    throw new Error('discoverQwenConnection requires listModels');
  }

  const started = Date.now();
  const listed = await listFn();
  const liveModels = [...new Set(
    (listed || []).map((model) => String(model?.id || model || '').trim()).filter(Boolean)
  )];
  let persisted = true;
  let persistenceError = null;
  let observedModels = [];
  try {
    observedModels = await observations.listFreshModelIds({
      connectionId: connection.connectionId,
      credentialFingerprint: connection.credentialFingerprint,
      limit: 200,
    });
  } catch (error) {
    persisted = false;
    persistenceError = error.message;
  }
  const observedSet = new Set(observedModels);
  const newModels = liveModels.filter((model) => !observedSet.has(model));
  try {
    if (newModels.length || (!liveModels.length && !observedModels.length)) {
      let quotas = null;
      if (plan.quotas === 'native_quotas' && typeof listQuotas === 'function') {
        quotas = await listQuotas().catch((error) => ({ ok: false, error: error.message }));
      }
      await persistDiscovery(connection, liveModels, {
        latencyMs: Date.now() - started,
        endpoint: plan.models === 'native_models' ? 'native:/api/v1/models' : 'compatible:/models',
        quotas,
      });
    }
  } catch (error) {
    persisted = false;
    persistenceError = persistenceError || error.message;
  }

  return {
    connection,
    plan,
    models: [...new Set([...liveModels, ...observedModels])],
    liveModels,
    observedModels,
    persisted,
    persistenceError,
  };
}

const TOKEN_PLAN_GATEWAY = 'https://cs-data.qwencloud.com/data/api.json';
const TOKEN_PLAN_MODEL_LIST_API = 'zeldaEasy.bmp.bmpTokenPlanServcie.modelIdList';
const TOKEN_PLAN_FOUNDATION_API = 'zeldaHttp.dashscopeModel./zelda/api/v1/modelCenter/listFoundationModels';

const TOKEN_PLAN_CAPABILITY_LABELS = {
  TG: 'Text Generation',
  ASR: 'Speech Recognition',
  TTS: 'Text-to-Speech',
  IU: 'Image Understanding',
  VU: 'Visual Understanding',
  IG: 'Image Generation',
  VG: 'Video Generation',
  IP: 'Image Processing',
  TR: 'Embedding',
  ME: 'Multimodal Embedding',
  RK: 'Reranking',
  AU: 'Audio Understanding',
  OMNI: 'Omni',
  Reasoning: 'Reasoning Model',
  QwQ: 'Reasoning Model',
  'Realtime-Text-to-Speech': 'Real-Time Speech Synthesis',
  'Realtime-Omni': 'Realtime Omni',
  'Realtime-Voice-Replication': 'Realtime Voice Replication',
  'Multimodal-Omni': 'Omni',
  'Realtime-ASR': 'Realtime ASR',
  'Realtime-Audio-Translate': 'Realtime Audio Translate',
};

const TOKEN_PLAN_CAP_RANK = { TG: 0, Reasoning: 1, VU: 2 };
const TOKEN_PLAN_BRAND_RANK = { qwen: 0, wanx: 1, happyhorse: 2, deepseek: 3, zhipu: 4 };
const TOKEN_PLAN_PROVIDER_BRAND = {
  qwen: 'qwen',
  wan: 'wanx',
  wanx: 'wanx',
  happyhorse: 'happyhorse',
  deepseek: 'deepseek',
  'zhipu-ai': 'zhipu',
  zhipu: 'zhipu',
};

let tokenPlanCatalogCache = { at: 0, edition: '', models: null };

function tokenPlanCornerstone() {
  return {
    domain: 'home.qwencloud.com',
    consoleSite: 'QWENCLOUD',
    console: 'ONE_CONSOLE',
    xsp_lang: 'en-US',
    protocol: 'V2',
    productCode: 'p_efm',
  };
}

async function callTokenPlanGateway(api, data) {
  const axios = require('axios');
  const params = {
    Api: api,
    Data: { ...data, cornerstoneParam: tokenPlanCornerstone() },
    V: '1.0',
  };
  const body = new URLSearchParams({
    product: 'sfm_bailian',
    action: 'IntlBroadScopeAspnGateway',
    sec_token: '',
    region: 'ap-southeast-1',
    params: JSON.stringify(params),
  }).toString();
  const response = await axios.post(TOKEN_PLAN_GATEWAY, body, {
    params: {
      product: 'sfm_bailian',
      action: 'IntlBroadScopeAspnGateway',
      api,
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: 'https://home.qwencloud.com',
      Referer: 'https://home.qwencloud.com/analytics/token-plan/individual',
    },
    timeout: 20000,
    validateStatus: () => true,
  });
  if (response.status >= 400) {
    const error = new Error(`token plan catalog HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const inner = response.data?.data?.DataV2?.data;
  if (!inner || inner.success === false) {
    const error = new Error(inner?.message || response.data?.data?.errorMsg || 'token plan catalog failed');
    error.code = inner?.code || response.data?.data?.errorCode || 'TOKEN_PLAN_CATALOG';
    throw error;
  }
  return inner.data;
}

function tokenPlanCapabilityLabel(codes) {
  const list = Array.isArray(codes) ? codes.filter(Boolean) : [];
  const order = new Map(list.map((code, index) => [code, index]));
  return [...list]
    .sort((a, b) => {
      const rankA = TOKEN_PLAN_CAP_RANK[a] ?? 100;
      const rankB = TOKEN_PLAN_CAP_RANK[b] ?? 100;
      if (rankA !== rankB) return rankA - rankB;
      return (order.get(a) ?? 0) - (order.get(b) ?? 0);
    })
    .map((code) => TOKEN_PLAN_CAPABILITY_LABELS[code] || code)
    .join(', ');
}

async function fetchTokenPlanCatalog({ edition = 'PERSONAL' } = {}) {
  const now = Date.now();
  if (
    tokenPlanCatalogCache.models
    && tokenPlanCatalogCache.edition === edition
    && now - tokenPlanCatalogCache.at < DISCOVERY_TTL_MS
  ) {
    return tokenPlanCatalogCache.models.map((model) => ({ ...model }));
  }
  const ids = await callTokenPlanGateway(TOKEN_PLAN_MODEL_LIST_API, { edition });
  if (!Array.isArray(ids) || !ids.length) {
    const error = new Error('token plan model list is empty');
    error.code = 'TOKEN_PLAN_CATALOG_EMPTY';
    throw error;
  }
  const meta = new Map();
  try {
    const page = await callTokenPlanGateway(TOKEN_PLAN_FOUNDATION_API, {
      input: {
        pageNo: 1,
        pageSize: Math.max(60, ids.length),
        group: true,
        models: ids,
        ignoreWorkspaceServiceSite: true,
      },
    });
    for (const group of page?.list || []) {
      const items = group.items?.length ? group.items : [group];
      for (const item of items) {
        if (!item?.model) continue;
        meta.set(item.model, {
          provider: item.provider || group.provider || '',
          capabilities: Array.isArray(item.capabilities) ? item.capabilities : [],
        });
      }
    }
  } catch {
    meta.clear();
  }
  const models = ids.map((id, index) => {
    const info = meta.get(id) || {};
    const capabilities = info.capabilities || [];
    const caps = tokenPlanCapabilityLabel(capabilities);
    const brand = TOKEN_PLAN_PROVIDER_BRAND[String(info.provider || '').toLowerCase()] || 'other';
    return {
      id,
      capabilities,
      label: caps ? `${id} — ${caps}` : id,
      brand,
      index,
    };
  }).sort((a, b) => {
    const rankA = TOKEN_PLAN_BRAND_RANK[a.brand] ?? 50;
    const rankB = TOKEN_PLAN_BRAND_RANK[b.brand] ?? 50;
    if (rankA !== rankB) return rankA - rankB;
    return a.index - b.index;
  }).map(({ id, capabilities, label }) => ({ id, capabilities, label }));
  tokenPlanCatalogCache = { at: now, edition, models };
  return models.map((model) => ({ ...model }));
}

module.exports = {
  DISCOVERY_TTL_MS,
  qwenKeyType,
  qwenConnection,
  discoveryPlan,
  discoverQwenConnection,
  nativeDashscopeOrigin,
  fetchNativeQwenCatalog,
  fetchNativeQwenQuotas,
  fetchTokenPlanCatalog,
};
