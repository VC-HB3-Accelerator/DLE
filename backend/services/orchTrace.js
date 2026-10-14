'use strict';

const crypto = require('crypto');

const TABLE = 'orchestrator_route_spans';

function newTraceId() {
  return crypto.randomUUID();
}

function queryFn(override) {
  if (override) return override;
  const fs = require('fs');
  const inRuntime = process.env.ORCH_INTEGRATION_DB === '1'
    || process.env.ORCH_PERSIST_SPANS === '1'
    || fs.existsSync('/.dockerenv');
  if (!inRuntime) {
    return null;
  }
  try {
    return require('../db').getQuery();
  } catch {
    return null;
  }
}

function normalizeSpan(input = {}) {
  return {
    trace_id: String(input.trace_id || input.traceId || '').trim() || newTraceId(),
    job_id: input.job_id || input.jobId || null,
    role: input.role || null,
    provider: input.provider || null,
    model: input.model || null,
    endpoint: input.endpoint || null,
    capability: input.capability || input.role || null,
    status: String(input.status || 'recorded'),
    policy: input.policy && typeof input.policy === 'object' ? input.policy : {},
    candidates: Array.isArray(input.candidates) ? input.candidates : [],
    usage: input.usage && typeof input.usage === 'object' ? input.usage : {},
    error: input.error && typeof input.error === 'object' ? input.error : null,
    critic: input.critic && typeof input.critic === 'object' ? input.critic : null,
    latency_ms: Number.isFinite(Number(input.latency_ms ?? input.latencyMs))
      ? Math.max(0, Math.round(Number(input.latency_ms ?? input.latencyMs)))
      : null,
  };
}

async function recordSpan(input = {}, options = {}) {
  const span = normalizeSpan(input);
  const query = queryFn(options.query);
  if (!query) return { ...span, persisted: false };
  const { rows } = await query(
    `INSERT INTO ${TABLE} (
       trace_id, job_id, role, provider, model, endpoint, capability,
       status, policy, candidates, usage, error, critic, latency_ms
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       $8, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14
     )
     RETURNING *`,
    [
      span.trace_id,
      span.job_id,
      span.role,
      span.provider,
      span.model,
      span.endpoint,
      span.capability,
      span.status,
      JSON.stringify(span.policy),
      JSON.stringify(span.candidates),
      JSON.stringify(span.usage),
      span.error ? JSON.stringify(span.error) : null,
      span.critic ? JSON.stringify(span.critic) : null,
      span.latency_ms,
    ]
  );
  return { ...(rows[0] || span), persisted: true };
}

async function listSpans(traceId, options = {}) {
  const query = queryFn(options.query);
  if (!query) return [];
  const { rows } = await query(
    `SELECT * FROM ${TABLE} WHERE trace_id = $1 ORDER BY created_at ASC, id ASC`,
    [String(traceId)]
  );
  return rows || [];
}

module.exports = {
  TABLE,
  newTraceId,
  normalizeSpan,
  recordSpan,
  listSpans,
};
