/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Описание карточки по schema. Пустое обязательное — вопрос, не подстановка.
 */

const VERSION = 1;
const KINDS = new Set(['listing', 'store', 'table']);

function question(field, text) {
  return { id: field, field, text };
}

function emptyBrief({ kind = 'listing', owner_user_id } = {}) {
  const owner = Number(owner_user_id);
  const brief = {
    version: VERSION,
    kind: KINDS.has(kind) ? kind : 'listing',
    owner_user_id: Number.isInteger(owner) && owner > 0 ? owner : null,
    title: '',
    excerpt: '',
    description: '',
    features: '',
    benefit: '',
    catalog: { section: null, attrs: {} },
    seo: { title: '', description: '', keywords: [] },
    media: {
      photo_count: null,
      aspect: null,
      video: 'ask',
      video_seconds: null,
      source: 'unknown',
    },
    sources: [],
    status: 'draft',
  };
  if (brief.kind === 'store') {
    brief.store = {
      item_kind: 'product',
      price_units: null,
      pay_token_address: null,
      pay_token_decimals: null,
      receipt_enabled: false,
      status: 'draft',
    };
  }
  if (brief.kind === 'table') {
    brief.table = {
      name: '',
      description: '',
      rag_source: false,
      columns: [],
      rows: [],
    };
  }
  return brief;
}

function applyAutofill(brief) {
  if (!brief || typeof brief !== 'object') return brief;
  const title = String(brief.title || '').trim();
  const excerpt = String(brief.excerpt || '').trim();
  brief.seo = brief.seo && typeof brief.seo === 'object' ? brief.seo : {};
  if (title && !String(brief.seo.title || '').trim()) brief.seo.title = title;
  if (excerpt && !String(brief.seo.description || '').trim()) brief.seo.description = excerpt;
  if (brief.kind === 'store') {
    brief.store = brief.store && typeof brief.store === 'object' ? brief.store : {};
    if (!brief.store.status) brief.store.status = 'draft';
  }
  if (!brief.status) brief.status = 'draft';
  return brief;
}

function isBlank(value) {
  if (value == null) return true;
  if (typeof value === 'string') return !value.trim();
  return false;
}

function hasPositivePrice(raw) {
  try {
    return BigInt(String(raw || '0')) > 0n;
  } catch {
    return false;
  }
}

function looksLikeAddress(raw) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(raw || '').trim());
}

/**
 * @param {object} brief
 * @param {{ intent?: 'draft' | 'ready' }} [opts]
 * @returns {{ ok: boolean, brief: object, questions: object[], invented: boolean }}
 */
function validate(brief, { intent = 'draft' } = {}) {
  const next = applyAutofill(structuredClone(brief || emptyBrief()));
  const questions = [];
  if (!KINDS.has(next.kind)) {
    questions.push(question('kind', 'Какую карточку собрать: объявление, магазин или таблицу?'));
  }
  if (!Number.isInteger(Number(next.owner_user_id)) || Number(next.owner_user_id) <= 0) {
    questions.push(question('owner_user_id', 'Нет владельца беседы — войти в свой профиль.'));
  }

  if (next.kind === 'listing') {
    if (isBlank(next.title)) questions.push(question('title', 'Как назвать объявление?'));
    if (isBlank(next.excerpt)) questions.push(question('excerpt', 'Краткий текст объявления?'));
    if (intent === 'ready') {
      if (isBlank(next.catalog?.section)) {
        questions.push(question('catalog.section', 'Какой раздел каталога? Без него в ленту не сдаём.'));
      }
      const photos = Number(next.media?.photo_count);
      if (!Number.isInteger(photos) || photos < 1) {
        questions.push(question('media.photo_count', 'Сколько фото положить в объявление? Лимит карточки: 1–10 фото, 0 или 1 видео.'));
      }
    }
  }

  if (next.kind === 'store') {
    if (isBlank(next.title)) questions.push(question('title', 'Как назвать карточку магазина?'));
    if (!hasPositivePrice(next.store?.price_units)) {
      questions.push(question('store.price_units', 'Какая цена? Не выдумываю.'));
    }
    if (!looksLikeAddress(next.store?.pay_token_address)) {
      questions.push(question('store.pay_token_address', 'Какой платёжный токен? Адрес не выдумываю.'));
    }
    if (next.store?.status === 'published' && intent !== 'ready') {
      next.store.status = 'draft';
    }
  }

  if (next.kind === 'table') {
    if (isBlank(next.table?.name)) questions.push(question('table.name', 'Как назвать таблицу?'));
    if (intent === 'ready' && !(next.table?.columns || []).length) {
      questions.push(question('table.columns', 'Какие колонки? Сначала покажу распознанное.'));
    }
  }

  return {
    ok: questions.length === 0,
    brief: next,
    questions,
    invented: false,
  };
}

