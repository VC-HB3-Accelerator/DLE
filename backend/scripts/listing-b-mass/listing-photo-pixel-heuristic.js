'use strict';

/**
 * Быстрый pixel-gate без LLM (sharp). stdin JSON { b64 } или { path } → { pass, reasons[] }
 * LISTING_PIXEL_GATE=0 — отключить (вызывающий код).
 */
const fs = require('fs');
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
      /* next */
    }
  }
  return 'sharp';
}

const sharp = require(resolveSharpModule());

function readStdin() {
  return new Promise((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { buf += c; });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(buf || '{}')); } catch (e) { reject(e); }
    });
    process.stdin.on('error', reject);
  });
}

/** YCbCr skin-like (грубо, для отсечения портретов/пресс-конференций). */
function isSkinLike(r, g, b) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return y > 40 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
}

async function analyzeBuffer(buf) {
  const reasons = [];
  const meta = await sharp(buf).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (w < 320 || h < 240) {
    reasons.push('too_small');
  }

  const sample = await sharp(buf)
    .rotate()
    .resize(96, 72, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = sample.data;
  const channels = sample.info.channels || 3;
  const total = sample.info.width * sample.info.height;
  let skin = 0;
  let satSum = 0;
  let grayish = 0;
  let highSat = 0;
  let extremeBw = 0;
  const colorBins = new Set();

  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    satSum += sat;
    if (sat < 0.12 && max > 30 && max < 230) grayish += 1;
    if (sat > 0.65 && max > 80) highSat += 1;
    if (max < 42 || max > 215) extremeBw += 1;
    if (isSkinLike(r, g, b)) skin += 1;
    colorBins.add(`${(r >> 4)},${(g >> 4)},${(b >> 4)}`);
  }

  const skinRatio = skin / total;
  const grayRatio = grayish / total;
  const highSatRatio = highSat / total;
  const meanSat = satSum / total;
  const colorSpread = colorBins.size / total;
  const extremeBwRatio = extremeBw / total;

  if (skinRatio > 0.14) reasons.push('skin_heavy');
  if (grayRatio > 0.72 && meanSat < 0.18) reasons.push('vintage_bw');
  if (highSatRatio > 0.22 && colorSpread < 0.35) reasons.push('infographic_like');
  if (colorSpread < 0.12 && meanSat > 0.35) reasons.push('flat_cartoon_like');
  /** Ч/б камуфляж / spy shot (решётка на кузове), не архивное фото. */
  if (
    extremeBwRatio > 0.09
    && meanSat < 0.12
    && highSatRatio < 0.02
    && colorSpread < 0.04
    && grayRatio > 0.55
    && grayRatio < 0.76
    && skinRatio < 0.03
  ) {
    reasons.push('camo_spy_like');
  }

  const pass = reasons.length === 0;
  return { pass, reasons, skinRatio, grayRatio, highSatRatio, colorSpread, extremeBwRatio };
}

async function main() {
  const input = await readStdin();
  let buf;
  if (input.path) {
    buf = fs.readFileSync(input.path);
  } else if (input.b64) {
    buf = Buffer.from(input.b64, 'base64');
  } else {
    process.stdout.write(JSON.stringify({ pass: true, skipped: true }));
    return;
  }
  const out = await analyzeBuffer(buf);
  process.stdout.write(JSON.stringify(out));
}

if (require.main === module) {
  main().catch((e) => {
    process.stdout.write(JSON.stringify({ pass: true, soft: true, error: String(e.message) }));
  });
}

module.exports = { analyzeBuffer };
