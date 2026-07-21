/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * ИИ-агент персонализации рассылки:
 * шаблон + профиль контакта (без сайта и без RAG).
 * Все рабочие параметры — из настроек (UI / БД), с дефолтами-примерами.
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

/** Дефолты-примеры для UI и для пустой БД (не «жёсткий runtime-хардкод»). */
const DEFAULTS = {
  enabled: false,
  provider: 'ollama',
  model: null,
  temperature: 0.3,
  max_tokens: 800,
  // 7 минут — середина рекомендуемого окна 6–8 мин на CPU
  timeout_ms: 420000,
  system_prompt: `Ты — агент персонализации B2B email-рассылки.
Твоя задача: адаптировать готовый шаблон письма под конкретного получателя.

Правила (строго):
1. Используй ТОЛЬКО факты из блока PROFILE. Ничего не выдумывай.
2. Не добавляй факты о компании, рынке, цифрах, услугах получателя, которых нет в PROFILE.
3. Сохрани смысл, оффер и CTA шаблона. Можно перефразировать приветствие и 1–2 предложения.
4. Если в PROFILE есть name:
   - вставь name ДОСЛОВНО (без замены АО↔ООО и без сокращений) и в subject, и в body;
   - в body — в приветствии или первом абзаце (например: «Добрый день, команда <name>!»);
   - в subject — кратко упомяни name или начни с обращения к name, сохранив смысл исходной темы.
5. Если есть link — можно упомянуть сайт из link в body (без выдуманных деталей о сайте).
6. Не оставляй голое «Добрый день!» в body, если name заполнен. Не переноси приветствие только в subject.
7. Если name и link пусты — верни шаблон почти без изменений, с нейтральным обращением.
8. Язык ответа = язык шаблона.
9. Верни строго JSON одной строкой: {"subject":"...","body":"..."} без markdown.`
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

function buildUserPrompt({ profile, subject, body }) {
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

  return [
    `TEMPLATE_SUBJECT: ${subject}`,
    `TEMPLATE_BODY: ${body}`,
    `PROFILE: ${JSON.stringify(compactProfile)}`,
    'Верни только JSON {"subject":"...","body":"..."}.'
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
  const body = String(parsed.body || '').trim();
  if (!subject || !body) {
    throw new Error('LLM JSON missing subject/body');
  }
  return { subject, body };
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

async function generateWithLlm({ settings, profile, subject, body }) {
  const provider = settings.provider || DEFAULTS.provider;
  const model = settings.model || (provider === 'ollama' ? await ollamaConfig.getDefaultModelAsync() : null);
  if (!model) {
    throw new Error('Модель не выбрана');
  }

  const systemPrompt = settings.system_prompt || DEFAULTS.system_prompt;
  const userPrompt = buildUserPrompt({ profile, subject, body });
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

  // Ollama уже сериализуется глобальной AIQueue; внешние API — локальной цепочкой
  if (provider === 'ollama') {
    return run();
  }
  return enqueueLlmTask(run);
}

async function personalizeForRecipient({
  userId,
  subject,
  body,
  settings: settingsOverride = null,
  fallbackOnError = true
}) {
  const templateSubject = String(subject || '').trim() || 'Новое сообщение';
  const templateBody = String(body || '').trim();
  if (!templateBody) {
    throw new Error('Пустой шаблон сообщения');
  }

  const settings = settingsOverride || await getSettings();
  const profile = await getContactProfile(userId);

  if (profile.is_blocked) {
    return {
      subject: templateSubject,
      body: templateBody,
      personalized: false,
      reason: 'blocked',
      profile
    };
  }

  if (!settings.enabled) {
    return {
      subject: templateSubject,
      body: templateBody,
      personalized: false,
      reason: 'agent_disabled',
      profile
    };
  }

  try {
    const generated = await generateWithLlm({
      settings,
      profile,
      subject: templateSubject,
      body: templateBody
    });
    return {
      subject: generated.subject,
      body: generated.body,
      personalized: true,
      reason: 'ok',
      profile
    };
  } catch (error) {
    logger.warn(`[BroadcastAiAgent] Personalize failed for user ${userId}: ${error.message}`);
    if (!fallbackOnError) {
      throw error;
    }
    return {
      subject: templateSubject,
      body: templateBody,
      personalized: false,
      reason: 'llm_error',
      error: error.message,
      profile
    };
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
  listAvailableModels
};
