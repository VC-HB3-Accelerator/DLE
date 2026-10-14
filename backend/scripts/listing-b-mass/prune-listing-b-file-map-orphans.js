'use strict';

/**
 * file_map держит URL снятых с карточки фото → медиатека «воскрешает» мусор.
 * APPLY=1: подчистить map под listing_media.photos + deleteMediaById для лишних *-b-*.
 */
const db = require('../../db');
const contentMediaStore = require('../../services/contentMediaStore');

const APPLY = process.env.APPLY === '1';
const CATEGORY = String(process.env.CATEGORY || '2026').trim();

function publicIdFromUrl(url) {
  const m = String(url || '').match(/\/v\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

async function main() {
  const { rows: pages } = await db.getQuery()(
    `SELECT id, title, settings FROM admin_pages_simple WHERE category = $1`,
    [CATEGORY],
  );
  const summary = { apply: APPLY, pages: pages.length, mapsPruned: 0, mediaDeleted: 0, samples: [] };

  for (const page of pages) {
    const settings = page.settings && typeof page.settings === 'object' ? page.settings : {};
    const photos = new Set((settings.listing_media?.photos || []).map(String));
    const map = { ...(settings.listing_media_objfix_file_map || {}) };
    const allowedUrls = new Set(photos);
    let mapChanged = false;

    for (const [file, url] of Object.entries(map)) {
      if (!allowedUrls.has(String(url))) {
        delete map[file];
        mapChanged = true;
      }
    }

    const { rows: mediaRows } = await db.getQuery()(
      `SELECT id, public_id, file_name FROM content_media
       WHERE file_name ~ ('^' || $1::text || '-b-')
       ORDER BY id`,
      [String(page.id)],
    );

    const toDelete = [];
    for (const row of mediaRows) {
      const url = `/v/${row.public_id}`;
      if (!photos.has(url)) toDelete.push(row);
    }

    if (!mapChanged && !toDelete.length) continue;

    if (summary.samples.length < 12) {
      summary.samples.push({
        id: page.id,
        title: page.title,
        deleteFiles: toDelete.map((r) => r.file_name),
        mapBefore: Object.keys(settings.listing_media_objfix_file_map || {}).length,
        mapAfter: Object.keys(map).length,
      });
    }

    console.log(JSON.stringify({
      phase: APPLY ? 'apply' : 'dry-run',
      id: page.id,
      title: page.title,
      mapChanged,
      deleteCount: toDelete.length,
      delete: toDelete.map((r) => ({ id: r.id, file_name: r.file_name, public_id: r.public_id })),
    }));

    if (!APPLY) continue;

    if (mapChanged) {
      await db.getQuery()(
        `UPDATE admin_pages_simple
         SET settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb, updated_at = NOW()
         WHERE id = $1`,
        [page.id, JSON.stringify({ listing_media_objfix_file_map: map })],
      );
      summary.mapsPruned += 1;
    }

    for (const row of toDelete) {
      const r = await contentMediaStore.deleteMediaById(row.id);
      if (r.deleted) summary.mediaDeleted += 1;
    }
  }

  console.log(JSON.stringify({ finished: true, summary }));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
