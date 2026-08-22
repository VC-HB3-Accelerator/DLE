/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Самообновляемая память диалога.
 * Каждый ход: быстрая эвристическая склейка (без обхода AIQueue).
 * Каждые COMPRESS_EVERY ходов: сжатие через AIQueue (низкий приоритет по факту FIFO после чата).
 */

const logger = require('../utils/logger');
const ollamaConfig = require('./ollamaConfig');
const { sanitizeAssistantText } = require('../utils/assistantTextSanitizer');

const MAX_SUMMARY_CHARS_DEFAULT = 900;
const COMPRESS_EVERY_DEFAULT = 4;

async function getMemoryLimits() {
  let maxChars = MAX_SUMMARY_CHARS_DEFAULT;
  let compressEvery = COMPRESS_EVERY_DEFAULT;
  try {
    const aiConfigService = require('./aiConfigService');
    const dialog = await aiConfigService.getDialogSettings();
    if (dialog) {
      if (Number(dialog.memoryMaxChars) > 0) maxChars = Number(dialog.memoryMaxChars);
      if (Number(dialog.compressEvery) > 0) compressEvery = Number(dialog.compressEvery);
    }
  } catch (_) { /* defaults */ }
  return { maxChars, compressEvery };
}

let schemaReady = false;
/** @type {Map<string, Array<{userMessage: string, assistantMessage: string}>>} */
const turnBuffers = new Map();
/** @type {Set<string>} */
const processingKeys = new Set();
/** @type {Set<string>} */
const compressingKeys = new Set();

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
        crm_audience TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await query(`ALTER TABLE conversation_memory ADD COLUMN IF NOT EXISTS crm_audience TEXT NOT NULL DEFAULT ''`);
    schemaReady = true;
  } catch (error) {
    logger.warn('[conversationMemory] Не удалось создать таблицу:', error.message);
  }
}

/** @type {Map<string, string>} */
const audienceByKey = new Map();

async function resetIfAudienceChanged(memoryKey, audienceKey) {
  if (!memoryKey) return false;
  const next = audienceKey == null ? '' : String(audienceKey);
  audienceByKey.set(memoryKey, next);
  await ensureSchema();
  try {
    const db = require('../db');
    const query = db.getQuery();
    const { rows } = await query(
      'SELECT crm_audience FROM conversation_memory WHERE memory_key = $1',
      [memoryKey]
    );
    if (!rows[0]) return false;
    const prev = rows[0].crm_audience == null ? '' : String(rows[0].crm_audience);
    if (prev === next) return false;
    await query(
      `UPDATE conversation_memory
          SET summary_text = '', turn_count = 0, crm_audience = $2, updated_at = NOW()
        WHERE memory_key = $1`,
      [memoryKey, next]
    );
    turnBuffers.delete(memoryKey);
    logger.info(`[conversationMemory] Сброс памяти ${memoryKey}: audience ${prev || '∅'} → ${next || '∅'}`);
    return true;
  } catch (error) {
    logger.warn('[conversationMemory] Ошибка сброса памяти по audience:', error.message);
    return false;
  }
}

async function getSummary(memoryKey) {
  if (!memoryKey) return null;
  await ensureSchema();
  try {
    const db = require('../db');
    const query = db.getQuery();
    const { rows } = await query(
      'SELECT summary_text, turn_count FROM conversation_memory WHERE memory_key = $1',
      [memoryKey]
    );
    if (!rows[0]) return null;
    const text = rows[0].summary_text ? String(rows[0].summary_text).trim() : '';
    return text
      ? { text, turnCount: Number(rows[0].turn_count) || 0 }
      : { text: null, turnCount: Number(rows[0].turn_count) || 0 };
  } catch (error) {
    logger.warn('[conversationMemory] Ошибка чтения памяти:', error.message);
    return null;
  }
}

async function getSummaryText(memoryKey) {
  const row = await getSummary(memoryKey);
  return row?.text || null;
}

function heuristicMerge({ previousSummary, userMessage, assistantMessage, maxChars = MAX_SUMMARY_CHARS_DEFAULT }) {
  const prev = String(previousSummary || '').trim();
  const user = String(userMessage || '').replace(/\s+/g, ' ').trim().slice(0, 220);
  const assistant = String(assistantMessage || '').replace(/\s+/g, ' ').trim().slice(0, 280);
  const chunk = [
    user ? `Пользователь: ${user}` : null,
    assistant ? `Ассистент: ${assistant}` : null
  ].filter(Boolean).join('\n');

  let merged = prev ? `${prev}\n${chunk}` : chunk;
  if (merged.length > maxChars) {
    merged = merged.slice(merged.length - maxChars);
    const cut = merged.indexOf('\n');
    if (cut > 0 && cut < 120) merged = merged.slice(cut + 1);
  }
  return merged.trim();
}

async function saveSummary(memoryKey, summaryText, incrementTurn = true) {
  await ensureSchema();
  const db = require('../db');
  const query = db.getQuery();
  const text = String(summaryText || '').trim();
  if (!text) return null;

  const { rows } = await query(
    `INSERT INTO conversation_memory (memory_key, summary_text, turn_count, crm_audience, updated_at)
     VALUES ($1, $2, 1, $4, NOW())
     ON CONFLICT (memory_key) DO UPDATE SET
       summary_text = EXCLUDED.summary_text,
       turn_count = conversation_memory.turn_count + CASE WHEN $3 THEN 1 ELSE 0 END,
       crm_audience = EXCLUDED.crm_audience,
       updated_at = NOW()
     RETURNING turn_count`,
    [memoryKey, text, incrementTurn, audienceByKey.get(memoryKey) || '']
  );
  return Number(rows[0]?.turn_count) || 0;
}

