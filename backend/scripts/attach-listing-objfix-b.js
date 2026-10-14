'use strict';

/**
 * Залить picked из OBJFIX_ROOT в listing_media (plan b).
 * ATTACH_QUALITY_GATE=0 — отключить URL+vision (по умолчанию 1)
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const db = require('../db');
const contentMediaStore = require('../services/contentMediaStore');
const { rejectListingSourceUrl } = require('../services/listingPool/listingPhotoSourcePolicy');
const { extraListingUrlBlocked } = require('./listing-extra-url-block');
const { analyzeBuffer: pixelAnalyzeBuffer } = require('./listing-photo-pixel-heuristic');

const ATTACH_JUNK_URL_RE =
  /neymar|ronaldo|messi|football|facade|skyline|architecture|infographic|wallpaper|обои|celebrit|portrait|vintage|sepia|black[\-_]and[\-_]white|car-search-public|alfaleasing|avito|auto\.ru|drom\.|autoru-vos|get-autoru-vos|stpulscen|pulscen|leasing[\-_]?catalog|classified|объявлен|motor1|autospies|carscoops|spy[\-_]?shot|prototype|camo[\-_]?wrap|шпион|прототип|камуфляж|test[\-_]?mule|mule[\-_]?car/i;

function isAttachBlockedPhotoUrl(url) {
  const u = String(url || '').trim();
  if (!u) return false;
  if (!rejectListingSourceUrl(u).ok) return true;
  if (extraListingUrlBlocked(u)) return true;
  if (ATTACH_JUNK_URL_RE.test(u)) return true;
  if (process.env.LISTING_BLOCK_PNG_URL !== '0') {
    const low = u.toLowerCase();
    if (/\.(png|gif|bmp|tiff?)(\?|#|$)/i.test(low)) return true;
    if (/\.webp(\?|#|$)/i.test(low) && !/(?:press|official|media-library|static\.(?:sollers|daf|kamaz|maz|ural))/i.test(low)) {
      return true;
    }
  }
  return false;
}
function resolveScript(name) {
  const candidates = [
    path.join(__dirname, name),
    path.join(__dirname, '..', name),
  ];
  for (const p of candidates) {
    try {
      return require.resolve(p);
    } catch {
      /* next */
    }
  }
  return name;
}
const { parseSpawnStdoutJson } = require(resolveScript('listing-spawn-json.js'));
const { normalizeListingFile } = require('./normalize-listing-feed-image.js');

const ROOT = process.env.OBJFIX_ROOT || '/tmp/objfix-b';
const ATTACH_MIN = Math.max(1, Number(process.env.ATTACH_MIN || 1));
const ATTACH_TARGET = Math.min(8, Math.max(1, Number(process.env.ATTACH_TARGET || 8)));
const ATTACH_QUALITY_GATE = process.env.ATTACH_QUALITY_GATE !== '0';

function parsePageIds(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (s.startsWith('[')) return JSON.parse(s);
  return s.split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => Number.isInteger(n) && n > 0);
}

async function orderedDirIds() {
  const names = (await fsp.readdir(ROOT)).filter((n) => /^\d+$/.test(n));
  const want = parsePageIds(process.env.PAGE_IDS || process.env.TEST_IDS);
  if (want && want.length) {
    const set = new Set(names);
    return want.map(String).filter((id) => set.has(id));
  }
  return names.sort((a, b) => Number(a) - Number(b));
}

