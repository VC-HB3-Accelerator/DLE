/**
 * Премиум-карточки: поиск фото-примера, затем 3 кадра в зале автосалона.
 * Идемпотентно: пропускает карточки, у которых уже 3 фото.
 *
 * node scripts/seed-premium-showroom-photos.js /tmp/sku-catalog-2026.csv
 * PREMIUM_PHOTO_LIMIT=1 — только первые N ещё без фото
 */
'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const db = require('../db');
const settingsSvc = require('../services/aiProviderSettingsService');
const contentMediaStore = require('../services/contentMediaStore');
const { generateImage } = require('../services/mediaAgentService');
const { resolveRole } = require('../services/orchModelRouter');

const MODEL = process.env.QWEN_IMAGE_MODEL || 'qwen-image-3.0-pro';
const LIMIT = Number(process.env.PREMIUM_PHOTO_LIMIT || 0);
const REDO = process.env.PREMIUM_PHOTO_REDO === '1';
const BRANDS = String(process.env.PREMIUM_BRANDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const TITLES = String(process.env.PREMIUM_TITLES || '')
  .split('|')
  .map((s) => s.trim())
  .filter(Boolean);
const STATE_DIR = path.join(__dirname, '..', 'uploads', 'premium-showroom');

const ANGLES = [
  {
    id: 'front',
    camera: 'front view, shallow diagonal only (yaw at most 15 degrees from straight-on), eye-level, full vehicle in frame, 35-50mm, level horizon',
  },
  {
    id: 'side',
    camera: 'true side profile, eye-level, full vehicle in frame, 35-50mm, level horizon',
  },
  {
    id: 'cabin',
    camera: 'driver cabin interior: dashboard, steering wheel and front seats visible, viewpoint from the open door, pitch at most 15 degrees',
  },
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
    } else if (ch !== '\r') field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => cell !== '')) rows.push(row);
  }
  const header = rows.shift() || [];
  return rows.map((cells) => {
    const item = {};
    header.forEach((key, idx) => {
      item[key] = cells[idx] || '';
    });
    return item;
  });
}

function promptFor(item, angle) {
  const place = angle.id === 'cabin'
    ? 'Through the glass: the same luxury showroom, blurred, no buildings outside. Steering wheel and dashboard keep the manufacturer emblem from the reference.'
    : 'BACKGROUND: luxury car dealership showroom. Pale polished floor with a soft reflection, warm-white ceiling light, blurred glass wall. No other vehicles, no people, no price tags, no writing on the walls.';
  return [
    `ORIGINAL photorealistic marketplace photo of the road vehicle ${item.brand} ${item.model}. It is a passenger car, van or SUV. Never an aircraft, helicopter or boat.`,
    'Use the reference for identity: body, proportions, color, headlights, grille and the real manufacturer emblem. Do not copy the reference background.',
    `CAMERA: ${angle.camera}.`,
    'LIGHTING: soft indoor showroom light, overhead softboxes and a gentle side light. No harsh noon sun, no outdoor sky.',
    place,
    'Keep the real badge and grille emblem exactly as in the reference. Do not erase them. Do not replace the grille with a blank panel. Do not invent new words or fake lettering. License plate area stays empty. No kiosk, no people, no other cars.',
  ].join(' ');
}

