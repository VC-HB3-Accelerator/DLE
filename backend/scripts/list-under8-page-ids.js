'use strict';

/**
 * stdout: id per line — страницы с числом listing_media.photos ниже порога очереди.
 *
 * LISTING_MASS_LIST_BELOW — порог очереди (напр. 5 → photos < 5). Не меняет цель attach.
 * ATTACH_TARGET — только для лога; если LIST_BELOW не задан, очередь = photos < min(8, ATTACH_TARGET).
 */
const db = require('../db');

const attachTarget = Math.min(8, Math.max(1, Number(process.env.ATTACH_TARGET || 8)));
const listBelowRaw = process.env.LISTING_MASS_LIST_BELOW;
const listBelow = listBelowRaw !== undefined && String(listBelowRaw).trim() !== ''
  ? Math.min(8, Math.max(1, Number(listBelowRaw)))
  : attachTarget;
const category = String(process.env.LISTING_MASS_CATEGORY || '2026').trim();

async function main() {
  const { rows } = await db.getQuery()(
    `SELECT id
     FROM admin_pages_simple
     WHERE ($2 = '' OR category = $2)
       AND coalesce(jsonb_array_length(settings->'listing_media'->'photos'), 0) < $1
     ORDER BY id ASC`,
    [listBelow, category],
  );
  for (const r of rows) {
    process.stdout.write(`${r.id}\n`);
  }
  process.stderr.write(JSON.stringify({
    queued: rows.length,
    listBelow,
    attachTarget,
    category: category || 'all',
  }) + '\n');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
