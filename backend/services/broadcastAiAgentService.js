/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * ИИ-агент персонализации рассылки:
 * меняет ТОЛЬКО subject + greeting; body / signature / legal_footer склеиваются вне LLM.
 */

const axios = require('axios');
const OpenAI = require('openai');
const logger = require('../utils/logger');
const db = require('../db');
const ollamaConfig = require('./ollamaConfig');
const aiProviderSettingsService = require('./aiProviderSettingsService');
const userContactFilesService = require('./userContactFilesService');
const aiQueue = require('./ai-queue');
const { PRIORITY } = require('./ai-queue');
const {
  composeEmailBody,
  resolveGreeting,
  DEFAULT_GREETING
} = require('../utils/broadcastEmailCompose');

/** Дефолты-примеры для UI и для пустой БД (не «жёсткий runtime-хардкод»). */
const DEFAULTS = {
  enabled: false,
  provider: 'ollama',
  model: null,
  temperature: 0.3,
  max_tokens: 400,
  // 7 минут — середина рекомендуемого окна 6–8 мин на CPU
  timeout_ms: 420000,
  system_prompt: `Ты — агент персонализации B2B email-рассылки.
Письмо состоит из блоков: subject, greeting, body, signature, legal_footer.
Ты меняешь ТОЛЬКО subject и greeting. Body, signature и legal_footer тебе запрещено переписывать или возвращать.

Правила (строго):
1. Используй ТОЛЬКО факты из PROFILE / RECIPIENT_NAME. Ничего не выдумывай.
2. RECIPIENT_NAME — единственное обращение к получателю. Вставь его ДОСЛОВНО в greeting (и желательно кратко в subject).
3. Не делай subject из одного приветствия («Здравствуйте, …»). Сохрани смысл TEMPLATE_SUBJECT.
4. Greeting — одна короткая строка/абзац приветствия (например: «Здравствуйте, команда <name>!»).
5. OFFER_BODY дан только как контекст темы — не копируй его в ответ.
6. Если RECIPIENT_NAME пуст — нейтральное «Здравствуйте!» и тема почти без изменений.
7. Язык = язык шаблона.
8. Верни строго JSON одной строкой: {"subject":"...","greeting":"..."} без markdown.`
};

const DEFAULT_SYSTEM_PROMPT = DEFAULTS.system_prompt;

/** Мягкие границы валидации при сохранении (не фиксированный runtime). */
const LIMITS = {
  temperatureMin: 0,
  temperatureMax: 2,
  maxTokensMin: 50,
  maxTokensMax: 8000,
  timeoutMsMin: 60000,   // 1 мин
  timeoutMsMax: 1800000  // 30 мин
};

