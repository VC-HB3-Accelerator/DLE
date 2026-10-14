'use strict';

const crypto = require('crypto');
const consent = require('./orchConsent');
const budget = require('./orchJobBudget');
const orchTrace = require('./orchTrace');

const OPTION_VERSION = 1;

function extractPhotoCount(text) {
  const match = String(text || '').match(/(\d+)\s*(фото|картин|изображ|image|photo)/i);
  if (!match) return null;
  return Math.min(10, Math.max(1, Number(match[1])));
}

function extractSearchCount(text) {
  const raw = String(text || '');
  const match = raw.match(/найд[иь]\s+(\d+)/i)
    || raw.match(/(\d+)\s*(исходник|в\s+сети|в\s+интернет)/i);
  if (!match) return null;
  return Math.min(16, Math.max(1, Number(match[1])));
}

function listingCountQuestions() {
  const prompt = 'Напишите, сколько исходников найти, сколько фото положить в карточку (1–10) и нужно ли одно видео до 60 секунд. Без ответа не ищу и не рисую.';
  return [{
    id: 'media.ask',
    field: 'media.ask',
    prompt,
    text: prompt,
  }];
}

function wantsVideo(text) {
  const raw = String(text || '');
  if (/без\s+видео|no\s+video|skip\s+video/i.test(raw)) return 'skip';
  if (/видео|video/i.test(raw)) return 'generate';
  return 'ask';
}

function normalizeGoalText(message) {
  return String(message || '').replace(/обьявлен/gi, 'объявлен');
}

function defersMedia(text) {
  return /(?:изображен|фото|картинк)\w*\s+потом|(?:потом)\s+(?:изображен|фото|картинк)|без\s+(?:фото|картин|изображ)|сначала\s+(?:описан|карточк|текст)/i
    .test(String(text || ''));
}

function hasSheetFile(documents) {
  return (Array.isArray(documents) ? documents : []).some((doc) => {
    const name = String(doc?.filename || '');
    const mime = String(doc?.mime || '');
    return /\.xlsx?$/i.test(name) || /spreadsheet|excel/i.test(mime);
  });
}

function classifyGoal({ message, csvText, images, csvParsed, documents } = {}) {
  const text = normalizeGoalText(message);
  const hasCsv = Boolean(String(csvText || '').trim() || csvParsed?.candidates?.length);
  const sheet = hasSheetFile(documents);
  const tableTalk = /\/tables|создай\s+таблиц|наполни\s+таблиц|таблиц\w*\s+на\s+\/tables|выборк\w+\s+данн|обогат|эксел|excel|xlsx/i.test(text);
  const cardTalk = /объявлен|карточк|магазин|витрин|пакет/i.test(text);
  if (tableTalk || (sheet && !cardTalk)) {
    return 'tables';
  }
  if (/магазин|витрин|store\s*card|карточк\w+\s+магазин|товар(а|ы|у)?\b/i.test(text)
    && !/пакет|listing-package|8\s*\+\s*1/i.test(text)) {
    return 'store_card';
  }
  if (hasCsv || /пакет|карточки\s+техник|listing-package|8\s*\+\s*1/i.test(text)) {
    return 'listing_media';
  }
  if (/объявлен|listing\s*card|карточк\w+\s+лент|(?:сделай|сделаем|сделать|создай|создадим|создам|создайте|создать)\s+карточк|карточк\w+.{0,48}описан|описан.{0,48}карточк|по\s+этом(у|у)\s+pdf|по\s+pdf/i.test(text)) {
    return 'listing_card';
  }
  if (/парс|контакт|сайт.*сбор|собери\s+контакт/i.test(text)) return 'parser';
  if (/рассыл|broadcast|персонализ/i.test(text)) return 'broadcast';
  if (/найди в базе|документац|rag\b/i.test(text)) return 'rag';
  if (defersMedia(text)) return 'ask';
  if (/видео|video/i.test(text)) return 'video';
  if (/фото|картинк|изображ|нарисуй|сгенер/i.test(text)) return 'image';
  if (images?.length) return 'image';
  return 'ask';
}

function option(partial) {
  return {
    version: OPTION_VERSION,
    artifacts: [],
    side_effects: [],
    tools: [],
    agents: ['orchestrator'],
    cost_hint: 'оценка по observations после выбора',
    risk: 'low',
    ...partial,
  };
}

function listingOptions(input) {
  const photos = extractPhotoCount(input.message);
  const search = extractSearchCount(input.message) || photos;
  const video = wantsVideo(input.message);
  if (!photos) {
    return [
      option({
        id: 'listing-ask-counts',
        kind: 'ask',
        title: 'Сначала число поиска и число кадров',
        summary: 'Лимит объявления: 1–10 фото, 0 или 1 видео. Без ответа не ищу и не рисую.',
        tools: ['ask_user'],
        questions: listingCountQuestions(),
      }),
    ];
  }
  const targets = (input.csvParsed?.candidates || []).map((row) => ({
    brand: row.brand,
    model: row.model,
    keep_target: photos,
    search_count: search,
    websites: row.websites || [],
  }));
  return [
    option({
      id: 'listing-dynamic',
      kind: 'listing_media_package',
      title: `Пакет для объявления: ${photos} фото` + (video === 'skip' ? ' без видео' : video === 'generate' ? ' + видео' : ', видео спросить'),
      summary: search && search !== photos
        ? `Найти ${search} исходников, в карточку ${photos} фото. Лимит карточки: 10 фото, 1 видео.`
        : 'Поиск исходников, генерация кадров. Лимит карточки: 1–10 фото, 0 или 1 видео.',
      keep_target: photos,
      search_count: search,
      video,
      targets,
      artifacts: ['listing_album', video === 'skip' ? null : 'listing_video'].filter(Boolean),
      side_effects: [
        'internet_search',
        'paid_image_generation',
        video === 'generate' ? 'paid_video_generation' : null,
        'media_library_ingest',
      ].filter(Boolean),
      tools: ['search_web', 'fetch_url', 'media_agent.generate_image', 'media.ingest_to_album'],
      agents: ['parser', 'research', 'image', 'critic', 'acceptor', 'ingest'],
      skill_id: 'listing-package-8plus1',
      cost_hint: `${photos} image calls + search`,
      risk: 'paid_generation',
    }),
    option({
      id: 'listing-research',
      kind: 'research_only',
      title: `Только поиск: ${search || photos} исходников, без генерации`,
      summary: 'Ask-режим: найти фото, ничего не писать в медиатеку.',
      keep_target: photos,
      search_count: search,
      video: 'skip',
      targets,
      artifacts: ['research_candidates'],
      side_effects: ['internet_search'],
      tools: ['search_web', 'fetch_url'],
      agents: ['research'],
      cost_hint: 'search only',
      risk: 'low',
    }),
  ];
}

