'use strict';

/**
 * Listing media batch runner for Media Agent UI.
 * Lead job: soft-ask brief → spawn research → soft-ask keep → spawn image → spawn critic → DoD.
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const listingPool = require('./listingImagePoolService');
const { briefQueryExtras } = require('./listingBrief');
const {
  createListingBatchJob,
  currentTarget,
  targetNeedsBrief,
  enterSoftAskBrief,
  enterSoftAsk,
  applyHumanResponse,
  tickSoftAsk,
  advanceToNextTarget,
  albumPathFor,
  setStep,
  syncStepsFromCursor,
} = require('./listingBatchJob');
const orchProviderBridge = require('./orchProviderBridge');
const { spawnAgent, publicChildSteps } = require('./orchSpawn');
const orchJobStore = require('./orchJobStore');
const { assertOwned } = require('./orchOwnerGuard');
const albumManifest = require('./listingAlbumManifest');

const logger = (() => {
  try {
    return require('../utils/logger');
  } catch {
    return { error: (...a) => console.error(...a), warn: (...a) => console.warn(...a), info: () => {} };
  }
})();

const JOBS = new Map();
const JOB_TTL_MS = 24 * 60 * 60 * 1000;
const ROOT = path.join(__dirname, '../uploads/media-agent/listing-batches');

function purge() {
  const now = Date.now();
  for (const [id, job] of JOBS.entries()) {
    const t = Date.parse(job.updated_at || job.created_at || 0);
    if (t && now - t > JOB_TTL_MS) JOBS.delete(id);
  }
}

async function saveBatch(job) {
  JOBS.set(job.id, job);
  await orchJobStore.saveJob(job);
  return job;
}

function orchRoot() {
  const candidates = [
    '/host-project/orchestrator',
    path.join(__dirname, '../../orchestrator'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(path.join(p, 'runtime/wanImage.js'))) return p;
  }
  return null;
}

function ensureOrchEnv() {
  // Live Settings first (product); orch .env only as lab fallback
  const root = orchRoot();
  if (!root) return;
  try {
    const { loadEnv } = require(path.join(root, 'runtime/loadEnv'));
    loadEnv(path.join(root, '.env'));
  } catch {
    /* ignore */
  }
}

async function ensureLiveProviders() {
  try {
    const bridge = require('./orchProviderBridge');
    return await bridge.applyLiveProvidersToEnv({ force: false });
  } catch (e) {
    ensureOrchEnv();
    return { ok: false, source: 'env_fallback', error: e.message };
  }
}

/**
 * Bare "КАМАЗ 65115" or multi-line list → targets[].
 */
function parseCsvTargets(message) {
  const text = String(message || '').trim();
  if (!text || !/[,;\t]/.test(text)) return [];
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (lines.length < 1) return [];
  const out = [];
  const seen = new Set();
  const header = lines[0].toLowerCase();
  const hasHeader = /brand|марка|model|модель/.test(header);
  const rows = hasHeader ? lines.slice(1) : lines;
  for (const line of rows) {
    const parts = line.split(/[,;\t]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const brand = parts[0];
    const model = parts.slice(1).join(' ');
    if (/^(brand|марка)$/i.test(brand)) continue;
    const key = `${brand}::${model}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      brand,
      model,
      keep_target: 8,
    });
  }
  return out;
}

function extractWebsites(message) {
  const text = String(message || '');
  const found = text.match(/https?:\/\/[^\s<>"']+/gi) || [];
  return [...new Set(found.map((url) => url.replace(/[.,);]+$/, '')))].slice(0, 8);
}

function parseBatchTargets(message) {
  const text = String(message || '').trim();
  if (!text) return [];

  const csvTargets = parseCsvTargets(text);
  if (csvTargets.length >= 1 && /[,;\t]/.test(text) && (csvTargets.length > 1 || /brand|марка|,|;|\t/.test(text.split('\n')[0] || ''))) {
    if (csvTargets.length > 1 || /brand|марка/i.test(text)) return csvTargets;
  }

  const batchHint =
    /пакет|batch|список|csv|для объявлен|listing\s*batch|по списку|все модели/i.test(text);

  const lines = text
    .split(/\r?\n|;/)
    .map((s) => s.trim())
    .filter(Boolean);

  const out = [];
  const seen = new Set();

  function pushTarget(brand, model, target) {
    const key = `${brand}::${model}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      brand,
      model,
      keep_target: Math.min(16, Math.max(4, Number(target) || 8)),
    });
  }

  for (const line of lines) {
    const pool = listingPool.parseListingPoolRequest(line);
    if (pool?.brand && pool?.model) {
      pushTarget(pool.brand, pool.model, pool.target);
      continue;
    }
    const m = line.match(/^([A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё0-9.\-]*)\s+(\S.*)$/u);
    if (
      m &&
      !/^(сделай|привет|помоги|нужно)/i.test(m[1]) &&
      (/\d/.test(m[2]) ||
        /prado|прадо|прада|land\s*cruiser|ленд|voyah|сany|sany|xcmg|zoomlion/i.test(m[2]))
    ) {
      pushTarget(m[1], m[2].trim(), 8);
    }
  }

  if (!out.length) {
    const one = listingPool.parseListingPoolRequest(text);
    if (one?.brand && one?.model) pushTarget(one.brand, one.model, one.target);
  }

  if (!out.length && batchHint) return [];
  return out;
}

