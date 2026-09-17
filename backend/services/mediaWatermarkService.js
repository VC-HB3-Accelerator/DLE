/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Водяной знак логотипом сайта (sidebar_notice.og_image_url) на публичных фото объявлений.
 * Оригинал на диске не меняется; кэш: uploads/content/wm/
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const OPACITY = 0.02;
const LOGO_WIDTH_RATIO = 0.2;
const WM_STYLE_VERSION = 'c02'; // менять при смене opacity/позиции — инвалидация кэша

function backendRoot() {
  return path.join(__dirname, '..');
}

function wmRoot() {
  return path.join(backendRoot(), 'uploads', 'content', 'wm');
}

function wantsWatermark(req) {
  const raw = req?.query?.wm;
  if (raw == null || raw === '') return false;
  const v = String(raw).toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function isWatermarkableImage(mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  if (!mime.startsWith('image/')) return false;
  if (mime.includes('svg')) return false;
  if (mime.includes('gif')) return false; // animated gif — не трогаем
  return true;
}

/**
 * Добавляет ?wm=1 к URL медиа (/v/... или /api/uploads/media/.../file).
 */
function withListingWatermark(url) {
  if (!url || typeof url !== 'string') return url;
  const s = String(url).trim();
  if (!s || s.startsWith('data:') || s.startsWith('blob:')) return s;
  if (!/\/v\/[A-Za-z0-9_-]+/.test(s) && !/\/api\/uploads\/media\/\d+\/file/.test(s)) {
    return s;
  }
  if (/[?&]wm=/.test(s)) return s;
  return `${s}${s.includes('?') ? '&' : '?'}wm=1`;
}

async function resolveLogoAbs() {
  const sidebarNoticeService = require('./sidebarNoticeService');
  const notice = await sidebarNoticeService.getNotice();
  if (notice.hideOgImage) return null;

  let rel = String(notice.ogImageUrl || '').trim();
  if (!rel) rel = '/og-default.png';

  if (/^https?:\/\//i.test(rel)) {
    // Внешний URL — не кэшируем локально в v1
    return null;
  }

  const normalized = rel.startsWith('/') ? rel.slice(1) : rel;
  if (normalized.startsWith('uploads/')) {
    const abs = path.resolve(backendRoot(), normalized);
    if (fs.existsSync(abs)) return abs;
  }
  if (rel === '/og-default.png' || normalized === 'og-default.png') {
    const candidates = [
      path.join(backendRoot(), '..', 'frontend', 'public', 'og-default.png'),
      path.join(backendRoot(), 'public', 'og-default.png'),
      path.join(backendRoot(), 'uploads', 'logos', 'default-token.svg'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c) && !c.endsWith('.svg')) return c;
    }
    return null;
  }
  const abs = path.resolve(backendRoot(), normalized);
  return fs.existsSync(abs) ? abs : null;
}

function logoCacheKey(logoAbs) {
  try {
    const st = fs.statSync(logoAbs);
    return crypto
      .createHash('sha1')
      .update(`${logoAbs}:${st.mtimeMs}:${st.size}:${WM_STYLE_VERSION}`)
      .digest('hex')
      .slice(0, 12);
  } catch {
    return 'nologo';
  }
}

async function buildFadedLogo(logoAbs, targetWidth) {
  const sharp = require('sharp');
  const resized = await sharp(logoAbs)
    .resize({ width: Math.max(24, targetWidth), withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  for (let i = 3; i < data.length; i += 4) {
    data[i] = Math.round(data[i] * OPACITY);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

/**
 * Возвращает абсолютный путь к файлу для отдачи (watermarked или оригинал).
 * @returns {Promise<{ abs: string, mimeType: string, fileName: string, fileSize: number }|null>}
 */
async function resolveWatermarkedDiskFile({
  sourceRelPath,
  sourceAbs,
  fileHash,
  mimeType,
  fileName,
}) {
  if (!isWatermarkableImage(mimeType)) return null;

  let abs = sourceAbs;
  if (!abs && sourceRelPath) {
    abs = path.resolve(backendRoot(), String(sourceRelPath).replace(/^\//, ''));
  }
  if (!abs || !fs.existsSync(abs)) return null;

  const logoAbs = await resolveLogoAbs();
  if (!logoAbs) return null;

  const sharp = require('sharp');
  const hash = String(fileHash || crypto.createHash('sha1').update(abs).digest('hex')).replace(/[^a-f0-9]/gi, '');
  const key = `${hash || 'x'}_${logoCacheKey(logoAbs)}`;
  const aa = key.slice(0, 2);
  const cacheAbs = path.join(wmRoot(), aa, `${key}.jpg`);

  if (fs.existsSync(cacheAbs)) {
    const st = fs.statSync(cacheAbs);
    return {
      abs: cacheAbs,
      mimeType: 'image/jpeg',
      fileName: String(fileName || 'image').replace(/\.[^.]+$/, '') + '.wm.jpg',
      fileSize: st.size,
    };
  }

  await fsp.mkdir(path.dirname(cacheAbs), { recursive: true });
  const meta = await sharp(abs).metadata();
  const w = meta.width || 800;
  const logoW = Math.round(w * LOGO_WIDTH_RATIO);
  const fadedLogo = await buildFadedLogo(logoAbs, logoW);

  const tmp = `${cacheAbs}.tmp-${process.pid}`;
  await sharp(abs)
    .rotate()
    .composite([{ input: fadedLogo, gravity: 'center', blend: 'over' }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(tmp);
  await fsp.rename(tmp, cacheAbs);

  const st = fs.statSync(cacheAbs);
  return {
    abs: cacheAbs,
    mimeType: 'image/jpeg',
    fileName: String(fileName || 'image').replace(/\.[^.]+$/, '') + '.wm.jpg',
    fileSize: st.size,
  };
}

module.exports = {
  wantsWatermark,
  isWatermarkableImage,
  withListingWatermark,
  resolveLogoAbs,
  resolveWatermarkedDiskFile,
};
