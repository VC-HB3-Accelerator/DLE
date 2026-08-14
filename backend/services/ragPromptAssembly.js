/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Pure helpers for RAG prompt assembly + FAQ tag filter (TZ CORPUS §6a.4a T01–T12).
 */

function buildConversationSummary(history, options = {}) {
  const {
    maxMessages = 10,
    maxChars = 700,
    snippetLength = 160
  } = options;

  if (!Array.isArray(history) || history.length === 0) {
    return null;
  }

  const recentMessages = history.slice(-Math.max(maxMessages, 1));
  const roleLabels = {
    assistant: 'Ассистент',
    system: 'Система',
    tool: 'Инструмент'
  };

  const lines = [];
  let totalLength = 0;

  for (let i = recentMessages.length - 1; i >= 0; i--) {
    const message = recentMessages[i];
    if (!message || typeof message.content !== 'string') {
      continue;
    }

    const roleLabel = roleLabels[message.role] || 'Пользователь';
    let text = message.content.replace(/\s+/g, ' ').trim();
    if (!text) {
      continue;
    }

    if (text.length > snippetLength) {
      text = `${text.slice(0, snippetLength)}...`;
    }

    const line = `${roleLabel}: ${text}`;
    if (totalLength + line.length > maxChars) {
      break;
    }
    lines.unshift(line);
    totalLength += line.length + 1;
  }

  if (!lines.length) return null;
  return lines.join('\n');
}

/**
 * User-prompt body for generateLLMResponse (без system rules / placeholders).
 * T01/T02/T06/T07/T08: facts from answer / multiSource / memory.
 */
function assembleGenerateUserPrompt({
  userQuestion,
  answer = null,
  context = null,
  product = null,
  priority = null,
  date = null,
  userTags = null,
  multiSourceResults = null,
  conversationMemory = null,
  history = null,
  snippetLimit = 300,
  generateIfNoRag = false
} = {}) {
  const memoryText = conversationMemory
    ? String(conversationMemory).trim()
    : buildConversationSummary(history, {
      maxMessages: 12,
      maxChars: 700,
      snippetLength: 160
    });

  const memoryBlock = memoryText
    ? `Память диалога:\n${memoryText}\n\n`
    : '';

  let prompt = '';

  if (multiSourceResults && multiSourceResults.results && multiSourceResults.results.length > 0) {
    const sourcesInfo = multiSourceResults.results
      .slice(0, 3)
      .map((r, idx) => {
        const sourceName = r.sourceType === 'table'
          ? 'База знаний'
          : `Документ: ${r.metadata?.title || r.context || 'Без названия'}`;
        const fallbackText = (r.metadata?.answer && String(r.metadata.answer).trim())
          || (r.metadata?.title && String(r.metadata.title).trim())
          || '(текст отсутствует)';
        const sourceText = (r.text && r.text.trim()) || fallbackText;
        const truncatedText = sourceText.length > snippetLimit
          ? `${sourceText.slice(0, snippetLimit)}...`
          : sourceText;
        const contextPart = r.context ? `\nКонтекст: ${r.context}` : '';
        return `[Источник ${idx + 1}: ${sourceName}]\n${truncatedText}${contextPart}`;
      })
      .join('\n\n---\n\n');

    prompt = `${memoryBlock}База знаний содержит следующую информацию из разных источников:\n\n${sourcesInfo}\n\nВопрос пользователя: ${userQuestion}\n\nТы консультант в живом чате, не киоск документов. Используй факты из источников как якоря (цифры, определения), но отвечай своими словами: кратко, по делу, под аудиторию. Задай один уточняющий вопрос или предложи следующий шаг (боль → решение). Не вываливай сырой текст источников целиком. Не выдумывай цифры и условия, которых нет в источниках.\nЖЁСТКИЙ ЗАПРЕТ: ask раунда, %, доля инвестора, токены 8500, $8.5M/$1.9M/$6.6M/«8,5 млн» — только если есть ДОСЛОВНО в источниках выше. Иначе не угадывай: уточни роль или скажи, что условия сделки — с командой после квалификации. Не переводи USD→RUB от себя.`;
  } else if (answer) {
    prompt = `${memoryBlock}Факт из базы знаний (якорь, не готовый ответ клиенту):\n"${answer}"\n\nВопрос пользователя: ${userQuestion}\n\nСформулируй персональный ответ в диалоге: опирайся на факт, не копируй его слепо, при необходимости задай уточнение или предложи следующий шаг. Не выдумывай то, чего нет в факте.\nЖЁСТКИЙ ЗАПРЕТ: не называй ask/%/долю/8500/$8.5M и т.п., если их нет в факте выше.`;
  }

  if (!prompt) {
    prompt = `${memoryBlock}Вопрос пользователя: ${userQuestion}`;
  }

  const hasRag = Boolean(answer)
    || Boolean(multiSourceResults && multiSourceResults.results && multiSourceResults.results.length > 0);

  if (!hasRag) {
    if (generateIfNoRag) {
      prompt += `\n\nДополнительно: база знаний пуста по этому вопросу; ответь по общим инструкциям (generateIfNoRag=true).`;
    } else {
      prompt += `\n\nДополнительно: если в контексте нет фактов по вопросу — не придумывай. Ответь обычным связным текстом на русском по системным инструкциям, без JSON, без кавычек вокруг всего ответа, без иероглифов и латиницы внутри русских слов.\nЖЁСТКИЙ ЗАПРЕТ: не выдумывай ask раунда, проценты доли, суммы инвестиций ($8.5M, 25%, 8500 и т.п.). На вопрос про ask/долю без фактов — уточни роль (клиент/партнёр/инвестор) или скажи, что детали сделки обсуждаются с командой.`;
    }
  }

  if (context && !multiSourceResults) {
    prompt += `\n\nДополнительный контекст: ${context}`;
  }

  if (product) {
    prompt += `\n\nПродукт: ${product}`;
  }

  if (priority) {
    prompt += `\n\nПриоритет: ${priority}`;
  }

  if (date) {
    prompt += `\n\nДата: ${date}`;
  }

  if (userTags && Array.isArray(userTags) && userTags.length > 0) {
    prompt += `\n\nТеги пользователя: ${userTags.join(', ')}`;
  }

  return prompt;
}