function publicBatch(job) {
  if (!job || !Array.isArray(job.targets)) return null;
  const t = currentTarget(job);
  let pool = null;
  if (t?.pool_id) {
    const pj = listingPool.getJob(t.pool_id);
    pool = listingPool.publicJob(pj);
  }
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    run_mode: job.run_mode,
    owner_user_id: job.owner_user_id,
    target_owner_user_id: job.target_owner_user_id,
    source_file: job.source_file || null,
    plan: job.plan || null,
    approval: job.approval || null,
    user_prompt: job.user_prompt,
    image_model: job.image_model,
    soft_ask: job.soft_ask,
    cursor: job.cursor,
    steps: job.steps || [],
    definition_of_done: job.definition_of_done || null,
    providers: job._providers || null,
    image_route: job._lastImageRoute || null,
    child_steps: publicChildSteps(job),
    targets: job.targets.map((x) => ({
      id: x.id,
      brand: x.brand,
      model: x.model,
      album_slug: x.album_slug,
      status: x.status,
      keep_target: x.keep_target,
      keep: x.keep || [],
      brief: x.brief || null,
      cycles: x.cycles || 0,
      pool_id: x.pool_id,
      error: x.error,
      gen_files: x.gen_files || [],
      critic_summary: x.critic_summary || null,
      acceptor_summary: x.acceptor_summary || null,
      video_decision: x.video_decision || null,
      video_summary: x.video_summary || null,
      album_manifest: x.album_manifest || null,
      ingest: x.ingest || null,
      album_dir: x.album_dir || null,
    })),
    pool,
    ask: job._lastAsk || null,
    reply_hint: buildReply(job),
  };
}

function buildReply(job) {
  const t = currentTarget(job);
  if (!t) return 'Пакет завершён.';
  const idx = (job.cursor?.target_index || 0) + 1;
  const total = job.targets.length;
  if (job.cursor?.phase === 'soft_ask_brief' || t.status === 'waiting_brief') {
    const sec = job.soft_ask?.timeout_sec || 120;
    return (
      `[${idx}/${total}] Уточните поколение/годы и цвет для «${t.brand} ${t.model}». ` +
      `Молчание ${sec}с → ищу с параметром «не важно».`
    );
  }
  if (job.cursor?.phase === 'search_pool' || t.status === 'searching') {
    const b = t.brief?.labels;
    const extra = b ? ` (${b.generation || ''}, ${b.color || ''})` : '';
    return `[${idx}/${total}] Ищу 8 фото с разными ракурсами для «${t.brand} ${t.model}»${extra}…`;
  }
  if (job.status === 'waiting_human' && job.cursor?.phase === 'soft_ask_keep') {
    const sec = job.soft_ask?.timeout_sec || 120;
    return (
      `[${idx}/${total}] Пул «${t.brand} ${t.model}»: уберите лишнее (можно несколько) или «Продолжить». ` +
      `Молчание ${sec}с → продолжу сам.`
    );
  }
  if (job.cursor?.phase === 'ask_video' || t.status === 'waiting_video') {
    return `[${idx}/${total}] 8 фото «${t.brand} ${t.model}» приняты. Сгенерировать 1 видео или пропустить?`;
  }
  if (job.cursor?.phase === 'generate' || t.status === 'generating') {
    return `[${idx}/${total}] Генерирую кадры для «${t.brand} ${t.model}» (${job.image_model})…`;
  }
  if (t.status === 'done') {
    const n = (t.gen_files || []).length;
    return `[${idx}/${total}] «${t.brand} ${t.model}» готово (${n} файлов) → ${t.album_slug}`;
  }
  if (job.status === 'done') return 'Пакет listing batch завершён.';
  if (job.status === 'partial') return 'Пакет частично готов (есть ошибки по моделям).';
  if (job.status === 'failed') return `Пакет с ошибкой: ${t.error || 'failed'}`;
  return `[${idx}/${total}] Работаю над «${t.brand} ${t.model}»…`;
}