function parserOptions() {
  return [
    option({
      id: 'parser-start',
      kind: 'site_parser',
      title: 'Запустить парсер контактов',
      summary: 'Tool site_parser.start_job с правами EDIT_CONTACTS. Пишет job парсера.',
      artifacts: ['parser_job'],
      side_effects: ['ingest'],
      tools: ['site_parser.start_job', 'site_parser.get_job'],
      risk: 'writes_contacts',
    }),
    option({
      id: 'parser-status',
      kind: 'site_parser_status',
      title: 'Только статус уже запущенного парсера',
      summary: 'Чтение без новых side effects.',
      artifacts: ['parser_job_status'],
      tools: ['site_parser.get_job'],
    }),
  ];
}

function broadcastOptions() {
  return [
    option({
      id: 'broadcast-personalize',
      kind: 'broadcast_personalize',
      title: 'Персонализировать письмо, не отправлять',
      summary: 'broadcast.personalize — subject+greeting. Enqueue send требует отдельного согласия.',
      artifacts: ['broadcast_draft'],
      tools: ['broadcast.personalize', 'broadcast.get_settings'],
    }),
    option({
      id: 'broadcast-settings',
      kind: 'broadcast_settings',
      title: 'Показать настройки рассылки',
      summary: 'Только чтение settings.',
      artifacts: ['broadcast_settings'],
      tools: ['broadcast.get_settings'],
    }),
  ];
}

function ragOptions() {
  return [
    option({
      id: 'rag-answer',
      kind: 'rag',
      title: 'Ответить из базы знаний (RAG)',
      summary: 'rag.answer через authenticated path. Ничего не пишет.',
      artifacts: ['rag_answer'],
      tools: ['rag.answer'],
    }),
  ];
}

function listingCardOptions() {
  return [
    option({
      id: 'listing-card-draft',
      kind: 'listing_card',
      card_kind: 'listing',
      title: 'Собрать описание объявления по схеме полей',
      summary: 'Без генерации и без выкладки. Пустые обязательные — вопросы.',
      artifacts: ['card_brief'],
      tools: ['file.parse', 'search.pages', 'listing.create_draft'],
      side_effects: [],
    }),
    option({
      id: 'listing-card-then-media',
      kind: 'listing_card',
      card_kind: 'listing',
      title: 'Описание, затем спросить число/размер/видео',
      summary: 'Медиа только после принятого описания. Не пакет 8+1 молча.',
      artifacts: ['card_brief'],
      tools: ['file.parse', 'search.pages', 'listing.create_draft', 'card.plan_media', 'ask_user'],
      side_effects: [],
    }),
    option({
      id: 'listing-card-ask',
      kind: 'ask',
      title: 'Уточнить: объявление, магазин или сначала таблица',
      summary: 'Неясно — спросить, не запускать пакет фото.',
      tools: ['ask_user'],
    }),
  ];
}

function storeCardOptions() {
  return [
    option({
      id: 'store-card-draft',
      kind: 'store_card',
      card_kind: 'store',
      title: 'Собрать карточку магазина по схеме (черновик)',
      summary: 'Цена и токен не выдумываются. published запрещён.',
      artifacts: ['card_brief'],
      tools: ['file.parse', 'search.pages', 'store.create_draft'],
      side_effects: [],
    }),
    option({
      id: 'store-card-ask',
      kind: 'ask',
      title: 'Сначала уточнить название, цену и токен',
      summary: 'Без записи в магазин.',
      tools: ['ask_user'],
    }),
    option({
      id: 'store-not-media',
      kind: 'store_card',
      card_kind: 'store',
      title: 'Это не пакет фото 8+1',
      summary: 'Карточка магазина ≠ объявление с папкой кадров.',
      artifacts: ['card_brief'],
      tools: ['file.parse', 'search.pages', 'store.create_draft'],
      side_effects: [],
    }),
  ];
}

function tablesOptions() {
  return [
    option({
      id: 'tables-preview',
      kind: 'tables',
      card_kind: 'table',
      title: 'Разобрать файл и показать выборку, не писать',
      summary: 'Excel/CSV как есть. Колонки из фразы + пустые поля под обогащение. Запись только после согласия.',
      artifacts: ['file_preview'],
      tools: ['file.parse'],
      side_effects: [],
    }),
    option({
      id: 'tables-create',
      kind: 'tables',
      card_kind: 'table',
      title: 'Создать таблицу после согласия',
      summary: 'Имя, описание, флаг базы знаний. Строки — отдельным шагом.',
      artifacts: ['card_brief'],
      tools: ['tables.create'],
      side_effects: ['tables_write'],
    }),
    option({
      id: 'tables-enrich',
      kind: 'tables',
      card_kind: 'table',
      title: 'Обогатить пустые ячейки поиском',
      summary: 'Сначала дифф. Запись только отдельным согласием. Заполненное не трогаю.',
      artifacts: ['enrich_diff'],
      tools: ['search.pages', 'tables.enrich'],
      side_effects: [],
    }),
  ];
}

