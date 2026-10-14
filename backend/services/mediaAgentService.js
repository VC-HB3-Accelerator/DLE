/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * ИИ-агент медиатеки: чат → картинка/видео (DashScope / Qwen Cloud),
 * результат пишется в content_media.
 */

const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const logger = require('../utils/logger');
const { getProviderSettings } = require('./aiProviderSettingsService');
const contentMediaStore = require('./contentMediaStore');
const mediaAgentSkills = require('./mediaAgentSkills');
const orchJobStore = require('./orchJobStore');
const {
  evaluateImageReferencePolicy,
  looksLikeNamedEquipment,
  referenceQuestion,
} = require('./mediaImagePolicy');

const QWEN_COMPAT_DEFAULT = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const JOBS = new Map();
const JOB_TTL_MS = 30 * 60 * 1000;

function compatRoot(compatUrl) {
  return String(compatUrl || QWEN_COMPAT_DEFAULT).trim().replace(/\/+$/, '');
}

function extractCompatImageUrl(data) {
  if (Array.isArray(data?.data) && data.data[0]?.url) return data.data[0].url;
  const content =
    data?.output?.choices?.[0]?.message?.content || data?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    const block = content.find((c) => (c.type === 'image' && c.image) || c.image);
    if (block?.image) return block.image;
  }
  return firstImageUrl(data);
}

function providerError(data, status, headers, fallback) {
  const err = new Error(data?.message || data?.error?.message || data?.code || fallback);
  err.status = Number(status) || 502;
  err.code = data?.code || data?.error?.code;
  err.headers = headers;
  return err;
}

async function generateViaImagesApi({ route, prompt, size, reference }) {
  const root = compatRoot(route.baseUrl);
  const { data, status, headers } = await axios.post(
    `${root}/images/generations`,
    {
      model: route.model,
      prompt: String(prompt),
      n: 1,
      size: size && String(size).includes('*') ? 'auto' : (size || 'auto'),
      prompt_extend: true,
      prompt_extend_mode: 'direct',
      enable_thinking: false,
      watermark: false,
      ...(reference ? { image: `data:${reference.mime};base64,${reference.base64}` } : {}),
    },
    {
      headers: dashHeaders(route.apiKey),
      timeout: 180000,
      validateStatus: () => true,
    }
  );
  if (status >= 400) {
    throw providerError(data, status, headers, `images/generations HTTP ${status}`);
  }
  const url = extractCompatImageUrl(data);
  if (!url) throw new Error('images/generations: нет URL картинки');
  return { url, model: route.model };
}

async function generateViaMultimodalImage({ route, prompt, size, reference }) {
  const apiBase = nativeApiBase(route.baseUrl);
  const { data, status, headers } = await axios.post(
    `${apiBase}/services/aigc/multimodal-generation/generation`,
    {
      model: route.model,
      input: {
        messages: [{
          role: 'user',
          content: [
            ...(reference
              ? [{ image: `data:${reference.mime};base64,${reference.base64}` }]
              : []),
            { text: String(prompt) },
          ],
        }],
      },
      parameters: {
        n: 1,
        size: size || '1280*1280',
        watermark: false,
        prompt_extend: true,
        enable_thinking: false,
      },
    },
    {
      headers: dashHeaders(route.apiKey),
      timeout: 180000,
      validateStatus: () => true,
    }
  );
  if (status >= 400 || (data?.code && !extractCompatImageUrl(data))) {
    throw providerError(data, status >= 400 ? status : 502, headers, `multimodal HTTP ${status}`);
  }
  const url = extractCompatImageUrl(data);
  if (!url) throw new Error('multimodal: нет URL картинки');
  return { url, model: route.model };
}