async function searchCurrentPool(job, { ownerUserId }) {
  assertExecutableMode(job);
  const t = currentTarget(job);
  if (!t) return job;
  await ensureLiveProviders();
  t.status = 'searching';
  job.cursor.phase = 'search_pool';
  job.status = 'running';
  job.updated_at = new Date().toISOString();
  setStep(job, 'search_pool', 'running');
  syncStepsFromCursor(job);

  const step = await spawnAgent(job, {
    task_id: `${job.id}:${t.id}:research`,
    agent_id: 'research',
    objective: `Набрать пул фото «${t.brand} ${t.model}» с разными ракурсами`,
    boundaries: 'Только интернет image search; без генерации',
    inputs: {
      brand: t.brand,
      model: t.model,
      target: t.keep_target || job.limits?.pool_target || 8,
      ownerUserId,
      brief: t.brief,
      queryExtras: briefQueryExtras(t.brief),
      websites: t.websites || job.websites || [],
    },
    output_schema: 'artifact.research_pool',
    tools_allow: ['search_web'],
    spawn_role: 'leaf',
    parent_task_id: job.id,
  });

  const data = step.artifact?.data;
  if (!data?.pool_id || !data.count) {
    t.status = 'failed';
    t.error = step.error || 'empty_pool';
    setStep(job, 'search_pool', 'failed', t.error);
    const advanced = await advanceToNextTarget(job);
    return advanced.job;
  }

  t.pool_id = data.pool_id;
  t.engines = data.engines || [];
  t.keep = (data.photos || []).map((p) => p.file);
  t.status = 'pool_ready';
  setStep(job, 'search_pool', 'done', step.artifact?.summary);

  const ask = enterSoftAsk(job);
  job._lastAsk = ask;
  return job;
}

