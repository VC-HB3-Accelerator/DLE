/**
 * Retrieval FAQ + documents через Postgres pgvector (ТЗ §4.7).
 * Единственный векторный индекс. FAISS / vector-search снят.
 */

const db = require('../db');
const logger = require('../utils/logger');
const encryptedDb = require('./encryptedDatabaseService');
const embeddingRuntimeService = require('./embeddingRuntimeService');
const {
  canonicalAudience,
  canonicalMode,
  isAudienceSlug,
  isModeSlug,
  resolveFaqRowVisible,
  corpusAudiencesForContext,
  looksLikeRestrictedDealText,
  documentTagsAllowedForGuest
} = require('./assistantTurnContext');

const DEFAULT_VECTOR_DIM = 1024;
let schemaReady = null;

function query() {
  return db.getQuery();
}

function toVectorLiteral(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  return `[${arr.map((n) => Number(n)).join(',')}]`;
}

async function ensureSchema() {
  if (schemaReady === true) return true;
  if (schemaReady === false) return false;
  try {
    await query()('CREATE EXTENSION IF NOT EXISTS vector');
    await query()(`
      CREATE TABLE IF NOT EXISTS rag_chunks (
        id SERIAL PRIMARY KEY,
        source TEXT NOT NULL,
        table_id INTEGER,
        row_id TEXT NOT NULL,
        text TEXT NOT NULL,
        embedding vector(${DEFAULT_VECTOR_DIM}),
        audience_tags TEXT[] NOT NULL DEFAULT '{}',
        service_mode TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        embedding_model TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT rag_chunks_source_chk CHECK (source IN ('faq', 'document')),
        CONSTRAINT rag_chunks_unique UNIQUE (source, table_id, row_id)
      )
    `);
    await query()('CREATE INDEX IF NOT EXISTS rag_chunks_source_idx ON rag_chunks (source)');
    await query()('CREATE INDEX IF NOT EXISTS rag_chunks_audience_gin ON rag_chunks USING GIN (audience_tags)');
    schemaReady = true;
    return true;
  } catch (err) {
    schemaReady = false;
    logger.error(
      '[ragPgvector] Нет расширения vector. Нужен образ pgvector/pgvector:pg16. %s',
      err.message
    );
    return false;
  }
}

async function embedTexts(texts) {
  return embeddingRuntimeService.embedTexts(texts);
}

async function getEmbeddingColumnDimension() {
  const { rows } = await query()(
    `SELECT format_type(a.atttypid, a.atttypmod) AS typ
       FROM pg_attribute a
      WHERE a.attrelid = 'rag_chunks'::regclass
        AND a.attname = 'embedding'
        AND NOT a.attisdropped`
  );
  return embeddingRuntimeService.parseVectorFormatType(rows[0]?.typ);
}

async function ensureEmbeddingDimension(dim) {
  const n = embeddingRuntimeService.normalizeDimension(dim, DEFAULT_VECTOR_DIM);
  const allowed = embeddingRuntimeService.ALLOWED_DIMS;
  if (!allowed.includes(n)) {
    throw new Error(`unsupported embedding dimension ${dim}`);
  }
  const ok = await ensureSchema();
  if (!ok) throw new Error('pgvector недоступен');
  const current = await getEmbeddingColumnDimension();
  if (current === n) return { changed: false, dimension: n, from: current };
  const pool = db.getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM rag_chunks');
    await client.query(`ALTER TABLE rag_chunks ALTER COLUMN embedding TYPE vector(${n})`);
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
  logger.warn(`[ragPgvector] embedding dim ${current} -> ${n}, index cleared`);
  return { changed: true, dimension: n, from: current };
}

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

function corpusAudienceFromSeo(seo) {
  try {
    const obj = typeof seo === 'string' ? JSON.parse(seo) : (seo || {});
    return Array.isArray(obj.corpus_audience) ? obj.corpus_audience : [];
  } catch (_) {
    return [];
  }
}

