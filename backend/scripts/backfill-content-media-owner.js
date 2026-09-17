/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Backfill content_media.owner_user_id:
 *   1) page_id → admin_pages_simple.owner_user_id
 *   2) author_address → user_identities (wallet)
 * Legacy без совпадения остаётся NULL (видит только editor в «все файлы»).
 *
 *   node scripts/backfill-content-media-owner.js
 *   node scripts/backfill-content-media-owner.js --dry-run
 */

const db = require('../db');
const encryptionUtils = require('../utils/encryptionUtils');
const contentMediaStore = require('../services/contentMediaStore');

const DRY = process.argv.includes('--dry-run');

async function ensureColumn() {
  await contentMediaStore.listMedia({ limit: 1, offset: 0 });
}

async function countNull() {
  const { rows } = await db.getQuery()(
    `SELECT COUNT(*)::int AS n FROM content_media WHERE owner_user_id IS NULL`
  );
  return rows[0]?.n || 0;
}

async function backfillFromPages() {
  if (DRY) {
    const { rows } = await db.getQuery()(
      `SELECT COUNT(*)::int AS n
       FROM content_media cm
       JOIN admin_pages_simple p ON p.id = cm.page_id
       WHERE cm.owner_user_id IS NULL
         AND p.owner_user_id IS NOT NULL`
    );
    return rows[0]?.n || 0;
  }
  const { rowCount } = await db.getQuery()(`
    UPDATE content_media cm
    SET owner_user_id = p.owner_user_id,
        updated_at = CURRENT_TIMESTAMP
    FROM admin_pages_simple p
    WHERE cm.owner_user_id IS NULL
      AND cm.page_id IS NOT NULL
      AND cm.page_id = p.id
      AND p.owner_user_id IS NOT NULL
  `);
  return rowCount || 0;
}

async function backfillFromWallet() {
  const key = encryptionUtils.getEncryptionKey();
  // Сначала точное совпадение encrypt(lower(addr)); затем decrypt+lower для legacy регистра.
  if (DRY) {
    const { rows } = await db.getQuery()(
      `SELECT COUNT(*)::int AS n
       FROM content_media cm
       WHERE cm.owner_user_id IS NULL
         AND cm.author_address IS NOT NULL
         AND length(trim(cm.author_address)) > 0
         AND EXISTS (
           SELECT 1 FROM user_identities ui
           WHERE ui.provider_encrypted = encrypt_text('wallet', $1)
             AND (
               ui.provider_id_encrypted = encrypt_text(lower(trim(cm.author_address)), $1)
               OR lower(decrypt_text(ui.provider_id_encrypted, $1))
                    = lower(trim(cm.author_address))
             )
         )`,
      [key]
    );
    return rows[0]?.n || 0;
  }

  const { rowCount: exact } = await db.getQuery()(
    `UPDATE content_media cm
     SET owner_user_id = ui.user_id,
         updated_at = CURRENT_TIMESTAMP
     FROM user_identities ui
     WHERE cm.owner_user_id IS NULL
       AND cm.author_address IS NOT NULL
       AND length(trim(cm.author_address)) > 0
       AND ui.provider_encrypted = encrypt_text('wallet', $1)
       AND ui.provider_id_encrypted = encrypt_text(lower(trim(cm.author_address)), $1)`,
    [key]
  );

  const { rowCount: fuzzy } = await db.getQuery()(
    `UPDATE content_media cm
     SET owner_user_id = ui.user_id,
         updated_at = CURRENT_TIMESTAMP
     FROM user_identities ui
     WHERE cm.owner_user_id IS NULL
       AND cm.author_address IS NOT NULL
       AND length(trim(cm.author_address)) > 0
       AND ui.provider_encrypted = encrypt_text('wallet', $1)
       AND lower(decrypt_text(ui.provider_id_encrypted, $1))
             = lower(trim(cm.author_address))`,
    [key]
  );

  return (exact || 0) + (fuzzy || 0);
}

(async () => {
  await ensureColumn();
  const before = await countNull();
  console.log(`[backfill-media-owner] null_before=${before} dry=${DRY}`);

  const fromPages = await backfillFromPages();
  console.log(`[backfill-media-owner] from_pages=${fromPages}`);

  const fromWallet = await backfillFromWallet();
  console.log(`[backfill-media-owner] from_wallet=${fromWallet}`);

  const after = await countNull();
  console.log(`[backfill-media-owner] null_after=${after} done`);
  process.exit(0);
})().catch((e) => {
  console.error('[backfill-media-owner]', e);
  process.exit(1);
});
