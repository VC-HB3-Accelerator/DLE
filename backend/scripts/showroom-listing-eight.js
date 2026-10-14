/**
 * Showroom i2i для фото listing_media (1–8) уже залитых на карточку.
 *
 * SHOWROOM_MIN=2 — минимум фото в карточке (как ATTACH_MIN)
 * PAGE_IDS=1051,59,709 SHOWROOM_REDO=1
 * docker exec -w /app dapp-backend node scripts/showroom-listing-eight.js
 */
'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const db = require('../db');
const settingsSvc = require('../services/aiProviderSettingsService');
const contentMediaStore = require('../services/contentMediaStore');
const { generateImage } = require('../services/mediaAgentService');

const MODEL = process.env.QWEN_IMAGE_MODEL || 'qwen-image-3.0-pro';
const PAGE_IDS = String(process.env.PAGE_IDS || '1051,59,709')
  .split(',')
  .map((s) => parseInt(s.trim(), 10))
  .filter((n) => Number.isInteger(n) && n > 0);
const REDO = process.env.SHOWROOM_REDO === '1';
const STATE_DIR = path.join(__dirname, '..', 'uploads', 'showroom-eight');
const CSV_PATH = process.env.SKU_CSV || path.join(__dirname, '..', '..', 'data', 'sku-catalog-2026.csv');
const SOURCE_ROOT = process.env.SOURCE_ROOT || '/tmp/objfix-b';
/** 1 = один targetPaint на 8 кадров этой карточки; 0 = цвет с каждого референса кадра */
const UNIFY_FRAMES = process.env.SHOWROOM_UNIFY_FRAMES !== '0';
const SHOWROOM_MIN = Math.max(1, Number(process.env.SHOWROOM_MIN || process.env.ATTACH_MIN || 2));
const SHOWROOM_MAX = Math.min(8, Math.max(1, Number(process.env.SHOWROOM_MAX || 8)));
/** 1 (default): i2i только с /tmp/objfix-b — не с уже сгенерированного listing_media */
const REQUIRE_OBJFIX = process.env.SHOWROOM_REQUIRE_OBJFIX !== '0';
const SHOWROOM_APPEND = process.env.SHOWROOM_APPEND === '1';
const SHOWROOM_GEN_FRAMES = Math.min(8, Math.max(1, Number(process.env.SHOWROOM_GEN_FRAMES || 3)));

function log(obj) {
  console.log(JSON.stringify(obj));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') {
      row.push(field);
      field = '';
      if (row.some((c) => c)) rows.push(row);
      row = [];
    } else if (ch !== '\r') field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((c) => c)) rows.push(row);
  }
  const header = rows.shift() || [];
  return rows.map((cells) => Object.fromEntries(header.map((h, idx) => [h, cells[idx] || ''])));
}

function catalogByTitle(rows) {
  return new Map(rows.map((r) => [r.title, r]));
}

function paintToPromptLine(paint, pageId, unifyFrames, frameIndex, frameTotal) {
  if (!paint) {
    return 'Keep the exact factory body paint from the reference (doors, hood, cab, fenders). Do not repaint white unless the reference body is white.';
  }
  const rgb = paint.rgb || [128, 128, 128];
  const colorSpec = `sRGB ${paint.hex} (R${rgb[0]} G${rgb[1]} B${rgb[2]})`;
  const chromatic = paint.chromatic === true;
  const keepRef = chromatic
    ? `Preserve the saturated factory color visible on the reference body panels. Target ${colorSpec}. Do NOT bleach to white or silver.`
    : `Match neutral factory paint on body panels: ${colorSpec} (${paint.label}). Do not take color from sky, asphalt, or showroom floor.`;
  const scope = unifyFrames
    ? `Listing card #${pageId} only — same vehicle, all ${frameTotal} frames: ONE body color. ${keepRef} Same hue on every frame. Not other listings.`
    : `Listing card #${pageId}, frame ${frameIndex + 1}: ${keepRef}`;
  return scope;
}