function mediaOptions(input) {
  const photos = extractPhotoCount(input.message) || 1;
  const video = wantsVideo(input.message);
  const modelIds = (input.mediaModels || [])
    .map((row) => String(row?.id || row || '').trim())
    .filter(Boolean);
  const out = [];
  if (modelIds.length) {
    for (const [index, modelId] of modelIds.entries()) {
      out.push(option({
        id: `media-model-${index}`,
        kind: input.goal === 'video' || video === 'generate' ? 'video' : 'image',
        title: `Модель: ${modelId}`,
        summary: 'Запущу только после этого выбора. Языковая модель картинку не рисует.',
        keep_target: photos,
        video,
        model: modelId,
        artifacts: [input.goal === 'video' ? 'video' : 'image'],
        side_effects: input.goal === 'video' || video === 'generate'
          ? ['paid_video_generation']
          : ['paid_image_generation'],
        tools: ['media_agent.generate_image'],
        risk: 'paid_generation',
      }));
    }
  } else {
    out.push(option({
      id: 'media-generate',
      kind: input.goal === 'video' || video === 'generate' ? 'video' : 'image',
      title: input.goal === 'video' || video === 'generate' ? 'Сгенерировать видео' : `Сгенерировать ${photos} фото`,
      summary: 'В каталоге ключа нет моделей фото/видео. Проверьте Settings → AI.',
      keep_target: photos,
      video,
      artifacts: [input.goal === 'video' ? 'video' : 'image'],
      side_effects: input.goal === 'video' || video === 'generate'
        ? ['paid_video_generation']
        : ['paid_image_generation'],
      tools: ['media_agent.generate_image'],
      risk: 'paid_generation',
    }));
  }
  out.push(option({
    id: 'media-ask',
    kind: 'ask',
    title: 'Сначала уточнить формат и исходник',
    summary: 'Без генерации.',
    tools: ['ask_user'],
  }));
  return out;
}

const LEAD_GOALS = new Set([
  'listing_card', 'store_card', 'tables', 'listing_media',
  'parser', 'broadcast', 'rag', 'image', 'video', 'ask',
]);

const LEAD_SYSTEM = [
  'Ты ведущий оркестратора ОС. Верни только JSON {"goal":"..."}.',
  'goal один из: listing_card, store_card, tables, listing_media, parser, broadcast, rag, image, video, ask.',
  'Карточка объявления важнее слов про картинку. «обьявления», «изображение потом», «создадим карточку» = listing_card.',
  'Магазин/витрина/товар без пакета 8+1 = store_card.',
  'Создай таблицу /tables = tables. Умеешь читать таблицы без команды создать = ask или listing_card, если есть объявление.',
  'Пакет 8+1 / CSV техники = listing_media.',
  'Явно «нарисуй фото/видео» без карточки = image или video.',
  'Неясно = ask. Не выдумывай другие goal.',
].join(' ');

async function classifyGoalLead(input = {}, hooks = {}) {
  if (typeof hooks.classifyLead === 'function') {
    const goal = await hooks.classifyLead(input);
    if (LEAD_GOALS.has(goal)) return goal;
  }
  const fallback = classifyGoal(input);
  if (process.env.NODE_TEST_CONTEXT && !hooks.forceLead) return fallback;
  if (hooks.skipLead) return fallback;
  try {
    const router = require('./orchModelRouter');
    const res = await router.chatForRole('brief_chat', [
      { role: 'system', content: LEAD_SYSTEM },
      { role: 'user', content: String(input.message || '').slice(0, 2000) },
    ], { temperature: 0, maxTokens: 80, json: true });
    const raw = res?.content ?? res?.text ?? res;
    let parsed = null;
    if (typeof raw === 'object' && raw) parsed = raw;
    else if (res?.parseJsonLoose) parsed = res.parseJsonLoose(String(raw || ''));
    else {
      try { parsed = JSON.parse(String(raw || '')); } catch { parsed = null; }
    }
    const goal = String(parsed?.goal || '').trim();
    if (LEAD_GOALS.has(goal)) return goal;
  } catch {
    /* regex запасной */
  }
  return fallback;
}

async function listMediaModelsForGoal(goal, hooks = {}) {
  if (goal !== 'image' && goal !== 'video') return [];
  if (typeof hooks.listMediaModels === 'function') {
    const listed = await hooks.listMediaModels({ goal });
    return Array.isArray(listed) ? listed : [];
  }
  if (process.env.NODE_TEST_CONTEXT) return [];
  try {
    const router = require('./orchModelRouter');
    return await router.listModelsForRole(goal === 'video' ? 'video_gen' : 'image_gen');
  } catch {
    return [];
  }
}

