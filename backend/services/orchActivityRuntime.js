'use strict';

const DEFAULT_LEASE_MS = 5 * 60 * 1000;

function activityError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

async function runIdempotentActivity({
  jobId,
  stepId,
  idempotencyKey,
  workerId,
  stepPayload = {},
  execute,
  store = require('./orchJobStore'),
  leaseMs = DEFAULT_LEASE_MS,
}) {
  if (!jobId || !stepId || !idempotencyKey || !workerId || typeof execute !== 'function') {
    throw activityError('BAD_ACTIVITY', 'Для activity нужны job, step, key, worker и execute');
  }

  const claim = await store.claimStep({
    jobId,
    stepId,
    idempotencyKey,
    workerId,
    leaseMs,
    payload: stepPayload,
  });
  if (!claim?.acquired) {
    if (['done', 'ok', 'partial'].includes(claim?.status)) {
      return { result: claim.result, replayed: true, skipped: 'already_done' };
    }
    throw activityError(
      'STEP_LEASE_BUSY',
      `Шаг ${stepId} уже выполняется другим worker`,
      { retryAt: claim?.lease_expires_at || null }
    );
  }

  const assertLease = () => store.assertStepLease({ jobId, stepId, workerId });
  const heartbeat = () => store.heartbeatStep({ jobId, stepId, workerId, leaseMs });

  try {
    await assertLease();
    const result = await execute({ assertLease, heartbeat });
    await assertLease();
    const completed = await store.completeStep({ jobId, stepId, workerId, result });
    return { result: completed.result, replayed: false, skipped: null };
  } catch (error) {
    await store.failStep({
      jobId,
      stepId,
      workerId,
      error: {
        code: error?.code || null,
        message: error?.message || String(error),
      },
    }).catch(() => {});
    throw error;
  }
}

module.exports = {
  DEFAULT_LEASE_MS,
  runIdempotentActivity,
};
