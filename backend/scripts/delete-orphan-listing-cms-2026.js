'use strict';

/**
 * Удалить content_media listing 2026, чей public_id ни в одной listing_media.photos.
 * APPLY=1 — удаление (по умолчанию dry-run).
 */
const db = require('../db');
const cms = require('../services/contentMediaStore');
const fsp = require('fs/promises');
const path = require('path');

const APPLY = process.env.APPLY === '1';

async function orphanRows() {
  const { rows } = await db.getQuery()(`
    WITH gallery AS (
      SELECT DISTINCT substring(u from '/v/([A-Za-z0-9_-]+)') pid
      FROM admin_pages_simple, jsonb_array_elements_text(COALESCE(settings->'listing_media'->'photos','[]'::jsonb)) u
      WHERE category = '2026' AND u ~ '/v/'
    )
    SELECT cm.id, cm.public_id, cm.file_name, cm.file_hash, cm.file_path, cm.storage
    FROM content_media cm
    JOIN admin_pages_simple p ON p.id = cm.page_id AND p.category = '2026'
    WHERE (cm.status IS NULL OR cm.status = 'ready') AND cm.public_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM gallery g WHERE g.pid = cm.public_id)
    ORDER BY cm.id
  `);
  return rows;
}

async function deleteSurgical(row) {
  await db.getQuery()('DELETE FROM content_media WHERE id = $1', [row.id]);
  if (row.file_hash) {
    const { rows: cnt } = await db.getQuery()(
      'SELECT COUNT(*)::int AS count FROM content_media WHERE file_hash = $1',
      [row.file_hash],
    );
    if (cnt[0].count === 0 && row.storage === 'disk' && row.file_path) {
      const abs = path.resolve(__dirname, '../..', String(row.file_path).replace(/^\/+/, ''));
      await fsp.unlink(abs).catch(() => {});
    }
  }
  return { id: row.id, public_id: row.public_id, mode: 'surgical' };
}

async function main() {
  const orphans = await orphanRows();
  const summary = {
    apply: APPLY,
    orphanCount: orphans.length,
    deleted: [],
    skipped: [],
  };

  if (!orphans.length) {
    console.log(JSON.stringify({ finished: true, summary }, null, 2));
    return;
  }

  const orphanIdSet = new Set(orphans.map((o) => o.id));
  const done = new Set();

  for (const row of orphans) {
    if (done.has(row.id)) continue;

    const sibs = (await db.getQuery()(
      'SELECT id FROM content_media WHERE file_name = $1',
      [row.file_name],
    )).rows;
    const inGallerySib = sibs.some((s) => !orphanIdSet.has(s.id));

    if (!APPLY) {
      summary.deleted.push({
        id: row.id,
        public_id: row.public_id,
        file_name: row.file_name,
        mode: inGallerySib ? 'surgical (planned)' : 'deleteMediaById (planned)',
      });
      continue;
    }

    if (inGallerySib) {
      summary.deleted.push(await deleteSurgical(row));
      done.add(row.id);
      continue;
    }

    const r = await cms.deleteMediaById(row.id);
    for (const id of r.deletedIds || [row.id]) done.add(id);
    summary.deleted.push({
      id: row.id,
      public_id: row.public_id,
      mode: 'deleteMediaById',
      deletedIds: r.deletedIds,
    });
  }

  const left = await orphanRows();
  const total = (await db.getQuery()('SELECT COUNT(*)::int n FROM content_media')).rows[0].n;
  summary.orphansRemaining = left.length;
  summary.content_media_total = total;
  summary.uniqueIdsRemoved = done.size;

  console.log(JSON.stringify({ finished: true, summary }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
