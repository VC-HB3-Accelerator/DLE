'use strict';

/**
 * Listing photo pool for Media Agent UI:
 * internet search → unique no-watermark pool → drop+refill until target (8).
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { searchInternetImages, buildSearchQuery } = require('./listingPool/imageSearch');
const { rejectWatermarkUrl } = require('./listingPool/watermarkFilter');
const { dedupeByAhash } = require('./listingPool/imageDedupe');
const {
  POOL_ANGLE_SLOTS,
  slotFileName,
  angleForFile,
} = require('./listingPool/poolAngles');
const logger = (() => {
  try {
    return require('../utils/logger');
  } catch {
    return { error: (...a) => console.error(...a), warn: (...a) => console.warn(...a) };
  }
})();

const ROOT = path.join(__dirname, '../uploads/media-agent/listing-pools');
const TARGET_DEFAULT = 8;
const JOBS = new Map();
const JOB_TTL_MS = 24 * 60 * 60 * 1000;
const POOL_LOCKS = new Map();

async function withPoolLock(jobId, fn) {
  const id = String(jobId || '');
  const prev = POOL_LOCKS.get(id) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  POOL_LOCKS.set(
    id,
    prev.then(() => next).catch(() => next)
  );
  await prev.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (POOL_LOCKS.get(id) === next) POOL_LOCKS.delete(id);
  }
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function purgeOld() {
  const now = Date.now();
  for (const [id, job] of JOBS.entries()) {
    if (now - (job.createdAt || 0) > JOB_TTL_MS) JOBS.delete(id);
  }
}

function jobDir(id) {
  return path.join(ROOT, id);
}

function poolDir(id) {
  return path.join(jobDir(id), '_pool');
}

function publicPhoto(jobId, file, bust) {
  const base = `/api/media-agent/listing-pool/${encodeURIComponent(jobId)}/files/${encodeURIComponent(file)}`;
  return {
    file,
    url: bust ? `${base}?v=${encodeURIComponent(bust)}` : base,
  };
}

function publicJob(job) {
  if (!job) return null;
  const bust = String(job.updatedAt || Date.now());
  const photos = (job.photos || []).map((p) => ({
    ...publicPhoto(job.id, p.file, `${bust}-${p.bytes || 0}`),
    bytes: p.bytes,
    source_url: p.source_url || null,
    angle: p.angle || angleForFile(p.file),
  }));
  return {
    id: job.id,
    status: job.status,
    brand: job.brand,
    model: job.model,
    target: job.target,
    count: photos.length,
    photos,
    rejected: job.rejected || [],
    engines: job.engines || [],
    error: job.error || null,
    ready: photos.length >= job.target,
    updatedAt: job.updatedAt || null,
  };
}

function restoreJobFromManifest(id, man = readManifest(id)) {
  if (!man?.id) return null;
  const job = {
    ...man,
    status: man.photos?.length >= man.target ? 'ready' : 'partial',
    rejected: [],
    blockedUrls: Array.isArray(man.blockedUrls) ? man.blockedUrls.slice() : [],
    createdAt: Date.now(),
    updatedAt: Date.parse(man.updated_at) || Date.now(),
  };
  JOBS.set(id, job);
  return job;
}

function getJob(id) {
  purgeOld();
  const cached = JOBS.get(id);
  if (cached) return cached;
  return restoreJobFromManifest(id);
}

/**
 * Parse "собери 8 фото КАМАЗ 65115" / "пул Zoomlion ZTC251V"
 */
function parseListingPoolRequest(message) {
  const t = String(message || '').trim();
  if (!t) return null;
  const trigger =
    /(?:собери|набери|сделай|нужен|нужно)\s+(?:пул\s+)?(?:из\s+)?(?:\d+\s+)?фото/i.test(t) ||
    /(?:^|\s)пул\s+/i.test(t) ||
    /listing\s*pool|photo\s*pool|8\s*фото/i.test(t) ||
    /фото\s+для\s+объявлен/i.test(t) ||
    /пакет\s+фото|listing\s*batch/i.test(t);

  let rest = t;
  if (trigger) {
    rest = t
      .replace(/^(?:собери|набери|сделай|нужен|нужно)\s+/i, '')
      .replace(/^(?:пул\s+)?(?:из\s+)?(?:\d+\s+)?фото\s*(?:для\s*(?:объявления\s*)?)?/i, '')
      .replace(/^пул\s+/i, '')
      .replace(/^listing\s*pool\s+/i, '')
      .replace(/^пакет\s+фото\s+/i, '')
      .trim();
  } else {
    // bare "КАМАЗ 65115" / "тойота прада" / "bmw m5 2026"
    const bare = t.match(/^([A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё0-9.\-]*)\s+(\S.*)$/u);
    if (
      !bare ||
      (!/\d/.test(bare[2]) &&
        !/prado|прадо|прада|land\s*cruiser|ленд|voyah/i.test(bare[2]))
    ) {
      return null;
    }
    rest = t;
  }
  rest = rest.replace(/^["«]+|["»]+$/g, '').trim();
  if (!rest) return null;

  const targetMatch = t.match(/\b(\d+)\s*фото/i);
  const target = Math.min(16, Math.max(4, Number(targetMatch?.[1]) || TARGET_DEFAULT));

  const parts = rest.split(/\s+/);
  if (parts.length < 2) {
    return { brand: parts[0], model: parts[0], target, queryText: rest };
  }
  const brand = parts[0];
  const model = parts.slice(1).join(' ');
  return { brand, model, target, queryText: rest };
}

