'use strict';
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const db = require('../db');
const contentMediaStore = require('../services/contentMediaStore');
const { rejectListingSourceUrl } = require('../services/listingPool/listingPhotoSourcePolicy');
const wmFilter = require('../services/listingPool/watermarkFilter');
const { chatForRole } = require('../services/orchModelRouter');
const { applyLiveProvidersToEnv } = require('../services/orchProviderBridge');

const SKIP_VISION = process.env.SKIP_VISION === '1';
const LIMIT_PIDS = Number(process.env.LIMIT_PIDS || 0);
const OBJFIX = process.env.OBJFIX_ROOT || '/tmp/objfix-b';

function publicIdFromUrl(url) {
  const m = String(url || '').match(/\/v\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

function parseJsonLoose(text) {
  const s = String(text || '').trim();
  const i = s.indexOf('{');
  const j = s.lastIndexOf('}');
  if (i === -1 || j <= i) return null;
  try { return JSON.parse(s.slice(i, j + 1)); } catch { return null; }
}

async function loadManifest(pageId) {
  try {
    return JSON.parse(await fsp.readFile(path.join(OBJFIX, String(pageId), 'manifest.json'), 'utf8'));
  } catch {
    return null;
  }
}

function sourceUrlFor(settings, photoUrl, indexInPhotos, manifest) {
  if (!manifest) return null;
  const map = settings.listing_media_objfix_file_map || {};
  const fileKey = Object.entries(map).find(([, u]) => u === photoUrl)?.[0];
  if (fileKey) {
    const hit = (manifest.picked || []).find((p) => p.file === fileKey);
    if (hit?.url) return hit.url;
  }
  return manifest.picked?.[indexInPhotos]?.url || null;
}

function heuristic(sourceUrl) {
  const flags = [];
  if (!sourceUrl) return { flags, suggestDelete: false, suggestClean: false };
  const src = rejectListingSourceUrl(sourceUrl);
  if (!src.ok) flags.push(`block_source:${src.reason || 'dealer'}`);
  const wm = wmFilter.rejectWatermarkUrl(sourceUrl);
  if (!wm.ok) flags.push(`block_url:${wm.reason}`);
  if (/avito|drom\.|auto\.ru|youla|farpost|pulscen|alfaleasing|car-search-public|get-autoru|media\.au\.ru/i.test(sourceUrl)) {
    flags.push('aggregator_url');
  }
  const suggestDelete = flags.some((f) => f.startsWith('block_') || f === 'aggregator_url');
  const suggestClean = flags.length > 0 && !suggestDelete;
  return { flags, suggestDelete, suggestClean };
}

async function visionClean(absPath) {
  let buf;
  try { buf = fs.readFileSync(absPath); } catch (e) {
    return { skipped: true, error: e.message };
  }
  if (buf.length > 2.8 * 1024 * 1024) return { skipped: true, reason: 'too_large' };
  const mime = absPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const prompt = `Аудит фото техники в галерее. JSON:
{"right_vehicle":true|false,"needs_clean":true|false,"clean_watermark":true|false,"clean_people":true|false,"clean_plate_text":true|false,"clean_dealer_logo_or_salon_text":true|false,"reasons":[]}

needs_clean=true — фото стоит ЧИСТИТЬ (i2i): WM, сток, URL, люди, читаемый номер, логотип/название дилера/салона (GREATS, Autohome, HELI-RUS и т.д.).
right_vehicle=false — не та техника/мусор/военка — чистить не стоит (удалить).
Заводской шильд на машине — не WM.`;

  await applyLiveProvidersToEnv().catch(() => {});
  try {
    const { content } = await chatForRole(
      'critic_vision',
      [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${buf.toString('base64')}` } },
        ],
      }],
      { vision: true, json: true, maxTokens: 700 },
    );
    const p = parseJsonLoose(content) || {};
    return {
      skipped: false,
      right_vehicle: p.right_vehicle !== false,
      needs_clean: Boolean(p.needs_clean),
      clean_watermark: Boolean(p.clean_watermark),
      clean_people: Boolean(p.clean_people),
      clean_plate_text: Boolean(p.clean_plate_text),
      clean_dealer_logo_or_salon_text: Boolean(p.clean_dealer_logo_or_salon_text),
      reasons: p.reasons || [],
    };
  } catch (e) {
    return { skipped: true, vision_error: String(e.message || e).slice(0, 160) };
  }
}

async function main() {
  const { rows: pages } = await db.getQuery()(
    `SELECT id, title, settings FROM admin_pages_simple
     WHERE category = '2026'
       AND COALESCE(jsonb_array_length(settings->'listing_media'->'photos'), 0) > 0
     ORDER BY id`,
  );

  const byPid = new Map();
  const manifestCache = new Map();

  for (const page of pages) {
    if (!manifestCache.has(page.id)) manifestCache.set(page.id, await loadManifest(page.id));
    const settings = page.settings || {};
    const photos = settings.listing_media?.photos || [];
    for (let i = 0; i < photos.length; i += 1) {
      const url = String(photos[i] || '').trim();
      const pid = publicIdFromUrl(url);
      if (!pid) continue;
      if (!byPid.has(pid)) {
        byPid.set(pid, {
          pid,
          pageId: page.id,
          title: page.title,
          url,
          index: i,
          settings,
          pages: new Set([page.id]),
        });
      } else {
        byPid.get(pid).pages.add(page.id);
      }
    }
  }

  let items = [...byPid.values()];
  const totalUnique = items.length;
  if (LIMIT_PIDS > 0) items = items.slice(0, LIMIT_PIDS);

  const summary = {
    totalUniquePublicIds: totalUnique,
    scanned: items.length,
    skipVision: SKIP_VISION,
    heuristic: { withSourceUrl: 0, suggestDelete: 0, suggestCleanUrl: 0, noManifest: 0 },
    vision: {
      needsClean: 0,
      wrongVehicle: 0,
      wm: 0,
      people: 0,
      plates: 0,
      dealer: 0,
      anyFlag: 0,
      skipped: 0,
      errors: 0,
    },
  };

  for (const item of items) {
    const manifest = manifestCache.get(item.pageId);
    const sourceUrl = sourceUrlFor(item.settings, item.url, item.index, manifest);
    if (!sourceUrl) summary.heuristic.noManifest += 1;
    else {
      summary.heuristic.withSourceUrl += 1;
      const h = heuristic(sourceUrl);
      if (h.suggestDelete) summary.heuristic.suggestDelete += 1;
      if (h.suggestClean) summary.heuristic.suggestCleanUrl += 1;
    }

    if (SKIP_VISION) continue;

    const row = await contentMediaStore.loadReadyMetaByPublicId(item.pid);
    if (!row?.file_path) {
      summary.vision.skipped += 1;
      continue;
    }
    const abs = path.resolve('/app', String(row.file_path).replace(/^\/+/, ''));
    const v = await visionClean(abs);
    if (v.skipped) {
      summary.vision.skipped += 1;
      if (v.vision_error) summary.vision.errors += 1;
      continue;
    }
    if (!v.right_vehicle) {
      summary.vision.wrongVehicle += 1;
      continue;
    }
    if (v.needs_clean) {
      summary.vision.needsClean += 1;
      summary.vision.anyFlag += 1;
      if (v.clean_watermark) summary.vision.wm += 1;
      if (v.clean_people) summary.vision.people += 1;
      if (v.clean_plate_text) summary.vision.plates += 1;
      if (v.clean_dealer_logo_or_salon_text) summary.vision.dealer += 1;
    }
  }

  console.log(JSON.stringify({ finished: true, summary }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