function oemEmblemRules(brand) {
  const b = String(brand || '').trim().toLowerCase();
  if (b.includes('kamaz') || b.includes('камaz') || b.includes('камаз')) {
    return 'Grille emblem MUST be KAMAZ factory horse logo as in reference. FORBIDDEN: Mercedes-Benz three-pointed star or any non-KAMAZ badge swap.';
  }
  return `Grille emblem MUST stay ${brand} OEM badge from reference. FORBIDDEN: Mercedes-Benz star or other manufacturer emblem swaps.`;
}
function chassisIdentityRules(item, segment) {
  if (segment === 'premium') return '';
  const m = `${item.model || ''} ${item.brand || ''}`.toLowerCase();
  if (/65116|sedel|тягач|tractor/.test(m)) {
    return 'Preserve exact chassis from reference: 6×4 sedelny tyagach, twin rear axles, fifth wheel, frame length — never simplify to 4×2.';
  }
  return 'Preserve identical axle count, wheelbase and frame geometry as reference; do not change wheel formula.';
}
function promptFor(item, segment, index, paint, pageId, unifyFrames, frameTotal) {
  const subject = segment === 'premium'
    ? `the road vehicle ${item.brand} ${item.model} (car, crossover or van)`
    : `the commercial vehicle ${item.brand} ${item.model} (truck, tractor or chassis)`;
  const paintLine = paintToPromptLine(paint, pageId, unifyFrames, index, frameTotal);
  return [
    `Edit the reference photo: ${subject}. Photorealistic marketplace shot.`,
    'Keep the same camera angle, framing and vehicle identity as the reference (body shape, proportions, lights, grille).',
    'For heavy trucks: do NOT compress, squash, or miniaturize the vehicle — preserve full-scale cab and wheel proportions from the reference.',
    paintLine,
    'Replace ONLY the background with a luxury vehicle dealership showroom: pale polished floor with soft reflection, warm-white ceiling lights, blurred glass walls. No people, no other vehicles, no outdoor sky.',
    'Do not change model or body shape. No second color on bodywork. Never repaint the whole vehicle white unless the reference body is already white.',
    'Remove ALL dealer advertising from the body: phone numbers, URLs, slogans, vinyl wraps and fleet decals on cab roof, doors and fairings. Body panels must be clean factory paint only.',
    oemEmblemRules(item.brand),
    chassisIdentityRules(item, segment),
    'Do not blank the grille. Do not add new text. Empty license plate area.',
    `Indoor soft showroom lighting. Frame ${index + 1} of ${frameTotal}.`,
  ].join(' ');
}

async function loadSourceRefPaths(pageId, count) {
  const dir = path.join(SOURCE_ROOT, String(pageId));
  const manifestPath = path.join(dir, 'manifest.json');
  const paths = [];
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
    const picked = manifest.picked || [];
    for (const item of picked.slice(0, count)) {
      const fp = path.join(dir, item.file);
      if (fs.existsSync(fp)) paths.push(fp);
    }
  }
  if (paths.length < count) {
    try {
      const numeric = (await fsp.readdir(dir))
        .filter((f) => /^\d+\.(jpe?g|png|webp)$/i.test(f))
        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
      for (const f of numeric) {
        const fp = path.join(dir, f);
        if (paths.includes(fp)) continue;
        if (fs.existsSync(fp)) paths.push(fp);
        if (paths.length >= count) break;
      }
    } catch { /* ignore */ }
  }
    if (paths.length >= Math.min(count, SHOWROOM_APPEND ? 1 : SHOWROOM_MIN)) {
    return paths.slice(0, count);
  }
  try {
    const numeric = (await fsp.readdir(dir))
      .filter((f) => /^\d+\.(jpe?g|png|webp)$/i.test(f))
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
      .slice(0, count)
      .map((f) => path.join(dir, f))
      .filter((fp) => fs.existsSync(fp));
    if (numeric.length >= (SHOWROOM_APPEND ? 1 : SHOWROOM_MIN)) return numeric.slice(0, count);
  } catch { /* ignore */ }
  return paths.length >= (SHOWROOM_APPEND ? 1 : SHOWROOM_MIN) ? paths.slice(0, count) : null;
}

function rgbToLabel(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const sat = mx - mn;
  if (sat < 18) {
    if (mx > 215) return 'light neutral';
    if (mx < 55) return 'black';
    return 'silver gray';
  }
  if (r >= g && r >= b) return 'red';
  if (g >= r && g >= b) return 'green';
  if (b >= r && b >= g) return mx > 160 ? 'light blue' : 'blue';
  return 'mixed';
}

