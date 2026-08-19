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
const USED_FACTS_LIMIT = 6;

const ONGOING_NO_REPEAT_RU =
  'Это продолжение того же звонка. Не повторяй согласие на обработку данных, выбор из трёх тем и приветствие. Не повторяй дословно свои предыдущие ответы и не перечисляй заново те же темы, если абонент уже выбрал направление. Отвечай по сути вопроса.';
const ONGOING_NO_REPEAT_EN =
  'This is the same ongoing call. Do not repeat consent, the three-topic menu, or greeting. Do not repeat your previous answers verbatim and do not restate the same topic menu if the caller already chose a direction. Answer the question directly.';

const QUALITY_FIRST_RU =
  'Если вопрос требует точности, сверки по регламентам, правилам или базе знаний, сначала честно скажи, что тебе нужно немного времени на проверку информации. Качество ответа важнее скорости.';
const QUALITY_FIRST_EN =
  'If the question requires accuracy or checking regulations, rules, or the knowledge base, first say honestly that you need a little time to verify the information. Answer quality matters more than speed.';

const EXPLANATION_LEVEL_RULES = {
  ru: {
    plain: 'Уровень объяснения: простой. Говори без профессионального сленга, коротко, понятными словами. При необходимости мягко предложи: «если хотите, объясню ещё проще или на примере».',
    balanced: 'Уровень объяснения: обычный деловой. Объясняй ясно и уважительно, избегай лишнего профессионального перегруза. Если чувствуешь непонимание, мягко переформулируй проще.',
    expert: 'Уровень объяснения: экспертный. Можно использовать рабочую терминологию, но всё равно без лишних аббревиатур и с уважением. Если собеседник просит проще, сразу упростить.'
  },
  en: {
    plain: 'Explanation level: plain. Speak without professional slang, briefly, in simple words. If needed, gently offer: "If you want, I can explain it even more simply or with an example."',
    balanced: 'Explanation level: balanced business speech. Explain clearly and respectfully, avoiding unnecessary technical overload. If you sense confusion, rephrase more simply.',
    expert: 'Explanation level: expert. You may use professional terminology, but still avoid unnecessary abbreviations and stay respectful. If the caller asks for a simpler version, simplify immediately.'
  }
};

