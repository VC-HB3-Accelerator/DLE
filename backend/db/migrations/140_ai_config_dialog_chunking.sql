-- UP: dialog_settings + chunking_settings for RAG & runtime page (TZ_AI_RAG_SETTINGS_PAGE)
ALTER TABLE ai_config
  ADD COLUMN IF NOT EXISTS dialog_settings JSONB NOT NULL DEFAULT '{
    "historyTurns": 4,
    "ragSnippetLength": 300,
    "memorySnippetLength": 160,
    "docSnippetLength": 350,
    "memoryMaxChars": 900,
    "compressEvery": 4,
    "minCyrillicPercent": 10,
    "maxMessageLength": 10000,
    "languages": ["ru"]
  }'::jsonb;

ALTER TABLE ai_config
  ADD COLUMN IF NOT EXISTS chunking_settings JSONB NOT NULL DEFAULT '{
    "maxChunkSize": 1500,
    "overlap": 200,
    "llmThreshold": 8000,
    "semanticMaxChunkSize": 1000,
    "semanticMinChunkSize": 100
  }'::jsonb;

-- Ensure searchInDocuments exists in rag_behavior without wiping other keys
UPDATE ai_config
SET rag_behavior = COALESCE(rag_behavior, '{}'::jsonb) || '{"searchInDocuments": true}'::jsonb
WHERE id = 1
  AND (rag_behavior IS NULL OR NOT (rag_behavior ? 'searchInDocuments'));

COMMENT ON COLUMN ai_config.dialog_settings IS 'Диалог/память/язык: historyTurns, snippets, memory, RU-filter';
COMMENT ON COLUMN ai_config.chunking_settings IS 'Чанкинг pages: maxChunkSize, overlap, llmThreshold';

-- DOWN
-- ALTER TABLE ai_config DROP COLUMN IF EXISTS dialog_settings;
-- ALTER TABLE ai_config DROP COLUMN IF EXISTS chunking_settings;