async function runGenerateCurrent(job, { ownerUserId }) {
  assertExecutableMode(job);
  const t = currentTarget(job);
  if (!t) return job;
  if (t.acceptor_summary?.accepted && Array.isArray(t.gen_files) && t.gen_files.length && t.video_decision) {
    const genFiles = t.gen_files;
    if (t.video_decision === 'generate') {
      const videoStep = await spawnAgent(job, {
        task_id: `${job.id}:${t.id}:video`,
        agent_id: 'video',
        objective: `1 listing video для «${t.brand} ${t.model}»`,
        boundaries: 'i2v from hero or need_input; no t2v without ref',
        inputs: {
          brand: t.brand,
          model: t.model,
          gen_dir: t.gen_dir,
          files: genFiles.map((file) => ({ file })),
        },
        output_schema: 'artifact.video',
        tools_allow: [],
        spawn_role: 'leaf',
        parent_task_id: job.id,
      });
      t.video_summary = {
        status: videoStep.status,
        summary: videoStep.artifact?.summary,
        file: videoStep.artifact?.data?.file || null,
      };
      if (videoStep.artifact?.status === 'need_input' || videoStep.status === 'failed') {
        t.video_decision = 'skip';
        t.video_summary.skipped = true;
      }
    } else {
      t.video_summary = { status: 'skipped', skipped: true };
    }
    const ingestStep = await spawnAgent(job, {
      task_id: `${job.id}:${t.id}:ingest`,
      agent_id: 'ingest',
      objective: `Записать ORIGINAL gen в медиатеку owner ${job.target_owner_user_id}`,
      boundaries: 'Только ingest content_media + mirror listings/; без publish карточки',
      inputs: {
        gen_dir: t.gen_dir,
        files: genFiles,
        ownerUserId: job.target_owner_user_id,
        album_slug: t.album_slug,
        brand: t.brand,
        model: t.model,
      },
      output_schema: 'artifact.ingest',
      tools_allow: ['media.ingest_to_album'],
      spawn_role: 'leaf',
      parent_task_id: job.id,
    });
    t.ingest = {
      status: ingestStep.status,
      summary: ingestStep.artifact?.summary,
      album_dir: ingestStep.artifact?.data?.album_dir || null,
      items: ingestStep.artifact?.data?.items || [],
      errors: ingestStep.artifact?.data?.errors || [],
    };
    t.album_dir = t.ingest.album_dir || t.album_dir;
    t.album_manifest = albumManifest.buildAlbumManifest({
      job,
      target: t,
      critic: t.critic_summary,
      acceptor: t.acceptor_summary,
      video: t.video_summary,
    });
    t.status = t.ingest.items?.length ? 'done' : 'failed';
    const advanced = await advanceToNextTarget(job);
    return advanced.job;
  }
  await ensureLiveProviders();
  t.status = 'generating';
  job.cursor.phase = 'generate';
  job.status = 'running';
  job.updated_at = new Date().toISOString();
  setStep(job, 'generate', 'running');
  syncStepsFromCursor(job);

  const poolJob = t.pool_id ? listingPool.getJob(t.pool_id) : null;
  const keepFiles =
    (t.keep && t.keep.length ? t.keep : null) ||
    (poolJob?.photos || []).map((p) => p.file);

  const outDir = path.join(ROOT, job.id, t.album_slug);
  await fsp.mkdir(outDir, { recursive: true });
  t.album_dir = albumPathFor(job, t);

  const imageStep = await spawnAgent(job, {
    task_id: `${job.id}:${t.id}:image`,
    agent_id: 'image',
    objective: `Сгенерировать listing-кадры для «${t.brand} ${t.model}»`,
    boundaries: 'i2i по recipe; refs только для identity',
    inputs: {
      brand: t.brand,
      model: t.model,
      pool_id: t.pool_id,
      keep: keepFiles,
      out_dir: outDir,
      brief_label: [t.brief?.labels?.generation, t.brief?.labels?.color]
        .filter(Boolean)
        .join(' '),
      ownerUserId,
      max_images: job.seed_pool_id
        ? Math.max(1, keepFiles.length)
        : Number(t.keep_target || job.limits?.pool_target || 8),
    },
    output_schema: 'artifact.image_gen',
    tools_allow: ['media_agent.generate_image'],
    spawn_role: 'leaf',
    parent_task_id: job.id,
  });

  const imageData = imageStep.artifact?.data;
  if (imageStep.artifact?.status === 'need_input') {
    t.status = 'blocked_ask';
    t.error = imageStep.artifact?.data?.reason || 'reference_required';
    job.status = 'waiting_human';
    job.cursor.phase = 'need_input_reference';
    job._lastAsk = {
      type: 'hard_ask',
      question_id: 'reference_required',
      prompt: 'Для генерации конкретной техники нужен исходник.',
    };
    setStep(job, 'generate', 'waiting_human', t.error);
    return job;
  }
  t.gen_dir = imageData?.gen_dir || path.join(outDir, '_gen');
  const genFiles = (imageData?.files || []).map((f) => f.file || f).filter(Boolean);
  t.gen_files = genFiles;
  if (imageData?.route) job._lastImageRoute = imageData.route;
  if (imageData?.route?.model) job.image_model = imageData.route.model;

  if (!genFiles.length) {
    t.status = 'failed';
    t.error = imageStep.error || 'gen_empty';
    setStep(job, 'generate', 'failed', t.error);
    const advanced = await advanceToNextTarget(job);
    return advanced.job;
  }

  const criticFiles = (imageData?.files || []).map((f) => ({
    path: path.join(t.gen_dir, f.file),
    file: f.file,
    angle: f.angle,
  }));

  const criticStep = await spawnAgent(job, {
    task_id: `${job.id}:${t.id}:critic`,
    agent_id: 'critic',
    objective: `Проверить геометрию/фон gen для «${t.brand} ${t.model}»`,
    boundaries: 'Только QA, не перегенерировать',
    inputs: {
      brand: t.brand,
      model: t.model,
      gen_dir: t.gen_dir,
      files: criticFiles,
    },
    output_schema: 'artifact.critic',
    tools_allow: [],
    spawn_role: 'leaf',
    parent_task_id: job.id,
  });

  t.critic_summary = {
    status: criticStep.status,
    summary: criticStep.artifact?.summary,
    results: criticStep.artifact?.data?.results || [],
  };

  const acceptorStep = await spawnAgent(job, {
    task_id: `${job.id}:${t.id}:acceptor`,
    agent_id: 'acceptor',
    objective: `Принять или заблокировать пакет «${t.brand} ${t.model}» перед ingest`,
    boundaries: 'Только детерминированная приёмка; без генерации и записи файлов',
    inputs: {
      image_artifact: imageStep.artifact,
      critic_artifact: criticStep.artifact,
      expected_count: job.seed_pool_id
        ? Math.max(1, (imageData?.files || []).length || keepFiles.length)
        : Number(t.keep_target || job.limits?.pool_target || 8),
    },
    output_schema: 'artifact.acceptor',
    tools_allow: [],
    spawn_role: 'leaf',
    parent_task_id: job.id,
  });
  t.acceptor_summary = {
    status: acceptorStep.status,
    summary: acceptorStep.artifact?.summary,
    accepted: acceptorStep.artifact?.data?.accepted === true,
    blocking: acceptorStep.artifact?.data?.blocking || [],
  };

  t.album_manifest = albumManifest.buildAlbumManifest({
    job,
    target: t,
    critic: t.critic_summary,
    acceptor: t.acceptor_summary,
  });
  const albumAbs = path.join(__dirname, '../..', albumPathFor(job, t));
  albumManifest.writeAlbumManifest(albumAbs, t.album_manifest);

  if (!t.acceptor_summary.accepted) {
    t.status = 'failed';
    t.error = `quality_gate:${t.acceptor_summary.blocking.join(',') || 'rejected'}`;
    setStep(job, 'generate', 'failed', t.error);
    job.updated_at = new Date().toISOString();
    const advanced = await advanceToNextTarget(job);
    if (advanced.action === 'next_target') {
      await searchCurrentPool(advanced.job, { ownerUserId });
    }
    return advanced.job;
  }

  if (!job.seed_pool_id && genFiles.length >= 8 && t.video_decision !== 'skip' && t.video_decision !== 'generate') {
    t.status = 'waiting_video';
    job.status = 'waiting_human';
    job.cursor.phase = 'ask_video';
    job._lastAsk = {
      type: 'hard_ask',
      question_id: 'video_package',
      prompt: '8 фото приняты. Сгенерировать 1 видео из hero или пропустить?',
      options: [
        { id: 'skip', label: 'Пропустить видео' },
        { id: 'generate', label: 'Сгенерировать видео' },
      ],
    };
    setStep(job, 'generate', 'waiting_human', 'ask_video');
    return job;
  }

  const ingestStep = await spawnAgent(job, {
    task_id: `${job.id}:${t.id}:ingest`,
    agent_id: 'ingest',
    objective: `Записать ORIGINAL gen в медиатеку owner ${job.target_owner_user_id}`,
    boundaries: 'Только ingest content_media + mirror listings/; без publish карточки',
    inputs: {
      gen_dir: t.gen_dir,
      files: genFiles,
      ownerUserId: job.target_owner_user_id,
      album_slug: t.album_slug,
      brand: t.brand,
      model: t.model,
    },
    output_schema: 'artifact.ingest',
    tools_allow: ['media.ingest_to_album'],
    spawn_role: 'leaf',
    parent_task_id: job.id,
  });

  t.ingest = {
    status: ingestStep.status,
    summary: ingestStep.artifact?.summary,
    album_dir: ingestStep.artifact?.data?.album_dir || null,
    items: ingestStep.artifact?.data?.items || [],
    errors: ingestStep.artifact?.data?.errors || [],
  };
  t.album_dir = t.ingest.album_dir || t.album_dir;

  setStep(
    job,
    'generate',
    'done',
    `${imageStep.artifact?.summary}; ${criticStep.artifact?.summary}; ${ingestStep.artifact?.summary}`
  );

  t.status = ingestStep.status === 'failed' && !genFiles.length ? 'failed' : 'done';
  if (ingestStep.status === 'failed' && !t.ingest.items?.length) {
    t.error = t.error || ingestStep.error || 'ingest_failed';
  }
  job.updated_at = new Date().toISOString();

  const advanced = await advanceToNextTarget(job);
  if (advanced.action === 'next_target') {
    await searchCurrentPool(advanced.job, { ownerUserId });
  } else if (advanced.action === 'brief') {
    /* waiting_human brief for next target */
  }
  return advanced.job;
}

