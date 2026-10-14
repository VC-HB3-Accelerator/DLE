'use strict';

/**
 * Нормализация фото объявления под ленту: 4:3, JPEG, ограничение размера файла.
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
function resolveSharpModule() {
  if (process.env.SHARP_PKG) return process.env.SHARP_PKG;
  const candidates = [
    path.join(__dirname, '../node_modules/sharp'),
    path.join(__dirname, '../../node_modules/sharp'),
  ];
  for (const p of candidates) {
    try {
      require.resolve(p);
      return p;
    } catch {
      /* try next */
    }
  }
  return 'sharp';
}
const sharp = require(resolveSharpModule());

const FEED_W = Math.max(640, Number(process.env.LISTING_FEED_WIDTH || 1600));
const FEED_H = Math.max(480, Number(process.env.LISTING_FEED_HEIGHT || 1200));
const JPEG_Q = Math.min(95, Math.max(60, Number(process.env.LISTING_JPEG_QUALITY || 85)));
const MAX_BYTES = Math.max(120_000, Number(process.env.LISTING_FEED_MAX_BYTES || 750_000));

async function encodeCoverJpeg(input) {
  let quality = JPEG_Q;
  let last = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    last = await sharp(input)
      .rotate()
      .resize(FEED_W, FEED_H, { fit: 'cover', position: 'centre' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    if (last.data.length <= MAX_BYTES || quality <= 62) break;
    quality -= 5;
  }
  return last;
}

async function normalizeListingBuffer(buf) {
  const out = await encodeCoverJpeg(buf);
  return {
    buf: out.data,
    ext: 'jpg',
    w: out.info.width,
    h: out.info.height,
    bytes: out.data.length,
  };
}

async function normalizeListingFile(inPath, outPath) {
  const out = await encodeCoverJpeg(inPath);
  await fsp.writeFile(outPath, out.data);
  return {
    ext: 'jpg',
    w: out.info.width,
    h: out.info.height,
    bytes: out.data.length,
  };
}

module.exports = {
  normalizeListingBuffer,
  normalizeListingFile,
  FEED_W,
  FEED_H,
};
