'use strict';

/**
 * Model router for orchestrator roles.
 * One lead orchestrator picks models by role — not sub-orchestrators.
 *
 * Истина для media-ролей = каталог /models по API-ключу (liveOnly),
 * без зашитых Wan/Qwen id в коде gen-путей.
 *
 * Roles:
 *   brief_chat   — soft-ask / plan / clarify (cheap chat)
 *   critic_vision — QA of images (vision)
 *   image_gen    — i2i / listing photos
 *   video_gen    — i2v / clips
 */
const {
  getProviderSettings,
  getProviderModels,
  discoverProviderCapabilities,
} = require('./aiProviderSettingsService');
const { applyLiveProvidersToEnv, resolveQwenBase, resolveDeepseekBase } = require('./orchProviderBridge');
const orchQuota = require('./orchQuota');
const { resolveAdapter } = require('./orchMediaAdapterRegistry');

const ROLE_DEFAULTS = {
  brief_chat: {
    prefer: ['qwencloud', 'deepseek'],
    modelEnv: 'ORCH_BRIEF_MODEL',
    // Только для chat, если /models пуст — не для image/video.
    fallbackModels: ['qwen-plus', 'qwen-turbo', 'qwen3.5-plus', 'deepseek-chat'],
    needModelList: false,
    capability: 'chat',
  },
  critic_vision: {
    prefer: ['qwencloud'],
    modelEnv: 'ORCH_CRITIC_MODEL',
    fallbackModels: ['qwen-vl-plus', 'qwen-plus', 'qwen3.5-plus'],
    needModelList: false,
    capability: 'vision',
  },
  image_gen: {
    prefer: ['qwencloud'],
    modelEnv: 'QWEN_IMAGE_MODEL',
    fallbackModels: [],
    orchProviderName: 'qwen_token',
    needModelList: true,
    capability: 'image',
  },
  video_gen: {
    prefer: ['qwencloud'],
    modelEnv: 'QWEN_VIDEO_MODEL',
    fallbackModels: [],
    orchProviderName: 'qwen_paygo',
    needModelList: true,
    capability: 'video',
  },
};

/** @type {{ at: number, qwen: object|null, deepseek: object|null, qwenIds: Set<string>|null, qwenLiveIds: string[]|null, qwenDiscovery: object|null }} */
let CREDS_CACHE = {
  at: 0,
  qwen: null,
  deepseek: null,
  qwenIds: null,
  qwenLiveIds: null,
  qwenDiscovery: null,
};
const CREDS_TTL_MS = 60_000;
const ROUTE_OBSERVATION_TTL_MS = Math.max(
  60_000,
  Number(process.env.ORCH_ROUTE_OBSERVATION_TTL_MS) || 24 * 60 * 60 * 1000
);
// R1 only: process-local routing health. R2a must replace this Map with
// persistent capability_observations before paid canaries rely on it.
const ROUTE_HEALTH = new Map();

function retryAfterMs(headers, now = Date.now()) {
  const raw = typeof headers?.get === 'function'
    ? headers.get('retry-after')
    : Object.entries(headers || {}).find(([key]) => key.toLowerCase() === 'retry-after')?.[1];
  if (raw === undefined || raw === null || String(raw).trim() === '') return undefined;

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);

  const at = Date.parse(String(raw));
  return Number.isFinite(at) ? Math.max(0, at - now) : undefined;
}

/**
 * Convert provider failures into routing-health decisions.
 * This function is pure; recordRouteFailure owns the temporary R1 state.
 */
function classifyRouteFailure(failure = {}) {
  const status = Number(failure.status);
  const code = String(failure.code || '').toLowerCase();

  if (status === 401) {
    return { action: 'mark_unhealthy', health_scope: 'connection', retry: false };
  }
  if (status === 403 && code.includes('freetieronly')) {
    return {
      action: 'mark_unhealthy',
      health_scope: 'entitlement',
      entitlement_scope: 'connection_model',
      retry: false,
    };
  }
  if (status === 404 && (code.includes('modelnotexist') || code.includes('model_not_exist'))) {
    return { action: 'cooldown', health_scope: 'model_route', retry: false };
  }
  if (status === 429) {
    const decision = { action: 'retry', health_scope: 'none', retry: true };
    const delay = retryAfterMs(failure.headers);
    if (delay !== undefined) decision.retry_after_ms = delay;
    return decision;
  }
  return { action: 'none', health_scope: 'none', retry: false };
}

