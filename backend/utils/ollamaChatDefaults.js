/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * qwen2.5:1.5b снята: слишком слабая для чата/памяти, не seed и не fallback.
 */

const REMOVED_OLLAMA_CHAT_MODELS = new Set([
  'qwen2.5:1.5b',
  'qwen2.5:1.5b:latest'
]);

function normalizeOllamaModelKey(name) {
  return String(name || '').trim().toLowerCase().replace(/:latest$/i, '');
}

function isRemovedOllamaChatModel(name) {
  const raw = String(name || '').trim();
  if (!raw) return false;
  const key = normalizeOllamaModelKey(raw);
  return REMOVED_OLLAMA_CHAT_MODELS.has(raw)
    || REMOVED_OLLAMA_CHAT_MODELS.has(key)
    || key === 'qwen2.5:1.5b';
}

/**
 * Чат-модель Ollama: ENV/БД, но не снятая 1.5b.
 * Пустая строка = локальной чат-модели нет (чат идёт в cloud, эмбеддинги отдельно).
 */
function resolveOllamaChatModel(name, envFallback = process.env.OLLAMA_MODEL) {
  const raw = String(name || envFallback || '').trim();
  if (!raw || isRemovedOllamaChatModel(raw)) return '';
  if (raw === 'qwen2.5' || normalizeOllamaModelKey(raw) === 'qwen2.5') return '';
  return raw;
}

module.exports = {
  REMOVED_OLLAMA_CHAT_MODELS,
  isRemovedOllamaChatModel,
  resolveOllamaChatModel
};
