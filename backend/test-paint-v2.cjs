import fs from 'fs';
import sharp from 'sharp';

function rgbToLabel(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx - mn < 18) {
    if (mx > 200) return 'white';
    if (mx < 55) return 'black';
    return 'silver gray';
  }
  if (r >= g && r >= b) return 'red';
  if (g >= r && g >= b) return 'green';
  if (b >= r && b >= g) return mx > 160 ? 'light blue' : 'blue';
  return 'mixed';
}

function medianOf(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

async function sampleImagePixels(filePath) {
  const meta = await sharp(filePath).metadata();
  const w = meta.width || 100;
  const h = meta.height || 100;
  const { data: buf, info: out } = await sharp(filePath)
    .extract({
      left: Math.floor(w * 0.15),
      top: Math.floor(h * 0.12),
      width: Math.max(1, Math.floor(w * 0.7)),
      height: Math.max(1, Math.floor(h * 0.76)),
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
    if (sat < 12 && mx > 210) continue;
    if (sat < 8 && mx < 80) continue;
    samples.push([r, g, b]);
  }
  return samples;
}

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
  const pool =
    chromatic.length >= 80
      ? chromatic
      : lightBody.length >= 40
        ? lightBody
        : samples;
  const scored = pool.map(([r, g, b]) => {
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const sat = mx - mn;
    return { r, g, b, score: sat * 2 + mx * 0.1 };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, Math.max(8, Math.floor(scored.length * 0.12)));
  return [
    medianOf(top.map((p) => p.r)),
    medianOf(top.map((p) => p.g)),
    medianOf(top.map((p) => p.b)),
  ];
}

async function compute(imagePaths) {
  const perImage = [];
  for (const fp of imagePaths) {
    const c = await dominantColorOneImage(fp);
    if (c) perImage.push(c);
  }
  const r = medianOf(perImage.map((p) => p[0]));
  const g = medianOf(perImage.map((p) => p[1]));
  const b = medianOf(perImage.map((p) => p[2]));
  return {
    hex: `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`,
    rgb: [r, g, b],
    label: rgbToLabel(r, g, b),
    samples: perImage.length,
  };
}

for (const id of [1051, 59, 709]) {
  const m = JSON.parse(fs.readFileSync(`/tmp/objfix-b/${id}/manifest.json`, 'utf8'));
  const files = m.picked.slice(0, 8).map((p) => `/tmp/objfix-b/${id}/${p.file}`);
  console.log(JSON.stringify({ id, paint: await compute(files) }));
}
