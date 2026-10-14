/**
 * Импорт пакета оркестратора (фото+видео) в ленту + content_media owner.
 *
 * VDS:
 *   # файлы в /home/docker/dapp/backend/uploads/listing-orch/<slug>/
 *   docker exec -e SEED_OWNER_USER_ID=149 dapp-backend \
 *     node scripts/import-listing-orch.js rostselmash-nova-340
 */
'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const db = require('../db');
const catalogFilters = require('../services/catalogFiltersService');
const contentMediaStore = require('../services/contentMediaStore');

const OWNER_USER_ID = Number(process.env.SEED_OWNER_USER_ID || 149);
const ROOT = process.env.ORCH_LISTING_DIR
  || path.join(__dirname, '..', 'uploads', 'listing-orch');

function escapeHtmlAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function listingMediaToHtml(photos, video) {
  const parts = ['<div class="listing-media">'];
  for (const url of photos) {
    parts.push(`<p><img src="${escapeHtmlAttr(url)}" alt=""></p>`);
  }
  if (video) {
    parts.push(
      `<p><video src="${escapeHtmlAttr(video)}" controls playsinline></video></p>`
    );
  }
  parts.push('</div>');
  return parts.join('');
}

function mimeFromName(name) {
  const n = String(name || '').toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.jpeg') || n.endsWith('.jpg')) return 'image/jpeg';
  if (n.endsWith('.mp4')) return 'video/mp4';
  if (n.endsWith('.webm')) return 'video/webm';
  return 'application/octet-stream';
}

async function ingestFile({ absPath, pageId, fileName }) {
  const tmpPath = path.join(os.tmpdir(), `orch-${Date.now()}-${fileName}`);
  await fsp.copyFile(absPath, tmpPath);
  const st = await fsp.stat(tmpPath);
  const { row, isDuplicate } = await contentMediaStore.ingestOneShotFromPath({
    tmpPath,
    originalName: fileName,
    mimeType: mimeFromName(fileName),
    size: st.size,
    authorAddress: null,
    pageId: pageId || null,
    ownerUserId: OWNER_USER_ID,
    purpose: 'listing',
    forceOneShot: true,
  });
  const url = contentMediaStore.publicFileUrl(row);
  if (!url) throw new Error(`no public url for ${fileName}`);
  return { url, isDuplicate, mediaId: row.id };
}

async function resolveAttrs(section, desired) {
  const storage = section.filter_values || {};
  const out = [];
  for (const row of desired || []) {
    const key = row.key;
    const opts = Array.isArray(storage[key]) ? storage[key] : [];
    let value = row.value;
    if ((key === 'Тип' || key === 'Состояние') && opts.length && !opts.includes(value)) {
      const soft = opts.find((o) =>
        String(o).toLowerCase().includes(String(value).toLowerCase().slice(0, 4))
      );
      if (soft) {
        console.warn(`[orch] ${section.slug}: «${key}» «${row.value}» → «${soft}»`);
        value = soft;
      } else {
        console.warn(`[orch] ${section.slug}: «${key}» «${row.value}» нет в справочнике — как есть`);
      }
    }
    out.push({ key, value });
  }
  return out;
}

async function upsertCard(dirName) {
  const dir = path.join(ROOT, dirName);
  const draftPath = path.join(dir, 'draft.json');
  if (!fs.existsSync(draftPath)) throw new Error(`нет draft.json в ${dir}`);
  const draft = JSON.parse(await fsp.readFile(draftPath, 'utf8'));

  const slug = String(draft.slug || `orch-${dirName}`)
    .replace(/[^a-z0-9-]+/gi, '-')
    .toLowerCase();
  const title = draft.title || dirName;
  const summary = draft.summary || '';
  const status = draft.status === 'pending' ? 'pending' : 'published';
  const sectionSlug = draft.section || 'special';
  const section = await catalogFilters.getSectionByIdOrSlug(sectionSlug);
  if (!section) throw new Error(`нет раздела catalog: ${sectionSlug}`);
  const attrs = await resolveAttrs(section, draft.attrs || []);

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
         $1,$2,'',$3,'public',TRUE,
         FALSE,'listing-orch',$4,'html','text/html','embedded',
         '{}'::jsonb,'{}'::jsonb,$5
       ) RETURNING id`,
      [title, summary, status, slug, OWNER_USER_ID]
    );
    pageId = rows[0].id;
  }

  const photos = [];
  for (const p of draft.photos || []) {
    const file = p.file;
    if (!file) continue;
    const abs = path.join(dir, file);
    if (!fs.existsSync(abs)) throw new Error(`нет фото ${abs}`);
    // eslint-disable-next-line no-await-in-loop
    const { url } = await ingestFile({ absPath: abs, pageId, fileName: file });
    photos.push(url);
  }
  if (!photos.length) throw new Error(`нет фото в ${dir}`);

  let video = null;
  if (draft.video?.file) {
    const abs = path.join(dir, draft.video.file);
    if (!fs.existsSync(abs)) throw new Error(`нет видео ${abs}`);
    const { url } = await ingestFile({
      absPath: abs,
      pageId,
      fileName: draft.video.file,
    });
    video = url;
  }

  const keywords = [section.label_ru, ...attrs.map((a) => a.value)].filter(Boolean).join(', ');
  const content = listingMediaToHtml(photos, video);
  const settings = {
    compose_mode: 'listing',
    listing_media: { photos, video },
    orch_album: dirName,
    orch_source: 'listing-orch',
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
       status = $7, visibility = 'public', show_in_blog = TRUE,
       is_system_template = FALSE, category = 'listing-orch',
       format = 'html', mime_type = 'text/html', storage_type = 'embedded',
       owner_user_id = $8, updated_at = NOW()
     WHERE id = $1`,
    [
      pageId,
      title,
      summary,
      content,
      JSON.stringify(seo),
      JSON.stringify(settings),
      status,
      OWNER_USER_ID,
    ]
  );

  await catalogFilters.applyEntityCatalogPayload('page', pageId, {
    catalog_section_id: section.id,
    catalog_attrs: attrs,
  });

  return {
    pageId,
    slug,
    title,
    photos: photos.length,
    video: Boolean(video),
    status,
    urls: { photos, video },
  };
}

async function main() {
  const dirName = process.argv[2] || 'ростсельмаш-nova-340';
  console.log('owner_user_id =', OWNER_USER_ID);
  console.log('root =', ROOT);
  console.log('card =', dirName);
  const row = await upsertCard(dirName);
  console.log('ok', JSON.stringify(row, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
