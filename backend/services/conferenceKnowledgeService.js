/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Инструкции и omni-session для голосового агента конференции.
 */

const db = require('../db');
const conferenceAiAgentService = require('./conferenceAiAgentService');
const voiceKnowledge = require('./voiceCallKnowledgeService');

function getEncryptionKey() {
  const encryptionUtils = require('../utils/encryptionUtils');
  return encryptionUtils.getEncryptionKey();
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

async function buildAgentInstructions(conf, { coachRules = null } = {}) {
  const settings = await conferenceAiAgentService.getSettings();
  const rules = coachRules != null ? coachRules : await listCoachRules(conf.id);
  const coachBlock = rules.length
    ? `\n\nHOST COACH RULES (приоритет, не озвучивать клиенту):\n${rules.map((r, i) => `${i + 1}. ${r.body}`).join('\n')}`
    : '';

  const outline = conf.presentation_outline
    ? `\n\nPresentation outline:\n${conf.presentation_outline}`
    : '';

  const guest = conf.guest_language || 'en';
  const host = conf.host_language || 'ru';

  const ragPolicy = settings.generate_if_no_rag
    ? 'Если RAG пуст — можно ответить общими словами осторожно.'
    : 'Если RAG пуст — скажите, что в базе нет данных, и предложите уточнить у менеджера. Ничего не выдумывайте.';

  const ragFirst = settings.search_rag_first !== false
    ? 'Для фактов о компании СНАЧАЛА используйте контекст RAG из инструкций или уточняющий поиск.'
    : 'RAG доступен по необходимости; не обязан искать на каждую реплику.';

  const translationBlock = [
    'LIVE INTERPRETATION:',
    `- Говорите клиенту на языке guest_language (${guest}).`,
    `- Если участник говорит не на ${guest}, кратко перескажите смысл на ${guest} и ответьте.`,
    `- Транскрипт для редактора: оригинал на языке участника, перевод для host (${host}).`,
    '- Coach-инструкции редактора не озвучивайте.'
  ].join('\n');

  return [
    settings.system_prompt || conferenceAiAgentService.DEFAULTS.system_prompt,
    `guest_language=${guest}`,
    `host_language=${host}`,
    translationBlock,
    ragPolicy,
    ragFirst,
    outline,
    coachBlock
  ].filter(Boolean).join('\n');
}

function buildOmniSession(instructions, conf) {
  const guest = String(conf?.guest_language || 'en').slice(0, 2);
  return voiceKnowledge.buildOmniSession(instructions, {
    transcribe: true,
    locale: guest || 'en'
  });
}

function presentationTurnEvents(text) {
  const prompt =
    text ||
    'Start the audio presentation for the client now. Speak in guest_language. Use RAG facts only.';
  return [
    {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: prompt }]
      }
    },
    { type: 'response.create' }
  ];
}

function chatTurnEvents(text) {
  const body = String(text || '').trim();
  if (!body) return [];
  return [
    {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: body }]
      }
    },
    { type: 'response.create' }
  ];
}

function coachTurnEvents(text) {
  const body = String(text || '').trim();
  if (!body) return [];
  return [
    { type: 'response.cancel' },
    {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text:
              `[HOST COACH — do not read aloud to the client] New rule: ${body}. ` +
              'Acknowledge silently and continue in guest_language.'
          }
        ]
      }
    },
    { type: 'response.create' }
  ];
}

function appendRagBlock(instructions, ragAnswer, { found = false } = {}) {
  const block = found
    ? `\n\nRAG CONTEXT (facts only):\n${String(ragAnswer || '').slice(0, 6000)}`
    : '\n\nRAG: по последнему запросу ничего не найдено — не выдумывайте факты.';
  return `${instructions}${block}`;
}

module.exports = {
  listCoachRules,
  buildAgentInstructions,
  buildOmniSession,
  presentationTurnEvents,
  chatTurnEvents,
  coachTurnEvents,
  appendRagBlock,
  extractUserTranscript: voiceKnowledge.extractUserTranscript
};
