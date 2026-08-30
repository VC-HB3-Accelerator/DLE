/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, getUserRole } = require('../middleware/permissions');
const { PERMISSIONS, hasPermission } = require('../shared/permissions');
const store = require('../services/storeService');
const storeV2 = require('../services/storeSectionsCheckout');
const storeReviews = require('../services/storeReviewsService');

function sendError(res, error) {
  const status = error.status || 500;
  if (status >= 500) logger.error('[store]', error);
  res.status(status).json({
    success: false,
    error: error.message || 'Store error',
    code: error.code || null,
  });
}

function sessionWallet(req) {
  const authType = String(req.session?.authType || '').toLowerCase();
  const address = req.session?.address || null;
  return { authType, address };
}

function actorId(req) {
  return String(req.session?.userId || req.session?.address || '');
}

async function canViewCrm(req) {
  const role = await getUserRole(req);
  return hasPermission(role, PERMISSIONS.VIEW_CRM) || hasPermission(role, PERMISSIONS.MANAGE_LEGAL_DOCS);
}

router.get('/settings', requireAuth, requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS), async (req, res) => {
  try {
    const settings = await store.getSettings();
    res.json(settings);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/settings', requireAuth, requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS), async (req, res) => {
  try {
    const settings = await store.saveSettings({
      ...req.body,
      updatedBy: actorId(req),
    });
    res.json(settings);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/treasury-tokens', requireAuth, requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS), async (req, res) => {
  try {
    const tokens = await store.listTreasuryTokens({
      treasury_address: req.query.treasury_address || req.query.treasury || undefined,
      chain_id: req.query.chain_id || req.query.chainId || undefined,
    });
    res.json({ tokens });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/discover-book', requireAuth, requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS), async (req, res) => {
  try {
    const data = await store.discoverBook(req.body?.primary_dle_address || req.body?.dleAddress);
    res.json(data);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/resolve-token', requireAuth, requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS), async (req, res) => {
  try {
    const token = await store.resolveToken(req.body?.address || req.body?.tokenAddress, {
      standard: req.body?.standard || req.body?.receipt_standard || 'erc20',
      erc1155TokenId: req.body?.receipt_erc1155_token_id || req.body?.erc1155TokenId,
    });
    res.json({ token });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/catalog', async (req, res) => {
  try {
    const products = await store.listProducts({
      publishedOnly: true,
      sectionId: req.query.section_id || null,
      sectionSlug: req.query.section || req.query.slug || null,
    });
    res.json({ products });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/catalog/:id', async (req, res) => {
  try {
    const product = await store.getProduct(req.params.id, { publishedOnly: true });
    res.json({ product });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/products/:id/reviews', async (req, res) => {
  try {
    const reviews = await storeReviews.listReviewsPublic(req.params.id);
    res.json({ reviews });
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/products/:id/review', requireAuth, async (req, res) => {
  try {
    const { authType, address } = sessionWallet(req);
    if (authType !== 'wallet' || !address) {
      const err = new Error('Нужна SIWE-сессия кошелька');
      err.status = 403;
      err.code = 'WALLET_AUTH_REQUIRED';
      throw err;
    }
    const review = await storeReviews.upsertReview({
      productId: req.params.id,
      buyer: store.normalizeAddress(address),
      userId: req.session?.userId != null ? String(req.session.userId) : null,
      stars: req.body?.stars,
      body: req.body?.body,
    });
    res.json({ review });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/reviews/:id/reply', requireAuth, requirePermission(PERMISSIONS.VIEW_CRM), async (req, res) => {
  try {
    const reply = await storeReviews.addReply({
      reviewId: req.params.id,
      authorUserId: actorId(req),
      body: req.body?.body,
    });
    res.status(201).json({ reply });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/activity', requireAuth, requirePermission(PERMISSIONS.VIEW_CRM), async (req, res) => {
  try {
    const events = await storeReviews.listActivity({ limit: req.query.limit });
    res.json({ events });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/cabinet/ask', requireAuth, async (req, res) => {
  try {
    const { authType, address } = sessionWallet(req);
    if (authType !== 'wallet' || !address) {
      const err = new Error('Нужна SIWE-сессия кошелька');
      err.status = 403;
      throw err;
    }
    const ids = Array.isArray(req.body?.productIds || req.body?.product_ids)
      ? (req.body.productIds || req.body.product_ids)
      : [];
    if (!ids.length) {
      const err = new Error('Отметьте хотя бы одну карточку');
      err.status = 400;
      throw err;
    }
    const sessionId = req.session?.userId != null ? String(req.session.userId) : null;
    const crm = await canViewCrm(req);
    const requested = req.body?.contactId != null ? String(req.body.contactId) : '';
    let contactId = sessionId;
    if (crm && requested && !requested.startsWith('guest_')) {
      contactId = requested;
    }
    await storeReviews.recordStoreAsk({
      userId: contactId,
      buyer: store.normalizeAddress(address),
      productIds: ids.map(String),
    });
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/orders/contact/:userId', requireAuth, async (req, res) => {
  try {
    const target = String(req.params.userId || '');
    const selfId = req.session?.userId != null ? String(req.session.userId) : '';
    const crm = await canViewCrm(req);
    if (!crm && selfId !== target) {
      const err = new Error('Нет доступа к заказам');
      err.status = 403;
      throw err;
    }
    const { authType, address } = sessionWallet(req);
    if (!crm) {
      if (authType !== 'wallet' || !address) {
        const err = new Error('Нужна SIWE-сессия кошелька');
        err.status = 403;
        throw err;
      }
    }
    const orders = crm && selfId !== target
      ? await store.listOrdersForUserId(target)
      : await store.listOrdersMine(address);
    res.json({ orders });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/products', requireAuth, requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS), async (req, res) => {
  try {
    const products = await store.listProducts({ publishedOnly: false });
    res.json({ products });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/products/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS), async (req, res) => {
  try {
    const product = await store.getProduct(req.params.id);
    res.json({ product });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/products', requireAuth, requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS), async (req, res) => {
  try {
    const product = await store.createProduct(req.body || {}, actorId(req));
    res.status(201).json({ product });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/products/import', requireAuth, requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS), async (req, res) => {
  try {
    const result = await store.importProducts(req.body?.rows || req.body?.products || [], actorId(req));
    res.json(result);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/products/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS), async (req, res) => {
  try {
    const product = await store.updateProduct(req.params.id, req.body || {});
    res.json({ product });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/orders/mine', requireAuth, async (req, res) => {
  try {
    const { authType, address } = sessionWallet(req);
    if (authType !== 'wallet' || !address) {
      const err = new Error('Нужна SIWE-сессия кошелька');
      err.status = 403;
      err.code = 'WALLET_AUTH_REQUIRED';
      throw err;
    }
    const orders = await store.listOrdersMine(address);
    res.json({ orders });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/orders', requireAuth, requirePermission(PERMISSIONS.VIEW_CRM), async (req, res) => {
  try {
    const orders = await store.listOrdersCrm({
      status: req.query.status || '',
      q: req.query.q || req.query.search || '',
    });
    res.json({ orders });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/orders', requireAuth, async (req, res) => {
  try {
    const { authType, address } = sessionWallet(req);
    if (authType !== 'wallet' || !address) {
      const err = new Error('Оплата только через SIWE wallet');
      err.status = 403;
      err.code = 'WALLET_AUTH_REQUIRED';
      throw err;
    }
    const buyer = store.normalizeAddress(req.body?.buyer || address);
    if (buyer.toLowerCase() !== String(address).toLowerCase()) {
      const err = new Error('Кошелёк в заявке должен совпадать с сессией');
      err.status = 403;
      err.code = 'BUYER_MISMATCH';
      throw err;
    }
    const order = await store.createOrder({
      productId: req.body?.productId || req.body?.product_id,
      buyerAddress: buyer,
      userId: req.session?.userId != null ? String(req.session.userId) : null,
      qty: req.body?.qty || 1,
    });
    res.status(201).json({ order });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/orders/:id', requireAuth, async (req, res) => {
  try {
    const order = await store.getOrder(req.params.id);
    const { authType, address } = sessionWallet(req);
    const isOwner = authType === 'wallet' && address
      && String(order.buyer).toLowerCase() === String(address).toLowerCase();
    if (!isOwner && !(await canViewCrm(req))) {
      const err = new Error('Нет доступа к заказу');
      err.status = 403;
      throw err;
    }
    res.json({ order });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/orders/:id/check-payment', requireAuth, async (req, res) => {
  try {
    const order = await store.getOrder(req.params.id);
    const { authType, address } = sessionWallet(req);
    const isOwner = authType === 'wallet' && address
      && String(order.buyer).toLowerCase() === String(address).toLowerCase();
    if (!isOwner && !(await canViewCrm(req))) {
      const err = new Error('Нет доступа');
      err.status = 403;
      throw err;
    }
    const updated = await store.checkOrderPayment(req.params.id, {
      txHashHint: req.body?.txHash || req.body?.tx_hash || null,
    });
    res.json({ order: updated });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/orders/:id/cancel', requireAuth, async (req, res) => {
  try {
    const { authType, address } = sessionWallet(req);
    const role = await getUserRole(req);
    const force = hasPermission(role, PERMISSIONS.VIEW_CRM)
      || hasPermission(role, PERMISSIONS.MANAGE_LEGAL_DOCS);
    const order = await store.cancelOrder(req.params.id, {
      buyer: authType === 'wallet' ? address : null,
      force,
    });
    res.json({ order });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/orders/:id/mark-fulfilled', requireAuth, requirePermission(PERMISSIONS.VIEW_CRM), async (req, res) => {
  try {
    const order = await store.markOrderFulfilled(req.params.id);
    res.json({ order });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/orders/:id/mark-refunded', requireAuth, requirePermission(PERMISSIONS.VIEW_CRM), async (req, res) => {
  try {
    const order = await store.markOrderRefunded(req.params.id);
    res.json({ order });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/orders/:id/prepare-fulfillment', requireAuth, requirePermission(PERMISSIONS.VIEW_CRM), async (req, res) => {
  try {
    const data = await store.prepareFulfillment(req.params.id, {
      tokenIds: req.body?.tokenIds || req.body?.token_ids,
      erc1155TokenId: req.body?.erc1155TokenId || req.body?.receipt_erc1155_token_id,
    });
    res.json(data);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/settings/pull-treasury', requireAuth, requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS), async (req, res) => {
  try {
    const data = await store.pullTreasuryFromModule();
    res.json(data);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/orders/:id/prepare-refund', requireAuth, requirePermission(PERMISSIONS.VIEW_CRM), async (req, res) => {
  try {
    const data = await store.prepareRefund(req.params.id);
    res.json(data);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/orders/:id/link-fulfillment-proposal', requireAuth, requirePermission(PERMISSIONS.VIEW_CRM), async (req, res) => {
  try {
    const order = await store.markFulfillmentProposed(req.params.id, req.body?.proposalId);
    res.json({ order });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/orders/:id/link-refund-proposal', requireAuth, requirePermission(PERMISSIONS.VIEW_CRM), async (req, res) => {
  try {
    const order = await store.markRefundProposed(req.params.id, req.body?.proposalId);
    res.json({ order });
  } catch (error) {
    sendError(res, error);
  }
});

// --- V2: sections ---
router.get('/sections', async (req, res) => {
  try {
    const activeOnly = String(req.query.active || '') === '1' || String(req.query.published || '') === '1';
    const sections = await storeV2.listSections({ activeOnly });
    res.json({ sections });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/sections/by-slug/:slug', async (req, res) => {
  try {
    const section = await storeV2.getSectionBySlug(req.params.slug);
    res.json({ section });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/sections', requireAuth, requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS), async (req, res) => {
  try {
    const section = await storeV2.createSection(req.body || {});
    res.status(201).json({ section });
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/sections/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS), async (req, res) => {
  try {
    const section = await storeV2.updateSection(req.params.id, req.body || {});
    res.json({ section });
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/sections/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_LEGAL_DOCS), async (req, res) => {
  try {
    await storeV2.deleteSection(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
});

// --- V2: checkout / cart ---
router.post('/checkouts', requireAuth, async (req, res) => {
  try {
    const { authType, address } = sessionWallet(req);
    if (authType !== 'wallet' || !address) {
      const err = new Error('Нужна SIWE-сессия кошелька');
      err.status = 403;
      err.code = 'WALLET_AUTH_REQUIRED';
      throw err;
    }
    const checkout = await storeV2.createCheckout({
      items: req.body?.items || [],
      buyerAddress: address,
      userId: actorId(req),
    });
    res.status(201).json({ checkout });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/checkouts/:id', requireAuth, async (req, res) => {
  try {
    const checkout = await storeV2.getCheckout(req.params.id);
    const { authType, address } = sessionWallet(req);
    const crm = await canViewCrm(req);
    if (!crm && (!address || String(checkout.buyer).toLowerCase() !== String(address).toLowerCase())) {
      const err = new Error('Нет доступа');
      err.status = 403;
      throw err;
    }
    res.json({ checkout });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/checkouts', requireAuth, requirePermission(PERMISSIONS.VIEW_CRM), async (req, res) => {
  try {
    const checkouts = await storeV2.listCheckoutsCrm();
    res.json({ checkouts });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/checkouts/:id/check-payment', requireAuth, async (req, res) => {
  try {
    const checkout = await storeV2.checkCheckoutPayment(req.params.id, {
      txHashHint: req.body?.txHash || req.body?.tx_hash || null,
    });
    res.json({ checkout });
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;
