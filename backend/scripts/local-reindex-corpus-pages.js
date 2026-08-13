/**
 * Локальная индексация страниц корпуса [Corpus]* в legal_docs.
 * Без LLM-чанкинга (быстрее, не грузит Ollama).
 */
const db = require('../db');
const vectorSearchClient = require('../services/vectorSearchClient');
const semanticChunkingService = require('../services/semanticChunkingService');

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitOversized(text, maxLen = 400) {
  const src = String(text || '').trim();
  if (src.length <= maxLen) return [src];
  const parts = [];
  let i = 0;
  while (i < src.length) {
    let end = Math.min(src.length, i + maxLen);
    if (end < src.length) {
      const cut = src.lastIndexOf(' ', end);
      if (cut > i + 200) end = cut;
    }
    parts.push(src.slice(i, end).trim());
    i = end;
  }
  return parts.filter(Boolean);
}

async function reindexPage(page) {
  const text = stripHtml(page.content || '');
  if (!text) {
    console.warn(`SKIP empty id=${page.id} ${page.title}`);
    return { id: page.id, skipped: true };
  }
  const url = page.visibility === 'public' && page.status === 'published'
    ? `/public/page/${page.id}`
    : `/content/page/${page.id}`;

  const oldRowIds = [String(page.id)];
  for (let i = 0; i < 200; i++) oldRowIds.push(`${page.id}_chunk_${i}`);
  try {
    await vectorSearchClient.remove('legal_docs', oldRowIds);
  } catch (e) {
    console.warn(`remove old chunks id=${page.id}: ${e.message}`);
  }

  const chunks = await semanticChunkingService.chunkDocument(text, {
    maxChunkSize: 400,
    overlap: 40,
    useLLM: false
  });

  const pieces = [];
  for (const chunk of chunks) {
    for (const part of splitOversized(chunk.text, 400)) {
      pieces.push(part);
    }
  }

  for (let index = 0; index < pieces.length; index++) {
    const row_id = pieces.length > 1 ? `${page.id}_chunk_${index}` : String(page.id);
    try {
      await vectorSearchClient.upsert('legal_docs', [{
        row_id,
        text: pieces[index],
        metadata: {
          doc_id: page.id,
          chunk_index: index,
          title: page.title,
          url: pieces.length > 1 ? `${url}#chunk_${index}` : url,
          visibility: page.visibility,
          format: page.format
        }
      }]);
    } catch (e) {
      console.warn(`FAIL chunk ${row_id}: ${e.response?.data?.detail || e.message}`);
    }
  }
  console.log(`OK id=${page.id} chunks=${pieces.length} ${page.title}`);
  return { id: page.id, chunks: pieces.length };
}

async function main() {
  const { rows } = await db.getQuery()(
    `SELECT id, title, content, visibility, status, format
     FROM admin_pages_simple
     WHERE title IN ('[Corpus] company-presentation', '[Corpus] pub-product')
     ORDER BY id`
  );
  console.log(`corpus pages: ${rows.length}`);
  const out = [];
  for (const page of rows) {
    out.push(await reindexPage(page));
  }
  console.log(JSON.stringify({ indexed: out.filter((x) => !x.skipped).length, skipped: out.filter((x) => x.skipped).length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
