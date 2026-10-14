/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Медиа от принятого описания карточки. Число не подставляем молча.
 * Именованная техника без исходника — стоп. Генерация только с брифом кадра.
 */

const {
  evaluateImageReferencePolicy,
  looksLikeNamedEquipment,
  referenceQuestion,
} = require('./mediaImagePolicy');

const ASPECTS = new Set(['1:1', '4:3', '3:4', '16:9', '9:16']);

function extractPhotoCount(text) {
  const match = String(text || '').match(/(\d+)\s*(фото|картин|изображ|image|photo)/i);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isInteger(n)) return null;
  return Math.min(10, Math.max(1, n));
}

function extractAspect(text) {
  const match = String(text || '').match(/\b(1:1|4:3|3:4|16:9|9:16)\b/);
  return match && ASPECTS.has(match[1]) ? match[1] : null;
}

function extractVideo(text, fallback = 'ask') {
  const raw = String(text || '');
  if (/без\s+видео|no\s+video|skip\s+video|видео\s+нет/i.test(raw)) return 'none';
  if (/видео|video/i.test(raw)) return 'yes';
  return fallback;
}

function extractSeconds(text) {
  const match = String(text || '').match(/(\d+)\s*(с|сек|sec)/i);
  if (!match) return null;
  return Math.min(60, Math.max(1, Number(match[1])));
}

function extractSource(text, fallback = 'unknown') {
  const raw = String(text || '');
  if (/сво(и|ё|е)\s+фото|загруз|upload/i.test(raw)) return 'upload';
  if (/из\s+файла|pdf|таблиц/i.test(raw)) return 'file';
  if (/поиск|найди\s+исход/i.test(raw)) return 'search';
  return fallback;
}

function parseMediaParams({ text = '', brief = {} } = {}) {
  const media = brief.media && typeof brief.media === 'object' ? brief.media : {};
  const countFromBrief = Number.isInteger(Number(media.photo_count)) && Number(media.photo_count) > 0
    ? Math.min(10, Number(media.photo_count))
    : null;
  const videoFromBrief = ['none', 'yes', 'ask'].includes(media.video) ? media.video : 'ask';
  return {
    photo_count: countFromBrief || extractPhotoCount(text),
    aspect: ASPECTS.has(media.aspect) ? media.aspect : extractAspect(text),
    video: extractVideo(text, videoFromBrief),
    video_seconds: Number.isInteger(Number(media.video_seconds))
      ? Number(media.video_seconds)
      : extractSeconds(text),
    source: media.source && media.source !== 'unknown' ? media.source : extractSource(text, media.source || 'unknown'),
  };
}

function mediaQuestions(params, { hasReference = false } = {}) {
  const missing = [];
  if ((!params.source || params.source === 'unknown') && !hasReference) {
    missing.push('сколько исходников найти');
  }
  if (!params.photo_count) missing.push('сколько фото в карточку (1–10)');
  if (!params.aspect) missing.push('соотношение кадра');
  if (params.video === 'ask') missing.push('нужно ли одно видео до 60 секунд');
  if (!missing.length) return [];
  const prompt = `Напишите: ${missing.join(', ')}. Без этого не ищу и не рисую.`;
  return [{
    id: 'media.ask',
    field: 'media.ask',
    text: prompt,
    prompt,
  }];
}

function cardIdentity(brief) {
  return [brief?.title, brief?.excerpt, brief?.features, brief?.benefit]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join('. ');
}

function shotBrief(brief, index, total, aspect) {
  const identity = cardIdentity(brief) || 'карточка';
  return [
    `Кадр ${index} из ${total}.`,
    identity,
    aspect ? `Кадр ${aspect}.` : '',
    'Не менять название, признаки и геометрию из описания карточки.',
  ].filter(Boolean).join(' ');
}

function buildSlots(brief, params) {
  const slots = [];
  const count = params.photo_count || 0;
  for (let i = 1; i <= count; i += 1) {
    slots.push({
      id: `slot-${i}`,
      kind: 'image',
      status: 'planned',
      index: i,
      aspect: params.aspect || null,
      prompt: shotBrief(brief, i, count, params.aspect),
      media_id: null,
    });
  }
  if (params.video === 'yes') {
    slots.push({
      id: 'slot-video',
      kind: 'video',
      status: 'planned',
      seconds: params.video_seconds || null,
      prompt: `${cardIdentity(brief)}. Видео по описанию карточки, не додумывать поля.`,
      media_id: null,
    });
  }
  return slots;
}

function namedText(brief, text) {
  return [brief?.title, brief?.excerpt, text].filter(Boolean).join(' ');
}

