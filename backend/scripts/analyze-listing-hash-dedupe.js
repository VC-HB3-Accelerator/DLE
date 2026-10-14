'use strict';
const db = require('../db');
const contentMediaStore = require('../services/contentMediaStore');

function publicIdFromUrl(url) {
  const m = String(url || '').match(/\/v\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

(async () => {
  const { rows: pages } = await db.getQuery()(
    `SELECT id, title, settings
     FROM admin_pages_simple
     WHERE category = '2026'
       AND COALESCE(jsonb_array_length(settings->'listing_media'->'photos'), 0) > 0
     ORDER BY id`,
  );

  const hashOwner = new Map();
  const hashToPages = new Map();

  for (const page of pages) {
    const photos = page.settings?.listing_media?.photos || [];
    for (const url of photos) {
      const pid = publicIdFromUrl(url);
      if (!pid) continue;
      const row = await contentMediaStore.loadReadyMetaByPublicId(pid);
      if (!row?.file_hash) continue;
      const h = row.file_hash;
      if (!hashToPages.has(h)) hashToPages.set(h, new Set());
      hashToPages.get(h).add(page.id);
      const prev = hashOwner.get(h);
      if (prev == null || page.id < prev) hashOwner.set(h, page.id);
    }
  }

  const sharedHashes = [...hashToPages.entries()].filter(([, s]) => s.size > 1);
  const cardsLosing = [];
  const cardsEmpty = [];
  let totalCrossRemoved = 0;

  for (const page of pages) {
    const photos = [...(page.settings?.listing_media?.photos || [])];
    const kept = [];
    const seenHash = new Set();
    let cross = 0;

    for (const url of photos) {
      const pid = publicIdFromUrl(url);
      if (!pid) {
        kept.push(url);
        continue;
      }
      const row = await contentMediaStore.loadReadyMetaByPublicId(pid);
      if (!row?.file_hash) {
        kept.push(url);
        continue;
      }
      const h = row.file_hash;
      if (seenHash.has(h)) continue;
      const owner = hashOwner.get(h);
      if (owner != null && owner !== page.id) {
        cross += 1;
        continue;
      }
      seenHash.add(h);
      kept.push(url);
    }

    if (cross > 0) {
      totalCrossRemoved += cross;
      cardsLosing.push({
        id: page.id,
        title: page.title,
        before: photos.length,
        after: kept.length,
        crossRemoved: cross,
      });
    }
    if (photos.length > 0 && kept.length === 0) {
      cardsEmpty.push({ id: page.id, title: page.title, before: photos.length });
    }
  }

  const topShared = sharedHashes
    .map(([h, set]) => ({ hash: h.slice(0, 12), pages: set.size, owner: hashOwner.get(h) }))
    .sort((a, b) => b.pages - a.pages)
    .slice(0, 15);

  cardsLosing.sort((a, b) => a.after - b.after || b.crossRemoved - a.crossRemoved);

  console.log(JSON.stringify({
    summary: {
      cardsWithPhotos: pages.length,
      uniqueHashesSharedAcrossCards: sharedHashes.length,
      cardsLosingPhotos: cardsLosing.length,
      crossUrlsRemoved: totalCrossRemoved,
      cardsWouldBeEmpty: cardsEmpty.length,
      cardsUnder5After: cardsLosing.filter((c) => c.after < 5).length,
      cardsExactly0After: cardsEmpty.length,
    },
    topSharedHashes: topShared,
    emptyAfterDedupe: cardsEmpty,
    sampleWorstHit: cardsLosing.filter((c) => c.after <= 1).slice(0, 40),
  }));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