async function downloadToFile(url, dest) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 35000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          Referer: 'https://www.bing.com/',
        },
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 50000 || buf.length > 8 * 1024 * 1024) {
        throw new Error(`bad_size ${buf.length}`);
      }
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.writeFile(dest, buf);
      return { bytes: buf.length };
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr || new Error('download failed');
}

function listPoolFiles(id) {
  const dir = poolDir(id);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !f.startsWith('__'))
    .sort();
}

function readManifest(id) {
  const p = path.join(jobDir(id), 'manifest.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeManifest(job) {
  const dir = jobDir(job.id);
  fs.mkdirSync(dir, { recursive: true });
  const photos = listPoolFiles(job.id).map((file) => {
    const prev = (job.photos || []).find((x) => x.file === file);
    const st = fs.statSync(path.join(poolDir(job.id), file));
    return {
      file,
      bytes: st.size,
      source_url: prev?.source_url || null,
      engine: prev?.engine || null,
      angle: prev?.angle || angleForFile(file),
    };
  });
  job.photos = photos;
  if (!Array.isArray(job.blockedUrls)) job.blockedUrls = [];
  job.blockedUrls = job.blockedUrls.slice(-200);
  const man = {
    id: job.id,
    brand: job.brand,
    model: job.model,
    target: job.target,
    photos,
    engines: job.engines || [],
    blockedUrls: job.blockedUrls,
    queryExtras: job.queryExtras || '',
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(man, null, 2));
  fs.writeFileSync(
    path.join(dir, 'keep.json'),
    JSON.stringify(
      {
        brand: job.brand,
        model: job.model,
        keep: photos.map((p) => p.file),
        target: job.target,
      },
      null,
      2
    )
  );
}

async function tryFillOneSlot(job, { slotIdx, usedUrls, rejected, dir }) {
  const slot = POOL_ANGLE_SLOTS[slotIdx] || POOL_ANGLE_SLOTS[0];
  const name = slotFileName(slotIdx);
  const extras = [
    job.queryExtras || '',
    slot.queryRu,
    slot.queryEn,
    '-shutterstock -depositphotos -getty -alamy -dreamstime -drom',
  ]
    .filter(Boolean)
    .join(' ');
  const query = buildSearchQuery(job.brand, job.model, extras);
  let search;
  try {
    search = await searchInternetImages(query, { limit: 24 });
    job.engines = [...(job.engines || []), ...(search.engines || [])].slice(-12);
  } catch (e) {
    rejected.push({ url: '', reason: `search:${slot.angle}:${String(e.message || e).slice(0, 80)}` });
    return null;
  }

  const existingPaths = (job.photos || [])
    .map((p) => {
      const pth = path.join(dir, p.file);
      if (!fs.existsSync(pth)) return null;
      return { path: pth, bytes: p.bytes, source_url: p.source_url, engine: p.engine, existing: true };
    })
    .filter(Boolean);

  let seq = 0;
  for (const hit of search.hits || []) {
    const url = hit.url;
    if (!url || usedUrls.has(url)) continue;
    usedUrls.add(url);
    const wm = rejectWatermarkUrl(url);
    if (!wm.ok) {
      rejected.push({ url: url.slice(0, 120), reason: wm.reason });
      continue;
    }
    if (/tyagach|тягач/i.test(url) && /65115|самосвал|samosval/i.test(`${job.model}`)) {
      rejected.push({ url: url.slice(0, 120), reason: 'wrong_variant_url' });
      continue;
    }
    seq += 1;
    const dest = path.join(dir, `__new_${slotIdx}_${seq}_${Date.now()}.jpg`);
    try {
      const dl = await downloadToFile(url, dest);
      const candidate = {
        path: dest,
        bytes: dl.bytes,
        source_url: url,
        engine: hit.engine || null,
      };
      const { unique, rejected: dups } = await dedupeByAhash([...existingPaths, candidate], {
        maxDistance: 12,
        deleteRejected: false,
      });
      for (const d of dups) {
        if (d.path === dest) {
          await fsp.unlink(dest).catch(() => {});
          rejected.push({ url: url.slice(0, 120), reason: d.reason || 'near_duplicate' });
        }
      }
      const kept = unique.find((u) => u.path === dest);
      if (!kept) continue;

      const finalPath = path.join(dir, name);
      try {
        await fsp.rename(dest, finalPath);
      } catch {
        await fsp.copyFile(dest, finalPath);
        await fsp.unlink(dest).catch(() => {});
      }
      return {
        file: name,
        bytes: kept.bytes || dl.bytes,
        source_url: url,
        engine: hit.engine || null,
        angle: slot.angle,
      };
    } catch (e) {
      await fsp.unlink(dest).catch(() => {});
      rejected.push({ url: url.slice(0, 120), reason: `dl:${String(e.message || e).slice(0, 60)}` });
    }
    if (seq >= 8) break;
  }
  return null;
}

async function fillPool(job, { need } = {}) {
  if (!Array.isArray(job.blockedUrls)) job.blockedUrls = [];
  const usedUrls = new Set([
    ...job.blockedUrls,
    ...(job.photos || []).map((p) => p.source_url).filter(Boolean),
  ]);
  const rejected = Array.isArray(job.rejected) ? job.rejected.slice() : [];
  const dir = poolDir(job.id);
  await fsp.mkdir(dir, { recursive: true });

  const byFile = new Map();
  for (const p of job.photos || []) {
    if (!p?.file || !fs.existsSync(path.join(dir, p.file))) continue;
    byFile.set(p.file, { ...p, angle: p.angle || angleForFile(p.file) });
  }

  const freeIdx = [];
  const target = Math.min(job.target || TARGET_DEFAULT, POOL_ANGLE_SLOTS.length);
  for (let i = 0; i < target; i++) {
    const name = slotFileName(i);
    if (!byFile.has(name) && !fs.existsSync(path.join(dir, name))) freeIdx.push(i);
  }
  const todo = need != null ? freeIdx.slice(0, Math.max(0, Number(need))) : freeIdx;

  try {
    // Fill free angle-slots sequentially (stable queries; avoids __new_ races)
    for (const slotIdx of todo) {
      const filled = await tryFillOneSlot(job, { slotIdx, usedUrls, rejected, dir });
      if (filled) byFile.set(filled.file, filled);
    }

    const nextPhotos = [];
    for (let i = 0; i < target; i++) {
      const name = slotFileName(i);
      const meta = byFile.get(name);
      if (meta && fs.existsSync(path.join(dir, name))) {
        nextPhotos.push({
          ...meta,
          angle: meta.angle || POOL_ANGLE_SLOTS[i].angle,
        });
      }
    }
    job.photos = nextPhotos;
    for (const f of listPoolFiles(job.id)) {
      if (!job.photos.some((p) => p.file === f)) {
        await fsp.unlink(path.join(dir, f)).catch(() => {});
      }
    }
    job.rejected = rejected.slice(-80);
    job.updatedAt = Date.now();
    writeManifest(job);
    return { added: job.photos.length, engines: job.engines };
  } finally {
    for (const f of await fsp.readdir(dir).catch(() => [])) {
      if (f.startsWith('__new_')) await fsp.unlink(path.join(dir, f)).catch(() => {});
    }
  }
}

async function startPool({
  brand,
  model,
  target = TARGET_DEFAULT,
  ownerUserId = null,
  queryExtras = '',
}) {
  purgeOld();
  const id = crypto.randomUUID();
  await fsp.mkdir(poolDir(id), { recursive: true });
  const job = {
    id,
    status: 'filling',
    brand: String(brand || '').trim(),
    model: String(model || '').trim(),
    target: Math.min(POOL_ANGLE_SLOTS.length, Math.max(4, Number(target) || TARGET_DEFAULT)),
    photos: [],
    rejected: [],
    blockedUrls: [],
    queryExtras: String(queryExtras || '').trim(),
    ownerUserId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    error: null,
  };
  JOBS.set(id, job);
  return withPoolLock(id, async () => {
    try {
      let guard = 0;
      let stagnant = 0;
      while (job.photos.length < job.target && guard < 3) {
        const before = job.photos.length;
        await fillPool(job, { need: job.target - before });
        guard += 1;
        if (job.photos.length === before) {
          stagnant += 1;
          if (stagnant >= 2) break;
        } else {
          stagnant = 0;
        }
      }
      job.status = job.photos.length >= job.target ? 'ready' : 'partial';
    } catch (e) {
      logger.error('[listing-pool] start failed', e.message);
      job.status = 'error';
      job.error = e.message;
    }
    job.updatedAt = Date.now();
    writeManifest(job);
    return publicJob(job);
  });
}

async function dropAndRefill(jobId, fileName) {
  return dropManyAndRefill(jobId, [fileName]);
}

async function dropManyAndRefill(jobId, fileNames) {
  const list = Array.isArray(fileNames)
    ? fileNames.map((f) => path.basename(String(f || ''))).filter(Boolean)
    : [];
  if (!list.length) {
    const err = new Error('Нет файлов для удаления');
    err.status = 400;
    throw err;
  }

  return withPoolLock(jobId, async () => {
    let job = getJob(jobId);
    if (!job) {
      const man = readManifest(jobId);
      if (!man) {
        const err = new Error('Пул не найден');
        err.status = 404;
        throw err;
      }
      job = {
        ...man,
        status: 'partial',
        rejected: [],
        blockedUrls: Array.isArray(man.blockedUrls) ? man.blockedUrls.slice() : [],
        queryExtras: man.queryExtras || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      JOBS.set(jobId, job);
    }
    const j = getJob(jobId);
    if (!Array.isArray(j.blockedUrls)) j.blockedUrls = [];

    for (const safe of list) {
      if (!safe || safe.includes('..')) continue;
      const dropped = (j.photos || []).find((p) => p.file === safe);
      if (dropped?.source_url) j.blockedUrls.push(dropped.source_url);
      const abs = path.join(poolDir(jobId), safe);
      if (fs.existsSync(abs)) await fsp.unlink(abs);
      j.photos = (j.photos || []).filter((p) => p.file !== safe);
    }
    j.blockedUrls = j.blockedUrls.slice(-200);
    j.status = 'filling';
    j.updatedAt = Date.now();
    writeManifest(j);

    let guard = 0;
    while (j.photos.length < j.target && guard < 3) {
      const before = j.photos.length;
      await fillPool(j, { need: j.target - j.photos.length });
      guard += 1;
      if (j.photos.length === before) break;
    }
    j.status = j.photos.length >= j.target ? 'ready' : 'partial';
    j.updatedAt = Date.now();
    writeManifest(j);
    return publicJob(j);
  });
}

async function createPoolFromImages({
  brand,
  model,
  images = [],
  ownerUserId = null,
  target = TARGET_DEFAULT,
}) {
  purgeOld();
  const id = crypto.randomUUID();
  await fsp.mkdir(poolDir(id), { recursive: true });
  const photos = [];
  for (let i = 0; i < Math.min(images.length, 8); i++) {
    const img = images[i];
    if (!img?.base64) continue;
    const ext = String(img.mime || '').includes('png') ? '.png' : '.jpg';
    const file = slotFileName(i).replace(/\.jpg$/i, ext);
    const buf = Buffer.from(img.base64, 'base64');
    if (buf.length < 32) continue;
    await fsp.writeFile(path.join(poolDir(id), file), buf);
    photos.push({
      file,
      bytes: buf.length,
      source_url: 'upload',
      engine: 'upload',
      angle: POOL_ANGLE_SLOTS[i]?.angle || angleForFile(file),
    });
  }
  const job = {
    id,
    status: photos.length ? 'ready' : 'partial',
    brand: String(brand || '').trim(),
    model: String(model || '').trim(),
    target: Math.min(POOL_ANGLE_SLOTS.length, Math.max(1, Number(target) || TARGET_DEFAULT)),
    photos,
    rejected: [],
    blockedUrls: [],
    queryExtras: '',
    ownerUserId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    error: null,
  };
  JOBS.set(id, job);
  writeManifest(job);
  return publicJob(job);
}

function resolvePoolFile(jobId, fileName) {
  const safe = path.basename(String(fileName || ''));
  const abs = path.join(poolDir(jobId), safe);
  if (!abs.startsWith(poolDir(jobId))) return null;
  if (!fs.existsSync(abs)) return null;
  return abs;
}

module.exports = {
  parseListingPoolRequest,
  startPool,
  createPoolFromImages,
  getJob,
  publicJob,
  dropAndRefill,
  dropManyAndRefill,
  resolvePoolFile,
  restoreJobFromManifest,
  TARGET_DEFAULT,
};