async function reindexCorpusPage(page) {
  const text = stripHtml(page.content || '');
  if (!text) return { id: page.id, skipped: true, chunks: 0 };
  const url = page.visibility === 'public' && page.status === 'published'
    ? `/public/page/${page.id}`
    : `/content/page/${page.id}`;
  try {
    await removeDocument(page.id);
  } catch (e) {
    logger.warn(`[ragPgvector] remove old corpus id=${page.id}: ${e.message}`);
  }
  const semanticChunkingService = require('./semanticChunkingService');
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
  const audience = corpusAudienceFromSeo(page.seo);
  const pgChunks = pieces.map((part, index) => ({
    row_id: pieces.length > 1 ? `${page.id}_chunk_${index}` : String(page.id),
    text: part,
    audience_tags: audience,
    metadata: {
      doc_id: page.id,
      chunk_index: index,
      title: page.title,
      url: pieces.length > 1 ? `${url}#chunk_${index}` : url,
      visibility: page.visibility,
      format: page.format,
      corpus_audience: audience
    }
  }));
  await upsertDocumentChunks({ pageId: page.id, chunks: pgChunks });
  return { id: page.id, skipped: false, chunks: pieces.length };
}

async function rebuildPublishedCorpusPages() {
  const { rows } = await query()(
    `SELECT id, title, content, visibility, status, format, seo
       FROM admin_pages_simple
      WHERE title LIKE '[Corpus]%'
        AND status = 'published'
      ORDER BY id`
  );
  const out = [];
  for (const page of rows || []) {
    try {
      out.push(await reindexCorpusPage(page));
    } catch (err) {
      logger.error(`[ragPgvector] corpus page=${page.id}: ${err.message}`);
      out.push({ id: page.id, skipped: true, chunks: 0, error: err.message });
    }
  }
  return {
    indexed: out.filter((x) => !x.skipped).length,
    skipped: out.filter((x) => x.skipped).length,
    chunks: out.reduce((s, x) => s + (x.chunks || 0), 0),
    pages: out
  };
}

async function rebuildAllRagIndex() {
  const runtime = await embeddingRuntimeService.resolveRuntime();
  const ok = await ensureSchema();
  if (!ok) throw new Error('pgvector недоступен');
  const dimChange = await ensureEmbeddingDimension(runtime.dimension);
  const tables = await encryptedDb.getData('user_tables', {});
  const ragTables = (tables || []).filter((t) => Number(t.is_rag_source_id || t.is_rag_source) === 1);
  const faq = [];
  for (const t of ragTables) {
    const started = Date.now();
    try {
      const result = await rebuildFaqTable(t.id);
      faq.push({
        tableId: t.id,
        name: t.name,
        chunks: result?.count ?? 0,
        ms: Date.now() - started
      });
    } catch (err) {
      logger.error(`[ragPgvector] rebuild FAQ table=${t.id}: ${err.message}`);
      faq.push({
        tableId: t.id,
        name: t.name,
        chunks: 0,
        error: err.message,
        ms: Date.now() - started
      });
    }
  }
  let corpus;
  try {
    corpus = await rebuildPublishedCorpusPages();
  } catch (err) {
    logger.error(`[ragPgvector] rebuild corpus: ${err.message}`);
    corpus = { indexed: 0, skipped: 0, chunks: 0, error: err.message, pages: [] };
  }
  const faqFailed = faq.filter((row) => row.error);
  const faqChunks = faq.reduce((s, row) => s + (row.chunks || 0), 0);
  if (faqChunks === 0 && (corpus.chunks || 0) === 0) {
    const firstErr = faqFailed[0]?.error
      || corpus.error
      || (corpus.pages || []).find((p) => p.error)?.error;
    if (firstErr) throw new Error(firstErr);
  }
  return {
    provider: runtime.provider,
    model: runtime.model,
    dimension: runtime.dimension,
    dimChange,
    faq,
    corpus
  };
}

function splitRowTags(tagNames) {
  const audience = [];
  let serviceMode = null;
  for (const raw of tagNames || []) {
    const slug = String(raw || '').trim().toLowerCase();
    if (!slug) continue;
    if (isModeSlug(slug)) {
      serviceMode = serviceMode || canonicalMode(slug);
    } else if (isAudienceSlug(slug)) {
      audience.push(canonicalAudience(slug));
    }
  }
  return { audience: [...new Set(audience)], serviceMode };
}

