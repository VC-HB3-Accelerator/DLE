/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * OG-постер для шаринга (LinkedIn / Telegram / прочие): 1200×627 JPEG, 1.91:1.
 * Пишется в frontend dist как /og/{slug}.jpg — статикой nginx, без сессии и helmet.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { loadReadyMetaById, loadReadyMetaByPublicId } = require('../services/contentMediaStore');
const { stripWatermarkQuery } = require('./blogCoverUtils');

const OG_WIDTH = 1200;
const OG_HEIGHT = 627;
const OG_MIME = 'image/jpeg';

function backendRoot() {
  return path.join(__dirname, '..');
}

function mediaAbsFromRow(row) {
  if (!row || row.storage !== 'disk' || !row.file_path) return null;
  const abs = path.resolve(backendRoot(), String(row.file_path).replace(/^\//, ''));
  const mediaRoot = path.resolve(backendRoot(), 'uploads', 'content', 'media');
  if (abs !== mediaRoot && !abs.startsWith(mediaRoot + path.sep)) return null;
  return fs.existsSync(abs) ? abs : null;
}

function publicIdFromMediaUrl(url) {
  const raw = stripWatermarkQuery(url);
  const m = String(raw || '').match(/\/(?:api\/)?v\/([A-Za-z0-9_-]{6,32})(?:\.[A-Za-z0-9]+)?(?:[?#].*)?$/i);
  return m ? m[1] : null;
}

function mediaIdFromUploadUrl(url) {
  const raw = stripWatermarkQuery(url);
  const m = String(raw || '').match(/\/api\/uploads\/media\/(\d+)\/file/i);
  return m ? Number(m[1]) : null;
}

function findOgDefaultPng(distRoot) {
  const candidates = [
    distRoot ? path.join(distRoot, 'og-default.png') : null,
    path.join(backendRoot(), '..', 'frontend', 'dist', 'og-default.png'),
    path.join(backendRoot(), '..', 'frontend', 'public', 'og-default.png'),
    '/app/frontend_dist/og-default.png',
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

async function resolveSourceAbs(sourceUrl, distRoot) {
  const pid = publicIdFromMediaUrl(sourceUrl);
  if (pid) {
    try {
      const row = await loadReadyMetaByPublicId(pid);
      const abs = mediaAbsFromRow(row);
      if (abs) return abs;
    } catch (e) {
      console.warn('[og-share] public_id:', e.message);
    }
  }
  const mid = mediaIdFromUploadUrl(sourceUrl);
  if (mid) {
    try {
      const row = await loadReadyMetaById(mid);
      const abs = mediaAbsFromRow(row);
      if (abs) return abs;
    } catch (e) {
      console.warn('[og-share] media id:', e.message);
    }
  }
  return findOgDefaultPng(distRoot);
}

async function writeOgJpeg(srcAbs, outAbs) {
  await sharp(srcAbs)
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 85, progressive: false, chromaSubsampling: '4:2:0' })
    .toFile(outAbs);
}

function publicOgUrl(baseUrl, fileName) {
  const base = String(baseUrl || '').replace(/\/$/, '');
  return `${base}/og/${encodeURIComponent(fileName)}`;
}

/**
 * Собирает JPEG 1200×627 из фото шаринга (или og-default).
 * @returns {Promise<{url:string,width:number,height:number,type:string}|null>}
 */
async function ensureOgShareJpeg({ sourceUrl, slug, distRoot, baseUrl } = {}) {
  const root = distRoot || path.join(backendRoot(), '..', 'frontend', 'dist');
  const outDir = path.join(root, 'og');
  fs.mkdirSync(outDir, { recursive: true });

  const safeSlug = String(slug || 'page')
    .replace(/[^a-z0-9\-_]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'page';
  const fileName = `${safeSlug}.jpg`;
  const outAbs = path.join(outDir, fileName);

  const srcAbs = await resolveSourceAbs(sourceUrl, root);
  if (!srcAbs) return null;

  try {
    await writeOgJpeg(srcAbs, outAbs);
  } catch (e) {
    console.warn('[og-share] sharp source failed:', e.message);
    const fallback = findOgDefaultPng(root);
    if (!fallback || fallback === srcAbs) return null;
    try {
      await writeOgJpeg(fallback, outAbs);
    } catch (e2) {
      console.warn('[og-share] sharp fallback failed:', e2.message);
      return null;
    }
  }

  if (!fs.existsSync(outAbs)) return null;
  return {
    url: publicOgUrl(baseUrl, fileName),
    width: OG_WIDTH,
    height: OG_HEIGHT,
    type: OG_MIME,
  };
}

async function ensureDefaultOgShareJpeg({ distRoot, baseUrl } = {}) {
  return ensureOgShareJpeg({
    sourceUrl: '',
    slug: 'default',
    distRoot,
    baseUrl,
  });
}

module.exports = {
  OG_WIDTH,
  OG_HEIGHT,
  OG_MIME,
  publicIdFromMediaUrl,
  ensureOgShareJpeg,
  ensureDefaultOgShareJpeg,
};
