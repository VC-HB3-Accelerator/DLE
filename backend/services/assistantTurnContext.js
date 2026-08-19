/**
 * Контекст одного хода чат-агента (ТЗ §0b / §4.9).
 * rag_hint — только rerank, не ACL и не CRM-тег.
 * Гость: crmTagIds всегда [].
 */

const AUDIENCE_SLUGS = new Set([
  'public-client',
  'partner',
  'investor-a',
  'investor',
  'investor-b',
  'client',
  'entrepreneur',
  'contributor'
]);

const MODE_SLUGS = new Set(['sales', 'support', 'dle-setup']);

const RAG_HINTS = new Set(['company', 'product', 'partner', 'investor']);

const AUDIENCE_PRIORITY = ['investor-a', 'investor-b', 'partner', 'public-client'];

const WELCOME_HINTS = [
  { re: /хочу узнать об инвестициях\s*\/\s*stage a/i, hint: 'investor' },
  { re: /i want to learn about investing\s*\/\s*stage a/i, hint: 'investor' },
  { re: /интересует партн[её]рство/i, hint: 'partner' },
  { re: /interested in partnership/i, hint: 'partner' },
  { re: /хочу узнать об ос dle/i, hint: 'product' },
  { re: /i want to learn about (the )?dle os/i, hint: 'product' },
  { re: /хочу узнать о vc hb3/i, hint: 'company' },
  { re: /i want to learn about vc hb3/i, hint: 'company' }
];

function normalizeSlug(value) {
  return String(value || '').trim().toLowerCase();
}

/** Ярлык из диалога → один CRM-slug. Stage A в вопрос не хардкодим. */
function normalizeRoleLabel(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

const ROLE_LABEL_TO_AUDIENCE = {
  'investor-a': 'investor-a',
  'investor-b': 'investor-b',
  investor: 'investor-a',
  investora: 'investor-a',
  инвестор: 'investor-a',
  'бизнес ангел': 'investor-a',
  'business angel': 'investor-a',
  angel: 'investor-a',
  'family office': 'investor-a',
  familyoffice: 'investor-a',
  'фемили офис': 'investor-a',
  'фэмили офис': 'investor-a',
  'венчурный фонд': 'investor-a',
  венчур: 'investor-a',
  vc: 'investor-a',
  partner: 'partner',
  партнер: 'partner',
  подрядчик: 'partner',
  поставщик: 'partner',
  contributor: 'partner',
  контрибьютор: 'partner',
  'public-client': 'public-client',
  'public client': 'public-client',
  client: 'public-client',
  entrepreneur: 'public-client',
  предприниматель: 'public-client',
  основатель: 'public-client',
  сотрудник: 'public-client',
  'сотрудник компании': 'public-client',
  клиент: 'public-client',
  founder: 'public-client'
};

const CRM_AUDIENCE_SLUGS = new Set(['public-client', 'partner', 'investor-a', 'investor-b']);

function canonicalAudience(slug) {
  const s = normalizeRoleLabel(slug);
  if (ROLE_LABEL_TO_AUDIENCE[s]) return ROLE_LABEL_TO_AUDIENCE[s];
  const compact = s.replace(/ /g, '');
  if (ROLE_LABEL_TO_AUDIENCE[compact]) return ROLE_LABEL_TO_AUDIENCE[compact];
  return s;
}

function canonicalMode(slug) {
  return normalizeSlug(slug);
}

function isAudienceSlug(slug) {
  return CRM_AUDIENCE_SLUGS.has(canonicalAudience(slug));
}

function isModeSlug(slug) {
  return MODE_SLUGS.has(normalizeSlug(slug));
}

function normalizeRagHint(raw) {
  const s = normalizeSlug(raw);
  if (RAG_HINTS.has(s)) return s;
  if (s === 'investor-a' || s === 'investora') return 'investor';
  if (s === 'public-client' || s === 'client') return 'product';
  return null;
}

function matchWelcomeHint(text) {
  const src = String(text || '');
  for (const hint of WELCOME_HINTS) {
    if (hint.re.test(src)) return hint.hint;
  }
  return null;
}

const CONFIRM_YES_RE = /^(да|верно|именно|подтверждаю|yes)(\s|[!,.?]|$)/i;
const ROLE_CLAIM_RE = /(^|\s)я\s+(инвестор|партн[её]р|клиент|предприниматель|контрибьютор)(\s|[!,.?]|$)/i;
/** «я работаю в ит» = партнёр (IT). \\b после кириллицы в JS не работает. */
const IT_OCCUPATION_RE = /я\s+работаю\s+в\s+(ит|айти|it)(?=\s|[!,.?]|$)/i;
/** «я из компании / продукт для бизнеса» = public-client, не интерес к теме. */
const BUSINESS_CLIENT_RE = /из\s+компании|для\s+(моего\s+|нашего\s+)?бизнеса|продукт\S{0,12}\s+для\s+бизнеса/i;
const SELF_INTRO_RE = /(^|\s)я\s+|мне\s+нужн/i;
const ASK_CONFIRM_RE = /подтвердите|верно,?\s+что вы|вы\s+(инвестор|бизнес[-\s]?ангел|family office|ф[еэ]мили|венчур|партн[её]р|подрядчик|поставщик|предприниматель|основатель|сотрудник)/i;
const ROLE_WORD_TO_AUDIENCE = {
  инвестор: 'investor-a',
  партнер: 'partner',
  партнёр: 'partner',
  контрибьютор: 'partner',
  клиент: 'public-client',
  предприниматель: 'public-client'
};

function messageText(msg) {
  if (!msg || typeof msg !== 'object') return '';
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content.map((p) => (p && p.text) || '').join(' ');
  }
  return String(msg.text || msg.message || '');
}

