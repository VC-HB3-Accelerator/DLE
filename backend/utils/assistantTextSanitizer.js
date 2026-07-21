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

/** Слова, которые нельзя принимать как личное имя */
const NAME_STOPWORDS = new Set([
  'я', 'ты', 'он', 'она', 'мы', 'вы', 'они',
  'привет', 'здравствуйте', 'здравствуй', 'добрый', 'день', 'вечер', 'утро',
  'спасибо', 'пожалуйста', 'хорошо', 'ладно', 'понял', 'поняла', 'ок', 'окей',
  'да', 'нет', 'неа', 'ага', 'угу',
  'думаю', 'хочу', 'могу', 'нужно', 'надо', 'ищу', 'работаю', 'живу', 'зовут', 'завут', 'звать',
  'сегодня', 'завтра', 'вчера', 'сейчас', 'просто', 'тоже', 'ещё', 'еще', 'очень',
  'только', 'уже', 'снова', 'опять', 'всегда', 'никогда', 'может', 'буду', 'была', 'было',
  'здесь', 'тут', 'там', 'сюда', 'туда', 'кто', 'что', 'как', 'где', 'куда',
  'компания', 'продукт', 'помощь', 'вопрос', 'ответ', 'менеджер', 'директор',
  'главный', 'уважением', 'уважение', 'подпись', 'команда', 'клиент', 'пользователь'
]);

/** Capture: одно-два кириллических слова (имя / имя+фамилия) */
const NAME_CAPTURE = '([А-ЯЁа-яё-]{2,30}(?:\\s+[А-ЯЁа-яё-]{2,30})?)';

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
      const keys = Object.keys(parsed);
      if (keys.every((k) => ['name', 'should_update_name', 'confidence', 'tagNames', 'tags'].includes(k))) {
        return '';
      }
    }
  } catch (_) {
    // не JSON
  }

  return trimmed;
}

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

function looksLikePersonNameToken(token) {
  const raw = String(token || '').trim();
  if (!raw) return false;
  const lower = raw.toLowerCase().replace(/ё/g, 'е');
  if (NAME_STOPWORDS.has(lower)) return false;
  if (lower.length < 2 || lower.length > 20) return false;
  // Отсекаем глаголы/прилагательные по типичным окончаниям (грубо, но снижает FP)
  if (/(ую|ю|ешь|ет|ем|ете|ут|ют|ал|ала|или|ить|ать|ять|юсь|ится)$/i.test(lower)) {
    return false;
  }
  if (!/^[А-ЯЁа-яё-]+$/u.test(raw)) return false;
  return true;
}

function candidateFromMatch(m) {
  if (!m || !m[1]) return null;
  const raw = m[1].trim();
  const first = raw.split(/\s+/)[0];
  if (!looksLikePersonNameToken(first)) return null;
  if (raw.includes(' ') && !looksLikePersonNameToken(raw.split(/\s+/)[1])) return null;
  return raw;
}

/**
 * Быстрая эвристика: похоже ли сообщение на представление с именем.
 * Покрывает частые формы и опечатки; strong = можно писать в профиль без LLM.
 * @returns {{ likely: boolean, candidate: string|null, strong: boolean }}
 */
function detectNameHint(message) {
  const text = String(message || '').trim();
  if (!text || text.length > 200) {
    return { likely: false, candidate: null, strong: false };
  }

  // Явные шаблоны — auto-accept
  const strongPatterns = [
    // меня зовут / завут / зовуть / звать / кличут
    new RegExp(`(?:меня\\s+(?:з[ао]вут[ь]?|звать|кличут)|зовут\\s+меня)\\s+${NAME_CAPTURE}`, 'i'),
    // зови(те) меня X / можете звать меня X / называйте меня X
    new RegExp(`(?:зови(?:те)?\\s+меня|можете\\s+звать\\s+меня|называй(?:те)?\\s+меня)\\s+${NAME_CAPTURE}`, 'i'),
    // моё имя X / мое имя: X / имя — X
    new RegExp(`(?:мо[её]\\s+имя|мое\\s+имя|имя)\\s*[-—:]\\s*${NAME_CAPTURE}`, 'i'),
    new RegExp(`мо[её]\\s+имя\\s+${NAME_CAPTURE}`, 'i'),
    // представлюсь / я — X / я есть X (короткие явные)
    new RegExp(`(?:представлю(?:сь)?|представляюсь|знакомь(?:те)?сь)\\s*[,:\\-—]?\\s*${NAME_CAPTURE}`, 'i'),
    // подпись: с уважением[,.] Имя  |  Имя, с уважением
    new RegExp(`с\\s+уважением\\s*[,.]?\\s*${NAME_CAPTURE}\\s*$`, 'i'),
    new RegExp(`^${NAME_CAPTURE}\\s*[,.]?\\s*с\\s+уважением\\b`, 'i'),
    // всё сообщение целиком: «я Алекс» / «я алекс.»
    new RegExp(`^я\\s+${NAME_CAPTURE}\\s*[.!,]?$`, 'i')
  ];
  for (const re of strongPatterns) {
    const candidate = candidateFromMatch(text.match(re));
    if (candidate) {
      return { likely: true, candidate, strong: true };
    }
  }

  // Мягкие — только hint для LLM (не auto-accept)
  const softPatterns = [
    // я это Анна / я Алекс в середине фразы (заглавная снижает FP)
    new RegExp(`(?:^|\\s)я\\s+(?:это\\s+)?([А-ЯЁ][а-яё-]{1,29})(?:\\s*[,!.]|\\s+|$)`),
    new RegExp(`(?:^|\\s)это\\s+([А-ЯЁ][а-яё-]{1,29})(?:\\s*[,!.]|\\s+|$)`),
    // меня зовут вперемешку с шумом: «ну меня типо зовут алекс»
    new RegExp(`(?:зовут|завут|звать)\\s+${NAME_CAPTURE}`, 'i'),
    // «я по имени Алекс» / «меня по имени …»
    new RegExp(`(?:по\\s+имени|мое\\s+имя|мо[её]\\s+имя)\\s+${NAME_CAPTURE}`, 'i')
  ];
  for (const re of softPatterns) {
    const candidate = candidateFromMatch(text.match(re));
    if (candidate) {
      return { likely: true, candidate, strong: false };
    }
  }

  // Одно слово-имя целиком — soft для LLM
  if (/^[А-ЯЁ][а-яё-]{1,19}$/u.test(text) && looksLikePersonNameToken(text)) {
    return { likely: true, candidate: text, strong: false };
  }

  return { likely: false, candidate: null, strong: false };
}

function normalizePersonName(name) {
  let value = String(name || '').trim();
  if (!value) return null;

  value = value.replace(/^["'«»]+|["'«»]+$/g, '');
  value = replaceLatinLookalikesInCyrillicWords(value);
  value = value.replace(CJK_REGEX, '').replace(/\s+/g, ' ').trim();

  const parts = value.split(' ').filter(Boolean);
  if (!parts.length || parts.length > 2) return null;
  if (!parts.every((p) => looksLikePersonNameToken(p))) return null;

  value = parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

  if (value.length > 40) return null;
  return value;
}

module.exports = {
  sanitizeAssistantText,
  detectNameHint,
  normalizePersonName,
  looksLikePersonNameToken,
  replaceLatinLookalikesInCyrillicWords
};
