'use strict';

function defaultQuery(...args) {
  return require('../db').getQuery()(...args);
}

function isoDate(value, fallback = null) {
  if (value == null) return fallback;
  const date = value instanceof Date
    ? value
    : new Date(typeof value === 'number' ? value : String(value));
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function nullableUserId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function stepId(step, index) {
  return String(step?.id || step?.step_id || step?.name || `step-${index}`);
}

function serializeSteps(job) {
  const workflowSteps = Array.isArray(job?.steps) ? job.steps : [];
  const childSteps = Array.isArray(job?.child_steps) ? job.child_steps : [];
  return [...workflowSteps, ...childSteps].map((step, index) => ({
    step_id: stepId(step, index),
    status: String(step?.status || 'pending'),
    payload: step,
    created_at: isoDate(step?.created_at || step?.createdAt),
    updated_at: isoDate(step?.updated_at || step?.updatedAt),
    finished_at: isoDate(step?.finished_at || step?.finishedAt),
  }));
}

function mapJobRow(row) {
  if (!row) return null;
  const payload = row.payload && typeof row.payload === 'object' ? { ...row.payload } : {};
  const persistedSteps = Array.isArray(row.persisted_steps)
    ? row.persisted_steps.map((entry) => {
      if (!entry || typeof entry !== 'object' || !entry.payload) return entry;
      const step = { ...entry.payload };
      if (entry.idempotency_key) step.idempotency_key = entry.idempotency_key;
      if (entry.result != null && step.agent_id) step.artifact = entry.result;
      if (entry.status) step.status = entry.status;
      if (entry.attempt != null) step.attempt = Number(entry.attempt);
      return step;
    }).filter(Boolean)
    : null;
  const workflowSteps = persistedSteps?.filter((step) => !step?.agent_id);
  const childSteps = persistedSteps?.filter((step) => Boolean(step?.agent_id));
  return {
    ...payload,
    id: row.id,
    kind: row.kind,
    status: row.status,
    run_mode: row.run_mode ?? payload.run_mode,
    owner_user_id: row.owner_user_id ?? payload.owner_user_id,
    target_owner_user_id: row.target_owner_user_id ?? payload.target_owner_user_id,
    steps: workflowSteps?.length ? workflowSteps : (payload.steps || []),
    child_steps: childSteps?.length ? childSteps : (payload.child_steps || []),
    created_at: payload.created_at || row.created_at,
    updated_at: payload.updated_at || row.updated_at,
    finished_at: payload.finished_at || row.finished_at,
    _store_version: Number(row.version) || 1,
  };
}

function createJobStore({ query = defaultQuery } = {}) {
  async function saveJob(job) {
    if (!job?.id) throw new Error('orchJobStore.saveJob: job.id is required');
    const now = new Date().toISOString();
    const createdAt = isoDate(job.created_at || job.createdAt, now);
    const updatedAt = isoDate(job.updated_at || job.updatedAt, now);
    const terminal = ['done', 'failed', 'error', 'cancelled', 'partial'].includes(job.status);
    const finishedAt = isoDate(job.finished_at || job.finishedAt, terminal ? updatedAt : null);
    const steps = serializeSteps(job);
    const { rows } = await query(
      `WITH saved AS (
         INSERT INTO orchestrator_jobs (
           id, kind, status, run_mode, owner_user_id, target_owner_user_id,
           payload, created_at, updated_at, finished_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           kind = EXCLUDED.kind,
           status = EXCLUDED.status,
           run_mode = EXCLUDED.run_mode,
           owner_user_id = EXCLUDED.owner_user_id,
           target_owner_user_id = EXCLUDED.target_owner_user_id,
           payload = EXCLUDED.payload,
           version = orchestrator_jobs.version + 1,
           updated_at = EXCLUDED.updated_at,
           finished_at = EXCLUDED.finished_at
         WHERE $12::integer IS NULL OR orchestrator_jobs.version = $12
         RETURNING *
       ), removed AS (
         DELETE FROM orchestrator_job_steps
         WHERE job_id = $1
           AND EXISTS (SELECT 1 FROM saved)
           AND NOT EXISTS (
             SELECT 1
             FROM jsonb_array_elements($8::jsonb) AS kept
             WHERE kept->>'step_id' = orchestrator_job_steps.step_id
           )
       ), inserted AS (
         INSERT INTO orchestrator_job_steps (
           job_id, step_id, status, payload, created_at, updated_at, finished_at
         )
         SELECT
           $1,
           item->>'step_id',
           item->>'status',
           item->'payload',
           COALESCE((item->>'created_at')::timestamptz, $9),
           COALESCE((item->>'updated_at')::timestamptz, $10),
           (item->>'finished_at')::timestamptz
         FROM jsonb_array_elements($8::jsonb) AS item
         CROSS JOIN saved
         ON CONFLICT (job_id, step_id) DO UPDATE SET
           status = EXCLUDED.status,
           payload = EXCLUDED.payload,
           updated_at = EXCLUDED.updated_at,
           finished_at = EXCLUDED.finished_at
       )
       SELECT * FROM saved`,
      [
        String(job.id),
        String(job.kind || 'orchestrator_job'),
        String(job.status || 'queued'),
        job.run_mode ? String(job.run_mode) : null,
        nullableUserId(job.owner_user_id ?? job.ownerUserId),
        nullableUserId(job.target_owner_user_id ?? job.targetOwnerUserId),
        JSON.stringify(job),
        JSON.stringify(steps),
        createdAt,
        updatedAt,
        finishedAt,
        Number.isInteger(Number(job._store_version)) ? Number(job._store_version) : null,
      ]
    );
    if (!rows[0]) {
      const error = new Error(`Job ${job.id} изменён другим worker`);
      error.code = 'JOB_VERSION_CONFLICT';
      error.status = 409;
      throw error;
    }
    const saved = mapJobRow({ ...rows[0], persisted_steps: steps });
    job._store_version = saved._store_version;
    return saved;
  }

  async function getJob(id) {
    const { rows } = await query(
      `SELECT j.*,
              COALESCE(
                jsonb_agg(
                  jsonb_build_object(
                    'step_id', s.step_id,
                    'status', s.status,
                    'payload', s.payload,
                    'idempotency_key', s.idempotency_key,
                    'result', s.result,
                    'attempt', s.attempt,
                    'created_at', s.created_at,
                    'updated_at', s.updated_at,
                    'finished_at', s.finished_at
                  ) ORDER BY s.created_at, s.step_id
                ) FILTER (WHERE s.step_id IS NOT NULL),
                '[]'::jsonb
              ) AS persisted_steps
       FROM orchestrator_jobs j
       LEFT JOIN orchestrator_job_steps s ON s.job_id = j.id
       WHERE j.id = $1
       GROUP BY j.id`,
      [String(id || '')]
    );
    return mapJobRow(rows[0]);
  }

  async function saveApproval(approval) {
    if (!approval?.job_id) throw new Error('orchJobStore.saveApproval: job_id is required');
    const { rows } = await query(
      `INSERT INTO orchestrator_approvals (
         job_id, step_id, status, scope, requested_by, decided_by,
         requested_at, decided_at, expires_at
       ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, COALESCE($7, NOW()), $8, $9)
       RETURNING *`,
      [
        String(approval.job_id),
        approval.step_id ? String(approval.step_id) : null,
        String(approval.status || 'proposed'),
        JSON.stringify(approval.scope || {}),
        nullableUserId(approval.requested_by),
        nullableUserId(approval.decided_by),
        isoDate(approval.requested_at),
        isoDate(approval.decided_at),
        isoDate(approval.expires_at),
      ]
    );
    return rows[0] || null;
  }

  async function getLatestApproval(jobId) {
    const { rows } = await query(
      `SELECT *
       FROM orchestrator_approvals
       WHERE job_id = $1
       ORDER BY requested_at DESC, id DESC
       LIMIT 1`,
      [String(jobId || '')]
    );
    return rows[0] || null;
  }

  async function decideApproval({ jobId, decision, decidedBy, planVersion }) {
    if (!['approved', 'rejected'].includes(decision)) {
      const error = new Error('Недопустимое решение approval');
      error.code = 'APPROVAL_DECISION_INVALID';
      error.status = 400;
      throw error;
    }
    const { rows } = await query(
      `UPDATE orchestrator_approvals
       SET status = $2,
           decided_by = $3,
           decided_at = NOW()
       WHERE id = (
         SELECT id
         FROM orchestrator_approvals
         WHERE job_id = $1
           AND status = 'proposed'
           AND scope->>'plan_version' = $4
         ORDER BY requested_at DESC, id DESC
         LIMIT 1
         FOR UPDATE
       )
       RETURNING *`,
      [
        String(jobId || ''),
        decision,
        nullableUserId(decidedBy),
        String(planVersion),
      ]
    );
    if (!rows[0]) {
      const error = new Error('План уже обработан или его версия изменилась');
      error.code = 'APPROVAL_STALE';
      error.status = 409;
      throw error;
    }
    return rows[0];
  }

  async function listRecentJobs({ ownerUserId, limit = 20 } = {}) {
    const params = [];
    let where = '';
    if (Number.isInteger(Number(ownerUserId)) && Number(ownerUserId) > 0) {
      params.push(Number(ownerUserId));
      where = 'WHERE owner_user_id = $1';
    }
    params.push(Math.min(50, Math.max(1, Number(limit) || 20)));
    const { rows } = await query(
      `SELECT id FROM orchestrator_jobs
       ${where}
       ORDER BY updated_at DESC
       LIMIT $${params.length}`,
      params
    );
    return Promise.all(rows.map((row) => getJob(row.id)));
  }

  async function listRecoverableJobs() {
    const { rows } = await query(
      `SELECT id FROM orchestrator_jobs
       WHERE status IN ('queued', 'running', 'waiting_human')
       ORDER BY updated_at ASC`
    );
    return Promise.all(rows.map((row) => getJob(row.id)));
  }

  async function cancelJob(jobId) {
    const { rows } = await query(
      `WITH cancelled AS (
         UPDATE orchestrator_jobs
         SET status = 'cancelled',
             payload = jsonb_set(payload, '{status}', '"cancelled"'::jsonb, true),
             version = version + 1,
             updated_at = NOW(),
             finished_at = NOW()
         WHERE id = $1
           AND status IN ('queued', 'running', 'waiting_human')
         RETURNING id
       )
       UPDATE orchestrator_job_steps
       SET status = 'cancelled',
           lease_owner = NULL,
           lease_expires_at = NULL,
           updated_at = NOW(),
           finished_at = NOW()
       WHERE job_id IN (SELECT id FROM cancelled)
         AND status NOT IN ('done', 'ok', 'partial', 'failed', 'cancelled')
       RETURNING job_id`,
      [String(jobId || '')]
    );
    const job = await getJob(jobId);
    if (!job || (job.status !== 'cancelled' && !rows.length)) {
      const error = new Error('Задачу нельзя отменить в текущем состоянии');
      error.code = 'JOB_NOT_CANCELLABLE';
      error.status = 409;
      throw error;
    }
    return job;
  }

  async function expireRecoverableLeases() {
    const { rowCount = 0 } = await query(
      `UPDATE orchestrator_job_steps s
       SET lease_expires_at = NOW(),
           updated_at = NOW()
       FROM orchestrator_jobs j
       WHERE j.id = s.job_id
         AND j.status IN ('queued', 'running')
         AND s.status = 'running'
         AND s.lease_owner IS NOT NULL`
    );
    return Number(rowCount) || 0;
  }

  async function assertJobActive(jobId) {
    const { rows } = await query(
      `SELECT 1
       FROM orchestrator_jobs
       WHERE id = $1
         AND status <> 'cancelled'`,
      [String(jobId || '')]
    );
    if (!rows[0]) {
      const error = new Error(`Задача ${jobId} отменена`);
      error.code = 'JOB_CANCELLED';
      error.status = 409;
      throw error;
    }
    return true;
  }

  async function claimStep({
    jobId,
    stepId,
    idempotencyKey,
    workerId,
    leaseMs = 300_000,
    payload = {},
  }) {
    const { rows } = await query(
      `WITH claimed AS (
         INSERT INTO orchestrator_job_steps (
           job_id, step_id, status, payload, idempotency_key,
           lease_owner, lease_expires_at, heartbeat_at, attempt, updated_at
         ) VALUES (
           $1, $2, 'running', $6::jsonb, $3,
           $4, NOW() + ($5::bigint * INTERVAL '1 millisecond'), NOW(), 1, NOW()
         )
         ON CONFLICT (job_id, step_id) DO UPDATE SET
           status = 'running',
           idempotency_key = COALESCE(orchestrator_job_steps.idempotency_key, EXCLUDED.idempotency_key),
           lease_owner = EXCLUDED.lease_owner,
           lease_expires_at = EXCLUDED.lease_expires_at,
           heartbeat_at = NOW(),
           attempt = orchestrator_job_steps.attempt + 1,
           updated_at = NOW()
         WHERE orchestrator_job_steps.status NOT IN ('done', 'ok', 'partial')
           AND (
             orchestrator_job_steps.lease_owner = $4
             OR orchestrator_job_steps.lease_expires_at IS NULL
             OR orchestrator_job_steps.lease_expires_at <= NOW()
           )
           AND (
             orchestrator_job_steps.idempotency_key IS NULL
             OR orchestrator_job_steps.idempotency_key = $3
           )
         RETURNING *, TRUE AS acquired
       )
       SELECT * FROM claimed
       UNION ALL
       SELECT existing.*, FALSE AS acquired
       FROM orchestrator_job_steps existing
       WHERE NOT EXISTS (SELECT 1 FROM claimed)
         AND (
           existing.idempotency_key = $3
           OR (existing.job_id = $1 AND existing.step_id = $2)
         )
       LIMIT 1`,
      [
        String(jobId),
        String(stepId),
        String(idempotencyKey),
        String(workerId),
        Number(leaseMs),
        JSON.stringify(payload || {}),
      ]
    );
    if (!rows[0]) {
      const error = new Error(`Конфликт idempotency key для шага ${stepId}`);
      error.code = 'IDEMPOTENCY_CONFLICT';
      error.status = 409;
      throw error;
    }
    return rows[0];
  }

  async function assertStepLease({ jobId, stepId, workerId }) {
    const { rows } = await query(
      `SELECT 1
       FROM orchestrator_job_steps
       WHERE job_id = $1
         AND step_id = $2
         AND status = 'running'
         AND lease_owner = $3
         AND lease_expires_at > NOW()
         AND EXISTS (
           SELECT 1 FROM orchestrator_jobs j
           WHERE j.id = orchestrator_job_steps.job_id
             AND j.status <> 'cancelled'
         )`,
      [String(jobId), String(stepId), String(workerId)]
    );
    if (!rows[0]) {
      const error = new Error(`Worker потерял lease шага ${stepId}`);
      error.code = 'STEP_LEASE_LOST';
      error.status = 409;
      throw error;
    }
    return true;
  }

  async function heartbeatStep({ jobId, stepId, workerId, leaseMs = 300_000 }) {
    const { rows } = await query(
      `UPDATE orchestrator_job_steps
       SET heartbeat_at = NOW(),
           lease_expires_at = NOW() + ($4::bigint * INTERVAL '1 millisecond'),
           updated_at = NOW()
       WHERE job_id = $1
         AND step_id = $2
         AND status = 'running'
         AND lease_owner = $3
         AND lease_expires_at > NOW()
         AND EXISTS (
           SELECT 1 FROM orchestrator_jobs j
           WHERE j.id = orchestrator_job_steps.job_id
             AND j.status <> 'cancelled'
         )
       RETURNING *`,
      [String(jobId), String(stepId), String(workerId), Number(leaseMs)]
    );
    if (!rows[0]) {
      const error = new Error(`Worker потерял lease шага ${stepId}`);
      error.code = 'STEP_LEASE_LOST';
      error.status = 409;
      throw error;
    }
    return rows[0];
  }

  async function completeStep({ jobId, stepId, workerId, result }) {
    const { rows } = await query(
      `UPDATE orchestrator_job_steps
       SET status = 'done',
           result = $4::jsonb,
           lease_owner = NULL,
           lease_expires_at = NULL,
           heartbeat_at = NOW(),
           updated_at = NOW(),
           finished_at = NOW()
       WHERE job_id = $1
         AND step_id = $2
         AND lease_owner = $3
         AND lease_expires_at > NOW()
         AND status = 'running'
         AND EXISTS (
           SELECT 1 FROM orchestrator_jobs j
           WHERE j.id = orchestrator_job_steps.job_id
             AND j.status <> 'cancelled'
         )
       RETURNING *`,
      [String(jobId), String(stepId), String(workerId), JSON.stringify(result ?? null)]
    );
    if (!rows[0]) {
      const error = new Error(`Результат шага ${stepId} отклонён: lease потерян`);
      error.code = 'STEP_LEASE_LOST';
      error.status = 409;
      throw error;
    }
    return rows[0];
  }

  async function failStep({ jobId, stepId, workerId, error: failure }) {
    const { rows } = await query(
      `UPDATE orchestrator_job_steps
       SET status = 'failed',
           result = $4::jsonb,
           lease_owner = NULL,
           lease_expires_at = NULL,
           heartbeat_at = NOW(),
           updated_at = NOW(),
           finished_at = NOW()
       WHERE job_id = $1
         AND step_id = $2
         AND lease_owner = $3
       RETURNING *`,
      [
        String(jobId),
        String(stepId),
        String(workerId),
        JSON.stringify({ error: failure || null }),
      ]
    );
    return rows[0] || null;
  }

  return {
    saveJob,
    getJob,
    saveApproval,
    getLatestApproval,
    decideApproval,
    listRecoverableJobs,
    listRecentJobs,
    cancelJob,
    expireRecoverableLeases,
    assertJobActive,
    claimStep,
    assertStepLease,
    heartbeatStep,
    completeStep,
    failStep,
  };
}

const defaultStore = createJobStore();

module.exports = {
  createJobStore,
  saveJob: defaultStore.saveJob,
  getJob: defaultStore.getJob,
  saveApproval: defaultStore.saveApproval,
  getLatestApproval: defaultStore.getLatestApproval,
  decideApproval: defaultStore.decideApproval,
  listRecoverableJobs: defaultStore.listRecoverableJobs,
  listRecentJobs: defaultStore.listRecentJobs,
  cancelJob: defaultStore.cancelJob,
  expireRecoverableLeases: defaultStore.expireRecoverableLeases,
  assertJobActive: defaultStore.assertJobActive,
  claimStep: defaultStore.claimStep,
  assertStepLease: defaultStore.assertStepLease,
  heartbeatStep: defaultStore.heartbeatStep,
  completeStep: defaultStore.completeStep,
  failStep: defaultStore.failStep,
};