function routeHealthKey(failure, decision) {
  const connection = String(failure.connectionId || '');
  const model = String(failure.model || '');
  const endpoint = String(failure.endpoint || '');
  if (decision.health_scope === 'connection') return `connection:${connection}`;
  if (decision.entitlement_scope === 'connection_model') {
    return `connection_model:${connection}:${model}`;
  }
  if (decision.health_scope === 'model_route') {
    return `model_route:${connection}:${endpoint}:${model}`;
  }
  return null;
}

function recordRouteFailure(failure = {}) {
  const decision = classifyRouteFailure(failure);
  const key = routeHealthKey(failure, decision);
  if (key) {
    ROUTE_HEALTH.set(key, {
      ...decision,
      status: Number(failure.status) || null,
      code: String(failure.code || ''),
      observed_at: new Date().toISOString(),
      persistence: 'process_memory',
    });
  }
  return decision;
}

function getRouteHealthSnapshot() {
  return Object.fromEntries(ROUTE_HEALTH);
}

function clearRouteHealth() {
  ROUTE_HEALTH.clear();
}

async function persistRouteFailure(failure = {}, options = {}) {
  const decision = recordRouteFailure(failure);
  const store = require('./orchCapabilityObservations');
  const credentialFingerprint = failure.credentialFingerprint
    || store.fingerprintCredential({
      apiKey: failure.apiKey,
      keyType: failure.keyType,
      baseUrl: failure.baseUrl,
    });
  await store.recordObservation({
    connectionId: failure.connectionId,
    keyType: failure.keyType,
    credentialFingerprint,
    baseUrl: failure.baseUrl,
    endpoint: failure.endpoint,
    model: failure.model,
    capability: failure.capability || 'unknown',
    outcome: 'failure',
    healthScope: decision.health_scope,
    permanent: decision.action === 'mark_unhealthy' || decision.action === 'cooldown',
    retryable: decision.retry,
    status: failure.status,
    errorCode: failure.code,
    errorMessage: failure.message,
    metadata: {
      action: decision.action,
      entitlement_scope: decision.entitlement_scope || null,
      retry_after_ms: decision.retry_after_ms,
    },
    expiresAt: failure.expiresAt || new Date(
      Date.now() + (decision.retry_after_ms || ROUTE_OBSERVATION_TTL_MS)
    ),
  }, options);
  return decision;
}

async function persistRouteSuccess(route = {}, result = {}, options = {}) {
  const store = require('./orchCapabilityObservations');
  const credentialFingerprint = route.credentialFingerprint
    || store.fingerprintCredential({
      apiKey: route.apiKey,
      keyType: route.keyType,
      baseUrl: route.baseUrl,
    });
  return store.recordObservation({
    connectionId: route.connectionId,
    keyType: route.keyType,
    credentialFingerprint,
    baseUrl: route.baseUrl,
    endpoint: route.endpoint,
    model: route.model,
    capability: route.capability || route.role || 'unknown',
    outcome: 'success',
    latencyMs: result.latencyMs,
    metadata: result.metadata || {},
    expiresAt: result.expiresAt || new Date(Date.now() + ROUTE_OBSERVATION_TTL_MS),
  }, options);
}

function classifyModelId(id) {
  const s = String(id || '').toLowerCase();
  if (!s) return 'other';
  if (/(^|[^a-z])(video|t2v|i2v|v2v)([^a-z]|$)/.test(s) || /wan[\w.-]*-(i2v|t2v)/.test(s)) {
    return 'video';
  }
  if (
    /qwen-image|wan[\w.-]*-image|wanx|t2i|i2i/.test(s)
    || /(^|[^a-z])image([^a-z]|$)/.test(s)
  ) {
    return 'image';
  }
  if (/vl|vision|omni/.test(s)) return 'vision';
  return 'chat';
}

