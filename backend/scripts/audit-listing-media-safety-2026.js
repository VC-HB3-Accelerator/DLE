'use strict';

/**
 * Просмотр listing_media категории 2026: удалить off-topic и небезопасные фото (люди, военка, арт, запчасти, здания, награды, космос, города, ч/б старина).
 *
 * APPLY=1 — писать в БД и deleteMedia; иначе dry-run.
 * LIMIT_CARDS / PAGE_IDS — срез.
 * SKIP_VISION=1 — только URL-эвристики (manifest source url).
 *
 * node scripts/audit-listing-media-safety-2026.js
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawnSync } = require('child_process');
const db = require('../db');
const contentMediaStore = require('../services/contentMediaStore');
const { rejectListingSourceUrl } = require('../services/listingPool/listingPhotoSourcePolicy');
const { parseSpawnStdoutJson } = require('./listing-spawn-json');

const APPLY = process.env.APPLY === '1';
const SKIP_VISION = process.env.SKIP_VISION === '1';
const OBJFIX = process.env.OBJFIX_ROOT || '/tmp/objfix-b';

const MILITARY_HOST = /armyrecognition|military[\-_]?today|defence[\-_]?blog|warhistory|globalsecurity|janes\.com|topwar\.ru|lostarmour|liveuamap|bmpd\.|ukrainewar|war[\-_]?zone|conflict[\-_]?arm|under[\-_]?the[\-_]?rap/i;
const MILITARY_PATH = /военн|армейск|бронетех|бронемаш|бмп[\-_]|бтр[\-_]|бмд[\-_]|артиллер|огнемет|миномет|смерч|град[\-_]|battle[\-_]?tank|military[\-_]?vehicle|armored[\-_]?vehicle|warfare|warzone|frontline|anti[\-_]?tank|humvee|himars|iskander|bayraktar|shahed|leopard[\-_]?2|abrams|bradley|tigr[\-_]m|ural[\-_]m|камуфл|camouflage[\-_]?net|z[\-_]?symbol|parade[\-_]?red|9[\-_]?may|(\/|\-|_)tanks?(\/|\-|_|\.|\?|$)/i;
const RISKY_PRESS_PATH = /gruzovikpress|article\/\d+|\/news\/img|press[\-_]?center|blog[\-_]?post/i;
const PEOPLE_URL_HINT = /\/people\/|\/person\/|staff[\-_]?photo|team[\-_]?photo|driver[\-_]?portrait|portrait[\-_]|celebrity|red[\-_]?carpet/i;

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

function visionFailReason(vis) {
  if (vis.has_military) return 'military_vision';
  if (vis.has_people) return 'people_vision';
  if (vis.has_animals) return 'animals_vision';
  if (vis.has_artwork) return 'artwork_vision';
  if (vis.has_parts) return 'parts_vision';
  if (vis.has_buildings) return 'buildings_vision';
  if (vis.has_awards) return 'awards_vision';
  if (vis.has_space) return 'space_vision';
  if (vis.has_cityscape) return 'city_vision';
  if (vis.has_vintage_photo) return 'vintage_vision';
  return 'vision_fail';
}

function urlUnsafe(url) {
  const u = String(url || '').toLowerCase();
  if (!u) return null;
  const src = rejectListingSourceUrl(url);
  if (!src.ok) return src.reason || 'press_dealer';
  if (MILITARY_HOST.test(u) || MILITARY_PATH.test(u)) return 'military_url';
  if (RISKY_PRESS_PATH.test(u)) return 'press_article_url';
  if (PEOPLE_URL_HINT.test(u)) return 'people_url_hint';
  if (/war-|frontline|soldier|parade-red|voenn|voenno|armiya|с[\s\-_]?vo/i.test(u)) return 'risky_source_url';
  return null;
}

function mimeOf(filePath) {
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function visionSafety(absPath) {
  if (SKIP_VISION) return { pass: true, skipped: true };
  let buf;
  try {
    buf = fs.readFileSync(absPath);
  } catch (e) {
    return { pass: true, skipped: true, reasons: [`read:${e.message}`] };
  }
  if (buf.length > 2.8 * 1024 * 1024) {
    return { pass: true, skipped: true, reasons: ['too_large'] };
  }
  const b64 = buf.toString('base64');
  const mime = mimeOf(absPath);
  const payload = JSON.stringify({ b64, mime });
  const run = spawnSync(
    process.env.SAFETY_CRITIC_NODE || 'node',
    [path.join(__dirname, 'listing-photo-safety-critic.js')],
    { input: payload, encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 },
  );
  const parsed = parseSpawnStdoutJson(run.stdout);
  if (!parsed) {
    return { pass: false, reasons: ['vision_parse_error'] };
  }
  return parsed;
}

async function loadManifest(pageId) {
  const mf = path.join(OBJFIX, String(pageId), 'manifest.json');
  try {
    return JSON.parse(await fsp.readFile(mf, 'utf8'));
  } catch {
    return null;
  }
}

async function manifestUrlForFile(pageId, fileKey) {
  if (!fileKey) return null;
  const manifest = await loadManifest(pageId);
  if (!manifest) return null;
  const picked = manifest.picked || [];
  const hit = picked.find((p) => p.file === fileKey);
  return hit?.url || null;
}

async function manifestUrlByIndex(pageId, indexInPhotos) {
  const manifest = await loadManifest(pageId);
  if (!manifest?.picked?.[indexInPhotos]?.url) return null;
  return manifest.picked[indexInPhotos].url;
}

function fileKeyForPublicUrl(settings, publicUrl) {
  const map = settings.listing_media_objfix_file_map || {};
  for (const [file, url] of Object.entries(map)) {
    if (url === publicUrl) return file;
  }
  return null;
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
    skipVision: SKIP_VISION,
    phase: process.env.AUDIT_PHASE || (SKIP_VISION ? 'url-only' : 'url+vision'),
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

    for (let pi = 0; pi < photos.length; pi += 1) {
      const photoUrl = photos[pi];
      summary.checked += 1;
      const fileKey = fileKeyForPublicUrl(settings, photoUrl);
      let sourceUrl = fileKey ? await manifestUrlForFile(page.id, fileKey) : null;
      if (!sourceUrl) sourceUrl = await manifestUrlByIndex(page.id, pi);
      const urlReason = urlUnsafe(sourceUrl);
      if (urlReason) {
        removed.push({ photoUrl, sourceUrl, reason: urlReason });
        continue;
      }

      const pid = publicIdFromUrl(photoUrl);
      if (!pid) {
        kept.push(photoUrl);
        continue;
      }
      const row = await contentMediaStore.loadReadyMetaByPublicId(pid);
      if (!row?.file_path) {
        kept.push(photoUrl);
        continue;
      }
      const abs = path.resolve(__dirname, '..', String(row.file_path).replace(/^\/+/, ''));

      const vis = visionSafety(abs);
      if (!vis.pass) {
        removed.push({
          photoUrl,
          sourceUrl,
          reason: visionFailReason(vis),
          reasons: vis.reasons || [],
        });
        continue;
      }
      kept.push(photoUrl);
    }

    if (!removed.length) continue;

    summary.removed += removed.length;
    summary.cardsTouched += 1;
    if (summary.samples.length < 12) {
      summary.samples.push({
        id: page.id,
        title: page.title,
        removed: removed.slice(0, 4),
        kept: kept.length,
      });
    }

    console.log(JSON.stringify({
      phase: APPLY ? 'apply' : 'dry-run',
      audit: summary.phase,
      id: page.id,
      title: page.title,
      removed: removed.length,
      kept: kept.length,
      details: removed,
    }));

    if (!APPLY) continue;

    for (const r of removed) {
      const pid = publicIdFromUrl(r.photoUrl);
      if (pid) {
        const row = await contentMediaStore.loadReadyMetaByPublicId(pid);
        if (row?.id) await contentMediaStore.deleteMediaById(row.id);
      }
    }

    const draft = kept.length < 8;
    const settingsPatch = {
      listing_media: { photos: kept, video: settings.listing_media?.video ?? null },
      listing_media_draft: draft,
    };
    const seoPatch = kept.length ? { og_image: kept[0] } : {};
    await db.getQuery()(
      `UPDATE admin_pages_simple
       SET settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb,
           seo = COALESCE(seo, '{}'::jsonb) || $3::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [page.id, JSON.stringify(settingsPatch), JSON.stringify(seoPatch)],
    );
  }

  console.log(JSON.stringify({ finished: true, summary }));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
