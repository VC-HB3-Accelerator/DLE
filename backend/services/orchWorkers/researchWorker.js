'use strict';

/**
 * Leaf worker: research — internet photo pool for brand/model.
 */
const listingPool = require('../listingImagePoolService');
const { briefQueryExtras } = require('../listingBrief');

async function run(brief, { parentJob, assertLease, heartbeat }) {
  const inputs = brief.inputs || {};
  const brand = String(inputs.brand || '').trim();
  const model = String(inputs.model || '').trim();
  if (!brand || !model) {
    return { status: 'failed', summary: 'research: brand/model required', agent_id: 'research' };
  }
  const target = Math.min(16, Math.max(4, Number(inputs.target) || 8));
  const websites = Array.isArray(inputs.websites) ? inputs.websites.filter(Boolean) : [];
  const queryExtras = [
    inputs.queryExtras || briefQueryExtras(inputs.brief) || '',
    ...websites,
  ].filter(Boolean).join(' ');

  if (typeof heartbeat === 'function') await heartbeat();
  if (websites.length) {
    try {
      const { crawlPages } = require('../listingPool/siteCrawl');
      const crawled = await crawlPages(websites);
      inputs._site_images = crawled.images;
      inputs._site_videos = crawled.videos;
    } catch {
      /* keep internet search */
    }
  }
  const pool = await listingPool.startPool({
    brand,
    model,
    target,
    ownerUserId: inputs.ownerUserId || parentJob?.owner_user_id || null,
    queryExtras,
  });
  if (typeof assertLease === 'function') await assertLease();

  return {
    status: pool.count > 0 ? 'ok' : 'failed',
    summary: `pool ${pool.count}/${pool.target} (${pool.status})`,
    agent_id: 'research',
    data: {
      pool_id: pool.id,
      count: pool.count,
      target: pool.target,
      photos: (pool.photos || []).map((p) => ({
        file: p.file,
        angle: p.angle,
        bytes: p.bytes,
      })),
      engines: pool.engines || [],
      site_images: inputs._site_images || [],
      site_videos: inputs._site_videos || [],
    },
  };
}

module.exports = { run };
