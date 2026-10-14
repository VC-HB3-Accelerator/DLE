'use strict';

/**
 * Leaf worker: one listing video from the hero still.
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

async function run(brief, { assertLease, heartbeat } = {}) {
  const inputs = brief.inputs || {};
  const genDir = String(inputs.gen_dir || '').trim();
  const files = Array.isArray(inputs.files) ? inputs.files : [];
  const hero = files[0];
  const heroPath = hero
    ? (path.isAbsolute(hero.path || hero.file || hero)
      ? (hero.path || hero.file || hero)
      : path.join(genDir, hero.file || hero))
    : '';
  if (!heroPath || !fs.existsSync(heroPath)) {
    return {
      status: 'need_input',
      summary: 'video: need hero image',
      agent_id: 'video',
      data: { reason: 'hero_required' },
    };
  }

  if (typeof heartbeat === 'function') await heartbeat();
  const bridge = require('../orchProviderBridge');
  await bridge.applyLiveProvidersToEnv({ force: false });

  let videoRoute;
  try {
    videoRoute = await require('../orchModelRouter').resolveRole('video_gen');
  } catch (e) {
    return {
      status: 'need_input',
      summary: `video route: ${e.message}`,
      agent_id: 'video',
      data: { reason: 'route_unavailable' },
    };
  }

  const dest = path.join(genDir, '09-hero.mp4');
  await fsp.mkdir(genDir, { recursive: true });
  const mediaAgent = require('../mediaAgentService');
  const { executeRoute } = require('../orchRouteExecution');
  const prompt = [
    String(inputs.brand || '').trim(),
    String(inputs.model || '').trim(),
    'slow cinematic listing clip, vehicle fully in frame, clean background',
  ].filter(Boolean).join(' ');

  try {
    const gen = await executeRoute(videoRoute, () => mediaAgent.generateVideo
      ? mediaAgent.generateVideo({ route: videoRoute, prompt, duration: 5 })
      : Promise.reject(Object.assign(new Error('video generator missing'), { code: 'ROUTE_UNAVAILABLE' })));
    if (typeof assertLease === 'function') await assertLease();
    if (!gen?.url) {
      return { status: 'failed', summary: 'video: empty url', agent_id: 'video' };
    }
    return {
      status: 'ok',
      summary: `video via ${videoRoute.model}`,
      agent_id: 'video',
      data: {
        file: path.basename(dest),
        url: gen.url,
        route: {
          provider: videoRoute.provider,
          model: videoRoute.model,
          adapter: videoRoute.adapter?.id,
        },
      },
    };
  } catch (e) {
    if (e?.code === 'STEP_LEASE_LOST' || e?.code === 'JOB_CANCELLED') throw e;
    return {
      status: 'failed',
      summary: `video: ${e.message}`,
      agent_id: 'video',
      data: { reason: e.code || 'video_failed' },
    };
  }
}

module.exports = { run };