async function loadRelationTags(columnIds) {
  const ids = (columnIds || []).filter(Boolean);
  if (!ids.length) return new Map();
  const { rows } = await query()(
    `SELECT column_id, from_row_id, to_row_id
       FROM user_table_relations
      WHERE column_id = ANY($1::int[])`,
    [ids]
  );
  const tagIds = [...new Set(rows.map((r) => r.to_row_id).filter(Boolean))];
  let names = [];
  try {
    const userContextService = require('./userContextService');
    names = tagIds.length ? await userContextService.getTagNames(tagIds) : [];
  } catch (_) {
    names = [];
  }
  const nameById = new Map();
  if (names.length === tagIds.length) {
    tagIds.forEach((id, i) => nameById.set(id, names[i]));
  } else {
    const userContextService = require('./userContextService');
    for (const id of tagIds) {
      const one = await userContextService.getTagNames([id]);
      if (one[0]) nameById.set(id, one[0]);
    }
  }
  const byFrom = new Map();
  for (const row of rows) {
    const key = `${row.column_id}:${row.from_row_id}`;
    const slug = nameById.get(row.to_row_id);
    if (!slug) continue;
    if (!byFrom.has(key)) byFrom.set(key, []);
    byFrom.get(key).push(slug);
  }
  return byFrom;
}

