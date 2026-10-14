/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Черновик объявления / карточки магазина. Выкладка запрещена.
 * Владелец = собеседник. Повтор ключа — снаружи, в диспетчере.
 */

const cardBrief = require('./orchCardBrief');

function fail(code, message, status = 400, extra = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function ownerOf(brief, ownerUserId) {
  const owner = Number(ownerUserId);
  if (!Number.isInteger(owner) || owner <= 0) {
    throw fail('OWNER_REQUIRED', 'Нет владельца беседы', 403);
  }
  return owner;
}

function readyBrief(raw, ownerUserId) {
  const seeded = {
    ...(raw && typeof raw === 'object' ? raw : {}),
    owner_user_id: ownerOf(raw, ownerUserId),
  };
  const report = cardBrief.validate(seeded, { intent: 'draft' });
  report.brief.status = 'draft';
  if (report.brief.kind === 'store' && report.brief.store) {
    report.brief.store.status = 'draft';
  }
  if (!report.ok) {
    throw fail('CARD_BRIEF_INCOMPLETE', 'Пустые обязательные поля — вопросы, не запись.', 400, {
      questions: report.questions,
      brief: report.brief,
    });
  }
  return report.brief;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function listingHtml(brief) {
  return ['description', 'features', 'benefit']
    .map((key) => String(brief[key] || '').trim())
    .filter(Boolean)
    .map((text) => `<p>${escapeHtml(text)}</p>`)
    .join('');
}

function slugBase(title) {
  const map = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo',
    ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
    н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
    ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  const base = String(title || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[а-яё]/g, (ch) => map[ch] || ch)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return base || `listing-${Date.now()}`;
}

async function uniqueSlug(title, hooks = {}) {
  if (hooks.uniqueSlug) return hooks.uniqueSlug(title);
  const db = require('../db');
  const base = slugBase(title);
  let slug = base;
  for (let i = 0; i < 50; i += 1) {
    const { rows } = await db.getQuery()(
      'SELECT id FROM admin_pages_simple WHERE slug = $1 LIMIT 1',
      [slug]
    );
    if (!rows.length) return slug;
    slug = `${base}-${i + 1}`;
  }
  return `${base}-${Date.now()}`;
}

async function linkAcceptedMedia({ jobId, pageId, productId, ownerUserId }, hooks = {}) {
  if (!jobId || (!pageId && !productId)) return null;
  try {
    const cardMedia = hooks.cardMedia || require('./orchCardMedia');
    return await cardMedia.attachPendingCardMedia({
      jobId,
      pageId: pageId || null,
      productId: productId || null,
      ownerUserId,
    }, hooks);
  } catch {
    return null;
  }
}

async function attachJob(jobId, patch, hooks = {}) {
  if (!jobId) return;
  if (hooks.attachJob) {
    await hooks.attachJob(jobId, patch);
    return;
  }
  try {
    const store = require('./orchJobStore');
    const job = await store.getJob(jobId);
    if (!job) return;
    job.plan = { ...(job.plan || {}), ...patch };
    job.updated_at = new Date().toISOString();
    await store.saveJob(job);
  } catch {
    /* без базы — только ответ вызова */
  }
}

async function applyCatalog(kind, entityId, brief) {
  const section = brief.catalog?.section;
  if (!section || !entityId) return;
  try {
    const catalogFilters = require('./catalogFiltersService');
    const raw = brief.catalog?.attrs;
    const attrs = Array.isArray(raw)
      ? raw
      : raw && typeof raw === 'object'
        ? Object.entries(raw).map(([key, value]) => ({ key, value }))
        : [];
    await catalogFilters.applyEntityCatalogPayload(kind, entityId, {
      catalog_section_id: section,
      catalog_attrs: attrs,
    });
  } catch (error) {
    if (!/catalog_sections|does not exist|не найден/i.test(String(error.message || ''))) throw error;
  }
}

async function createListingDraft({ brief, ownerUserId, jobId }, hooks = {}) {
  const next = readyBrief(brief, ownerUserId);
  if (next.kind !== 'listing') {
    throw fail('CARD_KIND', 'listing.create_draft только для объявления');
  }
  const payload = {
    owner_user_id: next.owner_user_id,
    title: String(next.title || '').trim(),
    summary: String(next.excerpt || '').trim(),
    content: listingHtml(next),
    status: 'draft',
    visibility: 'public',
    show_in_blog: true,
    seo: {
      title: next.seo?.title || next.title,
      description: next.seo?.description || next.excerpt,
      keywords: Array.isArray(next.seo?.keywords) ? next.seo.keywords : [],
    },
    settings: {
      compose_mode: 'listing',
      orch_source: 'card_brief',
      listing_media: { photos: [], video: null },
    },
  };
  if (hooks.createListing) {
    const created = await hooks.createListing(payload);
    const pageId = created.page_id || created.id;
    await attachJob(jobId, { listing_id: pageId, card_brief: next }, hooks);
    const mediaAttached = await linkAcceptedMedia({
      jobId,
      pageId,
      ownerUserId: payload.owner_user_id,
    }, hooks);
    return {
      tool: 'listing.create_draft',
      page_id: pageId,
      owner_user_id: payload.owner_user_id,
      status: 'draft',
      published: false,
      brief: next,
      editor_path: editorPath('listing', pageId),
      media_attached: mediaAttached,
    };
  }
  const slug = await uniqueSlug(payload.title, hooks);
  const db = require('../db');
  const { rows } = await db.getQuery()(
    `INSERT INTO admin_pages_simple (
       author_address, title, summary, content, status, visibility, show_in_blog,
       is_system_template, category, slug, format, mime_type, storage_type,
       seo, settings, owner_user_id
     ) VALUES (
       $1,$2,$3,$4,'draft','public',TRUE,
       FALSE,'listing',$5,'html','text/html','embedded',
       $6::jsonb,$7::jsonb,$8
     ) RETURNING id`,
    [
      `user:${payload.owner_user_id}`,
      payload.title,
      payload.summary,
      payload.content,
      slug,
      JSON.stringify(payload.seo),
      JSON.stringify(payload.settings),
      payload.owner_user_id,
    ]
  );
  const pageId = rows[0].id;
  await applyCatalog('page', pageId, next);
  await attachJob(jobId, { listing_id: pageId, card_brief: next }, hooks);
  const mediaAttached = await linkAcceptedMedia({
    jobId,
    pageId,
    ownerUserId: payload.owner_user_id,
  }, hooks);
  return {
    tool: 'listing.create_draft',
    page_id: pageId,
    slug,
    owner_user_id: payload.owner_user_id,
    status: 'draft',
    published: false,
    brief: next,
    editor_path: editorPath('listing', pageId),
    media_attached: mediaAttached,
  };
}

function storePayload(brief) {
  const decimalsRaw = brief.store?.pay_token_decimals;
  const decimals = Number.isInteger(Number(decimalsRaw)) ? Number(decimalsRaw) : 18;
  return {
    title: String(brief.title || '').trim(),
    summary: String(brief.excerpt || '').trim(),
    description: String(brief.description || ''),
    features: String(brief.features || ''),
    benefit_note: String(brief.benefit || ''),
    kind: brief.store?.item_kind === 'service' ? 'service' : 'product',
    price_units: String(brief.store?.price_units || ''),
    pay_token_address: brief.store?.pay_token_address,
    pay_token_decimals: decimals,
    receipt_enabled: Boolean(brief.store?.receipt_enabled),
    published: false,
    submit_for_review: false,
    moderation_status: 'draft',
    catalog_section_id: brief.catalog?.section || null,
    catalog_attrs: brief.catalog?.attrs || {},
  };
}

async function createStoreDraft({ brief, ownerUserId, jobId }, hooks = {}) {
  const next = readyBrief(brief, ownerUserId);
  if (next.kind !== 'store') {
    throw fail('CARD_KIND', 'store.create_draft только для магазина');
  }
  const payload = storePayload(next);
  if (hooks.createProduct) {
    const created = await hooks.createProduct(payload, next.owner_user_id);
    const productId = created.product_id || created.id;
    await attachJob(jobId, {
      store_product_id: productId,
      product_id: productId,
      card_brief: next,
    }, hooks);
    const mediaAttached = await linkAcceptedMedia({
      jobId,
      productId,
      ownerUserId: next.owner_user_id,
    }, hooks);
    return {
      tool: 'store.create_draft',
      product_id: productId,
      owner_user_id: next.owner_user_id,
      status: 'draft',
      published: false,
      brief: next,
      editor_path: editorPath('store', productId),
      media_attached: mediaAttached,
    };
  }
  const store = require('./storeService');
  const product = await store.createProduct(payload, next.owner_user_id, { asEditor: false });
  if (product.published || product.moderation_status === 'published') {
    throw fail('STORE_PUBLISH_FORBIDDEN', 'Обёртка магазина не выкладывает', 500);
  }
  await attachJob(jobId, {
    store_product_id: product.id,
    product_id: product.id,
    card_brief: next,
  }, hooks);
  const mediaAttached = await linkAcceptedMedia({
    jobId,
    productId: product.id,
    ownerUserId: next.owner_user_id,
  }, hooks);
  return {
    tool: 'store.create_draft',
    product_id: product.id,
    owner_user_id: next.owner_user_id,
    status: product.moderation_status || 'draft',
    published: false,
    brief: next,
    editor_path: editorPath('store', product.id),
    media_attached: mediaAttached,
  };
}

/** Пустая форма — без id. Сохранённый черновик — с id. Выкладка сюда не входит. */
function editorPath(kind, id) {
  const draftId = id == null || id === '' ? '' : String(id);
  if (kind === 'store') {
    return draftId ? `/content/store/product/${draftId}` : '/content/store/product/new';
  }
  return draftId
    ? `/content/create?edit=${encodeURIComponent(draftId)}`
    : '/content/create?visibility=public&show_in_blog=1';
}

module.exports = {
  readyBrief,
  createListingDraft,
  createStoreDraft,
  storePayload,
  editorPath,
};