function proposeOptions(input = {}) {
  const goal = input.goal && LEAD_GOALS.has(input.goal)
    ? input.goal
    : classifyGoal(input);
  if (goal === 'ask') {
    return {
      goal,
      kind: 'chat',
      reply: null,
      options: [],
    };
  }
  const builders = {
    listing: listingOptions,
    listing_media: listingOptions,
    listing_card: listingCardOptions,
    store_card: storeCardOptions,
    tables: tablesOptions,
    parser: parserOptions,
    broadcast: broadcastOptions,
    rag: ragOptions,
    image: mediaOptions,
    video: mediaOptions,
  };
  const built = (builders[goal] || (() => []))({ ...input, goal });
  const options = (goal === 'image' || goal === 'video') ? built : built.slice(0, 3);
  const needCounts = (goal === 'listing_media' || goal === 'listing')
    && !extractPhotoCount(input.message);
  const questions = needCounts ? listingCountQuestions() : [];
  const reply = needCounts
    ? 'Лимит объявления: 1–10 фото и одно видео (до 60 с). Сколько найти в сети и сколько положить в карточку? Без ответа не ищу и не рисую.'
    : (goal === 'image' || goal === 'video') && input.mediaModels?.length
      ? 'Выберите модель генерации. До выбора ключ не трачу.'
      : (goal === 'image' || goal === 'video')
        ? 'Задача на фото или видео. Выберите вариант. До выбора генерацию не запускаю.'
        : 'Выберите вариант. До выбора пишущие tools не запускаются.';
  return {
    goal,
    kind: 'plan_options',
    reply,
    options,
    questions,
  };
}

function publicJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    kind: job.kind,
    run_mode: job.run_mode,
    trace_id: job.trace_id || null,
  };
}

async function phraseAsk(fallback, userText, hooks = {}) {
  if (process.env.NODE_TEST_CONTEXT && !hooks.forceLeadPhrase) return fallback;
  try {
    const router = require('./orchModelRouter');
    const chat = hooks.chatForRole
      || ((role, messages, opts) => router.chatForRole(role, messages, opts));
    const res = await chat('brief_chat', [
      {
        role: 'system',
        content: 'Ты ведущий оркестратора. Один короткий вопрос по-русски. Без кнопок, без списков 3/5/10 и без готовых вариантов. Спроси только то, чего нет во фразе. Фото не рисуй.',
      },
      {
        role: 'user',
        content: `Фраза человека: ${String(userText || '').slice(0, 1500)}\nНе хватает: ${fallback}`,
      },
    ], { temperature: 0.2, maxTokens: 160 });
    const text = String(res?.content ?? res?.text ?? '').trim();
    if (text && !text.startsWith('{')) return text.slice(0, 500);
  } catch {
    /* запасная фраза */
  }
  return fallback;
}

function decisionScopeForGoal(goal) {
  if (goal === 'listing_card' || goal === 'store_card') return 'orch.product';
  if (goal === 'listing_media' || goal === 'listing') return 'listing.keep_target';
  return '';
}

function blockedAsk(error) {
  return {
    kind: 'ask',
    code: 'BLOCKED_ASK',
    reply: error.message,
    questions: [],
    actions: [],
    job: null,
    batch: null,
  };
}

async function recallDecisions(goal, hooks = {}) {
  const scope = decisionScopeForGoal(goal);
  if (!scope) return { decisions: [] };
  if (process.env.NODE_TEST_CONTEXT && !hooks.forceDecisions) return { decisions: [] };
  const decisions = hooks.decisions || require('./orchDecisions');
  try {
    if (typeof decisions.ensureActiveSeed === 'function' && !hooks.decisions) {
      await decisions.ensureActiveSeed(hooks);
    }
    const active = await decisions.assertNoActiveConflict(scope, hooks);
    if (!active) return { decisions: [] };
    return {
      decisions: [{
        id: String(active.id || ''),
        scope: String(active.scope || scope),
        decision: String(active.decision || '').slice(0, 400),
      }],
    };
  } catch (error) {
    if (error && error.code === 'BLOCKED_ASK') return { blocked: error };
    return { decisions: [] };
  }
}

