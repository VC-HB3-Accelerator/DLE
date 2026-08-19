/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Совместимый API бывшего FAISS-клиента. Реализация — только pgvector (rag_chunks).
 */

const logger = require('../utils/logger');
const ragPgvectorService = require('./ragPgvectorService');

async function upsert(tableId, rows) {
  logger.info(`[pgvector] upsert: tableId=${tableId}, rows=${(rows || []).length}`);
  if (String(tableId) === 'legal_docs' || String(tableId) === 'admin_pages_simple') {
    logger.warn('[pgvector] upsert документов через этот API пропущен — используйте upsertDocumentChunks');
    return { count: 0, skipped: true };
  }
  return ragPgvectorService.upsertFaqRows(tableId, rows || []);
}

async function search(tableId, query, topK = 3) {
  logger.info(`[pgvector] search: tableId=${tableId}, query="${String(query || '').slice(0, 80)}", topK=${topK}`);
  return ragPgvectorService.searchUnfiltered({
    tableId,
    query,
    limit: topK
  });
}

async function remove(tableId, rowIds) {
  logger.info(`[pgvector] remove: tableId=${tableId}, rowIds=${(rowIds || []).length}`);
  return ragPgvectorService.removeFaqRows(tableId, rowIds || []);
}

async function rebuild(tableId, rows) {
  logger.info(`[pgvector] rebuild: tableId=${tableId}, rows=${(rows || []).length}`);
  const numericId = Number(tableId);
  if (Number.isFinite(numericId) && numericId > 0) {
    try {
      return await ragPgvectorService.rebuildFaqTable(numericId);
    } catch (err) {
      logger.warn(`[pgvector] rebuildFaqTable fallback upsert: ${err.message}`);
    }
  }
  return upsert(tableId, rows || []);
}

async function health() {
  return ragPgvectorService.health();
}

module.exports = {
  upsert,
  search,
  remove,
  rebuild,
  health
};
