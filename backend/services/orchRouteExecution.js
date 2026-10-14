'use strict';

const logger = require('../utils/logger');

function failureFromError(route, error) {
  return {
    connectionId: route.connectionId,
    keyType: route.keyType,
    credentialFingerprint: route.credentialFingerprint,
    apiKey: route.apiKey,
    baseUrl: route.baseUrl,
    endpoint: route.endpoint,
    model: route.model,
    capability: route.capability || route.role,
    status: error?.status || error?.response?.status,
    code: error?.code || error?.response?.data?.code,
    message: error?.message,
    headers: error?.headers || error?.response?.headers,
  };
}

async function executeRoute(route, operation, options = {}) {
  if (!route?.model || !route?.endpoint || !route?.adapter?.id) {
    const error = new Error('executeRoute requires model, endpoint and adapter');
    error.code = 'INVALID_ROUTE';
    throw error;
  }
  if (typeof operation !== 'function') {
    throw new TypeError('executeRoute requires operation');
  }

  const router = options.router || require('./orchModelRouter');
  const quota = require('./orchQuota');
  const reserved = quota.reserve(route.role || route.capability, route.provider, {
    model: route.model,
    kind: route.capability || route.role,
  });
  if (!reserved.ok) {
    const error = new Error(reserved.reason || 'quota exceeded');
    error.code = 'QUOTA_EXCEEDED';
    throw error;
  }
  const started = Date.now();
  try {
    const result = await operation(route);
    quota.commit(reserved.span_id, {
      model: route.model,
      kind: route.capability || route.role,
      latency_ms: Date.now() - started,
    });
    try {
      const orchTrace = require('./orchTrace');
      await orchTrace.recordSpan({
        trace_id: route.trace_id || options.traceId,
        job_id: route.job_id || options.jobId,
        role: route.role,
        provider: route.provider,
        model: route.model,
        endpoint: route.endpoint,
        capability: route.capability || route.role,
        status: 'success',
        policy: { adapter: route.adapter.id },
        candidates: route.candidates || [],
        usage: result?.usage || {},
        latency_ms: Date.now() - started,
      }, options);
    } catch (error) {
      logger.warn(`[orchRouteExecution] trace: ${error.message}`);
    }
    try {
      await router.persistRouteSuccess(route, {
        latencyMs: Date.now() - started,
        metadata: {
          adapter: route.adapter.id,
          transport: route.adapter.transport,
        },
      });
    } catch (error) {
      logger.warn(`[orchRouteExecution] success observation: ${error.message}`);
    }
    return result;
  } catch (error) {
    quota.release(reserved.span_id);
    try {
      await router.persistRouteFailure(failureFromError(route, error));
    } catch (persistError) {
      logger.warn(`[orchRouteExecution] failure observation: ${persistError.message}`);
    }
    throw error;
  }
}

module.exports = {
  failureFromError,
  executeRoute,
};
