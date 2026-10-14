/**
 * Карточки ленты из data/sku-catalog-2026.csv.
 * Идемпотентно: slug с префиксом 2026-.
 *
 * node scripts/seed-sku-catalog-blog.js /path/to/sku-catalog-2026.csv
 */
const fs = require('fs');
const db = require('../db');
const { enrichListingDescription } = require('./listing-b-mass/build-listing-description');

const CATEGORY = '2026';
const SLUG_PREFIX = '2026-';

function generateSlug(text, maxLength = 80) {
  if (!text) return '';
  const map = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo',
    ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
    н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
    ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  return String(text)
    .normalize('NFKC')
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[а-яё]/g, (char) => map[char] || char)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, maxLength)
    .replace(/-+$/, '');
}

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => cell !== '')) rows.push(row);
  }
  const header = rows.shift();
  if (!header) return [];
  return rows.map((cells) => {
    const item = {};
    header.forEach((key, idx) => {
      item[key] = cells[idx] || '';
    });
    return item;
  });
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    throw new Error('Укажите путь к sku-catalog-2026.csv');
  }
  const items = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  if (!items.length) throw new Error('CSV пуст');

  const { rows: existing } = await db.getQuery()(
    `SELECT id, slug FROM admin_pages_simple WHERE slug LIKE $1`,
    [`${SLUG_PREFIX}%`]
  );
  const existingIds = new Map(existing.map((row) => [row.slug, row.id]));
  const used = new Set(existingIds.keys());
  const seenBase = new Map();

  let inserted = 0;
  let updated = 0;
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      const title = (item.title || '').trim();
      const summary = enrichListingDescription(item);
      if (!title) continue;
      const base = `${SLUG_PREFIX}${generateSlug(`${item.brand || ''} ${item.model || title}`)}` || `${SLUG_PREFIX}item`;
      const seen = (seenBase.get(base) || 0) + 1;
      seenBase.set(base, seen);
      let slug = seen === 1 ? base : `${base}-${seen}`;
      while (used.has(slug) && !existingIds.has(slug)) {
        slug = `${base}-${seen + 1}`;
        seen += 1;
      }
      used.add(slug);
      const content = `<p>${esc(summary || title)}</p>`;
      const seo = JSON.stringify({ title, description: summary || title });
      const pageId = existingIds.get(slug);
      if (pageId) {
        await client.query(
          `UPDATE admin_pages_simple SET
             title = $2, summary = $3, content = $4,
             status = 'published', visibility = 'public',
             show_in_blog = TRUE, is_system_template = FALSE,
             category = $5, format = 'html', mime_type = 'text/html',
             storage_type = 'embedded', seo = $6::jsonb, updated_at = NOW()
           WHERE id = $1`,
          [pageId, title, summary || title, content, CATEGORY, seo]
        );
        updated += 1;
      } else {
        const { rows } = await client.query(
          `INSERT INTO admin_pages_simple (
             title, summary, content, status, visibility, show_in_blog,
             is_system_template, category, slug, format, mime_type, storage_type, seo
           ) VALUES (
             $1,$2,$3,'published','public',TRUE,
             FALSE,$4,$5,'html','text/html','embedded',$6::jsonb
           ) RETURNING id`,
          [title, summary || title, content, CATEGORY, slug, seo]
        );
        existingIds.set(slug, rows[0].id);
        inserted += 1;
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const { rows: countRows } = await db.getQuery()(
    `SELECT count(*)::int AS cnt
     FROM admin_pages_simple
     WHERE category = $1 AND show_in_blog = TRUE AND status = 'published'`,
    [CATEGORY]
  );
  console.log(JSON.stringify({
    csv: items.length,
    inserted,
    updated,
    published: countRows[0].cnt,
  }));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
