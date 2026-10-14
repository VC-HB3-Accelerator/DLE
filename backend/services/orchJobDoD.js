'use strict';

/**
 * Job steps + Definition of Done for listing_media_batch.
 * Job must not claim "done" until DoD items pass (or target failed/skipped intentionally).
 */

const STEP_IDS = ['brief', 'search_pool', 'soft_ask_keep', 'generate', 'dod_gate'];

function nowIso() {
  return new Date().toISOString();
}

function initialSteps() {
  return STEP_IDS.map((id) => ({
    id,
    status: 'pending',
    detail: null,
    updated_at: null,
  }));
}

function listingDefinitionOfDone() {
  return [
    {
      id: 'targets_terminal',
      label: 'Каждый target: done | failed | skipped',
    },
    {
      id: 'pool_or_failed',
      label: 'У успешных target есть pool_id и ≥1 keep',
    },
    {
      id: 'gen_or_failed',
      label: 'У успешных target есть ≥1 gen_files',
    },
    {
      id: 'quality_accepted',
      label: 'У успешных target critic и acceptor приняли результат',
    },
    {
      id: 'ingest_or_noted',
      label: 'У успешных target есть ingest items или явная ошибка ingest',
    },
    {
      id: 'video_or_asked',
      label: 'У успешных target видео есть, явно пропущено или спросили',
    },
    {
      id: 'no_hanging_wait',
      label: 'Нет waiting_human без deadline',
    },
  ];
}

function setStep(job, stepId, status, detail = null) {
  if (!job.steps) job.steps = initialSteps();
  let step = job.steps.find((s) => s.id === stepId);
  if (!step) {
    step = { id: stepId, status: 'pending', detail: null, updated_at: null };
    job.steps.push(step);
  }
  step.status = status;
  if (detail != null) step.detail = String(detail).slice(0, 240);
  step.updated_at = nowIso();
  job.updated_at = nowIso();
  return step;
}

function syncStepsFromCursor(job) {
  const phase = job.cursor?.phase;
  const status = job.status;
  if (!job.steps) job.steps = initialSteps();

  if (phase === 'soft_ask_brief') {
    setStep(job, 'brief', 'waiting_human');
  } else if (phase === 'search_pool') {
    setStep(job, 'brief', 'done');
    setStep(job, 'search_pool', 'running');
  } else if (phase === 'soft_ask_keep') {
    setStep(job, 'search_pool', 'done');
    setStep(job, 'soft_ask_keep', 'waiting_human');
  } else if (phase === 'generate') {
    setStep(job, 'soft_ask_keep', 'done');
    setStep(job, 'generate', 'running');
  } else if (phase === 'ask_video') {
    setStep(job, 'generate', 'waiting_human', 'ask_video');
  } else if (phase === 'done' || status === 'done' || status === 'partial') {
    setStep(job, 'generate', 'done');
    setStep(job, 'dod_gate', status === 'failed' ? 'failed' : 'done');
  } else if (status === 'failed') {
    setStep(job, 'dod_gate', 'failed', job.targets?.find((t) => t.error)?.error);
  } else if (status === 'cancelled') {
    job.steps.forEach((s) => {
      if (s.status === 'running' || s.status === 'waiting_human' || s.status === 'pending') {
        s.status = 'cancelled';
        s.updated_at = nowIso();
      }
    });
  }
}

/**
 * @returns {{ ok: boolean, items: Array<{id,label,ok,detail?}>, blocking: string[] }}
 */
