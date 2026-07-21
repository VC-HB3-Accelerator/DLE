/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Очистка пользовательских ответов ассистента от JSON-обёрток,
 * лишних кавычек, иероглифов и латиницы внутри русских слов.
 */

const CJK_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;

/** Латинские буквы, визуально похожие на кириллицу */
const LATIN_LOOKALIKES = {
  A: 'А',
  a: 'а',
  B: 'В',
  E: 'Е',
  e: 'е',
  K: 'К',
  M: 'М',
  H: 'Н',
  O: 'О',
  o: 'о',
  P: 'Р',
  p: 'р',
  C: 'С',
  c: 'с',
  T: 'Т',
  X: 'Х',
  x: 'х',
  y: 'у'
};

function replaceLatinLookalikesInCyrillicWords(text) {
  return String(text).replace(/[A-Za-zА-Яа-яЁё]+/g, (word) => {
    const hasCyr = /[А-Яа-яЁё]/.test(word);
    const hasLat = /[A-Za-z]/.test(word);
    if (!hasCyr || !hasLat) return word;
    return word
      .split('')
      .map((ch) => LATIN_LOOKALIKES[ch] || ch)
      .join('');
  });
}

function unwrapJsonishAssistantPayload(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') return parsed.trim();
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const key of ['answer', 'response', 'text', 'message', 'content', 'reply']) {
        if (typeof parsed[key] === 'string' && parsed[key].trim()) {
          return parsed[key].trim();
        }
      }
      // Только служебные поля вроде {"name":"..."} — не отдаём пользователю как ответ
      const keys = Object.keys(parsed);
      if (keys.every((k) => ['name', 'should_update_name', 'confidence', 'tagNames', 'tags'].includes(k))) {
        return '';
      }
    }
  } catch (_) {
    // не JSON — оставляем как есть
  }

  return trimmed;
}

/**
 * Нормализует ответ ассистента для показа пользователю.
 * @param {string} raw
 * @returns {string}
 */
function sanitizeAssistantText(raw) {
  if (raw == null) return '';
  let text = typeof raw === 'string' ? raw : String(raw);

  text = unwrapJsonishAssistantPayload(text);
  if (!text) return '';

  text = text.replace(CJK_REGEX, '');
  text = text.replace(/^[\s"'«»]+|[\s"'«»]+$/g, '');
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  text = replaceLatinLookalikesInCyrillicWords(text);
  text = text.replace(/[ \t]{2,}/g, ' ').trim();

  return text;
}

/**
 * Быстрая эвристика: похоже ли сообщение на представление с именем.
 * @param {string} message
 * @returns {{ likely: boolean, candidate: string|null }}
 */
function detectNameHint(message) {
  const text = String(message || '').trim();
  if (!text || text.length > 120) {
    return { likely: false, candidate: null };
  }

  const patterns = [
    /(?:меня\s+зовут|зови(?:те)?\s+меня|мо[её]\s+имя(?:\s*[-—:]|\s+)?)\s+([А-ЯЁа-яёA-Za-z-]{2,30})/i,
    /(?:^|\b)я\s+(?:это\s+)?([А-ЯЁа-яёA-Za-z-]{2,30})(?:\s*[,!.]|$)/i,
    /(?:^|\b)это\s+([А-ЯЁа-яёA-Za-z-]{2,30})(?:\s*[,!.]|$)/i
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      return { likely: true, candidate: m[1] };
    }
  }

  // Короткое сообщение только из одного «имени»
  if (/^[А-ЯЁа-яёA-Za-z-]{2,20}$/.test(text) && /[А-ЯЁа-яё]/.test(text)) {
    return { likely: true, candidate: text };
  }

  return { likely: false, candidate: null };
}

/**
 * Нормализация имени: кириллица, без кавычек, Title Case.
 * @param {string} name
 * @returns {string|null}
 */
function normalizePersonName(name) {
  let value = String(name || '').trim();
  if (!value) return null;

  value = value.replace(/^["'«»]+|["'«»]+$/g, '');
  value = replaceLatinLookalikesInCyrillicWords(value);
  value = value.replace(CJK_REGEX, '').replace(/\s+/g, ' ').trim();

  // Имя должно быть преимущественно кириллическим
  const letters = value.replace(/[^A-Za-zА-Яа-яЁё]/g, '');
  if (letters.length < 2) return null;
  const cyrCount = (letters.match(/[А-Яа-яЁё]/g) || []).length;
  if (cyrCount / letters.length < 0.6) return null;

  value = value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

  if (value.length > 40) return null;
  return value;
}

module.exports = {
  sanitizeAssistantText,
  detectNameHint,
  normalizePersonName,
  replaceLatinLookalikesInCyrillicWords
};