async function startFromTurn(input = {}, hooks = {}) {
  const goal = await classifyGoalLead(input, hooks);
  const recalled = await recallDecisions(goal, hooks);
  if (recalled.blocked) return blockedAsk(recalled.blocked);
  const mediaModels = await listMediaModelsForGoal(goal, hooks);
  const proposed = proposeOptions({ ...input, goal, mediaModels });
  if (proposed.kind === 'chat' || !proposed.options.length) return null;

  const job = {
    id: crypto.randomUUID(),
    kind: 'os_plan',
    status: 'waiting_human',
    run_mode: 'plan',
    owner_user_id: input.ownerUserId || null,
    target_owner_user_id: input.targetOwnerUserId || input.ownerUserId || null,
    goal: proposed.goal,
    plan: {
      options: proposed.options,
      version: OPTION_VERSION,
      source_message: String(input.message || '').slice(0, 2000),
      session_id: String(input.sessionId || '').slice(0, 80),
      decisions: recalled.decisions,
    },
    cursor: { phase: 'choose_option' },
    limits: budget.DEFAULT_LIMITS,
    usage: { model_calls: 0, attempts: 0, tokens: 0, cost: 0, started_at: new Date().toISOString() },
    trace_id: orchTrace.newTraceId(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (input.documents?.length || input.fileText || input.csvText) {
    try {
      const parser = hooks.fileParse || require('./orchFileParse');
      const preview = parser.parse({
        documents: input.documents,
        text: input.fileText || (input.csvText && !input.documents?.length ? input.csvText : ''),
        filename: input.sourceFile || null,
      });
      if (preview && preview.kind !== 'empty') {
        const tabular = ['csv', 'tsv', 'xlsx'].includes(preview.kind) || proposed.goal === 'tables';
        job.plan.file_preview = tabular
          ? require('./orchTablePlan').planFromPreview({ preview, message: input.message })
          : preview;
      }
    } catch {
      /* preview best-effort */
    }
  }

  const store = hooks.jobStore || require('./orchJobStore');
  try {
    await store.saveJob(job);
  } catch {
    // options still returned; persist is best-effort in unit tests without DB
  }
  try {
    await orchTrace.recordSpan({
      trace_id: job.trace_id,
      job_id: job.id,
      role: 'brief_chat',
      status: 'plan_proposed',
      policy: { goal: proposed.goal, run_mode: 'plan' },
      candidates: proposed.options.map((item) => item.id),
    }, hooks);
  } catch {
    /* ignore */
  }

  if (proposed.goal === 'listing_card' || proposed.goal === 'store_card') {
    const preferredId = proposed.goal === 'listing_card'
      ? 'listing-card-then-media'
      : 'store-card-draft';
    const option = (proposed.options || []).find((item) => item.id === preferredId)
      || proposed.options[0];
    job.selected_option_id = option?.id || null;
    job.plan = { ...(job.plan || {}), options: option ? [option] : [] };
    const phase = await applyCardBriefPhase(job, { option, hooks, store });
    return { ...phase, options: phase.options || [] };
  }

  if (proposed.goal === 'tables' && job.plan.file_preview?.columns?.length) {
    job.selected_option_id = 'tables-preview';
    job.cursor = { phase: 'file_preview', option_id: 'tables-preview' };
    job.plan = { ...(job.plan || {}), options: [] };
    job.status = 'waiting_human';
    job.updated_at = new Date().toISOString();
    try { await store.saveJob(job); } catch { /* preview still returned */ }
    return {
      kind: 'file_preview',
      reply: 'Предпросмотр строк. Запись в /tables — отдельным согласием.',
      questions: job.plan.file_preview.questions || [],
      options: [],
      actions: [],
      file_preview: job.plan.file_preview,
      job: publicJob(job),
      batch: null,
      pool: null,
    };
  }

  if ((proposed.questions || []).some((item) => item.id === 'media.ask')) {
    const spoken = await phraseAsk(proposed.reply, input.message, hooks);
    proposed.reply = spoken;
    proposed.questions = proposed.questions.map((item) => (
      item.id === 'media.ask' ? { ...item, prompt: spoken, text: spoken } : item
    ));
  }

  return {
    kind: 'plan_options',
    reply: proposed.reply,
    questions: proposed.questions || [],
    options: proposed.options,
    actions: [],
    job: publicJob(job),
    batch: null,
    pool: null,
    file_preview: job.plan.file_preview || null,
  };
}

function cardBriefReply({ option, report, filled }) {
  const brief = report?.brief;
  if (option?.kind === 'tables' || option?.id === 'tables') {
    return 'Предпросмотр строк. Запись в /tables — отдельным согласием.';
  }
  if (brief?.kind === 'listing' && filled) {
    return [brief.title, brief.excerpt, brief.description].filter(Boolean).join('\n\n');
  }
  if (brief?.kind === 'store' && String(brief.title || '').trim()) {
    return [brief.title, brief.excerpt].filter(Boolean).join('\n\n');
  }
  if (option?.id === 'listing-card-then-media') {
    return 'Пустые обязательные поля — вопросы, не выдумка.';
  }
  return filled
    ? [brief?.title, brief?.excerpt].filter(Boolean).join('\n\n')
    : 'Собрал что смог. Пустые обязательные поля — вопросы, не выдумка.';
}

async function sameOpenCard(text, job, hooks = {}) {
  if (typeof hooks.sameCard === 'function') return Boolean(await hooks.sameCard({ text, job }));
  if (process.env.NODE_TEST_CONTEXT && !hooks.forceSameCard) return true;
  const brief = job?.plan?.card_brief || {};
  try {
    const router = require('./orchModelRouter');
    const chat = hooks.chatForRole
      || ((role, messages, opts) => router.chatForRole(role, messages, opts));
    const res = await chat('brief_chat', [
      {
        role: 'system',
        content: 'Открыта одна карточка. Реши, новая фраза про неё или про другой объект. Верни только JSON {"same":true|false}. same=true только если это правка полей, ответ на вопрос или факт про тот же объект. Другая марка, модель или новая задача — false.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          open_title: String(brief.title || '').slice(0, 200),
          open_excerpt: String(brief.excerpt || '').slice(0, 300),
          message: String(text || '').slice(0, 1500),
        }),
      },
    ], { temperature: 0, maxTokens: 40, json: true });
    const raw = res?.content ?? res?.text ?? res;
    const parsed = raw && typeof raw === 'object' ? raw : JSON.parse(String(raw || ''));
    if (typeof parsed?.same === 'boolean') return parsed.same;
  } catch {
    /* модель не ответила — не приклеивать фразу к чужой карточке */
  }
  return false;
}

function mapBriefQuestions(report, extras = []) {
  return [
    ...(report.questions || []),
    ...extras,
  ].map((q) => ({
    id: q.id || q.field,
    field: q.field,
    prompt: q.text || q.prompt,
    text: q.text || q.prompt,
    options: q.options || undefined,
  }));
}

async function searchForBrief(job, brief, hooks) {
  const query = String(brief?.title || job.plan?.source_message || '').trim();
  if (!query) return null;
  try {
    if (hooks.searchPages) {
      return await hooks.searchPages({ query, ownerUserId: job.owner_user_id });
    }
    if (!process.env.NODE_TEST_CONTEXT) {
      return await require('./orchPageSearch').searchPages({
        query,
        ownerUserId: job.owner_user_id,
      });
    }
  } catch {
    return null;
  }
  return null;
}

