/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Знания для голосового звонка: тот же корпус RAG, что у чата, без истории чата.
 * Трубка ≠ анонимный чат: абонента квалифицируют вопросами, гостевой ACL не копируем.
 */

const logger = require('../utils/logger');
const {
  pickAudienceSlug,
  canonicalAudience,
  looksLikeRestrictedDealText
} = require('./assistantTurnContext');

const SNIPPET_LIMIT = 280;
const MAX_HITS = 3;
const MAX_INSTRUCTIONS = 3500;

const START_QUERY_RU = 'кто вы что такое DLE продукт компания для клиента кратко FAQ глоссарий термины';
const START_QUERY_EN = 'who are you what is DLE product company for client brief FAQ glossary terms';

const GREETING_KICK_RU = 'Абонент поднял трубку. Скажи первую реплику по инструкции.';
const GREETING_KICK_EN = 'The caller picked up. Say your first line per the instructions.';

const CALL_INTRO_PREFIX_RU =
  'Первая реплика звонка (скажи сразу, коротко, своим голосом; повторно не представляйся):';
const CALL_INTRO_PREFIX_EN =
  'First line of the call (say it right away, briefly, in your own voice; do not re-introduce yourself):';

/** @deprecated use greetingKickForLocale */
const GREETING_KICK = GREETING_KICK_RU;
/** @deprecated use callIntroPrefixForLocale */
const CALL_INTRO_PREFIX = CALL_INTRO_PREFIX_RU;
const START_QUERY = START_QUERY_RU;

const ONGOING_NO_REPEAT_RU =
  'Это продолжение того же звонка. Не повторяй согласие на обработку данных, выбор из трёх тем и приветствие. Отвечай по сути вопроса.';
const ONGOING_NO_REPEAT_EN =
  'This is the same ongoing call. Do not repeat consent, the three-topic menu, or greeting. Answer the question directly.';

const PACK = {
  ru: {
    role: 'Ты ИИ-агент, администратор компании VC HB3 Accelerator. Отвечай кратко голосом, своими словами, не читай источники целиком.',
    newSession: 'Историю текстового чата не знаешь — это новая беседа.',
    noFake: 'Не выдумывай цифры и условия, которых нет в справке ниже.',
    noFacts: 'В базе сейчас нет подходящих фактов. Не выдумывай. Предложи уточнить у команды или записаться к сотруднику.',
    replyLang: 'Отвечай только по-русски.',
    assistantRules: 'Правила ассистента:',
    kbSnippets: 'Краткая справка из базы знаний:',
    qualify: 'Пока тема не выбрана — не углубляйся в ask/DEAL и не смешивай офферы. '
      + 'Тема «операционная система и меры поддержки для бизнеса» — контур клиента. '
      + 'Тема «подрядчики» — партнёрский контур. '
      + 'Тема «инвестор» — условия сделки из справки. Цифры только из справки ниже.',
    qualifiedInvestor: 'Абонент выбрал тему инвестора. Можно обсуждать ask, DEAL и цифры из справки ниже. Не выдумывай отсутствующие суммы. Не повторяй приветствие.',
    qualifiedPartner: 'Абонент выбрал тему подрядчиков / партнёров. Консультируй по условиям сотрудничества из справки. Ask/DEAL инвестора не раскрывай, пока не выберет тему инвестора. Не повторяй приветствие.',
    qualifiedClient: 'Абонент выбрал тему операционной системы и мер поддержки для бизнеса. Консультируй по продукту и поддержке из справки. Не повторяй приветствие.',
    ongoingNoRepeat: ONGOING_NO_REPEAT_RU
  },
  en: {
    role: 'You are an AI agent and administrator of VC HB3 Accelerator. Reply briefly by voice, in your own words; do not read sources verbatim.',
    newSession: 'You do not know the text chat history — this is a new call.',
    noFake: 'Do not invent numbers or terms that are not in the knowledge pack below.',
    noFacts: 'There are no matching facts in the knowledge base right now. Do not invent. Offer to clarify with the team or book a staff member.',
    replyLang: 'Reply only in English.',
    assistantRules: 'Assistant rules:',
    kbSnippets: 'Brief knowledge pack:',
    qualify: 'Until a topic is chosen — do not go deep on ask/DEAL or mix offers. '
      + 'Topic "operating system and business support measures" — client track. '
      + 'Topic "contractors" — partner track. '
      + 'Topic "investor" — deal terms from the pack. Numbers only from the pack below.',
    qualifiedInvestor: 'The caller chose the investor topic. You may discuss ask, DEAL and figures from the pack below. Do not invent missing amounts. Do not repeat the greeting.',
    qualifiedPartner: 'The caller chose contractors / partners. Consult on partnership terms from the pack. Do not disclose investor ask/DEAL until they choose the investor topic. Do not repeat the greeting.',
    qualifiedClient: 'The caller chose the operating system and business support topic. Consult on product and support from the pack. Do not repeat the greeting.',
    ongoingNoRepeat: ONGOING_NO_REPEAT_EN
  }
};