function parseTagCell(value) {
  if (Array.isArray(value)) return value.map((t) => String(t).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

async function collectFaqChunks(tableId) {
  const columns = await encryptedDb.getData('user_columns', { table_id: tableId });
  const rows = await encryptedDb.getData('user_rows', { table_id: tableId });
  const cellValues = rows.length
    ? await encryptedDb.getData('user_cell_values', { row_id: { $in: rows.map((r) => r.id) } })
    : [];
  const getCol = (purpose) => columns.find((c) => c.options?.purpose === purpose);
  const questionCol = getCol('question');
  const answerCol = getCol('answer');
  if (!questionCol || !answerCol) return [];

  const contextCol = getCol('context');
  const userTagsCol = getCol('userTags') || getCol('audienceTags');
  const serviceModeCol = getCol('serviceMode');
  const relMap = await loadRelationTags([userTagsCol?.id, serviceModeCol?.id].filter(Boolean));

  const chunks = [];
  for (const row of rows) {
    const cells = cellValues.filter((c) => c.row_id === row.id);
    const question = cells.find((c) => c.column_id === questionCol.id)?.value;
    const answer = cells.find((c) => c.column_id === answerCol.id)?.value;
    if (!question || !String(question).trim()) continue;
    const context = cells.find((c) => c.column_id === contextCol?.id)?.value || '';
    const cellTags = parseTagCell(cells.find((c) => c.column_id === userTagsCol?.id)?.value);
    const relTags = relMap.get(`${userTagsCol?.id}:${row.id}`) || [];
    const modeCell = parseTagCell(cells.find((c) => c.column_id === serviceModeCol?.id)?.value);
    const modeRel = relMap.get(`${serviceModeCol?.id}:${row.id}`) || [];
    const split = splitRowTags([...cellTags, ...relTags, ...modeCell, ...modeRel]);
    let serviceMode = split.serviceMode;
    if (!serviceMode && modeCell[0]) serviceMode = canonicalMode(modeCell[0]);
    const text = answer ? `${String(question).trim()}\n${String(answer).trim()}` : String(question).trim();
    chunks.push({
      source: 'faq',
      table_id: Number(tableId),
      row_id: String(row.id),
      text,
      audience_tags: split.audience,
      service_mode: serviceMode || null,
      metadata: {
        question: String(question).trim(),
        answer: answer ? String(answer).trim() : '',
        context: String(context || ''),
        userTags: split.audience,
        serviceMode: serviceMode || null
      }
    });
  }
  return chunks;
}

async function replaceSourceChunks(source, tableId, chunks) {
  const ok = await ensureSchema();
  if (!ok) throw new Error('pgvector недоступен');
  if (source === 'faq') {
    await query()('DELETE FROM rag_chunks WHERE source = $1 AND table_id = $2', ['faq', Number(tableId)]);
  } else if (tableId == null) {
    await query()('DELETE FROM rag_chunks WHERE source = $1 AND table_id IS NULL', ['document']);
  } else {
    await query()('DELETE FROM rag_chunks WHERE source = $1 AND table_id = $2', ['document', Number(tableId)]);
  }
  if (!chunks.length) return { count: 0 };
  const { model, vectors } = await embedTexts(chunks.map((c) => c.text));
  if (vectors.length !== chunks.length) {
    throw new Error(`embed count ${vectors.length} != chunks ${chunks.length}`);
  }
  let count = 0;
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const vec = toVectorLiteral(vectors[i]);
    if (!vec) continue;
    await query()(
      `INSERT INTO rag_chunks
         (source, table_id, row_id, text, embedding, audience_tags, service_mode, metadata, embedding_model, updated_at)
       VALUES ($1, $2, $3, $4, $5::vector, $6::text[], $7, $8::jsonb, $9, NOW())
       ON CONFLICT (source, table_id, row_id)
       DO UPDATE SET
         text = EXCLUDED.text,
         embedding = EXCLUDED.embedding,
         audience_tags = EXCLUDED.audience_tags,
         service_mode = EXCLUDED.service_mode,
         metadata = EXCLUDED.metadata,
         embedding_model = EXCLUDED.embedding_model,
         updated_at = NOW()`,
      [
        chunk.source,
        chunk.table_id,
        chunk.row_id,
        chunk.text,
        vec,
        chunk.audience_tags || [],
        chunk.service_mode || null,
        JSON.stringify(chunk.metadata || {}),
        model
      ]
    );
    count += 1;
  }
  logger.info(`[ragPgvector] upsert ${source} table=${tableId}: ${count}`);
  return { count, model };
}

async function renameFaqAudienceColumn(tableId, columns) {
  const col = (columns || []).find((c) => {
    const p = c.options?.purpose;
    return p === 'userTags' || p === 'audienceTags';
  });
  if (!col) return;
  if (String(col.name || '') === 'Аудитория (ЦА)') return;
  const { getEncryptionKey } = require('../utils/encryptionUtils');
  const key = getEncryptionKey();
  await query()(
    'UPDATE user_columns SET name_encrypted = encrypt_text($2, $3) WHERE id = $1',
    [col.id, 'Аудитория (ЦА)', key]
  );
  logger.info(`[ragPgvector] FAQ table=${tableId}: колонка ЦА переименована`);
}

async function ensureFaqServiceModeColumn(tableId) {
  const id = Number(tableId);
  if (!id) return false;
  const columns = await encryptedDb.getData('user_columns', { table_id: id });
  await renameFaqAudienceColumn(id, columns);
  if ((columns || []).some((c) => c.options?.purpose === 'serviceMode')) {
    return false;
  }
  const { getEncryptionKey } = require('../utils/encryptionUtils');
  const key = getEncryptionKey();
  const maxOrder = (columns || []).reduce((m, c) => Math.max(m, Number(c.order) || 0), 0);
  await query()(
    `INSERT INTO user_columns
       (table_id, name_encrypted, type_encrypted, placeholder_encrypted, "order", placeholder, options)
     VALUES ($1, encrypt_text($2, $7), encrypt_text($3, $7), encrypt_text($6, $7), $4, $5, $8)`,
    [
      id,
      'Слой обслуживания',
      'text',
      maxOrder + 1,
      'serviceMode',
      'serviceMode',
      key,
      JSON.stringify({ purpose: 'serviceMode' })
    ]
  );
  logger.info(`[ragPgvector] FAQ table=${id}: колонка serviceMode создана`);
  return true;
}

async function rebuildFaqTable(tableId) {
  await ensureFaqServiceModeColumn(tableId);
  const chunks = await collectFaqChunks(tableId);
  return replaceSourceChunks('faq', tableId, chunks);
}

async function upsertDocumentChunks({ pageId, chunks }) {
  const ok = await ensureSchema();
  if (!ok) throw new Error('pgvector недоступен');
  await query()(
    `DELETE FROM rag_chunks WHERE source = 'document' AND (row_id = $1 OR row_id LIKE $2)`,
    [String(pageId), `${pageId}_chunk_%`]
  );
  if (!chunks?.length) return { count: 0 };
  const { model, vectors } = await embedTexts(chunks.map((c) => c.text));
  if (vectors.length !== chunks.length) {
    throw new Error(`embed count ${vectors.length} != chunks ${chunks.length}`);
  }
  let count = 0;
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const vec = toVectorLiteral(vectors[i]);
    if (!vec) continue;
    const audience = (chunk.audience_tags || []).map(canonicalAudience).filter(Boolean);
    await query()(
      `INSERT INTO rag_chunks
         (source, table_id, row_id, text, embedding, audience_tags, service_mode, metadata, embedding_model, updated_at)
       VALUES ('document', $1, $2, $3, $4::vector, $5::text[], NULL, $6::jsonb, $7, NOW())
       ON CONFLICT (source, table_id, row_id)
       DO UPDATE SET
         text = EXCLUDED.text,
         embedding = EXCLUDED.embedding,
         audience_tags = EXCLUDED.audience_tags,
         metadata = EXCLUDED.metadata,
         embedding_model = EXCLUDED.embedding_model,
         updated_at = NOW()`,
      [
        Number(pageId) || 0,
        String(chunk.row_id),
        chunk.text,
        vec,
        audience,
        JSON.stringify(chunk.metadata || {}),
        model
      ]
    );
    count += 1;
  }
  logger.info(`[ragPgvector] upsert document page=${pageId}: ${count}`);
  return { count };
}

