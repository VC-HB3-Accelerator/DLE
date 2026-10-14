-- UP Migration
-- Единый индекс retrieval для FAQ + documents (ТЗ §4.7).
-- Требует образ Postgres с pgvector (pgvector/pgvector:pg16).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_chunks (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  table_id INTEGER,
  row_id TEXT NOT NULL,
  text TEXT NOT NULL,
  embedding vector(1024),
  audience_tags TEXT[] NOT NULL DEFAULT '{}',
  service_mode TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding_model TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rag_chunks_source_chk CHECK (source IN ('faq', 'document')),
  CONSTRAINT rag_chunks_unique UNIQUE (source, table_id, row_id)
);

CREATE INDEX IF NOT EXISTS rag_chunks_source_idx ON rag_chunks (source);
CREATE INDEX IF NOT EXISTS rag_chunks_audience_gin ON rag_chunks USING GIN (audience_tags);
CREATE INDEX IF NOT EXISTS rag_chunks_mode_idx ON rag_chunks (service_mode);

-- DOWN Migration
DROP INDEX IF EXISTS rag_chunks_mode_idx;
DROP INDEX IF EXISTS rag_chunks_audience_gin;
DROP INDEX IF EXISTS rag_chunks_source_idx;
DROP TABLE IF EXISTS rag_chunks;
