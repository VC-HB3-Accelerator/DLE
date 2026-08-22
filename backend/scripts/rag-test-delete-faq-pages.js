#!/usr/bin/env node
/**
 * Удалить ранее залитые внутренние страницы FAQ ([Corpus] faq-*) и их rag_chunks.
 * Таблицу «FAQ» (строки) и SoT Source_Documents/ru/FAQ.md не трогает.
 *
 *   node scripts/rag-test-delete-faq-pages.js
 *   node scripts/rag-test-delete-faq-pages.js --apply
 */

const db = require('../db');
const ragPgvectorService = require('../services/ragPgvectorService');

function isFaqCorpusPage(row) {
  const title = String(row.title || '');
  let seo = row.seo;
  if (typeof seo === 'string') {
    try { seo = JSON.parse(seo); } catch (_) { seo = {}; }
  }
  const source = String(seo?.corpus_source || seo?.corpus_manifest_id || '');
  const id = String(seo?.corpus_manifest_id || '');
  return (
    /^\[Corpus\]\s*faq[- ]/i.test(title)
    || /^\[Corpus\]\s*FAQ\.md$/i.test(title)
    || /^FAQ\.md$/i.test(title)
    || /^faq-/i.test(id)
    || /(?:^|\/)FAQ\.md$/i.test(source)
    || /(?:^|\/)faq-[^/]+\.md$/i.test(source)
  );
}

async function listPages() {
  const res = await db.getQuery()(
    `SELECT id, title, status, visibility, seo
       FROM admin_pages_simple
      ORDER BY id`
  );
  return (res.rows || []).filter(isFaqCorpusPage);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const pages = await listPages();
  console.log(`=== rag-test-delete-faq-pages ${apply ? 'APPLY' : 'DRY-RUN'} ===`);
  console.log(`matched pages: ${pages.length}`);
  for (const p of pages) {
    console.log(`  id=${p.id} ${p.title} (${p.visibility}/${p.status})`);
  }
  if (!apply) {
    console.log('\nDry-run. --apply удаляет страницы и чанки.');
    return;
  }
  let deleted = 0;
  for (const p of pages) {
    await ragPgvectorService.removeDocument(p.id);
    await db.getQuery()('DELETE FROM admin_pages_simple WHERE id = $1', [p.id]);
    console.log(`DELETED page ${p.id} ${p.title}`);
    deleted += 1;
  }
  console.log(JSON.stringify({ ok: true, deleted }, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { isFaqCorpusPage, listPages };
