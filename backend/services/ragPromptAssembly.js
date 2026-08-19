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

const ASK_FORBID_GUEST = 'ЗАПРЕТ: не называй ask раунда, доли инвестора, 75/25, DEAL, 8500 токенов, $8.5M/$1.9M/$6.6M — даже если это есть в источниках. Для этой аудитории условия сделки не раскрываются. Не подменяй ответ квалификацией инвестора Stage A, если текущая тема — компания, продукт или партнёрство. Если спросили цифры раунда — скажи, что они не для этой консультации, и продолжи по текущей теме.';

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
  generateIfNoRag = false,
  allowAsk = false
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
    const sourcesInfo = pickSourcesForPrompt(multiSourceResults.results, 3)
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

    prompt = `${memoryBlock}База знаний содержит следующую информацию из разных источников:\n\n${sourcesInfo}\n\nВопрос пользователя: ${userQuestion}\n\nТы консультант в живом чате, не киоск документов. Используй факты из источников как якоря (цифры, определения), но отвечай своими словами: кратко, по делу, под аудиторию. Задай один уточняющий вопрос или предложи следующий шаг (боль → решение). Не вываливай сырой текст источников целиком. Не выдумывай цифры и условия, которых нет в источниках.\n${allowAsk
      ? 'Ask / доля / суммы раунда — только дословно из источников выше, если они есть.'
      : ASK_FORBID_GUEST}`;
  } else if (answer) {
    prompt = `${memoryBlock}Факт из базы знаний (якорь, не готовый ответ клиенту):\n"${answer}"\n\nВопрос пользователя: ${userQuestion}\n\nСформулируй персональный ответ в диалоге: опирайся на факт, не копируй его слепо, при необходимости задай уточнение или предложи следующий шаг. Не выдумывай то, чего нет в факте.\n${allowAsk
      ? 'Ask / доля / суммы раунда — только если они есть в факте выше.'
      : ASK_FORBID_GUEST}`;
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
      prompt += `\n\nДополнительно: если в контексте нет фактов по вопросу — не придумывай. Ответь обычным связным текстом на русском по системным инструкциям, без JSON, без кавычек вокруг всего ответа, без иероглифов и латиницы внутри русских слов.\n${allowAsk
        ? 'Ask / долю / суммы называй только из фактов этого сообщения.'
        : ASK_FORBID_GUEST}`;
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

function normalizeHitTags(value) {
  if (Array.isArray(value)) {
    return value.map((t) => String(t || '').trim().toLowerCase()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[,;]/).map((t) => t.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

function tableTagsFromHit(r) {
  const direct = normalizeHitTags(r?.metadata?.userTags || r?.userTags || r?.metadata?.audience_tags);
  if (direct.length) return direct;
  const ctx = String(r?.context || r?.metadata?.context || '');
  const m = ctx.match(/audience=([^;]+)/i);
  if (m) {
    return m[1].split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

function serviceModeFromHit(r) {
  const raw = r?.metadata?.serviceMode || r?.metadata?.service_mode || r?.service_mode;
  if (raw) return String(raw).trim().toLowerCase();
  const tags = tableTagsFromHit(r);
  const mode = tags.find((t) => t === 'sales' || t === 'support' || t === 'dle-setup');
  return mode || null;
}

/**
 * Эффективная аудитория FAQ/docs.
 * Гость / без CRM-тегов → public-client (B2B), не «все FAQ подряд».
 */
function effectiveAssignTagNames(assignTagNames) {
  if (Array.isArray(assignTagNames) && assignTagNames.length) {
    return assignTagNames.map((t) => String(t).trim()).filter(Boolean);
  }
  return ['public-client'];
}

/**
 * Фильтр FAQ/docs по контексту хода (гость ≠ CRM-тег).
 */
function filterHitsByTurnContext(results, turnCtx) {
  if (!Array.isArray(results) || !results.length) {
    return { results: results || [], emptied: false };
  }
  const {
    resolveFaqRowVisible,
    corpusAudiencesForContext,
    isModeSlug,
    looksLikeRestrictedDealText
  } = require('./assistantTurnContext');
  const allowedAudiences = corpusAudiencesForContext(turnCtx);
  const guestLike = Boolean(turnCtx?.isGuest || !turnCtx?.hasCrmAudience);
  const filtered = results.filter((r) => {
    if (r.sourceType === 'document' || r.source === 'document' || r.source === 'documents') {
      if (!corpusHitAllowedForAudiences(r, allowedAudiences, { guestLike })) return false;
      if (guestLike && looksLikeRestrictedDealText(`${r.text || ''} ${r.context || ''}`)) return false;
      return true;
    }
    const tags = tableTagsFromHit(r).filter((t) => !isModeSlug(t));
    return resolveFaqRowVisible({
      audience_tags: tags,
      service_mode: serviceModeFromHit(r)
    }, turnCtx);
  });
  if (filtered.length) return { results: filtered, emptied: false };
  return { results: [], emptied: true };
}

/**
 * T03: FAQ/table hits с userTags — юзер без пересечения тегов не видит строку.
 * Без тегов (гость) — только public-client, не pass-through всех аудиторий.
 * Документы (pages) фильтруем по corpus_audience.
 * Пустой результат после фильтра — fail-closed (не возвращаем исходную выдачу).
 * @returns {{ results: Array, emptied: boolean }}
 */
function filterHitsByAssignTags(results, assignTagNames) {
  if (!Array.isArray(results) || !results.length) {
    return { results: results || [], emptied: false };
  }

  const { resolveTurnContext, isModeSlug } = require('./assistantTurnContext');
  const names = effectiveAssignTagNames(assignTagNames).filter((t) => !isModeSlug(t));
  const guestLike = !names.length || (names.length === 1 && names[0] === 'public-client');
  const turnCtx = resolveTurnContext({
    userId: guestLike ? null : 'assign-tags',
    isGuest: guestLike,
    crmTagNames: guestLike ? [] : names,
    crmTagIds: guestLike ? [] : [1]
  });
  return filterHitsByTurnContext(results, turnCtx);
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

function normalizeFaqText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[«»"'“”]/g, '')
    .replace(/[^\p{L}\p{N}\s$%]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function faqQuestionFromHit(r) {
  const fromMeta = r?.metadata?.question || r?.question;
  if (fromMeta) return String(fromMeta);
  const ctx = String(r?.context || r?.metadata?.context || '').trim();
  if (ctx && !/^audience=/i.test(ctx)) return ctx;
  const text = String(r?.text || r?.content || '');
  const first = text.split('\n')[0].trim();
  if (first && first.length < 180 && !/^audience=/i.test(first)) return first;
  return '';
}

function faqQuestionBoost(query, question) {
  const q = normalizeFaqText(query);
  const n = normalizeFaqText(question);
  if (!q || !n || n.length < 4) return 0;
  if (q.includes(n) || (q.length >= 8 && n.includes(q))) return 1;
  const qWords = n.split(' ').filter((w) => w.length > 2);
  if (!qWords.length) return 0;
  const hits = qWords.filter((w) => q.includes(w)).length;
  const overlap = hits / qWords.length;
  if (overlap >= 0.5) return 0.55 + 0.45 * overlap;
  return overlap * 0.4;
}

function isTableHit(r) {
  return r && (r.sourceType === 'table' || r.source === 'table');
}

function isDocumentHit(r) {
  const t = r?.sourceType || r?.source;
  return t === 'document' || t === 'documents';
}

function rerankTableHitsByQuestion(results, query) {
  if (!Array.isArray(results) || !results.length) return results || [];
  return results.map((r) => {
    if (!isTableHit(r)) return r;
    const question = faqQuestionFromHit(r);
    const boost = faqQuestionBoost(query, question);
    const base = Number(r.combinedScore != null ? r.combinedScore : r.score) || 0;
    const next = base + boost;
    return { ...r, combinedScore: next, score: next, faqBoost: boost };
  });
}

/** Якорные FAQ для первой презентации продукта предпринимателю. */
const CORE_PRODUCT_FAQ = [
  'кто вы',
  'хочу узнать о vc hb3',
  'хочу узнать об ос dle',
  'как начать',
  'тарифы b2b',
  'сколько стоит шаблон',
  'что такое dle',
  'что входит в лицензию',
  'чем dle не является',
  'глоссарий'
];

const CORE_INVESTOR_FAQ = [
  'хочу узнать об инвестициях',
  'какой ask раунда',
  'что покупаю за',
  'почему клиенты платят',
  'что такое ос dle',
  'чем a отличается от lp'
];

const CORE_PARTNER_FAQ = [
  'интересует партнёрство',
  'интересует партнерство',
  'какой стек',
  'какой фронт работ',
  'что делает it',
  'кто ведёт продажи',
  'кто ведет продажи',
  'как появляется страна'
];

function boostFaqHitsByAnchors(results, anchors, { penaltyRe, coreBoost = 1.45, extra } = {}) {
  if (!Array.isArray(results) || !results.length) return results || [];
  const list = (anchors || []).map((a) => normalizeFaqText(a)).filter(Boolean);
  return results.map((r) => {
    if (!isTableHit(r)) return r;
    const question = normalizeFaqText(faqQuestionFromHit(r));
    let boost = 0;
    for (let i = 0; i < list.length; i += 1) {
      const core = list[i];
      if (question.includes(core) || core.includes(question.slice(0, Math.min(question.length, 28)))) {
        boost = coreBoost - i * 0.1;
        break;
      }
    }
    if (typeof extra === 'function') boost += extra(question) || 0;
    if (penaltyRe && penaltyRe.test(question)) boost -= 0.95;
    const base = Number(r.combinedScore != null ? r.combinedScore : r.score) || 0;
    const next = base + boost;
    return { ...r, combinedScore: next, score: next, faqAnchorBoost: boost };
  }).sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
}

function isProductPresentationQuery(query) {
  const q = normalizeFaqText(query);
  if (!q) return false;
  return /операционн|для бизнеса|что такое dle|консультац|предпринимат|тариф|как начать|о с\b|ос dle|логистик|компани|vc hb3|accelerator|кто вы/.test(q);
}

function isInvestorPresentationQuery(query) {
  const q = normalizeFaqText(query);
  if (!q) return false;
  return /инвест|stage a|раунд|ask|долю|чек|транш/.test(q);
}

function isPartnerPresentationQuery(query) {
  const q = normalizeFaqText(query);
  if (!q) return false;
  return /партн|контрибьютор|contributor|it.?компани|узел/.test(q);
}

/**
 * Для product-запроса предпринимателя поднимаем тариф/старт выше «аудит кода» / EVM.
 */
function preferCoreProductFaqHits(results, query) {
  if (!isProductPresentationQuery(query)) return results || [];
  return boostFaqHitsByAnchors(results, CORE_PRODUCT_FAQ, {
    penaltyRe: /аудит|токен-лиценз|evm|блокчейн|регулятор|исходник|безопасна ли/,
    extra: (question) => (/как начать|тариф|сколько стоит|хочу узнать об ос/.test(question) ? 0.35 : 0)
  });
}

function preferCoreInvestorFaqHits(results, query) {
  if (!Array.isArray(results) || !results.length) return results || [];
  if (query && !isInvestorPresentationQuery(query)) return results;
  return boostFaqHitsByAnchors(results, CORE_INVESTOR_FAQ, {
    penaltyRe: /som |казна|безопасна ли/,
    extra: (question) => (/ask|8\.5|1\.9|что покупаю|хочу узнать об инвестициях/.test(question) ? 0.55 : 0)
  });
}

function preferCorePartnerFaqHits(results, query) {
  if (!Array.isArray(results) || !results.length) return results || [];
  if (query && !isPartnerPresentationQuery(query)) return results;
  return boostFaqHitsByAnchors(results, CORE_PARTNER_FAQ, {
    penaltyRe: /казна роялти|som |ask раунда/,
    extra: (question) => (/интересует партн|что делает it|кто вед[её]т продажи/.test(question) ? 0.4 : 0)
  });
}

function pickSourcesForPrompt(results, limit = 3) {
  const list = Array.isArray(results) ? results : [];
  const tables = list.filter(isTableHit);
  const docs = list.filter(isDocumentHit);
  const rest = list.filter((r) => !isTableHit(r) && !isDocumentHit(r));
  const max = Math.max(1, limit);
  // Корпус (pages) должен попадать в промпт, а не вытесняться FAQ-таблицей.
  const tableSlots = Math.min(tables.length, Math.max(1, Math.ceil(max / 2)));
  const docSlots = Math.min(docs.length, Math.max(1, max - tableSlots));
  const picked = [];
  picked.push(...tables.slice(0, tableSlots));
  picked.push(...docs.slice(0, docSlots));
  for (const r of [...tables.slice(tableSlots), ...docs.slice(docSlots), ...rest]) {
    if (picked.length >= max) break;
    if (!picked.includes(r)) picked.push(r);
  }
  return picked.slice(0, max);
}

function preferCorpusPresentationHits(results, query, audienceTags = [], ragHint = null, opts = {}) {
  if (!Array.isArray(results) || !results.length) return results || [];
  const tags = (audienceTags || []).map((t) => String(t).toLowerCase());
  const hint = String(ragHint || '').toLowerCase();
  const isGuest = Boolean(opts.isGuest);
  const wantInvestor = !isGuest && (tags.includes('investor-a') || hint === 'investor' || isInvestorPresentationQuery(query));
  const wantPartner = !isGuest && (tags.includes('partner') || hint === 'partner' || isPartnerPresentationQuery(query));
  const wantClient = !wantInvestor && !wantPartner;
  const wantCompany = hint === 'company';
  return results.map((r) => {
    if (!isDocumentHit(r)) return r;
    const title = String(r.metadata?.title || r.context || '').toLowerCase();
    let boost = 0;
    if (/company-presentation/.test(title)) boost += wantCompany ? 1.4 : 1.1;
    if (/глоссар|glossary|ai-agent-glossary/.test(title)) boost += 1.15;
    if (wantClient && /pub-.*present|os-dle|pub-product/.test(title)) boost += 0.9;
    if (wantInvestor && /inv-a-offer|inv-a-deal|inv-a-thesis/.test(title)) boost += 1.2;
    if (wantPartner && /partner-role|contributor/.test(title)) boost += 1.1;
    const base = Number(r.combinedScore != null ? r.combinedScore : r.score) || 0;
    const next = base + boost;
    return { ...r, combinedScore: next, score: next, corpusBoost: boost };
  }).sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
}

function resolveAllowedCorpusAudiences(assignTagNames = []) {
  const { isModeSlug, canonicalAudience, corpusAudiencesForContext, resolveTurnContext } = require('./assistantTurnContext');
  const tags = (Array.isArray(assignTagNames) ? assignTagNames : [])
    .map((t) => String(t || '').trim().toLowerCase())
    .filter((t) => t && !isModeSlug(t));
  if (!tags.length) return ['public-client'];
  const guestLike = tags.length === 1 && canonicalAudience(tags[0]) === 'public-client';
  const ctx = resolveTurnContext({
    userId: guestLike ? null : 'assign-tags',
    isGuest: guestLike,
    crmTagNames: guestLike ? [] : tags,
    crmTagIds: guestLike ? [] : [1]
  });
  return corpusAudiencesForContext(ctx);
}

function corpusHitAllowedForAudiences(hit, allowedAudiences, opts = {}) {
  if (!hit) return false;
  const guestLike = Boolean(opts.guestLike);
  const allowed = new Set((allowedAudiences || []).map((a) => String(a).toLowerCase()));
  const audiences = hit.metadata?.corpus_audience || hit.corpus_audience || hit.metadata?.userTags || [];
  if (Array.isArray(audiences) && audiences.length) {
    const overlap = audiences.some((a) => allowed.has(String(a).toLowerCase()));
    if (!overlap) return false;
    if (guestLike) {
      const { documentTagsAllowedForGuest } = require('./assistantTurnContext');
      return documentTagsAllowedForGuest(audiences);
    }
    return true;
  }
  const title = String(hit.metadata?.title || hit.context || '');
  if (title.startsWith('[Corpus]')) {
    const id = title.replace(/^\[Corpus\]\s*/i, '').toLowerCase();
    if (id.startsWith('inv-a') || id.includes('investor-a')) return !guestLike && allowed.has('investor-a');
    if (id.startsWith('inv-b') || id.includes('investor-b')) return !guestLike && allowed.has('investor-b');
    if (id.startsWith('partner')) return !guestLike && allowed.has('partner');
    if (id.startsWith('pub-') || id.startsWith('company')) return allowed.has('public-client');
    return false;
  }
  return !guestLike;
}

module.exports = {
  ASK_FORBID_GUEST,
  buildConversationSummary,
  assembleGenerateUserPrompt,
  filterHitsByAssignTags,
  filterHitsByTurnContext,
  effectiveAssignTagNames,
  rowVisibleForUserTags,
  faqQuestionFromHit,
  faqQuestionBoost,
  rerankTableHitsByQuestion,
  pickSourcesForPrompt,
  isTableHit,
  preferCoreProductFaqHits,
  preferCoreInvestorFaqHits,
  preferCorePartnerFaqHits,
  preferCorpusPresentationHits,
  isProductPresentationQuery,
  isInvestorPresentationQuery,
  isPartnerPresentationQuery,
  resolveAllowedCorpusAudiences,
  corpusHitAllowedForAudiences
};