async function generateViaAsyncT2i({ route, prompt, size, reference }) {
  if (reference) {
    const error = new Error('Выбранный adapter не поддерживает исходное изображение');
    error.code = 'ROUTE_UNAVAILABLE';
    throw error;
  }
  const apiBase = nativeApiBase(route.baseUrl);
  const taskId = await submitAsync({
    apiBase,
    apiKey: route.apiKey,
    pathSuffix: '/services/aigc/text2image/image-synthesis',
    model: route.model,
    input: { prompt },
    parameters: { size: size || '1280*1280', n: 1 },
  });
  const done = await pollDashScopeTask({
    apiBase,
    apiKey: route.apiKey,
    taskId,
    timeoutMs: 4 * 60 * 1000,
  });
  const url = firstImageUrl(done);
  if (!url) throw new Error('Нет URL картинки в ответе');
  return { url, model: route.model };
}

async function generateImage({ route, prompt, size, reference }) {
  switch (route.adapter.id) {
    case 'images_generations':
      return generateViaImagesApi({ route, prompt, size, reference });
    case 'multimodal_image':
      return generateViaMultimodalImage({ route, prompt, size, reference });
    case 'async_t2i':
      return generateViaAsyncT2i({ route, prompt, size, reference });
    default: {
      const error = new Error(`Неподдерживаемый image adapter: ${route.adapter.id}`);
      error.code = 'ADAPTER_UNAVAILABLE';
      throw error;
    }
  }
}

async function generateVideo({ route, prompt, duration }) {
  if (route.adapter.id !== 'video_synthesis') {
    const error = new Error(`Неподдерживаемый video adapter: ${route.adapter.id}`);
    error.code = 'ADAPTER_UNAVAILABLE';
    throw error;
  }
  const apiBase = nativeApiBase(route.baseUrl);
  const taskId = await submitAsync({
    apiBase,
    apiKey: route.apiKey,
    pathSuffix: '/services/aigc/video-generation/video-synthesis',
    model: route.model,
    input: { prompt },
    parameters: { duration: Number(duration) || 5 },
  });
  const done = await pollDashScopeTask({
    apiBase,
    apiKey: route.apiKey,
    taskId,
    timeoutMs: 8 * 60 * 1000,
  });
  const url = firstVideoUrl(done);
  if (!url) throw new Error('Нет URL видео в ответе');
  return { url, model: route.model };
}
const SYSTEM_INTENT = `Ты агент студии медиа для объявлений (авто, спецтехника, оборудование).
По описанию, примерам и активному skill решаешь: ответить текстом, задать уточнения карточками, сделать картинку или видео.

Верни ТОЛЬКО JSON без markdown:
{
  "kind": "chat" | "image" | "video" | "ask",
  "reply": "короткий ответ пользователю на его языке",
  "prompt": "детальный промпт для генерации на английском (пустая строка если kind=chat или ask)",
  "size": "1280*1280",
  "duration": 5,
  "actions": [{ "type": "read_file" | "run_command", "label": "Read file" }],
  "questions": [
    {
      "id": "format",
      "prompt": "Какой формат подготовить?",
      "options": [
        { "id": "story", "label": "История 9:16", "recommended": true }
      ]
    }
  ]
}

Правила kind:
- ask: не хватает исходника, формата (1:1 / 9:16 / 16:9), цвета, площадки или режима качества. 1–3 вопроса, у каждого 2–4 option, ровно один recommended.
- image: фото, обложка, инстаграм, ракурс, ретушь, замена фона, несколько вариантов оформления.
- video: ролик, анимация, видео, mp4, 5–10 секунд.
- chat: обычный ответ без генерации и без карточек.

actions: если пользователь приложил файлы — type=read_file, label="Read file". Если запускаешь генерацию — можно добавить run_command с label="Run command".

Промпт: фотореализм, техника целиком в кадре, чистый фон или площадка как просил пользователь, без водяных знаков и текста на картинке, если не просили.`;

function gcJobs() {
  const now = Date.now();
  for (const [id, job] of JOBS.entries()) {
    if (now - (job.createdAt || 0) > JOB_TTL_MS) JOBS.delete(id);
  }
}

