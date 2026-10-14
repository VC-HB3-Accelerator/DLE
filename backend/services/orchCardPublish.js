/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Выкладка карточки. Только отдельное согласие. Капслок не согласие.
 * published у магазина — только отсюда. Модерацию ленты не обходим.
 */

const cardBrief = require('./orchCardBrief');
const ownerGuard = require('./orchOwnerGuard');

function fail(code, message, status = 400, extra = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function readyOrAsk(brief, kind) {
  if (!brief || typeof brief !== 'object') return { ok: true, brief: null, questions: [] };
  const report = cardBrief.validate({ ...brief, kind: brief.kind || kind }, { intent: 'ready' });
  if (!report.ok) {
    throw fail('CARD_BRIEF_INCOMPLETE', 'До выкладки пустые обязательные — вопросы.', 400, {
      questions: report.questions,
      brief: report.brief,
    });
  }
  return report;
}

async function loadListing(pageId, hooks) {
  if (hooks.loadListing) return hooks.loadListing(pageId);
  const db = require('../db');
  const { rows } = await db.getQuery()(
    'SELECT id, owner_user_id, status FROM admin_pages_simple WHERE id = $1 LIMIT 1',
    [pageId]
  );
  return rows[0] || null;
}

async function loadProduct(productId, hooks) {
  if (hooks.loadProduct) return hooks.loadProduct(productId);
  const db = require('../db');
  const { rows } = await db.getQuery()(
    'SELECT id, created_by, published, moderation_status FROM store_products WHERE id = $1 LIMIT 1',
    [productId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    owner_user_id: row.created_by,
    created_by: row.created_by,
    published: row.published,
    moderation_status: row.moderation_status,
  };
}

async function publishListing({ pageId, ownerUserId, canPublishDirectly, brief }, hooks = {}) {
  const page = await loadListing(pageId, hooks);
  ownerGuard.assertOwned(
    { owner_user_id: page?.owner_user_id },
    ownerUserId,
    'Карточка не найдена'
  );
  readyOrAsk(brief, 'listing');
  const status = canPublishDirectly ? 'published' : 'pending';
  if (hooks.publishListing) {
    return hooks.publishListing({
      page_id: pageId,
      owner_user_id: ownerUserId,
      status,
      published: status === 'published',
    });
  }
  const db = require('../db');
  const { rows } = await db.getQuery()(
    `UPDATE admin_pages_simple
     SET status = $2, updated_at = NOW()
     WHERE id = $1 AND owner_user_id = $3
     RETURNING id, status, owner_user_id`,
    [pageId, status, ownerUserId]
  );
  if (!rows[0]) throw fail('NOT_FOUND', 'Карточка не найдена', 404);
  return {
    page_id: rows[0].id,
    status: rows[0].status,
    published: rows[0].status === 'published',
    owner_user_id: rows[0].owner_user_id,
  };
}

async function publishStore({ productId, ownerUserId, canPublishDirectly, brief }, hooks = {}) {
  const product = await loadProduct(productId, hooks);
  ownerGuard.assertOwned(
    { owner_user_id: product?.owner_user_id || product?.created_by },
    ownerUserId,
    'Карточка не найдена'
  );
  readyOrAsk(brief, 'store');
  const published = Boolean(canPublishDirectly);
  const status = published ? 'published' : 'pending';
  if (hooks.publishProduct) {
    return hooks.publishProduct({
      product_id: productId,
      owner_user_id: ownerUserId,
      published,
      moderation_status: status,
    });
  }
  const db = require('../db');
  const { rows } = await db.getQuery()(
    `UPDATE store_products
     SET published = $2,
         moderation_status = $3,
         submitted_at = COALESCE(submitted_at, NOW()),
         updated_at = NOW()
     WHERE id = $1 AND created_by = $4
     RETURNING id, published, moderation_status, created_by`,
    [productId, published, status, ownerUserId]
  );
  if (!rows[0]) throw fail('NOT_FOUND', 'Карточка не найдена', 404);
  return {
    product_id: rows[0].id,
    published: Boolean(rows[0].published),
    status: rows[0].moderation_status,
    owner_user_id: rows[0].created_by,
  };
}

async function publishCard({
  pageId = null,
  productId = null,
  brief = null,
  ownerUserId,
  canPublishDirectly = false,
} = {}, hooks = {}) {
  if (productId) {
    return {
      tool: 'card.publish',
      kind: 'store',
      ...await publishStore({ productId, ownerUserId, canPublishDirectly, brief }, hooks),
    };
  }
  if (pageId) {
    return {
      tool: 'card.publish',
      kind: 'listing',
      ...await publishListing({ pageId, ownerUserId, canPublishDirectly, brief }, hooks),
    };
  }
  throw fail('CARD_ID_REQUIRED', 'Какую карточку выложить?');
}

module.exports = {
  publishCard,
  publishListing,
  publishStore,
};
