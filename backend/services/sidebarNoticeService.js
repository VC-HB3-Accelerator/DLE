/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const fs = require('fs');
const path = require('path');
const db = require('../db');
const logger = require('../utils/logger');

const PRIVACY_PATH = '/content/published?section=' + encodeURIComponent('политика и согласия');
const MAX_BODY_LENGTH = 4000;
const MAX_DOMAIN_DESCRIPTION_LENGTH = 2000;
const MAX_HEADER_DESCRIPTION_LENGTH = 500;
const MAX_OG_IMAGE_URL_LENGTH = 2000;
const DEFAULT_OG_IMAGE = '/og-default.png';

function normalizeBody(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, MAX_BODY_LENGTH);
}

function normalizeDomainDescription(value) {
  return String(value ?? '')
    .replace(/\r\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_DOMAIN_DESCRIPTION_LENGTH);
}

function normalizeHeaderDescription(value) {
  return String(value ?? '')
    .replace(/\r\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_HEADER_DESCRIPTION_LENGTH);
}

function normalizeOgImageUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.length > MAX_OG_IMAGE_URL_LENGTH) {
    throw new Error('Слишком длинный URL картинки для превью');
  }
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
        return `${u.pathname}${u.search || ''}`.slice(0, MAX_OG_IMAGE_URL_LENGTH);
      }
    }
  } catch (_) { /* keep */ }
  return raw.slice(0, MAX_OG_IMAGE_URL_LENGTH);
}

function escapeHtmlAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function titleFromDescription(text) {
  return String(text || '').trim().slice(0, 120);
}

function siteNameFromDescription(text) {
  const value = String(text || '').trim();
  const part = value.split(/\s+[—–-]\s+/)[0].trim();
  return (part || value).slice(0, 80);
}

function replaceMetaContent(html, attr, name, content) {
  const safe = escapeHtmlAttr(content);
  const re = new RegExp(
    `<meta\\s+${attr}=["']${name}["'][^>]*>`,
    'i'
  );
  if (re.test(html)) {
    return html.replace(re, `<meta ${attr}="${name}" content="${safe}">`);
  }
  return html.replace(
    /<\/head>/i,
    `  <meta ${attr}="${name}" content="${safe}">\n</head>`
  );
}

function removeMetaTag(html, attr, name) {
  const re = new RegExp(
    `\\s*<meta\\s+${attr}=["']${name}["'][^>]*>\\s*`,
    'gi'
  );
  return html.replace(re, '\n');
}

function replaceTitle(html, title) {
  const safe = escapeHtmlText(title);
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safe}</title>`);
  }
  return html.replace(/<\/head>/i, `    <title>${safe}</title>\n</head>`);
}

function replaceFavicon(html, href) {
  const url = String(href || '').trim() || '/favicon.ico';
  const safe = escapeHtmlAttr(url);
  const type = url.endsWith('.ico') ? 'image/x-icon' : 'image/png';
  const re = /<link\s+[^>]*rel=["'](?:shortcut\s+)?icon["'][^>]*>/i;
  const tag = `<link rel="icon" type="${type}" href="${safe}">`;
  if (re.test(html)) {
    return html.replace(re, tag);
  }
  return html.replace(/<\/head>/i, `    ${tag}\n</head>`);
}

function resolveOgImage({ ogImageUrl, hideOgImage }) {
  if (hideOgImage) {
    return { url: '', hidden: true };
  }
  const custom = String(ogImageUrl || '').trim();
  return { url: custom || DEFAULT_OG_IMAGE, hidden: false };
}

function patchIndexHtmlMeta({ description, ogImageUrl, hideOgImage }) {
  const custom = normalizeDomainDescription(description);
  const text = custom;
  const title = titleFromDescription(custom);
  const siteName = siteNameFromDescription(custom);
  const og = resolveOgImage({ ogImageUrl, hideOgImage });
  const candidates = [
    '/app/frontend_dist/index.html',
    path.join(__dirname, '../../frontend/dist/index.html'),
    '/host-project/frontend/dist/index.html',
  ];
  const seen = new Set();
  for (const filePath of candidates) {
    const resolved = path.resolve(filePath);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (!fs.existsSync(resolved)) continue;
    try {
      let html = fs.readFileSync(resolved, 'utf8');
      html = replaceTitle(html, title);
      html = replaceMetaContent(html, 'name', 'description', text);
      html = replaceMetaContent(html, 'property', 'og:description', text);
      html = replaceMetaContent(html, 'name', 'twitter:description', text);
      html = replaceMetaContent(html, 'property', 'og:title', title);
      html = replaceMetaContent(html, 'name', 'twitter:title', title);
      html = replaceMetaContent(html, 'property', 'og:site_name', siteName);
      if (og.hidden) {
        html = removeMetaTag(html, 'property', 'og:image');
        html = removeMetaTag(html, 'name', 'twitter:image');
        html = replaceMetaContent(html, 'name', 'twitter:card', 'summary');
        html = replaceFavicon(html, '/favicon.ico');
      } else {
        html = replaceMetaContent(html, 'property', 'og:image', og.url);
        html = replaceMetaContent(html, 'name', 'twitter:image', og.url);
        html = replaceMetaContent(
          html,
          'name',
          'twitter:card',
          og.url && og.url !== DEFAULT_OG_IMAGE ? 'summary_large_image' : 'summary'
        );
        html = replaceFavicon(html, og.url);
      }
      fs.writeFileSync(resolved, html);
      logger.info(`[sidebarNotice] обновлены title/description/og:image/favicon: ${resolved}`);
    } catch (error) {
      logger.warn(`[sidebarNotice] не удалось обновить ${resolved}: ${error.message}`);
    }
  }
}

/** @deprecated use patchIndexHtmlMeta */
function patchIndexHtmlDescription(description) {
  patchIndexHtmlMeta({ description, ogImageUrl: '', hideOgImage: false });
}

function mapRow(row) {
  return {
    body: row?.body || '',
    domainDescription: row?.domain_description || '',
    headerDescription: row?.header_description || '',
    ogImageUrl: row?.og_image_url || '',
    hideOgImage: Boolean(row?.hide_og_image),
    privacyPath: PRIVACY_PATH,
    updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
    updatedBy: row?.updated_by ?? null,
  };
}

async function ensureBrandColumns() {
  await db.getQuery()(`
    ALTER TABLE sidebar_notice
      ADD COLUMN IF NOT EXISTS og_image_url TEXT NOT NULL DEFAULT ''
  `);
  await db.getQuery()(`
    ALTER TABLE sidebar_notice
      ADD COLUMN IF NOT EXISTS hide_og_image BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await db.getQuery()(`
    ALTER TABLE sidebar_notice
      ADD COLUMN IF NOT EXISTS header_description TEXT NOT NULL DEFAULT ''
  `);
}