function nativeApiBase(compatUrl) {
  const raw = String(compatUrl || QWEN_COMPAT_DEFAULT).trim().replace(/\/+$/, '');
  if (/\/compatible-mode\/v1$/i.test(raw)) {
    return raw.replace(/\/compatible-mode\/v1$/i, '/api/v1');
  }
  if (/dashscope/i.test(raw)) {
    if (raw.endsWith('/api/v1')) return raw;
    return `${raw}/api/v1`;
  }
  return 'https://dashscope-intl.aliyuncs.com/api/v1';
}

function dashHeaders(apiKey, extra = {}) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function parseJsonObject(text) {
  const raw = String(text || '').trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

function asText(raw) {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof raw.text === 'string') return raw.text;
  if (Array.isArray(raw)) {
    return raw.map((p) => (typeof p === 'string' ? p : (p?.text || ''))).join('\n');
  }
  return String(raw || '');
}

function guessKindFromText(text) {
  const t = String(text || '').toLowerCase();
  if (/(видео|ролик|анимац|mp4|\bvideo\b|reels)/i.test(t)) return 'video';
  if (/(фото|картинк|изображ|обложк|инстаграм|instagram|ракурс|фон|макет|image|photo)/i.test(t)) {
    return 'image';
  }
  return 'chat';
}

async function completeChat(messages) {
  // Роль brief_chat — оркестратор сам выбирает модель под задачу (не хардкод Settings).
  const router = require('./orchModelRouter');
  const res = await router.chatForRole('brief_chat', messages, {
    temperature: 0.4,
    maxTokens: 1800,
  });
  return asText(res?.content ?? res?.text ?? res);
}

function toVisionContent(text, images) {
  const parts = [];
  for (const img of images || []) {
    parts.push({
      type: 'image_url',
      image_url: { url: `data:${img.mime};base64,${img.base64}` },
    });
  }
  parts.push({ type: 'text', text });
  return parts;
}

function normalizeQuestions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 3).map((q, i) => {
    const options = (Array.isArray(q?.options) ? q.options : [])
      .slice(0, 6)
      .map((o, j) => ({
        id: String(o?.id || `opt-${j}`).slice(0, 64),
        label: String(o?.label || '').trim().slice(0, 120),
        recommended: Boolean(o?.recommended),
      }))
      .filter((o) => o.label);
    if (!options.some((o) => o.recommended) && options[0]) options[0].recommended = true;
    return {
      id: String(q?.id || `q-${i}`).slice(0, 64),
      prompt: String(q?.prompt || '').trim().slice(0, 240),
      options,
    };
  }).filter((q) => q.prompt && q.options.length >= 2);
}

function normalizeActions(raw, { hasFiles, kind }) {
  const list = Array.isArray(raw) ? raw : [];
  const out = list
    .filter((a) => a && (a.type === 'read_file' || a.type === 'run_command'))
    .slice(0, 4)
    .map((a) => ({
      type: a.type,
      label: String(a.label || (a.type === 'read_file' ? 'Read file' : 'Run command')).slice(0, 80),
    }));
  if (hasFiles && !out.some((a) => a.type === 'read_file')) {
    out.unshift({ type: 'read_file', label: 'Read file' });
  }
  if ((kind === 'image' || kind === 'video') && !out.some((a) => a.type === 'run_command')) {
    out.push({ type: 'run_command', label: 'Run command' });
  }
  return out;
}

