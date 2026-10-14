'use strict';

/** Одноразовый патч deleteMediaById + manifest (запуск: docker exec -w /app dapp-backend node scripts/listing-b-mass/patch-content-media-delete.js) */
const fs = require('fs');
const p = '/app/services/contentMediaStore.js';
let s = fs.readFileSync(p, 'utf8');

if (s.includes('siblingsRemoved')) {
  console.log(JSON.stringify({ ok: true, skipped: 'already_patched' }));
  process.exit(0);
}

s = s.replace(
  `      manifest.picked = nextPicked;
      await fsp.writeFile(manifestPath, \`\${JSON.stringify(manifest, null, 2)}\\n\`, 'utf8');`,
  `      manifest.picked = nextPicked;
      manifest.saved = nextPicked.length;
      if (manifest.ref?.file === objfixFile) manifest.ref = nextPicked[0] || null;
      await fsp.writeFile(manifestPath, \`\${JSON.stringify(manifest, null, 2)}\\n\`, 'utf8');`,
);

s = s.replace(
  `  return { objfixRemoved: fileDeleted, pageId, objfixFile };
}

async function deleteMediaById(mediaId) {`,
  `  const baseStem = objfixFile.replace(/\\.[^.]+$/, '');
  for (const ext of ['.png', '.webp', '.gif', '.jpeg']) {
    const alt = \`\${baseStem}\${ext}\`;
    if (alt === objfixFile) continue;
    await fsp.unlink(path.join(dir, alt)).catch(() => {});
    await fsp.unlink(path.join(dir, \`\${alt}.ingest\`)).catch(() => {});
  }
  return { objfixRemoved: fileDeleted, pageId, objfixFile };
}

async function deleteMediaById(mediaId) {`,
);

const oldFn = `  const row = rows[0];
  let listingDetach = { pagesTouched: 0 };
  if (row.public_id) {
    listingDetach = await detachListingMediaByPublicId(row.public_id);
  }
  const objfixCleanup = await deleteListingObjfixSourceForMediaRow(row);
  await db.getQuery()('DELETE FROM content_media WHERE id = $1', [id]);
  if (row.status === 'pending' && row.upload_id) {
    await rmDirQuiet(path.join(uploadsContentRoot(), 'tmp', String(row.upload_id)));
  }
  await unlinkIfOrphanHash(row.file_hash, row.file_path, row.storage);
  return { deleted: true, listingDetach, objfixCleanup };
}`;

const newFn = `  const row = rows[0];
  let siblingRows = rows;
  const fileName = String(row.file_name || '').trim();
  if (fileName) {
    const { rows: sameName } = await db.getQuery()(
      \`SELECT id, page_id, file_name, public_id, file_hash, storage, file_path, upload_id, status
       FROM content_media WHERE file_name = $1\`,
      [fileName],
    );
    if (sameName.length) siblingRows = sameName;
  }
  const detached = new Set();
  let listingDetach = { pagesTouched: 0 };
  for (const sib of siblingRows) {
    if (sib.public_id && !detached.has(sib.public_id)) {
      detached.add(sib.public_id);
      const r = await detachListingMediaByPublicId(sib.public_id);
      listingDetach = {
        pagesTouched: listingDetach.pagesTouched + (r.pagesTouched || 0),
        publicUrl: r.publicUrl || listingDetach.publicUrl,
      };
    }
  }
  const objfixCleanup = await deleteListingObjfixSourceForMediaRow(row);
  const deletedIds = [];
  const hashSeen = new Set();
  for (const sib of siblingRows) {
    await db.getQuery()('DELETE FROM content_media WHERE id = $1', [sib.id]);
    deletedIds.push(sib.id);
    if (sib.status === 'pending' && sib.upload_id) {
      await rmDirQuiet(path.join(uploadsContentRoot(), 'tmp', String(sib.upload_id)));
    }
    const hk = \`\${sib.file_hash || ''}:\${sib.file_path || ''}\`;
    if (!hashSeen.has(hk)) {
      hashSeen.add(hk);
      await unlinkIfOrphanHash(sib.file_hash, sib.file_path, sib.storage);
    }
  }
  return {
    deleted: true,
    deletedIds,
    listingDetach,
    objfixCleanup,
    siblingsRemoved: Math.max(0, siblingRows.length - 1),
  };
}`;

if (!s.includes(oldFn)) {
  console.error(JSON.stringify({ ok: false, error: 'deleteMediaById block mismatch' }));
  process.exit(1);
}
s = s.replace(oldFn, newFn);
fs.writeFileSync(p, s);
console.log(JSON.stringify({ ok: true, patched: p }));