function scoreForCapability(id, capability) {
  const s = String(id || '').toLowerCase();
  const kind = classifyModelId(s);
  if (capability === 'image') {
    if (kind !== 'image') return -1;
    if (/qwen-image-3\.0-pro/.test(s)) return 100;
    if (/qwen-image-3/.test(s)) return 90;
    if (/qwen-image/.test(s)) return 80;
    if (/wan2\.7-image|wan2\.6-image/.test(s)) return 70;
    if (/wan.*image|wanx|t2i/.test(s)) return 50;
    return 40;
  }
  if (capability === 'video') {
    if (kind !== 'video') return -1;
    if (/i2v/.test(s)) return 90;
    if (/t2v/.test(s)) return 80;
    if (/video/.test(s)) return 70;
    return 40;
  }
  if (capability === 'vision') {
    if (kind === 'vision') return /vl-plus|vl-max/.test(s) ? 90 : 70;
    if (kind === 'chat') return 20;
    return -1;
  }
  // chat
  if (kind === 'image' || kind === 'video') return -1;
  if (/qwen3\.8-max|qwen3-max/.test(s)) return 95;
  if (/qwen3\.5-plus|qwen-plus/.test(s)) return 80;
  if (/qwen|deepseek/.test(s)) return 50;
  return 30;
}

