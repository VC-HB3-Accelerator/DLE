/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Live-состояние конференции: coach, mute, ephemeral Realtime, RAG tool.
 */

const db = require('../db');
const logger = require('../utils/logger');
const conferenceService = require('./conferenceService');
const conferenceAiAgentService = require('./conferenceAiAgentService');
const aiProviderSettingsService = require('./aiProviderSettingsService');
const multiSourceSearchService = require('./multiSourceSearchService');
const openaiProxy = require('./openaiProxy');

/** runtime state: conferenceId → { agentRunning, agentMuted, pendingCommands[] } */
const liveState = new Map();

function getEncryptionKey() {
  const encryptionUtils = require('../utils/encryptionUtils');
  return encryptionUtils.getEncryptionKey();
}

function getState(conferenceId) {
  const id = Number(conferenceId);
  if (!liveState.has(id)) {
    liveState.set(id, {
      agentRunning: false,
      agentMuted: false,
      pendingCommands: []
    });
  }
  return liveState.get(id);
}

function pushCommand(conferenceId, command) {
  const state = getState(conferenceId);
  state.pendingCommands.push({
    ...command,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString()
  });
  return state;
}

function drainCommands(conferenceId) {
  const state = getState(conferenceId);
  const commands = state.pendingCommands.splice(0, state.pendingCommands.length);
  return commands;
}

async function assertConferenceMember(conferenceId, userId) {
  const id = Number(conferenceId);
  const uid = Number(userId);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(uid) || uid <= 0) {
    const err = new Error('Некорректный запрос');
    err.status = 400;
    throw err;
  }

  const session = await conferenceService.getSession(id);
  const conf = session.session;
  if (!conf) {
    const err = new Error('Конференция не найдена');
    err.status = 404;
    throw err;
  }

  const { rows } = await db.getQuery()(
    `SELECT role FROM conference_participants
     WHERE conference_id = $1 AND user_id = $2`,
    [id, uid]
  );

  const isHost = conf.created_by === uid;
  const isContact = conf.contact_user_id === uid;
  if (!rows.length && !isHost && !isContact) {
    const err = new Error('Нет доступа к этой конференции');
    err.status = 403;
    err.code = 'NOT_PARTICIPANT';
    throw err;
  }

  const role = rows[0]?.role || (isHost ? 'host' : 'participant');
  return { session: conf, contact: session.contact, role, isHost: role === 'host' || isHost };
}

async function listCoachRules(conferenceId) {
  const encryptionKey = getEncryptionKey();
  const { rows } = await db.getQuery()(
    `SELECT
       id, created_by, created_at,
       decrypt_text(body_encrypted, $2) AS body
     FROM conference_coach_rules
     WHERE conference_id = $1
     ORDER BY created_at ASC`,
    [conferenceId, encryptionKey]
  );
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    created_by: r.created_by,
    created_at: r.created_at
  }));
}

async function addCoachRule(conferenceId, body, createdBy) {
  const text = String(body || '').trim();
  if (!text) {
    const err = new Error('Пустая coach-инструкция');
    err.status = 400;
    throw err;
  }
  if (text.length > 4000) {
    const err = new Error('Coach-инструкция слишком длинная');
    err.status = 400;
    throw err;
  }

  const encryptionKey = getEncryptionKey();
  const { rows } = await db.getQuery()(
    `INSERT INTO conference_coach_rules (conference_id, body_encrypted, created_by)
     VALUES ($1, encrypt_text($2, $3), $4)
     RETURNING id, created_at`,
    [conferenceId, text, encryptionKey, createdBy || null]
  );

  pushCommand(conferenceId, {
    type: 'coach',
    text,
    interrupt: true
  });

  await appendTranscript(conferenceId, 'host_coach', text);

  return {
    id: rows[0].id,
    body: text,
    created_at: rows[0].created_at
  };
}