async function applyCardBriefPhase(job, { option, extraMessage = '', hooks = {}, store } = {}) {
  if (!Array.isArray(job.plan?.decisions)) {
    const recalled = await recallDecisions(job.goal, hooks);
    if (recalled.blocked) return blockedAsk(recalled.blocked);
    job.plan = { ...(job.plan || {}), decisions: recalled.decisions };
  }
  const cardBrief = hooks.cardBrief || require('./orchCardBrief');
  const kind = option?.card_kind
    || job.plan?.card_brief?.kind
    || (job.goal === 'store_card' ? 'store' : job.goal === 'tables' ? 'table' : 'listing');
  const seeded = job.plan?.card_brief || cardBrief.emptyBrief({
    kind,
    owner_user_id: job.owner_user_id,
  });
  const guessed = cardBrief.heuristicFill(seeded, {
    message: job.plan?.source_message || '',
    extraMessage,
    file_preview: job.plan?.file_preview || null,
  });
  let searchResult = null;
  const doSearch = kind === 'listing' || kind === 'store';
  if (doSearch) {
    searchResult = await searchForBrief(job, guessed, hooks);
  }
  const sources = searchResult?.sources || job.plan?.sources || [];
  const filledBrief = await cardBrief.fillFromLead(guessed, {
    message: job.plan?.source_message || '',
    extraMessage,
    file_preview: job.plan?.file_preview || null,
    sources,
    decisions: job.plan?.decisions || [],
  }, hooks);
  if (sources.length) filledBrief.sources = sources;
  const report = cardBrief.validate(filledBrief, { intent: 'draft' });
  let mediaPlan = job.plan?.media_plan || null;
  if (option?.id === 'listing-card-then-media') {
    const cardMedia = hooks.cardMedia || require('./orchCardMedia');
    mediaPlan = cardMedia.planMedia({
      brief: report.brief,
      text: [job.plan?.source_message || '', extraMessage].filter(Boolean).join('\n'),
      hasReference: Boolean((hooks.images || []).length),
    });
    if (mediaPlan.params) {
      report.brief.media = { ...report.brief.media, ...mediaPlan.params };
    }
  }
  const filled = Boolean(String(report.brief.title || '').trim()
    && (report.brief.kind !== 'listing' || String(report.brief.excerpt || '').trim()));
  job.plan = {
    ...(job.plan || {}),
    card_brief: report.brief,
    sources,
    media_plan: mediaPlan,
  };
  job.status = 'waiting_human';
  job.run_mode = 'plan';
  job.cursor = { phase: 'card_brief', option_id: option?.id || job.cursor?.option_id };
  job.updated_at = new Date().toISOString();
  await store.saveJob(job);
  let questions = mapBriefQuestions(report, [
    ...((job.plan.file_preview?.questions) || []),
    ...((searchResult?.questions) || []),
    ...((mediaPlan?.questions) || []),
  ]);
  let reply = cardBriefReply({ option: option || { id: job.cursor?.option_id }, report, filled });
  const mediaAsk = questions.find((item) => item.id === 'media.ask');
  if (mediaAsk && !filled) {
    reply = await phraseAsk(
      mediaAsk.prompt,
      extraMessage || job.plan?.source_message || '',
      hooks
    );
    questions = questions.map((item) => (
      item.id === 'media.ask' ? { ...item, prompt: reply, text: reply } : item
    ));
  } else if (mediaAsk) {
    const spoken = await phraseAsk(
      mediaAsk.prompt,
      extraMessage || job.plan?.source_message || '',
      hooks
    );
    questions = questions.map((item) => (
      item.id === 'media.ask' ? { ...item, prompt: spoken, text: spoken } : item
    ));
  }
  let modelOptions = [];
  const paramsOk = Boolean(mediaPlan?.params?.photo_count)
    && Boolean(mediaPlan?.params?.aspect)
    && mediaPlan?.params?.video !== 'ask';
  if (filled && paramsOk && !mediaPlan?.need_reference) {
    if (!mediaPlan.slots?.length) {
      const cardMedia = hooks.cardMedia || require('./orchCardMedia');
      mediaPlan = {
        ...mediaPlan,
        slots: cardMedia.buildSlots(report.brief, mediaPlan.params),
        ready: true,
      };
      job.plan = { ...(job.plan || {}), media_plan: mediaPlan };
    }
    const listed = typeof hooks.listMediaModels === 'function'
      ? await hooks.listMediaModels({ goal: 'image' })
      : (process.env.NODE_TEST_CONTEXT
        ? []
        : await require('./orchModelRouter').listModelsForRole('image_gen'));
    const modelIds = (Array.isArray(listed) ? listed : [])
      .map((row) => String(row?.id || row || '').trim())
      .filter(Boolean);
    modelOptions = modelIds.map((modelId, index) => ({
      version: OPTION_VERSION,
      id: `card-photo-${index}`,
      kind: 'card_photo',
      title: `Модель: ${modelId}`,
      summary: 'Кадр из описания карточки. Запуск только после этого выбора.',
      model: modelId,
      keep_target: mediaPlan.params.photo_count,
      artifacts: ['image'],
      side_effects: ['paid_image_generation'],
      tools: ['media_agent.generate_image'],
      agents: ['orchestrator'],
      cost_hint: 'оценка по observations после выбора',
      risk: 'paid_generation',
    }));
    if (modelOptions.length) {
      questions = questions.filter((item) => item.id !== 'image_source');
      reply = [reply, 'Выберите модель фото из каталога ключа. До выбора не рисую.'].filter(Boolean).join('\n\n');
    } else {
      reply = [reply, 'В каталоге ключа нет моделей фото. Проверьте Settings → AI. Не рисую.'].filter(Boolean).join('\n\n');
    }
  }
  job.plan = { ...(job.plan || {}), options: modelOptions.length ? modelOptions : (job.plan?.options || []) };
  await store.saveJob(job);

  const drafts = hooks.cardDraft || require('./orchCardDraft');
  const tables = hooks.tables || require('./orchTablesTools');
  const formPath = kind === 'table'
    ? tables.tableEditorPath(job.plan?.table_id || null)
    : drafts.editorPath(kind, job.plan?.listing_id || job.plan?.product_id || null);
  return {
    kind: kind === 'table' ? 'file_preview' : 'card_brief',
    reply,
    questions,
    card_brief: report.brief,
    file_preview: job.plan.file_preview || null,
    sources,
    media_plan: mediaPlan,
    form_path: formPath,
    option: option || null,
    options: modelOptions,
    job: publicJob(job),
    batch: null,
  };
}