function wantsFillBrief(message) {
  return /заполн|напиши\s+(назван|текст|описан)|название\s+описан/i.test(String(message || ''));
}

function guessSubject(message) {
  const text = String(message || '').replace(/\s+/g, ' ').trim()
    .replace(/[!.?]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const forMatch = text.match(/(?:для|про)\s+(.+)$/i);
  if (forMatch) {
    const named = forMatch[1].replace(/^(?:этого|эту|этот)\s+/i, '').trim();
    if (named && !/^(?:pdf|файл|файлу|таблиц)/i.test(named)) return named.slice(0, 160);
  }
  const stripped = text
    .replace(/^(?:привет[, ]+)?(?:сделай|сделать|создай|создать|напиши|подготовь)\s+/i, '')
    .replace(/^(?:объявление|обьявление|карточк\w*)\s+/i, '')
    .replace(/^(?:по\s+(?:этому|данному)\s+)?(?:pdf|файлу|файле|таблице)\s*/i, '')
    .trim();
  if (!stripped || /^(?:pdf|файл|по этому)/i.test(stripped)) return '';
  return stripped.slice(0, 160);
}

function titleCaseWords(raw) {
  return String(raw || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .slice(0, 160);
}

function usableSources(sources) {
  return (Array.isArray(sources) ? sources : []).filter((row) => {
    const blob = `${row?.url || ''} ${row?.title || ''} ${row?.snippet || ''}`;
    return !/enable-javascript|smart-captcha|captcha|consent\.google|showcaptcha/i.test(blob);
  });
}

function previewText(preview) {
  if (!preview || typeof preview !== 'object') return '';
  const rows = Array.isArray(preview.rows) ? preview.rows.slice(0, 8) : [];
  const cols = Array.isArray(preview.columns) ? preview.columns.map((c) => c.name || c).join(', ') : '';
  return [
    preview.title,
    preview.excerpt,
    preview.text,
    cols ? `колонки: ${cols}` : '',
    rows.length ? JSON.stringify(rows).slice(0, 800) : '',
  ].filter(Boolean).join('\n').slice(0, 2000);
}

function mergeLeadPatch(brief, patch) {
  if (!brief || typeof brief !== 'object' || !patch || typeof patch !== 'object') return brief;
  const next = structuredClone(brief);
  for (const key of ['title', 'excerpt', 'description', 'features', 'benefit']) {
    const value = String(patch[key] || '').trim();
    if (value) next[key] = value.slice(0, key === 'description' ? 4000 : 500);
  }
  if (patch.catalog && typeof patch.catalog === 'object') {
    next.catalog = next.catalog && typeof next.catalog === 'object' ? next.catalog : { section: null, attrs: {} };
    const section = String(patch.catalog.section || '').trim();
    if (section) next.catalog.section = section.slice(0, 120);
    if (patch.catalog.attrs && typeof patch.catalog.attrs === 'object') {
      next.catalog.attrs = { ...next.catalog.attrs, ...patch.catalog.attrs };
    }
  }
  if (patch.seo && typeof patch.seo === 'object') {
    next.seo = next.seo && typeof next.seo === 'object' ? next.seo : {};
    if (String(patch.seo.title || '').trim()) next.seo.title = String(patch.seo.title).trim().slice(0, 160);
    if (String(patch.seo.description || '').trim()) {
      next.seo.description = String(patch.seo.description).trim().slice(0, 400);
    }
    if (Array.isArray(patch.seo.keywords)) {
      next.seo.keywords = patch.seo.keywords.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 12);
    }
  }
  if (next.kind === 'table' && patch.table && typeof patch.table === 'object') {
    next.table = next.table && typeof next.table === 'object' ? next.table : {};
    if (String(patch.table.name || '').trim()) next.table.name = String(patch.table.name).trim().slice(0, 120);
    if (String(patch.table.description || '').trim()) {
      next.table.description = String(patch.table.description).trim().slice(0, 500);
    }
  }
  /* цену и токен магазина не берём из модели — только человек */
  return applyAutofill(next);
}

function heuristicFill(brief, context = {}) {
  const next = structuredClone(brief || emptyBrief());
  const message = [context.message, context.extraMessage].filter(Boolean).join('\n');
  const preview = context.file_preview || {};
  if (isBlank(next.title)) {
    const fromFile = String(preview.title || preview.name || '').trim();
    const subject = guessSubject(message);
    next.title = (fromFile || titleCaseWords(subject)).slice(0, 160);
  }
  if (isBlank(next.excerpt)) {
    const fromFile = String(preview.excerpt || '').trim();
    next.excerpt = fromFile || (next.title ? `Объявление: ${next.title}.` : '');
  }
  if (next.kind === 'table' && isBlank(next.table?.name)) {
    next.table = next.table && typeof next.table === 'object' ? next.table : {};
    next.table.name = String(preview.title || preview.name || next.title || '').trim().slice(0, 120);
  }
  return applyAutofill(next);
}

const FILL_SYSTEM = [
  'Заполни JSON описания карточки по фразе, файлу и источникам.',
  'Поля: title, excerpt, description, features, benefit, catalog.section, seo.title, seo.description, seo.keywords.',
  'Бери только то, что есть во входе. Не выдумывай цену, токен, год, комплектацию, объём.',
  'Источники с капчей, enable-javascript и служебными страницами игнорируй.',
  'Пустое поле — пустая строка, не «уточните».',
  'Если во входе есть decisions, не противоречь активному решению.',
  'Ответ только JSON.',
].join(' ');

function parseLeadJson(raw, parseJsonLoose) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  const text = String(raw || '').trim();
  if (!text) return null;
  if (typeof parseJsonLoose === 'function') {
    const parsed = parseJsonLoose(text);
    if (parsed && typeof parsed === 'object') return parsed;
  }
  try { return JSON.parse(text); } catch { return null; }
}

