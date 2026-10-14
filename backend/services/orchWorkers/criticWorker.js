'use strict';

/**
 * Leaf worker: critic — vision QA of generated files.
 */
const fs = require('fs');
const path = require('path');

function loadCritic() {
  const candidates = [
    '/host-project/orchestrator/runtime/agents/critic.js',
    path.join(__dirname, '../../../orchestrator/runtime/agents/critic.js'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return require(p);
    }
  }
  return null;
}

async function run(brief, { assertLease, heartbeat } = {}) {
  const inputs = brief.inputs || {};
  const files = Array.isArray(inputs.files) ? inputs.files : [];
  const brand = String(inputs.brand || '').trim();
  const model = String(inputs.model || '').trim();
  if (!files.length) {
    return { status: 'failed', summary: 'critic: no files', agent_id: 'critic' };
  }

  const bridge = require('../orchProviderBridge');
  await bridge.applyLiveProvidersToEnv({ force: false });

  let visionProvider = 'qwen_token';
  try {
    const route = await require('../orchModelRouter').resolveRole('critic_vision');
    visionProvider = route.orchProviderName || visionProvider;
  } catch {
    /* keep default */
  }

  const criticMod = loadCritic();
  if (!criticMod?.criticImageFile) {
    return {
      status: 'failed',
      summary: 'critic runtime missing — quality gate closed',
      agent_id: 'critic',
      data: {
        soft: true,
        results: files.map((f) => ({
          file: typeof f === 'string' ? f : f.file,
          pass: false,
          soft: true,
          score: 0,
          reasons: ['critic_runtime_missing'],
        })),
      },
    };
  }

  const results = [];
  for (const item of files) {
    if (typeof heartbeat === 'function') await heartbeat();
    const filePath = typeof item === 'string' ? item : item.path || item.file;
    const angle = typeof item === 'object' ? item.angle : null;
    const abs = path.isAbsolute(filePath)
      ? filePath
      : path.join(String(inputs.gen_dir || ''), filePath);
    if (!fs.existsSync(abs)) {
      results.push({ file: path.basename(abs), pass: false, score: 0, reasons: ['missing_file'] });
      continue;
    }
    try {
      const verdict = await criticMod.criticImageFile(
        abs,
        { brand, model },
        angle || 'unknown',
        { visionProvider }
      );
      if (typeof assertLease === 'function') await assertLease();
      results.push({
        file: path.basename(abs),
        angle,
        pass: verdict.pass,
        score: verdict.score,
        reasons: verdict.reasons,
        issues: verdict.issues,
        soft: Boolean(verdict.soft),
      });
    } catch (e) {
      if (e?.code === 'STEP_LEASE_LOST' || e?.code === 'JOB_CANCELLED') throw e;
      results.push({
        file: path.basename(abs),
        pass: false,
        score: 0,
        reasons: [e.message],
      });
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const hasSoftResult = results.some((r) => r.soft);
  return {
    status:
      passed === results.length && !hasSoftResult
        ? 'ok'
        : passed > 0 && !hasSoftResult
          ? 'partial'
          : 'failed',
    summary: `critic ${passed}/${results.length} pass`,
    agent_id: 'critic',
    data: { results },
  };
}

module.exports = { run };
