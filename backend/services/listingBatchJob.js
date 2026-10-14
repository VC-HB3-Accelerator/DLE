'use strict';

/**
 * Listing media batch job contract + soft-ask helpers (lab).
 * Schema: orchestrator/schemas/listing-batch-job.schema.json
 */

const crypto = require('crypto');
const path = require('path');
const { needsBrief, buildBrief, buildBriefSync, applyBriefAnswers } = require('./listingBrief');
const {
  initialSteps,
  listingDefinitionOfDone,
  setStep,
  syncStepsFromCursor,
  finalizeJobWithDod,
} = require('./orchJobDoD');

const KIND = 'listing_media_batch';
const DEFAULT_IMAGE_MODEL = process.env.QWEN_IMAGE_MODEL || null;
const DEFAULT_TIMEOUT = Number(process.env.ORCH_SOFT_ASK_TIMEOUT_SEC || 120);
const DEFAULT_CONTINUE = process.env.ORCH_SOFT_ASK_CONTINUE_POLICY || 'auto';

function slugifyPart(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[ё]/g, 'е')
    .replace(/[^a-z0-9а-яa-z]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'item';
}

function albumSlug(brand, model) {
  return `${slugifyPart(brand)}-${slugifyPart(model)}`;
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * @param {object} opts
 * @param {Array<{brand:string,model:string}>} opts.targets
 * @param {string} [opts.userPrompt]
 * @param {string|null} [opts.sourceFile]
 * @param {number} opts.ownerUserId
 * @param {number} opts.targetOwnerUserId
 * @param {number} [opts.softAskTimeoutSec]
 * @param {'auto'|'pause'|'fail'} [opts.continuePolicy]
 */
function createListingBatchJob(opts) {
  const targetsIn = Array.isArray(opts.targets) ? opts.targets : [];
  if (!targetsIn.length) throw new Error('listing_batch: empty targets');

  const timeoutSec = Math.min(
    3600,
    Math.max(30, Number(opts.softAskTimeoutSec || DEFAULT_TIMEOUT) || 120)
  );
  const continuePolicy = ['auto', 'pause', 'fail'].includes(opts.continuePolicy)
    ? opts.continuePolicy
    : DEFAULT_CONTINUE;

  const userPrompt = String(opts.userPrompt || '').trim();

  const targets = targetsIn.map((t, i) => {
    const brand = String(t.brand || '').trim();
    const model = String(t.model || '').trim();
    if (!brand || !model) throw new Error(`listing_batch: bad target #${i}`);
    return {
      id: t.id || `t${i + 1}-${slugifyPart(brand)}-${slugifyPart(model)}`,
      brand,
      model,
      album_slug: albumSlug(brand, model),
      status: 'queued',
      pool_id: null,
      pool_dir: null,
      keep: [],
      keep_target: Number(t.keep_target || opts.poolTarget || 8),
      websites: Array.isArray(t.websites) ? t.websites : [],
      brief: t.brief || null,
      gen_dir: null,
      album_dir: null,
      cycles: 0,
      error: null,
      engines: [],
      critic_summary: {},
      acceptor_summary: null,
      video_decision: null,
      video_summary: null,
      album_manifest: null,
    };
  });

  const runMode = ['ask', 'plan', 'execute'].includes(opts.runMode) ? opts.runMode : 'plan';
  const plan = {
    version: 1,
    target_count: targets.length,
    targets: targets.map((target) => ({
      id: target.id,
      label: `${target.brand} ${target.model}`,
      keep_target: target.keep_target,
    })),
    side_effects: [
      'internet_search',
      'paid_image_generation',
      'paid_video_generation',
      'media_library_ingest',
    ],
    target_owner_user_id: Number(opts.targetOwnerUserId),
    publish_listing: false,
    requires_approval: runMode === 'plan',
  };

  return {
    id: opts.id || crypto.randomUUID(),
    kind: KIND,
    status: 'queued',
    run_mode: runMode,
    owner_user_id: Number(opts.ownerUserId),
    target_owner_user_id: Number(opts.targetOwnerUserId),
    skill_id: 'listing-package-8plus1',
    user_prompt: userPrompt,
    source_file: opts.sourceFile || null,
    plan,
    approval: null,
    image_model: opts.imageModel || DEFAULT_IMAGE_MODEL,
    photo_recipe: 'listing-package-8plus1/photo-recipe.md',
    soft_ask: {
      timeout_sec: timeoutSec,
      continue_policy: continuePolicy,
      on_human_edit: 'retry_target_cycle',
      asked_at: null,
      deadline_at: null,
      last_response: null,
    },
    cursor: { target_index: 0, phase: 'parse' },
    targets,
    steps: initialSteps(),
    definition_of_done: {
      template: listingDefinitionOfDone(),
      items: [],
      ok: false,
      evaluated_at: null,
    },
    limits: {
      max_parallel_targets: 1,
      max_cycles_per_target: 5,
      pool_target: Number(opts.poolTarget || 8),
    },
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

function currentTarget(job) {
  const i = job.cursor?.target_index ?? 0;
  return job.targets[i] || null;
}

function targetNeedsBrief(job, t) {
  if (!t) return false;
  return needsBrief(t.brand, t.model, job.user_prompt, t.brief);
}

/** Enter soft-ask brief (generation/color) before search. LLM fills generation options. */
async function enterSoftAskBrief(job) {
  const asked = new Date();
  const sec = Number(job.soft_ask?.timeout_sec || DEFAULT_TIMEOUT);
  const t = currentTarget(job);
  let briefUi = null;
  if (t) {
    try {
      briefUi = await buildBrief(t.brand, t.model, job.user_prompt);
    } catch (e) {
      briefUi = buildBriefSync(t.brand, t.model, job.user_prompt);
      briefUi.options_source = `fallback:${e.message || 'build_failed'}`;
    }
  }
  job.status = 'waiting_human';
  job.cursor.phase = 'soft_ask_brief';
  job.soft_ask.asked_at = asked.toISOString();
  job.soft_ask.deadline_at = new Date(asked.getTime() + sec * 1000).toISOString();
  job.soft_ask.last_response = null;
  if (t) t.status = 'waiting_brief';
  job._lastAsk = {
    type: 'soft_ask',
    question_id: 'brief_identity',
    prompt: briefUi?.prompt,
    timeout_sec: sec,
    continue_policy: job.soft_ask.continue_policy,
    deadline_at: job.soft_ask.deadline_at,
    brief: briefUi,
  };
  job.updated_at = nowIso();
  syncStepsFromCursor(job);
  return job._lastAsk;
}

/** Enter soft-ask keep gate for current target. */
function enterSoftAsk(job) {
  const asked = new Date();
  const sec = Number(job.soft_ask?.timeout_sec || DEFAULT_TIMEOUT);
  job.status = 'waiting_human';
  job.cursor.phase = 'soft_ask_keep';
  job.soft_ask.asked_at = asked.toISOString();
  job.soft_ask.deadline_at = new Date(asked.getTime() + sec * 1000).toISOString();
  job.soft_ask.last_response = null;
  const t = currentTarget(job);
  if (t) t.status = 'waiting_keep';
  job.updated_at = nowIso();
  const ask = {
    type: 'soft_ask',
    question_id: 'keep_pool',
    prompt: t
      ? `Пул для ${t.brand} ${t.model}: оставьте до ${t.keep_target} фото (✕ = убрать). Молчание ${sec}с → продолжим автоматически.`
      : 'Проверьте пул фото',
    timeout_sec: sec,
    continue_policy: job.soft_ask.continue_policy,
    deadline_at: job.soft_ask.deadline_at,
  };
  job._lastAsk = ask;
  syncStepsFromCursor(job);
  return ask;
}

/**
 * Human answered while waiting_human.
 * @returns {Promise<{ action: 'retry_cycle'|'continue'|'cancel'|'search'|'done'|'next_target'|'brief', job }>}
 */
async function applyHumanResponse(job, response) {
  const type = String(response?.type || '').toLowerCase();
  job.soft_ask.last_response = {
    type,
    files: Array.isArray(response?.files) ? response.files : undefined,
    text: response?.text || undefined,
    answers: response?.answers || undefined,
    at: nowIso(),
  };
  job.updated_at = nowIso();

  if (type === 'cancel') {
    job.status = 'cancelled';
    job.cursor.phase = 'done';
    return { action: 'cancel', job };
  }

  const t = currentTarget(job);
  const phase = job.cursor?.phase;

  if (phase === 'ask_video') {
    const answer = String(response?.answers?.video || response?.type || 'skip').toLowerCase();
    if (t) t.video_decision = answer === 'generate' ? 'generate' : 'skip';
    job.status = 'running';
    job.cursor.phase = 'generate';
    if (t) t.status = 'generating';
    return { action: 'continue', job };
  }

  // Brief gate
  if (phase === 'soft_ask_brief' || type === 'brief') {
    const briefUi =
      job._lastAsk?.brief || (t ? buildBriefSync(t.brand, t.model, job.user_prompt) : null);
    if (t) {
      t.brief = applyBriefAnswers(briefUi, response?.answers || {}, t.brand, t.model);
    }
    job.status = 'running';
    job.cursor.phase = 'search_pool';
    if (t) t.status = 'searching';
    job.soft_ask.asked_at = null;
    job.soft_ask.deadline_at = null;
    return { action: 'search', job };
  }

  if (type === 'drop' || type === 'keep') {
    if (t && Array.isArray(response.files)) t.keep = response.files.slice();
    if (t) {
      t.cycles = (t.cycles || 0) + 1;
      const maxC = job.limits?.max_cycles_per_target || 5;
      if (t.cycles > maxC) {
        t.status = 'failed';
        t.error = 'max_cycles_exceeded';
        return await advanceToNextTarget(job);
      }
    }
    job.status = 'running';
    job.cursor.phase = 'search_pool';
    if (t) t.status = 'searching';
    job.soft_ask.asked_at = null;
    job.soft_ask.deadline_at = null;
    return { action: 'retry_cycle', job };
  }

  // continue / approve keep as-is
  if (t && Array.isArray(response?.files) && response.files.length) {
    t.keep = response.files.slice();
  }
  job.status = 'running';
  job.cursor.phase = 'generate';
  if (t) t.status = 'generating';
  job.soft_ask.asked_at = null;
  job.soft_ask.deadline_at = null;
  return { action: 'continue', job };
}

/**
 * Poll soft-ask deadline. If expired → continue_policy.
 * @returns {{ action: 'wait'|'continue'|'pause'|'fail'|'search', job, ask?: object }}
 */
function tickSoftAsk(job, { now = Date.now() } = {}) {
  const phase = job.cursor?.phase;
  if (
    job.status !== 'waiting_human' ||
    (phase !== 'soft_ask_keep' && phase !== 'soft_ask_brief')
  ) {
    return { action: 'wait', job };
  }
  const deadline = job.soft_ask?.deadline_at ? Date.parse(job.soft_ask.deadline_at) : 0;
  if (!deadline || now < deadline) {
    return { action: 'wait', job };
  }

  const policy = job.soft_ask?.continue_policy || 'auto';
  if (policy === 'pause') {
    return { action: 'pause', job };
  }
  if (policy === 'fail') {
    job.status = 'failed';
    const t = currentTarget(job);
    if (t) {
      t.status = 'failed';
      t.error = 'soft_ask_timeout';
    }
    job.updated_at = nowIso();
    return { action: 'fail', job };
  }

  const t = currentTarget(job);
  job.soft_ask.last_response = { type: 'auto_continue', at: nowIso() };

  if (phase === 'soft_ask_brief') {
    const briefUi =
      job._lastAsk?.brief || (t ? buildBriefSync(t.brand, t.model, job.user_prompt) : null);
    if (t) t.brief = applyBriefAnswers(briefUi, { generation: 'any', color: 'any' }, t.brand, t.model);
    job.status = 'running';
    job.cursor.phase = 'search_pool';
    if (t) t.status = 'searching';
    job.soft_ask.asked_at = null;
    job.soft_ask.deadline_at = null;
    job.updated_at = nowIso();
    return { action: 'search', job };
  }

  // auto keep → generate
  job.status = 'running';
  job.cursor.phase = 'generate';
  if (t) t.status = 'generating';
  job.soft_ask.asked_at = null;
  job.soft_ask.deadline_at = null;
  job.updated_at = nowIso();
  return { action: 'continue', job };
}

async function advanceToNextTarget(job) {
  const next = (job.cursor.target_index || 0) + 1;
  if (next >= job.targets.length) {
    job.cursor.target_index = Math.min(next, job.targets.length - 1);
    const fin = finalizeJobWithDod(job);
    return { action: fin.closed ? 'done' : 'partial_dod', job };
  }
  job.cursor.target_index = next;
  const t = job.targets[next];
  if (targetNeedsBrief(job, t)) {
    await enterSoftAskBrief(job);
    return { action: 'brief', job };
  }
  job.cursor.phase = 'search_pool';
  job.status = 'running';
  t.status = 'searching';
  job.updated_at = nowIso();
  syncStepsFromCursor(job);
  return { action: 'next_target', job };
}

function albumPathFor(job, target) {
  const owner = job.target_owner_user_id;
  return path.join(
    'uploads',
    'content',
    'media',
    'owners',
    String(owner),
    'listings',
    target.album_slug
  );
}

module.exports = {
  KIND,
  DEFAULT_IMAGE_MODEL,
  createListingBatchJob,
  currentTarget,
  targetNeedsBrief,
  enterSoftAskBrief,
  enterSoftAsk,
  applyHumanResponse,
  tickSoftAsk,
  advanceToNextTarget,
  albumPathFor,
  albumSlug,
  setStep,
  syncStepsFromCursor,
  finalizeJobWithDod,
};
