'use strict';

/**
 * Perceptual uniqueness for pool photos (average-hash via sharp).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let sharp;
try {
  sharp = require('sharp');
} catch {
  sharp = null;
}

async function hashFile(filePath) {
  if (sharp) {
    const { data, info } = await sharp(filePath)
      .greyscale()
      .resize(16, 16, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    const avg = sum / data.length;
    let ahash = '';
    for (let i = 0; i < data.length; i++) ahash += data[i] >= avg ? '1' : '0';
    return { path: filePath, ahash, size: [info.width, info.height] };
  }
  const buf = fs.readFileSync(filePath);
  if (buf.length < 50000) throw new Error('too_small_file');
  return {
    path: filePath,
    ahash: crypto.createHash('sha256').update(buf).digest('hex'),
    size: [800, 600],
  };
}

function hamming(a, b) {
  if (!a || !b) return 999;
  if (a.length !== b.length) return 999;
  if (a.length === 64 && /^[0-9a-f]+$/i.test(a)) return a === b ? 0 : 999;
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n += 1;
  return n;
}

async function dedupeByAhash(items, { maxDistance = 12, deleteRejected = false } = {}) {
  const scored = [];
  for (const it of items) {
    try {
      const h = await hashFile(it.path);
      const [w, ht] = h.size || [0, 0];
      if (w < 8 || ht < 8) {
        scored.push({ ...it, reject: 'too_small_dims', w, h: ht });
        continue;
      }
      scored.push({ ...it, ahash: h.ahash, w, h: ht });
    } catch (e) {
      scored.push({
        ...it,
        ahash: `fallback:${path.basename(it.path)}:${it.bytes || 0}`,
        w: 800,
        h: 600,
      });
    }
  }

  const candidates = scored
    .filter((s) => !s.reject)
    .sort((a, b) => (b.bytes || 0) - (a.bytes || 0));

  const unique = [];
  const rejected = scored.filter((s) => s.reject).map((s) => ({
    path: s.path,
    file: path.basename(s.path),
    reason: s.reject,
  }));

  for (const c of candidates) {
    let dupOf = null;
    for (const u of unique) {
      const d = hamming(c.ahash, u.ahash);
      if (d <= maxDistance) {
        dupOf = { file: path.basename(u.path), distance: d };
        break;
      }
    }
    if (dupOf) {
      rejected.push({
        path: c.path,
        file: path.basename(c.path),
        reason: 'near_duplicate',
        dup_of: dupOf.file,
        distance: dupOf.distance,
      });
      if (deleteRejected) {
        try {
          fs.unlinkSync(c.path);
        } catch {
          /* ignore */
        }
      }
      continue;
    }
    unique.push(c);
  }

  return { unique, rejected };
}

module.exports = { hashFile, hamming, dedupeByAhash };