async function parseIntent({ message, history, images, skillId }) {
  const skillBlock = skillId ? await mediaAgentSkills.getSkillPrompt(skillId) : '';
  const system = skillBlock ? `${SYSTEM_INTENT}\n\n${skillBlock}` : SYSTEM_INTENT;
  const userContent = images?.length
    ? toVisionContent(message, images)
    : message;
  const messages = [
    { role: 'system', content: system },
    ...(Array.isArray(history) ? history.slice(-8) : []),
    { role: 'user', content: userContent },
  ];
  const raw = await completeChat(messages);
  const parsed = parseJsonObject(raw) || {};
  const kind = ['chat', 'image', 'video', 'ask'].includes(parsed.kind)
    ? parsed.kind
    : guessKindFromText(message);
  const questions = kind === 'ask' ? normalizeQuestions(parsed.questions) : [];
  const finalKind = (kind === 'ask' && !questions.length) ? 'chat' : kind;
  return {
    kind: finalKind,
    reply: String(parsed.reply || '').trim()
      || (finalKind === 'chat' || finalKind === 'ask'
        ? String(raw || '').trim()
        : 'Готовлю материал по вашему описанию.'),
    prompt: String(parsed.prompt || message || '').trim(),
    size: String(parsed.size || (finalKind === 'image' ? '1280*1280' : '1280*720')).replace(/x/i, '*'),
    duration: Math.min(10, Math.max(3, Number(parsed.duration) || 5)),
    questions,
    actions: parsed.actions,
  };
}

async function pollDashScopeTask({ apiBase, apiKey, taskId, timeoutMs }) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 2500));
    const { data, status: httpStatus, headers } = await axios.get(
      `${apiBase}/tasks/${encodeURIComponent(taskId)}`,
      {
      headers: dashHeaders(apiKey),
      timeout: 30000,
      validateStatus: () => true,
      }
    );
    if (httpStatus >= 400) {
      throw providerError(data, httpStatus, headers, `DashScope task HTTP ${httpStatus}`);
    }
    const status = data?.output?.task_status || data?.task_status;
    if (status === 'SUCCEEDED') return data;
    if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
      const err = new Error(data?.output?.message || data?.message || `DashScope task ${status}`);
      err.status = 502;
      err.code = 'DASHSCOPE_TASK_FAILED';
      throw err;
    }
  }
  const err = new Error('Генерация слишком долгая, попробуйте ещё раз');
  err.status = 504;
  err.code = 'DASHSCOPE_TIMEOUT';
  throw err;
}

function firstImageUrl(payload) {
  return payload?.output?.results?.[0]?.url
    || payload?.output?.choices?.[0]?.message?.content?.find?.((c) => c?.image)?.image
    || payload?.output?.choices?.[0]?.message?.content?.[0]?.image
    || null;
}

function firstVideoUrl(payload) {
  return payload?.output?.video_url
    || payload?.output?.results?.[0]?.url
    || null;
}

async function submitAsync({ apiBase, apiKey, pathSuffix, model, input, parameters }) {
  const { data, status, headers } = await axios.post(
    `${apiBase}${pathSuffix}`,
    { model, input, parameters },
    {
      headers: dashHeaders(apiKey, { 'X-DashScope-Async': 'enable' }),
      timeout: 60000,
      validateStatus: () => true,
    }
  );
  if (status >= 400 || (data?.code && !data?.output?.task_id)) {
    throw providerError(data, status >= 400 ? status : 502, headers, `DashScope HTTP ${status}`);
  }
  const taskId = data?.output?.task_id;
  if (!taskId) {
    const err = new Error(data?.message || 'DashScope не вернул task_id');
    err.status = 502;
    err.code = 'DASHSCOPE_NO_TASK';
    throw err;
  }
  return taskId;
}

