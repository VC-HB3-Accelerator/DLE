/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Починка mojibake в content_media.file_name (и опционально title/alt).
 *   node scripts/repair-content-media-filenames.js
 *   node scripts/repair-content-media-filenames.js --dry-run
 */

const db = require('../db');
const { fixUtf8Filename } = require('../utils/utf8Filename');

const DRY = process.argv.includes('--dry-run');

(async () => {
  const { rows } = await db.getQuery()(
    `SELECT id, file_name, title, alt_text FROM content_media ORDER BY id`
  );
  let changed = 0;
  for (const row of rows) {
    const nextName = fixUtf8Filename(row.file_name);
    const nextTitle = row.title ? fixUtf8Filename(row.title) : row.title;
    const nextAlt = row.alt_text ? fixUtf8Filename(row.alt_text) : row.alt_text;
    if (nextName === row.file_name && nextTitle === row.title && nextAlt === row.alt_text) {
      continue;
    }
    console.log(`[repair] id=${row.id}`);
    console.log(`  was: ${row.file_name}`);
    console.log(`  now: ${nextName}`);
    if (!DRY) {
      await db.getQuery()(
        `UPDATE content_media
         SET file_name = $1,
             title = $2,
             alt_text = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [nextName, nextTitle, nextAlt, row.id]
      );
    }
    changed += 1;
  }
  console.log(`[repair] done changed=${changed} dry=${DRY}`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
