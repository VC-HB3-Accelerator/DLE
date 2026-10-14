'use strict';

/**
 * Убрать из listing_media.photos повторы одного file_hash (разные /v/… на один файл).
 * APPLY=1 — записать в БД и пересобрать HTML ленты.
 *
 *   LISTING_MASS_CATEGORY=2026 APPLY=1 node scripts/dedupe-listing-gallery-by-hash.js
 */
const db = require('../db');
const contentMediaStore = require('../services/contentMediaStore');

const APPLY = process.env.APPLY === '1';
const CATEGORY = String(process.env.LISTING_MASS_CATEGORY || '2026').trim();

function publicIdFromUrl(url) {
  const m = String(url || '').trim().match(/^\/v\/([^/?#]+)/);
  return m ? m[1] : null;
}

async function main() {
  const params = [];
  let where = '1=1';
  if (CATEGORY) {
    where = 'category = $1';
    params.push(CATEGORY);
  }
  const { rows: pages } = await db.getQuery()(
    `SELECT id, title, settings, content FROM admin_pages_simple WHERE ${where} ORDER BY id`,
    params,
  );

  let pagesFixed = 0;
  let urlsRemoved = 0;

  for (const p of pages) {
    const settings = p.settings && typeof p.settings === 'object' ? p.settings : {};
    const photos = (settings.listing_media?.photos || []).map((u) => String(u || '').trim()).filter(Boolean);
    if (photos.length < 2) continue;

    const pids = [...new Set(photos.map(publicIdFromUrl).filter(Boolean))];
    const hashByPid = new Map();
    if (pids.length) {
      const { rows: media } = await db.getQuery()(
        `SELECT public_id, file_hash FROM content_media WHERE public_id = ANY($1) AND file_hash IS NOT NULL`,
        [pids],
      );
      for (const r of media) hashByPid.set(r.public_id, r.file_hash);
    }

    const seenUrl = new Set();
    const seenHash = new Set();
    const deduped = [];
    for (const url of photos) {
      if (seenUrl.has(url)) {
        urlsRemoved += 1;
        continue;
      }
      const pid = publicIdFromUrl(url);
      const h = pid ? hashByPid.get(pid) : null;
      if (h && seenHash.has(h)) {
        urlsRemoved += 1;
        continue;
      }
      seenUrl.add(url);
      if (h) seenHash.add(h);
      deduped.push(url);
    }

    if (deduped.length === photos.length) continue;

    pagesFixed += 1;
    console.log(JSON.stringify({
      id: p.id,
      title: p.title,
      before: photos.length,
      after: deduped.length,
      removed: photos.length - deduped.length,
    }));

    if (!APPLY) continue;

    const settingsPatch = {
      listing_media: {
        photos: deduped,
        video: settings.listing_media?.video ?? null,
      },
      listing_media_draft: deduped.length < 8,
    };
    const composeListing = settings.compose_mode === 'listing';
    const contentPatch = contentMediaStore.syncListingContentHtml(
      typeof p.content === 'string' ? p.content : '',
      deduped,
      settings.listing_media?.video ?? null,
      composeListing,
    );
    await db.getQuery()(
      `UPDATE admin_pages_simple
       SET settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb,
           content = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [p.id, JSON.stringify(settingsPatch), contentPatch],
    );
  }

  console.log(JSON.stringify({
    finished: true,
    APPLY,
    category: CATEGORY || 'all',
    pagesFixed,
    urlsRemoved,
  }));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
