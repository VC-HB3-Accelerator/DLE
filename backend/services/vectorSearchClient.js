const axios = require('axios');
const logger = require('../utils/logger');

const VECTOR_SEARCH_URL = process.env.VECTOR_SEARCH_URL || 'http://vector-search:8001';

async function upsert(tableId, rows) {
  logger.info(`[VectorSearch] upsert: tableId=${tableId}, rows=${rows.length}`);
  try {
    const res = await axios.post(`${VECTOR_SEARCH_URL}/upsert`, {
      table_id: String(tableId),
      rows: rows.map(r => ({
        row_id: String(r.row_id),
        text: r.text,
        metadata: r.metadata || {}
      }))
    });
    logger.info(`[VectorSearch] upsert result:`, res.data);
    return res.data;
  } catch (error) {
    logger.error(`[VectorSearch] upsert error:`, error.message);
    throw error;
  }
}

async function search(tableId, query, topK = 3) {
  logger.info(`[VectorSearch] search: tableId=${tableId}, query="${query}", topK=${topK}`);
  try {
    const res = await axios.post(`${VECTOR_SEARCH_URL}/search`, {
      table_id: String(tableId),
      query,
      top_k: topK
    });
    logger.info(`[VectorSearch] search result:`, res.data.results);
    return res.data.results;
  } catch (error) {
    logger.error(`[VectorSearch] search error:`, error.message);
    throw error;
  }
}

async function remove(tableId, rowIds) {
  logger.info(`[VectorSearch] remove: tableId=${tableId}, rowIds=${rowIds}`);
  try {
    const res = await axios.post(`${VECTOR_SEARCH_URL}/remove`, {
      table_id: String(tableId),
      row_ids: rowIds.map(String)
    });
    logger.info(`[VectorSearch] remove result:`, res.data);
    return res.data;
  } catch (error) {
    logger.error(`[VectorSearch] remove error:`, error.message);
    throw error;
  }
}

async function rebuild(tableId, rows) {
  logger.info(`[VectorSearch] rebuild: tableId=${tableId}, rows=${rows.length}`);
  try {
    const res = await axios.post(`${VECTOR_SEARCH_URL}/rebuild`, {
      table_id: String(tableId),
      rows: rows.map(r => ({
        row_id: String(r.row_id),
        text: r.text,
        metadata: r.metadata || {}
      }))
    });
    logger.info(`[VectorSearch] rebuild result:`, res.data);
    return res.data;
  } catch (error) {
    logger.error(`[VectorSearch] rebuild error:`, error.message);
    throw error;
  }
}

async function health() {
  logger.info(`[VectorSearch] health check`);
  try {
    const res = await axios.get(`${VECTOR_SEARCH_URL}/health`, { timeout: 5000 });
    logger.info(`[VectorSearch] health result:`, res.data);
    return {
      status: 'ok',
      url: VECTOR_SEARCH_URL,
      response: res.data
    };
  } catch (error) {
    logger.error(`[VectorSearch] health error:`, error.message);
    return {
      status: 'error',
      url: VECTOR_SEARCH_URL,
      error: error.message
    };
  }
}

module.exports = {
  upsert,
  search,
  remove,
  rebuild,
  health
}; 