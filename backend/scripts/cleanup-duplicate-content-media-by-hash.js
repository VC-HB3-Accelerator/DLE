'use strict';

/**
 * Один file_hash → одна строка content_media (min id). Остальные deleteMediaById (карточки чистит detach).
 * APPLY=1 — удалять. SCOPE=listing-b — только file_name ^[0-9]+-b-
 */
const db = require('../db');
const contentMediaStore = require('../services/contentMediaStore');

const APPLY = process.env.APPLY === '1';
const SCOPE = String(process.env.SCOPE || 'listing-b');

async function main() {
  let where = `(status IS NULL OR status = 'ready') AND file_hash IS NOT NULL`;
  if (SCOPE === 'listing-b') {
    where += ` AND file_name ~ '^[0-9]+-b-'`;
  }

  const { rows: groups } = await db.getQuery()(
    `SELECT file_hash, count(*)::int AS n, min(id)::int AS keep_id
     FROM content_media
     WHERE ${where}
     GROUP BY file_hash
     HAVING count(*) > 1
     ORDER BY count(*) DESC`,
  );

  const summary = {
    apply: APPLY,
    scope: SCOPE,
    hashGroups: groups.length,
    rowsToDelete: 0,
    deleted: 0,
    samples: [],
  };

  for (const g of groups) {
    const { rows: dupes } = await db.getQuery()(
      `SELECT id, public_id, page_id, file_name FROM content_media
       WHERE file_hash = $1 AND id <> $2 AND (${where})
       ORDER BY id`,
      [g.file_hash, g.keep_id],
    );
    const { rows: keep } = await db.getQuery()(
      `SELECT id, public_id, file_name FROM content_media WHERE id = $1`,
      [g.keep_id],
    );
    const keeper = keep[0];
    if (!keeper) continue;

    for (const row of dupes) {
      summary.rowsToDelete += 1;
      if (summary.samples.length < 12) {
        summary.samples.push({
          keep: keeper.file_name,
          drop: row.file_name,
          hash: g.file_hash.slice(0, 12),
        });
      }
      console.log(JSON.stringify({
        phase: APPLY ? 'apply' : 'dry-run',
        keep_id: keeper.id,
        keep_name: keeper.file_name,
        drop_id: row.id,
        drop_name: row.file_name,
        group_size: g.n,
      }));
      if (!APPLY) continue;
      const r = await contentMediaStore.deleteMediaById(row.id);
      if (r.deleted) summary.deleted += 1;
    }
  }

  console.log(JSON.stringify({ finished: true, summary }));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