function mimeOf(file) {
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function prepareListingIngestTmp(filePath) {
  const tmp = `${filePath}.ingest`;
  await normalizeListingFile(filePath, tmp);
  const st = await fsp.stat(tmp);
  return { tmpPath: tmp, mimeType: 'image/jpeg', size: st.size };
}

function visionSafetySync(absPath) {
  if (!ATTACH_QUALITY_GATE) return { pass: true };
  let buf;
  try {
    buf = fs.readFileSync(absPath);
  } catch (e) {
    return { pass: true, skipped: true };
  }
  if (buf.length > 2.8 * 1024 * 1024) return { pass: true, skipped: true };
  const payload = JSON.stringify({
    b64: buf.toString('base64'),
    mime: mimeOf(absPath),
  });
  const run = spawnSync(
    'node',
    [resolveScript('listing-photo-safety-critic.js')],
    { input: payload, encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 },
  );
  const parsed = parseSpawnStdoutJson(run.stdout);
  if (!parsed) {
    return { pass: true, skipped: true, reasons: ['vision_parse_error'] };
  }
  return parsed;
}

async function pixelHeuristicGate(absPath) {
  if (process.env.LISTING_PIXEL_GATE === '0') return { pass: true, skipped: true };
  try {
    const buf = await fsp.readFile(absPath);
    return await pixelAnalyzeBuffer(buf);
  } catch {
    return { pass: true, soft: true, skipped: true };
  }
}

function publicIdFromListingUrl(url) {
  const m = String(url || '').trim().match(/^\/v\/([^/?#]+)/);
  return m ? m[1] : null;
}

async function fileHashByPublicIds(publicIds) {
  const pids = [...new Set(publicIds.filter(Boolean))];
  if (!pids.length) return new Map();
  const { rows } = await db.getQuery()(
    `SELECT public_id, file_hash FROM content_media WHERE public_id = ANY($1) AND file_hash IS NOT NULL`,
    [pids],
  );
  const map = new Map();
  for (const r of rows) map.set(r.public_id, r.file_hash);
  return map;
}

async function dedupePhotoUrlsByHash(urls) {
  const pids = urls.map((u) => publicIdFromListingUrl(u)).filter(Boolean);
  const hashMap = await fileHashByPublicIds(pids);
  const seenUrl = new Set();
  const seenHash = new Set();
  const out = [];
  for (const url of urls) {
    const u = String(url || '').trim();
    if (!u || seenUrl.has(u)) continue;
    const pid = publicIdFromListingUrl(u);
    const h = pid ? hashMap.get(pid) : null;
    if (h) {
      if (seenHash.has(h)) continue;
      seenHash.add(h);
    }
    seenUrl.add(u);
    out.push(u);
  }
  return out;
}

async function main() {
  const dirs = await orderedDirIds();
  for (const id of dirs) {
    const dir = path.join(ROOT, String(id));
    let manifest;
    try {
      manifest = JSON.parse(await fsp.readFile(path.join(dir, 'manifest.json'), 'utf8'));
    } catch (e) {
      console.log(JSON.stringify({ id: Number(id), skip: 'no manifest', err: String(e.code || e.message) }));
      continue;
    }
    if (!String(manifest.planVersion || '').startsWith('b')) {
      console.log(JSON.stringify({ id: Number(id), skip: 'not plan b' }));
      continue;
    }
    const picked = manifest.picked || [];
    if (picked.length < ATTACH_MIN) {
      console.log(JSON.stringify({ id: Number(id), title: manifest.title, skip: 'below ATTACH_MIN', have: picked.length }));
      continue;
    }
    try {
      const stray = (await fsp.readdir(dir)).filter((f) => /\.(png|webp|gif)$/i.test(f));
      for (const f of stray) {
        await fsp.unlink(path.join(dir, f)).catch(() => {});
      }
    } catch {
      /* ignore */
    }
    const { rows: pageRows } = await db.getQuery()(
      'SELECT settings, content FROM admin_pages_simple WHERE id = $1',
      [Number(id)],
    );
    const prevSettings = pageRows[0]?.settings || {};
    const fileMap = process.env.ATTACH_RESET_FILE_MAP === '1' ? {} : { ...(prevSettings.listing_media_objfix_file_map || {}) };

    const photos = [];
    const seenPhotoUrl = new Set();
    const galleryHashes = new Set();
    const mergeExisting = process.env.ATTACH_MERGE_EXISTING !== '0';
    if (mergeExisting) {
      const prevUrls = (prevSettings.listing_media?.photos || [])
        .map((u) => String(u || '').trim())
        .filter(Boolean);
      const prevHashMap = await fileHashByPublicIds(
        prevUrls.map((u) => publicIdFromListingUrl(u)).filter(Boolean),
      );
      for (const url of prevUrls) {
        if (photos.length >= ATTACH_TARGET) break;
        if (!url || seenPhotoUrl.has(url) || isAttachBlockedPhotoUrl(url)) continue;
        const pid = publicIdFromListingUrl(url);
        const h = pid ? prevHashMap.get(pid) : null;
        if (h && galleryHashes.has(h)) continue;
        if (h) galleryHashes.add(h);
        seenPhotoUrl.add(url);
        photos.push(url);
      }
    }
    let skippedUrl = 0;
    let skippedVision = 0;

    const ingestAllForLibrary = process.env.ATTACH_INGEST_ALL_FILES === '1';
    if (ingestAllForLibrary) {
      const names = (await fsp.readdir(dir)).filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f));
      for (const file of names) {
        if (fileMap[file]) continue;
        const filePath = path.join(dir, file);
        let st;
        try {
          st = await fsp.stat(filePath);
        } catch {
          continue;
        }
        const prep = await prepareListingIngestTmp(filePath);
        const { row } = await contentMediaStore.ingestOneShotFromPath({
          tmpPath: prep.tmpPath,
          originalName: `${id}-b-${file.replace(/\.(png|webp|gif)$/i, '.jpg')}`,
          mimeType: prep.mimeType,
          size: prep.size,
          authorAddress: null,
          pageId: Number(id),
          ownerUserId: null,
          purpose: 'listing',
          forceOneShot: true,
        });
        fileMap[file] = contentMediaStore.publicFileUrl(row);
      }
    }

    const seenFileHash = new Set();

    function sha256FileSync(absPath) {
      try {
        return crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
      } catch {
        return null;
      }
    }

    for (const item of picked) {
      if (photos.length >= ATTACH_TARGET) break;
      if (!/\.jpe?g$/i.test(String(item.file || ''))) continue;
      if (item.url && isAttachBlockedPhotoUrl(item.url)) {
        skippedUrl += 1;
        continue;
      }
      const filePath = path.join(dir, item.file);
      const digest = sha256FileSync(filePath);
      if (digest && (seenFileHash.has(digest) || galleryHashes.has(digest))) continue;

      if (fileMap[item.file]) {
        const url = fileMap[item.file];
        if (seenPhotoUrl.has(url)) continue;
        const pid = publicIdFromListingUrl(url);
        const mappedHash = pid ? (await fileHashByPublicIds([pid])).get(pid) : null;
        const effHash = mappedHash || digest;
        if (effHash && galleryHashes.has(effHash)) continue;
        seenPhotoUrl.add(url);
        if (effHash) {
          galleryHashes.add(effHash);
          seenFileHash.add(effHash);
        }
        photos.push(url);
        continue;
      }
      let st;
      try {
        st = await fsp.stat(filePath);
      } catch {
        continue;
      }
      let prep;
      try {
        prep = await prepareListingIngestTmp(filePath);
      } catch {
        continue;
      }
      const pixel = await pixelHeuristicGate(prep.tmpPath);
      if (!pixel.pass) {
        skippedVision += 1;
        await fsp.unlink(prep.tmpPath).catch(() => {});
        continue;
      }
      if (ATTACH_QUALITY_GATE) {
        const vis = visionSafetySync(prep.tmpPath);
        if (!vis.pass) {
          skippedVision += 1;
          await fsp.unlink(prep.tmpPath).catch(() => {});
          continue;
        }
      }
      const ingestHash = digest || crypto.createHash('sha256').update(fs.readFileSync(prep.tmpPath)).digest('hex');
      if (ingestHash && galleryHashes.has(ingestHash)) {
        await fsp.unlink(prep.tmpPath).catch(() => {});
        continue;
      }
      const idempotencyKey = `listing-b:${id}:${item.file}:${ingestHash.slice(0, 16)}`;
      const ingestResult = await contentMediaStore.ingestOneShotFromPath({
        tmpPath: prep.tmpPath,
        originalName: `${id}-b-${item.file.replace(/\.(png|webp|gif)$/i, '.jpg')}`,
        mimeType: prep.mimeType,
        size: prep.size,
        authorAddress: null,
        pageId: Number(id),
        ownerUserId: null,
        purpose: 'listing',
        forceOneShot: true,
        idempotencyKey,
      });
      const row = ingestResult.row;
      const url = contentMediaStore.publicFileUrl(row);
      fileMap[item.file] = url;
      const rowHash = row.file_hash || ingestHash;
      if (rowHash && galleryHashes.has(rowHash)) continue;
      if (seenPhotoUrl.has(url)) continue;
      seenPhotoUrl.add(url);
      if (rowHash) {
        galleryHashes.add(rowHash);
        seenFileHash.add(rowHash);
      }
      photos.push(url);
    }

    const pickedFiles = new Set(picked.map((p) => p && p.file).filter(Boolean));
    for (const key of Object.keys(fileMap)) {
      if (!pickedFiles.has(key)) delete fileMap[key];
    }

    const photosDeduped = await dedupePhotoUrlsByHash(photos);
    const dedupeRemoved = photos.length - photosDeduped.length;
    if (!photosDeduped.length) {
      console.log(JSON.stringify({ id: Number(id), title: manifest.title, skip: 'no clean photos', skippedUrl, skippedVision }));
      continue;
    }

    const draft = photosDeduped.length < 8;
    const settingsPatch = {
      compose_mode: 'listing',
      listing_media: { photos: photosDeduped, video: null },
      listing_media_test: 'b',
      listing_media_draft: draft,
      listing_media_objfix_picked: picked.length,
      listing_media_objfix_file_map: fileMap,
      listing_media_objfix_at: new Date().toISOString(),
      listing_media_quality_gate: ATTACH_QUALITY_GATE,
    };
    if (!draft || process.env.ATTACH_CLEAR_SHOWROOM === '1') {
      settingsPatch.showroom = false;
      settingsPatch.showroom_eight = false;
      settingsPatch.showroom_frame_count = null;
    }
    const seoPatch = photosDeduped.length ? { og_image: photosDeduped[0] } : {};
    const prevSettingsFull = pageRows[0]?.settings || {};
    const rawContent = typeof pageRows[0]?.content === 'string' ? pageRows[0].content : '';
    const composeListing = prevSettingsFull.compose_mode === 'listing' || settingsPatch.compose_mode === 'listing';
    const contentPatch = contentMediaStore.syncListingContentHtml(
      rawContent,
      photosDeduped,
      null,
      composeListing,
    );
    await db.getQuery()(
      `UPDATE admin_pages_simple
       SET settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb,
         seo = COALESCE(seo, '{}'::jsonb) || $3::jsonb,
         content = $4,
         updated_at = NOW()
       WHERE id = $1`,
      [Number(id), JSON.stringify(settingsPatch), JSON.stringify(seoPatch), contentPatch],
    );
    console.log(JSON.stringify({
      id: Number(id),
      title: manifest.title,
      ok: true,
      photos: photosDeduped.length,
      draft,
      skippedUrl,
      skippedVision,
      dedupeRemoved,
      plan: 'b',
    }));
  }
  console.log(JSON.stringify({ finished: true }));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
