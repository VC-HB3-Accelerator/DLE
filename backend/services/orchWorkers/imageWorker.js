'use strict';

/**
 * Leaf worker: image — i2i listing angles via model router + wanImage.
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const listingPool = require('../listingImagePoolService');
const { POOL_ANGLE_SLOTS, angleForFile } = require('../listingPool/poolAngles');
const orchQuota = require('../orchQuota');

function orchRoot() {
  const candidates = [
    '/host-project/orchestrator',
    path.join(__dirname, '../../../orchestrator'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(path.join(p, 'runtime/wanImage.js'))) return p;
  }
  return null;
}

function loadOrch(rel) {
  const root = orchRoot();
  if (!root) return null;
  return require(path.join(root, rel));
}

async function run(brief, { assertLease, heartbeat } = {}) {
  const inputs = brief.inputs || {};
  const poolId = inputs.pool_id;
  const keepFiles = Array.isArray(inputs.keep) ? inputs.keep : [];
  const brand = String(inputs.brand || '').trim();
  const model = String(inputs.model || '').trim();
  const outDir = String(inputs.out_dir || '').trim();
  if (!poolId || !outDir || !keepFiles.length) {
    return {
      status: 'need_input',
      summary: 'image: need pool_id, keep[], out_dir',
      agent_id: 'image',
      data: { reason: 'reference_required' },
    };
  }

  const resolvedKeep = keepFiles.slice(0, 8)
    .map((file) => ({ file, abs: listingPool.resolvePoolFile(poolId, file) }))
    .filter((item) => item.abs);
  if (!resolvedKeep.length) {
    return {
      status: 'need_input',
      summary: 'image: no refs resolved',
      agent_id: 'image',
      data: { reason: 'reference_required' },
    };
  }

  const refsDir = path.join(outDir, '_refs');
  const genDir = path.join(outDir, '_gen');
  await fsp.mkdir(refsDir, { recursive: true });
  await fsp.mkdir(genDir, { recursive: true });

  const poolJob = listingPool.getJob(poolId);
  const refByAngle = new Map();
  const refPaths = [];
  for (const item of resolvedKeep) {
    const dest = path.join(refsDir, item.file);
    await fsp.copyFile(item.abs, dest);
    refPaths.push(dest);
    const meta = (poolJob?.photos || []).find((p) => p.file === item.file);
    const angle = meta?.angle || angleForFile(item.file);
    if (angle) refByAngle.set(angle, dest);
  }

  const bridge = require('../orchProviderBridge');
  await bridge.applyLiveProvidersToEnv({ force: false });

  let imageRoute = null;
  try {
    imageRoute = await require('../orchModelRouter').resolveRole('image_gen');
  } catch (e) {
    return { status: 'failed', summary: `image route: ${e.message}`, agent_id: 'image' };
  }

  const wan = loadOrch('runtime/wanImage.js');
  const recipe = loadOrch('runtime/photoRecipe.js');
  const { executeRoute } = require('../orchRouteExecution');
  const maxImages = Math.min(
    POOL_ANGLE_SLOTS.length,
    Math.max(1, Number(inputs.max_images) || POOL_ANGLE_SLOTS.length)
  );
  const angles = POOL_ANGLE_SLOTS.slice(0, maxImages).map((s) => s.angle);
  const genFiles = [];
  const primaryRef = refPaths[0];

  if (wan && recipe) {
    for (let i = 0; i < angles.length; i++) {
      if (typeof heartbeat === 'function') await heartbeat();
      const angle = angles[i];
      const dest = path.join(genDir, `${String(i + 1).padStart(2, '0')}-${angle}.png`);
      const ref = refByAngle.get(angle) || refPaths[Math.min(i, refPaths.length - 1)] || primaryRef;
      try {
        const prompt = recipe.buildGenPrompt(
          {
            brand,
            model: [model, inputs.brief_label].filter(Boolean).join(' '),
          },
          angle
        );
        await executeRoute(
          imageRoute,
          () => wan.generateWanImage(prompt, dest, {
            route: imageRoute,
            refPath: ref,
          })
        );
        if (typeof assertLease === 'function') await assertLease();
        genFiles.push({ file: path.basename(dest), angle, ok: true });
        orchQuota.record('image_gen', imageRoute.provider, {
          model: imageRoute.model,
          kind: 'image',
        });
      } catch (e) {
        if (e?.code === 'STEP_LEASE_LOST' || e?.code === 'JOB_CANCELLED') throw e;
        const fallback = path.join(genDir, `${String(i + 1).padStart(2, '0')}-${angle}.jpg`);
        await fsp.copyFile(ref, fallback).catch(() => {});
        if (fs.existsSync(fallback)) {
          genFiles.push({ file: path.basename(fallback), angle, ok: false, error: e.message });
        }
      }
    }
  } else {
    for (let i = 0; i < refPaths.length; i++) {
      const dest = path.join(genDir, `${String(i + 1).padStart(2, '0')}-keep.jpg`);
      await fsp.copyFile(refPaths[i], dest);
      genFiles.push({ file: path.basename(dest), angle: null, ok: false, error: 'no_wan' });
    }
  }

  const okCount = genFiles.filter((g) => g.ok).length;
  return {
    status: genFiles.length ? (okCount ? 'ok' : 'partial') : 'failed',
    summary: `gen ${okCount}/${genFiles.length} via ${imageRoute.model}`,
    agent_id: 'image',
    data: {
      gen_dir: genDir,
      refs_dir: refsDir,
      files: genFiles,
      route: {
        provider: imageRoute.provider,
        model: imageRoute.model,
        orch_provider: imageRoute.orchProviderName,
        adapter: imageRoute.adapter?.id,
        endpoint: imageRoute.endpoint,
      },
    },
  };
}

module.exports = { run };