const BARGE_CONTEXT =
  'Если абонент за время твоей реплики сказал несколько фраз — это один ход. '
  + 'Сложи их смысл и ответь один раз по общему контексту, не отдельным ответом на каждую фразу.';
const BARGE_CONTEXT_EN =
  'If the caller said several phrases during your turn — treat it as one turn. '
  + 'Combine their meaning and reply once, not separately to each phrase.';

const SPEAK_FROM_KB =
  'Термины бери из справки базы знаний (глоссарий): говори полными формулировками, как там написано, без аббревиатур и самодельных сокращений.';
const SPEAK_FROM_KB_EN =
  'Take terms from the knowledge glossary: use full wording as written, no ad-hoc abbreviations.';

/** Legacy exports */
const QUALIFY_CALL = PACK.ru.qualify;
const QUALIFIED_INVESTOR = PACK.ru.qualifiedInvestor;
const QUALIFIED_PARTNER = PACK.ru.qualifiedPartner;
const QUALIFIED_CLIENT = PACK.ru.qualifiedClient;

function normalizeCallLocale(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'en' || s.startsWith('en-') || s.startsWith('en_')) return 'en';
  return 'ru';
}

function packFor(locale) {
  return PACK[normalizeCallLocale(locale)];
}

function getStartQuery(locale) {
  return normalizeCallLocale(locale) === 'en' ? START_QUERY_EN : START_QUERY_RU;
}

function greetingKickForLocale(locale) {
  return normalizeCallLocale(locale) === 'en' ? GREETING_KICK_EN : GREETING_KICK_RU;
}

function callIntroPrefixForLocale(locale) {
  return normalizeCallLocale(locale) === 'en' ? CALL_INTRO_PREFIX_EN : CALL_INTRO_PREFIX_RU;
}

function greetingTurnEvents(locale = 'ru') {
  const kick = greetingKickForLocale(locale);
  return [
    {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: kick }]
      }
    },
    {
      type: 'response.create',
      response: { modalities: ['audio', 'text'] }
    }
  ];
}

function defaultCallSystemPrompt(locale) {
  const { resolveCallSystemPrompt } = require('./voiceCallSettingsService');
  return resolveCallSystemPrompt('', locale);
}

function wrapCallSystemPrompt(text, locale = 'ru') {
  const body = String(text || '').trim() || defaultCallSystemPrompt(locale);
  return `${callIntroPrefixForLocale(locale)}\n${body}`;
}

function clip(text, max) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function inferCallAudience(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  if (/(я\s+)?инвестор|invest(or|ing)|stage\s*a|стейдж\s*a|раунд\s*a|\bask\b|условия\s+сделк|доля\s+инвестор/i.test(s)) {
    return 'investor-a';
  }
  if (/партн[её]р|подрядчик|partnership|контрибьютор|contributor/i.test(s)) {
    return 'partner';
  }
  if (/я\s+(клиент|предприниматель)|для\s+(своей\s+)?компан|внедрить|купить\s+dle|операционн\w*\s+систем|меры\s+поддержк/i.test(s)) {
    return 'public-client';
  }
  return null;
}

function pickStrongerAudience(...slugs) {
  return pickAudienceSlug(slugs.filter(Boolean)) || null;
}