function messageRole(msg) {
  return String(msg?.role || msg?.sender || '').toLowerCase();
}

/**
 * Явное подтверждение роли (ТЗ P-4 / E9).
 * «расскажите про инвестиции» — не confirm.
 * «я инвестор Stage A» — confirm.
 * «да» — только если ассистент только что просил подтвердить роль.
 */
function hasExplicitRoleConfirm({ history = [], userQuestion = '' } = {}) {
  const userText = String(userQuestion || '').trim();
  if (!userText) return false;
  if (claimedAudienceFromText(userText)) return true;
  if (!CONFIRM_YES_RE.test(userText)) return false;
  const msgs = Array.isArray(history) ? history : [];
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const role = messageRole(msgs[i]);
    if (role === 'user') continue;
    if (role === 'assistant' || role === 'ai' || role === 'bot') {
      return ASK_CONFIRM_RE.test(messageText(msgs[i]));
    }
  }
  return false;
}

function tagNamesNeedRoleConfirm(tagNames) {
  const names = Array.isArray(tagNames) ? tagNames : [];
  return names.some((name) => isAudienceSlug(name) || isModeSlug(name));
}

function audienceFromRoleWord(word) {
  const w = String(word || '').trim().toLowerCase();
  if (!w) return null;
  return ROLE_WORD_TO_AUDIENCE[w] || ROLE_WORD_TO_AUDIENCE[w.replace(/ё/g, 'е')] || null;
}

function claimedAudienceFromText(text) {
  if (matchWelcomeHint(text)) return null;
  const src = String(text || '');
  const m = src.match(ROLE_CLAIM_RE);
  if (m) return audienceFromRoleWord(m[2]);
  if (IT_OCCUPATION_RE.test(src)) return 'partner';
  if (SELF_INTRO_RE.test(src) && BUSINESS_CLIENT_RE.test(src)) return 'public-client';
  return null;
}

function claimedAudienceFromAssistant(text) {
  const t = String(text || '');
  const m = t.match(/вы\s+(инвестор|партн[её]р|клиент|предприниматель|контрибьютор)/i);
  if (m) return audienceFromRoleWord(m[1]);
  if (!ASK_CONFIRM_RE.test(t)) return null;
  if (/инвестор/i.test(t)) return 'investor-a';
  if (/партн[её]р|контрибьютор/i.test(t)) return 'partner';
  if (/клиент|предприниматель/i.test(t)) return 'public-client';
  return null;
}

/**
 * Какой audience-slug ставить в CRM после явного confirm (P-4 / E9 / P1b).
 * Гость не вызывает это — тег только у user с карточкой.
 */