async function listTranscript(conferenceId, { includeCoach = false } = {}) {
  const encryptionKey = getEncryptionKey();
  const { rows } = await db.getQuery()(
    `SELECT
       id, role, created_at,
       decrypt_text(text_encrypted, $2) AS text,
       CASE WHEN text_translated_encrypted IS NULL OR text_translated_encrypted = '' THEN NULL
            ELSE decrypt_text(text_translated_encrypted, $2) END AS text_translated
     FROM conference_transcript_items
     WHERE conference_id = $1
       AND ($3::boolean OR role <> 'host_coach')
     ORDER BY created_at ASC
     LIMIT 500`,
    [conferenceId, encryptionKey, Boolean(includeCoach)]
  );
  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    text: r.text,
    text_translated: r.text_translated || null,
    created_at: r.created_at
  }));
}

async function appendTranscript(conferenceId, role, text, { translatedText = null } = {}) {
  const allowed = new Set(['participant', 'agent', 'host_coach', 'host']);
  if (!allowed.has(role)) {
    const err = new Error('Некорректная роль транскрипта');
    err.status = 400;
    throw err;
  }
  const body = String(text || '').trim();
  if (!body) return null;

  const encryptionKey = getEncryptionKey();
  const translated = translatedText ? String(translatedText).trim().slice(0, 8000) : null;
  const { rows } = await db.getQuery()(
    `INSERT INTO conference_transcript_items (
       conference_id, role, text_encrypted, text_translated_encrypted
     ) VALUES (
       $1, $2, encrypt_text($3, $4),
       CASE WHEN $5::text IS NULL OR $5::text = '' THEN NULL ELSE encrypt_text($5, $4) END
     )
     RETURNING id, created_at`,
    [conferenceId, role, body.slice(0, 8000), encryptionKey, translated]
  );
  return {
    id: rows[0].id,
    role,
    text: body.slice(0, 8000),
    text_translated: translated,
    created_at: rows[0].created_at
  };
}

async function buildAgentInstructions(conf) {
  const settings = await conferenceAiAgentService.getSettings();
  const coachRules = await listCoachRules(conf.id);
  const coachBlock = coachRules.length
    ? `\n\nHOST COACH RULES (приоритет, не озвучивать клиенту):\n${coachRules.map((r, i) => `${i + 1}. ${r.body}`).join('\n')}`
    : '';

  const outline = conf.presentation_outline
    ? `\n\nPresentation outline:\n${conf.presentation_outline}`
    : '';

  const ragPolicy = settings.generate_if_no_rag
    ? 'Если RAG пуст — можно ответить общими словами осторожно.'
    : 'Если RAG пуст — скажите, что в базе нет данных, и предложите уточнить у менеджера. Ничего не выдумывайте.';

  const ragFirst = settings.search_rag_first !== false
    ? 'Для фактов о компании СНАЧАЛА вызывайте tool search_company_docs, затем отвечайте по результатам.'
    : 'Tool search_company_docs доступен по необходимости; не обязан искать в RAG на каждый реплику, если вопрос не про базу знаний.';

  return [
    settings.system_prompt || conferenceAiAgentService.DEFAULTS.system_prompt,
    `guest_language=${conf.guest_language || 'en'}`,
    `host_language=${conf.host_language || 'ru'}`,
    `Говорите клиенту на языке: ${conf.guest_language || 'en'}.`,
    ragPolicy,
    ragFirst,
    outline,
    coachBlock
  ].filter(Boolean).join('\n');
}

function buildSearchToolSchema() {
  return {
    type: 'function',
    name: 'search_company_docs',
    description:
      'Search company knowledge base (RAG) for facts to answer the client. Always use before stating company-specific facts.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query in the client language or English'
        }
      },
      required: ['query']
    }
  };
}