function applyVoiceCallAudience(turnCtx = {}, audience) {
  const slug = pickStrongerAudience(
    ...(turnCtx.audienceSlugs || []),
    audience
  ) || 'public-client';
  const canonical = canonicalAudience(slug);
  const qualified = canonical === 'investor-a' || canonical === 'investor-b' || canonical === 'partner';
  const allowAsk = canonical === 'investor-a';
  const names = new Set(turnCtx.crmTagNames || []);
  if (qualified) names.add(canonical);
  return {
    ...turnCtx,
    isGuest: false,
    hasCrmAudience: qualified || Boolean(turnCtx.hasCrmAudience),
    includeBaseRules: qualified ? false : (turnCtx.includeBaseRules !== false),
    audienceSlugs: [canonical],
    ragHint: canonical === 'investor-a' || canonical === 'investor-b'
      ? 'investor'
      : canonical === 'partner'
        ? 'partner'
        : (turnCtx.ragHint || 'product'),
    allowAsk,
    crmTagNames: [...names],
    modeSlugs: turnCtx.modeSlugs?.length ? turnCtx.modeSlugs : ['sales']
  };
}

function assembleCallInstructions({
  systemPrompt = '',
  callSystemPrompt = '',
  rulesText = '',
  faqSnippets = [],
  allowAsk = false,
  audienceSlug = 'public-client',
  topicChosen = false,
  phase = 'greeting',
  locale = 'ru'
} = {}) {
  const loc = normalizeCallLocale(locale);
  const p = packFor(loc);
  const audience = canonicalAudience(audienceSlug);
  const isGreeting = phase !== 'ongoing';
  const parts = [p.role, p.replyLang];

  if (isGreeting) {
    parts.push(wrapCallSystemPrompt(callSystemPrompt, loc));
  } else {
    parts.push(p.ongoingNoRepeat);
  }

  parts.push(
    p.newSession,
    loc === 'en' ? BARGE_CONTEXT_EN : BARGE_CONTEXT,
    loc === 'en' ? SPEAK_FROM_KB_EN : SPEAK_FROM_KB,
    p.noFake
  );

  const sp = clip(systemPrompt, 1200);
  if (sp) parts.push(`${p.assistantRules}\n${sp}`);
  const rules = clip(rulesText, 800);
  if (rules) parts.push(rules);

  if (allowAsk || audience === 'investor-a') {
    parts.push(p.qualifiedInvestor);
  } else if (audience === 'partner') {
    parts.push(p.qualifiedPartner);
  } else if (topicChosen && audience === 'public-client') {
    parts.push(p.qualifiedClient);
  } else {
    parts.push(p.qualify);
  }

  const hideDeal = !allowAsk;
  const facts = (faqSnippets || [])
    .map((item) => clip(item, SNIPPET_LIMIT))
    .filter((text) => text && (!hideDeal || !looksLikeRestrictedDealText(text)))
    .map((text, idx) => `[${idx + 1}] ${text}`);
  if (facts.length) {
    parts.push(`${p.kbSnippets}\n${facts.join('\n')}`);
  } else {
    parts.push(p.noFacts);
  }

  let out = parts.join('\n\n');
  if (out.length > MAX_INSTRUCTIONS) out = `${out.slice(0, MAX_INSTRUCTIONS)}…`;
  return out;
}

function ownerToUserId(owner = {}) {
  if (owner.ownerType === 'user' && owner.ownerUserId) return Number(owner.ownerUserId);
  if (owner.ownerGuestId) return `guest_${owner.ownerGuestId}`;
  return 'guest_call';
}

async function resolveCallTurn(owner, userQuestion, { audience, locale = 'ru' } = {}) {
  const userContextService = require('./userContextService');
  const { resolveTurnContext } = require('./assistantTurnContext');
  const registered = owner?.ownerType === 'user' && owner.ownerUserId;
  const userId = registered ? Number(owner.ownerUserId) : ownerToUserId(owner);
  let crmTagIds = [];
  let crmTagNames = [];
  if (registered) {
    try {
      crmTagIds = await userContextService.getUserTags(userId) || [];
      crmTagNames = await userContextService.getTagNames(crmTagIds) || [];
    } catch (error) {
      logger.warn('[voiceCallKnowledge] tags:', error.message);
    }
  }
  const loc = normalizeCallLocale(locale);
  const turnCtx = resolveTurnContext({
    userId,
    isGuest: false,
    userQuestion: userQuestion || getStartQuery(loc),
    crmTagIds,
    crmTagNames,
    isGuestId: () => false
  });
  const spoken = inferCallAudience(userQuestion);
  return applyVoiceCallAudience(turnCtx, pickStrongerAudience(audience, spoken));
}