async function removeDocument(pageId) {
  const ok = await ensureSchema();
  if (!ok) return;
  await query()(
    `DELETE FROM rag_chunks WHERE source = 'document' AND (row_id = $1 OR row_id LIKE $2 OR table_id = $3)`,
    [String(pageId), `${pageId}_chunk_%`, Number(pageId)]
  );
}

function sqlPreFilter(ctx) {
  const guestLike = Boolean(ctx?.isGuest || !ctx?.hasCrmAudience);
  const aud = (ctx?.audienceSlugs || ['public-client']).map(canonicalAudience);
  const mode = (ctx?.modeSlugs || ['sales']).map(canonicalMode);
  const corpus = corpusAudiencesForContext(ctx);
  return { guestLike, aud, mode, corpus };
}

async function assertSearchDimension() {
  const runtime = await embeddingRuntimeService.resolveRuntime();
  const columnDimension = await getEmbeddingColumnDimension();
  if (columnDimension && runtime.dimension && columnDimension !== runtime.dimension) {
    const err = new Error(
      `Embedding dim ${runtime.dimension} ≠ колонка pgvector ${columnDimension}. Пересоберите индекс.`
    );
    err.code = 'embedding_dimension_mismatch';
    throw err;
  }
  return runtime;
}

async function search({ query: userQuery, tableIds = [], ctx, limit = 15 }) {
  const ok = await ensureSchema();
  if (!ok) {
    return { results: [], error: 'pgvector_unavailable' };
  }
  const q = String(userQuery || '').trim();
  if (!q) return { results: [] };

  try {
    await assertSearchDimension();
  } catch (err) {
    if (err.code === 'embedding_dimension_mismatch') {
      logger.warn(`[ragPgvector] search skipped: ${err.message}`);
      return { results: [], error: err.code };
    }
    throw err;
  }

  const { vectors } = await embedTexts([q]);
  const qvec = toVectorLiteral(vectors[0]);
  if (!qvec) return { results: [] };

  const { guestLike, aud, mode, corpus } = sqlPreFilter(ctx);
  const tableFilter = Array.isArray(tableIds) && tableIds.length
    ? tableIds.map(Number).filter((n) => n > 0)
    : null;

  const { rows } = await query()(
    `SELECT source, table_id, row_id, text, audience_tags, service_mode, metadata,
            1 - (embedding <=> $1::vector) AS score
       FROM rag_chunks
      WHERE embedding IS NOT NULL
        AND (
          (
            source = 'faq'
            AND ($5::int[] IS NULL OR table_id = ANY($5::int[]))
            AND (
              ($2::boolean AND audience_tags && $3::text[]
                AND (service_mode IS NULL OR service_mode = ANY($4::text[])))
              OR
              (NOT $2::boolean
                AND (audience_tags = '{}'::text[] OR audience_tags && $3::text[])
                AND (service_mode IS NULL OR service_mode = ANY($4::text[])))
            )
          )
          OR
          (
            source = 'document'
            AND audience_tags && $6::text[]
            AND (
              NOT $2::boolean
              OR NOT (audience_tags && ARRAY['investor-a','investor-b','partner']::text[])
            )
          )
        )
      ORDER BY embedding <=> $1::vector
      LIMIT $7`,
    [qvec, guestLike, aud, mode, tableFilter, corpus, Math.max(5, Math.min(Number(limit) || 15, 50))]
  );

  const results = (rows || [])
    .map((row) => {
      const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
      const hit = {
        source: row.source === 'document' ? 'document' : 'table',
        sourceType: row.source === 'document' ? 'document' : 'table',
        sourceId: row.table_id,
        rowId: row.row_id,
        text: row.text,
        context: metadata.question || metadata.title || metadata.context || '',
        score: Number(row.score) || 0,
        metadata: {
          ...metadata,
          userTags: row.audience_tags || metadata.userTags || [],
          serviceMode: row.service_mode || metadata.serviceMode || null,
          corpus_audience: row.source === 'document' ? (row.audience_tags || []) : metadata.corpus_audience
        }
      };
      if (row.source === 'faq' && !resolveFaqRowVisible({
        audience_tags: row.audience_tags,
        service_mode: row.service_mode
      }, ctx)) {
        return null;
      }
      if (guestLike && looksLikeRestrictedDealText(`${hit.text || ''} ${hit.context || ''}`)) {
        return null;
      }
      if (guestLike && row.source === 'document' && !documentTagsAllowedForGuest(row.audience_tags)) {
        return null;
      }
      return hit;
    })
    .filter(Boolean);

  logger.info(`[ragPgvector] search hits=${results.length} guestLike=${guestLike} aud=${aud.join(',')} hint=${ctx?.ragHint || ''}`);
  return { results };
}