async function proposeEnrichForJob(job, { extraMessage = '', hooks = {}, store } = {}) {
  const enrich = hooks.tableEnrich || require('./orchTableEnrich');
  const proposed = await enrich.propose({
    preview: job.plan?.file_preview || null,
    tableId: job.plan?.table_id || null,
    message: extraMessage || job.plan?.source_message || '',
    ownerUserId: job.owner_user_id,
  }, hooks);
  job.plan = { ...(job.plan || {}), enrich_diff: proposed };
  job.status = 'waiting_human';
  job.cursor = { phase: 'table_enrich', option_id: 'tables-enrich' };
  job.updated_at = new Date().toISOString();
  if (store) await store.saveJob(job);
  return {
    kind: 'table_enrich',
    reply: proposed.reply,
    questions: proposed.questions || [],
    enrich_diff: proposed.diff || [],
    table_id: proposed.table_id,
    can_apply: Boolean(proposed.can_apply),
    file_preview: job.plan.file_preview || null,
    job: publicJob(job),
    batch: null,
  };
}

async function continueTableEnrich({ message, ownerUserId } = {}, hooks = {}) {
  const enrich = hooks.tableEnrich || require('./orchTableEnrich');
  const text = String(message || '').trim();
  if (!enrich.wantsTableEnrich(text)) return null;
  if (process.env.NODE_TEST_CONTEXT && !hooks.jobStore && !hooks.forceContinue) return null;
  const store = hooks.jobStore || require('./orchJobStore');
  let tableId = enrich.extractTableId(text);
  if (!tableId && typeof store.listRecentJobs === 'function') {
    try {
      const jobs = await store.listRecentJobs({ ownerUserId, limit: 12 });
      const job = (jobs || []).find((item) => (
        item && Number(item.owner_user_id) === Number(ownerUserId) && item.plan?.table_id
      ));
      if (job) {
        return proposeEnrichForJob(job, { extraMessage: text, hooks, store });
      }
    } catch {
      return null;
    }
  }
  if (!tableId) return null;
  const proposed = await enrich.propose({
    tableId,
    message: text,
    ownerUserId,
  }, hooks);
  return {
    kind: 'table_enrich',
    reply: proposed.reply,
    questions: proposed.questions || [],
    enrich_diff: proposed.diff || [],
    table_id: proposed.table_id,
    can_apply: Boolean(proposed.can_apply),
    job: null,
    batch: null,
  };
}

async function continueCardBrief({ message, ownerUserId, sessionId } = {}, hooks = {}) {
  const text = String(message || '').trim();
  if (process.env.NODE_TEST_CONTEXT && !hooks.jobStore && !hooks.forceContinue) return null;
  const store = hooks.jobStore || require('./orchJobStore');
  if (typeof store.listRecentJobs !== 'function') return null;
  let jobs = [];
  try {
    jobs = await store.listRecentJobs({ ownerUserId, limit: 12 });
  } catch {
    return null;
  }
  const sid = String(sessionId || hooks.sessionId || '').trim();
  const job = (jobs || []).find((item) => {
    if (!(
      item
      && item.status === 'waiting_human'
      && item.cursor?.phase === 'card_brief'
      && item.plan?.card_brief
      && Number(item.owner_user_id) === Number(ownerUserId)
    )) return false;
    const bound = String(item.plan?.session_id || '').trim();
    if (!sid) return !bound;
    if (!bound) return true;
    return bound === sid;
  });
  if (!job) return null;
  if (!(await sameOpenCard(text, job, hooks))) return null;
  const option = (job.plan?.options || []).find((item) => item.id === job.selected_option_id)
    || { id: job.cursor?.option_id, kind: job.goal, card_kind: job.plan?.card_brief?.kind };
  return applyCardBriefPhase(job, { option, extraMessage: text, hooks, store });
}