function planMedia({
  brief = {},
  text = '',
  hasReference = false,
} = {}) {
  const params = parseMediaParams({ text, brief });
  const questions = mediaQuestions(params, { hasReference });
  const identity = namedText(brief, text);
  const named = looksLikeNamedEquipment(identity);
  const refPolicy = evaluateImageReferencePolicy({
    message: identity,
    kind: 'image',
    hasReference: hasReference || params.source === 'file' || params.source === 'upload',
  });
  if (named && !refPolicy.allowed) {
    questions.push(referenceQuestion(refPolicy.reason));
  }
  const ready = questions.length === 0;
  return {
    params: {
      ...params,
      source: hasReference && params.source === 'unknown' ? 'upload' : params.source,
    },
    questions,
    slots: ready ? buildSlots(brief, params) : [],
    named_equipment: named,
    need_reference: named && !refPolicy.allowed,
    recipe_8plus1: false,
    ready,
  };
}

function applyAnswers(params, answers = {}) {
  const next = { ...params };
  const count = answers['media.photo_count'] || answers.photo_count;
  if (count === 'own') next.source = 'upload';
  else if (count && /^\d+$/.test(String(count))) {
    next.photo_count = Math.min(10, Math.max(1, Number(count)));
  }
  if (answers['media.aspect'] && ASPECTS.has(answers['media.aspect'])) {
    next.aspect = answers['media.aspect'];
  }
  if (answers['media.video'] === 'none' || answers['media.video'] === 'yes') {
    next.video = answers['media.video'];
  }
  if (answers.image_source === 'attach_reference') next.source = 'upload';
  return next;
}

function fail(code, message, status = 400, extra = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  Object.assign(error, extra);
  return error;
}

async function generateSlot({
  brief,
  plan,
  slotId,
  hasReference = false,
  text = '',
}, hooks = {}) {
  const planned = plan && plan.slots ? plan : planMedia({ brief, text, hasReference });
  if (planned.need_reference) {
    throw fail('NEED_INPUT', 'Именованная техника без исходника не рисуется с нуля.', 400, {
      questions: planned.questions,
    });
  }
  if (!planned.ready) {
    throw fail('MEDIA_PARAMS_REQUIRED', 'Сначала число, кадр и видео.', 400, {
      questions: planned.questions,
    });
  }
  const slot = (planned.slots || []).find((row) => row.id === slotId);
  if (!slot) throw fail('SLOT_NOT_FOUND', 'Нет такого слота');
  if (!hooks.generate) {
    throw fail('GENERATION_DISABLED', 'Живая генерация выключена: нужен явный генератор. Платный пакет 8+1 сам не запускаю.', 409);
  }
  const model = String(hooks.model || '').trim();
  if (!model && !process.env.NODE_TEST_CONTEXT && !hooks.allowWithoutModel) {
    throw fail('MODEL_REQUIRED', 'Сначала выберите модель генерации из каталога ключа.', 400);
  }
  const generated = await hooks.generate({
    prompt: slot.prompt,
    aspect: slot.aspect,
    kind: slot.kind,
    slot_id: slot.id,
    model,
  });
  const critic = hooks.critic
    ? await hooks.critic({ slot, generated, brief })
    : { accepted: true, reason: 'no_critic' };
  if (!critic?.accepted) {
    return {
      ...planned,
      slots: planned.slots.map((row) => (
        row.id === slot.id
          ? { ...row, status: 'rejected', reason: critic.reason || 'critic_rejected' }
          : row
      )),
    };
  }
  return {
    ...planned,
    slots: planned.slots.map((row) => (
      row.id === slot.id
        ? {
          ...row,
          status: 'accepted',
          media_id: generated?.media_id || generated?.id || slot.id,
          url: generated?.url || null,
        }
        : row
    )),
  };
}

function aspectSize(aspect) {
  if (aspect === '16:9') return '1280*720';
  if (aspect === '9:16') return '720*1280';
  if (aspect === '4:3') return '1280*960';
  if (aspect === '3:4') return '960*1280';
  return '1280*1280';
}

async function liveGenerateFrame({
  prompt,
  aspect,
  kind,
  model,
  slot_id,
  ownerUserId,
  idempotencyKey,
}) {
  const router = require('./orchModelRouter');
  const media = require('./mediaAgentService');
  const role = kind === 'video' ? 'video_gen' : 'image_gen';
  const route = await router.resolveRole(role);
  if (model) route.model = model;
  const gen = kind === 'video'
    ? await media.generateVideo({ route, prompt, duration: 5 })
    : await media.generateImage({ route, prompt, size: aspectSize(aspect) });
  return {
    url: gen.url,
    media_id: null,
    model: gen.model || model,
    slot_id,
    ownerUserId,
    idempotencyKey,
    kind,
  };
}