async function createRealtimeClientSecret(conferenceId, actorId) {
  const { session: conf, isHost } = await assertConferenceMember(conferenceId, actorId);
  if (!['draft', 'scheduled', 'live'].includes(conf.status)) {
    const err = new Error('Конференция не активна');
    err.status = 400;
    throw err;
  }

  // Владелец Realtime: primary participant (contact) или host (соло-тест)
  const uid = Number(actorId);
  const isPrimary = conf.contact_user_id === uid;
  if (!isHost && !isPrimary) {
    const err = new Error(
      'Realtime доступен основному участнику (контакту). Остальные — видео/чат комнаты.'
    );
    err.status = 403;
    err.code = 'REALTIME_PRIMARY_ONLY';
    throw err;
  }

  const settings = await conferenceAiAgentService.getSettings();
  if (!settings.enabled) {
    const err = new Error('ИИ-агент конференции выключен в настройках');
    err.status = 400;
    err.code = 'AGENT_DISABLED';
    throw err;
  }

  const provider = await aiProviderSettingsService.getProviderSettings('openai');
  if (!provider?.api_key) {
    const err = new Error('Ключ OpenAI не настроен');
    err.status = 400;
    err.code = 'OPENAI_KEY_MISSING';
    throw err;
  }

  const model = settings.model || provider.selected_model || 'gpt-realtime';
  const instructions = await buildAgentInstructions(conf);
  const voice = conf.agent_voice || 'alloy';
  const timeoutMs = Number(settings.timeout_ms) || conferenceAiAgentService.DEFAULTS.timeout_ms;
  const temperature = Number(settings.temperature);
  const maxOutputTokens = Number(settings.max_tokens);

  const sessionConfig = {
    type: 'realtime',
    model,
    instructions,
    audio: {
      output: { voice }
    },
    tools: [buildSearchToolSchema()],
    tool_choice: 'auto'
  };
  if (Number.isFinite(temperature)) {
    sessionConfig.temperature = temperature;
  }
  if (Number.isFinite(maxOutputTokens) && maxOutputTokens > 0) {
    sessionConfig.max_output_tokens = maxOutputTokens;
  }

  const body = {
    expires_after: { anchor: 'created_at', seconds: 600 },
    session: sessionConfig
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await openaiProxy.proxiedFetch(
      'https://api.openai.com/v1/realtime/client_secrets',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${provider.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      },
      provider
    );
  } catch (e) {
    if (e?.name === 'AbortError') {
      const err = new Error(`Таймаут OpenAI Realtime (${timeoutMs} мс)`);
      err.status = 504;
      err.code = 'REALTIME_TIMEOUT';
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    logger.error('[conferenceRealtime] client_secrets error:', {
      status: response.status,
      error: payload?.error?.message || payload
    });
    const err = new Error(payload?.error?.message || 'Не удалось создать Realtime-сессию');
    err.status = 502;
    throw err;
  }

  // Форматы ответа: { value } | { client_secret: { value } } | { client_secret: "ek_..." }
  let ephemeral =
    payload.value ||
    (typeof payload.client_secret === 'string' ? payload.client_secret : null) ||
    payload.client_secret?.value ||
    null;

  if (!ephemeral) {
    logger.error('[conferenceRealtime] unexpected client_secrets payload keys:', Object.keys(payload));
    const err = new Error('OpenAI не вернул ephemeral key');
    err.status = 502;
    throw err;
  }

  // Не логируем ephemeral / api key
  logger.info(`[conferenceRealtime] ephemeral created conference=${conferenceId} model=${model}`);

  return {
    client_secret: ephemeral,
    expires_at: payload.expires_at || payload.client_secret?.expires_at || null,
    model,
    voice,
    guest_language: conf.guest_language,
    conference_id: conf.id
  };
}

async function startAgent(conferenceId, actorId) {
  await assertConferenceMember(conferenceId, actorId);
  const state = getState(conferenceId);
  state.agentRunning = true;
  state.agentMuted = false;
  pushCommand(conferenceId, {
    type: 'start_presentation',
    text: 'Начните аудио-презентацию для клиента по outline и RAG. Говорите на guest_language.'
  });
  return getLiveSnapshot(conferenceId, { includeCoach: true });
}

async function setAgentMuted(conferenceId, muted, actorId) {
  await assertConferenceMember(conferenceId, actorId);
  const state = getState(conferenceId);
  state.agentMuted = Boolean(muted);
  pushCommand(conferenceId, {
    type: muted ? 'mute' : 'unmute'
  });
  return getLiveSnapshot(conferenceId, { includeCoach: true });
}

async function searchCompanyDocs(conferenceId, query, actorId) {
  const { session: conf } = await assertConferenceMember(conferenceId, actorId);
  const settings = await conferenceAiAgentService.getSettings();
  const q = String(query || '').trim();
  if (!q) {
    return { found: false, answer: 'Пустой запрос', snippets: [] };
  }

  const tableIds = settings.rag_table_ids || [];
  if (!tableIds.length) {
    return {
      found: false,
      answer: settings.generate_if_no_rag
        ? ''
        : 'В базе знаний нет выбранных RAG-таблиц. Скажите клиенту, что данных нет, и предложите уточнить у менеджера.',
      snippets: []
    };
  }

  try {
    const timeoutMs = Number(settings.timeout_ms) || conferenceAiAgentService.DEFAULTS.timeout_ms;
    const searchPromise = multiSourceSearchService.search({
      query: q,
      tableIds,
      searchInDocuments: true,
      searchMethod: 'hybrid',
      userId: actorId,
      maxResultsPerSource: 5,
      totalMaxResults: 8
    });
    const results = await Promise.race([
      searchPromise,
      new Promise((_, reject) => {
        setTimeout(() => {
          const err = new Error(`Таймаут RAG-поиска (${timeoutMs} мс)`);
          err.code = 'RAG_TIMEOUT';
          reject(err);
        }, timeoutMs);
      })
    ]);

    // search_rag_first=false не отключает tool, но пустой результат при generate_if_no_rag=false
    // уже закрыт ниже; флаг влияет на инструкции агента (buildAgentInstructions).

    const snippets = [];
    const pushFrom = (arr) => {
      for (const item of arr || []) {
        const text = item.content || item.text || item.snippet || item.chunk || '';
        if (text) {
          snippets.push(String(text).slice(0, 500));
        }
      }
    };

    if (Array.isArray(results)) {
      pushFrom(results);
    } else if (results && typeof results === 'object') {
      pushFrom(results.results);
      pushFrom(results.documents);
      pushFrom(results.tables);
      if (Array.isArray(results.merged)) pushFrom(results.merged);
      if (results.bySource) {
        Object.values(results.bySource).forEach((v) => pushFrom(Array.isArray(v) ? v : v?.results));
      }
    }

    if (!snippets.length) {
      return {
        found: false,
        answer: settings.generate_if_no_rag
          ? ''
          : 'По запросу в базе ничего не найдено. Не выдумывайте факты; предложите уточнить у менеджера.',
        snippets: [],
        search_rag_first: settings.search_rag_first !== false
      };
    }

    return {
      found: true,
      answer: snippets.join('\n---\n'),
      snippets,
      search_rag_first: settings.search_rag_first !== false
    };
  } catch (e) {
    logger.error('[conferenceRealtime] RAG search failed:', e);
    return {
      found: false,
      answer: e?.code === 'RAG_TIMEOUT'
        ? 'Поиск по базе превысил таймаут. Скажите клиенту, что сейчас не удалось найти данные.'
        : 'Ошибка поиска по базе. Скажите клиенту, что сейчас не удалось найти данные.',
      snippets: []
    };
  }
}

/**
 * Snapshot live-state. pendingCommands отдаём/drain'им только primary (contact_user_id).
 * Host и secondary в multi не должны забирать команды Realtime.
 */
async function getLiveSnapshot(
  conferenceId,
  { includeCoach = false, drain = false, actorId = null } = {}
) {
  const state = getState(conferenceId);
  let commands = [];

  if (drain && actorId != null) {
    const uid = Number(actorId);
    const { session: conf } = await conferenceService.getSession(Number(conferenceId));
    const isPrimary = conf && Number(conf.contact_user_id) === uid;
    if (isPrimary) {
      commands = drainCommands(conferenceId);
    }
  }

  const [coachRules, transcript] = await Promise.all([
    includeCoach ? listCoachRules(conferenceId) : Promise.resolve([]),
    listTranscript(conferenceId, { includeCoach })
  ]);

  return {
    agentRunning: state.agentRunning,
    agentMuted: state.agentMuted,
    pendingCommands: commands,
    coachRules: includeCoach ? coachRules : [],
    transcript
  };
}

module.exports = {
  assertConferenceMember,
  listCoachRules,
  addCoachRule,
  listTranscript,
  appendTranscript,
  createRealtimeClientSecret,
  startAgent,
  setAgentMuted,
  searchCompanyDocs,
  getLiveSnapshot,
  drainCommands
};
