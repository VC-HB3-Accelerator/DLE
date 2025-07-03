const axios = require('axios');

const VECTOR_SEARCH_URL = process.env.VECTOR_SEARCH_URL || 'http://vector-search:8001';

async function upsert(tableId, rows) {
  const res = await axios.post(`${VECTOR_SEARCH_URL}/upsert`, {
    table_id: String(tableId),
    rows: rows.map(r => ({
      row_id: String(r.row_id),
      text: r.text,
      metadata: r.metadata || {}
    }))
  });
  return res.data;
}

async function search(tableId, query, topK = 3) {
  const res = await axios.post(`${VECTOR_SEARCH_URL}/search`, {
    table_id: String(tableId),
    query,
    top_k: topK
  });
  return res.data.results;
}

async function remove(tableId, rowIds) {
  const res = await axios.post(`${VECTOR_SEARCH_URL}/delete`, {
    table_id: String(tableId),
    row_ids: rowIds.map(id => String(id))
  });
  return res.data;
}

async function rebuild(tableId, rows) {
  const res = await axios.post(`${VECTOR_SEARCH_URL}/rebuild`, {
    table_id: String(tableId),
    rows: rows.map(r => ({
      row_id: String(r.row_id),
      text: r.text,
      metadata: r.metadata || {}
    }))
  });
  return res.data;
}

async function health() {
  try {
    const res = await axios.get(`${VECTOR_SEARCH_URL}/health`, { timeout: 5000 });
    return {
      status: 'ok',
      url: VECTOR_SEARCH_URL,
      response: res.data
    };
  } catch (error) {
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