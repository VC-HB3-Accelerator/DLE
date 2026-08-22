#!/usr/bin/env node
/**
 * Dump / apply ИИ-настроек в data-room/rag-test/ai-settings.
 *
 * Только локальный Docker. VDS — только если явно передали --vds
 * И переменная RAG_TEST_ALLOW_VDS=можно.
 *
 *   node scripts/rag-test-ai-settings.js dump
 *   node scripts/rag-test-ai-settings.js apply
 *   node scripts/rag-test-ai-settings.js apply --apply-config
 *   node scripts/rag-test-ai-settings.js rebuild
 *   node scripts/rag-test-ai-settings.js status
 *
 * На VDS этот файл вызывает ./sync-ai-to-vds.sh (rsync + apply + rebuild).
 */

const fs = require('fs');
const path = require('path');

const ROOT = detectRoot();
const OUT = path.join(ROOT, 'data-room', 'rag-test', 'ai-settings');

function detectRoot() {
  const envRoot = process.env.DLE_APP_ROOT;
  if (envRoot && fs.existsSync(path.join(envRoot, 'data-room'))) return envRoot;
  if (fs.existsSync('/host-project/data-room')) return '/host-project';
  return path.resolve(__dirname, '../..');
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args.find((a) => !a.startsWith('-')) || 'dump';
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  return { cmd, flags };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeText(rel, text) {
  const abs = path.join(OUT, rel);
  ensureDir(path.dirname(abs));
  fs.writeFileSync(abs, String(text || '').replace(/\r\n/g, '\n').replace(/\s+$/, '') + '\n', 'utf8');
}

function writeJson(rel, obj) {
  const abs = path.join(OUT, rel);
  ensureDir(path.dirname(abs));
  fs.writeFileSync(abs, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function readText(rel) {
  const abs = path.join(OUT, rel);
  if (!fs.existsSync(abs)) return '';
  return fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n').trim();
}

function readJson(rel) {
  const abs = path.join(OUT, rel);
  if (!fs.existsSync(abs)) return null;
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function slugify(name, fallback = 'item') {
  const s = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s || fallback;
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined) {
      out[k] = obj[k];
    }
  }
  return out;
}

async function listUserTables() {
  const encryptedDb = require('../services/encryptedDatabaseService');
  const tables = await encryptedDb.getData('user_tables', {});
  return (tables || []).map((t) => ({
    id: Number(t.id),
    name: String(t.name || '').trim(),
    rag: Number(t.is_rag_source_id || t.is_rag_source || 0)
  }));
}

function tableNameKey(name) {
  return String(name || '').trim().toLowerCase();
}

async function resolveTableIdsByNames(names, { ragOnly = false } = {}) {
  const want = [...new Set((names || []).map(tableNameKey).filter(Boolean))];
  if (!want.length) return [];
  const tables = await listUserTables();
  const ids = [];
  for (const key of want) {
    const hit = tables.find((t) => tableNameKey(t.name) === key && (!ragOnly || t.rag === 1));
    if (!hit) {
      const known = tables
        .filter((t) => !ragOnly || t.rag === 1)
        .map((t) => `${t.name}#${t.id}`)
        .join(', ');
      throw new Error(
        `Таблица «${key}» не найдена на этом инстансе (поиск по имени, не по id). Есть: ${known || 'нет RAG-таблиц'}`
      );
    }
    ids.push(hit.id);
  }
  return ids;
}

async function namesForTableIds(ids) {
  const tables = await listUserTables();
  const byId = new Map(tables.map((t) => [t.id, t.name]));
  return (ids || []).map((id) => byId.get(Number(id))).filter(Boolean);
}

const LANGUAGE_CLAUSE_NEXT = '7) Язык ответа — язык последнего сообщения пользователя (русский или английский). Канон «кто мы», имена (DLE, HB3), тарифы, ask и цифры из источников этого сообщения — дословно, без вольного перевода и без сжатия в слоган. Остальной текст — на языке пользователя. Без иероглифов. В русском тексте латиница только в устоявшихся именах и кодах.';

function migrateLanguageClause(prompt) {
  const old = [
    '7) Только русский, грамотно, без иероглифов и «латиницы внутри русских слов».',
    '7) Отвечайте только на русском, грамотно, без иероглифов и латиницы внутри русских слов.'
  ];
  let out = String(prompt || '');
  for (const clause of old) {
    out = out.split(clause).join(LANGUAGE_CLAUSE_NEXT);
  }
  return out;
}

async function loadPlainRulesById() {
  const db = require('../db');
  const { rows } = await db.getQuery()('SELECT id, rules FROM ai_assistant_rules ORDER BY id');
  const map = new Map();
  for (const row of rows || []) {
    map.set(Number(row.id), row.rules && typeof row.rules === 'object' ? row.rules : {});
  }
  return map;
}

function mergeRuleBody(encryptedBody, plainBody) {
  const a = encryptedBody && typeof encryptedBody === 'object' ? encryptedBody : {};
  const b = plainBody && typeof plainBody === 'object' ? plainBody : {};
  const out = { ...b, ...a };
  const aPrompt = String(a.system_prompt || '').trim();
  const bPrompt = String(b.system_prompt || '').trim();
  out.system_prompt = (bPrompt.length >= aPrompt.length ? bPrompt : aPrompt) || aPrompt || bPrompt;
  if (!out.rules || typeof out.rules !== 'object') out.rules = b.rules || a.rules || {};
  if (!(out.allowed_topics || []).length && (b.allowed_topics || b.rules?.allowed_topics)) {
    out.allowed_topics = b.allowed_topics || b.rules?.allowed_topics;
  }
  if (!(out.forbidden_words || []).length && (b.forbidden_words || b.rules?.forbidden_words)) {
    out.forbidden_words = b.forbidden_words || b.rules?.forbidden_words;
  }
  return out;
}

async function dumpChat() {
  const settingsService = require('../services/aiAssistantSettingsService');
  const rulesService = require('../services/aiAssistantRulesService');
  const userContextService = require('../services/userContextService');
  const plainById = await loadPlainRulesById();

  const settings = await settingsService.getSettings();
  const rules = await rulesService.getAllRules();
  const allTagIds = [...new Set((rules || []).flatMap((r) => r.tag_ids || []))];
  const tagNamesById = {};
  for (const id of allTagIds) {
    const names = await userContextService.getTagNames([id]);
    tagNamesById[id] = (names && names[0]) || String(id);
  }

  const defaultRule = (rules || []).find((r) => Number(r.id) === Number(settings?.rules_id));
  const ragIds = settings?.selected_rag_tables || [];
  const ragNames = await namesForTableIds(ragIds);
  writeText('chat/system-prompt.md', settings?.system_prompt || '');
  writeJson('chat/settings.json', {
    default_rule_name: defaultRule?.name || 'KB base',
    selected_rag_table_names: ragNames.length ? ragNames : ['FAQ'],
    languages: settings?.languages || ['ru'],
    model: settings?.model || null,
    embedding_model: settings?.embedding_model || null,
    enabled_channels: settings?.enabled_channels || null,
    accept_input: settings?.accept_input || null,
    behavior: pick(settings || {}, [
      'tone',
      'response_length',
      'formality',
      'adapt_to_user',
      'explanation_level_default',
      'allow_gentle_rephrase_offer',
      'avoid_jargon_by_default',
      'quality_over_speed',
      'fallback_if_not_confident',
      'forbid_vulgar_tone',
      'forbid_patronizing_tone',
      'forbid_slang_mirroring'
    ]),
    note: 'Id таблиц/правил/тегов на инстансах разные. Apply режет только по имени (FAQ, KB base, public-client). Числовые id из dump не применяются.'
  });

  const used = new Set();
  const index = [];
  for (const rule of rules || []) {
    let slug = slugify(rule.name, `rule-${rule.id}`);
    if (used.has(slug)) slug = `${slug}-${rule.id}`;
    used.add(slug);
    const body = mergeRuleBody(rule.rules || {}, plainById.get(Number(rule.id)) || {});
    writeText(`chat/rules/${slug}.md`, body.system_prompt || '');
    writeJson(`chat/rules/${slug}.json`, {
      name: rule.name,
      description: rule.description || '',
      tag_names: (rule.tag_ids || []).map((id) => tagNamesById[id]).filter(Boolean),
      temperature: body.temperature ?? null,
      max_tokens: body.max_tokens ?? null,
      checkUserTags: body.rules?.checkUserTags ?? body.checkUserTags ?? true,
      searchRagFirst: body.rules?.searchRagFirst ?? body.searchRagFirst ?? true,
      generateIfNoRag: body.rules?.generateIfNoRag ?? body.generateIfNoRag ?? false,
      allowed_topics: body.rules?.allowed_topics || body.allowed_topics || [],
      forbidden_words: body.rules?.forbidden_words || body.forbidden_words || []
    });
    index.push({ slug, name: rule.name, tag_names: (rule.tag_ids || []).map((id) => tagNamesById[id]).filter(Boolean) });
  }
  writeJson('chat/rules/_index.json', { rules: index });
  return {
    rules: (rules || []).length,
    rag_table_names: ragNames.length ? ragNames : ['FAQ']
  };
}

async function dumpAgents() {
  const voice = require('../services/voiceCallSettingsService');
  const broadcast = require('../services/broadcastAiAgentService');
  const conference = require('../services/conferenceAiAgentService');
  const parser = require('../services/contactSiteParserService');

  const v = await voice.getSettings();
  writeText('voice-call/system-prompt.md', v.system_prompt || '');
  writeJson('voice-call/settings.json', {
    enabled: v.enabled,
    model_call: v.model_call || '',
    tone: v.tone,
    response_length: v.response_length,
    formality: v.formality,
    adapt_to_caller: v.adapt_to_caller,
    explanation_level_default: v.explanation_level_default,
    allow_gentle_rephrase_offer: v.allow_gentle_rephrase_offer,
    fallback_if_not_confident: v.fallback_if_not_confident,
    note: 'Кошельки и адреса оплаты в rag-test не выгружаются'
  });

  const b = await broadcast.getSettings();
  writeText('broadcast/system-prompt.md', b.system_prompt || '');
  writeJson('broadcast/settings.json', {
    enabled: b.enabled,
    provider: b.provider,
    model: b.model,
    temperature: b.temperature,
    max_tokens: b.max_tokens,
    timeout_ms: b.timeout_ms,
    note: 'apply по умолчанию пишет только system_prompt. model/enabled/timeout — только --apply-agents-runtime и фраза «можно»'
  });

  const c = await conference.getSettings();
  writeText('conference/system-prompt.md', c.system_prompt || '');
  writeJson('conference/settings.json', {
    enabled: c.enabled,
    provider: c.provider,
    model: c.model,
    temperature: c.temperature,
    max_tokens: c.max_tokens,
    timeout_ms: c.timeout_ms,
    rag_table_names: await namesForTableIds(c.rag_table_ids || []),
    search_rag_first: c.search_rag_first,
    generate_if_no_rag: c.generate_if_no_rag,
    note: 'apply по умолчанию пишет только system_prompt. rag_table_ids режутся по имени на целевом инстансе'
  });

  const p = await parser.getSettings();
  writeText('parser/system-prompt.md', p.system_prompt || '');
  writeJson('parser/settings.json', {
    enabled: p.enabled,
    schedule_enabled: p.schedule_enabled,
    provider: p.provider,
    model: p.model,
    temperature: p.temperature,
    max_tokens: p.max_tokens,
    timeout_ms: p.timeout_ms,
    interval_days: p.interval_days,
    max_pages: p.max_pages,
    note: 'apply по умолчанию пишет только system_prompt'
  });
}

async function dumpAiConfig() {
  const aiConfigService = require('../services/aiConfigService');
  const cfg = await aiConfigService.getConfig();
  writeJson('rag-config/ai-config.json', {
    ollama_llm_model: cfg.ollama_llm_model || null,
    ollama_embedding_model: cfg.ollama_embedding_model || null,
    ollama_preload_model: cfg.ollama_preload_model || null,
    embedding_parameters: cfg.embedding_parameters || null,
    llm_parameters: cfg.llm_parameters || null,
    qwen_specific_parameters: cfg.qwen_specific_parameters || null,
    rag_settings: cfg.rag_settings || null,
    rag_behavior: cfg.rag_behavior || null,
    cache_settings: cfg.cache_settings || null,
    queue_settings: cfg.queue_settings || null,
    timeouts: cfg.timeouts || null,
    deduplication_settings: cfg.deduplication_settings || null,
    dialog_settings: cfg.dialog_settings || null,
    chunking_settings: cfg.chunking_settings || null,
    note: 'apply этого файла только с --apply-config. Смена embedding/модели Ollama без «можно» запрещена.'
  });
}

function dumpCodePrompts() {
  const { ASK_FORBID_GUEST, DEFAULT_PROMPT_SOURCES } = require('../services/ragPromptAssembly');
  const {
    GUEST_PROFILE_HINT,
    QUALIFY_PROFILE_HINT,
    UPDATE_TAGS_TOOL_DESCRIPTION
  } = require('../services/assistantTurnContext');
  const { RECOMMENDED_SYSTEM_PROMPT } = require('../utils/assistantDefaultPrompt');
  const voice = require('../services/voiceCallSettingsService');
  const broadcast = require('../services/broadcastAiAgentService');
  const conference = require('../services/conferenceAiAgentService');
  const parser = require('../services/contactSiteParserService');

  writeText('code-prompts/ask-forbid-guest.md', ASK_FORBID_GUEST);
  writeText('code-prompts/guest-profile.md', GUEST_PROFILE_HINT);
  writeText('code-prompts/qualify-profile.md', QUALIFY_PROFILE_HINT);
  writeText('code-prompts/update-tags-tool.md', UPDATE_TAGS_TOOL_DESCRIPTION);
  writeText('code-prompts/recommended-system-prompt.md', RECOMMENDED_SYSTEM_PROMPT);
  writeText('code-prompts/voice-call-default.ru.md', voice.DEFAULT_CALL_SYSTEM_PROMPT);
  writeText('code-prompts/voice-call-default.en.md', voice.DEFAULT_CALL_SYSTEM_PROMPT_EN);
  writeText('code-prompts/broadcast-default.md', broadcast.DEFAULT_SYSTEM_PROMPT || broadcast.getDefaults().system_prompt);
  writeText('code-prompts/conference-default.md', conference.getDefaults().system_prompt);
  writeText('code-prompts/parser-default.md', parser.getDefaults().system_prompt);
  writeJson('code-prompts/_meta.json', {
    default_prompt_sources: DEFAULT_PROMPT_SOURCES,
    live_in: 'код, не таблица БД',
    apply: 'вернуть в JS: apply --sync-code (локально). Runtime читает БД для чата/агентов, эти файлы — запасной слой.'
  });
}

async function dumpWelcome() {
  const systemMessages = require('../services/systemMessagesService');
  const list = await systemMessages.listAll();
  const index = [];
  for (const msg of list || []) {
    const slug = slugify(msg.slug || `msg-${msg.id}`, `msg-${msg.id}`);
    writeJson(`welcome/${slug}.json`, {
      id: msg.id,
      slug: msg.slug,
      kind: msg.kind,
      channels: msg.channels,
      status: msg.status,
      sort_order: msg.sort_order,
      audience: msg.audience,
      persist_to_history: msg.persist_to_history,
      i18n: msg.i18n
    });
    const ru = (msg.i18n && msg.i18n.ru) || {};
    const body = [ru.title, ru.summary, ru.content].filter(Boolean).join('\n\n');
    writeText(`welcome/${slug}.ru.md`, body);
    index.push({ slug, id: msg.id, kind: msg.kind, status: msg.status, cms_slug: msg.slug });
  }
  writeJson('welcome/_index.json', { messages: index });
  return (list || []).length;
}

function writeReadme() {
  writeText('README.ru.md', `# ИИ-настройки (копия для правки)

Снимок из локальной БД Docker + запасные промпты из кода.

## Выгрузка на оба VDS

\`\`\`bash
./sync-ai-to-vds.sh --yes
\`\`\`

Алгоритм: rsync файлов → apply в БД каждого инстанса → rebuild \`rag_chunks\`.
Id FAQ-таблиц на VDS не перезаписываются (на hb3 и ru.hb3 они разные).
Модели Ollama и агент рассылки (enabled/model/timeout) не трогаются.

## Локально

\`\`\`bash
python3 data-room/rag-test/eval/ai_settings.py dump
python3 data-room/rag-test/eval/ai_settings.py apply
python3 data-room/rag-test/eval/ai_settings.py rebuild
python3 data-room/rag-test/eval/ai_settings.py status
\`\`\`
`);
}

async function cmdDump() {
  ensureDir(OUT);
  dumpCodePrompts();
  const chat = await dumpChat();
  await dumpAgents();
  await dumpAiConfig();
  const welcome = await dumpWelcome();
  writeReadme();
  writeJson('_META.json', {
    dumped_at: new Date().toISOString(),
    source: 'local-docker',
    root: ROOT,
    chat_rules: chat.rules,
    welcome
  });
  return { ok: true, out: OUT, chat_rules: chat.rules, welcome };
}

async function applyChat(flags) {
  const settingsService = require('../services/aiAssistantSettingsService');
  const rulesService = require('../services/aiAssistantRulesService');
  const profileAnalysisService = require('../services/profileAnalysisService');

  const prompt = migrateLanguageClause(readText('chat/system-prompt.md'));
  const meta = readJson('chat/settings.json') || {};
  const index = readJson('chat/rules/_index.json') || { rules: [] };
  const current = await settingsService.getSettings();
  if (!current) throw new Error('Нет ai_assistant_settings в БД');

  const appliedRules = [];
  for (const item of index.rules || []) {
    const spec = readJson(`chat/rules/${item.slug}.json`);
    const text = readText(`chat/rules/${item.slug}.md`);
    if (!spec || !spec.name) continue;
    const uniqueNames = [...new Set((spec.tag_names || []).map((n) => String(n).trim()).filter(Boolean))];
    const tagIds = uniqueNames.length
      ? await profileAnalysisService.getTagIdsByNames(uniqueNames)
      : [];
    if (uniqueNames.length && tagIds.length !== uniqueNames.length) {
      throw new Error(
        `Теги «Теги клиентов»: искали [${uniqueNames.join(', ')}], нашли ${tagIds.length} id (${tagIds.join(', ') || 'нет'})`
      );
    }
    const payload = {
      system_prompt: text,
      temperature: spec.temperature,
      max_tokens: spec.max_tokens,
      tag_ids: tagIds,
      rules: {
        checkUserTags: spec.checkUserTags !== false,
        searchRagFirst: spec.searchRagFirst !== false,
        generateIfNoRag: Boolean(spec.generateIfNoRag),
        allowed_topics: spec.allowed_topics || [],
        forbidden_words: spec.forbidden_words || []
      }
    };
    const all = await rulesService.getAllRules();
    const existing = (all || []).find((r) => String(r.name) === String(spec.name));
    if (existing) {
      await rulesService.updateRule(existing.id, {
        name: spec.name,
        description: spec.description || '',
        rules: payload,
        tag_ids: tagIds
      });
      appliedRules.push({ name: spec.name, action: 'updated', id: existing.id });
    } else {
      const created = await rulesService.createRule({
        name: spec.name,
        description: spec.description || '',
        rules: payload,
        tag_ids: tagIds
      });
      appliedRules.push({ name: spec.name, action: 'created', id: created.id });
    }
  }

  const allAfter = await rulesService.getAllRules();
  let rulesId = current.rules_id;
  if (meta.default_rule_name) {
    const found = (allAfter || []).find((r) => String(r.name) === String(meta.default_rule_name));
    if (found) rulesId = found.id;
  }

  const ragNames = (meta.selected_rag_table_names && meta.selected_rag_table_names.length)
    ? meta.selected_rag_table_names
    : ['FAQ'];
  const ragIds = await resolveTableIdsByNames(ragNames, { ragOnly: true });

  const patch = {
    ...current,
    system_prompt: prompt || current.system_prompt,
    rules_id: rulesId,
    selected_rag_tables: ragIds,
    ...(meta.behavior || {})
  };
  if (flags.has('--apply-models')) {
    if (meta.model) patch.model = meta.model;
    if (meta.embedding_model) patch.embedding_model = meta.embedding_model;
  }
  await settingsService.upsertSettings(patch);
  return {
    rules: appliedRules,
    rag_tables: ragIds,
    rag_table_names: ragNames,
    instance_tables: await listUserTables()
  };
}

async function applyAgents(flags) {
  const voice = require('../services/voiceCallSettingsService');
  const broadcast = require('../services/broadcastAiAgentService');
  const conference = require('../services/conferenceAiAgentService');
  const parser = require('../services/contactSiteParserService');
  const runtime = flags.has('--apply-agents-runtime');

  const voicePrompt = readText('voice-call/system-prompt.md');
  if (voicePrompt) await voice.saveSettings({ system_prompt: voicePrompt });

  const bPrompt = readText('broadcast/system-prompt.md');
  const bMeta = readJson('broadcast/settings.json') || {};
  if (bPrompt) {
    const payload = { system_prompt: bPrompt };
    if (runtime) {
      Object.assign(payload, pick(bMeta, ['enabled', 'provider', 'model', 'temperature', 'max_tokens', 'timeout_ms']));
    }
    await broadcast.saveSettings(payload);
  }

  const cPrompt = readText('conference/system-prompt.md');
  const cMeta = readJson('conference/settings.json') || {};
  if (cPrompt) {
    const payload = { system_prompt: cPrompt };
    if (runtime) {
      Object.assign(payload, pick(cMeta, [
        'enabled', 'provider', 'model', 'temperature', 'max_tokens', 'timeout_ms',
        'search_rag_first', 'generate_if_no_rag'
      ]));
      if (Array.isArray(cMeta.rag_table_names) && cMeta.rag_table_names.length) {
        payload.rag_table_ids = await resolveTableIdsByNames(cMeta.rag_table_names, { ragOnly: true });
      }
    }
    await conference.saveSettings(payload);
  }

  const pPrompt = readText('parser/system-prompt.md');
  const pMeta = readJson('parser/settings.json') || {};
  if (pPrompt) {
    const payload = { system_prompt: pPrompt };
    if (runtime) {
      Object.assign(payload, pick(pMeta, [
        'enabled', 'schedule_enabled', 'provider', 'model', 'temperature',
        'max_tokens', 'timeout_ms', 'interval_days', 'max_pages'
      ]));
    }
    await parser.saveSettings(payload);
  }
}

async function applyWelcome() {
  const systemMessages = require('../services/systemMessagesService');
  const index = readJson('welcome/_index.json') || { messages: [] };
  const out = [];
  for (const item of index.messages || []) {
    const spec = readJson(`welcome/${item.slug}.json`);
    if (!spec || !spec.slug) continue;
    const existing = await systemMessages.getBySlug(spec.slug);
    if (!existing) {
      out.push({ slug: spec.slug, action: 'skipped-missing' });
      continue;
    }
    await systemMessages.updateMessage(existing.id, {
      i18n: spec.i18n,
      kind: spec.kind,
      channels: spec.channels,
      status: spec.status,
      sort_order: spec.sort_order,
      audience: spec.audience
    });
    out.push({ slug: spec.slug, action: 'updated', id: existing.id });
  }
  return out;
}

async function applyConfig() {
  const aiConfigService = require('../services/aiConfigService');
  const cfg = readJson('rag-config/ai-config.json');
  if (!cfg) throw new Error('Нет rag-config/ai-config.json');
  const updates = pick(cfg, [
    'llm_parameters',
    'qwen_specific_parameters',
    'rag_settings',
    'rag_behavior',
    'cache_settings',
    'queue_settings',
    'timeouts',
    'deduplication_settings',
    'dialog_settings',
    'chunking_settings'
  ]);
  await aiConfigService.updateConfig(updates);
}

function replaceTaggedConst(fileAbs, constName, newValue) {
  const src = fs.readFileSync(fileAbs, 'utf8');
  const re = new RegExp(`(const ${constName} = \`)([\\s\\S]*?)(\`;)`);
  if (!re.test(src)) {
    throw new Error(`Не нашёл const ${constName} в ${fileAbs}`);
  }
  const next = src.replace(re, `$1${newValue.replace(/`/g, '\\`')}$3`);
  fs.writeFileSync(fileAbs, next, 'utf8');
}

function syncCode() {
  const backend = path.join(ROOT, 'backend');
  const map = [
    [path.join(backend, 'services/ragPromptAssembly.js'), 'ASK_FORBID_GUEST', 'code-prompts/ask-forbid-guest.md'],
    [path.join(backend, 'services/assistantTurnContext.js'), 'GUEST_PROFILE_HINT', 'code-prompts/guest-profile.md'],
    [path.join(backend, 'services/assistantTurnContext.js'), 'QUALIFY_PROFILE_HINT', 'code-prompts/qualify-profile.md'],
    [path.join(backend, 'services/assistantTurnContext.js'), 'UPDATE_TAGS_TOOL_DESCRIPTION', 'code-prompts/update-tags-tool.md'],
    [path.join(backend, 'utils/assistantDefaultPrompt.js'), 'RECOMMENDED_SYSTEM_PROMPT', 'code-prompts/recommended-system-prompt.md'],
    [path.join(backend, 'scripts/local-seed-assistant-rules.js'), 'SYSTEM_PROMPT_A', 'chat/system-prompt.md']
  ];
  const done = [];
  for (const [fileAbs, constName, rel] of map) {
    const body = readText(rel);
    if (!body) continue;
    replaceTaggedConst(fileAbs, constName, body);
    done.push({ file: path.relative(ROOT, fileAbs), constName });
  }
  return done;
}

async function cmdRebuild() {
  const ragPgvectorService = require('../services/ragPgvectorService');
  const result = await ragPgvectorService.rebuildAllRagIndex();
  return { ok: true, rebuild: result };
}

async function cmdApply(flags) {
  if (!fs.existsSync(path.join(OUT, 'chat', 'system-prompt.md'))) {
    throw new Error(`Нет снимка в ${OUT}. Сначала dump.`);
  }
  const chat = await applyChat(flags);
  await applyAgents(flags);
  const welcome = await applyWelcome();
  let config = null;
  if (flags.has('--apply-config')) {
    await applyConfig();
    config = 'updated';
  }
  let code = null;
  if (flags.has('--sync-code')) {
    code = syncCode();
  }
  return { ok: true, ...chat, welcome, config, code };
}

async function cmdStatus() {
  const settingsService = require('../services/aiAssistantSettingsService');
  const rulesService = require('../services/aiAssistantRulesService');
  const settings = await settingsService.getSettings();
  const rules = await rulesService.getAllRules();
  const filePrompt = readText('chat/system-prompt.md');
  const dbPrompt = String(settings?.system_prompt || '').trim();
  const ragIds = settings?.selected_rag_tables || [];
  const ragNames = await namesForTableIds(ragIds);
  return {
    folder: OUT,
    dump_exists: Boolean(filePrompt),
    db_prompt_chars: dbPrompt.length,
    file_prompt_chars: filePrompt.length,
    prompt_equal: filePrompt === dbPrompt,
    db_rules: (rules || []).map((r) => r.name),
    rag_tables: ragIds,
    rag_table_names: ragNames
  };
}

async function main() {
  const { cmd, flags } = parseArgs(process.argv);
  let result;
  if (cmd === 'dump') result = await cmdDump();
  else if (cmd === 'apply') result = await cmdApply(flags);
  else if (cmd === 'rebuild') result = await cmdRebuild();
  else if (cmd === 'status') result = await cmdStatus();
  else throw new Error(`Неизвестная команда: ${cmd}`);

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { OUT, cmdDump, cmdApply, cmdStatus };
