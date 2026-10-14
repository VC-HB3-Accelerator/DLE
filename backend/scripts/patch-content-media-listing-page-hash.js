'use strict';

/** Не плодить public_id на один file_hash + page_id (listing attach / incremental). */
const fs = require('fs');
const p = '/app/services/contentMediaStore.js';
let s = fs.readFileSync(p, 'utf8');

if (s.includes('findReadyByHashForPage')) {
  console.log(JSON.stringify({ ok: true, skipped: 'already_patched' }));
  process.exit(0);
}

const fn = `
/** Listing: тот же hash уже на этой карточке — один public_id, без listing_hash_alias. */
async function findReadyByHashForPage(fileHash, pageId) {
  const pid = Number(pageId);
  if (!fileHash || !Number.isInteger(pid) || pid <= 0) return null;
  const { rows } = await db.getQuery()(
    \`SELECT \${META_COLUMNS}
     FROM content_media
     WHERE file_hash = $1 AND page_id = $2 AND (status IS NULL OR status = 'ready')
     ORDER BY id ASC
     LIMIT 1\`,
    [fileHash, pid]
  );
  return rows[0] || null;
}

`;

const anchor = 'async function findReadyByIdempotencyKey(idempotencyKey) {';
const needle = `  const fileHash = await hashFile(tmpPath);
  const existing = await findReadyByHash(fileHash);
  if (existing) {
    const listingPhoto = purpose === 'listing';
    const ownerPageId = Number(existing.page_id);
    const targetPageId = Number(pageId);`;

const repl = `  const fileHash = await hashFile(tmpPath);
  const targetPageId = Number(pageId);
  if (purpose === 'listing' && Number.isInteger(targetPageId) && targetPageId > 0) {
    const onPage = await findReadyByHashForPage(fileHash, targetPageId);
    if (onPage) {
      const bound = await bindMediaIdempotencyKey(idempotencyKey, onPage.id);
      await unlinkQuiet(tmpPath);
      return {
        row: bound || onPage,
        isDuplicate: true,
        skipped: 'listing_page_hash',
      };
    }
  }
  const existing = await findReadyByHash(fileHash);
  if (existing) {
    const listingPhoto = purpose === 'listing';
    const ownerPageId = Number(existing.page_id);
    const targetPageId = Number(pageId);`;

if (!s.includes(anchor) || !s.includes(needle)) {
  console.error(JSON.stringify({ ok: false, error: 'block_not_found' }));
  process.exit(1);
}

s = s.replace(anchor, fn + anchor).replace(needle, repl);
fs.writeFileSync(p, s);
console.log(JSON.stringify({ ok: true, patched: 'listing_page_hash_reuse' }));