function isDocumentTableId(tableId) {
  const id = String(tableId || '');
  return id === 'legal_docs' || id === 'admin_pages_simple';
}

function toLegacyHit(row) {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  return {
    row_id: row.row_id,
    score: Number(row.score) || 0,
    text: row.text,
    metadata: {
      ...metadata,
      userTags: row.audience_tags || metadata.userTags || [],
      serviceMode: row.service_mode || metadata.serviceMode || null,
      doc_id: metadata.doc_id || (row.source === 'document' ? row.table_id : metadata.doc_id)
    }
  };
}

/**
 * Поиск без ACL гостя — замена FAISS search(tableId, query).
 * Score = cosine similarity (1 - distance), больше = ближе.
 */
async function searchUnfiltered({ query: userQuery, tableId, limit = 15 }) {
  const ok = await ensureSchema();
  if (!ok) return [];
  const q = String(userQuery || '').trim();
  if (!q) return [];
  try {
    await assertSearchDimension();
  } catch (err) {
    if (err.code === 'embedding_dimension_mismatch') {
      logger.warn(`[ragPgvector] searchUnfiltered skipped: ${err.message}`);
      return [];
    }
    throw err;
  }
  const { vectors } = await embedTexts([q]);
  const qvec = toVectorLiteral(vectors[0]);
  if (!qvec) return [];

  const source = isDocumentTableId(tableId) ? 'document' : 'faq';
  const numericId = Number(tableId);
  const tableFilter = source === 'faq' && Number.isFinite(numericId) && numericId > 0
    ? numericId
    : null;

  const { rows } = await query()(
    `SELECT source, table_id, row_id, text, audience_tags, service_mode, metadata,
            1 - (embedding <=> $1::vector) AS score
       FROM rag_chunks
      WHERE embedding IS NOT NULL
        AND source = $2
        AND ($3::int IS NULL OR table_id = $3)
      ORDER BY embedding <=> $1::vector
      LIMIT $4`,
    [qvec, source, tableFilter, Math.max(1, Math.min(Number(limit) || 15, 50))]
  );
  return (rows || []).map(toLegacyHit);
}