async function beginTargetWork(job, { ownerUserId }) {
  assertExecutableMode(job);
  const t = currentTarget(job);
  if (!t) return job;
  if (t.pool_id && Array.isArray(t.keep) && t.keep.length) {
    return runGenerateCurrent(job, { ownerUserId });
  }
  if (targetNeedsBrief(job, t)) {
    await enterSoftAskBrief(job);
    await saveBatch(job);
    return job;
  }
  t.status = 'searching';
  job.status = 'running';
  job.cursor.phase = 'search_pool';
  job.updated_at = new Date().toISOString();
  await saveBatch(job);
  setImmediate(() => {
    searchCurrentPool(job, { ownerUserId })
      .then((j) => saveBatch(j))
      .catch(async (e) => {
        logger.error('[listing-batch] search failed', e.message);
        const j = await getBatch(job.id);
        if (!j) return;
        const cur = currentTarget(j);
        if (cur) {
          cur.status = 'failed';
          cur.error = e.message;
        }
        j.status = 'failed';
        j.updated_at = new Date().toISOString();
        await saveBatch(j);
      });
  });
  return job;
}

function assertExecutableMode(job) {
  if (job?.run_mode === 'ask') {
    const err = new Error('Режим ask не запускает workers и не пишет файлы');
    err.code = 'ASK_MODE_READONLY';
    err.status = 409;
    throw err;
  }
}

