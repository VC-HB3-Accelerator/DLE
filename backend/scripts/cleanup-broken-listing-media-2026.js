'use strict';

/**
 * Убрать битые /v/... (нет content_media) и почистить file_map. APPLY=1 — писать в БД.
 * Затем optional attach hint in summary.
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const db = require('../db');
const contentMediaStore = require('../services/contentMediaStore');
const { rejectListingSourceUrl } = require('../services/listingPool/listingPhotoSourcePolicy');

const APPLY = process.env.APPLY === '1';
const OBJFIX = process.env.OBJFIX_ROOT || '/tmp/objfix-b';

function publicIdFromUrl(url) {
  const m = String(url || '').match(/\/v\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

async function mediaExists(publicId) {
  if (!publicId) return false;
  const row = await contentMediaStore.loadReadyMetaByPublicId(publicId);
  return Boolean(row?.file_path && row.status === 'ready');
}

async function main() {
  const { rows: pages } = await db.getQuery()(
    `SELECT id, title, settings
     FROM admin_pages_simple
     WHERE category = '2026'
       AND COALESCE(jsonb_array_length(settings->'listing_media'->'photos'), 0) > 0
     ORDER BY id`,
  );

  const summary = {
    apply: APPLY,
    cards: pages.length,
    brokenRemoved: 0,
    cardsTouched: 0,
    fileMapPruned: 0,
    attachCandidates: [],
  };

  for (const page of pages) {
    const settings = page.settings && typeof page.settings === 'object' ? page.settings : {};
    const photos = [...(settings.listing_media?.photos || [])];
    if (!photos.length) continue;

    const kept = [];
    const removed = [];
    for (const photoUrl of photos) {
      const pid = publicIdFromUrl(photoUrl);
      const ok = await mediaExists(pid);
      if (!ok) {
        removed.push({ photoUrl, reason: 'missing_content_media' });
        continue;
      }
      kept.push(photoUrl);
    }

    let map = { ...(settings.listing_media_objfix_file_map || {}) };
    let mapPruned = 0;
    for (const [file, url] of Object.entries(map)) {
      const pid = publicIdFromUrl(url);
      if (!pid) continue;
      if (!(await mediaExists(pid))) {
        delete map[file];
        mapPruned += 1;
      }
    }

    if (!removed.length && !mapPruned) continue;

    summary.brokenRemoved += removed.length;
    summary.fileMapPruned += mapPruned;
    summary.cardsTouched += 1;

    const mf = path.join(OBJFIX, String(page.id), 'manifest.json');
    let pickedLen = 0;
    try {
      const manifest = JSON.parse(await fsp.readFile(mf, 'utf8'));
      pickedLen = (manifest.picked || []).length;
    } catch { /* no manifest */ }

    if (pickedLen >= 2) summary.attachCandidates.push(page.id);

    console.log(JSON.stringify({
      phase: APPLY ? 'apply' : 'dry-run',
      id: page.id,
      title: page.title,
      removed: removed.length,
      kept: kept.length,
      mapPruned,
      pickedLen,
    }));

    if (!APPLY) continue;

    const draft = kept.length < 8;
    const patch = {
      listing_media: { photos: kept, video: settings.listing_media?.video ?? null },
      listing_media_draft: draft,
      listing_media_objfix_file_map: map,
    };
    const seoPatch = kept.length ? { og_image: kept[0] } : {};
    await db.getQuery()(
      `UPDATE admin_pages_simple
       SET settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb,
           seo = COALESCE(seo, '{}'::jsonb) || $3::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [page.id, JSON.stringify(patch), JSON.stringify(seoPatch)],
    );
  }

  console.log(JSON.stringify({ finished: true, summary }));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