async function upsertFaqRows(tableId, rows) {
  const ok = await ensureSchema();
  if (!ok) throw new Error('pgvector недоступен');
  const list = (Array.isArray(rows) ? rows : []).filter(
    (r) => r?.row_id && String(r.text || '').trim()
  );
  if (!list.length) return { count: 0 };
  const { model, vectors } = await embedTexts(list.map((r) => String(r.text || '').trim()));
  let count = 0;
  for (let i = 0; i < list.length; i += 1) {
    const row = list[i];
    const text = String(row.text || '').trim();
    const vec = toVectorLiteral(vectors[i]);
    if (!vec) continue;
    const tags = row.metadata?.userTags || [];
    const split = splitRowTags(Array.isArray(tags) ? tags : parseTagCell(tags));
    await query()(
      `INSERT INTO rag_chunks
         (source, table_id, row_id, text, embedding, audience_tags, service_mode, metadata, embedding_model, updated_at)
       VALUES ('faq', $1, $2, $3, $4::vector, $5::text[], $6, $7::jsonb, $8, NOW())
       ON CONFLICT (source, table_id, row_id)
       DO UPDATE SET
         text = EXCLUDED.text,
         embedding = EXCLUDED.embedding,
         audience_tags = EXCLUDED.audience_tags,
         service_mode = EXCLUDED.service_mode,
         metadata = EXCLUDED.metadata,
         embedding_model = EXCLUDED.embedding_model,
         updated_at = NOW()`,
      [
        Number(tableId),
        String(row.row_id),
        text,
        vec,
        split.audience,
        split.serviceMode || null,
        JSON.stringify(row.metadata || {}),
        model
      ]
    );
    count += 1;
  }
  logger.info(`[ragPgvector] upsert faq table=${tableId}: ${count}`);
  return { count };
}

async function removeFaqRows(tableId, rowIds) {
  const ids = (rowIds || []).map(String).filter(Boolean);
  if (!ids.length) return { count: 0 };
  const ok = await ensureSchema();
  if (!ok) return { count: 0 };
  if (isDocumentTableId(tableId)) {
    await query()(
      `DELETE FROM rag_chunks WHERE source = 'document' AND row_id = ANY($1::text[])`,
      [ids]
    );
  } else {
    await query()(
      `DELETE FROM rag_chunks WHERE source = 'faq' AND table_id = $1 AND row_id = ANY($2::text[])`,
      [Number(tableId), ids]
    );
  }
  return { count: ids.length };
}

async function health() {
  const ok = await ensureSchema();
  if (!ok) {
    return { status: 'error', engine: 'pgvector', error: 'extension unavailable' };
  }
  try {
    const { rows } = await query()(
      `SELECT count(*)::int AS n,
              count(*) FILTER (WHERE source = 'faq')::int AS faq,
              count(*) FILTER (WHERE source = 'document')::int AS documents
         FROM rag_chunks`
    );
    const row = rows[0] || {};
    let runtime = null;
    try {
      runtime = await embeddingRuntimeService.resolveRuntime();
    } catch (_) {
      runtime = null;
    }
    const columnDimension = await getEmbeddingColumnDimension();
    return {
      status: 'ok',
      engine: 'pgvector',
      chunks: row.n || 0,
      faq: row.faq || 0,
      documents: row.documents || 0,
      columnDimension,
      embeddingProvider: runtime?.provider || null,
      embeddingModel: runtime?.model || null,
      embeddingDimension: runtime?.dimension || null
    };
  } catch (err) {
    return { status: 'error', engine: 'pgvector', error: err.message };
  }
}

module.exports = {
  ensureSchema,
  ensureEmbeddingDimension,
  getEmbeddingColumnDimension,
  rebuildFaqTable,
  rebuildPublishedCorpusPages,
  rebuildAllRagIndex,
  upsertDocumentChunks,
  upsertFaqRows,
  removeDocument,
  removeFaqRows,
  search,
  searchUnfiltered,
  collectFaqChunks,
  health
};