/**
 * T03: FAQ/table hits с userTags — юзер без пересечения тегов не видит строку.
 * Документы (pages) пропускаем как есть.
 * @returns {{ results: Array, emptied: boolean }}
 */
function filterHitsByAssignTags(results, assignTagNames) {
  if (!Array.isArray(results) || !results.length) {
    return { results: results || [], emptied: false };
  }
  if (!Array.isArray(assignTagNames) || !assignTagNames.length) {
    return { results, emptied: false };
  }

  const wanted = new Set(assignTagNames.map((t) => String(t).toLowerCase()));
  const filtered = results.filter((r) => {
    if (r.sourceType === 'document' || r.source === 'document' || r.source === 'documents') {
      return true;
    }
    const rowTags = r.metadata?.userTags || r.userTags || [];
    if (!Array.isArray(rowTags) || !rowTags.length) return false;
    return rowTags.some((t) => wanted.has(String(t).toLowerCase()));
  });

  if (filtered.length) {
    return { results: filtered, emptied: false };
  }
  // как в ai-assistant: опустошение → оставляем исходные hit(s)
  return { results, emptied: true };
}

/**
 * Строка имеет ли тег-пересечение с профилем пользователя (жёсткий фильтр для unit T03).
 */
function rowVisibleForUserTags(rowTags, userTagNames) {
  const tags = Array.isArray(rowTags) ? rowTags : [];
  if (!tags.length) return true; // публичная строка без ACL-тегов
  const user = Array.isArray(userTagNames) ? userTagNames.map((t) => String(t).toLowerCase()) : [];
  if (!user.length) return false;
  const wanted = new Set(user);
  return tags.some((t) => wanted.has(String(t).toLowerCase()));
}

module.exports = {
  buildConversationSummary,
  assembleGenerateUserPrompt,
  filterHitsByAssignTags,
  rowVisibleForUserTags
};