async function searchCallFaq(turnCtx, query) {
  const aiAssistantSettingsService = require('./aiAssistantSettingsService');
  const ragPgvectorService = require('./ragPgvectorService');
  const aiConfigService = require('./aiConfigService');
  const {
    filterHitsByTurnContext,
    rerankTableHitsByQuestion,
    preferCoreProductFaqHits,
    preferCoreInvestorFaqHits,
    preferCorePartnerFaqHits,
    preferCorpusPresentationHits,
    pickSourcesForPrompt
  } = require('./ragPromptAssembly');

  const aiSettings = await aiAssistantSettingsService.getSettings();
  const tableIds = aiSettings?.selected_rag_tables?.length
    ? aiSettings.selected_rag_tables
    : [];
  const ragBehavior = await aiConfigService.getRAGBehavior();
  const searchInDocuments = ragBehavior.searchInDocuments !== false;
  if (!query || (!tableIds.length && !searchInDocuments)) {
    return { snippets: [], systemPrompt: aiSettings?.system_prompt || '' };
  }

  let searchResults = { results: [] };
  try {
    searchResults = await ragPgvectorService.search({
      query,
      tableIds,
      ctx: turnCtx,
      limit: 12
    });
  } catch (error) {
    logger.warn('[voiceCallKnowledge] search:', error.message);
  }
  const filtered = filterHitsByTurnContext(searchResults?.results || [], turnCtx);
  let hits = filtered.emptied ? [] : (filtered.results || []);
  if (hits.length) {
    hits = rerankTableHitsByQuestion(hits, query);
    const hint = turnCtx.ragHint;
    if (turnCtx.allowAsk
      && (hint === 'investor' || turnCtx.audienceSlugs.includes('investor-a'))) {
      hits = preferCoreInvestorFaqHits(hits, query);
    } else if (hint === 'partner' || turnCtx.audienceSlugs.includes('partner')) {
      hits = preferCorePartnerFaqHits(hits, query);
    } else {
      hits = preferCoreProductFaqHits(hits, query);
    }
    hits = preferCorpusPresentationHits(hits, query, turnCtx.audienceSlugs, hint, {
      isGuest: !turnCtx.hasCrmAudience
    });
    hits.sort((a, b) => (Number(b.combinedScore != null ? b.combinedScore : b.score) || 0)
      - (Number(a.combinedScore != null ? a.combinedScore : a.score) || 0));
    hits = pickSourcesForPrompt(hits, MAX_HITS);
  }

  const hideDeal = !turnCtx.allowAsk;
  const snippets = hits.map((r) => {
    const fallback = (r.metadata?.answer && String(r.metadata.answer).trim())
      || (r.metadata?.title && String(r.metadata.title).trim())
      || '';
    return (r.text && String(r.text).trim()) || fallback;
  }).filter((text) => text && (!hideDeal || !looksLikeRestrictedDealText(text)));

  return { snippets, systemPrompt: aiSettings?.system_prompt || '', rulesId: aiSettings?.rules_id || null };
}

async function loadRulesText(turnCtx, rulesId) {
  const aiAssistantRulesService = require('./aiAssistantRulesService');
  try {
    const rules = await aiAssistantRulesService.resolveRulesForUser({
      rulesId,
      tagIds: turnCtx.crmTagIds,
      tagNames: turnCtx.crmTagNames,
      includeBase: turnCtx.includeBaseRules,
      matchTaggedRules: turnCtx.hasCrmAudience,
      audienceSlugs: turnCtx.audienceSlugs,
      modeSlugs: turnCtx.modeSlugs
    });
    return aiAssistantRulesService.formatRulesForSystemPrompt(rules) || '';
  } catch (error) {
    logger.warn('[voiceCallKnowledge] rules:', error.message);
    return '';
  }
}

