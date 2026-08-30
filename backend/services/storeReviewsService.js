/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Отзывы витрины, ответы editor, события CRM (TZ_STORE_CLIENT_CABINET_REVIEWS).
 */

const db = require('../db');

function maskBuyer(addr) {
  const s = String(addr || '').trim();
  if (s.length < 12) return 'покупатель';
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function mapReview(row, replies = [], { publicAuthor = true } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    product_id: row.product_id,
    order_id: row.order_id || null,
    stars: Number(row.stars),
    body: row.body || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
    author: publicAuthor ? maskBuyer(row.buyer) : row.buyer,
    replies: replies.map((r) => ({
      id: r.id,
      body: r.body,
      created_at: r.created_at,
    })),
  };
}

async function loadRatingMap(productIds) {
  const ids = (productIds || []).filter(Boolean);
  const map = {};
  if (!ids.length) return map;
  const { rows } = await db.getQuery()(
    `SELECT product_id,
            ROUND(AVG(stars)::numeric, 1) AS rating_avg,
            COUNT(*)::int AS review_count
     FROM store_reviews
     WHERE product_id = ANY($1::uuid[])
     GROUP BY product_id`,
    [ids]
  );
  for (const row of rows) {
    map[row.product_id] = {
      rating_avg: Number(row.rating_avg),
      review_count: Number(row.review_count),
    };
  }
  return map;
}

function attachRatings(product, ratingMap) {
  if (!product) return product;
  const stats = ratingMap[product.id] || { rating_avg: null, review_count: 0 };
  return {
    ...product,
    rating_avg: stats.rating_avg,
    review_count: stats.review_count,
  };
}

async function listReviewsPublic(productId) {
  const { rows } = await db.getQuery()(
    `SELECT * FROM store_reviews WHERE product_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [productId]
  );
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const { rows: replyRows } = await db.getQuery()(
    `SELECT * FROM store_review_replies WHERE review_id = ANY($1::uuid[]) ORDER BY created_at ASC`,
    [ids]
  );
  const byReview = {};
  for (const r of replyRows) {
    if (!byReview[r.review_id]) byReview[r.review_id] = [];
    byReview[r.review_id].push(r);
  }
  return rows.map((row) => mapReview(row, byReview[row.id] || []));
}

async function getReviewForBuyer(productId, buyer) {
  const { rows } = await db.getQuery()(
    `SELECT * FROM store_reviews WHERE product_id = $1 AND lower(buyer) = lower($2) LIMIT 1`,
    [productId, buyer]
  );
  return rows[0] ? mapReview(rows[0], [], { publicAuthor: false }) : null;
}

async function assertPaidPurchase(productId, buyer) {
  const { rows } = await db.getQuery()(
    `SELECT id, user_id FROM store_orders
     WHERE product_id = $1 AND lower(buyer) = lower($2)
       AND status IN ('paid', 'fulfillment_proposed', 'fulfilled', 'refund_proposed', 'refunded')
     ORDER BY paid_at DESC NULLS LAST, created_at DESC
     LIMIT 1`,
    [productId, buyer]
  );
  if (!rows[0]) {
    const err = new Error('Отзыв можно оставить после оплаты');
    err.status = 403;
    err.code = 'REVIEW_REQUIRES_PAID';
    throw err;
  }
  return rows[0];
}

async function upsertReview({ productId, buyer, userId, stars, body }) {
  const star = Number(stars);
  if (!Number.isInteger(star) || star < 1 || star > 5) {
    const err = new Error('Оценка — целое от 1 до 5');
    err.status = 400;
    throw err;
  }
  const text = String(body || '').trim().slice(0, 2000);
  if (!text) {
    const err = new Error('Напишите текст отзыва');
    err.status = 400;
    throw err;
  }
  const order = await assertPaidPurchase(productId, buyer);
  const { rows } = await db.getQuery()(
    `INSERT INTO store_reviews (product_id, order_id, buyer, user_id, stars, body)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (product_id, buyer) DO UPDATE SET
       stars = EXCLUDED.stars,
       body = EXCLUDED.body,
       order_id = COALESCE(EXCLUDED.order_id, store_reviews.order_id),
       user_id = COALESCE(EXCLUDED.user_id, store_reviews.user_id),
       updated_at = NOW()
     RETURNING *`,
    [productId, order.id, buyer, userId || order.user_id || null, star, text]
  );
  const review = rows[0];
  await insertActivity({
    kind: 'review',
    contactId: review.user_id || userId || null,
    buyer,
    productId,
    orderId: order.id,
    reviewId: review.id,
    payload: { stars: star },
  });
  return mapReview(review, [], { publicAuthor: false });
}

async function addReply({ reviewId, authorUserId, body }) {
  const text = String(body || '').trim().slice(0, 2000);
  if (!text) {
    const err = new Error('Текст ответа пуст');
    err.status = 400;
    throw err;
  }
  const { rows: found } = await db.getQuery()(
    `SELECT id FROM store_reviews WHERE id = $1`,
    [reviewId]
  );
  if (!found[0]) {
    const err = new Error('Отзыв не найден');
    err.status = 404;
    throw err;
  }
  const { rows } = await db.getQuery()(
    `INSERT INTO store_review_replies (review_id, author_user_id, body)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [reviewId, String(authorUserId), text]
  );
  return rows[0];
}