/**
 * Ведущий заполняет schema. Пустые обязательные после этого — вопросы validate().
 */
async function fillFromLead(brief, context = {}, hooks = {}) {
  let next = heuristicFill(brief, context);
  const skipLive = hooks.skipLead
    || (process.env.NODE_TEST_CONTEXT && typeof hooks.chatForRole !== 'function' && !hooks.forceLead);
  if (skipLive) return applyAutofill(next);
  try {
    const chat = typeof hooks.chatForRole === 'function'
      ? hooks.chatForRole
      : (...args) => require('./orchModelRouter').chatForRole(...args);
    const sources = usableSources(context.sources).slice(0, 6).map((row) => ({
      system: row.system,
      url: row.url,
      title: row.title,
      snippet: String(row.snippet || '').slice(0, 240),
    }));
    const res = await chat('brief_chat', [
      { role: 'system', content: FILL_SYSTEM },
      {
        role: 'user',
        content: JSON.stringify({
          kind: next.kind,
          message: String(context.message || '').slice(0, 2000),
          extra: String(context.extraMessage || '').slice(0, 1000),
          file: previewText(context.file_preview),
          sources,
          decisions: (Array.isArray(context.decisions) ? context.decisions : [])
            .slice(0, 3)
            .map((row) => ({
              id: String(row.id || '').slice(0, 40),
              decision: String(row.decision || '').slice(0, 400),
            })),
        }).slice(0, 6000),
      },
    ], { temperature: 0, maxTokens: 400, json: true });
    const raw = res?.content ?? res?.text ?? res;
    const parsed = parseLeadJson(raw, res?.parseJsonLoose);
    if (parsed) next = mergeLeadPatch(next, parsed);
  } catch {
    /* heuristic остаётся */
  }
  return applyAutofill(next);
}

module.exports = {
  VERSION,
  emptyBrief,
  applyAutofill,
  validate,
  wantsFillBrief,
  guessSubject,
  usableSources,
  mergeLeadPatch,
  heuristicFill,
  fillFromLead,
};
