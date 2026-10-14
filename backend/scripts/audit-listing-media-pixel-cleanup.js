'use strict';

/**
 * Зачистка уже залитого listing_media (без LLM vision).
 * URL (manifest source + policy) + pixel-heuristic по файлу на диске.
 *
 * APPLY=1 — deleteMediaById + patch listing_media
 * PAGE_IDS / LIMIT_CARDS — срез
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const db = require('../../db');
const contentMediaStore = require('../../services/contentMediaStore');
const { rejectListingSourceUrl } = require('../../services/listingPool/listingPhotoSourcePolicy');
const { extraListingUrlBlocked } = require('./listing-extra-url-block');
const { analyzeBuffer: pixelAnalyzeBuffer } = require('./listing-photo-pixel-heuristic');

const APPLY = process.env.APPLY === '1';
const OBJFIX = process.env.OBJFIX_ROOT || '/tmp/objfix-b';

const MILITARY_HOST = /armyrecognition|military[\-_]?today|topwar\.ru|liveuamap|bmpd\./i;
const MILITARY_PATH = /военн|армейск|бронетех|battle[\-_]?tank|military[\-_]?vehicle|warzone|frontline/i;
const RISKY_PRESS_PATH = /gruzovikpress|article\/\d+|\/news\/|press[\-_]?center|tass|ria\.ru|interfax/i;
const PEOPLE_URL_HINT = /\/people\/|portrait|celebrity|neymar|football|футбол|пресс[\-_]?конф|conference[\-_]?room/i;
const CLASSIFIED_LEASING_HINT =
  /car-search-public|alfaleasing|avito|auto\.ru|drom\.|autoru-vos|get-autoru-vos|avatars\.avto|media\.au\.ru|stpulscen|pulscen|leasing|classified|объявлен|yandexcloud\.net\/car-search/i;
const SPY_PROTOTYPE_HINT =
  /motor1|autospies|carscoops|spy[\-_]?shot|prototype|camo[\-_]?wrap|шпион|прототип|камуфляж|test[\-_]?mule|mule[\-_]?car|pre[\-_]?production/i;

function publicIdFromUrl(url) {
  const m = String(url || '').match(/\/v\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

function parsePageIds() {
  const raw = process.env.PAGE_IDS || process.env.TEST_IDS || '';
  if (!raw.trim()) return null;
  if (raw.trim().startsWith('[')) return JSON.parse(raw);
  return raw.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n > 0);
}

function urlUnsafe(url) {
  const u = String(url || '').toLowerCase();
  if (!u) return null;
  const src = rejectListingSourceUrl(url);
  if (!src.ok) return src.reason || 'policy';
  const extra = extraListingUrlBlocked(url);
  if (extra) return extra;
  if (MILITARY_HOST.test(u) || MILITARY_PATH.test(u)) return 'military_url';
  if (RISKY_PRESS_PATH.test(u)) return 'press_news_url';
  if (PEOPLE_URL_HINT.test(u)) return 'people_url_hint';
  if (CLASSIFIED_LEASING_HINT.test(u)) return 'classified_leasing_hint';
  if (SPY_PROTOTYPE_HINT.test(u)) return 'spy_prototype_hint';
  return null;
}

async function loadManifest(pageId) {
  try {
    return JSON.parse(await fsp.readFile(path.join(OBJFIX, String(pageId), 'manifest.json'), 'utf8'));
  } catch {
    return null;
  }
}

async function manifestUrlForFile(pageId, fileKey) {
  if (!fileKey) return null;
  const manifest = await loadManifest(pageId);
  const hit = (manifest?.picked || []).find((p) => p.file === fileKey);
  return hit?.url || null;
}

function fileKeyForPublicUrl(settings, publicUrl) {
  const map = settings.listing_media_objfix_file_map || {};
  for (const [file, url] of Object.entries(map)) {
    if (url === publicUrl) return file;
  }
  const m = String(publicUrl || '').match(/\/v\/([A-Za-z0-9_-]+)/);
  if (!m) return null;
  return null;
}

function fileKeyFromRow(row, pageId) {
  const fn = String(row?.file_name || '');
  const m = fn.match(new RegExp(`^${pageId}-b-(.+)$`, 'i'));
  return m ? m[1] : null;
}

async function main() {
  const wantIds = parsePageIds();
  const limitCards = process.env.LIMIT_CARDS ? Number(process.env.LIMIT_CARDS) : null;

  const { rows: pages } = await db.getQuery()(
    `SELECT id, title, settings
     FROM admin_pages_simple
     WHERE category = '2026'
       AND COALESCE(jsonb_array_length(settings->'listing_media'->'photos'), 0) > 0
     ORDER BY id`,
  );

  let filtered = pages;
  if (wantIds?.length) {
    const set = new Set(wantIds);
    filtered = pages.filter((p) => set.has(p.id));
  }
  if (limitCards) filtered = filtered.slice(0, limitCards);

  const summary = {
    apply: APPLY,
    mode: 'url+pixel_no_vision',
    cards: filtered.length,
    checked: 0,
    removed: 0,
    cardsTouched: 0,
    samples: [],
  };

  for (const page of filtered) {
    const settings = page.settings && typeof page.settings === 'object' ? page.settings : {};
    const photos = [...(settings.listing_media?.photos || [])];
    if (!photos.length) continue;

    const kept = [];
    const removed = [];

    for (const photoUrl of photos) {
      summary.checked += 1;
      const pid = publicIdFromUrl(photoUrl);
      let row = null;
      if (pid) row = await contentMediaStore.loadReadyMetaByPublicId(pid);

      const fileKey = fileKeyForPublicUrl(settings, photoUrl) || fileKeyFromRow(row, page.id);
      const sourceUrl = fileKey ? await manifestUrlForFile(page.id, fileKey) : null;
      const urlReason = urlUnsafe(sourceUrl);
      if (urlReason) {
        removed.push({ photoUrl, sourceUrl, reason: urlReason });
        continue;
      }

      if (!row?.file_path) {
        kept.push(photoUrl);
        continue;
      }
      const abs = path.resolve(__dirname, '../..', String(row.file_path).replace(/^\/+/, ''));
      try {
        const px = await pixelAnalyzeBuffer(fs.readFileSync(abs));
        if (!px.pass) {
          removed.push({
            photoUrl,
            sourceUrl,
            reason: `pixel_${(px.reasons || []).join('_') || 'fail'}`,
          });
          continue;
        }
      } catch (e) {
        removed.push({ photoUrl, sourceUrl, reason: `read_fail_${String(e.message || e).slice(0, 40)}` });
        continue;
      }
      kept.push(photoUrl);
    }

    if (!removed.length) continue;

    summary.removed += removed.length;
    summary.cardsTouched += 1;
    if (summary.samples.length < 15) {
      summary.samples.push({ id: page.id, title: page.title, removed: removed.slice(0, 5) });
    }

    console.log(JSON.stringify({
      phase: APPLY ? 'apply' : 'dry-run',
      id: page.id,
      title: page.title,
      removed: removed.length,
      kept: kept.length,
      details: removed,
    }));

    if (!APPLY) continue;

    for (const r of removed) {
      const rid = publicIdFromUrl(r.photoUrl);
      if (rid) {
        const meta = await contentMediaStore.loadReadyMetaByPublicId(rid);
        if (meta?.id) await contentMediaStore.deleteMediaById(meta.id);
      }
    }

    const draft = kept.length < 8;
    await db.getQuery()(
      `UPDATE admin_pages_simple
       SET settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb,
           seo = COALESCE(seo, '{}'::jsonb) || $3::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [
        page.id,
        JSON.stringify({
          listing_media: { photos: kept, video: settings.listing_media?.video ?? null },
          listing_media_draft: draft,
        }),
        JSON.stringify(kept.length ? { og_image: kept[0] } : {}),
      ],
    );
  }

  console.log(JSON.stringify({ finished: true, summary }));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
