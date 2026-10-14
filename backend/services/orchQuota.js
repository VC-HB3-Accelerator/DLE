'use strict';

/**
 * Soft quota board (stub for C).
 * In-memory daily counters — not billing API yet.
 * Policy: warn / block when role hits soft limit so router can fallback.
 */

const DEFAULT_LIMITS = {
  brief_chat: Number(process.env.ORCH_QUOTA_BRIEF_CHAT || 200),
  critic_vision: Number(process.env.ORCH_QUOTA_CRITIC || 80),
  image_gen: Number(process.env.ORCH_QUOTA_IMAGE || 40),
  video_gen: Number(process.env.ORCH_QUOTA_VIDEO || 10),
};

/** @type {Map<string, { day: string, byRole: Record<string, number>, byProvider: Record<string, number>, events: object[] }>} */
const STATE = new Map();

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function bucket() {
  const day = dayKey();
  let s = STATE.get('global');
  if (!s || s.day !== day) {
    s = { day, byRole: {}, byProvider: {}, events: [], spans: [] };
    STATE.set('global', s);
  }
  if (!Array.isArray(s.spans)) s.spans = [];
  return s;
}

function nextSpanId() {
  return `span-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function persistQuotaSpan(span) {
  const fs = require('fs');
  const inRuntime = process.env.ORCH_INTEGRATION_DB === '1'
    || process.env.ORCH_PERSIST_SPANS === '1'
    || fs.existsSync('/.dockerenv');
  if (!inRuntime) {
    return;
  }
  setImmediate(() => {
    let query;
    try {
      query = require('../db').getQuery();
    } catch {
      return;
    }
    if (!query) return;
    query(
      `INSERT INTO orchestrator_quota_spans (
         id, day, role, provider, status, model, kind, latency_ms, reserved_at, ended_at, meta
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         latency_ms = EXCLUDED.latency_ms,
         ended_at = EXCLUDED.ended_at,
         meta = EXCLUDED.meta`,
      [
        span.id,
        dayKey(),
        span.role,
        span.provider,
        span.status,
        span.model || span.meta?.model || null,
        span.meta?.kind || null,
        span.latency_ms || null,
        span.started_at,
        span.ended_at,
        JSON.stringify(span.meta || {}),
      ]
    ).catch(() => {});
  });
}

async function hydrateFromDb() {
  if (STATE.get('hydrated')) return;
  const fs = require('fs');
  const inRuntime = process.env.ORCH_INTEGRATION_DB === '1'
    || process.env.ORCH_PERSIST_SPANS === '1'
    || fs.existsSync('/.dockerenv');
  if (!inRuntime) {
    STATE.set('hydrated', true);
    return;
  }
  let query;
  try {
    query = require('../db').getQuery();
  } catch {
    STATE.set('hydrated', true);
    return;
  }
  try {
    const { rows } = await query(
      `SELECT role, provider, status
         FROM orchestrator_quota_spans
        WHERE day = $1 AND status IN ('reserved', 'committed')`,
      [dayKey()]
    );
    const s = bucket();
    for (const row of rows || []) {
      s.byRole[row.role] = (s.byRole[row.role] || 0) + 1;
      if (row.provider) s.byProvider[row.provider] = (s.byProvider[row.provider] || 0) + 1;
    }
  } catch {
    /* table may not exist yet */
  }
  STATE.set('hydrated', true);
}

function reserve(role, provider, meta = {}) {
  const check = canSpend(role, provider);
  if (!check.ok) return { ...check, reserved: false, span_id: null };
  const s = bucket();
  const span = {
    id: nextSpanId(),
    role,
    provider: String(provider || 'unknown'),
    started_at: new Date().toISOString(),
    ended_at: null,
    status: 'reserved',
    meta,
  };
  s.byRole[role] = (s.byRole[role] || 0) + 1;
  s.byProvider[span.provider] = (s.byProvider[span.provider] || 0) + 1;
  s.spans.push(span);
  if (s.spans.length > 200) s.spans = s.spans.slice(-100);
  persistQuotaSpan(span);
  return {
    ok: true,
    reserved: true,
    span_id: span.id,
    used: check.used + 1,
    limit: check.limit,
    remaining: Math.max(0, check.remaining - 1),
    provider,
  };
}

function commit(spanId, extra = {}) {
  const s = bucket();
  const span = (s.spans || []).find((item) => item.id === spanId);
  if (!span) return null;
  span.status = 'committed';
  span.ended_at = new Date().toISOString();
  span.latency_ms = extra.latency_ms ?? null;
  span.model = extra.model || span.meta?.model || null;
  s.events.push({
    at: span.ended_at,
    role: span.role,
    provider: span.provider,
    model: span.model,
    kind: extra.kind || span.meta?.kind || null,
    span_id: span.id,
    latency_ms: span.latency_ms,
  });
  if (s.events.length > 200) s.events = s.events.slice(-100);
  persistQuotaSpan(span);
  return span;
}

function release(spanId) {
  const s = bucket();
  const span = (s.spans || []).find((item) => item.id === spanId);
  if (!span || span.status !== 'reserved') return null;
  span.status = 'released';
  span.ended_at = new Date().toISOString();
  s.byRole[span.role] = Math.max(0, (s.byRole[span.role] || 1) - 1);
  s.byProvider[span.provider] = Math.max(0, (s.byProvider[span.provider] || 1) - 1);
  persistQuotaSpan(span);
  return span;
}

function canSpend(role, provider) {
  const s = bucket();
  const limit = DEFAULT_LIMITS[role] ?? 100;
  const used = s.byRole[role] || 0;
  const remaining = Math.max(0, limit - used);
  if (used >= limit) {
    return {
      ok: false,
      reason: `quota_exceeded:${role}`,
      used,
      limit,
      remaining: 0,
      provider,
    };
  }
  return { ok: true, used, limit, remaining, provider };
}

function record(role, provider, meta = {}) {
  const s = bucket();
  s.byRole[role] = (s.byRole[role] || 0) + 1;
  const p = String(provider || 'unknown');
  s.byProvider[p] = (s.byProvider[p] || 0) + 1;
  s.events.push({
    at: new Date().toISOString(),
    role,
    provider: p,
    model: meta.model || null,
    kind: meta.kind || null,
  });
  if (s.events.length > 200) s.events = s.events.slice(-100);
  return canSpend(role, provider);
}

function snapshot() {
  const s = bucket();
  const roles = {};
  for (const [role, limit] of Object.entries(DEFAULT_LIMITS)) {
    const used = s.byRole[role] || 0;
    roles[role] = { used, limit, remaining: Math.max(0, limit - used) };
  }
  return {
    day: s.day,
    roles,
    by_provider: { ...s.byProvider },
    recent: s.events.slice(-10),
    open_spans: (s.spans || []).filter((span) => span.status === 'reserved').length,
    note: 'Quota spans persist in Postgres when DB is available. Not live provider billing.',
  };
}

function resetForTests() {
  STATE.clear();
}

setImmediate(() => {
  hydrateFromDb().catch(() => {});
});

module.exports = {
  DEFAULT_LIMITS,
  canSpend,
  reserve,
  commit,
  release,
  record,
  snapshot,
  resetForTests,
  hydrateFromDb,
};