async function saveSummaryIfTurnUnchanged(memoryKey, summaryText, expectedTurnCount) {
  await ensureSchema();
  const db = require('../db');
  const query = db.getQuery();
  const text = String(summaryText || '').trim();
  if (!text || !Number.isFinite(Number(expectedTurnCount))) return null;

  const { rows } = await query(
    `UPDATE conversation_memory
     SET summary_text = $2, updated_at = NOW()
     WHERE memory_key = $1 AND turn_count = $3
     RETURNING turn_count`,
    [memoryKey, text, Number(expectedTurnCount)]
  );
  return rows[0] ? Number(rows[0].turn_count) : null;
}

async function compressViaQueue(memoryKey, currentSummary, expectedTurnCount) {
  if (!currentSummary) return null;
  if (compressingKeys.has(memoryKey)) {
    logger.info(`[conversationMemory] Сжатие уже идёт для ${memoryKey}, пропуск`);
    return null;
  }
  compressingKeys.add(memoryKey);

  const aiQueue = require('./ai-queue');
  const { PRIORITY } = require('./ai-queue');
  let model = await ollamaConfig.getDefaultModelAsync();
  const { resolveOllamaChatModel } = require('../utils/ollamaChatDefaults');
  model = resolveOllamaChatModel(model);
  if (!model) {
    logger.info('[conversationMemory] Нет локальной чат-модели Ollama — сжатие пропущено');
    compressingKeys.delete(memoryKey);
    return null;
  }

  const { maxChars } = await getMemoryLimits();
  const prompt = `Сожми память диалога до ${maxChars} символов на русском.
Сохрани факты: имя, цели, договорённости, открытые вопросы. Убери повторы и шум.
Не выдумывай. Ответ — только текст памяти, без JSON и кавычек.

Память:
${currentSummary}`;

  try {
    const result = await aiQueue.addTask({
      messages: [{ role: 'user', content: prompt }],
      model,
      llmParameters: {
        temperature: 0.1,
        maxTokens: 280,
        top_p: 0.9,
        top_k: 40,
        repeat_penalty: 1.1
      },
      qwenParameters: { format: null },
      returnFullResponse: false,
      priority: PRIORITY.MEMORY
    });

    let text = sanitizeAssistantText(typeof result === 'string' ? result : result?.response);
    if (!text) return null;
    if (text.length > maxChars) {
      text = text.slice(0, maxChars).trim();
    }

    const savedTurn = await saveSummaryIfTurnUnchanged(memoryKey, text, expectedTurnCount);
    if (!savedTurn) {
      logger.info(
        `[conversationMemory] Сжатие отброшено (память уже обновилась): ${memoryKey}, ожидали turn=${expectedTurnCount}`
      );
      return null;
    }
    logger.info(`[conversationMemory] Сжатие через AIQueue: ${memoryKey}, ${text.length} симв.`);
    return text;
  } catch (error) {
    logger.warn(`[conversationMemory] Сжатие через очередь пропущено: ${error.message}`);
    return null;
  } finally {
    compressingKeys.delete(memoryKey);
  }
}

async function processBuffer(memoryKey) {
  if (processingKeys.has(memoryKey)) return;
  processingKeys.add(memoryKey);

  try {
    while (true) {
      const buffer = turnBuffers.get(memoryKey) || [];
      if (!buffer.length) break;
      const turn = buffer.shift();
      turnBuffers.set(memoryKey, buffer);

      // Всегда свежая память из БД — без устаревшего snapshot
      const current = await getSummary(memoryKey);
      const previousText = current?.text || null;
      const { maxChars, compressEvery } = await getMemoryLimits();
      const nextSummary = heuristicMerge({
        previousSummary: previousText,
        userMessage: turn.userMessage,
        assistantMessage: turn.assistantMessage,
        maxChars
      });

      const turnCount = await saveSummary(memoryKey, nextSummary, true);
      logger.info(`[conversationMemory] Память обновлена (эвристика): ${memoryKey}, ход ${turnCount}, ${nextSummary.length} симв.`);

      if (turnCount > 0 && turnCount % compressEvery === 0) {
        // Не ждём сжатие; пишем только если turn_count не ушёл вперёд
        compressViaQueue(memoryKey, nextSummary, turnCount).catch((error) => {
          logger.warn(`[conversationMemory] Фоновое сжатие: ${error.message}`);
        });
      }
    }
  } catch (error) {
    logger.warn('[conversationMemory] Ошибка обработки буфера:', error.message);
  } finally {
    processingKeys.delete(memoryKey);
    // Если за время обработки добавили ещё ходы
    if ((turnBuffers.get(memoryKey) || []).length > 0) {
      setImmediate(() => processBuffer(memoryKey));
    }
  }
}

/**
 * Фоново обновляет память после ответа ассистента.
 * Ходы не теряются при быстрых сообщениях — складываются в буфер.
 */
function scheduleUpdate({ memoryKey, userMessage, assistantMessage }) {
  if (!memoryKey || !userMessage || !assistantMessage) return;

  const buffer = turnBuffers.get(memoryKey) || [];
  buffer.push({
    userMessage: String(userMessage),
    assistantMessage: String(assistantMessage)
  });
  // Ограничиваем хвост, чтобы не раздувать при спаме
  if (buffer.length > 20) {
    buffer.splice(0, buffer.length - 20);
  }
  turnBuffers.set(memoryKey, buffer);

  setImmediate(() => processBuffer(memoryKey));
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
           ELSE left(conversation_memory.summary_text || E'\\n' || EXCLUDED.summary_text, ${MAX_SUMMARY_CHARS_DEFAULT})
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
  getSummary: getSummaryText,
  resetIfAudienceChanged,
  scheduleUpdate,
  migrateGuestToUser,
  ensureSchema
};