async function searchBing(query, limit) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const hits = [];
  const re = /murl&quot;:&quot;([^&"]+)|"murl"\s*:\s*"([^"]+)"/gi;
  let m;
  while ((m = re.exec(html)) && hits.length < limit) {
    try {
      const found = decodeURIComponent(m[1] || m[2]);
      if (/^https?:\/\//i.test(found) && !/logo|icon|sprite|favicon/i.test(found)) hits.push(found);
    } catch { /* skip */ }
  }
  return hits;
}

async function searchRefs(item) {
  const queries = [
    `${item.brand} ${item.model} exterior front view`,
    `${item.brand} ${item.model} official`,
    `${item.brand} ${item.model}`,
  ];
  const hits = [];
  const seen = new Set();
  for (const query of queries) {
    if (hits.length >= 8) break;
    const batch = await searchBing(query, 8);
    for (const found of batch) {
      if (seen.has(found)) continue;
      seen.add(found);
      hits.push(found);
      if (hits.length >= 8) break;
    }
  }
  return { query: queries[0], hits };
}

async function downloadRefs(urls, album) {
  const refs = [];
  const dir = path.join(album, 'refs');
  await fsp.mkdir(dir, { recursive: true });
  for (const url of urls) {
    if (refs.length >= 8) break;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const type = String(res.headers.get('content-type') || '');
      if (buf.length < 20_000 || buf.length > 1_200_000) continue;
      if (!type.startsWith('image/') && !/\.(jpe?g|png|webp)(\?|$)/i.test(url)) continue;
      const mime = type.includes('png') ? 'image/png' : 'image/jpeg';
      const ext = mime === 'image/png' ? 'png' : 'jpg';
      const file = path.join(dir, `${refs.length + 1}.${ext}`);
      await fsp.writeFile(file, buf);
      refs.push({ file, mime, url });
    } catch { /* next */ }
  }
  return refs;
}

async function chooseRef(refs, item) {
  if (refs.length < 3) {
    throw new Error(`мало примеров для сравнения: ${refs.length}`);
  }
  const route = await resolveRole('critic_vision');
  const content = [];
  for (let i = 0; i < refs.length; i += 1) {
    const buf = await fsp.readFile(refs[i].file);
    content.push({ type: 'text', text: `Фото ${i + 1}` });
    content.push({
      type: 'image_url',
      image_url: { url: `data:${refs[i].mime};base64,${buf.toString('base64')}` },
    });
  }
  content.push({
    type: 'text',
    text: [
      `Сравни эти ${refs.length} фото между собой. Нужен дорожный автомобиль ${item.brand} ${item.model}, вид снаружи.`,
      'Это легковая машина, минивэн или внедорожник. Самолёт, вертолёт и катер запрещены.',
      'Выбери номер фото, которое совпадает с большинством: та же модель, та же форма передка, тот же тип кузова, виден настоящий значок марки.',
      'Не бери отдельный логотип без машины, салон, коллаж, чужую машину и кадр, который спорит с остальными.',
      'Если меньше трёх фото показывают одну и ту же машину, верни index 0.',
      'Только JSON: {"index":1,"agrees":0,"road":true,"reason":""}. index с 1.',
    ].join(' '),
  });
  const root = String(route.baseUrl).replace(/\/+$/, '');
  const res = await fetch(`${root}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${route.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: route.model,
      temperature: 0,
      messages: [{ role: 'user', content }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || data.message || `compare HTTP ${res.status}`);
  }
  const text = data.choices?.[0]?.message?.content || '';
  const match = String(text).match(/\{[\s\S]*\}/);
  const parsed = match ? JSON.parse(match[0]) : null;
  const index = Number(parsed?.index);
  if (!Number.isInteger(index) || index < 1 || index > refs.length || parsed.road === false) {
    throw new Error(`сравнение не выбрало пример: ${text.slice(0, 180)}`);
  }
  return { ref: refs[index - 1], choice: { index, agrees: parsed.agrees, reason: parsed.reason || '' } };
}

async function checkShot(filePath, item, angle) {
  const route = await resolveRole('critic_vision');
  const buf = await fsp.readFile(filePath);
  const root = String(route.baseUrl).replace(/\/+$/, '');
  const res = await fetch(`${root}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${route.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: route.model,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `Кадр ${angle.id}` },
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${buf.toString('base64')}` },
          },
          {
            type: 'text',
            text: [
              `Это должен быть ${item.brand} ${item.model}: дорожный автомобиль, ракурс ${angle.id}, автосалон.`,
              'ok=false, если это самолёт, вертолёт, катер, чужой класс кузова, пустая решётка без значка марки или бессмысленные буквы вместо эмблемы.',
              'Настоящий значок марки должен остаться. Пустой номерной знак допустим.',
              'Только JSON: {"ok":true,"reason":""}.',
            ].join(' '),
          },
        ],
      }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `check HTTP ${res.status}`);
  const text = data.choices?.[0]?.message?.content || '';
  const match = String(text).match(/\{[\s\S]*\}/);
  const parsed = match ? JSON.parse(match[0]) : null;
  if (!parsed || parsed.ok !== true) {
    throw new Error(`кадр не принят: ${parsed?.reason || text.slice(0, 160)}`);
  }
}

async function generateStill({ apiKey, baseUrl, prompt, refPath, dest }) {
  let reference = null;
  if (refPath) {
    const buf = await fsp.readFile(refPath);
    reference = {
      mime: refPath.endsWith('.png') ? 'image/png' : 'image/jpeg',
      base64: buf.toString('base64'),
    };
  }
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
  const tmpPath = path.join(os.tmpdir(), `prem-${Date.now()}-${fileName}`);
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

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) throw new Error('укажите csv');
  const items = parseCsv(await fsp.readFile(csvPath, 'utf8'))
    .filter((row) => row.segment === 'premium' && row.title);
  const qwen = await settingsSvc.getProviderSettings('qwencloud');
  if (!qwen?.api_key || !qwen.base_url) throw new Error('нет ключа Qwen в настройках');
  await fsp.mkdir(STATE_DIR, { recursive: true });

  let done = 0;
  for (const item of items) {
    if (LIMIT && done >= LIMIT) break;
    if (BRANDS.length && !BRANDS.includes(item.brand)) continue;
    if (TITLES.length && !TITLES.includes(item.title)) continue;
    const { rows } = await db.getQuery()(
      `SELECT id, slug, settings FROM admin_pages_simple
       WHERE category = '2026' AND title = $1
       ORDER BY id LIMIT 1`,
      [item.title]
    );
    const page = rows[0];
    if (!page) {
      console.log(JSON.stringify({ title: item.title, skip: 'no page' }));
      continue;
    }
    const settings = page.settings && typeof page.settings === 'object' ? page.settings : {};
    const album = path.join(STATE_DIR, String(page.id));
    await fsp.mkdir(album, { recursive: true });
    const choicePath = path.join(album, 'ref-choice.json');
    const have = settings.listing_media?.photos?.length || 0;
    if (have >= 3 && fs.existsSync(choicePath) && !REDO) {
      console.log(JSON.stringify({ title: item.title, skip: 'compared' }));
      continue;
    }

    const claim = path.join(album, '.claim');
    await fsp.unlink(claim).catch(() => {});
    try {
      await fsp.writeFile(claim, String(process.pid), { flag: 'wx' });
    } catch (error) {
      if (error.code === 'EEXIST') {
        console.log(JSON.stringify({ title: item.title, skip: 'claimed' }));
        continue;
      }
      throw error;
    }
    try {
    const found = await searchRefs(item);
    const query = found.query;
    const refs = await downloadRefs(found.hits, album);
    const picked = await chooseRef(refs, item);
    const refPath = picked.ref.file;
    const photos = [];
    for (const angle of ANGLES) {
      const dest = path.join(album, `${angle.id}.png`);
      let lastError = null;
      for (let attempt = 1; attempt <= 6; attempt += 1) {
        try {
          await generateStill({
            apiKey: qwen.api_key,
            baseUrl: qwen.base_url,
            prompt: promptFor(item, angle),
            refPath,
            dest,
          });
          await checkShot(dest, item, angle);
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          const limited = /rate limit/i.test(error.message || '');
          console.log(JSON.stringify({
            title: item.title,
            angle: angle.id,
            attempt,
            error: error.message,
          }));
          if (limited) await new Promise((resolve) => setTimeout(resolve, 25000));
        }
      }
      if (lastError) throw lastError;
      const url = await ingest(dest, page.id, `${angle.id}.png`);
      photos.push(url);
      console.log(JSON.stringify({
        title: item.title,
        angle: angle.id,
        url,
        refs: refs.length,
        picked: picked.choice.index,
      }));
    }
    await fsp.writeFile(choicePath, JSON.stringify({
      query,
      downloaded: refs.length,
      index: picked.choice.index,
      agrees: picked.choice.agrees,
      reason: picked.choice.reason,
      url: picked.ref.url,
    }, null, 2));
    const nextSettings = {
      ...settings,
      compose_mode: 'listing',
      listing_media: { photos, video: null },
      showroom: true,
    };
    await db.getQuery()(
      `UPDATE admin_pages_simple
       SET settings = $2::jsonb,
           seo = COALESCE(seo, '{}'::jsonb) || jsonb_build_object('og_image', $3::text),
           updated_at = NOW()
       WHERE id = $1`,
      [page.id, JSON.stringify(nextSettings), photos[0]]
    );
    done += 1;
    console.log(JSON.stringify({
      title: item.title,
      ok: true,
      photos: photos.length,
      picked: picked.choice.index,
      of: refs.length,
      reason: picked.choice.reason,
    }));
    } catch (error) {
      await fsp.unlink(claim).catch(() => {});
      console.log(JSON.stringify({ title: item.title, failed: error.message }));
    }
  }
  console.log(JSON.stringify({ finished: done }));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
