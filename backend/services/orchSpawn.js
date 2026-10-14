'use strict';

/**
 * Lead orchestrator spawn_agent / await_steps (v1: leaf only, max_spawn_depth=1).
 * Child steps live on parent job.child_steps[]; workers cannot spawn.
 */
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { runIdempotentActivity } = require('./orchActivityRuntime');
const { validateBrief, stripUntrustedOverrides } = require('./orchBrief');
const { freezeToolsAllow } = require('./orchToolGate');

const WORKERS = {
  parser: () => require('./orchWorkers/parserWorker'),
  research: () => require('./orchWorkers/researchWorker'),
  image: () => require('./orchWorkers/imageWorker'),
  critic: () => require('./orchWorkers/criticWorker'),
  acceptor: () => require('./orchWorkers/acceptorWorker'),
  ingest: () => require('./orchWorkers/ingestWorker'),
  video: () => require('./orchWorkers/videoWorker'),
};

function nowIso() {
  return new Date().toISOString();
}

function loadRegistry() {
  const candidates = [
    '/host-project/orchestrator/agents/registry.json',
    path.join(__dirname, '../../orchestrator/agents/registry.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function assertLeafBrief(brief, parentJob) {
  if (!brief || typeof brief !== 'object') {
    const err = new Error('spawn_agent: brief required');
    err.code = 'BAD_BRIEF';
    err.status = 400;
    throw err;
  }
  const agentId = String(brief.agent_id || '').trim();
  if (!agentId || !WORKERS[agentId]) {
    const err = new Error(`spawn_agent: unknown agent_id «${agentId}»`);
    err.code = 'UNKNOWN_AGENT';
    err.status = 400;
    throw err;
  }
  const spawnRole = brief.spawn_role || 'leaf';
  if (spawnRole !== 'leaf') {
    const err = new Error('v1: только spawn_role=leaf (без саб-оркестраторов)');
    err.code = 'SPAWN_DEPTH';
    err.status = 400;
    throw err;
  }
  // Parent must not itself be a leaf child
  if (parentJob?._spawn_role === 'leaf') {
    const err = new Error('leaf worker cannot spawn_agent');
    err.code = 'LEAF_NO_SPAWN';
    err.status = 403;
    throw err;
  }
  const registry = loadRegistry();
  if (registry?.agents) {
    const meta = registry.agents.find((a) => a.id === agentId);
    if (meta && meta.enabled === false) {
      const err = new Error(`agent ${agentId} disabled`);
      err.code = 'AGENT_DISABLED';
      err.status = 400;
      throw err;
    }
  }
  validateBrief({
    ...brief,
    spawn_role: spawnRole,
    untrusted: brief.untrusted || { csv_text: '', web_snippets: [], retrieved: [] },
  });
  return agentId;
}

function ensureChildSteps(parentJob) {
  if (!Array.isArray(parentJob.child_steps)) parentJob.child_steps = [];
  return parentJob.child_steps;
}

/**
 * @param {object} parentJob
 * @param {object} brief TaskBrief
 * @returns {Promise<object>} step with artifact
 */
async function spawnAgent(parentJob, brief) {
  const agentId = assertLeafBrief(brief, parentJob);
  stripUntrustedOverrides(brief);
  const toolsAllow = freezeToolsAllow(agentId, brief.tools_allow);
  brief.tools_allow = toolsAllow;
  const steps = ensureChildSteps(parentJob);
  const taskId = String(brief.task_id || crypto.randomUUID());
  const idempotencyKey = `${parentJob.id}:${taskId}`;
  const workerId = `${process.pid}:${crypto.randomUUID()}`;
  let step = steps.find((item) => String(item.id) === taskId);
  if (!step) {
    step = {
      id: taskId,
      agent_id: agentId,
      status: 'queued',
      spawn_role: 'leaf',
      parent_task_id: brief.parent_task_id || parentJob.id,
      objective: brief.objective || null,
      tools_allow: toolsAllow,
      idempotency_key: idempotencyKey,
      started_at: null,
      finished_at: null,
      error: null,
      artifact: null,
    };
    steps.push(step);
  }
  parentJob.updated_at = nowIso();

  step.status = 'running';
  step.started_at = nowIso();
  try {
    const execution = await runIdempotentActivity({
      jobId: parentJob.id,
      stepId: taskId,
      idempotencyKey,
      workerId,
      stepPayload: step,
      execute: async ({ assertLease, heartbeat }) => {
        const worker = WORKERS[agentId]();
        const artifact = await worker.run(brief, {
          parentJob,
          step,
          assertLease,
          heartbeat,
          idempotencyKey,
        });
        if (artifact?.status === 'failed') {
          const error = new Error(artifact.summary || `${agentId} failed`);
          error.code = 'WORKER_FAILED';
          error.artifact = artifact;
          throw error;
        }
        return artifact;
      },
    });
    const artifact = execution.result;
    step.artifact = artifact;
    step.replayed = execution.replayed;
    step.skipped = execution.skipped;
    step.status = ['ok', 'partial', 'need_input'].includes(artifact?.status)
      ? artifact.status
      : 'failed';
    if (artifact?.status === 'failed') step.error = artifact.summary || 'failed';
  } catch (e) {
    step.status = 'failed';
    step.error = e.message || String(e);
    step.artifact = e.artifact || {
      status: 'failed',
      summary: step.error,
      agent_id: agentId,
    };
  }
  step.finished_at = nowIso();
  parentJob.updated_at = nowIso();
  return step;
}

/**
 * Wait until listed child steps are terminal (or timeout).
 */
async function awaitSteps(parentJob, stepIds, { timeoutMs = 600_000, pollMs = 200 } = {}) {
  const ids = new Set((stepIds || []).map(String));
  const terminal = new Set(['done', 'failed', 'cancelled', 'partial', 'ok']);
  // Our statuses: done/failed/partial — map ok from artifact already folded into status
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const steps = ensureChildSteps(parentJob).filter((s) => ids.has(String(s.id)));
    if (steps.length === ids.size && steps.every((s) => terminal.has(s.status) || s.status === 'ok')) {
      return { action: 'ready', steps };
    }
    // spawn is currently sync-awaited inside spawnAgent, so usually already done
    await new Promise((r) => setTimeout(r, pollMs));
    if (steps.length === ids.size && steps.every((s) => s.status !== 'running' && s.status !== 'queued')) {
      return { action: 'ready', steps };
    }
  }
  return {
    action: 'timeout',
    steps: ensureChildSteps(parentJob).filter((s) => ids.has(String(s.id))),
  };
}

function publicChildSteps(parentJob) {
  return (parentJob.child_steps || []).map((s) => ({
    id: s.id,
    agent_id: s.agent_id,
    status: s.status,
    objective: s.objective,
    error: s.error,
    started_at: s.started_at,
    finished_at: s.finished_at,
    summary: s.artifact?.summary || null,
  }));
}

module.exports = {
  spawnAgent,
  awaitSteps,
  publicChildSteps,
  WORKERS: Object.keys(WORKERS),
};