async function buildCallInstructions(owner, query, { audience, phase = 'ongoing', locale = 'ru' } = {}) {
  const loc = normalizeCallLocale(locale);
  const effectiveQuery = query || getStartQuery(loc);
  let turnCtx;
  try {
    turnCtx = await resolveCallTurn(owner, effectiveQuery, { audience, locale: loc });
  } catch (error) {
    logger.warn('[voiceCallKnowledge] turn:', error.message);
    turnCtx = applyVoiceCallAudience({
      allowAsk: false,
      isGuest: false,
      crmTagIds: [],
      crmTagNames: [],
      includeBaseRules: true,
      hasCrmAudience: false,
      audienceSlugs: ['public-client'],
      modeSlugs: ['sales']
    }, pickStrongerAudience(audience, inferCallAudience(effectiveQuery)));
  }

  let snippets = [];
  let systemPrompt = '';
  let rulesId = null;
  try {
    const found = await searchCallFaq(turnCtx, effectiveQuery);
    snippets = found.snippets || [];
    systemPrompt = found.systemPrompt || '';
    rulesId = found.rulesId || null;
  } catch (error) {
    logger.warn('[voiceCallKnowledge] search pack:', error.message);
  }

  const rulesText = await loadRulesText(turnCtx, rulesId);
  const audienceSlug = turnCtx.audienceSlugs?.[0] || 'public-client';
  const spoken = inferCallAudience(effectiveQuery);
  const topicChosen = Boolean(
    turnCtx.hasCrmAudience
    || turnCtx.allowAsk
    || spoken
    || audienceSlug === 'partner'
    || audienceSlug === 'investor-a'
  );
  let callSystemPrompt = '';
  try {
    const settingsService = require('./voiceCallSettingsService');
    const settings = await settingsService.getSettings();
    const { resolveCallSystemPrompt } = settingsService;
    callSystemPrompt = resolveCallSystemPrompt(settings.system_prompt, loc);
  } catch (error) {
    logger.warn('[voiceCallKnowledge] call prompt:', error.message);
  }
  return {
    instructions: assembleCallInstructions({
      systemPrompt,
      callSystemPrompt,
      rulesText,
      faqSnippets: snippets,
      allowAsk: turnCtx.allowAsk,
      audienceSlug,
      topicChosen,
      phase,
      locale: loc
    }),
    allowAsk: turnCtx.allowAsk,
    isGuest: false,
    audienceSlug,
    snippetsCount: snippets.length
  };
}

function extractUserTranscript(event) {
  if (!event || typeof event !== 'object') return '';
  const t = String(event.type || '');
  if (!t.includes('input_audio_transcription') || !t.endsWith('completed')) return '';
  const fromItem = Array.isArray(event.item?.content)
    ? event.item.content.map((c) => c?.transcript || c?.text || '').join(' ')
    : '';
  return String(event.transcript || event.text || event.item?.transcript || fromItem || '').trim();
}

function buildOmniSession(instructions, { transcribe = true, locale = 'ru' } = {}) {
  const session = {
    modalities: ['audio', 'text'],
    instructions,
    input_audio_format: 'pcm',
    output_audio_format: 'pcm',
    turn_detection: {
      type: 'server_vad',
      silence_duration_ms: 800,
      interrupt_response: false
    }
  };
  if (transcribe) {
    session.input_audio_transcription = { model: 'qwen3-asr-flash-realtime' };
  }
  return session;
}

module.exports = {
  START_QUERY,
  START_QUERY_RU,
  START_QUERY_EN,
  CALL_INTRO_PREFIX,
  GREETING_KICK,
  GREETING_KICK_RU,
  GREETING_KICK_EN,
  BARGE_CONTEXT,
  SPEAK_FROM_KB,
  QUALIFY_CALL,
  QUALIFIED_INVESTOR,
  ONGOING_NO_REPEAT_RU,
  normalizeCallLocale,
  getStartQuery,
  greetingKickForLocale,
  wrapCallSystemPrompt,
  assembleCallInstructions,
  buildCallInstructions,
  extractUserTranscript,
  buildOmniSession,
  greetingTurnEvents,
  ownerToUserId,
  inferCallAudience,
  pickStrongerAudience,
  applyVoiceCallAudience
};
