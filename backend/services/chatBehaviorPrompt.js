/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Pure helpers: блок «Настройки поведения чата» для system prompt.
 * Держит формулировку глоссария в одном месте (не раздувать ragService).
 */

/** Речь по глоссарию — тот же смысл, что forbid_abbreviations у голоса. */
const GLOSSARY_SPEECH_RULE =
  'Термины бери из справки базы знаний (глоссарий): в ответе клиенту только формулировки «Говорить клиенту». '
  + 'Жёсткий запрет в тексте ответа клиенту: DLE, ОС, «ОС DLE», «операционная система DLE», AI, ИИ, RAG, FAQ, EVM, IT, ask, DEAL, B2B и аналоги. '
  + 'Даже если ярлык есть в источнике, в заголовке вопроса или в памяти — не копируй: пиши полную формулировку глоссария '
  + '(для продукта: «операционная система для программного управления бизнесом»). '
  + 'Официальное имя «VC HB3 Accelerator» оставляй как в корпусе.';

/**
 * @param {object} behavior — уже нормализованные настройки (normalizeBehaviorSettings)
 * @returns {string[]}
 */
function buildChatBehaviorPromptLines(behavior = {}) {
  const b = behavior && typeof behavior === 'object' ? behavior : {};
  return [
    b.tone === 'warm'
      ? 'Тон чата: тёплый и поддерживающий, но без фамильярности.'
      : b.tone === 'neutral'
        ? 'Тон чата: нейтральный и спокойный.'
        : 'Тон чата: деловой, уважительный и собранный.',
    b.response_length === 'short'
      ? 'Длина ответа по умолчанию: коротко и по сути.'
      : b.response_length === 'detailed'
        ? 'Длина ответа по умолчанию: подробно, но структурированно и без воды.'
        : 'Длина ответа по умолчанию: сбалансированно, сначала краткий ответ, затем детали при необходимости.',
    b.formality === 'strict'
      ? 'Формальность: строго профессиональная.'
      : b.formality === 'soft'
        ? 'Формальность: мягкая и вежливая.'
        : 'Формальность: обычная деловая.',
    b.adapt_to_user
      ? 'Подстраивай сложность ответа под пользователя уважительно.'
      : 'Сохраняй единый стабильный стиль ответа и не зеркаль манеру пользователя.',
    b.explanation_level_default === 'plain'
      ? 'Уровень объяснения по умолчанию: простой, без лишнего жаргона.'
      : b.explanation_level_default === 'expert'
        ? 'Уровень объяснения по умолчанию: экспертный, но понятный.'
        : b.explanation_level_default === 'balanced'
          ? 'Уровень объяснения по умолчанию: сбалансированный.'
          : 'Уровень объяснения по умолчанию: автоматический, по уровню запроса пользователя.',
    b.allow_gentle_rephrase_offer
      ? 'Если видишь непонимание, можно мягко предложить объяснить проще или на примере.'
      : '',
    b.avoid_jargon_by_default ? GLOSSARY_SPEECH_RULE : '',
    b.quality_over_speed
      ? 'Качество ответа важнее скорости. Если точных данных недостаточно, не выдумывай.'
      : 'Старайся отвечать компактно без лишней паузы, но не выдумывай факты.',
    b.fallback_if_not_confident === 'chat'
      ? 'Если точного ответа нет, предложи продолжить общение в чате.'
      : b.fallback_if_not_confident === 'staff'
        ? 'Если точного ответа нет, предложи перевод на сотрудника.'
        : 'Если точного ответа нет, предложи либо продолжить в чате, либо обратиться к сотруднику.',
    b.forbid_vulgar_tone ? 'Вульгарный или грубый тон запрещён.' : '',
    b.forbid_patronizing_tone ? 'Снисходительный тон запрещён.' : '',
    b.forbid_slang_mirroring ? 'Не зеркаль сленг, ошибки или грубость пользователя.' : ''
  ].filter(Boolean);
}

/**
 * @param {object} behavior
 * @returns {string} пустая строка, если нечего добавить
 */
function buildChatBehaviorPromptBlock(behavior) {
  const lines = buildChatBehaviorPromptLines(behavior);
  if (!lines.length) return '';
  return `Настройки поведения чата:\n${lines.join('\n')}`;
}

module.exports = {
  GLOSSARY_SPEECH_RULE,
  buildChatBehaviorPromptLines,
  buildChatBehaviorPromptBlock
};