async function startBatch({
  message,
  targets,
  ownerUserId,
  targetOwnerUserId,
  softAskTimeoutSec,
  runMode = 'plan',
  seedImages = [],
  sourceFile = null,
  keepTarget = null,
  videoPolicy = null,
}) {
  purge();
  const list = targets?.length ? targets : parseBatchTargets(message);
  if (!list.length) {
    const err = new Error('Не распознал brand/model в запросе');
    err.status = 400;
    err.code = 'NO_TARGETS';
    throw err;
  }
  if (!Number.isInteger(Number(ownerUserId)) || Number(ownerUserId) <= 0) {
    const err = new Error('Для batch нужен владелец задачи');
    err.status = 400;
    err.code = 'OWNER_REQUIRED';
    throw err;
  }
  if (!Number.isInteger(Number(targetOwnerUserId)) || Number(targetOwnerUserId) <= 0) {
    const err = new Error('Для сохранения медиа нужен профиль-владелец');
    err.status = 400;
    err.code = 'TARGET_OWNER_REQUIRED';
    throw err;
  }

  const websites = extractWebsites(message);
  if (websites.length) {
    for (const target of list) {
      target.websites = [...new Set([...(target.websites || []), ...websites])];
    }
  }
  const resolvedKeep = Number(keepTarget);
  if (Number.isFinite(resolvedKeep) && resolvedKeep > 0) {
    for (const target of list) {
      target.keep_target = Math.min(16, Math.max(1, resolvedKeep));
    }
  }

  const job = createListingBatchJob({
    ownerUserId,
    targetOwnerUserId,
    userPrompt: message,
    targets: list,
    softAskTimeoutSec,
    runMode,
    sourceFile,
    poolTarget: Number.isFinite(resolvedKeep) && resolvedKeep > 0 ? resolvedKeep : undefined,
  });
  if (videoPolicy) job.video_policy = videoPolicy;
  if (websites.length) job.websites = websites;

  if (job.run_mode === 'ask') {
    job.status = 'waiting_human';
    job.cursor.phase = 'ask';
    job._lastAsk = {
      type: 'hard_ask',
      question_id: 'ask_mode',
      prompt: 'Режим ask: план показан без поиска, генерации и записи файлов.',
    };
    await saveBatch(job);
    return job;
  }

  const live = await ensureLiveProviders();
  const caps = await orchProviderBridge.getOrchCapabilitySnapshot().catch(() => null);
  let routing = caps?.routing || null;
  try {
    routing = await require('./orchModelRouter').getRoutingTable();
  } catch {
    /* keep caps.routing */
  }
  if (routing?.roles?.image_gen?.model) {
    job.image_model = routing.roles.image_gen.model;
  }
  job._providers = {
    live_source: live?.source || null,
    chat_ready: caps?.chat_ready || false,
    image_ready: caps?.image_ready || false,
    qwencloud: caps?.providers?.qwencloud || null,
    deepseek: caps?.providers?.deepseek || null,
    routing: routing?.roles || null,
    quota: routing?.quota || null,
  };
  if (!caps?.chat_ready && !caps?.image_ready) {
    logger.warn('[listing-batch] no AI provider in Settings/env — brief may use year fallback');
  }
  if (Array.isArray(seedImages) && seedImages.length) {
    const first = job.targets[0];
    const pool = await listingPool.createPoolFromImages({
      brand: first.brand,
      model: first.model,
      images: seedImages,
      ownerUserId,
      target: first.keep_target || 8,
    });
    first.pool_id = pool.id;
    first.keep = (pool.photos || []).map((p) => p.file);
    job.seed_pool_id = pool.id;
  }
  job.updated_at = new Date().toISOString();
  if (job.run_mode === 'plan') {
    job.status = 'waiting_human';
    job.cursor.phase = 'approve_plan';
    job._lastAsk = {
      type: 'hard_ask',
      question_id: 'approve_plan',
      prompt: 'Проверьте план и явно разрешите платную генерацию и сохранение файлов.',
    };
  }
  await saveBatch(job);
  if (job.run_mode === 'plan') {
    job.approval = await orchJobStore.saveApproval({
      job_id: job.id,
      step_id: 'plan',
      status: 'proposed',
      scope: {
        plan_version: job.plan.version,
        side_effects: job.plan.side_effects,
        target_owner_user_id: job.target_owner_user_id,
      },
      requested_by: job.owner_user_id,
    });
    await saveBatch(job);
    return job;
  }
  return beginTargetWork(job, { ownerUserId });
}