async function sampleImagePixels(filePath) {
  const meta = await sharp(filePath).metadata();
  const w = meta.width || 100;
  const h = meta.height || 100;
  const { data: buf, info: out } = await sharp(filePath)
    .extract({
      left: Math.floor(w * 0.2),
      top: Math.floor(h * 0.28),
      width: Math.max(1, Math.floor(w * 0.6)),
      height: Math.max(1, Math.floor(h * 0.58)),
    })
    .resize(96, 72)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const samples = [];
  const ch = out.channels || 3;
  for (let i = 0; i < buf.length; i += ch) {
    const r = buf[i];
    const g = buf[i + 1];
    const b = buf[i + 2];
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const sat = mx - mn;
    if (mx < 35 || mx > 248) continue;
    if (sat < 10 && mx > 225) continue;
    if (sat < 8 && mx < 80) continue;
    if (sat >= 16 && b >= r + 8 && b >= g + 6 && g >= 95) continue;
    if (sat < 14 && mx >= 70 && mx <= 145) continue;
    samples.push([r, g, b]);
  }
  return samples;
}

function medianOf(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** По каждому кадру — свой домinant (кузов), затем медиана по 8 (не небо/асфальт). */
async function dominantColorOneImage(filePath) {
  const samples = await sampleImagePixels(filePath);
  if (!samples.length) return null;

  const chromatic = [];
  const lightBody = [];
  for (const [r, g, b] of samples) {
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const sat = mx - mn;
    if (sat >= 18) chromatic.push([r, g, b]);
    else if (mx >= 165 && mx <= 245) lightBody.push([r, g, b]);
  }

  const preferLight =
    chromatic.length < 18
    && lightBody.length >= 40
    && lightBody.length >= chromatic.length * 0.55;
  const pool = chromatic.length >= 25
    ? chromatic
    : preferLight
      ? lightBody
      : (chromatic.length >= 12
        ? chromatic
        : (lightBody.length >= 40 ? lightBody : samples));

  const scored = pool.map(([r, g, b]) => {
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const sat = mx - mn;
    const score = preferLight
      ? mx * 2 - sat * 4
      : sat * 2 + mx * 0.1;
    return { r, g, b, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, Math.max(8, Math.floor(scored.length * 0.12)));
  return [
    medianOf(top.map((p) => p.r)),
    medianOf(top.map((p) => p.g)),
    medianOf(top.map((p) => p.b)),
  ];
}

function rgbSat([r, g, b]) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx - mn;
}

function rgbToPaintObj(rgb, meta = {}) {
  const [r, g, b] = rgb;
  const hex = `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  const chromatic = rgbSat([r, g, b]) >= 22;
  return { hex, rgb: [r, g, b], label: rgbToLabel(r, g, b), chromatic, ...meta };
}

/** Цвет кузова только по фото этой карточки (pageId), без общих файлов. */
async function computeDominantPaint(imagePaths, pageId) {
  const perImage = [];
  for (const fp of imagePaths) {
    const c = await dominantColorOneImage(fp);
    if (c) perImage.push(c);
  }
  if (!perImage.length) {
    return rgbToPaintObj([128, 128, 128], { samples: 0, bodyFrames: 0, pageId, chromatic: false });
  }
  const frameStats = perImage.map((rgb) => ({ rgb, sat: rgbSat(rgb) }));
  const chromaticFrames = frameStats.filter((f) => f.sat >= 22);
  let pool;
  if (chromaticFrames.length >= 2) {
    pool = chromaticFrames.map((f) => f.rgb);
  } else if (chromaticFrames.length === 1) {
    pool = [chromaticFrames[0].rgb];
  } else {
    pool = perImage;
  }
  const r = medianOf(pool.map((p) => p[0]));
  const g = medianOf(pool.map((p) => p[1]));
  const b = medianOf(pool.map((p) => p[2]));
  return rgbToPaintObj([r, g, b], {
    samples: perImage.length,
    bodyFrames: chromaticFrames.length,
    pageId,
  });
}

async function computePaintPerFrame(refPaths, pageId) {
  const out = [];
  for (let i = 0; i < refPaths.length; i += 1) {
    const c = await dominantColorOneImage(refPaths[i]);
    out.push(c
      ? rgbToPaintObj(c, { pageId, frame: i + 1 })
      : rgbToPaintObj([128, 128, 128], { pageId, frame: i + 1 }));
  }
  return out;
}

async function localPathFromPublicUrl(photoUrl) {
  const m = String(photoUrl).match(/\/v\/([A-Za-z0-9_-]+)/);
  if (!m) throw new Error(`не public url: ${photoUrl}`);
  const row = await contentMediaStore.loadReadyMetaByPublicId(m[1]);
  if (!row?.file_path || !fs.existsSync(row.file_path)) {
    throw new Error(`нет file_path для ${photoUrl}`);
  }
  return row.file_path;
}

async function generateStill({ apiKey, baseUrl, prompt, refPath, dest }) {
  const buf = await fsp.readFile(refPath);
  const reference = {
    mime: refPath.endsWith('.png') ? 'image/png' : 'image/jpeg',
    base64: buf.toString('base64'),
  };
  const { url } = await generateImage({
    route: {
      model: MODEL,
      apiKey,
      baseUrl,
      adapter: { id: 'multimodal_image' },
    },
    prompt,
    size: '1280*960',
    reference,
  });
  const img = await fetch(url);
  if (!img.ok) throw new Error(`download gen HTTP ${img.status}`);
  await fsp.writeFile(dest, Buffer.from(await img.arrayBuffer()));
}

async function ingest(absPath, pageId, fileName) {
  const tmpPath = path.join(os.tmpdir(), `show8-${Date.now()}-${fileName}`);
  await fsp.copyFile(absPath, tmpPath);
  const st = await fsp.stat(tmpPath);
  const { row } = await contentMediaStore.ingestOneShotFromPath({
    tmpPath,
    originalName: fileName,
    mimeType: 'image/png',
    size: st.size,
    authorAddress: null,
    pageId,
    ownerUserId: null,
    purpose: 'listing',
    forceOneShot: true,
  });
  const url = contentMediaStore.publicFileUrl(row);
  if (!url) throw new Error(`no public url for ${fileName}`);
  return url;
}

async function processPage(page, catalogRow, qwen) {
  const settings = page.settings && typeof page.settings === 'object'
    ? page.settings
    : JSON.parse(page.settings || '{}');
  const photos = settings?.listing_media?.photos;
  const havePhotos = Array.isArray(photos) ? photos : [];
  const keepPhotos = SHOWROOM_APPEND ? [...havePhotos] : [];
  let nFrames = SHOWROOM_APPEND
    ? SHOWROOM_GEN_FRAMES
    : Math.min(havePhotos.length, SHOWROOM_MAX);
  if (SHOWROOM_APPEND) {
    if (!keepPhotos.length) {
      log({ id: page.id, skip: 'append: no existing listing_media photos' });
      return;
    }
  } else if (nFrames < SHOWROOM_MIN) {
    log({
      id: page.id,
      skip: 'below SHOWROOM_MIN',
      have: havePhotos.length,
      min: SHOWROOM_MIN,
    });
    return;
  }
  const prevFrames = Number(settings.showroom_frame_count) || (settings.showroom_eight ? 8 : 0);
  const prevAppend = settings.showroom_append === true;
  if (!SHOWROOM_APPEND && settings.showroom && prevFrames === nFrames && !REDO) {
    log({ id: page.id, title: page.title, skip: 'showroom done', frames: nFrames });
    return;
  }
  if (SHOWROOM_APPEND && settings.showroom && prevAppend && prevFrames === nFrames && !REDO) {
    log({ id: page.id, title: page.title, skip: 'showroom append done', aiFrames: nFrames });
    return;
  }

  const item = {
    brand: catalogRow?.brand || page.title.split('·')[0]?.trim(),
    model: catalogRow?.model || page.title.split('·')[1]?.trim() || '',
  };
  const segment = catalogRow?.segment || 'gruzoviki';
  const album = path.join(STATE_DIR, String(page.id));
  await fsp.mkdir(album, { recursive: true });

  let refPaths = await loadSourceRefPaths(page.id, nFrames);
  if (!refPaths) {
    if (REQUIRE_OBJFIX) {
      log({
        id: page.id,
        skip: 'no objfix source refs',
        hint: 'docker cp /tmp/objfix-b and ensure manifest+picked files',
        frames: nFrames,
      });
      return;
    }
    log({ id: page.id, warn: 'no SOURCE_ROOT, fallback listing_media urls', frames: nFrames });
    refPaths = [];
    for (let i = 0; i < nFrames; i += 1) {
      refPaths.push(await localPathFromPublicUrl(photos[i]));
    }
  }
  const refCount = refPaths.length;
  if (refCount < nFrames) {
    log({ id: page.id, warn: 'objfix refs fewer than listing photos', refs: refCount, listing: nFrames });
    nFrames = refCount;
  }
  const expectedPrefix = path.join(SOURCE_ROOT, String(page.id)) + path.sep;
  for (const fp of refPaths) {
    if (fp.startsWith(SOURCE_ROOT) && !fp.startsWith(expectedPrefix)) {
      throw new Error(`ref path outside card dir: ${fp}`);
    }
  }

  const cardPaint = await computeDominantPaint(refPaths, page.id);
  const framePaints = UNIFY_FRAMES
    ? null
    : await computePaintPerFrame(refPaths, page.id);
  await fsp.writeFile(
    path.join(album, 'target-paint.json'),
    JSON.stringify({ pageId: page.id, unifyFrames: UNIFY_FRAMES, card: cardPaint, frames: framePaints }, null, 2),
  );
  log({ id: page.id, title: page.title, targetPaint: cardPaint, unifyFrames: UNIFY_FRAMES, frames: nFrames });

  const frameConcurrency = Math.min(4, Math.max(1, Number(process.env.SHOWROOM_CONCURRENCY || 2)));
  const outUrls = new Array(nFrames);

  async function renderFrame(i) {
    const refPath = refPaths[i];
    const dest = path.join(album, `frame-${i + 1}.png`);
    let lastError = null;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        await generateStill({
          apiKey: qwen.api_key,
          baseUrl: qwen.base_url,
          prompt: promptFor(
            item,
            segment,
            i,
            UNIFY_FRAMES ? cardPaint : framePaints[i],
            page.id,
            UNIFY_FRAMES,
            nFrames,
          ),
          refPath,
          dest,
        });
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        log({
          id: page.id,
          frame: i + 1,
          attempt,
          error: String(error.message || error).slice(0, 200),
        });
        if (/rate limit/i.test(error.message || '')) {
          await new Promise((r) => setTimeout(r, 25000));
        }
      }
    }
    if (lastError) throw lastError;
    const url = await ingest(dest, page.id, `showroom-${i + 1}.png`);
    outUrls[i] = url;
    log({ id: page.id, frame: i + 1, ok: true, url });
  }

  let nextFrame = 0;
  async function frameWorker() {
    while (true) {
      const i = nextFrame;
      nextFrame += 1;
      if (i >= nFrames) return;
      await renderFrame(i);
    }
  }
  await Promise.all(Array.from({ length: frameConcurrency }, () => frameWorker()));

  const aiUrls = outUrls.filter(Boolean);
  const mergedPhotos = SHOWROOM_APPEND ? [...keepPhotos, ...aiUrls] : aiUrls;
  const draft = mergedPhotos.length < 8 || settings.listing_media_draft === true;
  const ogImage = SHOWROOM_APPEND ? (keepPhotos[0] || mergedPhotos[0]) : mergedPhotos[0];
  const nextSettings = {
    ...settings,
    compose_mode: 'listing',
    listing_media: { photos: mergedPhotos, video: null },
    listing_media_draft: draft,
    showroom: true,
    showroom_append: SHOWROOM_APPEND,
    showroom_eight: mergedPhotos.length >= 8,
    showroom_frame_count: nFrames,
    showroom_ai_photos: aiUrls.length,
    showroom_unified_paint: { pageId: page.id, unifyFrames: UNIFY_FRAMES, card: cardPaint },
    listing_media_test: settings.listing_media_test || 'b',
  };
  if (SHOWROOM_APPEND && !settings.listing_media_before_showroom) {
    nextSettings.listing_media_before_showroom = { photos: keepPhotos };
  }
  await db.getQuery()(
    `UPDATE admin_pages_simple
     SET settings = $2::jsonb,
         seo = COALESCE(seo, '{}'::jsonb) || jsonb_build_object('og_image', $3::text),
         updated_at = NOW()
     WHERE id = $1`,
    [page.id, JSON.stringify(nextSettings), ogImage],
  );
  log({
    id: page.id,
    title: page.title,
    ok: true,
    photos: mergedPhotos.length,
    aiGenerated: aiUrls.length,
    append: SHOWROOM_APPEND,
    draft,
    model: MODEL,
  });
}

async function main() {
  if (!PAGE_IDS.length) throw new Error('PAGE_IDS пуст');
  const qwen = await settingsSvc.getProviderSettings('qwencloud');
  if (!qwen?.api_key || !qwen.base_url) throw new Error('нет ключа Qwen');

  let catalog = new Map();
  try {
    catalog = catalogByTitle(parseCsv(await fsp.readFile(CSV_PATH, 'utf8')));
  } catch (e) {
    log({ warn: 'csv missing', path: CSV_PATH, error: e.message });
  }

  await fsp.mkdir(STATE_DIR, { recursive: true });

  for (const id of PAGE_IDS) {
    try {
      const { rows } = await db.getQuery()(
        `SELECT id, title, settings FROM admin_pages_simple WHERE id = $1`,
        [id],
      );
      const page = rows[0];
      if (!page) {
        log({ id, skip: 'no page' });
        continue;
      }
      await processPage(page, catalog.get(page.title), qwen);
    } catch (error) {
      log({ id, failed: String(error.message || error).slice(0, 240) });
    }
  }
  log({ finished: true });
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