async function insertActivity({
  kind,
  contactId = null,
  buyer = null,
  productId = null,
  orderId = null,
  reviewId = null,
  payload = {},
}) {
  await db.getQuery()(
    `INSERT INTO store_activity_events
       (kind, contact_id, buyer, product_id, order_id, review_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      kind,
      contactId != null ? String(contactId) : null,
      buyer,
      productId || null,
      orderId || null,
      reviewId || null,
      JSON.stringify(payload || {}),
    ]
  );
}

async function recordPaidActivity({ userId, buyer, checkoutId, orderId, productId }) {
  if (checkoutId) {
    const { rows } = await db.getQuery()(
      `SELECT id FROM store_activity_events
       WHERE kind = 'paid' AND payload->>'checkout_id' = $1
       LIMIT 1`,
      [String(checkoutId)]
    );
    if (rows[0]) return;
  } else if (orderId) {
    const { rows } = await db.getQuery()(
      `SELECT id FROM store_activity_events WHERE kind = 'paid' AND order_id = $1 LIMIT 1`,
      [orderId]
    );
    if (rows[0]) return;
  }
  await insertActivity({
    kind: 'paid',
    contactId: userId || null,
    buyer,
    productId: productId || null,
    orderId: orderId || null,
    payload: checkoutId ? { checkout_id: checkoutId } : {},
  });
}

async function recordStoreAsk({ userId, buyer, productIds = [] }) {
  await insertActivity({
    kind: 'store_ask',
    contactId: userId || null,
    buyer,
    productId: productIds[0] || null,
    payload: { product_ids: productIds },
  });
}

async function listActivity({ limit = 80 } = {}) {
  const { rows } = await db.getQuery()(
    `SELECT * FROM store_activity_events ORDER BY created_at DESC LIMIT $1`,
    [Math.min(200, Math.max(1, Number(limit) || 80))]
  );
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    contact_id: row.contact_id,
    buyer: row.buyer,
    product_id: row.product_id,
    order_id: row.order_id,
    review_id: row.review_id,
    payload: row.payload || {},
    created_at: row.created_at,
  }));
}

async function listOrdersForContactUserId(userId) {
  const { rows } = await db.getQuery()(
    `SELECT * FROM store_orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [String(userId)]
  );
  return rows;
}

module.exports = {
  maskBuyer,
  mapReview,
  loadRatingMap,
  attachRatings,
  listReviewsPublic,
  getReviewForBuyer,
  upsertReview,
  addReply,
  insertActivity,
  recordPaidActivity,
  recordStoreAsk,
  listActivity,
  listOrdersForContactUserId,
};