async function getNotice() {
  await ensureBrandColumns();
  const { rows } = await db.getQuery()(
    `SELECT body, domain_description, header_description, og_image_url, hide_og_image,
            updated_at, updated_by
     FROM sidebar_notice
     WHERE id = 1`
  );

  if (!rows.length) {
    return mapRow(null);
  }

  return mapRow(rows[0]);
}

async function setNotice({
  body,
  domainDescription,
  headerDescription,
  ogImageUrl,
  hideOgImage,
  updatedBy = null,
}) {
  await ensureBrandColumns();
  const normalized = body === undefined ? undefined : normalizeBody(body);
  const normalizedDescription = domainDescription === undefined
    ? undefined
    : normalizeDomainDescription(domainDescription);
  const normalizedHeader = headerDescription === undefined
    ? undefined
    : normalizeHeaderDescription(headerDescription);
  const normalizedOg = ogImageUrl === undefined
    ? undefined
    : normalizeOgImageUrl(ogImageUrl);
  const userId = updatedBy != null && Number.isFinite(Number(updatedBy))
    ? Number(updatedBy)
    : null;

  const existing = await getNotice();
  const nextBody = normalized === undefined ? existing.body : normalized;
  const nextDescription = normalizedDescription === undefined
    ? existing.domainDescription
    : normalizedDescription;
  const nextHeader = normalizedHeader === undefined
    ? existing.headerDescription
    : normalizedHeader;
  const nextOg = normalizedOg === undefined ? existing.ogImageUrl : normalizedOg;
  const nextHide = hideOgImage === undefined
    ? existing.hideOgImage
    : Boolean(hideOgImage);

  const { rows } = await db.getQuery()(
    `INSERT INTO sidebar_notice (
       id, body, domain_description, header_description, og_image_url, hide_og_image, updated_at, updated_by
     )
     VALUES (1, $1, $2, $3, $4, $5, NOW(), $6)
     ON CONFLICT (id) DO UPDATE SET
       body = EXCLUDED.body,
       domain_description = EXCLUDED.domain_description,
       header_description = EXCLUDED.header_description,
       og_image_url = EXCLUDED.og_image_url,
       hide_og_image = EXCLUDED.hide_og_image,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by
     RETURNING body, domain_description, header_description, og_image_url, hide_og_image,
               updated_at, updated_by`,
    [nextBody, nextDescription, nextHeader, nextOg, nextHide, userId]
  );

  patchIndexHtmlMeta({
    description: nextDescription,
    ogImageUrl: nextOg,
    hideOgImage: nextHide,
  });
  return mapRow(rows[0]);
}

module.exports = {
  getNotice,
  setNotice,
  patchIndexHtmlDescription,
  patchIndexHtmlMeta,
  PRIVACY_PATH,
  MAX_BODY_LENGTH,
  MAX_DOMAIN_DESCRIPTION_LENGTH,
  MAX_HEADER_DESCRIPTION_LENGTH,
  DEFAULT_OG_IMAGE,
};