const PACK = {
  ru: {
    role: 'Ты ИИ-агент, администратор компании HB3 Accelerator. Отвечай кратко голосом, своими словами, не читай источники целиком.',
    newSession: 'Историю текстового чата не знаешь — это новая беседа.',
    noFake: 'Не выдумывай цифры и условия, которых нет в справке ниже.',
    noFacts: 'В базе сейчас нет подходящих фактов. Не выдумывай. Предложи уточнить у команды или записаться к сотруднику.',
    replyLang: 'Отвечай только по-русски.',
    humanStyle: 'Говори по-человечески: 1–3 короткие фразы, без канцелярита, без повторов одного и того же смысла в соседних предложениях. Если уже ответил по сути, не начинай ответ заново.',
    qualityFirst: QUALITY_FIRST_RU,
    assistantRules: 'Правила ассистента:',
    kbSnippets: 'Краткая справка из базы знаний:',
    qualify: 'Пока тема не выбрана — не углубляйся в детали условий сделки инвестора и не смешивай офферы. '
      + 'Тема «операционная система и меры поддержки для бизнеса» — контур клиента. '
      + 'Тема «подрядчики» — партнёрский контур. '
      + 'Тема «инвестор» — условия сделки из справки. Цифры только из справки ниже.',
    qualifiedInvestor: 'Абонент выбрал тему инвестора. Можно обсуждать цену запроса, условия сделки и цифры из справки ниже. Не выдумывай отсутствующие суммы. Не повторяй приветствие.',
    qualifiedPartner: 'Абонент выбрал тему подрядчиков / партнёров. Консультируй по условиям сотрудничества из справки. Условия сделки инвестора не раскрывай, пока не выберет тему инвестора. Не повторяй приветствие.',
    qualifiedClient: 'Абонент выбрал тему операционной системы и мер поддержки для бизнеса. Консультируй по продукту и поддержке из справки. Не повторяй приветствие.',
    ongoingNoRepeat: ONGOING_NO_REPEAT_RU
  },
  en: {
    role: 'You are an AI agent and administrator of HB3 Accelerator. Reply briefly by voice, in your own words; do not read sources verbatim.',
    newSession: 'You do not know the text chat history — this is a new call.',
    noFake: 'Do not invent numbers or terms that are not in the knowledge pack below.',
    noFacts: 'There are no matching facts in the knowledge base right now. Do not invent. Offer to clarify with the team or book a staff member.',
    replyLang: 'Reply only in English.',
    humanStyle: 'Speak naturally: 1-3 short sentences, no bureaucratic phrasing, and no repeating the same point in neighboring sentences. If you already answered the question, do not restart the answer.',
    qualityFirst: QUALITY_FIRST_EN,
    assistantRules: 'Assistant rules:',
    kbSnippets: 'Brief knowledge pack:',
    qualify: 'Until a topic is chosen — do not go deep on deal terms for the investor or mix offers. '
      + 'Topic "operating system and business support measures" — client track. '
      + 'Topic "contractors" — partner track. '
      + 'Topic "investor" — deal terms from the pack. Numbers only from the pack below.',
    qualifiedInvestor: 'The caller chose the investor topic. You may discuss the offer ask price, deal terms and figures from the pack below. Do not invent missing amounts. Do not repeat the greeting.',
    qualifiedPartner: 'The caller chose contractors / partners. Consult on partnership terms from the pack. Do not disclose investor deal terms until they choose the investor topic. Do not repeat the greeting.',
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
  'Термины бери из справки базы знаний (глоссарий): говори полными формулировками, как там написано. Не используй буквенные аббревиатуры и сокращения (например, DLE/VC/HB3/ask/DEAL). Если в источнике есть аббревиатура — произноси её расшифровку словами или используй эквивалент из справки.';
const SPEAK_FROM_KB_EN =
  'Take terms from the knowledge glossary: use full wording as written. Do not use letter-based abbreviations and shortcuts (e.g. DLE/VC/HB3/ask/DEAL). If a source contains an abbreviation, spell it out in words or use the equivalent wording from the glossary.';

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

function normalizeBehaviorSettings(raw = {}) {
  return {
    tone: ['neutral', 'business', 'warm'].includes(raw.tone) ? raw.tone : 'business',
    response_length: ['short', 'balanced', 'detailed'].includes(raw.response_length) ? raw.response_length : 'balanced',
    formality: ['strict', 'normal', 'soft'].includes(raw.formality) ? raw.formality : 'normal',
    adapt_to_caller: raw.adapt_to_caller !== false,
    explanation_level_default: ['auto', 'plain', 'balanced', 'expert'].includes(raw.explanation_level_default)
      ? raw.explanation_level_default
      : 'auto',
    allow_gentle_rephrase_offer: raw.allow_gentle_rephrase_offer !== false,
    avoid_jargon_by_default: raw.avoid_jargon_by_default !== false,
    forbid_abbreviations_in_voice: raw.forbid_abbreviations_in_voice !== false,
    allow_professional_terms: ['minimal', 'balanced', 'free'].includes(raw.allow_professional_terms)
      ? raw.allow_professional_terms
      : 'minimal',
    explain_terms_if_needed: raw.explain_terms_if_needed !== false,
    quality_over_speed: raw.quality_over_speed !== false,
    allow_check_kb_phrase: raw.allow_check_kb_phrase !== false,
    fallback_if_not_confident: ['chat', 'staff', 'chat_or_staff'].includes(raw.fallback_if_not_confident)
      ? raw.fallback_if_not_confident
      : 'chat_or_staff',
    forbid_flirty_tone: raw.forbid_flirty_tone !== false,
    forbid_vulgar_tone: raw.forbid_vulgar_tone !== false,
    forbid_patronizing_tone: raw.forbid_patronizing_tone !== false,
    forbid_slang_mirroring: raw.forbid_slang_mirroring !== false
  };
}

function behaviorInstructionParts(locale, rawSettings = {}, explanationLevel = 'balanced') {
  const loc = normalizeCallLocale(locale);
  const settings = normalizeBehaviorSettings(rawSettings);
  const parts = [];

  if (loc === 'en') {
    const toneMap = {
      neutral: 'Tone: neutral, restrained, calm.',
      business: 'Tone: businesslike, respectful, concise.',
      warm: 'Tone: warm and supportive, but still professional.'
    };
    const lengthMap = {
      short: 'Preferred answer length: short by default.',
      balanced: 'Preferred answer length: balanced: brief first, then a little detail if needed.',
      detailed: 'Preferred answer length: more detailed when it truly helps, but still structured.'
    };
    const formalityMap = {
      strict: 'Formality: strict professional tone. No casual familiarity.',
      normal: 'Formality: normal business tone.',
      soft: 'Formality: soft and polite tone without becoming overly familiar.'
    };
    const termsMap = {
      minimal: 'Use as little professional terminology as possible.',
      balanced: 'Use professional terms only when they add clarity.',
      free: 'Professional terms are allowed, but explain them when needed.'
    };
    parts.push(toneMap[settings.tone], lengthMap[settings.response_length], formalityMap[settings.formality], termsMap[settings.allow_professional_terms]);
    if (settings.adapt_to_caller) parts.push('Adapt to the caller respectfully.');
    else parts.push('Keep one stable speaking style and do not mirror the caller.');
    if (settings.explanation_level_default !== 'auto') {
      parts.push(EXPLANATION_LEVEL_RULES.en[settings.explanation_level_default] || EXPLANATION_LEVEL_RULES.en.balanced);
    } else {
      parts.push(EXPLANATION_LEVEL_RULES.en[explanationLevel] || EXPLANATION_LEVEL_RULES.en.balanced);
    }
    if (settings.allow_gentle_rephrase_offer) parts.push('If the caller seems confused, you may gently offer to explain more simply or with an example.');
    if (settings.avoid_jargon_by_default) parts.push('Avoid jargon by default.');
    if (settings.forbid_abbreviations_in_voice) parts.push('Do not speak in abbreviations, letter shortcuts, or compressed labels.');
    if (settings.explain_terms_if_needed) parts.push('If a term is necessary, immediately explain it in simple words.');
    if (settings.quality_over_speed) parts.push('Answer quality matters more than speed.');
    if (settings.allow_check_kb_phrase) parts.push('When accuracy matters, you may briefly say you need a moment to check the knowledge base or rules.');
    if (settings.forbid_flirty_tone) parts.push('Flirty tone is forbidden.');
    if (settings.forbid_vulgar_tone) parts.push('Vulgar or crude tone is forbidden.');
    if (settings.forbid_patronizing_tone) parts.push('Patronizing tone is forbidden.');
    if (settings.forbid_slang_mirroring) parts.push('Do not mirror slang, mistakes, aggression, or inappropriate language.');
  } else {
    const toneMap = {
      neutral: 'Тон: нейтральный, сдержанный, спокойный.',
      business: 'Тон: деловой, уважительный, собранный.',
      warm: 'Тон: тёплый и поддерживающий, но всё равно профессиональный.'
    };
    const lengthMap = {
      short: 'Предпочтительная длина ответа: коротко по умолчанию.',
      balanced: 'Предпочтительная длина ответа: сбалансированно, сначала кратко, затем чуть подробнее при необходимости.',
      detailed: 'Предпочтительная длина ответа: подробнее, если это реально помогает, но без перегруза.'
    };
    const formalityMap = {
      strict: 'Формальность: строго профессионально, без фамильярности.',
      normal: 'Формальность: обычный деловой тон.',
      soft: 'Формальность: мягкий и вежливый тон без панибратства.'
    };
    const termsMap = {
      minimal: 'Профессиональные термины использовать по минимуму.',
      balanced: 'Профессиональные термины использовать только там, где они добавляют ясность.',
      free: 'Профессиональные термины допустимы, но при необходимости их надо сразу объяснять.'
    };
    parts.push(toneMap[settings.tone], lengthMap[settings.response_length], formalityMap[settings.formality], termsMap[settings.allow_professional_terms]);
    if (settings.adapt_to_caller) parts.push('Подстраивайся под собеседника уважительно.');
    else parts.push('Держи единый стабильный стиль и не зеркаль манеру собеседника.');
    if (settings.explanation_level_default !== 'auto') {
      parts.push(EXPLANATION_LEVEL_RULES.ru[settings.explanation_level_default] || EXPLANATION_LEVEL_RULES.ru.balanced);
    } else {
      parts.push(EXPLANATION_LEVEL_RULES.ru[explanationLevel] || EXPLANATION_LEVEL_RULES.ru.balanced);
    }
    if (settings.allow_gentle_rephrase_offer) parts.push('Если собеседнику тяжело, можно мягко предложить объяснить проще или на примере.');
    if (settings.avoid_jargon_by_default) parts.push('Избегай жаргона по умолчанию.');
    if (settings.forbid_abbreviations_in_voice) parts.push('Не говори буквенными аббревиатурами, сокращениями и сжатыми ярлыками.');
    if (settings.explain_terms_if_needed) parts.push('Если термин всё же нужен, сразу объясняй его простыми словами.');
    if (settings.quality_over_speed) parts.push('Качество ответа важнее скорости.');
    if (settings.allow_check_kb_phrase) parts.push('Когда вопрос требует точности, можно коротко сказать, что тебе нужно немного времени на сверку базы знаний или правил.');
    if (settings.forbid_flirty_tone) parts.push('Флиртующий тон запрещён.');
    if (settings.forbid_vulgar_tone) parts.push('Вульгарный и грубый тон запрещён.');
    if (settings.forbid_patronizing_tone) parts.push('Снисходительный тон запрещён.');
    if (settings.forbid_slang_mirroring) parts.push('Не зеркаль сленг, ошибки, агрессию или неуместные выражения.');
  }

  return parts.filter(Boolean);
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
  locale = 'ru',
  latestUserText = '',
  recentAssistantText = '',
  selectedTopic = '',
  complexQuestion = false,
  escalationRecommended = false,
  explanationLevel = 'balanced',
  behaviorSettings = {}
} = {}) {
  const loc = normalizeCallLocale(locale);
  const p = packFor(loc);
  const audience = canonicalAudience(audienceSlug);
  const isGreeting = phase !== 'ongoing';
  const parts = [p.role, p.replyLang, p.humanStyle];

  if (isGreeting) {
    parts.push(wrapCallSystemPrompt(callSystemPrompt, loc));
  } else {
    parts.push(p.ongoingNoRepeat);
  }

  const behavior = normalizeBehaviorSettings(behaviorSettings);
  parts.push(
    p.newSession,
    loc === 'en' ? BARGE_CONTEXT_EN : BARGE_CONTEXT,
    behavior.forbid_abbreviations_in_voice ? (loc === 'en' ? SPEAK_FROM_KB_EN : SPEAK_FROM_KB) : '',
    p.noFake,
    behavior.quality_over_speed ? p.qualityFirst : ''
  );
  parts.push(...behaviorInstructionParts(loc, behavior, explanationLevel));

  const sp = clip(systemPrompt, 1200);
  if (sp) parts.push(`${p.assistantRules}\n${sp}`);
  const rules = clip(rulesText, 800);
  if (rules) parts.push(rules);

  const userNow = clip(latestUserText, 220);
  if (userNow) {
    parts.push(loc === 'en'
      ? `What the caller just asked:\n${userNow}`
      : `Что абонент только что спросил:\n${userNow}`);
  }

  const assistantRecent = clip(recentAssistantText, 260);
  if (assistantRecent) {
    parts.push(loc === 'en'
      ? `What you already told the caller in the previous reply:\n${assistantRecent}\nDo not repeat this verbatim. Only add what moves the conversation forward.`
      : `Что ты уже сказал абоненту в предыдущей реплике:\n${assistantRecent}\nНе повторяй это дословно. Добавляй только то, что двигает разговор дальше.`);
  }

  if (selectedTopic) {
    parts.push(loc === 'en'
      ? `Selected topic in this call: ${selectedTopic}. Do not return to the topic menu unless the caller explicitly asks to switch topics.`
      : `Выбранная тема этого звонка: ${selectedTopic}. Не возвращайся к меню тем, пока абонент сам явно не попросит сменить тему.`);
  }

  if (complexQuestion && !escalationRecommended && behavior.quality_over_speed && behavior.allow_check_kb_phrase) {
    parts.push(loc === 'en'
      ? 'For this question, accuracy matters more than speed. You may briefly say that you need a little time to check the knowledge base, regulations, or rules before answering.'
      : 'Для этого вопроса точность важнее скорости. Можно коротко сказать абоненту, что тебе нужно немного времени, чтобы сверить ответ по базе знаний, регламентам или правилам, и только потом отвечать.');
  }

  if (escalationRecommended) {
    const fallbackMessage = loc === 'en'
      ? {
        chat: 'If the exact answer is not confidently covered by the knowledge pack or the topic is sensitive, do not improvise. Briefly explain that it is better to continue in chat for exact details.',
        staff: 'If the exact answer is not confidently covered by the knowledge pack or the topic is sensitive, do not improvise. Briefly explain that it is better to book a call with a company staff member.',
        chat_or_staff: 'If the exact answer is not confidently covered by the knowledge pack or the topic is sensitive, do not improvise. Briefly explain that it is better to continue in chat for exact details or book a call with a company staff member.'
      }
      : {
        chat: 'Если точного ответа уверенно нет в базе знаний или тема чувствительная, не импровизируй. Коротко объясни, что лучше продолжить в чате для точных деталей.',
        staff: 'Если точного ответа уверенно нет в базе знаний или тема чувствительная, не импровизируй. Коротко объясни, что лучше записаться на звонок с сотрудником компании.',
        chat_or_staff: 'Если точного ответа уверенно нет в базе знаний или тема чувствительная, не импровизируй. Коротко объясни, что лучше продолжить в чате для точных деталей или записаться на звонок с сотрудником компании.'
      };
    parts.push(fallbackMessage[behavior.fallback_if_not_confident] || fallbackMessage.chat_or_staff);
  }

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
    .map((item) => clip(String(item || ''), SNIPPET_LIMIT))
    .filter((text) => text && (!hideDeal || !looksLikeRestrictedDealText(text)))
    .map((text) => normalizeVoiceFaqSnippet(text, loc))
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

function normalizeVoiceFaqSnippet(text, locale) {
  const loc = normalizeCallLocale(locale);
  let s = String(text || '').trim();
  if (!s) return s;
  if (loc === 'ru') {
    s = s.replace(/\bask\b/gi, 'запрос');
    s = s.replace(/\bDEAL\b/gi, 'сделка');
  } else {
    s = s.replace(/\bask\b/gi, 'ask price');
    s = s.replace(/\bDEAL\b/gi, 'deal');
  }
  return s;
}

function canonicalTopicFromAudience(audienceSlug) {
  const audience = canonicalAudience(audienceSlug || 'public-client');
  if (audience === 'partner') return 'partner';
  if (audience === 'investor-a' || audience === 'investor-b') return 'investor';
  return 'client';
}

function looksLikeComplexKnowledgeQuestion(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  return /(регламент|правил|база\s+знаний|документ|договор|услови|точно|уточни|проверь|сколько|какая\s+сумма|какой\s+процент|what\s+exactly|verify|check|regulation|policy|knowledge\s+base|contract|exact|amount|percent)/i.test(s);
}

function looksLikeSensitiveVoiceQuestion(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  return /(юрид|legal|compliance|гарант|обязательств|персональн|индивидуальн|договор|contract|доля|процент|сумм|цена\s+запрос|условия\s+сделк|liability|binding|guarantee|custom|individual|equity|deal terms)/i.test(s);
}

function classifyVoiceQuestion(text) {
  return {
    complex: looksLikeComplexKnowledgeQuestion(text),
    sensitive: looksLikeSensitiveVoiceQuestion(text)
  };
}

function detectExplanationLevel(text, currentLevel = 'balanced') {
  const s = String(text || '').trim();
  if (!s) return currentLevel || 'balanced';
  if (/(простыми\s+словами|проще|не\s+понял|не\s+понимаю|на\s+примере|без\s+термин|для\s+чайник|simpler|plainly|in simple words|without jargon|example|not clear|don't understand)/i.test(s)) {
    return 'plain';
  }
  if (/(регламент|compliance|architecture|integration|api|sdk|contract|liability|policy|pipeline|b2b|roi|unit economics|внедрени|интеграц|архитектур|терминолог|юридическ)/i.test(s)) {
    return 'expert';
  }
  return currentLevel || 'balanced';
}

async function searchCallFaq(turnCtx, query, locale = 'ru') {
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
  const usedFacts = new Set((turnCtx.usedFacts || []).map((item) => clip(String(item || ''), SNIPPET_LIMIT)));
  const snippets = hits.map((r) => {
    const fallback = (r.metadata?.answer && String(r.metadata.answer).trim())
      || (r.metadata?.title && String(r.metadata.title).trim())
      || '';
    const raw = (r.text && String(r.text).trim()) || fallback;
    return normalizeVoiceFaqSnippet(raw, locale);
  }).filter((text) => text && (!hideDeal || !looksLikeRestrictedDealText(text)));

  const freshSnippets = snippets.filter((text) => !usedFacts.has(clip(String(text || ''), SNIPPET_LIMIT)));
  const finalSnippets = freshSnippets.length ? freshSnippets : snippets;

  return { snippets: finalSnippets, systemPrompt: aiSettings?.system_prompt || '', rulesId: aiSettings?.rules_id || null };
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

async function buildCallInstructions(owner, query, {
  audience,
  phase = 'ongoing',
  locale = 'ru',
  latestUserText = '',
  recentAssistantText = '',
  selectedTopic = '',
  usedFacts = [],
  questionProfile = { complex: false, sensitive: false },
  explanationLevel = 'balanced'
} = {}) {
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
      modeSlugs: ['sales'],
      usedFacts
    }, pickStrongerAudience(audience, inferCallAudience(effectiveQuery)));
  }
  turnCtx.usedFacts = usedFacts;

  let snippets = [];
  let systemPrompt = '';
  let rulesId = null;
  try {
    const found = await searchCallFaq(turnCtx, effectiveQuery, loc);
    snippets = found.snippets || [];
    systemPrompt = found.systemPrompt || '';
    rulesId = found.rulesId || null;
  } catch (error) {
    logger.warn('[voiceCallKnowledge] search pack:', error.message);
  }

  const rulesText = await loadRulesText(turnCtx, rulesId);
  const audienceSlug = turnCtx.audienceSlugs?.[0] || 'public-client';
  const spoken = inferCallAudience(effectiveQuery);
  const selectedTopicNow = selectedTopic || canonicalTopicFromAudience(spoken || audienceSlug);
  const complexQuestion = Boolean(questionProfile?.complex);
  const escalationRecommended = Boolean(
    questionProfile?.sensitive
    || (complexQuestion && snippets.length === 0)
  );
  const topicChosen = Boolean(
    selectedTopic
    || turnCtx.hasCrmAudience
    || turnCtx.allowAsk
    || spoken
    || audienceSlug === 'partner'
    || audienceSlug === 'investor-a'
  );
  let callSystemPrompt = '';
  let behaviorSettings = {};
  try {
    const settingsService = require('./voiceCallSettingsService');
    const settings = await settingsService.getSettings();
    const { resolveCallSystemPrompt } = settingsService;
    callSystemPrompt = resolveCallSystemPrompt(settings.system_prompt, loc);
    behaviorSettings = settings;
  } catch (error) {
    logger.warn('[voiceCallKnowledge] call prompt:', error.message);
  }
  const effectiveExplanationLevel = normalizeBehaviorSettings(behaviorSettings).explanation_level_default === 'auto'
    ? explanationLevel
    : normalizeBehaviorSettings(behaviorSettings).explanation_level_default;
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
      locale: loc,
      latestUserText,
      recentAssistantText,
      selectedTopic: selectedTopicNow,
      complexQuestion,
      escalationRecommended,
      explanationLevel: effectiveExplanationLevel,
      behaviorSettings
    }),
    allowAsk: turnCtx.allowAsk,
    isGuest: false,
    audienceSlug,
    selectedTopic: selectedTopicNow,
    usedFacts: snippets.slice(0, USED_FACTS_LIMIT),
    snippetsCount: snippets.length,
    questionProfile,
    escalationRecommended,
    explanationLevel
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
  normalizeBehaviorSettings,
  classifyVoiceQuestion,
  detectExplanationLevel,
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
