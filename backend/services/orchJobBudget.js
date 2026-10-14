'use strict';

const DEFAULT_LIMITS = {
  max_cost: null,
  max_tokens: 200000,
  max_model_calls: 40,
  max_attempts: 8,
  max_retries_per_step: 2,
  max_duration_ms: 30 * 60 * 1000,
  max_spawn_depth: 1,
  max_parallel_workers: 1,
};

function limitsOf(job = {}) {
  return { ...DEFAULT_LIMITS, ...(job.limits || {}) };
}

function usageOf(job = {}) {
  return {
    model_calls: 0,
    attempts: 0,
    tokens: 0,
    cost: 0,
    started_at: job.created_at || job.createdAt || null,
    ...(job.usage || {}),
  };
}

function evaluateBudget(job = {}, extra = {}) {
  const limits = limitsOf(job);
  const usage = usageOf(job);
  const modelCalls = usage.model_calls + Number(extra.model_calls || 0);
  const attempts = usage.attempts + Number(extra.attempts || 0);
  const tokens = usage.tokens + Number(extra.tokens || 0);
  const cost = usage.cost + Number(extra.cost || 0);
  const started = usage.started_at ? Date.parse(usage.started_at) : Date.now();
  const duration = Date.now() - (Number.isFinite(started) ? started : Date.now());

  const hit = [];
  if (limits.max_model_calls != null && modelCalls > limits.max_model_calls) hit.push('max_model_calls');
  if (limits.max_attempts != null && attempts > limits.max_attempts) hit.push('max_attempts');
  if (limits.max_tokens != null && tokens > limits.max_tokens) hit.push('max_tokens');
  if (limits.max_cost != null && cost > limits.max_cost) hit.push('max_cost');
  if (limits.max_duration_ms != null && duration > limits.max_duration_ms) hit.push('max_duration');

  if (!hit.length) {
    return { ok: true, status: 'ok', limits, usage: { ...usage, model_calls: modelCalls } };
  }
  return {
    ok: false,
    status: extra.partial ? 'partial' : 'blocked_ask',
    reason: hit[0],
    hit,
    limits,
    usage: { ...usage, model_calls: modelCalls, attempts, tokens, cost },
  };
}

function assertBudget(job, extra) {
  const check = evaluateBudget(job, extra);
  if (check.ok) return check;
  const error = new Error(`budget_exhausted:${check.reason}`);
  error.code = 'BUDGET_EXHAUSTED';
  error.status = 429;
  error.budget = check;
  throw error;
}

module.exports = {
  DEFAULT_LIMITS,
  limitsOf,
  usageOf,
  evaluateBudget,
  assertBudget,
};