function claimedAudienceFromTurn({ history = [], userQuestion = '' } = {}) {
  if (!hasExplicitRoleConfirm({ history, userQuestion })) return null;
  const fromUser = claimedAudienceFromText(userQuestion);
  if (fromUser) return fromUser;
  const msgs = Array.isArray(history) ? history : [];
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const role = messageRole(msgs[i]);
    if (role === 'user') continue;
    if (role === 'assistant' || role === 'ai' || role === 'bot') {
      return claimedAudienceFromAssistant(messageText(msgs[i]));
    }
  }
  return null;
}

/** Один audience в CRM: новый slug вместо старого public-client/partner/…; слой (sales/…) сохраняем. */
function mergeAudienceIntoTagNames(currentNames, nextAudience) {
  const names = Array.isArray(currentNames) ? currentNames.filter(Boolean) : [];
  const kept = names.filter((n) => !isAudienceSlug(n));
  const next = nextAudience ? canonicalAudience(nextAudience) : null;
  if (!next || !isAudienceSlug(next)) return kept;
  return [...new Set([next, ...kept])];
}

/** Ask / 75/25 / DEAL — не для гостя даже из public-tagged company-страницы (ТЗ D8). */
const RESTRICTED_DEAL_RE = /\bask\b|8[.,]5\s*(m|млн)?|8[\s,]?500|8500|1[.,]9\s*(m|млн)|6[.,]6|DEAL\b|75\s*[\/:]\s*25|\bSPA\b/i;

/** Документ с ЦА investor/partner не для гостя, даже если рядом стоит public-client. */
const GUEST_FORBIDDEN_CORPUS_TAGS = new Set(['investor-a', 'investor-b', 'partner']);

function looksLikeRestrictedDealText(text) {
  return RESTRICTED_DEAL_RE.test(String(text || ''));
}

function documentTagsAllowedForGuest(tags) {
  const list = (Array.isArray(tags) ? tags : []).map(canonicalAudience).filter(Boolean);
  if (!list.includes('public-client')) return false;
  return !list.some((t) => GUEST_FORBIDDEN_CORPUS_TAGS.has(t));
}

function pickAudienceSlug(slugs) {
  const unique = [...new Set((slugs || []).map(canonicalAudience).filter(Boolean))];
  for (const preferred of AUDIENCE_PRIORITY) {
    if (unique.includes(preferred)) return preferred;
  }
  return unique[0] || null;
}

function pickModeSlug(slugs) {
  const unique = [...new Set((slugs || []).map(canonicalMode).filter((s) => MODE_SLUGS.has(s)))];
  if (unique.includes('support')) return 'support';
  if (unique.includes('dle-setup')) return 'dle-setup';
  if (unique.includes('sales')) return 'sales';
  return unique[0] || null;
}

function splitTagNames(tagNames) {
  const audience = [];
  const mode = [];
  const other = [];
  for (const raw of Array.isArray(tagNames) ? tagNames : []) {
    const slug = normalizeSlug(raw);
    if (!slug) continue;
    if (isModeSlug(slug)) {
      mode.push(canonicalMode(slug));
    } else if (isAudienceSlug(slug)) {
      audience.push(canonicalAudience(slug));
    } else {
      other.push(slug);
    }
  }
  return { audience, mode, other };
}

function hintFromHistory(conversationHistory) {
  if (!Array.isArray(conversationHistory)) return null;
  for (let i = conversationHistory.length - 1; i >= 0; i -= 1) {
    const msg = conversationHistory[i];
    const role = String(msg?.role || msg?.sender_type || '').toLowerCase();
    if (role && role !== 'user' && role !== 'human' && role !== 'client') continue;
    const fromMeta = normalizeRagHint(msg?.metadata?.rag_hint || msg?.rag_hint);
    if (fromMeta) return fromMeta;
    const fromText = matchWelcomeHint(msg?.content || msg?.text || '');
    if (fromText) return fromText;
  }
  return null;
}

/**
 * @param {object} opts
 * @param {string|number|null} opts.userId
 * @param {boolean} [opts.isGuest]
 * @param {string} [opts.userQuestion]
 * @param {object} [opts.metadata]
 * @param {Array} [opts.conversationHistory]
 * @param {number[]} [opts.crmTagIds]
 * @param {string[]} [opts.crmTagNames]
 * @param {function} [opts.isGuestId]
 */
