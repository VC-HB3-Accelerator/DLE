'use strict';
const db = require('../db');
const contentMediaStore = require('../services/contentMediaStore');
const ragPgvectorService = require('../services/ragPgvectorService');
const { removeHtmlForSlug } = require('../scripts/pre-render-blog');

const PAGE_IDS = [88, 257, 538, 551, 701, 1008, 1038, 1040];

(async () => {
  const deleted = [];
  const errors = [];
  for (const pageId of PAGE_IDS) {
    try {
      const { rows } = await db.getQuery()(
        'SELECT id, title, slug, format FROM admin_pages_simple WHERE id = $1',
        [pageId],
      );
      if (!rows.length) {
        errors.push({ pageId, error: 'not_found' });
        continue;
      }
      const page = rows[0];
      const { rows: media } = await db.getQuery()(
        'SELECT id FROM content_media WHERE page_id = $1',
        [pageId],
      );
      let mediaDeleted = 0;
      for (const m of media) {
        const r = await contentMediaStore.deleteMediaById(m.id);
        if (r.deleted) mediaDeleted += 1;
      }
      const { rows: delRows } = await db.getQuery()(
        'DELETE FROM admin_pages_simple WHERE id = $1 RETURNING id, title, slug',
        [pageId],
      );
      if (page.slug) {
        try { removeHtmlForSlug(String(page.slug).trim()); } catch { /* ignore */ }
      }
      try {
        if (page.format === 'html') {
          await ragPgvectorService.removeDocument(pageId);
        }
      } catch (e) {
        errors.push({ pageId, rag: String(e.message || e) });
      }
      deleted.push({ ...delRows[0], mediaDeleted });
    } catch (e) {
      errors.push({ pageId, error: String(e.message || e) });
    }
  }
  console.log(JSON.stringify({ ok: errors.length === 0, deleted, errors }, null, 2));
  process.exit(errors.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