async function liveCriticFrame({ generated, brief } = {}) {
  const url = String(generated?.url || '').trim();
  if (!url) return { accepted: false, reason: 'no_image' };
  let imageUrl = url;
  if (!url.startsWith('data:')) {
    try {
      const axios = require('axios');
      const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000,
        maxContentLength: 12 * 1024 * 1024,
      });
      const mime = String(res.headers['content-type'] || 'image/jpeg').split(';')[0].trim();
      imageUrl = `data:${mime};base64,${Buffer.from(res.data).toString('base64')}`;
    } catch {
      return { accepted: false, reason: 'image_unreadable' };
    }
  }
  const identity = [brief?.title, brief?.excerpt].filter(Boolean).join('. ').slice(0, 500);
  try {
    const router = require('./orchModelRouter');
    const res = await router.chatForRole('critic_vision', [
      {
        role: 'system',
        content: 'Проверь кадр карточки. Верни только JSON {"accepted":true|false,"reason":"..."}. accepted=false, если на кадре другой объект, чужой бренд, сломанная геометрия или водяной знак. Не выдумывай.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Карточка: ${identity || 'без названия'}` },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ], { temperature: 0, maxTokens: 120, json: true });
    const raw = res?.content ?? res?.text ?? res;
    const parsed = raw && typeof raw === 'object' ? raw : JSON.parse(String(raw || ''));
    if (typeof parsed?.accepted !== 'boolean') {
      return { accepted: false, reason: 'critic_unparsed' };
    }
    return { accepted: parsed.accepted, reason: String(parsed.reason || '').slice(0, 200) };
  } catch {
    return { accepted: false, reason: 'critic_failed' };
  }
}

function attachable(slots) {
  return (slots || []).filter((row) => row.status === 'accepted' && (row.media_id || row.url));
}

async function writeAccepted({ pageId, productId, ids, ownerUserId }) {
  const db = require('../db');
  const owner = Number(ownerUserId);
  if (pageId) {
    await db.getQuery()(
      `UPDATE content_media
       SET page_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($2::int[])
         AND ($3::int IS NULL OR owner_user_id IS NULL OR owner_user_id = $3)`,
      [pageId, ids, Number.isInteger(owner) ? owner : null]
    );
  }
  if (productId) {
    const store = require('./storeService');
    await store.setProductMedia(productId, ids);
  }
}

async function attachPendingCardMedia({
  jobId,
  pageId = null,
  productId = null,
  ownerUserId,
} = {}, hooks = {}) {
  const id = String(jobId || '').trim();
  if (!id || (!pageId && !productId)) return null;
  let job = null;
  try {
    const store = hooks.jobStore || require('./orchJobStore');
    job = await store.getJob(id);
  } catch {
    return null;
  }
  const slots = job?.plan?.media_plan?.slots;
  if (!Array.isArray(slots) || !attachable(slots).length) return null;
  try {
    return await attachMedia({
      pageId,
      productId,
      slots,
      ownerUserId: ownerUserId || job.owner_user_id,
    }, hooks);
  } catch (error) {
    if (error.code === 'NOTHING_ACCEPTED') return null;
    throw error;
  }
}

async function attachMedia({
  pageId = null,
  productId = null,
  slots = [],
  ownerUserId,
}, hooks = {}) {
  const accepted = attachable(slots);
  if (!accepted.length) {
    throw fail('NOTHING_ACCEPTED', 'Непринятое в карточку не кладу.');
  }
  if (hooks.attach) {
    return hooks.attach({ pageId, productId, slots: accepted, ownerUserId });
  }
  const ids = accepted.map((row) => Number(row.media_id)).filter((n) => n > 0);
  let written = false;
  if ((pageId || productId) && ids.length && !process.env.NODE_TEST_CONTEXT) {
    try {
      await writeAccepted({ pageId, productId, ids, ownerUserId });
      written = true;
    } catch {
      written = false;
    }
  }
  return {
    attached: ids,
    page_id: pageId || null,
    product_id: productId || null,
    published: false,
    written,
  };
}

module.exports = {
  parseMediaParams,
  mediaQuestions,
  shotBrief,
  planMedia,
  buildSlots,
  applyAnswers,
  generateSlot,
  liveGenerateFrame,
  liveCriticFrame,
  attachMedia,
  attachPendingCardMedia,
  attachable,
};
