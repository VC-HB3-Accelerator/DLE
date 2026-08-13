/**
 * Локальный smoke: Qwen Cloud + пути агентов. Не печатает ключи.
 * Запуск: docker exec -w /app dapp-backend node scripts/local-qwencloud-smoke.js
 */
const logger = require('../utils/logger');
const { getProviderSettings, createOpenAiCompatibleProviderClient } = require('../services/aiProviderSettingsService');
const { resolveChatLlmRoute, generateQwenCloudChatResponse } = require('../services/chatLlmRouter');
const aiAssistantSettingsService = require('../services/aiAssistantSettingsService');
const broadcastAiAgentService = require('../services/broadcastAiAgentService');
const contactSiteParserService = require('../services/contactSiteParserService');
const conferenceAiAgentService = require('../services/conferenceAiAgentService');

function clip(s, n = 180) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

async function pingQwen(settings, model) {
  const client = createOpenAiCompatibleProviderClient('qwencloud', settings);
  const started = Date.now();
  const res = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: 'Ответь одним словом: ок' }],
    max_tokens: 16,
    temperature: 0
  });
  const text = res.choices?.[0]?.message?.content || '';
  return { ms: Date.now() - started, text: clip(text, 80) };
}

async function pingBroadcastJson(settings, model) {
  const client = createOpenAiCompatibleProviderClient('qwencloud', settings);
  const started = Date.now();
  const res = await client.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 80,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'Верни строго JSON: {"subject":"...","greeting":"..."}' },
      { role: 'user', content: 'TEMPLATE_SUBJECT: Партнёрство\nRECIPIENT_NAME: Тест ООО' }
    ]
  });
  const text = res.choices?.[0]?.message?.content || '';
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (_) { /* keep raw */ }
  return {
    ms: Date.now() - started,
    ok: Boolean(parsed && parsed.subject && parsed.greeting),
    text: clip(text, 120)
  };
}

async function pingParserSummary(settings, model) {
  const client = createOpenAiCompatibleProviderClient('qwencloud', settings);
  const started = Date.now();
  const res = await client.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 80,
    messages: [
      { role: 'system', content: 'Кратко по PAGE_TEXT, без выдумок, 1-2 предложения на русском.' },
      { role: 'user', content: 'PAGE_TEXT: VC HB3 Accelerator — операционная система для цифровых юрлиц. Продукт, не инвестиционная оферта.' }
    ]
  });
  const text = res.choices?.[0]?.message?.content || '';
  return { ms: Date.now() - started, ok: Boolean(text.trim()), text: clip(text, 120) };
}

async function main() {
  const results = {};
  const qwen = await getProviderSettings('qwencloud');
  results.qwencloud = {
    configured: Boolean(qwen?.api_key),
    selected_model: qwen?.selected_model || null,
    base_url_host: (() => {
      try { return new URL(qwen?.base_url || '').host; } catch { return qwen?.base_url ? 'set' : null; }
    })()
  };
  if (!qwen?.api_key) {
    throw new Error('Qwen Cloud API key не найден в локальной БД');
  }
  const model = String(qwen.selected_model || 'qwen3.8-max').trim();

  results.ping = await pingQwen(qwen, model);

  const assistant = await aiAssistantSettingsService.getSettings();
  const chatRoute = await resolveChatLlmRoute(assistant?.model);
  results.chatAgent = {
    model: assistant?.model || null,
    route: chatRoute.provider,
    routedModel: chatRoute.model
  };
  if (chatRoute.provider === 'qwencloud') {
    const chatText = await generateQwenCloudChatResponse({
      messages: [
        { role: 'system', content: 'Ты ассистент. Ответь кратко по-русски.' },
        { role: 'user', content: 'Что такое VC HB3 Accelerator — одно предложение.' }
      ],
      model: chatRoute.model,
      settings: chatRoute.settings,
      llmParameters: { temperature: 0.2, maxTokens: 80 }
    });
    results.chatAgent.reply = clip(chatText, 200);
    results.chatAgent.ok = Boolean(String(chatText || '').trim());
  }

  const parser = await contactSiteParserService.getSettings();
  const broadcast = await broadcastAiAgentService.getSettings();
  const conference = await conferenceAiAgentService.getSettings();
  results.parser = { enabled: parser.enabled, provider: parser.provider, model: parser.model };
  results.broadcast = { enabled: broadcast.enabled, provider: broadcast.provider, model: broadcast.model };
  results.conference = { enabled: conference.enabled, provider: conference.provider, model: conference.model };

  results.parserPath = await pingParserSummary(qwen, model);
  results.broadcastPath = await pingBroadcastJson(qwen, model);

  results.conferenceNote = conference.provider === 'openai'
    ? 'realtime остаётся на OpenAI; Qwen Cloud его не подменяет'
    : `provider=${conference.provider} (realtime-сессия всё равно ходит в OpenAI API)`;

  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  logger.error('[local-qwencloud-smoke]', err.message);
  console.error('FAIL:', err.message);
  process.exit(1);
});
