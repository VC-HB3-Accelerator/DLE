'use strict';

/**
 * Убрать из медиатеки plan-B шум: *-b-* не используется ни в одной карточке/SEO/HTML.
 * APPLY=1 — deleteMediaById (файл на диске, если hash orphan).
 */
const db = require('../db');
const contentMediaStore = require('../services/contentMediaStore');

const APPLY = process.env.APPLY === '1';
const CATEGORY = String(process.env.CATEGORY || '').trim();

function publicUrl(pid) {
  return `/v/${pid}`;
}

async function collectUsedPublicUrls() {
  const used = new Set();
  const params = [];
  let where = '1=1';
  if (CATEGORY) {
    where = `category = $1`;
    params.push(CATEGORY);
  }
  const { rows: pages } = await db.getQuery()(
    `SELECT id, settings, seo, content FROM admin_pages_simple WHERE ${where}`,
    params,
  );
  for (const p of pages) {
    const settings = p.settings && typeof p.settings === 'object' ? p.settings : {};
    for (const u of settings.listing_media?.photos || []) {
      if (u) used.add(String(u));
    }
    const map = settings.listing_media_objfix_file_map || {};
    for (const u of Object.values(map)) {
      if (u) used.add(String(u));
    }
    const seo = p.seo && typeof p.seo === 'object' ? p.seo : {};
    if (seo.og_image) used.add(String(seo.og_image));
    for (const m of String(p.content || '').matchAll(/\/v\/[A-Za-z0-9_-]+/g)) {
      used.add(m[0]);
    }
  }

  const { rows: storeRefs } = await db.getQuery()(
    `SELECT cm.public_id FROM store_product_media spm
     JOIN content_media cm ON cm.id = spm.content_media_id
     WHERE cm.public_id IS NOT NULL AND cm.public_id <> ''`,
  );
  for (const r of storeRefs) used.add(publicUrl(r.public_id));

  return used;
}

async function main() {
  const usedUrls = await collectUsedPublicUrls();
  const { rows: candidates } = await db.getQuery()(
    `SELECT id, public_id, page_id, file_name, file_hash
     FROM content_media
     WHERE file_name ~ '^[0-9]+-b-'
       AND (status IS NULL OR status = 'ready')
     ORDER BY id`,
  );

  const summary = {
    apply: APPLY,
    categoryScope: CATEGORY || 'all',
    listingBCandidates: candidates.length,
    orphans: 0,
    deleted: 0,
    samples: [],
  };

  for (const row of candidates) {
    const url = publicUrl(row.public_id);
    if (usedUrls.has(url)) continue;
    summary.orphans += 1;
    if (summary.samples.length < 15) {
      summary.samples.push({ id: row.id, file_name: row.file_name, page_id: row.page_id, public_id: row.public_id });
    }
    console.log(JSON.stringify({
      phase: APPLY ? 'apply' : 'dry-run',
      id: row.id,
      file_name: row.file_name,
      page_id: row.page_id,
      public_id: row.public_id,
    }));
    if (!APPLY) continue;
    const r = await contentMediaStore.deleteMediaById(row.id);
    if (r.deleted) summary.deleted += 1;
  }

  console.log(JSON.stringify({ finished: true, summary }));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