async function decideBatchPlan(id, decision, { ownerUserId } = {}) {
  const job = await getBatch(id);
  if (!job) {
    const err = new Error('Batch не найден');
    err.status = 404;
    throw err;
  }
  assertOwned(job, ownerUserId, 'Batch не найден');
  if (job.run_mode !== 'plan' || job.cursor?.phase !== 'approve_plan') {
    const err = new Error('Задача не ожидает утверждения плана');
    err.status = 409;
    err.code = 'APPROVAL_NOT_PENDING';
    throw err;
  }

  const status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : null;
  if (!status) {
    const err = new Error('Решение должно быть approve или reject');
    err.status = 400;
    err.code = 'APPROVAL_DECISION_INVALID';
    throw err;
  }
  job.approval = await orchJobStore.decideApproval({
    jobId: job.id,
    decision: status,
    decidedBy: ownerUserId,
    planVersion: job.plan?.version,
  });
  job.updated_at = new Date().toISOString();

  if (status === 'rejected') {
    job.status = 'cancelled';
    job.cursor.phase = 'done';
    await saveBatch(job);
    return job;
  }

  job.run_mode = 'execute';
  job.status = 'queued';
  job.cursor.phase = 'parse';
  job._lastAsk = null;
  await saveBatch(job);
  const next = await beginTargetWork(job, { ownerUserId });
  await saveBatch(next);
  return next;
}

async function getBatch(id) {
  purge();
  const key = String(id || '');
  const cached = JOBS.get(key);
  if (cached) return cached;
  const restored = await orchJobStore.getJob(key);
  if (restored) JOBS.set(key, restored);
  return restored;
}

async function cancelBatch(id, { ownerUserId } = {}) {
  const job = await getBatch(id);
  if (!job) {
    const err = new Error('Batch не найден');
    err.status = 404;
    throw err;
  }
  assertOwned(job, ownerUserId, 'Batch не найден');
  const cancelled = await orchJobStore.cancelJob(id);
  cancelled.status = 'cancelled';
  cancelled.cursor = { ...(cancelled.cursor || {}), phase: 'done' };
  syncStepsFromCursor(cancelled);
  JOBS.set(String(id), cancelled);
  return cancelled;
}

async function resumeRecoverableJobs() {
  await orchJobStore.expireRecoverableLeases();
  const jobs = await orchJobStore.listRecoverableJobs();
  const listingJobs = jobs.filter((job) => job?.kind === 'listing_media_batch');
  for (const job of listingJobs) {
    JOBS.set(String(job.id), job);
    if (job.status === 'waiting_human') continue;
    const ownerUserId = job.owner_user_id;
    const phase = job.cursor?.phase || 'parse';
    setImmediate(() => {
      const resume =
        phase === 'generate'
          ? runGenerateCurrent(job, { ownerUserId })
          : phase === 'search_pool'
            ? searchCurrentPool(job, { ownerUserId })
            : beginTargetWork(job, { ownerUserId });
      resume
        .then((next) => saveBatch(next))
        .catch((error) => {
          if (error?.code === 'JOB_CANCELLED' || error?.code === 'JOB_VERSION_CONFLICT') return;
          logger.error(`[listing-batch] recovery ${job.id}: ${error.message}`);
        });
    });
  }
  return { recovered: listingJobs.length };
}

