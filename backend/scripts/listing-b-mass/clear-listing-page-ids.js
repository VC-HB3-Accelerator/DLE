'use strict';

/** Очистить listing_media только для PAGE_IDS. Запуск: docker exec -w /app dapp-backend node scripts/clear-listing-page-ids.js */
const fsp = require('fs/promises');
const path = require('path');
const db = require('../db');
const contentMediaStore = require('../services/contentMediaStore');

const SHOWROOM_DIR = path.join(__dirname, '..', 'uploads', 'showroom-eight');

function parsePageIds(raw) {
  const s = String(raw || '').trim();
  if (!s) return [];
  if (s.startsWith('[')) return JSON.parse(s);
  return s.split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => Number.isInteger(n) && n > 0);
}

function publicIdFromUrl(url) {
  const m = String(url || '').match(/\/v\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

async function main() {
  const pageIds = parsePageIds(process.env.PAGE_IDS || process.env.TEST_IDS);
  if (!pageIds.length) {
    console.error(JSON.stringify({ error: 'Set PAGE_IDS' }));
    process.exit(1);
  }
  const { rows: pages } = await db.getQuery()(
    `SELECT id, settings FROM admin_pages_simple WHERE id = ANY($1::int[])`,
    [pageIds],
  );
  const publicIds = new Set();
  for (const p of pages) {
    const s = p.settings && typeof p.settings === 'object' ? p.settings : {};
    for (const u of s.listing_media?.photos || []) {
      const pid = publicIdFromUrl(u);
      if (pid) publicIds.add(pid);
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
  const { rowCount } = await db.getQuery()(
    `UPDATE admin_pages_simple
     SET settings = (
           COALESCE(settings, '{}'::jsonb)
           - 'listing_media'
           - 'listing_media_test'
           - 'listing_media_draft'
           - 'listing_media_objfix_picked'
           - 'listing_media_objfix_at'
           - 'listing_media_objfix_file_map'
           - 'listing_media_quality_gate'
           - 'showroom'
           - 'showroom_eight'
           - 'showroom_frame_count'
           - 'showroom_unified_paint'
           - 'compose_mode'
         ),
         seo = CASE WHEN seo IS NULL THEN NULL ELSE seo - 'og_image' END,
         updated_at = NOW()
     WHERE id = ANY($1::int[])`,
    [pageIds],
  );
  let showroomDirsRemoved = 0;
  for (const id of pageIds) {
    try {
      await fsp.rm(path.join(SHOWROOM_DIR, String(id)), { recursive: true, force: true });
      showroomDirsRemoved += 1;
    } catch { /* ignore */ }
  }
  console.log(JSON.stringify({
    clearedPages: rowCount,
    pageIds,
    deletedContentMedia: deletedMedia,
    showroomDirsTouched: showroomDirsRemoved,
  }));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
