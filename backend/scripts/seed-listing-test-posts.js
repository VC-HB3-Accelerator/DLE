/**
 * Тестовые объявления ленты (listing): title/summary, SEO keywords из фильтров,
 * settings.listing_media, HTML .listing-media, catalog_attrs, published.
 *
 * Фото — JPEG в content_media (/v/…) с ?wm=1 для проверки водяных знаков.
 * (picsum / SVG /uploads/listing-seed водяной знак не получают.)
 *
 * Запуск:
 *   docker compose exec -T backend node scripts/seed-listing-test-posts.js
 *   # на VDS:
 *   docker exec -e SEED_OWNER_USER_ID=149 dapp-backend node scripts/seed-listing-test-posts.js
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const db = require('../db');
const catalogFilters = require('../services/catalogFiltersService');
const contentMediaStore = require('../services/contentMediaStore');

const OWNER_USER_ID = Number(process.env.SEED_OWNER_USER_ID || 48);
const SEED_DIR = path.join(__dirname, '..', 'uploads', 'listing-seed');

const LISTINGS = [
  {
    slug: 'test-listing-shacman-kalach',
    title: 'Shacman X3000 самосвал 6×6',
    summary: 'Б/у, под заказ. Пробег умеренный, рама целая, готово к работе.',
    section: 'special',
    attrs: [
      { key: 'Тип', value: 'Самосвалы 6х6' },
      { key: 'Состояние', value: 'Б/у' },
      { key: 'Страна', value: 'Россия' },
      { key: 'Регион', value: 'Волгоградская область' },
      { key: 'Город', value: 'Калач-на-Дону' },
    ],
    photoLabels: ['Shacman · ракурс 1', 'Shacman · ракурс 2', 'Shacman · ракурс 3'],
  },
  {
    slug: 'test-listing-toyota-land-cruiser',
    title: 'Toyota Land Cruiser 200',
    summary: 'Внедорожник в отличном состоянии, полный привод, один владелец.',
    section: 'auto',
    attrs: [
      { key: 'Тип', value: 'Внедорожник' },
      { key: 'Состояние', value: 'С наработкой' },
      { key: 'Страна', value: 'Россия' },
      { key: 'Регион', value: 'Москва' },
      { key: 'Город', value: 'Москва' },
    ],
    photoLabels: ['LC200 · спереди', 'LC200 · салон'],
  },
  {
    slug: 'test-listing-sedan-new-msk',
    title: 'Новый седан бизнес-класса',
    summary: 'Под заказ из салона. Комплектация Comfort, гарантия завода.',
    section: 'auto',
    attrs: [
      { key: 'Тип', value: 'Седан' },
      { key: 'Состояние', value: 'Новое' },
      { key: 'Страна', value: 'Россия' },
      { key: 'Регион', value: 'Москва' },
      { key: 'Город', value: 'Москва' },
    ],
    photoLabels: ['Седан · 1', 'Седан · 2', 'Седан · 3'],
  },
  {
    slug: 'test-listing-crane-ekb',
    title: 'Автокран 25 т',
    summary: 'С наработкой, документы в порядке, осмотр в Екатеринбурге.',
    section: 'special',
    attrs: [
      { key: 'Тип', value: 'Автокраны' },
      { key: 'Состояние', value: 'С наработкой' },
      { key: 'Страна', value: 'Россия' },
      { key: 'Регион', value: 'Свердловская область' },
      { key: 'Город', value: 'Екатеринбург' },
    ],
    photoLabels: ['Кран · 1', 'Кран · 2'],
  },
  {
    slug: 'test-listing-cnc-equipment',
    title: 'Станок ЧПУ фрезерный',
    summary: 'Промышленное оборудование, наработка небольшая, пусконаладка возможна.',
    section: 'equipment',
    attrs: [
      { key: 'Состояние', value: 'С наработкой' },
      { key: 'Страна', value: 'Россия' },
      { key: 'Регион', value: 'Московская область' },
      { key: 'Город', value: 'Подольск' },
    ],
    photoLabels: ['ЧПУ · общий вид'],
  },
  {
    slug: 'test-listing-realty-vidnoe',
    title: 'Склад 1200 м² в Видном',
    summary: 'Отапливаемый склад, высота 8 м, удобный подъезд фур.',
    section: 'realty',
    attrs: [
      { key: 'Состояние', value: 'С наработкой' },
      { key: 'Страна', value: 'Россия' },
      { key: 'Регион', value: 'Московская область' },
      { key: 'Город', value: 'Видное' },
    ],
    photoLabels: ['Склад · фасад', 'Склад · внутри'],
  },
];

const COLORS = ['#2c5f8a', '#3d6b4f', '#8a4b2c', '#5a3d7a', '#1f6f6a', '#6b3d4f', '#4a5c2e'];

function escapeHtmlAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function listingMediaToHtml(photos) {
  const parts = ['<div class="listing-media">'];
  for (const url of photos) {
    parts.push(`<p><img src="${escapeHtmlAttr(url)}" alt=""></p>`);
  }
  parts.push('</div>');
  return parts.join('');
}

/** Чистый градиент без фигур/текста (Docker без шрифтов; фигуры мешали проверке wm). */
function seedPhotoSvg(bg, index, slug) {
  let h = 0;
  const key = `${slug || ''}:${index}`;
  for (let i = 0; i < key.length; i += 1) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  const u = Math.abs(h);
  const ends = ['#1a1a2e', '#0f1f1a', '#1e1520', '#152028', '#201810', '#101820'];
  const end = ends[u % ends.length];
  const x2 = 0.55 + (u % 40) / 100;
  const y2 = 0.7 + ((u >> 2) % 30) / 100;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="${x2}" y2="${y2}">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="${end}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#g)"/>
</svg>`;
}

/**
 * JPEG в content_media → публичный /v/{id} (подходит для ?wm=1).
 */
async function ensureSeedPhotoUrl({ slug, index, bg, pageId }) {
  const sharp = require('sharp');
  if (!fs.existsSync(SEED_DIR)) fs.mkdirSync(SEED_DIR, { recursive: true });
  const fileName = `${slug}-${index + 1}.jpg`;
  const absJpeg = path.join(SEED_DIR, fileName);

  await sharp(Buffer.from(seedPhotoSvg(bg, index, slug)))
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(absJpeg);

  const tmpPath = path.join(os.tmpdir(), `listing-seed-${slug}-${index}-${Date.now()}.jpg`);
  await fsp.copyFile(absJpeg, tmpPath);
  const st = await fsp.stat(tmpPath);

  const { row } = await contentMediaStore.ingestOneShotFromPath({
    tmpPath,
    originalName: fileName,
    mimeType: 'image/jpeg',
    size: st.size,
    authorAddress: null,
    pageId: pageId || null,
    ownerUserId: OWNER_USER_ID,
    purpose: 'listing',
  });

  const url = contentMediaStore.publicFileUrl(row);
  if (!url) throw new Error(`no public url for seeded media ${fileName}`);
  return url;
}

async function photosFor(slug, labels, pageId) {
  const out = [];
  for (let i = 0; i < labels.length; i += 1) {
    let h = 0;
    const key = `${slug}:${i}`;
    for (let c = 0; c < key.length; c += 1) h = ((h << 5) - h + key.charCodeAt(c)) | 0;
    const bg = COLORS[Math.abs(h) % COLORS.length];
    // eslint-disable-next-line no-await-in-loop
    const url = await ensureSeedPhotoUrl({
      slug,
      index: i,
      bg,
      pageId,
    });
    out.push(url);
  }
  return out;
}

function keywordsFrom(sectionLabel, attrs) {
  const parts = [sectionLabel, ...attrs.map((a) => a.value)].filter(Boolean);
  return parts.join(', ');
}

async function resolveAttrValues(section, desired) {
  const storage = section.filter_values || {};
  const out = [];
  for (const row of desired) {
    const opts = Array.isArray(storage[row.key]) ? storage[row.key] : [];
    let value = row.value;
    if (opts.length && !opts.includes(value)) {
      const soft = opts.find((o) => String(o).toLowerCase().includes(String(value).toLowerCase().slice(0, 5)));
      value = soft || opts[0];
      console.warn(`[seed] ${section.slug}: «${row.key}» «${row.value}» → «${value}»`);
    }
    out.push({ key: row.key, value });
  }
  return out;
}

async function upsertListing(item, section) {
  const attrs = await resolveAttrValues(section, item.attrs);

  const existing = await db.getQuery()(
    `SELECT id FROM admin_pages_simple WHERE slug = $1 LIMIT 1`,
    [item.slug]
  );
  let pageId = existing.rows[0]?.id || null;

  // Сначала страница (для pageId), потом медиа с привязкой
  if (!pageId) {
    const { rows } = await db.getQuery()(
      `INSERT INTO admin_pages_simple (
         title, summary, content, status, visibility, show_in_blog,
         is_system_template, category, slug, format, mime_type, storage_type,
         seo, settings, owner_user_id
       ) VALUES (
         $1,$2,'','published','public',TRUE,
         FALSE,'listing-test',$3,'html','text/html','embedded',
         '{}'::jsonb,'{}'::jsonb,$4
       ) RETURNING id`,
      [item.title, item.summary, item.slug, OWNER_USER_ID]
    );
    pageId = rows[0].id;
  }

  const photos = await photosFor(item.slug, item.photoLabels || ['Фото'], pageId);
  const keywords = keywordsFrom(section.label_ru, attrs);
  const content = listingMediaToHtml(photos);
  const settings = {
    autoPublish: false,
    compose_mode: 'listing',
    listing_media: { photos, video: null },
  };
  const seo = {
    title: item.title,
    description: item.summary,
    keywords,
    og_image: photos[0] || null,
  };

  await db.getQuery()(
    `UPDATE admin_pages_simple SET
       title = $2, summary = $3, content = $4, seo = $5::jsonb, settings = $6::jsonb,
       status = 'published', visibility = 'public', show_in_blog = TRUE,
       is_system_template = FALSE, category = 'listing-test',
       format = 'html', mime_type = 'text/html', storage_type = 'embedded',
       owner_user_id = $7, updated_at = NOW()
     WHERE id = $1`,
    [
      pageId,
      item.title,
      item.summary,
      content,
      JSON.stringify(seo),
      JSON.stringify(settings),
      OWNER_USER_ID,
    ]
  );

  await catalogFilters.applyEntityCatalogPayload('page', pageId, {
    catalog_section_id: section.id,
    catalog_attrs: attrs,
  });

  return { pageId, slug: item.slug, title: item.title, photos, keywords, attrs };
}

async function main() {
  console.log('owner_user_id =', OWNER_USER_ID);
  console.log('seed images dir =', SEED_DIR);
  const results = [];
  for (const item of LISTINGS) {
    const section = await catalogFilters.getSectionByIdOrSlug(item.section);
    if (!section) throw new Error(`Нет раздела: ${item.section}`);
    const row = await upsertListing(item, section);
    results.push(row);
    console.log('ok', row.slug, `#${row.pageId}`, row.photos[0]);
  }

  const { rows } = await db.getQuery()(
    `SELECT count(*)::int AS cnt FROM admin_pages_simple
     WHERE show_in_blog = TRUE AND slug LIKE 'test-listing-%'`
  );
  console.log('test-listing count:', rows[0].cnt);
  console.log(JSON.stringify({
    results: results.map((r) => ({
      pageId: r.pageId, slug: r.slug, title: r.title, cover: r.photos[0],
    })),
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