function candidatesFromLive(liveIds, roleCfg, { envModel, selected } = {}) {
  const cap = roleCfg.capability || 'chat';
  const live = [...new Set((liveIds || []).map((x) => String(x).trim()).filter(Boolean))];
  const scored = live
    .map((id) => ({ id, score: scoreForCapability(id, cap) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const ordered = [];
  const push = (id) => {
    const s = String(id || '').trim();
    if (!s || ordered.includes(s)) return;
    if (live.length && !live.includes(s) && cap !== 'chat' && cap !== 'vision') {
      // media: не подсовываем id, которого нет у ключа
      return;
    }
    if (scoreForCapability(s, cap) < 0 && live.length) return;
    ordered.push(s);
  };

  push(envModel);
  // selected в Settings — обычно chat; для image/video только если сам image/video
  if (selected && (cap === 'chat' || cap === 'vision' || scoreForCapability(selected, cap) >= 0)) {
    push(selected);
  }
  for (const row of scored) push(row.id);
  for (const fb of roleCfg.fallbackModels || []) {
    if (!live.length || live.includes(String(fb))) push(fb);
  }
  return ordered;
}

async function loadCachedSettings({ fetchModels = false, liveOnly = false } = {}) {
  const now = Date.now();
  const fresh = now - CREDS_CACHE.at < CREDS_TTL_MS && (CREDS_CACHE.qwen || CREDS_CACHE.deepseek);
  if (!fresh) {
    const qwen = await getProviderSettings('qwencloud').catch(() => null);
    const deepseek = await getProviderSettings('deepseek').catch(() => null);
    CREDS_CACHE = {
      at: now,
      qwen,
      deepseek,
      qwenIds: null,
      qwenLiveIds: null,
      qwenDiscovery: null,
    };
  }
  if (fetchModels && CREDS_CACHE.qwen?.api_key) {
    const needLive = liveOnly && !CREDS_CACHE.qwenLiveIds;
    const needUi = !liveOnly && !CREDS_CACHE.qwenIds;
    if (needLive || needUi) {
      try {
        const discoveryPromise = liveOnly && typeof discoverProviderCapabilities === 'function'
          ? discoverProviderCapabilities('qwencloud', CREDS_CACHE.qwen)
          : getProviderModels('qwencloud', CREDS_CACHE.qwen, {
              liveOnly: Boolean(liveOnly),
            }).then((models) => ({ models }));
        const discovery = await Promise.race([
          discoveryPromise,
          new Promise((_, rej) => setTimeout(() => rej(new Error('models_list_timeout')), 8000)),
        ]);
        const ids = (discovery.models || []).map((m) => String(m.id || m)).filter(Boolean);
        if (liveOnly) {
          CREDS_CACHE.qwenLiveIds = ids;
          CREDS_CACHE.qwenIds = new Set(ids);
          CREDS_CACHE.qwenDiscovery = discovery;
        } else {
          CREDS_CACHE.qwenIds = new Set(ids);
        }
      } catch {
        if (liveOnly) CREDS_CACHE.qwenLiveIds = CREDS_CACHE.qwenLiveIds || [];
        else CREDS_CACHE.qwenIds = CREDS_CACHE.qwenIds || new Set();
      }
    }
  }
  return CREDS_CACHE;
}

function pickModel(settings, roleCfg, availableIds, liveIds) {
  const envModel = roleCfg.modelEnv ? process.env[roleCfg.modelEnv] : null;
  const selected = settings?.selected_model || null;
  const live = liveIds || (availableIds?.size ? [...availableIds] : []);
  const preferLive = roleCfg.needModelList || roleCfg.capability === 'image' || roleCfg.capability === 'video';

  if (preferLive) {
    const cands = candidatesFromLive(live, roleCfg, { envModel, selected });
    if (cands.length) return cands[0];
    // Каталог пуст — только явный env (ключ/деплой), без Wan-списков в коде
    if (envModel) return String(envModel);
    const err = new Error(
      `Нет моделей «${roleCfg.capability}» в каталоге ключа. Проверьте Settings → AI /models.`
    );
    err.code = 'NO_LIVE_MODEL';
    throw err;
  }

  const preferCheap = roleCfg === ROLE_DEFAULTS.brief_chat || roleCfg.modelEnv === 'ORCH_BRIEF_MODEL';
  const candidates = preferCheap
    ? [envModel, selected, ...(roleCfg.fallbackModels || [])]
    : [envModel, selected, ...(roleCfg.fallbackModels || [])];
  const list = candidates.filter(Boolean);

  if (availableIds?.size) {
    for (const id of list) {
      if (availableIds.has(String(id))) return String(id);
    }
  }
  return String(list[0] || roleCfg.fallbackModels?.[0] || selected || 'qwen-plus');
}

async function loadCreds(providerKey, { needModelList = false, liveOnly = false } = {}) {
  const cache = await loadCachedSettings({ fetchModels: needModelList, liveOnly });
  if (providerKey === 'qwencloud') {
    const s = cache.qwen;
    if (!s?.api_key) return null;
    const liveIds = liveOnly ? cache.qwenLiveIds || [] : null;
    return {
      provider: 'qwencloud',
      apiKey: s.api_key,
      baseUrl: resolveQwenBase(s.base_url),
      selected_model: s.selected_model || null,
      availableIds: needModelList ? cache.qwenIds || new Set() : new Set(),
      liveIds,
      orchProviderName: 'qwen_token',
      connectionId: cache.qwenDiscovery?.connection?.connectionId || `settings:qwencloud:${s.id || 'default'}`,
      keyType: cache.qwenDiscovery?.connection?.keyType || null,
      credentialFingerprint: cache.qwenDiscovery?.connection?.credentialFingerprint || null,
      discovery: cache.qwenDiscovery,
    };
  }
  if (providerKey === 'deepseek') {
    const s = cache.deepseek;
    if (!s?.api_key) return null;
    return {
      provider: 'deepseek',
      apiKey: s.api_key,
      baseUrl: resolveDeepseekBase(s.base_url),
      selected_model: s.selected_model || null,
      availableIds: new Set(),
      liveIds: null,
      orchProviderName: 'deepseek',
    };
  }
  return null;
}

function envCreds(role) {
  if (process.env.QWEN_TOKEN_API_KEY && process.env.QWEN_TOKEN_BASE_URL) {
    return {
      provider: 'env:qwen_token',
      apiKey: process.env.QWEN_TOKEN_API_KEY,
      baseUrl: process.env.QWEN_TOKEN_BASE_URL,
      selected_model: process.env.QWEN_CHAT_MODEL || null,
      availableIds: new Set(),
      liveIds: null,
      orchProviderName: 'qwen_token',
      source: 'env',
      connectionId: 'env:qwen_token',
      keyType: 'qwen_token',
    };
  }
  if (role === 'brief_chat' && process.env.DEEPSEEK_API_KEY) {
    return {
      provider: 'env:deepseek',
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseUrl: resolveDeepseekBase(process.env.DEEPSEEK_BASE_URL),
      selected_model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      availableIds: new Set(),
      liveIds: null,
      orchProviderName: 'deepseek',
      source: 'env',
    };
  }
  return null;
}

/**
 * Resolve concrete credentials + model for a role.
 * @param {'brief_chat'|'critic_vision'|'image_gen'|'video_gen'} role
 */
function memoryBlocks(connectionId, endpoint, model) {
  const snap = getRouteHealthSnapshot();
  return Boolean(
    snap[`connection:${connectionId}`]
    || snap[`connection_model:${connectionId}:${model}`]
    || snap[`model_route:${connectionId}:${endpoint}:${model}`]
  );
}

async function loadPersistedObservations(creds, options = {}) {
  if (!creds?.connectionId) return [];
  const store = options.observations || require('./orchCapabilityObservations');
  try {
    return await store.listFreshObservations({
      connectionId: creds.connectionId,
      credentialFingerprint: creds.credentialFingerprint,
      limit: 200,
    }, options);
  } catch {
    return [];
  }
}

function isRouteUnhealthy(connectionId, endpoint, model, rows) {
  if (memoryBlocks(connectionId, endpoint, model)) return true;
  const store = require('./orchCapabilityObservations');
  return store.isRouteBlocked({ connectionId, endpoint, model }, rows);
}

async function resolveRole(role, options = {}) {
  const roleCfg = ROLE_DEFAULTS[role];
  if (!roleCfg) {
    const err = new Error(`Unknown orch role: ${role}`);
    err.code = 'UNKNOWN_ROLE';
    throw err;
  }

  await applyLiveProvidersToEnv({ force: false });

  const liveOnly = Boolean(roleCfg.needModelList);
  const chain = [];
  for (const pref of roleCfg.prefer) {
    const creds = await loadCreds(pref, {
      needModelList: Boolean(roleCfg.needModelList),
      liveOnly,
    });
    if (!creds) continue;
    let model;
    try {
      model = pickModel(
        { selected_model: creds.selected_model },
        roleCfg,
        creds.availableIds,
        creds.liveIds
      );
    } catch (e) {
      chain.push({ provider: creds.provider, skipped: true, reason: e.code || e.message });
      continue;
    }
    const candidates = candidatesFromLive(creds.liveIds || [], roleCfg, {
      envModel: roleCfg.modelEnv ? process.env[roleCfg.modelEnv] : null,
      selected: creds.selected_model,
    });
    if (!candidates.length && model) candidates.push(model);
    const observations = await loadPersistedObservations(creds, options);
    let adapter;
    let chosen = null;
    for (const candidate of candidates.length ? candidates : [model]) {
      let nextAdapter;
      try {
        nextAdapter = resolveAdapter({ role, model: candidate });
      } catch (e) {
        chain.push({ provider: creds.provider, model: candidate, skipped: true, reason: e.code || e.message });
        continue;
      }
      if (isRouteUnhealthy(creds.connectionId, nextAdapter.endpoint, candidate, observations)) {
        chain.push({
          provider: creds.provider,
          model: candidate,
          skipped: true,
          reason: 'observation_cooldown',
        });
        continue;
      }
      chosen = candidate;
      adapter = nextAdapter;
      break;
    }
    if (!chosen || !adapter) continue;
    model = chosen;

    const route = {
      role,
      provider: creds.provider,
      model,
      candidates,
      apiKey: creds.apiKey,
      baseUrl: creds.baseUrl,
      orchProviderName: roleCfg.orchProviderName || creds.orchProviderName,
      source: liveOnly ? 'settings:live' : 'settings',
      connectionId: creds.connectionId || null,
      keyType: creds.keyType || null,
      credentialFingerprint: creds.credentialFingerprint || null,
      capability: roleCfg.capability,
      adapter,
      endpoint: adapter.endpoint,
      discovery: creds.discovery
        ? {
            status: creds.discovery.plan?.status,
            reason: creds.discovery.plan?.reason || null,
            persisted: Boolean(creds.discovery.persisted),
          }
        : null,
    };
    const q = orchQuota.canSpend(role, route.provider);
    route.quota = q;
    if (!q.ok) {
      chain.push({ ...route, skipped: true, reason: q.reason });
      continue;
    }
    if (roleCfg.modelEnv && model) {
      process.env[roleCfg.modelEnv] = model;
    }
    return route;
  }

  const fallback = envCreds(role);
  if (fallback) {
    let model;
    try {
      model = pickModel(
        { selected_model: fallback.selected_model },
        roleCfg,
        fallback.availableIds,
        fallback.liveIds
      );
    } catch (e) {
      // env без live-каталога: для media только явный env model
      model = roleCfg.modelEnv ? process.env[roleCfg.modelEnv] : null;
      if (!model) {
        const err = new Error(e.message);
        err.code = e.code || 'ROUTE_UNAVAILABLE';
        err.status = 400;
        err.role = role;
        throw err;
      }
    }
    const adapter = resolveAdapter({ role, model });
    const fallbackObs = await loadPersistedObservations(fallback, options);
    if (isRouteUnhealthy(fallback.connectionId, adapter.endpoint, model, fallbackObs)) {
      const err = new Error(
        `Маршрут «${role}» охлаждён observation (404/401/403). Выберите другую модель.`
      );
      err.code = 'ROUTE_UNAVAILABLE';
      err.status = 400;
      err.role = role;
      throw err;
    }
    const route = {
      role,
      provider: fallback.provider,
      model,
      candidates: [model],
      apiKey: fallback.apiKey,
      baseUrl: fallback.baseUrl,
      orchProviderName: roleCfg.orchProviderName || fallback.orchProviderName,
      source: 'env',
      connectionId: fallback.connectionId || null,
      keyType: fallback.keyType || null,
      capability: roleCfg.capability,
      adapter,
      endpoint: adapter.endpoint,
      quota: orchQuota.canSpend(role, fallback.provider),
    };
    if (route.quota.ok) {
      if (roleCfg.modelEnv && model) process.env[roleCfg.modelEnv] = model;
      return route;
    }
  }

  const err = new Error(
    `Нет доступного провайдера для роли «${role}». Проверьте Settings → AI или квоту.`
  );
  err.code = 'ROUTE_UNAVAILABLE';
  err.status = 400;
  err.role = role;
  err.tried = chain;
  throw err;
}

/**
 * Public routing table for capabilities UI (no secrets).
 */
async function getRoutingTable() {
  const roles = {};
  for (const role of Object.keys(ROLE_DEFAULTS)) {
    try {
      const r = await resolveRole(role);
      roles[role] = {
        ok: true,
        provider: r.provider,
        model: r.model,
        candidates: (r.candidates || []).slice(0, 8),
        source: r.source,
        orch_provider: r.orchProviderName,
        connection_id: r.connectionId,
        key_type: r.keyType,
        adapter: r.adapter,
        discovery: r.discovery,
        quota: {
          ok: r.quota?.ok,
          remaining: r.quota?.remaining,
          limit: r.quota?.limit,
        },
      };
    } catch (e) {
      roles[role] = {
        ok: false,
        error: e.code || e.message,
      };
    }
  }
  return {
    roles,
    defaults: Object.fromEntries(
      Object.entries(ROLE_DEFAULTS).map(([k, v]) => [
        k,
        {
          prefer: v.prefer,
          fallbackModels: v.fallbackModels,
          modelEnv: v.modelEnv,
          capability: v.capability,
          needModelList: v.needModelList,
        },
      ])
    ),
    quota: orchQuota.snapshot(),
  };
}

async function listModelsForRole(role, options = {}) {
  const roleCfg = ROLE_DEFAULTS[role];
  if (!roleCfg) return [];
  await applyLiveProvidersToEnv({ force: false });
  const liveOnly = Boolean(roleCfg.needModelList);
  for (const pref of roleCfg.prefer) {
    const creds = await loadCreds(pref, {
      needModelList: Boolean(roleCfg.needModelList),
      liveOnly,
    });
    if (!creds) continue;
    const live = creds.liveIds || [...(creds.availableIds || [])];
    const listed = candidatesFromLive(live, roleCfg, {
      envModel: roleCfg.modelEnv ? process.env[roleCfg.modelEnv] : null,
      selected: creds.selected_model,
    }).map((id) => ({ id, capability: roleCfg.capability }));
    const limit = Number(options.limit);
    return Number.isInteger(limit) && limit > 0 ? listed.slice(0, limit) : listed;
  }
  return [];
}

async function chatForRole(role, messages, opts = {}) {
  const route = await resolveRole(role || 'brief_chat');
  const path = require('path');
  const fs = require('fs');
  const llmPath = [
    '/host-project/orchestrator/runtime/llm.js',
    path.join(__dirname, '../../orchestrator/runtime/llm.js'),
  ].find((p) => fs.existsSync(p));
  if (!llmPath) throw new Error('orch llm.js missing');
  const llm = require(llmPath);
  const res = await llm.chatCompletion({
    baseUrl: route.baseUrl,
    apiKey: route.apiKey,
    model: opts.model || route.model,
    messages,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
    json: opts.json,
  });
  orchQuota.record(role || 'brief_chat', route.provider, { model: route.model, kind: 'chat' });
  return { ...res, route, parseJsonLoose: llm.parseJsonLoose };
}

module.exports = {
  ROLE_DEFAULTS,
  resolveRole,
  getRoutingTable,
  listModelsForRole,
  chatForRole,
  classifyModelId,
  candidatesFromLive,
  classifyRouteFailure,
  recordRouteFailure,
  getRouteHealthSnapshot,
  clearRouteHealth,
  persistRouteFailure,
  persistRouteSuccess,
  memoryBlocks,
  isRouteUnhealthy,
};