function resolveTurnContext(opts = {}) {
  const {
    userId = null,
    isGuest: isGuestFlag = false,
    userQuestion = '',
    metadata = {},
    conversationHistory = [],
    crmTagIds = [],
    crmTagNames = [],
    isGuestId = null
  } = opts;

  const guestById = typeof isGuestId === 'function' ? isGuestId(userId) : false;
  const isGuest = Boolean(isGuestFlag) || guestById || userId == null;

  const ragHint = normalizeRagHint(metadata?.rag_hint)
    || matchWelcomeHint(userQuestion)
    || hintFromHistory(conversationHistory);

  if (isGuest) {
    return {
      isGuest: true,
      crmTagIds: [],
      crmTagNames: [],
      audienceSlugs: ['public-client'],
      modeSlugs: ['sales'],
      ragHint,
      allowAsk: false,
      includeBaseRules: true,
      hasCrmAudience: false
    };
  }

  const split = splitTagNames(crmTagNames);
  const audience = pickAudienceSlug(split.audience);
  const hasCrmAudience = Boolean(audience);
  const mode = hasCrmAudience
    ? (pickModeSlug(split.mode) || 'sales')
    : 'sales';

  return {
    isGuest: false,
    crmTagIds: hasCrmAudience ? (Array.isArray(crmTagIds) ? crmTagIds.filter((id) => Number(id) > 0) : []) : [],
    crmTagNames: hasCrmAudience ? (Array.isArray(crmTagNames) ? crmTagNames.map(normalizeSlug).filter(Boolean) : []) : [],
    audienceSlugs: [hasCrmAudience ? audience : 'public-client'],
    modeSlugs: [mode],
    ragHint,
    allowAsk: audience === 'investor-a',
    includeBaseRules: !hasCrmAudience,
    hasCrmAudience
  };
}

/**
 * Видимость FAQ-строки для pre-filter / post-filter.
 * Гость и user без ЦА: пустая ЦА = нет (иначе утечка untagged/support-common).
 */
function resolveFaqRowVisible(row, ctx) {
  const isGuestLike = !ctx || ctx.isGuest || !ctx.hasCrmAudience;
  const allowedAud = new Set((ctx?.audienceSlugs || ['public-client']).map(canonicalAudience));
  const allowedMode = new Set((ctx?.modeSlugs || ['sales']).map(canonicalMode));

  const rowAud = (row?.audience_tags || row?.audienceTags || [])
    .map(canonicalAudience)
    .filter(Boolean);
  const rowModeRaw = row?.service_mode != null ? canonicalMode(row.service_mode) : '';
  const rowMode = MODE_SLUGS.has(rowModeRaw) ? rowModeRaw : '';

  const audienceOk = isGuestLike
    ? rowAud.some((t) => allowedAud.has(t))
    : (rowAud.length === 0 || rowAud.some((t) => allowedAud.has(t)));

  const modeOk = !rowMode || allowedMode.has(rowMode);

  return Boolean(audienceOk && modeOk);
}

function corpusAudiencesForContext(ctx) {
  const tags = (ctx?.audienceSlugs || ['public-client']).map(canonicalAudience);
  const allowed = new Set();
  for (const tag of tags) {
    if (isModeSlug(tag)) continue;
    if (tag === 'investor-a' || tag === 'investor-b' || tag === 'partner' || tag === 'public-client') {
      allowed.add(tag);
    }
  }
  if (!allowed.size) allowed.add('public-client');
  if (ctx?.hasCrmAudience) {
    allowed.add('public-client');
  }
  return [...allowed];
}

/** Гость: никаких CRM-tools. Теги не ставить. */
const GUEST_PROFILE_HINT = 'Гость без карточки CRM. Теги не ставить. Не вызывай и не печатай update_user_tags / update_user_name / get_user_profile.';

/** Инструкция модели: смысл намерения, не словарь ярлыков. Только user с карточкой. */
const QUALIFY_PROFILE_HINT = 'Тег ЦА в CRM пуст. Квалифицируй по смыслу, не по списку слов. investor-a — человек вкладывает капитал (ангел, фонд). partner — подряд/поставка/совместный контур. public-client — своя компания хочет продукт/ОС. Кнопки welcome и фразы «Хочу узнать о…» / «Интересует партнёрство» — тема разговора, НЕ самоопределение: update_user_tags с них не вызывать. Тег — только после явного «я инвестор/партнёр/клиент» или «да» на ваш вопрос подтверждения. Если роли нет — ответь по текущей теме и задай один уточняющий вопрос своими словами, без меню из трёх ярлыков.';