function evaluateListingDod(job) {
  const items = [];
  const targets = Array.isArray(job.targets) ? job.targets : [];
  const terminal = new Set(['done', 'failed', 'skipped']);

  const allTerminal = targets.length > 0 && targets.every((t) => terminal.has(t.status));
  items.push({
    id: 'targets_terminal',
    label: 'Каждый target: done | failed | skipped',
    ok: allTerminal,
    detail: targets.map((t) => `${t.brand} ${t.model}:${t.status}`).join('; '),
  });

  const successTargets = targets.filter((t) => t.status === 'done');
  const poolOk =
    successTargets.length === 0 ||
    successTargets.every((t) => t.pool_id && Array.isArray(t.keep) && t.keep.length >= 1);
  items.push({
    id: 'pool_or_failed',
    label: 'У успешных target есть pool_id и ≥1 keep',
    ok: poolOk,
    detail: successTargets.map((t) => `${t.id}:keep=${(t.keep || []).length}`).join('; ') || 'n/a',
  });

  const genOk =
    successTargets.length === 0 ||
    successTargets.every((t) => Array.isArray(t.gen_files) && t.gen_files.length >= 1);
  items.push({
    id: 'gen_or_failed',
    label: 'У успешных target есть ≥1 gen_files',
    ok: genOk,
    detail: successTargets.map((t) => `${t.id}:gen=${(t.gen_files || []).length}`).join('; ') || 'n/a',
  });

  const qualityOk =
    successTargets.length === 0 ||
    successTargets.every(
      (t) =>
        t.critic_summary?.status === 'ok' &&
        t.acceptor_summary?.accepted === true
    );
  items.push({
    id: 'quality_accepted',
    label: 'У успешных target critic и acceptor приняли результат',
    ok: qualityOk,
    detail:
      successTargets
        .map(
          (t) =>
            `${t.id}:critic=${t.critic_summary?.status || 'missing'},acceptor=${
              t.acceptor_summary?.accepted === true ? 'accepted' : 'missing'
            }`
        )
        .join('; ') || 'n/a',
  });

  const ingestOk =
    successTargets.length === 0 ||
    successTargets.every(
      (t) =>
        (Array.isArray(t.ingest?.items) && t.ingest.items.length >= 1) ||
        Boolean(t.ingest?.errors?.length)
    );
  items.push({
    id: 'ingest_or_noted',
    label: 'У успешных target есть ingest items или явная ошибка ingest',
    ok: ingestOk,
    detail:
      successTargets
        .map((t) => `${t.id}:ing=${(t.ingest?.items || []).length}`)
        .join('; ') || 'n/a',
  });

  const videoOk =
    successTargets.length === 0 ||
    successTargets.every(
      (t) =>
        Boolean(t.video_summary?.file) ||
        t.video_decision === 'skip' ||
        t.video_summary?.skipped === true ||
        Boolean(job.seed_pool_id)
    );
  items.push({
    id: 'video_or_asked',
    label: 'У успешных target видео есть, явно пропущено или спросили',
    ok: videoOk,
    detail:
      successTargets
        .map(
          (t) =>
            `${t.id}:video=${t.video_summary?.file ? 'file' : t.video_decision || t.video_summary?.status || 'missing'}`
        )
        .join('; ') || 'n/a',
  });

  const hanging =
    job.status === 'waiting_human' &&
    !job.soft_ask?.deadline_at &&
    (job.cursor?.phase === 'soft_ask_brief' || job.cursor?.phase === 'soft_ask_keep');
  items.push({
    id: 'no_hanging_wait',
    label: 'Нет waiting_human без deadline',
    ok: !hanging,
    detail: hanging ? String(job.cursor?.phase) : 'ok',
  });

  const blocking = items.filter((i) => !i.ok).map((i) => i.id);
  return { ok: blocking.length === 0, items, blocking };
}

/**
 * Close job only if DoD passes. Otherwise stay partial/failed with dod report.
 */
function finalizeJobWithDod(job) {
  const report = evaluateListingDod(job);
  job.definition_of_done = {
    items: report.items,
    ok: report.ok,
    evaluated_at: nowIso(),
  };
  syncStepsFromCursor(job);

  if (!report.ok) {
    if (job.status === 'done') {
      job.status = 'partial';
    }
    setStep(job, 'dod_gate', 'failed', `blocking:${report.blocking.join(',')}`);
    job.updated_at = nowIso();
    return { closed: false, report };
  }

  const anyFail = (job.targets || []).some((t) => t.status === 'failed');
  const anyDone = (job.targets || []).some((t) => t.status === 'done');
  if (anyFail && anyDone) job.status = 'partial';
  else if (anyFail && !anyDone) job.status = 'failed';
  else job.status = 'done';
  job.cursor.phase = 'done';
  setStep(job, 'dod_gate', 'done');
  job.updated_at = nowIso();
  return { closed: true, report };
}

module.exports = {
  STEP_IDS,
  initialSteps,
  listingDefinitionOfDone,
  setStep,
  syncStepsFromCursor,
  evaluateListingDod,
  finalizeJobWithDod,
};