function getEncryptionKey() {
  const encryptionUtils = require('../utils/encryptionUtils');
  return encryptionUtils.getEncryptionKey();
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function normalizeSettingsRow(row = {}) {
  return {
    enabled: Boolean(row.enabled),
    provider: row.provider || DEFAULTS.provider,
    model: row.model || null,
    system_prompt: row.system_prompt || DEFAULTS.system_prompt,
    temperature: clampNumber(row.temperature, LIMITS.temperatureMin, LIMITS.temperatureMax, DEFAULTS.temperature),
    max_tokens: clampNumber(row.max_tokens, LIMITS.maxTokensMin, LIMITS.maxTokensMax, DEFAULTS.max_tokens),
    timeout_ms: clampNumber(row.timeout_ms, LIMITS.timeoutMsMin, LIMITS.timeoutMsMax, DEFAULTS.timeout_ms),
    updated_at: row.updated_at || null,
    updated_by: row.updated_by || null
  };
}

function getDefaults() {
  return { ...DEFAULTS, limits: { ...LIMITS } };
}

async function getSettings() {
  const encryptionKey = getEncryptionKey();
  const { rows } = await db.getQuery()(
    `SELECT
       id, enabled, provider, model, temperature, max_tokens, timeout_ms, updated_at, updated_by,
       CASE
         WHEN system_prompt_encrypted IS NULL OR system_prompt_encrypted = '' THEN NULL
         ELSE decrypt_text(system_prompt_encrypted, $1)
       END AS system_prompt
     FROM broadcast_ai_agent_settings
     WHERE id = 1`,
    [encryptionKey]
  );

  if (!rows.length) {
    return normalizeSettingsRow(DEFAULTS);
  }

  return normalizeSettingsRow(rows[0]);
}

async function saveSettings(payload = {}, updatedBy = null) {
  const encryptionKey = getEncryptionKey();
  const current = await getSettings();

  const enabled = payload.enabled !== undefined ? Boolean(payload.enabled) : current.enabled;
  const provider = String(payload.provider || current.provider || DEFAULTS.provider).trim().toLowerCase();
  const model = payload.model !== undefined
    ? (payload.model ? String(payload.model).trim() : null)
    : current.model;
  const systemPrompt = payload.system_prompt !== undefined
    ? String(payload.system_prompt || '').trim() || DEFAULTS.system_prompt
    : current.system_prompt;
  const temperature = payload.temperature !== undefined
    ? clampNumber(payload.temperature, LIMITS.temperatureMin, LIMITS.temperatureMax, DEFAULTS.temperature)
    : current.temperature;
  const maxTokens = payload.max_tokens !== undefined
    ? clampNumber(payload.max_tokens, LIMITS.maxTokensMin, LIMITS.maxTokensMax, DEFAULTS.max_tokens)
    : current.max_tokens;
  const timeoutMs = payload.timeout_ms !== undefined
    ? clampNumber(payload.timeout_ms, LIMITS.timeoutMsMin, LIMITS.timeoutMsMax, DEFAULTS.timeout_ms)
    : current.timeout_ms;

  await db.getQuery()(
    `INSERT INTO broadcast_ai_agent_settings (
       id, enabled, provider, model, system_prompt_encrypted, temperature, max_tokens, timeout_ms, updated_at, updated_by
     ) VALUES (
       1, $1, $2, $3,
       CASE WHEN $4::text IS NULL THEN NULL ELSE encrypt_text($4, $8) END,
       $5, $6, $7, NOW(), $9
     )
     ON CONFLICT (id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       provider = EXCLUDED.provider,
       model = EXCLUDED.model,
       system_prompt_encrypted = EXCLUDED.system_prompt_encrypted,
       temperature = EXCLUDED.temperature,
       max_tokens = EXCLUDED.max_tokens,
       timeout_ms = EXCLUDED.timeout_ms,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [enabled, provider, model, systemPrompt, temperature, maxTokens, timeoutMs, encryptionKey, updatedBy]
  );

  return getSettings();
}

async function getContactProfile(userId) {
  const uid = Number(userId);
  if (!Number.isInteger(uid) || uid <= 0) {
    throw new Error('Invalid user ID');
  }

  const encryptionKey = getEncryptionKey();
  const userResult = await db.getQuery()(
    `SELECT id, role, preferred_language, is_blocked,
       CASE WHEN first_name_encrypted IS NULL OR first_name_encrypted = '' THEN NULL
            ELSE decrypt_text(first_name_encrypted, $2) END AS first_name,
       CASE WHEN last_name_encrypted IS NULL OR last_name_encrypted = '' THEN NULL
            ELSE decrypt_text(last_name_encrypted, $2) END AS last_name
     FROM users WHERE id = $1`,
    [uid, encryptionKey]
  );

  if (!userResult.rows.length) {
    throw new Error('Contact not found');
  }

  const user = userResult.rows[0];
  const identities = await db.getQuery()(
    `SELECT decrypt_text(provider_encrypted, $2) AS provider,
            decrypt_text(provider_id_encrypted, $2) AS provider_id
     FROM user_identities WHERE user_id = $1`,
    [uid, encryptionKey]
  );

  const identityMap = {};
  for (const row of identities.rows) {
    identityMap[row.provider] = row.provider_id;
  }

  const tagsResult = await db.getQuery()(
    'SELECT tag_id FROM user_tag_links WHERE user_id = $1 ORDER BY tag_id',
    [uid]
  );

  const extrasMap = await userContactFilesService.getContactExtrasMapForUserIds([uid], encryptionKey);
  const extras = extrasMap[uid] || { comment: null, link: null, files: [] };
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || null;

  return {
    id: user.id,
    name,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    email: identityMap.email || null,
    telegram: identityMap.telegram || null,
    wallet: identityMap.wallet || null,
    preferred_language: user.preferred_language || [],
    is_blocked: Boolean(user.is_blocked),
    tag_ids: tagsResult.rows.map((r) => r.tag_id),
    comment: extras.comment,
    link: extras.link,
    files_count: Array.isArray(extras.files) ? extras.files.length : 0
  };
}

const ORG_PREFIXES = new Set(['ооо', 'ао', 'зао', 'пао', 'ип', 'оао', 'нко']);

function normalizeRecipientName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[«»""„“]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function recipientNameTokens(name) {
  return normalizeRecipientName(name)
    .split(/[\s.,/|]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !ORG_PREFIXES.has(t));
}

/** Проверка: в тексте есть имя/название получателя из профиля. */
function textIncludesRecipientName(text, name) {
  if (!name) return true;
  const hay = normalizeRecipientName(text);
  const needle = normalizeRecipientName(name);
  if (!needle) return true;
  if (hay.includes(needle)) return true;
  const tokens = recipientNameTokens(name);
  if (!tokens.length) return hay.includes(needle);
  // Для «ООО "ГЭК"» достаточно значимого токена «гэк»
  return tokens.every((tok) => hay.includes(tok));
}

/**
 * Детерминированная правка только subject + greeting (без LLM).
 */
function applyDeterministicSubjectGreeting({ profile, subject, greeting }) {
  const name = String(profile?.name || '').trim();
  let nextSubject = String(subject || '').trim() || 'Новое сообщение';
  let nextGreeting = resolveGreeting(greeting);

  if (!name) {
    return { subject: nextSubject, greeting: nextGreeting };
  }

  if (!textIncludesRecipientName(nextSubject, name)) {
    nextSubject = `${name}: ${nextSubject}`.slice(0, 180).trim();
  }

  const greetingRe = /^(здравствуйте|добрый день|доброе утро|добрый вечер)([!,.\s]*)$/i;
  if (greetingRe.test(nextGreeting.trim())) {
    const greet = nextGreeting.trim().match(greetingRe)[1];
    nextGreeting = `${greet}, ${name}!`;
  } else if (!textIncludesRecipientName(nextGreeting, name)) {
    nextGreeting = `Здравствуйте, ${name}!`;
  }

  return { subject: nextSubject, greeting: nextGreeting };
}

/** @deprecated совместимость со старыми тестами — делегирует в subject/greeting */
function applyDeterministicPersonalization({ profile, subject, body, greeting }) {
  const baseGreeting = greeting != null ? greeting : (body || DEFAULT_GREETING);
  const { subject: s, greeting: g } = applyDeterministicSubjectGreeting({
    profile,
    subject,
    greeting: baseGreeting
  });
  return { subject: s, greeting: g, body: g };
}

/**
 * Отбраковка ответа LLM по subject + greeting.
 */
function validatePersonalizedOutput({
  subject,
  greeting,
  body,
  profile,
  templateSubject
}) {
  const name = String(profile?.name || '').trim();
  const outSubject = String(subject || '').trim();
  const outGreeting = String(greeting != null ? greeting : body || '').trim();

  if (!outSubject || !outGreeting) {
    return { ok: false, reason: 'empty_output' };
  }

  if (/^(здравствуйте|добрый день|доброе утро|добрый вечер)\b/i.test(outSubject)
      && outSubject.length < 48) {
    return { ok: false, reason: 'subject_is_greeting' };
  }

  if (name && !textIncludesRecipientName(outSubject, name)
      && !textIncludesRecipientName(outGreeting, name)) {
    return { ok: false, reason: 'missing_recipient_name' };
  }

  const tplSub = String(templateSubject || '').trim();
  if (tplSub.length >= 12) {
    const tplTokens = normalizeRecipientName(tplSub)
      .split(/[\s:,\-–—]+/)
      .filter((t) => t.length >= 4)
      .slice(0, 4);
    const subNorm = normalizeRecipientName(outSubject);
    const kept = tplTokens.filter((t) => subNorm.includes(t)).length;
    if (tplTokens.length >= 2 && kept === 0 && !textIncludesRecipientName(outSubject, name)) {
      return { ok: false, reason: 'subject_unrelated' };
    }
  }

  return { ok: true, reason: 'ok' };
}

function buildUserPrompt({ profile, subject, greeting, body }) {
  const compactProfile = {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    telegram: profile.telegram,
    comment: profile.comment,
    link: profile.link,
    tag_ids: profile.tag_ids,
    lang: profile.preferred_language
  };

  const recipientName = profile.name || '(пусто — нейтральное обращение)';

  return [
    `RECIPIENT_NAME: ${recipientName}`,
    `TEMPLATE_SUBJECT: ${subject}`,
    `TEMPLATE_GREETING: ${resolveGreeting(greeting)}`,
    `OFFER_BODY (context only, do not rewrite): ${String(body || '').slice(0, 1200)}`,
    `PROFILE: ${JSON.stringify(compactProfile)}`,
    'Верни только JSON {"subject":"...","greeting":"..."}.'
  ].join('\n');
}

function parseJsonResponse(raw) {
  if (!raw) throw new Error('Empty LLM response');
  let text = String(raw).trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  }
  const parsed = JSON.parse(text);
  const subject = String(parsed.subject || '').trim();
  // greeting предпочтителен; legacy body как greeting — на случай старого промпта в БД
  const greeting = String(parsed.greeting || parsed.body || '').trim();
  if (!subject || !greeting) {
    throw new Error('LLM JSON missing subject/greeting');
  }
  // Если модель вернула огромный «greeting» (= весь letter) — отбракуем выше по validate / fallback
  return { subject, greeting };
}

/** Очередь LLM: превью и prepare не должны бить Ollama параллельно. */
let llmQueue = Promise.resolve();

function enqueueLlmTask(task) {
  const run = llmQueue.then(() => task(), () => task());
  llmChainSoftFail(run);
  return run;
}

function llmChainSoftFail(run) {
  llmQueue = run.then(() => undefined, () => undefined);
}

async function forceUnloadOllamaModel(model) {
  try {
    const ollamaUrl = await ollamaConfig.getBaseUrlAsync();
    // keep_alive: 0 выгружает модель и сбрасывает «зависшую» генерацию на CPU
    await axios.post(`${ollamaUrl}/api/generate`, {
      model,
      prompt: '',
      keep_alive: 0,
      stream: false
    }, { timeout: 8000 });
  } catch (_) {
    // best-effort
  }
}

async function callOllama({
  model,
  systemPrompt,
  userPrompt,
  temperature,
  maxTokens,
  timeoutMs
}) {
  const predict = Math.max(1, Number(maxTokens) || DEFAULTS.max_tokens);
  const timeout = clampNumber(timeoutMs, LIMITS.timeoutMsMin, LIMITS.timeoutMsMax, DEFAULTS.timeout_ms);

  try {
    const content = await aiQueue.addTask({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model,
      llmParameters: {
        temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : DEFAULTS.temperature,
        maxTokens: predict
      },
      qwenParameters: { format: 'json' },
      returnFullResponse: false,
      priority: PRIORITY.BROADCAST,
      timeoutMs: timeout
    });
    return content || '';
  } catch (error) {
    const { classifyBroadcastLlmError } = require('../utils/broadcastOllamaErrors');
    const { isQueueWaitTimeout, isPreemptAbort, isOllamaTimeout } =
      classifyBroadcastLlmError(error);
    // Unload только при реальном timeout Ollama — не при preempt CHAT (message=aborted)
    if (isOllamaTimeout) {
      await forceUnloadOllamaModel(model);
      throw new Error(
        `Ollama не ответила за ${Math.round(timeout / 1000)}с (модель ${model}). `
        + 'Увеличьте таймаут в настройках агента или выберите более лёгкую модель.'
      );
    }
    if (isQueueWaitTimeout) {
      throw new Error(
        `Очередь AI перегружена: не дождались слота за ${Math.round(timeout / 1000)}с. Повторите позже.`
      );
    }
    if (isPreemptAbort) {
      throw new Error('Broadcast LLM прерван приоритетным чатом');
    }
    throw error;
  }
}

async function callOpenAICompatible({ providerSettings, model, systemPrompt, userPrompt, temperature, maxTokens, timeoutMs }) {
  const client = new OpenAI({
    apiKey: providerSettings.api_key,
    baseURL: providerSettings.base_url || undefined,
    timeout: clampNumber(timeoutMs, LIMITS.timeoutMsMin, LIMITS.timeoutMsMax, DEFAULTS.timeout_ms)
  });
  const response = await client.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  });
  return response.choices?.[0]?.message?.content || '';
}

async function callAnthropic({ providerSettings, model, systemPrompt, userPrompt, temperature, maxTokens, timeoutMs }) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({
    apiKey: providerSettings.api_key,
    baseURL: providerSettings.base_url || undefined,
    timeout: clampNumber(timeoutMs, LIMITS.timeoutMsMin, LIMITS.timeoutMsMax, DEFAULTS.timeout_ms)
  });
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: [{ role: 'user', content: `${userPrompt}\n\nОтветь только JSON.` }]
  });
  const textBlock = (response.content || []).find((part) => part.type === 'text');
  return textBlock?.text || '';
}

async function generateWithLlm({ settings, profile, subject, greeting, body }) {
  const provider = settings.provider || DEFAULTS.provider;
  const model = settings.model || (provider === 'ollama' ? await ollamaConfig.getDefaultModelAsync() : null);
  if (!model) {
    throw new Error('Модель не выбрана');
  }

  const systemPrompt = settings.system_prompt || DEFAULTS.system_prompt;
  const userPrompt = buildUserPrompt({ profile, subject, greeting, body });
  const temperature = Number.isFinite(Number(settings.temperature))
    ? Number(settings.temperature)
    : DEFAULTS.temperature;
  const maxTokens = Number(settings.max_tokens) > 0
    ? Number(settings.max_tokens)
    : DEFAULTS.max_tokens;
  const timeoutMs = Number(settings.timeout_ms) > 0
    ? Number(settings.timeout_ms)
    : DEFAULTS.timeout_ms;

  const run = async () => {
    let raw = '';
    if (provider === 'ollama') {
      raw = await callOllama({
        model,
        systemPrompt,
        userPrompt,
        temperature,
        maxTokens,
        timeoutMs
      });
    } else if (provider === 'openai' || provider === 'google') {
      const providerSettings = await aiProviderSettingsService.getProviderSettings(provider);
      if (!providerSettings?.api_key) {
        throw new Error(`API-ключ для ${provider} не настроен в Settings → AI`);
      }
      raw = await callOpenAICompatible({
        providerSettings,
        model,
        systemPrompt,
        userPrompt,
        temperature,
        maxTokens,
        timeoutMs
      });
    } else if (provider === 'anthropic') {
      const providerSettings = await aiProviderSettingsService.getProviderSettings(provider);
      if (!providerSettings?.api_key) {
        throw new Error('API-ключ для anthropic не настроен в Settings → AI');
      }
      raw = await callAnthropic({
        providerSettings,
        model,
        systemPrompt,
        userPrompt,
        temperature,
        maxTokens,
        timeoutMs
      });
    } else {
      throw new Error(`Неизвестный провайдер: ${provider}`);
    }

    return parseJsonResponse(raw);
  };

  if (provider === 'ollama') {
    return run();
  }
  return enqueueLlmTask(run);
}

function buildPersonalizedResult({
  subject,
  greeting,
  offerBody,
  signature,
  legalFooter,
  fingerprint = '',
  personalized,
  reason,
  profile,
  extra = {}
}) {
  const finalGreeting = resolveGreeting(greeting);
  const token = String(fingerprint || '').trim();
  const composed = composeEmailBody({
    greeting: finalGreeting,
    body: offerBody,
    signature,
    legalFooter,
    fingerprint: token
  });
  return {
    subject,
    greeting: finalGreeting,
    body: composed,
    fingerprint: token || null,
    parts: {
      greeting: finalGreeting,
      body: String(offerBody || '').trim(),
      signature: String(signature || '').trim(),
      legal_footer: String(legalFooter || '').trim(),
      fingerprint: token || null
    },
    personalized,
    reason,
    profile,
    ...extra
  };
}

async function personalizeForRecipient({
  userId,
  subject,
  greeting = DEFAULT_GREETING,
  body,
  signature = '',
  legalFooter = '',
  fingerprint = '',
  settings: settingsOverride = null,
  fallbackOnError = true
}) {
  const templateSubject = String(subject || '').trim() || 'Новое сообщение';
  const templateGreeting = resolveGreeting(greeting);
  const offerBody = String(body || '').trim();
  const templateSignature = String(signature || '').trim();
  const templateLegal = String(legalFooter || '').trim();
  const {
    generateUniqueToken
  } = require('../utils/broadcastEmailCompose');
  const uniqueToken = String(fingerprint || '').trim() || generateUniqueToken();

  if (!offerBody) {
    throw new Error('Пустой шаблон сообщения (тело письма)');
  }

  const settings = settingsOverride || await getSettings();
  const profile = await getContactProfile(userId);

  const asTemplate = (reason) => buildPersonalizedResult({
    subject: templateSubject,
    greeting: templateGreeting,
    offerBody,
    signature: templateSignature,
    legalFooter: templateLegal,
    fingerprint: uniqueToken,
    personalized: false,
    reason,
    profile
  });

  if (profile.is_blocked) {
    return asTemplate('blocked');
  }

  if (!settings.enabled) {
    return asTemplate('agent_disabled');
  }

  try {
    const generated = await generateWithLlm({
      settings,
      profile,
      subject: templateSubject,
      greeting: templateGreeting,
      body: offerBody
    });

    // Отсекаем «greeting = целое письмо»
    const greetingTooLong = generated.greeting.length > Math.max(280, templateGreeting.length * 4);
    const check = greetingTooLong
      ? { ok: false, reason: 'greeting_too_long' }
      : validatePersonalizedOutput({
        subject: generated.subject,
        greeting: generated.greeting,
        profile,
        templateSubject
      });

    if (check.ok) {
      return buildPersonalizedResult({
        subject: generated.subject,
        greeting: generated.greeting,
        offerBody,
        signature: templateSignature,
        legalFooter: templateLegal,
        fingerprint: uniqueToken,
        personalized: true,
        reason: 'ok',
        profile
      });
    }

    logger.warn(
      `[BroadcastAiAgent] LLM output rejected for user ${userId}: ${check.reason}; `
      + 'using deterministic subject/greeting'
    );
    const fallback = applyDeterministicSubjectGreeting({
      profile,
      subject: templateSubject,
      greeting: templateGreeting
    });
    return buildPersonalizedResult({
      subject: fallback.subject,
      greeting: fallback.greeting,
      offerBody,
      signature: templateSignature,
      legalFooter: templateLegal,
      fingerprint: uniqueToken,
      personalized: true,
      reason: `fallback_${check.reason}`,
      profile,
      extra: { llm_rejected: check.reason }
    });
  } catch (error) {
    logger.warn(`[BroadcastAiAgent] Personalize failed for user ${userId}: ${error.message}`);
    if (!fallbackOnError) {
      throw error;
    }
    const fallback = applyDeterministicSubjectGreeting({
      profile,
      subject: templateSubject,
      greeting: templateGreeting
    });
    const usedDeterministic = Boolean(profile?.name)
      && (fallback.subject !== templateSubject || fallback.greeting !== templateGreeting);
    return buildPersonalizedResult({
      subject: fallback.subject,
      greeting: fallback.greeting,
      offerBody,
      signature: templateSignature,
      legalFooter: templateLegal,
      fingerprint: uniqueToken,
      personalized: usedDeterministic,
      reason: usedDeterministic ? 'fallback_llm_error' : 'llm_error',
      profile,
      extra: { error: error.message }
    });
  }
}

async function listAvailableModels() {
  const models = await aiProviderSettingsService.getAllLLMModels();
  const unique = [];
  const seen = new Set();
  for (const item of models) {
    const key = `${item.provider}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

module.exports = {
  DEFAULTS,
  DEFAULT_SYSTEM_PROMPT,
  LIMITS,
  getDefaults,
  getSettings,
  saveSettings,
  getContactProfile,
  personalizeForRecipient,
  listAvailableModels,
  textIncludesRecipientName,
  validatePersonalizedOutput,
  applyDeterministicPersonalization,
  applyDeterministicSubjectGreeting,
  buildUserPrompt,
  composeEmailBody,
  resolveGreeting
};