async function ingestRemoteUrl({
  url,
  fileName,
  mimeHint,
  ownerUserId,
  authorAddress,
  idempotencyKey,
}) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 180000,
    maxContentLength: 80 * 1024 * 1024,
    validateStatus: (s) => s >= 200 && s < 400,
  });
  const mime = String(res.headers['content-type'] || mimeHint || 'application/octet-stream')
    .split(';')[0]
    .trim();
  const ext = mime.includes('png') ? '.png'
    : mime.includes('webp') ? '.webp'
      : mime.includes('mp4') ? '.mp4'
        : mime.includes('webm') ? '.webm'
          : mime.includes('jpeg') ? '.jpg'
            : path.extname(fileName || '') || (mime.startsWith('video/') ? '.mp4' : '.jpg');
  const tmp = path.join(os.tmpdir(), `media-agent-${crypto.randomUUID()}${ext}`);
  await fsp.writeFile(tmp, Buffer.from(res.data));
  const stat = await fsp.stat(tmp);
  try {
    const { row } = await contentMediaStore.ingestOneShotFromPath({
      tmpPath: tmp,
      originalName: fileName || `ai${ext}`,
      mimeType: mime,
      size: stat.size,
      authorAddress: authorAddress || 'media-agent',
      ownerUserId,
      idempotencyKey,
    });
    return contentMediaStore.uploadResponse(row);
  } catch (e) {
    await fsp.unlink(tmp).catch(() => {});
    if (e.code === 'USE_CHUNKED_UPLOAD') {
      const err = new Error('Сгенерированный файл слишком большой для прямой записи');
      err.status = 413;
      err.code = e.code;
      throw err;
    }
    throw e;
  }
}

async function putJob(job) {
  gcJobs();
  JOBS.set(job.id, job);
  await orchJobStore.saveJob(job);
  return job;
}

async function getJob(id) {
  gcJobs();
  const key = String(id || '');
  const cached = JOBS.get(key);
  if (cached) return cached;
  const restored = await orchJobStore.getJob(key);
  if (restored) JOBS.set(key, restored);
  return restored;
}

async function cancelJob(id) {
  const job = await getJob(id);
  if (!job) return null;
  if (job.status === 'done' || job.status === 'error' || job.status === 'cancelled') {
    return publicJob(job);
  }
  job.status = 'cancelled';
  job.error = 'Отменено новым сообщением редактора';
  job.updatedAt = Date.now();
  await putJob(job);
  logger.info(`[mediaAgent] job ${job.id} cancelled`);
  return publicJob(job);
}

async function runGenerationJob(job, {
  route,
  intent,
  reference,
  ownerUserId,
  authorAddress,
}) {
  if (job.status === 'cancelled') return;
  job.status = 'generating';
  job.updatedAt = Date.now();
  await putJob(job);
  try {
    const { executeRoute } = require('./orchRouteExecution');
    const gen = await executeRoute(
      route,
      () => (
        intent.kind === 'video'
          ? generateVideo({ route, prompt: intent.prompt, duration: intent.duration })
          : generateImage({
            route,
            prompt: intent.prompt,
            size: intent.size,
            reference,
          })
      )
    );
    const latest = await getJob(job.id);
    if (latest?.status === 'cancelled' || job.status === 'cancelled') return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const fileName = intent.kind === 'video'
      ? `listing_animation_${stamp}.mp4`
      : `listing_photo_${stamp}.jpg`;
    const media = await ingestRemoteUrl({
      url: gen.url,
      fileName,
      mimeHint: intent.kind === 'video' ? 'video/mp4' : 'image/jpeg',
      ownerUserId,
      authorAddress,
      idempotencyKey: `${job.id}:media-ingest`,
    });
    if (job.status === 'cancelled') return;
    job.status = 'done';
    job.media = media;
    job.model = gen.model;
    job.error = null;
  } catch (e) {
    if (job.status === 'cancelled') return;
    logger.error('[mediaAgent] generation failed:', e.message);
    job.status = 'error';
    job.error = e.message || 'Ошибка генерации';
    job.code = e.code || 'MEDIA_AGENT_GEN_FAILED';
  }
  job.updatedAt = Date.now();
  await putJob(job);
}

function absMediaPath(rel) {
  const root = path.join(__dirname, '..');
  return path.resolve(root, String(rel || ''));
}

