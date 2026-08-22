#!/usr/bin/env node
/**
 * Диагностика id таблиц на текущем инстансе (по имени, не из dump).
 *   node scripts/rag-test-inspect-tables.js
 */
const encryptedDb = require('../services/encryptedDatabaseService');
const settingsService = require('../services/aiAssistantSettingsService');
const db = require('../db');

(async () => {
  const tables = await encryptedDb.getData('user_tables', {});
  const list = (tables || []).map((t) => ({
    id: Number(t.id),
    name: String(t.name || '').trim(),
    rag: Number(t.is_rag_source_id || t.is_rag_source || 0)
  }));
  const faq = list.find((t) => t.name.toLowerCase() === 'faq');
  const tags = list.find((t) => t.name === 'Теги клиентов');
  const settings = await settingsService.getSettings();

  const faqCols = faq
    ? (await encryptedDb.getData('user_columns', { table_id: faq.id })).map((c) => ({
      id: c.id,
      name: c.name,
      purpose: c.options && c.options.purpose,
      type: c.type
    }))
    : [];
  const faqRows = faq ? await encryptedDb.getData('user_rows', { table_id: faq.id }) : [];
  const tagCols = tags
    ? (await encryptedDb.getData('user_columns', { table_id: tags.id })).map((c) => ({
      id: c.id,
      name: c.name,
      purpose: c.options && c.options.purpose
    }))
    : [];
  const tagRows = tags ? await encryptedDb.getData('user_rows', { table_id: tags.id }) : [];

  const pages = await db.getQuery()(
    `SELECT id, title, status, visibility
       FROM admin_pages_simple
      WHERE title LIKE $1
      ORDER BY id`,
    ['[Corpus]%']
  );
  let chunks = { rows: [] };
  try {
    chunks = await db.getQuery()(
      `SELECT source, table_id, count(*)::int AS n
         FROM rag_chunks
        GROUP BY 1, 2
        ORDER BY 1, 2`
    );
  } catch (err) {
    chunks = { rows: [{ error: err.message }] };
  }

  process.stdout.write(`${JSON.stringify({
    selected_rag_tables: settings?.selected_rag_tables || [],
    rules_id: settings?.rules_id || null,
    tables: list.sort((a, b) => a.id - b.id),
    faq: faq
      ? { id: faq.id, rag: faq.rag, columns: faqCols, rows: (faqRows || []).length }
      : null,
    tags: tags
      ? { id: tags.id, columns: tagCols, rows: (tagRows || []).length }
      : null,
    corpus_pages: pages.rows,
    rag_chunks: chunks.rows
  }, null, 2)}\n`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