const UPDATE_TAGS_TOOL_DESCRIPTION = 'Записать тег ЦА только после явного самоопределения («я инвестор/партнёр/клиент») или «да» на вопрос подтверждения. Кнопка welcome и «хочу узнать о…» / «интересует партнёрство» — тема, не тег: tool не вызывать. Один slug: investor-a — вкладывает капитал; partner — подряд/поставка; public-client — компания хочет продукт/ОС. Слой sales/support не ставить.';

/**
 * Блок «Информация о пользователе» в system prompt (без БД).
 * Гостю — GUEST_PROFILE_HINT, без QUALIFY (тег не ставить).
 */
function buildUserProfilePromptLines({
  isGuest = false,
  name = null,
  nameMissing = false,
  tags = [],
  comment = null,
  link = null
} = {}) {
  if (isGuest) return [GUEST_PROFILE_HINT];
  const profileLines = [];
  if (name) {
    profileLines.push(`Имя пользователя: ${name}`);
  } else if (nameMissing) {
    profileLines.push('Имя в CRM пустое. Если в ЭТОМ сообщении пользователь назвал личное имя — сразу вызови update_user_name. Не спрашивай имя заново, если оно уже сказано. Роль (инвестор/партнёр) в имя не писать.');
  }
  if (Array.isArray(tags) && tags.length > 0) {
    profileLines.push(`Активные теги пользователя: ${tags.join(', ')}`);
  } else {
    profileLines.push(QUALIFY_PROFILE_HINT);
  }
  if (comment) profileLines.push(`Комментарий в CRM-профиле: ${comment}`);
  if (link) profileLines.push(`Ссылка в CRM-профиле: ${link}`);
  return profileLines;
}

/**
 * Чистый контракт tool update_user_tags (без БД).
 * Модель передаёт slug или ярлык; в CRM остаётся один audience.
 */
function applyAudienceTagUpdate({ isGuest = false, currentNames = [], requested = [] } = {}) {
  if (isGuest) {
    return { error: 'Теги CRM только у пользователя с карточкой. Гостю тег не ставится.' };
  }
  const tagNames = Array.isArray(requested) ? requested : [];
  if (tagNames.some((n) => isModeSlug(n))) {
    return { error: 'Теги слоя (sales, support, dle-setup) ставит оператор в карточке контакта.' };
  }
  const audienceRequested = [...new Set(
    tagNames.map((n) => canonicalAudience(n)).filter((n) => isAudienceSlug(n))
  )];
  if (audienceRequested.length > 1) {
    return { error: 'Один тег ЦА за ход: investor-a, partner или public-client.' };
  }
  const nextAudience = audienceRequested[0] || null;
  if (!nextAudience) {
    return { error: 'Нужен slug ЦА: investor-a, partner или public-client.' };
  }
  return {
    ok: true,
    audience: nextAudience,
    tagNames: mergeAudienceIntoTagNames(currentNames, nextAudience)
  };
}

module.exports = {
  AUDIENCE_SLUGS,
  MODE_SLUGS,
  RAG_HINTS,
  normalizeSlug,
  canonicalAudience,
  canonicalMode,
  isAudienceSlug,
  isModeSlug,
  normalizeRagHint,
  matchWelcomeHint,
  pickAudienceSlug,
  pickModeSlug,
  splitTagNames,
  resolveTurnContext,
  resolveFaqRowVisible,
  corpusAudiencesForContext,
  hasExplicitRoleConfirm,
  claimedAudienceFromText,
  claimedAudienceFromTurn,
  mergeAudienceIntoTagNames,
  applyAudienceTagUpdate,
  QUALIFY_PROFILE_HINT,
  GUEST_PROFILE_HINT,
  UPDATE_TAGS_TOOL_DESCRIPTION,
  buildUserProfilePromptLines,
  tagNamesNeedRoleConfirm,
  looksLikeRestrictedDealText,
  documentTagsAllowedForGuest,
  GUEST_FORBIDDEN_CORPUS_TAGS
};