async function produceCardFrames(job, option, hooks, store) {
  const cardMedia = hooks.cardMedia || require('./orchCardMedia');
  const brief = job.plan.card_brief;
  let plan = job.plan.media_plan;
  const imageSlots = (plan.slots || []).filter((row) => row.kind === 'image');
  const generate = hooks.generate || (
    process.env.NODE_TEST_CONTEXT
      ? null
      : (payload) => cardMedia.liveGenerateFrame({
        ...payload,
        ownerUserId: job.owner_user_id,
        idempotencyKey: `${job.id}:${payload.slot_id}:${option.model}`,
      })
  );
  const critic = hooks.critic || (
    process.env.NODE_TEST_CONTEXT
      ? null
      : (payload) => cardMedia.liveCriticFrame(payload)
  );
  for (const slot of imageSlots) {
    plan = await cardMedia.generateSlot({
      brief,
      plan,
      slotId: slot.id,
      text: job.plan.source_message || '',
      hasReference: Boolean((hooks.images || []).length) || plan.params?.source === 'upload',
    }, { generate, model: option.model, critic });
  }
  if (!process.env.NODE_TEST_CONTEXT) {
    const media = require('./mediaAgentService');
    const stored = [];
    for (const row of plan.slots || []) {
      if (row.status === 'accepted' && row.url && !Number(row.media_id)) {
        const saved = await media.storeGeneratedFrame({
          url: row.url,
          fileName: `${row.id || 'frame'}.jpg`,
          mimeHint: 'image/jpeg',
          ownerUserId: job.owner_user_id,
          authorAddress: job.owner_user_id ? `user:${job.owner_user_id}` : 'media-agent',
          idempotencyKey: `${job.id}:${row.id}:${option.model}`,
        });
        stored.push({ ...row, media_id: saved?.id || null, url: saved?.url || row.url });
      } else {
        stored.push(row);
      }
    }
    plan = { ...plan, slots: stored };
  }
  job.plan = { ...(job.plan || {}), media_plan: plan };
  job.selected_option_id = option.id;
  job.status = 'waiting_human';
  job.updated_at = new Date().toISOString();
  let attached = null;
  try {
    attached = await cardMedia.attachMedia({
      pageId: job.plan.listing_id || null,
      productId: job.plan.product_id || job.plan.store_product_id || null,
      slots: plan.slots,
      ownerUserId: job.owner_user_id,
    }, hooks);
  } catch (error) {
    if (error.code !== 'NOTHING_ACCEPTED') throw error;
  }
  await store.saveJob(job);
  const accepted = cardMedia.attachable(plan.slots);
  const rejected = (plan.slots || []).filter((row) => row.status === 'rejected').length;
  return {
    kind: 'card_media',
    reply: accepted.length
      ? `В медиатеку записано кадров: ${accepted.length}. Отклонено: ${rejected}. Выкладки нет.`
      : 'Кадр не принят, в карточку и медиатеку не кладу.',
    media_plan: plan,
    card_brief: brief,
    attached,
    options: [],
    questions: [],
    job: publicJob(job),
    batch: null,
  };
}

async function chooseOption({
  jobId,
  optionId,
  ownerUserId,
  decision = 'choose',
  rawText = '',
} = {}, hooks = {}) {
  consent.assertExplicitDecision(decision, rawText);
  const store = hooks.jobStore || require('./orchJobStore');
  const job = await store.getJob(jobId);
  if (!job) {
    const error = new Error('plan job not found');
    error.code = 'JOB_NOT_FOUND';
    error.status = 404;
    throw error;
  }
  const ownerGuard = hooks.ownerGuard || require('./orchOwnerGuard');
  ownerGuard.assertOwned(job, ownerUserId, 'Задача не найдена');
  const option = (job.plan?.options || []).find((item) => item.id === optionId);
  if (!option) {
    const error = new Error('unknown plan option');
    error.code = 'OPTION_NOT_FOUND';
    error.status = 400;
    throw error;
  }
  const check = budget.evaluateBudget(job, { attempts: 1 });
  if (!check.ok) {
    job.status = check.status;
    job.blocked_reason = check.reason;
    await store.saveJob(job).catch(() => {});
    const error = new Error(check.reason);
    error.code = 'BUDGET_EXHAUSTED';
    error.status = 429;
    throw error;
  }
  consent.assertApproved({
    option,
    decision,
    rawText,
    approval: { status: decision === 'reject' ? 'rejected' : 'approved', plan_version: option.version },
  });

  if (String(decision).toLowerCase() === 'reject') {
    job.status = 'cancelled';
    job.run_mode = 'plan';
    job.cursor = { phase: 'rejected' };
    await store.saveJob(job);
    return { kind: 'plan_rejected', job: publicJob(job), batch: null };
  }

  job.selected_option_id = option.id;
  job.cursor = { phase: 'option_approved', option_id: option.id };
  job.updated_at = new Date().toISOString();

  if (option.id === 'tables-enrich') {
    return proposeEnrichForJob(job, { hooks, store });
  }

  if (option.kind === 'listing_card' || option.kind === 'store_card' || option.kind === 'tables') {
    return applyCardBriefPhase(job, { option, hooks, store });
  }

  if (option.kind === 'card_photo' && option.model && job.plan?.media_plan && job.plan?.card_brief) {
    return produceCardFrames(job, option, hooks, store);
  }

  if (option.kind === 'listing_media_package') {
    const listingBatch = hooks.listingBatch || require('./listingBatchService');
    const targets = (option.targets && option.targets.length)
      ? option.targets.map((row) => ({ ...row, keep_target: option.keep_target }))
      : undefined;
    const batchJob = await listingBatch.startBatch({
      message: job.plan?.source_message || '',
      targets,
      ownerUserId: job.owner_user_id,
      targetOwnerUserId: job.target_owner_user_id,
      runMode: 'execute',
      seedImages: hooks.images || [],
      sourceFile: hooks.sourceFile || null,
      keepTarget: option.keep_target,
      videoPolicy: option.video,
    });
    job.status = 'done';
    job.child_job_id = batchJob.id;
    await store.saveJob(job);
    return {
      kind: 'listing_batch',
      reply: batchJob.reply_hint || 'Запускаю выбранный пакет.',
      job: publicJob(job),
      batch: listingBatch.publicBatch(batchJob),
      pool: listingBatch.publicBatch(batchJob).pool,
    };
  }

  job.status = 'waiting_human';
  job.run_mode = option.side_effects?.length ? 'execute' : 'ask';
  await store.saveJob(job);
  return {
    kind: 'plan_selected',
    reply: `Выбран вариант «${option.title}».`,
    option,
    job: publicJob(job),
    batch: null,
  };
}

module.exports = {
  OPTION_VERSION,
  extractPhotoCount,
  extractSearchCount,
  listingCountQuestions,
  wantsVideo,
  normalizeGoalText,
  defersMedia,
  classifyGoal,
  classifyGoalLead,
  proposeOptions,
  startFromTurn,
  chooseOption,
  continueCardBrief,
  continueTableEnrich,
  publicJob,
};
