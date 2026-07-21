/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Самообновляемая память диалога: краткая сводка на ключ user:/guest:,
 * читается перед ответом и обновляется после ответа ассистента (в фоне).
 */

const axios = require('axios');
const logger = require('../utils/logger');
const ollamaConfig = require('./ollamaConfig');
const { sanitizeAssistantText } = require('../utils/assistantTextSanitizer');

const MAX_SUMMARY_CHARS = 900;
const UPDATE_TIMEOUT_MS = 25000;

let schemaReady = false;
const pendingUpdates = new Set();

function buildMemoryKey({ userId = null, guestIdentifier = null } = {}) {
  if (userId != null && Number.isFinite(Number(userId))) {
    return `user:${Number(userId)}`;
  }
  if (guestIdentifier) {
    return `guest:${String(guestIdentifier).trim()}`;
  }
  return null;
}

async function ensureSchema() {
  if (schemaReady) return;
  try {
    const db = require('../db');
    const query = db.getQuery();
    await query(`
      CREATE TABLE IF NOT EXISTS conversation_memory (
        memory_key TEXT PRIMARY KEY,
        summary_text TEXT NOT NULL DEFAULT '',
        turn_count INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    schemaReady = true;
  } catch (error) {
    logger.warn('[conversationMemory] Не удалось создать таблицу:', error.message);
  }
}

async function getSummary(memoryKey) {
  if (!memoryKey) return null;
  await ensureSchema();
  try {
    const db = require('../db');
    const query = db.getQuery();
    const { rows } = await query(
      'SELECT summary_text FROM conversation_memory WHERE memory_key = $1',
      [memoryKey]
    );
    const text = rows[0]?.summary_text ? String(rows[0].summary_text).trim() : '';
    return text || null;
  } catch (error) {
    logger.warn('[conversationMemory] Ошибка чтения памяти:', error.message);
    return null;
  }
}

function heuristicMerge({ previousSummary, userMessage, assistantMessage }) {
  const prev = String(previousSummary || '').trim();
  const user = String(userMessage || '').replace(/\s+/g, ' ').trim().slice(0, 220);
  const assistant = String(assistantMessage || '').replace(/\s+/g, ' ').trim().slice(0, 280);
  const chunk = [
    user ? `Пользователь: ${user}` : null,
    assistant ? `Ассистент: ${assistant}` : null
  ].filter(Boolean).join('\n');

  let merged = prev ? `${prev}\n${chunk}` : chunk;
  if (merged.length > MAX_SUMMARY_CHARS) {
    merged = merged.slice(merged.length - MAX_SUMMARY_CHARS);
    const cut = merged.indexOf('\n');
    if (cut > 0 && cut < 120) merged = merged.slice(cut + 1);
  }
  return merged.trim();
}

async function summarizeWithLlm({ previousSummary, userMessage, assistantMessage }) {
  const ollamaUrl = await ollamaConfig.getBaseUrlAsync();
  let model = await ollamaConfig.getDefaultModelAsync();
  if (!model || model === 'qwen2.5' || !String(model).includes(':')) {
    model = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';
  }

  const prompt = `Обнови краткую память диалога на русском языке (не больше ${MAX_SUMMARY_CHARS} символов).

Предыдущая память:
${previousSummary || '(пусто)'}

Новый обмен:
Пользователь: ${String(userMessage || '').slice(0, 500)}
Ассистент: ${String(assistantMessage || '').slice(0, 700)}

Правила:
- Сохрани важные факты: имя, цели, договорённости, открытые вопросы, предпочтения.
- Убери шум, повторы и служебный JSON.
- Не выдумывай факты, которых не было в памяти или в новом обмене.
- Ответ — только текст обновлённой памяти, без кавычек и без JSON.`;

  const response = await axios.post(`${ollamaUrl}/api/chat`, {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    num_predict: 280,
    stream: false
  }, { timeout: UPDATE_TIMEOUT_MS });

  const raw = response.data?.message?.content || '';
  let text = sanitizeAssistantText(raw);
  if (!text) {
    throw new Error('empty summary from LLM');
  }
  if (text.length > MAX_SUMMARY_CHARS) {
    text = text.slice(0, MAX_SUMMARY_CHARS).trim();
  }
  return text;
}

async function saveSummary(memoryKey, summaryText, incrementTurn = true) {
  await ensureSchema();
  const db = require('../db');
  const query = db.getQuery();
  const text = String(summaryText || '').trim();
  if (!text) return;

  await query(
    `INSERT INTO conversation_memory (memory_key, summary_text, turn_count, updated_at)
     VALUES ($1, $2, 1, NOW())
     ON CONFLICT (memory_key) DO UPDATE SET
       summary_text = EXCLUDED.summary_text,
       turn_count = conversation_memory.turn_count + CASE WHEN $3 THEN 1 ELSE 0 END,
       updated_at = NOW()`,
    [memoryKey, text, incrementTurn]
  );
}

/**
 * Фоново обновляет память после ответа ассистента (не блокирует ответ пользователю).
 */
function scheduleUpdate({ memoryKey, previousSummary, userMessage, assistantMessage }) {
  if (!memoryKey || !userMessage || !assistantMessage) return;
  if (pendingUpdates.has(memoryKey)) {
    logger.debug(`[conversationMemory] Пропуск: уже идёт обновление для ${memoryKey}`);
    return;
  }

  pendingUpdates.add(memoryKey);
  setImmediate(async () => {
    try {
      let nextSummary;
      try {
        nextSummary = await summarizeWithLlm({
          previousSummary,
          userMessage,
          assistantMessage
        });
      } catch (llmError) {
        logger.warn(`[conversationMemory] LLM-сводка не удалась (${llmError.message}), эвристика`);
        nextSummary = heuristicMerge({
          previousSummary,
          userMessage,
          assistantMessage
        });
      }

      await saveSummary(memoryKey, nextSummary, true);
      logger.info(`[conversationMemory] Память обновлена: ${memoryKey}, ${nextSummary.length} симв.`);
    } catch (error) {
      logger.warn('[conversationMemory] Ошибка фонового обновления:', error.message);
    } finally {
      pendingUpdates.delete(memoryKey);
    }
  });
}

async function migrateGuestToUser(guestIdentifier, userId) {
  const fromKey = buildMemoryKey({ guestIdentifier });
  const toKey = buildMemoryKey({ userId });
  if (!fromKey || !toKey) return;

  await ensureSchema();
  try {
    const db = require('../db');
    const query = db.getQuery();
    const { rows } = await query(
      'SELECT summary_text, turn_count FROM conversation_memory WHERE memory_key = $1',
      [fromKey]
    );
    if (!rows[0]?.summary_text) return;

    await query(
      `INSERT INTO conversation_memory (memory_key, summary_text, turn_count, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (memory_key) DO UPDATE SET
         summary_text = CASE
           WHEN conversation_memory.summary_text IS NULL OR conversation_memory.summary_text = ''
           THEN EXCLUDED.summary_text
           ELSE conversation_memory.summary_text || E'\\n' || EXCLUDED.summary_text
         END,
         turn_count = conversation_memory.turn_count + EXCLUDED.turn_count,
         updated_at = NOW()`,
      [toKey, rows[0].summary_text, rows[0].turn_count || 1]
    );
    await query('DELETE FROM conversation_memory WHERE memory_key = $1', [fromKey]);
    logger.info(`[conversationMemory] Память гостя перенесена ${fromKey} → ${toKey}`);
  } catch (error) {
    logger.warn('[conversationMemory] Ошибка миграции памяти гостя:', error.message);
  }
}

module.exports = {
  buildMemoryKey,
  getSummary,
  scheduleUpdate,
  migrateGuestToUser,
  ensureSchema
};
