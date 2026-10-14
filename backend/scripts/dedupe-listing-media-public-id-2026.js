'use strict';

/**
 * Одно фото (/v/public_id) — одна карточка category=2026.
 * Владелец: content_media.page_id если среди использующих, иначе min(page_id).
 * APPLY=1 — убрать дубли ссылок на чужих карточках (content_media не удаляем).
 */
const db = require('../db');
const contentMediaStore = require('../services/contentMediaStore');

const APPLY = process.env.APPLY === '1';

function publicIdFromUrl(url) {
  const m = String(url || '').match(/\/v\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

function publicUrl(pid) {
  return `/v/${pid}`;
}

async function main() {
  const { rows: pages } = await db.getQuery()(
    `SELECT id, title, settings
     FROM admin_pages_simple
     WHERE category = '2026'
       AND COALESCE(jsonb_array_length(settings->'listing_media'->'photos'), 0) > 0
     ORDER BY id`,
  );

  /** @type {Map<string, Set<number>>} */
  const pidToPages = new Map();
  for (const page of pages) {
    const settings = page.settings && typeof page.settings === 'object' ? page.settings : {};
    for (const photoUrl of settings.listing_media?.photos || []) {
      const pid = publicIdFromUrl(photoUrl);
      if (!pid) continue;
      if (!pidToPages.has(pid)) pidToPages.set(pid, new Set());
      pidToPages.get(pid).add(page.id);
    }
  }

  const shared = [...pidToPages.entries()].filter(([, set]) => set.size > 1);
  const summary = {
    apply: APPLY,
    sharedPublicIds: shared.length,
    refsRemoved: 0,
    cardsTouched: new Set(),
    attachCandidates: [],
  };

  /** @type {Map<number, { settings: object, removed: object[] }>} */
  const pending = new Map();

  for (const [pid, pageSet] of shared) {
    const users = [...pageSet].sort((a, b) => a - b);
    const row = await contentMediaStore.loadReadyMetaByPublicId(pid);
    let ownerId = row?.page_id != null ? Number(row.page_id) : null;
    if (!ownerId || !pageSet.has(ownerId)) {
      ownerId = users[0];
    }
    const url = publicUrl(pid);

    for (const pageId of users) {
      if (pageId === ownerId) continue;
      if (!pending.has(pageId)) {
        const p = pages.find((x) => x.id === pageId);
        pending.set(pageId, {
          title: p?.title,
          settings: p?.settings && typeof p.settings === 'object' ? p.settings : {},
          removed: [],
        });
      }
      const entry = pending.get(pageId);
      const photos = [...(entry.settings.listing_media?.photos || [])];
      const nextPhotos = photos.filter((u) => u !== url);
      if (nextPhotos.length === photos.length) continue;

      entry.removed.push({ pid, url, ownerId });
      summary.refsRemoved += photos.length - nextPhotos.length;
      summary.cardsTouched.add(pageId);

      const map = { ...(entry.settings.listing_media_objfix_file_map || {}) };
      for (const [file, mapUrl] of Object.entries(map)) {
        if (mapUrl === url) delete map[file];
      }

      entry.settings = {
        ...entry.settings,
        listing_media: {
          photos: nextPhotos,
          video: entry.settings.listing_media?.video ?? null,
        },
        listing_media_objfix_file_map: map,
        listing_media_draft: nextPhotos.length < 8,
      };
    }
  }

  for (const [pageId, entry] of pending) {
    const kept = entry.settings.listing_media?.photos?.length || 0;
    const picked = entry.settings.listing_media_objfix_picked;
    if (kept < 8 && (picked == null || picked >= 2)) {
      summary.attachCandidates.push(pageId);
    }
    console.log(JSON.stringify({
      phase: APPLY ? 'apply' : 'dry-run',
      id: pageId,
      title: entry.title,
      removedRefs: entry.removed.length,
      kept,
      draft: entry.settings.listing_media_draft,
      details: entry.removed.slice(0, 6),
    }));

    if (!APPLY) continue;

    const seoPatch = kept ? { og_image: entry.settings.listing_media.photos[0] } : {};
    const patch = {
      listing_media: entry.settings.listing_media,
      listing_media_draft: entry.settings.listing_media_draft,
      listing_media_objfix_file_map: entry.settings.listing_media_objfix_file_map,
    };
    await db.getQuery()(
      `UPDATE admin_pages_simple
       SET settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb,
           seo = COALESCE(seo, '{}'::jsonb) || $3::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [pageId, JSON.stringify(patch), JSON.stringify(seoPatch)],
    );
  }

  console.log(JSON.stringify({
    finished: true,
    summary: {
      ...summary,
      cardsTouched: summary.cardsTouched.size,
      attachCandidates: [...new Set(summary.attachCandidates)].sort((a, b) => a - b),
    },
  }));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
