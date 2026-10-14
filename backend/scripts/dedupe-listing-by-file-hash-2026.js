'use strict';

/**
 * В карточке — одно фото (hash) один раз. Между карточками — hash только на одной (min page_id).
 * APPLY=1 — правка listing_media + HTML + file_map.
 */
const db = require('../db');
const contentMediaStore = require('../services/contentMediaStore');

const APPLY = process.env.APPLY === '1';

function publicIdFromUrl(url) {
  const m = String(url || '').match(/\/v\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

async function main() {
  const { rows: pages } = await db.getQuery()(
    `SELECT id, title, settings, seo, content
     FROM admin_pages_simple
     WHERE category = '2026'
       AND COALESCE(jsonb_array_length(settings->'listing_media'->'photos'), 0) > 0
     ORDER BY id`,
  );

  /** @type {Map<string, number>} hash -> owner page_id */
  const hashOwner = new Map();

  const summary = {
    apply: APPLY,
    withinRemoved: 0,
    crossRemoved: 0,
    cardsTouched: 0,
  };

  /** pass 1: assign owner per file_hash (min page id among listings using it) */
  for (const page of pages) {
    const photos = page.settings?.listing_media?.photos || [];
    for (const url of photos) {
      const pid = publicIdFromUrl(url);
      if (!pid) continue;
      const row = await contentMediaStore.loadReadyMetaByPublicId(pid);
      if (!row?.file_hash) continue;
      const h = row.file_hash;
      const prev = hashOwner.get(h);
      if (prev == null || page.id < prev) hashOwner.set(h, page.id);
    }
  }

  for (const page of pages) {
    const settings = page.settings && typeof page.settings === 'object' ? page.settings : {};
    const photos = [...(settings.listing_media?.photos || [])];
    const kept = [];
    const seenHash = new Set();
    let within = 0;
    let cross = 0;

    for (const url of photos) {
      const pid = publicIdFromUrl(url);
      if (!pid) {
        kept.push(url);
        continue;
      }
      const row = await contentMediaStore.loadReadyMetaByPublicId(pid);
      if (!row?.file_hash) {
        kept.push(url);
        continue;
      }
      const h = row.file_hash;
      if (seenHash.has(h)) {
        within += 1;
        continue;
      }
      const owner = hashOwner.get(h);
      if (owner != null && owner !== page.id) {
        cross += 1;
        continue;
      }
      seenHash.add(h);
      kept.push(url);
    }

    if (within === 0 && cross === 0) continue;

    summary.withinRemoved += within;
    summary.crossRemoved += cross;
    summary.cardsTouched += 1;

    const map = { ...(settings.listing_media_objfix_file_map || {}) };
    const keptSet = new Set(kept);
    for (const [file, mapUrl] of Object.entries(map)) {
      if (!keptSet.has(mapUrl)) delete map[file];
    }

    const video = settings.listing_media?.video ?? null;
    const patch = {
      listing_media: { photos: kept, video },
      listing_media_draft: kept.length < 8,
      listing_media_objfix_file_map: map,
    };

    console.log(JSON.stringify({
      phase: APPLY ? 'apply' : 'dry-run',
      id: page.id,
      title: page.title,
      before: photos.length,
      after: kept.length,
      within,
      cross,
    }));

    if (!APPLY) continue;

    const seo = page.seo && typeof page.seo === 'object' ? page.seo : {};
    const seoPatch = { ...seo };
    if (seoPatch.og_image && !kept.includes(seoPatch.og_image)) {
      seoPatch.og_image = kept[0] || null;
    }
    const rawContent = typeof page.content === 'string' ? page.content : '';
    const composeListing = settings.compose_mode === 'listing';
    const contentPatch = contentMediaStore.syncListingContentHtml(rawContent, kept, video, composeListing);

    await db.getQuery()(
      `UPDATE admin_pages_simple
       SET settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb,
           seo = COALESCE(seo, '{}'::jsonb) || $3::jsonb,
           content = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [page.id, JSON.stringify(patch), JSON.stringify(seoPatch), contentPatch],
    );
  }

  console.log(JSON.stringify({ finished: true, summary }));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