async function imagesFromDriveIds(ids) {
  const list = Array.isArray(ids) ? ids : [];
  const out = [];
  for (const rawId of list.slice(0, 4)) {
    const row = await contentMediaStore.loadReadyMetaById(rawId);
    if (!row || !String(row.mime_type || '').startsWith('image/')) continue;
    if (!row.file_path) continue;
    try {
      const abs = absMediaPath(row.file_path);
      const buf = await fsp.readFile(abs);
      if (!buf.length || buf.length > 8 * 1024 * 1024) continue;
      out.push({ mime: row.mime_type, base64: buf.toString('base64') });
    } catch (e) {
      logger.warn(`[mediaAgent] drive id ${rawId}: ${e.message}`);
    }
  }
  return out;
}

function parseIdList(raw) {
  let list = raw;
  if (typeof raw === 'string') {
    try { list = JSON.parse(raw); } catch { list = []; }
  }
  if (!Array.isArray(list)) return [];
  return list.map((x) => parseInt(x, 10)).filter((n) => n > 0).slice(0, 4);
}

async function startTurn({
  message,
  history,
  images,
  skillId,
  ownerUserId,
  authorAddress,
  targetOwnerUserId,
  csvText,
  sourceFile,
  documents,
  sessionId,
}) {
  const text = String(message || '').trim();
  const hasDocs = Boolean(documents && documents.length);
  if (!text && !(images && images.length) && !String(csvText || '').trim() && !hasDocs) {
    const err = new Error('Напишите описание или приложите пример');
    err.status = 400;
    err.code = 'EMPTY_TURN';
    throw err;
  }

  const hasFiles = Boolean(images && images.length);
  const listingCsv = require('./listingCsv');
  const csvParsed = csvText ? listingCsv.parseListingCsv(csvText) : { candidates: [] };
  const planner = require('./orchPlanner');
  const goal = await planner.classifyGoalLead({
    message: text,
    csvText,
    images,
    csvParsed,
    documents,
  });
  const cardGoal = goal === 'listing_card' || goal === 'store_card' || goal === 'tables';
  const skipImageGate = cardGoal
    || hasDocs
    || Boolean(csvParsed.candidates.length)
    || planner.defersMedia(text)
    || /объявлен|карточк|описан/i.test(planner.normalizeGoalText(text));
  const guessedKind = guessKindFromText(text);
  const policyKind = looksLikeNamedEquipment(text) || guessedKind === 'image'
    ? 'image'
    : guessedKind;
  const imagePolicy = evaluateImageReferencePolicy({
    message: text,
    kind: policyKind,
    hasReference: hasFiles || Boolean(csvParsed.candidates.length) || hasDocs,
  });
  /* Гейт исходника для карточки — после принятого описания (orchCardMedia), не здесь. */
  if (!skipImageGate && !imagePolicy.allowed) {
    logger.info('[media-agent] turn', {
      goal,
      code: 'NEED_INPUT',
      reason: imagePolicy.reason,
      preview: text.slice(0, 160),
    });
    return {
      kind: 'ask',
      code: 'NEED_INPUT',
      reply: imagePolicy.reason === 'named_equipment_requires_reference'
        ? 'Не запускаю генерацию конкретной техники без исходного фото.'
        : 'Сначала выберите источник изображения.',
      questions: [referenceQuestion(imagePolicy.reason)],
      actions: [],
      job: null,
    };
  }

  const continued = await planner.continueCardBrief({
    message: text,
    ownerUserId,
    sessionId,
  });
  if (continued) {
    logger.info('[media-agent] turn', {
      goal,
      kind: continued.kind,
      job: continued.job?.id || null,
      stage: 'continue_brief',
      preview: text.slice(0, 160),
    });
    return continued;
  }

  const enriched = await planner.continueTableEnrich({
    message: text,
    ownerUserId,
  });
  if (enriched) {
    logger.info('[media-agent] turn', {
      goal,
      kind: enriched.kind,
      job: enriched.job?.id || null,
      stage: 'table_enrich',
      preview: text.slice(0, 160),
    });
    return enriched;
  }

  const planned = await planner.startFromTurn({
    message: text,
    csvText,
    csvParsed,
    images,
    documents,
    ownerUserId,
    targetOwnerUserId: targetOwnerUserId || ownerUserId,
    sourceFile,
    skillId,
    sessionId,
  });
  if (planned) {
    logger.info('[media-agent] turn', {
      goal,
      kind: planned.kind,
      options: (planned.options || []).map((item) => item.id),
      job: planned.job?.id || null,
      preview: text.slice(0, 160),
    });
    return planned;
  }

  const intent = await parseIntent({
    message: text || 'Сделай продающее фото по приложенным примерам.',
    history,
    images,
    skillId,
  });
  const actions = normalizeActions(intent.actions, { hasFiles, kind: intent.kind });
  const latePolicy = evaluateImageReferencePolicy({
    message: text,
    kind: intent.kind,
    hasReference: hasFiles,
  });
  if (!skipImageGate && !latePolicy.allowed) {
    logger.info('[media-agent] turn', {
      goal,
      code: 'NEED_INPUT',
      reason: latePolicy.reason,
      stage: 'late',
      preview: text.slice(0, 160),
    });
    return {
      kind: 'ask',
      code: 'NEED_INPUT',
      reply: latePolicy.reason === 'named_equipment_requires_reference'
        ? 'Не запускаю генерацию конкретной техники без исходного фото.'
        : 'Сначала выберите источник изображения.',
      questions: [referenceQuestion(latePolicy.reason)],
      actions,
      job: null,
    };
  }

  if (intent.kind === 'chat' || intent.kind === 'ask') {
    return {
      kind: intent.kind,
      reply: intent.reply,
      questions: intent.questions || [],
      actions,
      job: null,
    };
  }

  const mediaPlan = await planner.startFromTurn({
    message: text,
    images,
    ownerUserId,
    targetOwnerUserId: targetOwnerUserId || ownerUserId,
    sourceFile,
    skillId,
  });
  if (mediaPlan) return mediaPlan;
  return {
    kind: 'ask',
    reply: intent.reply || 'Нужен явный выбор варианта до генерации.',
    questions: intent.questions || [],
    actions,
    job: null,
  };
}

function publicJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    kind: job.kind,
    media: job.media || null,
    error: job.error || null,
    code: job.code || null,
  };
}

function filesToDocuments(files) {
  const out = [];
  for (const f of files || []) {
    const mime = String(f.mimetype || '');
    const name = String(f.originalname || '');
    if (mime.startsWith('image/')) continue;
    if (!f.buffer || !f.buffer.length || f.buffer.length > 8 * 1024 * 1024) continue;
    out.push({
      buffer: f.buffer,
      filename: name,
      mime,
      text: /csv|text\//i.test(mime) || /\.(csv|tsv|txt)$/i.test(name)
        ? f.buffer.toString('utf8')
        : '',
    });
    if (out.length >= 4) break;
  }
  return out;
}

function filesToImages(files) {
  const out = [];
  for (const f of files || []) {
    const mime = String(f.mimetype || '');
    if (!mime.startsWith('image/')) continue;
    const buf = f.buffer;
    if (!buf || !buf.length || buf.length > 8 * 1024 * 1024) continue;
    out.push({
      mime,
      base64: buf.toString('base64'),
    });
    if (out.length >= 4) break;
  }
  return out;
}

function parseHistory(raw) {
  let list = raw;
  if (typeof raw === 'string') {
    try { list = JSON.parse(raw); } catch { list = []; }
  }
  if (!Array.isArray(list)) return [];
  return list
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
    .slice(-8);
}

async function hasQwenKey() {
  const s = await getProviderSettings('qwencloud').catch(() => null);
  return Boolean(s?.api_key);
}

module.exports = {
  startTurn,
  getJob,
  publicJob,
  cancelJob,
  generateImage,
  generateVideo,
  storeGeneratedFrame: ingestRemoteUrl,
  filesToImages,
  filesToDocuments,
  imagesFromDriveIds,
  parseHistory,
  parseIdList,
  hasQwenKey,
};
