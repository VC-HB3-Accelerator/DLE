'use strict';

/**
 * Полная очистка listing-теста категории 2026:
 * — content_media, привязанные к карточкам 2026 (+ URL из listing_media)
 * — settings listing/showroom/draft
 * — закрепы ленты
 * — локальные альбомы showroom-eight (в контейнере)
 *
 * node scripts/clear-listing-media-2026.js
 */
const fsp = require('fs/promises');
const path = require('path');
const db = require('../db');
const contentMediaStore = require('../services/contentMediaStore');

const SHOWROOM_DIR = path.join(__dirname, '..', 'uploads', 'showroom-eight');

function publicIdFromUrl(url) {
  const m = String(url || '').match(/\/v\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

async function main() {
  const { rows: pages } = await db.getQuery()(
    `SELECT id, settings FROM admin_pages_simple WHERE category = '2026'`,
  );
  const pageIds = pages.map((p) => p.id);
  const publicIds = new Set();
  for (const p of pages) {
    const s = p.settings && typeof p.settings === 'object' ? p.settings : {};
    const photos = s.listing_media?.photos;
    if (Array.isArray(photos)) {
      for (const u of photos) {
        const pid = publicIdFromUrl(u);
        if (pid) publicIds.add(pid);
      }
    }
  }

  const { rows: byPage } = await db.getQuery()(
    `SELECT id, public_id FROM content_media WHERE page_id = ANY($1::int[])`,
    [pageIds],
  );
  const mediaIds = new Set(byPage.map((r) => r.id));
  for (const pid of publicIds) {
    const row = await contentMediaStore.loadReadyMetaByPublicId(pid);
    if (row?.id) mediaIds.add(row.id);
  }

  let deletedMedia = 0;
  for (const id of mediaIds) {
    const r = await contentMediaStore.deleteMediaById(id);
    if (r.deleted) deletedMedia += 1;
  }

  await db.getQuery()('DELETE FROM blog_pinned_pages');

  const { rowCount } = await db.getQuery()(
    `UPDATE admin_pages_simple
     SET settings = (
           COALESCE(settings, '{}'::jsonb)
           - 'listing_media'
           - 'listing_media_test'
           - 'listing_media_draft'
           - 'listing_media_objfix_picked'
           - 'listing_media_objfix_at'
           - 'showroom'
           - 'showroom_eight'
           - 'showroom_frame_count'
           - 'showroom_unified_paint'
           - 'compose_mode'
         ),
         seo = CASE WHEN seo IS NULL THEN NULL ELSE seo - 'og_image' END,
         updated_at = NOW()
     WHERE category = '2026'`,
  );

  let showroomDirsRemoved = 0;
  for (const id of pageIds) {
    const dir = path.join(SHOWROOM_DIR, String(id));
    try {
      await fsp.rm(dir, { recursive: true, force: true });
      showroomDirsRemoved += 1;
    } catch { /* ignore */ }
  }

  const withPhotos = await db.getQuery()(
    `SELECT COUNT(*)::int AS n FROM admin_pages_simple
     WHERE category = '2026'
       AND jsonb_array_length(COALESCE(settings->'listing_media'->'photos', '[]'::jsonb)) > 0`,
  );
  const mediaLeft = await db.getQuery()(
    `SELECT COUNT(*)::int AS n FROM content_media WHERE page_id = ANY($1::int[])`,
    [pageIds],
  );

  console.log(JSON.stringify({
    category: '2026',
    pages: pageIds.length,
    deletedContentMedia: deletedMedia,
    contentMediaLeftOnPages: mediaLeft.rows[0].n,
    clearedPages: rowCount,
    withPhotosLeft: withPhotos.rows[0].n,
    pinsCleared: true,
    showroomDirsTouched: showroomDirsRemoved,
  }));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
