/**
 * Импорт пилотных объявлений из data/listing-pilot (или uploads/listing-pilot)
 * в ленту как pending + show_in_blog.
 *
 * Локально:
 *   docker compose exec -T -e SEED_OWNER_USER_ID=48 backend \
 *     node scripts/import-listing-pilot.js
 *
 * VDS:
 *   # файлы должны быть в /home/docker/dapp/backend/uploads/listing-pilot
 *   docker exec -e SEED_OWNER_USER_ID=149 dapp-backend node scripts/import-listing-pilot.js
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const db = require('../db');
const catalogFilters = require('../services/catalogFiltersService');
const contentMediaStore = require('../services/contentMediaStore');

const OWNER_USER_ID = Number(process.env.SEED_OWNER_USER_ID || 48);
const PILOT_DIR = process.env.PILOT_DIR
  || path.join(__dirname, '..', 'uploads', 'listing-pilot');

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

function mimeFromName(name) {
  const n = String(name || '').toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.jpeg') || n.endsWith('.jpg')) return 'image/jpeg';
  return 'image/png';
}

async function ingestPhoto({ absPath, pageId, fileName }) {
  const tmpPath = path.join(os.tmpdir(), `pilot-${Date.now()}-${fileName}`);
  await fsp.copyFile(absPath, tmpPath);
  const st = await fsp.stat(tmpPath);
  const { row } = await contentMediaStore.ingestOneShotFromPath({
    tmpPath,
    originalName: fileName,
    mimeType: mimeFromName(fileName),
    size: st.size,
    authorAddress: null,
    pageId: pageId || null,
    ownerUserId: OWNER_USER_ID,
    purpose: 'listing',
  });
  const url = contentMediaStore.publicFileUrl(row);
  if (!url) throw new Error(`no public url for ${fileName}`);
  return url;
}

function keywordsFrom(sectionLabel, attrs) {
  return [sectionLabel, ...attrs.map((a) => a.value)].filter(Boolean).join(', ');
}

/**
 * Тип/Состояние — мягко к справочнику раздела.
 * Бренд/Модель — как есть (могут отсутствовать в filter_keys).
 */
async function resolveAttrs(section, desired) {
  const storage = section.filter_values || {};
  const out = [];
  for (const row of desired || []) {
    const key = row.key;
    const opts = Array.isArray(storage[key]) ? storage[key] : [];
    let value = row.value;
    if (key === 'Тип' || key === 'Состояние') {
      if (opts.length && !opts.includes(value)) {
        const soft = opts.find((o) =>
          String(o).toLowerCase().includes(String(value).toLowerCase().slice(0, 4))
        );
        if (soft) {
          console.warn(`[pilot] ${section.slug}: «${key}» «${row.value}» → «${soft}»`);
          value = soft;
        } else if (key === 'Тип' && opts.includes('Внедорожник') && /кроссовер|suv|внедорож/i.test(value)) {
          value = 'Внедорожник';
          console.warn(`[pilot] ${section.slug}: Тип «${row.value}» → «Внедорожник»`);
        } else if (opts[0]) {
          console.warn(`[pilot] ${section.slug}: «${key}» «${row.value}» нет в справочнике, оставляю как есть`);
        }
      }
    }
    out.push({ key, value });
  }
  return out;
}

async function loadCardDirs() {
  const indexPath = path.join(PILOT_DIR, 'index.json');
  if (fs.existsSync(indexPath)) {
    const index = JSON.parse(await fsp.readFile(indexPath, 'utf8'));
    return (index.cards || []).map((c) => c.dir || c.id).filter(Boolean);
  }
  const entries = await fsp.readdir(PILOT_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() && e.name !== '_report').map((e) => e.name);
}