async function tickBatch(id, { ownerUserId } = {}) {
  const job = await getBatch(id);
  if (!job) {
    const err = new Error('Batch не найден');
    err.status = 404;
    throw err;
  }
  assertOwned(job, ownerUserId, 'Batch не найден');
  const actorId = job.owner_user_id;
  const tick = tickSoftAsk(job);
  if (tick.action === 'search') {
    await saveBatch(job);
    setImmediate(() => {
      searchCurrentPool(job, { ownerUserId: actorId })
        .then((j) => saveBatch(j))
        .catch(async (e) => {
          logger.error('[listing-batch] search after brief tick', e.message);
          const j = await getBatch(id);
          if (j) {
            const cur = currentTarget(j);
            if (cur) {
              cur.status = 'failed';
              cur.error = e.message;
            }
            j.status = 'failed';
            j.updated_at = new Date().toISOString();
            await saveBatch(j);
          }
        });
    });
  }
  if (tick.action === 'continue') {
    const t = currentTarget(job);
    if (t) t.status = 'generating';
    job.status = 'running';
    job.cursor.phase = 'generate';
    job.updated_at = new Date().toISOString();
    await saveBatch(job);
    setImmediate(() => {
      runGenerateCurrent(job, { ownerUserId: actorId })
        .then((j) => saveBatch(j))
        .catch(async (e) => {
          logger.error('[listing-batch] gen after tick', e.message);
          const j = await getBatch(id);
          if (j) {
            const cur = currentTarget(j);
            if (cur) {
              cur.status = 'failed';
              cur.error = e.message;
            }
            j.status = 'failed';
            j.updated_at = new Date().toISOString();
            await saveBatch(j);
          }
        });
    });
  }
  await saveBatch(job);
  return job;
}

async function respondBatch(id, response, { ownerUserId } = {}) {
  if (String(response?.type || '').toLowerCase() === 'cancel') {
    return cancelBatch(id, { ownerUserId });
  }
  const job = await getBatch(id);
  if (!job) {
    const err = new Error('Batch не найден');
    err.status = 404;
    throw err;
  }
  assertOwned(job, ownerUserId, 'Batch не найден');
  const actorId = job.owner_user_id;
  const result = await applyHumanResponse(job, response);
  if (result.action === 'search' || result.action === 'retry_cycle') {
    await saveBatch(job);
    setImmediate(() => {
      searchCurrentPool(job, { ownerUserId: actorId })
        .then((j) => saveBatch(j))
        .catch(async (e) => {
          logger.error('[listing-batch] search after respond', e.message);
          const j = await getBatch(id);
          if (j) {
            const cur = currentTarget(j);
            if (cur) {
              cur.status = 'failed';
              cur.error = e.message;
            }
            j.status = 'failed';
            j.updated_at = new Date().toISOString();
            await saveBatch(j);
          }
        });
    });
    return job;
  }
  if (result.action === 'continue') {
    const t = currentTarget(job);
    if (t) t.status = 'generating';
    job.status = 'running';
    job.cursor.phase = 'generate';
    job.updated_at = new Date().toISOString();
    await saveBatch(job);
    setImmediate(() => {
      runGenerateCurrent(job, { ownerUserId: actorId })
        .then((j) => saveBatch(j))
        .catch(async (e) => {
          logger.error('[listing-batch] gen after respond', e.message);
          const j = await getBatch(id);
          if (j) {
            const cur = currentTarget(j);
            if (cur) {
              cur.status = 'failed';
              cur.error = e.message;
            }
            j.status = 'failed';
            j.updated_at = new Date().toISOString();
            await saveBatch(j);
          }
        });
    });
  }
  await saveBatch(job);
  return job;
}

module.exports = {
  parseBatchTargets,
  parseCsvTargets,
  extractWebsites,
  startBatch,
  getBatch,
  tickBatch,
  respondBatch,
  decideBatchPlan,
  cancelBatch,
  resumeRecoverableJobs,
  publicBatch,
  searchCurrentPool,
  runGenerateCurrent,
  getOrchCapabilitySnapshot: () => orchProviderBridge.getOrchCapabilitySnapshot(),
};
