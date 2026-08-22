/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Бюджет входа RAG = окно модели минус ответ, не произвольные 300/1200 символов.
 * Оценка токенов грубая (RU/EN смесь ≈ 2 символа/токен) — лучше недобрать, чем получить 400.
 */

const DEFAULT_WINDOW = 32768;
const DEFAULT_OUTPUT_RESERVE = 4096;
const SAFETY_RATIO = 0.9;

function modelKey(name) {
  return String(name || '').trim().toLowerCase();
}

/**
 * Известные окна (токены входа+выхода). Не выдумывать сверх документации:
 * Qwen3 native 32k, extendable 131k; Omni realtime держим на native 32k.
 */
function contextWindowTokens(modelName) {
  const n = modelKey(modelName);
  if (!n) return DEFAULT_WINDOW;
  if (n.includes('omni') && n.includes('realtime')) return 32768;
  if (n.includes('qwen3.8') || n.includes('qwen3-max') || n === 'qwen-max') return 131072;
  if (n.includes('qwen3') || n.startsWith('qwen')) return 32768;
  if (n.startsWith('deepseek')) return 65536;
  if (n.startsWith('gpt-5') || n.startsWith('gpt-4.1') || n.startsWith('gpt-4o')) return 128000;
  if (n.includes(':0.5b') || n.includes(':1.5b') || n.includes(':3b')) return 8192;
  if (n.includes(':7b') || n.includes(':8b')) return 32768;
  return DEFAULT_WINDOW;
}

function estimateTokens(text) {
  const chars = String(text || '').length;
  if (!chars) return 0;
  return Math.ceil(chars / 2);
}

function tokensToChars(tokens) {
  const n = Number(tokens);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n * 2);
}

/**
 * Сколько символов можно отдать RAG+user после system/history/ответа.
 */
function ragInputBudgetChars({
  model,
  outputTokens,
  usedChars = 0
} = {}) {
  const window = contextWindowTokens(model);
  const out = Math.max(
    256,
    Number(outputTokens) > 0 ? Number(outputTokens) : DEFAULT_OUTPUT_RESERVE
  );
  const reserved = out + 512;
  const availableTokens = Math.floor(window * SAFETY_RATIO) - reserved - estimateTokens(usedChars);
  return Math.max(4000, tokensToChars(availableTokens));
}

module.exports = {
  DEFAULT_WINDOW,
  contextWindowTokens,
  estimateTokens,
  tokensToChars,
  ragInputBudgetChars
};