async function upsertPilotCard(dirName, section) {
  const dir = path.join(PILOT_DIR, dirName);
  const draftPath = path.join(dir, 'draft.json');
  if (!fs.existsSync(draftPath)) throw new Error(`нет draft.json в ${dir}`);
  const draft = JSON.parse(await fsp.readFile(draftPath, 'utf8'));

  const slug = `pilot-${String(draft.pilot_id || dirName).replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}`;
  const title = draft.title || `${draft.filters?.attrs?.find((a) => a.key === 'Бренд')?.value || ''} ${draft.filters?.attrs?.find((a) => a.key === 'Модель')?.value || ''}`.trim();
  const summary = draft.summary || '';
  const desiredAttrs = Array.isArray(draft.filters?.attrs) ? draft.filters.attrs : [];
  const attrs = await resolveAttrs(section, desiredAttrs);

  const photoMeta = Array.isArray(draft.photos) ? draft.photos : [];
  const photoFiles = [];
  for (const p of photoMeta) {
    const file = p.file;
    if (!file) continue;
    const abs = path.join(dir, file);
    if (!fs.existsSync(abs)) throw new Error(`нет фото ${abs}`);
    photoFiles.push({ abs, file });
  }
  if (!photoFiles.length) throw new Error(`нет фото в ${dir}`);

  const existing = await db.getQuery()(
    `SELECT id FROM admin_pages_simple WHERE slug = $1 LIMIT 1`,
    [slug]
  );
  let pageId = existing.rows[0]?.id || null;

  if (!pageId) {
    const { rows } = await db.getQuery()(
      `INSERT INTO admin_pages_simple (
         title, summary, content, status, visibility, show_in_blog,
         is_system_template, category, slug, format, mime_type, storage_type,
         seo, settings, owner_user_id
       ) VALUES (
         $1,$2,'','pending','public',TRUE,
         FALSE,'listing-pilot',$3,'html','text/html','embedded',
         '{}'::jsonb,'{}'::jsonb,$4
       ) RETURNING id`,
      [title, summary, slug, OWNER_USER_ID]
    );
    pageId = rows[0].id;
  }

  const photos = [];
  for (const pf of photoFiles) {
    // eslint-disable-next-line no-await-in-loop
    photos.push(await ingestPhoto({ absPath: pf.abs, pageId, fileName: pf.file }));
  }

  const keywords = keywordsFrom(section.label_ru || 'Авто', attrs);
  const content = listingMediaToHtml(photos);
  const settings = {
    autoPublish: false,
    compose_mode: 'listing',
    listing_media: { photos, video: null },
    pilot_id: draft.pilot_id || dirName,
    pilot_source: 'listing-pilot',
  };
  const seo = {
    title,
    description: summary,
    keywords,
    og_image: photos[0] || null,
  };

  await db.getQuery()(
    `UPDATE admin_pages_simple SET
       title = $2, summary = $3, content = $4, seo = $5::jsonb, settings = $6::jsonb,
       status = 'pending', visibility = 'public', show_in_blog = TRUE,
       is_system_template = FALSE, category = 'listing-pilot',
       format = 'html', mime_type = 'text/html', storage_type = 'embedded',
       owner_user_id = $7, updated_at = NOW()
     WHERE id = $1`,
    [
      pageId,
      title,
      summary,
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

  return { pageId, slug, title, photos: photos.length, attrs };
}

async function main() {
  console.log('owner_user_id =', OWNER_USER_ID);
  console.log('pilot_dir =', PILOT_DIR);
  if (!fs.existsSync(PILOT_DIR)) {
    throw new Error(`PILOT_DIR не найден: ${PILOT_DIR}`);
  }

  const section = await catalogFilters.getSectionByIdOrSlug('auto');
  if (!section) throw new Error('Нет раздела catalog: auto');

  const dirs = await loadCardDirs();
  if (!dirs.length) throw new Error('Нет карточек в pilot dir');

  const results = [];
  for (const dir of dirs) {
    const row = await upsertPilotCard(dir, section);
    results.push(row);
    console.log('ok', row.slug, `#${row.pageId}`, `photos=${row.photos}`);
  }

  const { rows } = await db.getQuery()(
    `SELECT count(*)::int AS cnt FROM admin_pages_simple
     WHERE show_in_blog = TRUE AND status = 'pending' AND slug LIKE 'pilot-%'`
  );
  console.log('pending pilot count:', rows[0].cnt);
  console.log(JSON.stringify({ results }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
