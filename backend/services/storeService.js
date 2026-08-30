/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Интернет-магазин: каталог, заказы, матчинг оплаты (buyer + сумма прайса),
 * prefill «Перевести средства» (TZ_STORE_PRODUCT_CARDS_TREASURY).
 */

const { ethers } = require('ethers');
const db = require('../db');
const logger = require('../utils/logger');
const rpcProviderService = require('./rpcProviderService');
const {
  TRANSFER_TOPIC,
  transferToTopic,
  parseTransferLog,
  fromUnits,
} = require('./voiceCallAmount');

const { getPool } = db;
const storeReviews = require('./storeReviewsService');

/** Без voice-call хвостов: amount_unique = sticker, tail = 0 */
const PAY_TAIL_UNITS = '0';

const SLOT_STATUSES = ['paid', 'fulfillment_proposed', 'fulfilled', 'refund_proposed'];
const TREASURY_REFRESH_ABI = ['function refreshBalance(address tokenAddress) external'];
const TREASURY_READ_ABI = [
  'function getAllTokens() view returns (address[])',
  'function getTokenInfo(address tokenAddress) view returns (tuple(address tokenAddress, string symbol, uint8 decimals, bool isActive, bool isNative, uint256 addedTimestamp, uint256 balance))',
  'function getTokenBalance(address tokenAddress) view returns (uint256)',
  'function getRealTokenBalance(address tokenAddress) view returns (uint256)',
];
const ERC20_META_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
];

function normalizeAddress(value) {
  try {
    return ethers.getAddress(String(value || '').trim());
  } catch {
    const err = new Error('Некорректный адрес');
    err.status = 400;
    err.code = 'INVALID_ADDRESS';
    throw err;
  }
}

function isNativeTokenAddress(value) {
  if (value == null || String(value).trim() === '') return true;
  try {
    return ethers.getAddress(String(value).trim()) === ethers.ZeroAddress;
  } catch {
    return false;
  }
}

function assertPayTokenErc20(address) {
  if (isNativeTokenAddress(address)) {
    const err = new Error(
      'Токен оплаты должен быть ERC-20 (не нативная монета 0x0). Выберите токен из казны в карточке товара.'
    );
    err.status = 400;
    err.code = 'PAY_TOKEN_MUST_BE_ERC20';
    throw err;
  }
}

function unitsToString(value) {
  if (value == null) return '0';
  if (typeof value === 'bigint') return value.toString();
  return String(value);
}

function mapMediaRows(rows) {
  return (rows || []).map((r) => ({
    id: Number(r.content_media_id || r.id),
    sort_order: Number(r.sort_order || 0),
    url: r.url || null,
    file_name: r.file_name || null,
    media_type: r.media_type || null,
  }));
}

function mapProduct(row, mediaRows = [], sectionIds = null) {
  if (!row) return null;
  let attributes = [];
  try {
    const raw = row.attributes;
    if (Array.isArray(raw)) attributes = raw;
    else if (typeof raw === 'string') attributes = JSON.parse(raw || '[]');
  } catch (_) {
    attributes = [];
  }
  const receiptEnabled = row.receipt_enabled != null
    ? Boolean(row.receipt_enabled)
    : Boolean(row.license_token_address);
  return {
    id: row.id,
    title: row.title,
    summary: row.summary || '',
    description: row.description || '',
    features: row.features || '',
    benefit_note: row.benefit_note || '',
    attributes: Array.isArray(attributes) ? attributes : [],
    kind: row.kind,
    published: Boolean(row.published),
    sort_order: Number(row.sort_order || 0),
    pay_token_address: row.pay_token_address,
    pay_token_decimals: Number(row.pay_token_decimals),
    pay_token_symbol: row.pay_token_symbol || '',
    price_units: unitsToString(row.price_units),
    receipt_enabled: receiptEnabled,
    receipt_standard: row.receipt_standard || (receiptEnabled ? 'erc20' : null),
    receipt_erc1155_token_id: row.receipt_erc1155_token_id != null
      ? unitsToString(row.receipt_erc1155_token_id)
      : null,
    // legacy aliases (UI/CRM still may use license_*)
    license_token_address: row.license_token_address || null,
    license_token_decimals: row.license_token_decimals != null ? Number(row.license_token_decimals) : null,
    license_token_symbol: row.license_token_symbol || '',
    license_amount_units: row.license_amount_units != null ? unitsToString(row.license_amount_units) : null,
    max_qty: Number(row.max_qty || 1),
    max_payments_per_wallet: Number(row.max_payments_per_wallet || 1),
    origin: row.origin || 'local',
    export_slug: row.export_slug || null,
    content_hash: row.content_hash || null,
    chain_card_id: row.chain_card_id || null,
    section_ids: Array.isArray(sectionIds) ? sectionIds : (row.section_ids || []),
    media_ids: mapMediaRows(mediaRows).map((m) => m.id),
    media: mapMediaRows(mediaRows),
    created_by: row.created_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapProductPublic(row, mediaRows = [], sectionIds = null) {
  const full = mapProduct(row, mediaRows, sectionIds);
  if (!full) return null;
  return {
    id: full.id,
    title: full.title,
    summary: full.summary,
    description: full.description,
    features: full.features,
    benefit_note: full.benefit_note,
    attributes: full.attributes,
    kind: full.kind,
    pay_token_address: full.pay_token_address,
    pay_token_symbol: full.pay_token_symbol,
    pay_token_decimals: full.pay_token_decimals,
    price_units: full.price_units,
    receipt_enabled: full.receipt_enabled,
    receipt_standard: full.receipt_standard,
    license_token_address: full.license_token_address,
    license_token_symbol: full.license_token_symbol,
    license_token_decimals: full.license_token_decimals,
    license_amount_units: full.license_amount_units,
    max_qty: full.max_qty,
    section_ids: full.section_ids,
    media_ids: full.media_ids,
    media: full.media,
    rating_avg: full.rating_avg ?? null,
    review_count: full.review_count ?? 0,
  };
}

function normalizeAttributes(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item) => ({
      label: String(item?.label || '').trim().slice(0, 120),
      value: String(item?.value || '').trim().slice(0, 500),
    }))
    .filter((item) => item.label || item.value)
    .slice(0, 40);
}

function mapOrder(row, extra = {}) {
  if (!row) return null;
  const hasReceipt = Boolean(row.license_token_address);
  const licDec = row.license_token_decimals != null ? Number(row.license_token_decimals) : 0;
  return {
    id: row.id,
    product_id: row.product_id,
    checkout_id: row.checkout_id || null,
    buyer: row.buyer,
    user_id: row.user_id || null,
    status: row.status,
    product_title: row.product_title || '',
    qty: Number(row.qty || 1),
    price_units: unitsToString(row.price_units),
    pay_token_address: row.pay_token_address,
    pay_token_decimals: Number(row.pay_token_decimals),
    pay_token_symbol: row.pay_token_symbol || '',
    receipt_enabled: hasReceipt,
    receipt_standard: row.receipt_standard || (hasReceipt ? 'erc20' : null),
    receipt_erc1155_token_id: row.receipt_erc1155_token_id != null
      ? unitsToString(row.receipt_erc1155_token_id)
      : null,
    license_token_address: row.license_token_address || null,
    license_token_decimals: hasReceipt ? licDec : null,
    license_token_symbol: row.license_token_symbol || '',
    license_amount_units: hasReceipt ? unitsToString(row.license_amount_units) : null,
    treasury_address: row.treasury_address,
    chain_id: Number(row.chain_id),
    sticker_units: unitsToString(row.sticker_units),
    amount_unique_units: unitsToString(row.amount_unique_units),
    amount_unique_human: fromUnits(row.amount_unique_units, row.pay_token_decimals),
    license_amount_human: hasReceipt ? fromUnits(row.license_amount_units, licDec) : null,
    tail_units: unitsToString(row.tail_units),
    tx_hash: row.tx_hash || null,
    tx_log_index: row.tx_log_index != null ? Number(row.tx_log_index) : null,
    paid_at: row.paid_at || null,
    expires_at: row.expires_at || null,
    fulfillment_proposal_id: row.fulfillment_proposal_id || null,
    fulfillment_calldata_proposal_ref: row.fulfillment_calldata_proposal_ref || null,
    refund_proposal_id: row.refund_proposal_id || null,
    refund_calldata_proposal_ref: row.refund_calldata_proposal_ref || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...extra,
  };
}

function orderProposalRef(orderId) {
  return ethers.keccak256(ethers.toUtf8Bytes(`store${orderId}`));
}

async function getSettings() {
  const { rows } = await db.getQuery()(`SELECT * FROM store_settings WHERE id = 1`);
  const row = rows[0] || {};
  return {
    primary_dle_address: row.primary_dle_address || null,
    primary_chain_id: row.primary_chain_id != null ? Number(row.primary_chain_id) : null,
    treasury_address: row.treasury_address || null,
    order_ttl_minutes: Number(row.order_ttl_minutes || 60),
    updated_at: row.updated_at || null,
    updated_by: row.updated_by || null,
  };
}

async function saveSettings(payload = {}) {
  const primary_dle_address = payload.primary_dle_address
    ? normalizeAddress(payload.primary_dle_address)
    : null;
  const treasury_address = payload.treasury_address
    ? normalizeAddress(payload.treasury_address)
    : null;
  const primary_chain_id = payload.primary_chain_id != null && payload.primary_chain_id !== ''
    ? Number(payload.primary_chain_id)
    : null;
  const order_ttl_minutes = Math.min(1440, Math.max(5, Number(payload.order_ttl_minutes || 60)));
  const updatedBy = payload.updatedBy ? String(payload.updatedBy) : null;

  await db.getQuery()(
    `INSERT INTO store_settings (id, primary_dle_address, primary_chain_id, treasury_address, order_ttl_minutes, updated_at, updated_by)
     VALUES (1, $1, $2, $3, $4, NOW(), $5)
     ON CONFLICT (id) DO UPDATE SET
       primary_dle_address = EXCLUDED.primary_dle_address,
       primary_chain_id = EXCLUDED.primary_chain_id,
       treasury_address = EXCLUDED.treasury_address,
       order_ttl_minutes = EXCLUDED.order_ttl_minutes,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [primary_dle_address, primary_chain_id, treasury_address, order_ttl_minutes, updatedBy]
  );
  return getSettings();
}

async function loadProductMedia(productId) {
  const { rows } = await db.getQuery()(
    `SELECT
       spm.content_media_id,
       spm.sort_order,
       cm.file_name,
       cm.media_type,
       cm.public_id,
       CASE
         WHEN cm.public_id IS NOT NULL AND cm.public_id <> '' THEN '/v/' || cm.public_id
         ELSE '/api/uploads/media/' || cm.id::text || '/file'
       END AS url
     FROM store_product_media spm
     LEFT JOIN content_media cm ON cm.id = spm.content_media_id
     WHERE spm.product_id = $1
     ORDER BY spm.sort_order ASC, spm.id ASC`,
    [productId]
  );
  return rows;
}

async function setProductMedia(productId, mediaIds = []) {
  const ids = (Array.isArray(mediaIds) ? mediaIds : [])
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0);
  await db.getQuery()(`DELETE FROM store_product_media WHERE product_id = $1`, [productId]);
  for (let i = 0; i < ids.length; i += 1) {
    await db.getQuery()(
      `INSERT INTO store_product_media (product_id, content_media_id, sort_order)
       VALUES ($1, $2, $3)
       ON CONFLICT (product_id, content_media_id) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
      [productId, ids[i], i]
    );
  }
  return ids;
}

async function loadProductSectionIds(productId) {
  try {
    const { rows } = await db.getQuery()(
      `SELECT section_id FROM store_product_sections WHERE product_id = $1`,
      [productId]
    );
    return rows.map((r) => r.section_id);
  } catch (e) {
    if (/store_product_sections|does not exist/i.test(String(e.message || ''))) return [];
    throw e;
  }
}

async function setProductSections(productId, sectionIds = []) {
  const ids = Array.isArray(sectionIds) ? [...new Set(sectionIds.map(String).filter(Boolean))] : [];
  try {
    await db.getQuery()(`DELETE FROM store_product_sections WHERE product_id = $1`, [productId]);
    for (const sid of ids) {
      await db.getQuery()(
        `INSERT INTO store_product_sections (product_id, section_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [productId, sid]
      );
    }
  } catch (e) {
    if (/store_product_sections|does not exist/i.test(String(e.message || ''))) return [];
    throw e;
  }
  return ids;
}

async function assertReceiptTokenOk(data) {
  const inspected = await resolveToken(data.license_token_address, {
    standard: data.receipt_standard,
    erc1155TokenId: data.receipt_erc1155_token_id,
  });
  if (!inspected.in_treasury && data.receipt_standard === 'erc20') {
    const err = new Error('Токен-чек должен быть добавлен в казну (active)');
    err.status = 400;
    err.code = 'RECEIPT_NOT_IN_TREASURY';
    throw err;
  }
  const bal = BigInt(inspected.treasury_balance_units || '0');
  if (bal <= 0n) {
    const err = new Error('На адресе казны нулевой баланс токен-чека — нельзя привязать');
    err.status = 400;
    err.code = 'RECEIPT_TREASURY_EMPTY';
    throw err;
  }
  return inspected;
}

async function listProducts({ publishedOnly = false, sectionId = null, sectionSlug = null } = {}) {
  let sectionFilterId = sectionId;
  if (!sectionFilterId && sectionSlug) {
    try {
      const { rows: secRows } = await db.getQuery()(
        `SELECT id FROM store_sections WHERE slug = $1 AND active = TRUE LIMIT 1`,
        [String(sectionSlug)]
      );
      if (!secRows[0]) return [];
      sectionFilterId = secRows[0].id;
    } catch (e) {
      if (/store_sections|does not exist/i.test(String(e.message || ''))) return [];
      throw e;
    }
  }

  let sql;
  let params = [];
  if (sectionFilterId) {
    sql = publishedOnly
      ? `SELECT p.* FROM store_products p
         INNER JOIN store_product_sections ps ON ps.product_id = p.id AND ps.section_id = $1
         WHERE p.published = TRUE
         ORDER BY p.sort_order ASC, p.created_at DESC`
      : `SELECT p.* FROM store_products p
         INNER JOIN store_product_sections ps ON ps.product_id = p.id AND ps.section_id = $1
         ORDER BY p.sort_order ASC, p.created_at DESC`;
    params = [sectionFilterId];
  } else {
    sql = publishedOnly
      ? `SELECT * FROM store_products WHERE published = TRUE ORDER BY sort_order ASC, created_at DESC`
      : `SELECT * FROM store_products ORDER BY sort_order ASC, created_at DESC`;
  }

  const { rows } = await db.getQuery()(sql, params);
  const ratingMap = await storeReviews.loadRatingMap(rows.map((r) => r.id));
  const out = [];
  for (const row of rows) {
    const media = await loadProductMedia(row.id);
    const section_ids = await loadProductSectionIds(row.id);
    const mapped = publishedOnly
      ? mapProductPublic(row, media, section_ids)
      : mapProduct(row, media, section_ids);
    out.push(storeReviews.attachRatings(mapped, ratingMap));
  }
  return out;
}

async function getProduct(id, { publishedOnly = false } = {}) {
  const { rows } = await db.getQuery()(`SELECT * FROM store_products WHERE id = $1`, [id]);
  const row = rows[0];
  if (!row || (publishedOnly && !row.published)) {
    const err = new Error('Товар не найден');
    err.status = 404;
    err.code = 'PRODUCT_NOT_FOUND';
    throw err;
  }
  const media = await loadProductMedia(row.id);
  const section_ids = await loadProductSectionIds(row.id);
  const mapped = publishedOnly
    ? mapProductPublic(row, media, section_ids)
    : mapProduct(row, media, section_ids);
  const ratingMap = await storeReviews.loadRatingMap([row.id]);
  return storeReviews.attachRatings(mapped, ratingMap);
}

function validateProductPayload(payload) {
  const title = String(payload.title || '').trim();
  if (!title) {
    const err = new Error('Укажите название');
    err.status = 400;
    err.code = 'TITLE_REQUIRED';
    throw err;
  }
  const kind = payload.kind === 'service' ? 'service' : 'product';
  const pay_token_address = normalizeAddress(payload.pay_token_address);
  assertPayTokenErc20(pay_token_address);
  const pay_token_decimals = Number(payload.pay_token_decimals);
  if (!Number.isInteger(pay_token_decimals) || pay_token_decimals < 0 || pay_token_decimals > 18) {
    const err = new Error('Некорректные decimals pay-токена');
    err.status = 400;
    throw err;
  }
  const price_units = BigInt(String(payload.price_units || '0'));
  if (price_units <= 0n) {
    const err = new Error('Цена должна быть > 0');
    err.status = 400;
    throw err;
  }

  const receipt_enabled = Boolean(
    payload.receipt_enabled
      ?? payload.license_enabled
      ?? (payload.license_token_address && String(payload.license_token_address).trim())
  );

  let license_token_address = null;
  // колонка NOT NULL: без токен-чека пишем 0 (чек выключен — C2)
  let license_token_decimals = 0;
  let license_token_symbol = '';
  let license_amount_units = null;
  let receipt_standard = null;
  let receipt_erc1155_token_id = null;

  if (receipt_enabled) {
    license_token_address = normalizeAddress(
      payload.license_token_address || payload.receipt_token_address
    );
    receipt_standard = String(payload.receipt_standard || 'erc20').toLowerCase();
    if (!['erc20', 'erc721', 'erc1155'].includes(receipt_standard)) {
      const err = new Error('receipt_standard: erc20 | erc721 | erc1155');
      err.status = 400;
      throw err;
    }
    if (receipt_standard === 'erc20') {
      license_token_decimals = Number(
        payload.license_token_decimals ?? payload.receipt_token_decimals ?? 18
      );
      if (!Number.isInteger(license_token_decimals) || license_token_decimals < 0 || license_token_decimals > 18) {
        const err = new Error('Некорректные decimals токен-чека');
        err.status = 400;
        throw err;
      }
      // 1 шт. = 1 токен (целая единица)
      const oneToken = 10n ** BigInt(license_token_decimals);
      const rawAmt = payload.license_amount_units != null && String(payload.license_amount_units) !== ''
        ? BigInt(String(payload.license_amount_units))
        : oneToken;
      // если editor прислал старое поле — принимаем, но норма v2 = 1 токен
      license_amount_units = (rawAmt > 0n ? rawAmt : oneToken).toString();
    } else {
      license_token_decimals = 0;
      license_amount_units = '1'; // 1 NFT / 1 единица 1155 на штуку товара
      if (receipt_standard === 'erc1155') {
        const tid = payload.receipt_erc1155_token_id ?? payload.erc1155_token_id;
        if (tid == null || String(tid) === '') {
          const err = new Error('Для ERC-1155 укажите token id');
          err.status = 400;
          throw err;
        }
        receipt_erc1155_token_id = BigInt(String(tid)).toString();
      }
    }
    license_token_symbol = String(
      payload.license_token_symbol || payload.receipt_token_symbol || ''
    ).slice(0, 32);
  }

  const max_payments_per_wallet = Math.max(1, Number(payload.max_payments_per_wallet || 1));
  if (!Number.isInteger(max_payments_per_wallet)) {
    const err = new Error('Лимит платежей на кошелёк должен быть целым ≥ 1');
    err.status = 400;
    throw err;
  }
  let max_qty = Math.max(1, Number(payload.max_qty || 1));
  if (!Number.isInteger(max_qty) || max_qty < 1) {
    const err = new Error('max_qty должен быть целым ≥ 1');
    err.status = 400;
    throw err;
  }
  if (max_qty > 99) max_qty = 99;

  const section_ids = Array.isArray(payload.section_ids)
    ? payload.section_ids.map((id) => String(id)).filter(Boolean)
    : [];

  return {
    title,
    summary: String(payload.summary || '').slice(0, 500),
    description: String(payload.description || ''),
    features: String(payload.features || ''),
    benefit_note: String(payload.benefit_note || '').slice(0, 1000),
    attributes: normalizeAttributes(payload.attributes),
    kind,
    published: Boolean(payload.published),
    sort_order: Number(payload.sort_order || 0) || 0,
    pay_token_address,
    pay_token_decimals,
    pay_token_symbol: String(payload.pay_token_symbol || '').slice(0, 32),
    price_units: price_units.toString(),
    receipt_enabled,
    receipt_standard,
    receipt_erc1155_token_id,
    license_token_address,
    license_token_decimals,
    license_token_symbol,
    license_amount_units,
    max_qty,
    max_payments_per_wallet,
    section_ids,
    media_ids: payload.media_ids,
  };
}

async function createProduct(payload, createdBy) {
  const data = validateProductPayload(payload);
  if (data.receipt_enabled) {
    await assertReceiptTokenOk(data);
  }
  const { rows } = await db.getQuery()(
    `INSERT INTO store_products (
       title, summary, description, features, benefit_note, attributes,
       kind, published, sort_order,
       pay_token_address, pay_token_decimals, pay_token_symbol, price_units,
       license_token_address, license_token_decimals, license_token_symbol, license_amount_units,
       receipt_enabled, receipt_standard, receipt_erc1155_token_id, max_qty,
       max_payments_per_wallet, created_by
     ) VALUES (
       $1,$2,$3,$4,$5,$6::jsonb,
       $7,$8,$9,
       $10,$11,$12,$13,
       $14,$15,$16,$17,
       $18,$19,$20,$21,
       $22,$23
     ) RETURNING *`,
    [
      data.title, data.summary, data.description, data.features, data.benefit_note, JSON.stringify(data.attributes),
      data.kind, data.published, data.sort_order,
      data.pay_token_address, data.pay_token_decimals, data.pay_token_symbol, data.price_units,
      data.license_token_address, data.license_token_decimals, data.license_token_symbol, data.license_amount_units,
      data.receipt_enabled, data.receipt_standard, data.receipt_erc1155_token_id, data.max_qty,
      data.max_payments_per_wallet, createdBy || null,
    ]
  );
  await setProductMedia(rows[0].id, data.media_ids);
  await setProductSections(rows[0].id, data.section_ids);
  return getProduct(rows[0].id);
}

async function updateProduct(id, payload) {
  const data = validateProductPayload(payload);
  if (data.receipt_enabled) {
    await assertReceiptTokenOk(data);
  }
  const { rows } = await db.getQuery()(
    `UPDATE store_products SET
       title = $2, summary = $3, description = $4, features = $5, benefit_note = $6, attributes = $7::jsonb,
       kind = $8, published = $9, sort_order = $10,
       pay_token_address = $11, pay_token_decimals = $12, pay_token_symbol = $13, price_units = $14,
       license_token_address = $15, license_token_decimals = $16, license_token_symbol = $17,
       license_amount_units = $18,
       receipt_enabled = $19, receipt_standard = $20, receipt_erc1155_token_id = $21, max_qty = $22,
       max_payments_per_wallet = $23, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      data.title, data.summary, data.description, data.features, data.benefit_note, JSON.stringify(data.attributes),
      data.kind, data.published, data.sort_order,
      data.pay_token_address, data.pay_token_decimals, data.pay_token_symbol, data.price_units,
      data.license_token_address, data.license_token_decimals, data.license_token_symbol,
      data.license_amount_units,
      data.receipt_enabled, data.receipt_standard, data.receipt_erc1155_token_id, data.max_qty,
      data.max_payments_per_wallet,
    ]
  );
  if (!rows[0]) {
    const err = new Error('Товар не найден');
    err.status = 404;
    throw err;
  }
  await setProductMedia(id, data.media_ids);
  await setProductSections(id, data.section_ids);
  return getProduct(id);
}

async function countWalletSlots(client, productId, buyer) {
  const q = client ? client.query.bind(client) : db.getQuery();
  const { rows } = await q(
    `SELECT COUNT(*)::int AS cnt FROM store_orders
     WHERE product_id = $1 AND lower(buyer) = lower($2) AND status = ANY($3::text[])`,
    [productId, buyer, SLOT_STATUSES]
  );
  return Number(rows[0]?.cnt || 0);
}

async function createOrder({ productId, buyerAddress, userId, qty: qtyRaw = 1 }) {
  const settings = await getSettings();
  if (!settings.treasury_address || !settings.primary_chain_id || !settings.primary_dle_address) {
    const err = new Error('Магазин не настроен: укажите DLE, сеть и казну');
    err.status = 400;
    err.code = 'STORE_NOT_CONFIGURED';
    throw err;
  }

  const buyer = normalizeAddress(buyerAddress);
  const product = await getProduct(productId);
  assertPayTokenErc20(product.pay_token_address);
  if (!product.published) {
    const err = new Error('Товар не опубликован');
    err.status = 400;
    err.code = 'PRODUCT_UNPUBLISHED';
    throw err;
  }

  let qty = Math.max(1, Number(qtyRaw || 1));
  if (!Number.isInteger(qty) || qty < 1) {
    const err = new Error('qty должен быть целым ≥ 1');
    err.status = 400;
    throw err;
  }
  const maxQty = Number(product.max_qty || 1);
  if (qty > maxQty) {
    const err = new Error(`Максимум ${maxQty} шт. для этой карточки`);
    err.status = 400;
    err.code = 'QTY_LIMIT';
    throw err;
  }

  const usedSlots = await countWalletSlots(null, product.id, buyer);
  if (usedSlots >= product.max_payments_per_wallet) {
    const err = new Error('Достигнут лимит покупок для этого кошелька');
    err.status = 409;
    err.code = 'WALLET_LIMIT';
    throw err;
  }

  const unitPrice = BigInt(product.price_units);
  const sticker = unitPrice * BigInt(qty);
  const receiptEnabled = Boolean(product.receipt_enabled && product.license_token_address);
  let licenseAmount = null;
  if (receiptEnabled) {
    const unitReceipt = BigInt(product.license_amount_units || '0');
    licenseAmount = (unitReceipt * BigInt(qty)).toString();
  }

  const ttl = Number(settings.order_ttl_minutes || 60);
  const { rows } = await db.getQuery()(
    `INSERT INTO store_orders (
       product_id, buyer, user_id, status, product_title,
       price_units, pay_token_address, pay_token_decimals, pay_token_symbol,
       license_token_address, license_token_decimals, license_token_symbol, license_amount_units,
       qty, receipt_standard, receipt_erc1155_token_id,
       treasury_address, chain_id,
       sticker_units, amount_unique_units, tail_units, expires_at
     ) VALUES (
       $1,$2,$3,'awaiting_payment',$4,
       $5,$6,$7,$8,
       $9,$10,$11,$12,
       $13,$14,$15,
       $16,$17,
       $18,$19,$20, NOW() + ($21 || ' minutes')::interval
     ) RETURNING *`,
    [
      product.id, buyer, userId || null, product.title,
      sticker.toString(), product.pay_token_address, product.pay_token_decimals, product.pay_token_symbol,
      receiptEnabled ? product.license_token_address : null,
      receiptEnabled ? Number(product.license_token_decimals || 0) : 0,
      receiptEnabled ? product.license_token_symbol : '',
      licenseAmount,
      qty,
      receiptEnabled ? (product.receipt_standard || 'erc20') : null,
      receiptEnabled && String(product.receipt_standard || '').toLowerCase() === 'erc1155'
        ? (product.receipt_erc1155_token_id ?? null)
        : null,
      settings.treasury_address, settings.primary_chain_id,
      sticker.toString(), sticker.toString(), PAY_TAIL_UNITS, String(ttl),
    ]
  );
  return mapOrder(rows[0]);
}

async function getOrderRow(id) {
  const { rows } = await db.getQuery()(`SELECT * FROM store_orders WHERE id = $1`, [id]);
  if (!rows[0]) {
    const err = new Error('Заказ не найден');
    err.status = 404;
    err.code = 'ORDER_NOT_FOUND';
    throw err;
  }
  return rows[0];
}

async function getOrder(id) {
  return mapOrder(await getOrderRow(id));
}

async function listOrdersCrm(filters = {}) {
  const status = filters.status ? String(filters.status).trim() : '';
  const q = filters.q ? String(filters.q).trim().toLowerCase() : '';
  const params = [];
  const where = [];
  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    where.push(`(
      lower(buyer) LIKE $${i}
      OR lower(coalesce(tx_hash,'')) LIKE $${i}
      OR lower(coalesce(product_title,'')) LIKE $${i}
      OR cast(id as text) LIKE $${i}
    )`);
  }
  const sql = `
    SELECT * FROM store_orders
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC
    LIMIT 500`;
  const { rows } = await db.getQuery()(sql, params);
  const out = [];
  for (const r of rows) {
    let treasury_balances = null;
    try {
      treasury_balances = await enrichOrderTreasuryBalances(r);
    } catch (_) {
      treasury_balances = null;
    }
    out.push(mapOrder(r, { treasury_balances }));
  }
  return out;
}

/**
 * Закрыть позицию: «обслужено» (без чека) или «выдача исполнена» после vote.
 */
async function markOrderFulfilled(orderId) {
  const row = await getOrderRow(orderId);
  const hasReceipt = Boolean(row.license_token_address);
  if (hasReceipt) {
    if (row.status !== 'fulfillment_proposed') {
      const err = new Error('Отметить выдачу можно после создания proposal (статус fulfillment_proposed)');
      err.status = 400;
      err.code = 'BAD_STATUS';
      throw err;
    }
  } else if (row.status !== 'paid') {
    const err = new Error('«Обслужено» доступно для оплаченных позиций без токен-чека');
    err.status = 400;
    err.code = 'BAD_STATUS';
    throw err;
  }
  const { rows } = await db.getQuery()(
    `UPDATE store_orders
     SET status = 'fulfilled', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [orderId]
  );
  return mapOrder(rows[0]);
}

async function markOrderRefunded(orderId) {
  const row = await getOrderRow(orderId);
  if (row.status !== 'refund_proposed') {
    const err = new Error('Отметить возврат можно после refund_proposed');
    err.status = 400;
    throw err;
  }
  const { rows } = await db.getQuery()(
    `UPDATE store_orders
     SET status = 'refunded', updated_at = NOW()
     WHERE id = $1 AND status = 'refund_proposed'
     RETURNING *`,
    [orderId]
  );
  return mapOrder(rows[0] || row);
}

/**
 * Импорт карточек. Каждая строка проходит validate + resolveToken (C12).
 * rows: partial product payloads (+ price_human, section_slugs).
 */
async function importProducts(rows, createdBy) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    const err = new Error('Нет строк для импорта');
    err.status = 400;
    throw err;
  }
  if (list.length > 200) {
    const err = new Error('За один раз не больше 200 строк');
    err.status = 400;
    throw err;
  }

  const storeV2 = require('./storeSectionsCheckout');
  const created = [];
  const errors = [];

  for (let i = 0; i < list.length; i += 1) {
    const raw = list[i] || {};
    const rowNum = i + 1;
    try {
      const payAddr = raw.pay_token_address || raw.payTokenAddress;
      if (!payAddr) throw new Error('Нужен pay_token_address');
      const payMeta = await resolveToken(payAddr, { standard: 'erc20' });
      if (!payMeta.in_treasury) {
        throw new Error('Pay-токен не в активном реестре казны / нулевой баланс');
      }

      let price_units = raw.price_units;
      if (price_units == null || String(price_units) === '') {
        const human = String(raw.price_human || raw.price || '').trim();
        if (!human) throw new Error('Нужна price_human или price_units');
        price_units = ethers.parseUnits(human, Number(payMeta.decimals)).toString();
      }

      const receipt_enabled = ['1', 'true', 'yes', 'да', true, 1].includes(
        typeof raw.receipt_enabled === 'string'
          ? raw.receipt_enabled.trim().toLowerCase()
          : raw.receipt_enabled
      ) || Boolean(raw.license_token_address || raw.receipt_token_address);

      const payload = {
        title: raw.title,
        summary: raw.summary || '',
        description: raw.description || '',
        features: raw.features || '',
        benefit_note: raw.benefit_note || '',
        kind: raw.kind === 'service' ? 'service' : 'product',
        published: ['1', 'true', 'yes', 'да', true, 1].includes(
          typeof raw.published === 'string'
            ? raw.published.trim().toLowerCase()
            : raw.published
        ),
        pay_token_address: payMeta.address,
        pay_token_decimals: payMeta.decimals,
        pay_token_symbol: payMeta.symbol || '',
        price_units: String(price_units),
        receipt_enabled,
        max_qty: raw.max_qty != null ? Number(raw.max_qty) : 1,
        max_payments_per_wallet: raw.max_payments_per_wallet != null
          ? Number(raw.max_payments_per_wallet)
          : 1,
        section_ids: [],
      };

      if (receipt_enabled) {
        const licAddr = raw.license_token_address || raw.receipt_token_address;
        if (!licAddr) throw new Error('При receipt_enabled нужен license_token_address');
        const standard = String(raw.receipt_standard || 'erc20').toLowerCase();
        const licMeta = await resolveToken(licAddr, {
          standard,
          erc1155TokenId: raw.receipt_erc1155_token_id || raw.erc1155_token_id,
        });
        if (!licMeta.in_treasury) {
          throw new Error('Токен-чек не найден на казне / нулевой баланс');
        }
        payload.receipt_standard = standard;
        payload.license_token_address = licMeta.address;
        payload.license_token_decimals = licMeta.decimals;
        payload.license_token_symbol = licMeta.symbol || '';
        if (standard === 'erc1155') {
          payload.receipt_erc1155_token_id = raw.receipt_erc1155_token_id || raw.erc1155_token_id;
        }
      }

      const slugRaw = raw.section_slugs || raw.sections || '';
      const slugs = Array.isArray(slugRaw)
        ? slugRaw
        : String(slugRaw).split(/[|;,]/).map((s) => s.trim()).filter(Boolean);
      for (const slug of slugs) {
        try {
          const sec = await storeV2.getSectionBySlug(slug);
          if (sec?.id) payload.section_ids.push(sec.id);
        } catch (_) {
          throw new Error(`Раздел не найден: ${slug}`);
        }
      }

      const product = await createProduct(payload, createdBy);
      created.push({ row: rowNum, id: product.id, title: product.title });
    } catch (e) {
      errors.push({ row: rowNum, error: e.message || String(e), code: e.code || null });
    }
  }

  return {
    success: errors.length === 0,
    created: created.length,
    failed: errors.length,
    products: created,
    errors,
  };
}

async function listOrdersMine(buyer) {
  const addr = normalizeAddress(buyer);
  const { rows } = await db.getQuery()(
    `SELECT * FROM store_orders WHERE lower(buyer) = lower($1) ORDER BY created_at DESC LIMIT 200`,
    [addr]
  );
  return attachBuyerReviews(rows, addr);
}

async function listOrdersForUserId(userId) {
  const rows = await storeReviews.listOrdersForContactUserId(userId);
  return attachBuyerReviews(rows);
}

async function loadCoverByProductIds(productIds) {
  const ids = [...new Set((productIds || []).filter(Boolean))];
  const map = {};
  if (!ids.length) return map;
  const { rows } = await db.getQuery()(
    `SELECT DISTINCT ON (spm.product_id)
       spm.product_id,
       spm.content_media_id,
       spm.sort_order,
       cm.file_name,
       cm.media_type,
       CASE
         WHEN cm.public_id IS NOT NULL AND cm.public_id <> '' THEN '/v/' || cm.public_id
         ELSE '/api/uploads/media/' || cm.id::text || '/file'
       END AS url
     FROM store_product_media spm
     LEFT JOIN content_media cm ON cm.id = spm.content_media_id
     WHERE spm.product_id = ANY($1::uuid[])
     ORDER BY spm.product_id, spm.sort_order ASC, spm.id ASC`,
    [ids]
  );
  for (const r of rows) {
    map[r.product_id] = mapMediaRows([r])[0] || null;
  }
  return map;
}

async function attachBuyerReviews(orderRows, buyerHint = null) {
  const out = [];
  for (const row of orderRows) {
    const mapped = mapOrder(row);
    const buyer = buyerHint || mapped.buyer;
    try {
      mapped.my_review = mapped.product_id
        ? await storeReviews.getReviewForBuyer(mapped.product_id, buyer)
        : null;
    } catch {
      mapped.my_review = null;
    }
    out.push(mapped);
  }
  const covers = await loadCoverByProductIds(out.map((o) => o.product_id));
  for (const o of out) {
    o.cover = covers[o.product_id] || null;
  }
  return out;
}

async function expireAwaitingOrders() {
  await db.getQuery()(
    `UPDATE store_orders SET status = 'expired', updated_at = NOW()
     WHERE status = 'awaiting_payment' AND expires_at IS NOT NULL AND expires_at < NOW()`
  );
}

async function cancelOrder(id, { buyer = null, force = false } = {}) {
  const row = await getOrderRow(id);
  if (row.status !== 'awaiting_payment') {
    const err = new Error('Отменить можно только неоплаченный заказ');
    err.status = 400;
    throw err;
  }
  if (buyer && String(row.buyer).toLowerCase() !== String(normalizeAddress(buyer)).toLowerCase() && !force) {
    const err = new Error('Нет доступа к заказу');
    err.status = 403;
    throw err;
  }
  const { rows } = await db.getQuery()(
    `UPDATE store_orders SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND status = 'awaiting_payment' RETURNING *`,
    [id]
  );
  return mapOrder(rows[0] || row);
}

async function getProvider(chainId) {
  const url = await rpcProviderService.getRpcUrlByChainId(Number(chainId));
  if (!url) {
    const err = new Error('Для этой сети нет RPC');
    err.status = 400;
    err.code = 'RPC_MISSING';
    throw err;
  }
  return new ethers.JsonRpcProvider(url, Number(chainId));
}

function parseTransferFrom(log) {
  const base = parseTransferLog(log);
  if (!base) return null;
  const from = log.topics && log.topics[1]
    ? ethers.getAddress(ethers.dataSlice(log.topics[1], 12))
    : null;
  return { ...base, from, logIndex: log.index != null ? Number(log.index) : null };
}

async function tryRefreshBalance(treasuryAddress, tokenAddress, chainId) {
  try {
    const provider = await getProvider(chainId);
    const contract = new ethers.Contract(treasuryAddress, TREASURY_REFRESH_ABI, provider);
    // eth_call симулирует; реальный refreshBalance нужен on-chain от оператора.
    // Здесь только проверяем, что вызов не ревертится (токен в реестре).
    await contract.refreshBalance.staticCall(tokenAddress);
    return { ok: true, simulated: true };
  } catch (error) {
    logger.warn('[store] refreshBalance check:', error.message);
    return { ok: false, error: error.message };
  }
}

async function readTokenBalanceHuman(treasuryAddress, tokenAddress, decimals, chainId) {
  try {
    const provider = await getProvider(chainId);
    const erc20 = new ethers.Contract(tokenAddress, ERC20_META_ABI, provider);
    const bal = await erc20.balanceOf(treasuryAddress);
    return fromUnits(bal, decimals);
  } catch (error) {
    logger.warn('[store] balanceOf failed:', error.message);
    return null;
  }
}

async function enrichOrderTreasuryBalances(row) {
  const pay = await readTokenBalanceHuman(
    row.treasury_address, row.pay_token_address, row.pay_token_decimals, row.chain_id
  );
  let license = null;
  if (row.license_token_address) {
    license = await readTokenBalanceHuman(
      row.treasury_address,
      row.license_token_address,
      row.license_token_decimals != null ? row.license_token_decimals : 0,
      row.chain_id
    );
  }
  return {
    pay,
    license,
    pay_token_symbol: row.pay_token_symbol || '',
    license_token_symbol: row.license_token_symbol || '',
  };
}

function listedTokenAddress(raw) {
  if (raw == null || raw === ethers.ZeroAddress) return ethers.ZeroAddress;
  try {
    return ethers.getAddress(raw);
  } catch {
    return ethers.ZeroAddress;
  }
}

async function readErc20Meta(provider, tokenAddress, treasuryAddress, info) {
  const erc20 = new ethers.Contract(tokenAddress, ERC20_META_ABI, provider);
  let symbol = String(info?.symbol || '');
  if (!symbol) {
    try { symbol = String(await erc20.symbol()); } catch (_) { symbol = ''; }
  }
  let decimals;
  try {
    decimals = Number(await erc20.decimals());
  } catch (_) {
    decimals = Number(info?.decimals);
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    decimals = 18;
  }
  let rawBal = info?.balance;
  try {
    rawBal = await erc20.balanceOf(treasuryAddress);
  } catch (_) {
    if (rawBal == null) rawBal = 0n;
  }
  return {
    symbol,
    decimals,
    balance_cached: unitsToString(rawBal),
    balance_human: fromUnits(rawBal, decimals),
  };
}

async function listTreasuryTokens(opts = {}) {
  const settings = await getSettings();
  const treasuryAddress = opts.treasury_address
    ? normalizeAddress(opts.treasury_address)
    : settings.treasury_address;
  const chainId = opts.chain_id != null && opts.chain_id !== ''
    ? Number(opts.chain_id)
    : settings.primary_chain_id;
  if (!treasuryAddress || !chainId) {
    return [];
  }
  const provider = await getProvider(chainId);
  const treasury = new ethers.Contract(treasuryAddress, TREASURY_READ_ABI, provider);
  let addresses;
  try {
    addresses = await treasury.getAllTokens();
  } catch (error) {
    logger.warn('[store] listTreasuryTokens getAllTokens:', error.message);
    const err = new Error('Не удалось прочитать реестр токенов казны из сети');
    err.status = 502;
    err.code = 'TREASURY_TOKENS_UNAVAILABLE';
    throw err;
  }
  const out = [];
  const seen = new Set();
  for (const raw of addresses || []) {
    const tokenAddress = listedTokenAddress(raw);
    if (isNativeTokenAddress(tokenAddress)) continue;
    const key = tokenAddress.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      let info = null;
      try {
        info = await treasury.getTokenInfo(tokenAddress);
      } catch (_) {
        info = null;
      }
      const isNative = Boolean(info?.isNative);
      if (isNative) continue;
      if (info && info.isActive === false) continue;
      const meta = await readErc20Meta(provider, tokenAddress, treasuryAddress, info);
      out.push({
        address: tokenAddress,
        symbol: meta.symbol,
        decimals: meta.decimals,
        balance_cached: meta.balance_cached,
        balance_human: meta.balance_human,
        in_treasury: true,
        is_active: info ? Boolean(info.isActive) : true,
        is_native: false,
      });
    } catch (e2) {
      logger.warn('[store] token meta skip:', tokenAddress, e2.message);
    }
  }
  return out;
}

const BOOK_NETWORK_NAMES = {
  1: 'Ethereum Mainnet',
  11155111: 'Sepolia',
  17000: 'Holesky',
  137: 'Polygon',
  42161: 'Arbitrum One',
  421614: 'Arbitrum Sepolia',
  10: 'Optimism',
  8453: 'Base',
  84532: 'Base Sepolia',
  56: 'BNB Smart Chain',
};

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Адрес книги один во всех сетях. RPC берём из БД, ищем контракт,
 * для каждой найденной сети читаем слот казны.
 */
async function discoverBook(dleAddressRaw) {
  const dleAddress = normalizeAddress(dleAddressRaw);
  const rpcProviderService = require('./rpcProviderService');
  const { resolveBookSlot } = require('../utils/bookModuleSlot');
  const providers = await rpcProviderService.getAllRpcProviders();
  if (!Array.isArray(providers) || providers.length === 0) {
    const err = new Error('В базе нет RPC для связи с блокчейном');
    err.status = 400;
    err.code = 'RPC_MISSING';
    throw err;
  }

  const byChain = new Map();
  for (const rpc of providers) {
    const chainId = Number(rpc.chain_id);
    if (!Number.isFinite(chainId) || chainId <= 0 || byChain.has(chainId)) continue;
    byChain.set(chainId, rpc);
  }

  const found = [];
  await Promise.all([...byChain.entries()].map(async ([chainId, rpc]) => {
    try {
      const url = rpc.rpc_url || await rpcProviderService.getRpcUrlByChainId(chainId);
      if (!url) return;
      const provider = new ethers.JsonRpcProvider(url, chainId, { staticNetwork: true });
      const code = await withTimeout(provider.getCode(dleAddress), 8000, `RPC timeout chain ${chainId}`);
      if (!code || code === '0x') return;
      const dle = new ethers.Contract(
        dleAddress,
        ['function getModuleAddress(bytes32) view returns (address)'],
        provider
      );
      const slot = await withTimeout(resolveBookSlot(dle, 'treasury'), 8000, `treasury slot timeout ${chainId}`);
      const treasury = slot?.moduleAddress && slot.moduleAddress !== ethers.ZeroAddress
        ? ethers.getAddress(slot.moduleAddress)
        : null;
      found.push({
        chain_id: chainId,
        network_name: BOOK_NETWORK_NAMES[chainId] || `Chain ${chainId}`,
        treasury_address: treasury,
      });
    } catch (error) {
      logger.warn('[store] discoverBook skip chain', chainId, error.message);
    }
  }));

  found.sort((a, b) => a.chain_id - b.chain_id);
  if (!found.length) {
    const err = new Error('По этому адресу книги нет контракта ни в одной сети, для которой в базе есть RPC');
    err.status = 404;
    err.code = 'BOOK_NOT_FOUND';
    throw err;
  }
  return {
    primary_dle_address: dleAddress,
    networks: found,
  };
}

/**
 * Проверить токен: ERC-20 из казны или NFT на адресе казны.
 * options.standard: erc20|erc721|erc1155
 */
async function resolveToken(tokenAddress, options = {}) {
  const settings = await getSettings();
  if (!settings.treasury_address || !settings.primary_chain_id) {
    const err = new Error('Сначала сохраните адрес казны и chain id в настройках магазина');
    err.status = 400;
    err.code = 'STORE_NOT_CONFIGURED';
    throw err;
  }
  const address = normalizeAddress(tokenAddress);
  const standard = String(options.standard || 'erc20').toLowerCase();
  if (standard === 'erc20') {
    assertPayTokenErc20(address);
  }
  const provider = await getProvider(settings.primary_chain_id);
  const treasuryAddr = settings.treasury_address;

  if (standard === 'erc721') {
    const nft = new ethers.Contract(address, [
      'function balanceOf(address) view returns (uint256)',
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function totalSupply() view returns (uint256)',
    ], provider);
    let symbol = 'NFT';
    let name = '';
    let treasury_balance_units = '0';
    let total_supply_units = null;
    try { symbol = String(await nft.symbol()); } catch (_) { /* optional */ }
    try { name = String(await nft.name()); } catch (_) { /* optional */ }
    try {
      treasury_balance_units = unitsToString(await nft.balanceOf(treasuryAddr));
    } catch (error) {
      const err = new Error('Не удалось прочитать balanceOf NFT на казне');
      err.status = 400;
      err.code = 'NFT_BALANCE_FAIL';
      throw err;
    }
    try {
      total_supply_units = unitsToString(await nft.totalSupply());
    } catch (_) {
      total_supply_units = null;
    }
    return {
      address,
      symbol,
      name,
      decimals: 0,
      standard: 'erc721',
      balance_human: treasury_balance_units,
      treasury_balance_units,
      total_supply_units,
      total_supply_human: total_supply_units,
      in_treasury: BigInt(treasury_balance_units) > 0n,
      treasury_address: treasuryAddr,
      chain_id: settings.primary_chain_id,
    };
  }

  if (standard === 'erc1155') {
    const tokenId = options.erc1155TokenId != null ? BigInt(String(options.erc1155TokenId)) : null;
    if (tokenId == null) {
      const err = new Error('Для ERC-1155 нужен token id');
      err.status = 400;
      throw err;
    }
    const nft = new ethers.Contract(address, [
      'function balanceOf(address account, uint256 id) view returns (uint256)',
      'function uri(uint256) view returns (string)',
    ], provider);
    let treasury_balance_units = '0';
    try {
      treasury_balance_units = unitsToString(await nft.balanceOf(treasuryAddr, tokenId));
    } catch (error) {
      const err = new Error('Не удалось прочитать balanceOf ERC-1155 на казне');
      err.status = 400;
      err.code = 'NFT_BALANCE_FAIL';
      throw err;
    }
    return {
      address,
      symbol: `ERC1155#${tokenId.toString()}`,
      decimals: 0,
      standard: 'erc1155',
      receipt_erc1155_token_id: tokenId.toString(),
      balance_human: treasury_balance_units,
      treasury_balance_units,
      total_supply_units: null,
      total_supply_human: null,
      in_treasury: BigInt(treasury_balance_units) > 0n,
      treasury_address: treasuryAddr,
      chain_id: settings.primary_chain_id,
    };
  }

  // erc20
  const erc20 = new ethers.Contract(address, [
    ...ERC20_META_ABI,
    'function totalSupply() view returns (uint256)',
  ], provider);
  let symbol = '';
  let decimals = 18;
  try {
    symbol = String(await erc20.symbol());
    decimals = Number(await erc20.decimals());
  } catch (error) {
    const err = new Error('По адресу не читается ERC-20 (symbol/decimals)');
    err.status = 400;
    err.code = 'NOT_ERC20';
    throw err;
  }
  let treasury_balance_units = '0';
  let balance_human = null;
  try {
    const bal = await erc20.balanceOf(treasuryAddr);
    treasury_balance_units = unitsToString(bal);
    balance_human = fromUnits(bal, decimals);
  } catch (_) {
    balance_human = null;
  }
  let total_supply_units = null;
  let total_supply_human = null;
  try {
    const supply = await erc20.totalSupply();
    total_supply_units = unitsToString(supply);
    total_supply_human = fromUnits(supply, decimals);
  } catch (_) {
    total_supply_units = null;
  }
  let in_treasury = false;
  try {
    const treasury = new ethers.Contract(treasuryAddr, TREASURY_READ_ABI, provider);
    const info = await treasury.getTokenInfo(address);
    in_treasury = Boolean(info && info.isActive);
    if (info?.symbol) symbol = info.symbol;
    if (info?.decimals != null) decimals = Number(info.decimals);
  } catch (_) {
    in_treasury = false;
  }
  return {
    address,
    symbol,
    decimals,
    standard: 'erc20',
    balance_human,
    treasury_balance_units,
    total_supply_units,
    total_supply_human,
    in_treasury,
    treasury_address: treasuryAddr,
    chain_id: settings.primary_chain_id,
  };
}

async function markPaidAtomic(orderId, matched) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows: locked } = await client.query(
      `SELECT * FROM store_orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );
    const row = locked[0];
    if (!row) {
      const err = new Error('Заказ не найден');
      err.status = 404;
      throw err;
    }
    if (row.status === 'paid' || SLOT_STATUSES.includes(row.status)) {
      await client.query('COMMIT');
      return mapOrder(row);
    }
    if (row.status !== 'awaiting_payment') {
      const err = new Error('Заказ нельзя отметить оплаченным');
      err.status = 400;
      throw err;
    }

    const { rows: productRows } = await client.query(
      `SELECT max_payments_per_wallet FROM store_products WHERE id = $1 FOR UPDATE`,
      [row.product_id]
    );
    const max = Number(productRows[0]?.max_payments_per_wallet || 1);
    const used = await countWalletSlots(client, row.product_id, row.buyer);
    if (used >= max) {
      const err = new Error('Достигнут лимит покупок для этого кошелька');
      err.status = 409;
      err.code = 'WALLET_LIMIT';
      throw err;
    }

    const { rows: replay } = await client.query(
      `SELECT id FROM store_orders WHERE lower(tx_hash) = lower($1) AND id <> $2`,
      [matched.txHash, orderId]
    );
    if (replay.length) {
      const err = new Error('Транзакция уже привязана к другому заказу');
      err.status = 409;
      err.code = 'TX_REPLAY';
      throw err;
    }

    const { rows: updated } = await client.query(
      `UPDATE store_orders
       SET status = 'paid', tx_hash = $2, tx_log_index = $3, paid_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'awaiting_payment'
       RETURNING *`,
      [orderId, matched.txHash, matched.logIndex]
    );
    if (row.checkout_id) {
      await client.query(
        `UPDATE store_checkouts
         SET status = 'paid', tx_hash = $2, tx_log_index = $3, paid_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND status = 'awaiting_payment'`,
        [row.checkout_id, matched.txHash, matched.logIndex]
      );
      await client.query(
        `UPDATE store_orders
         SET status = 'paid', tx_hash = $2, tx_log_index = $3, paid_at = NOW(), updated_at = NOW()
         WHERE checkout_id = $1 AND status = 'awaiting_payment'`,
        [row.checkout_id, matched.txHash, matched.logIndex]
      );
    }
    await client.query('COMMIT');
    const paid = mapOrder(updated[0]);
    try {
      await storeReviews.recordPaidActivity({
        userId: paid.user_id,
        buyer: paid.buyer,
        checkoutId: paid.checkout_id,
        orderId: paid.id,
        productId: paid.product_id,
      });
    } catch (e) {
      logger.warn('[store] paid activity skipped:', e.message);
    }
    return paid;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw error;
  } finally {
    client.release();
  }
}

async function checkOrderPayment(orderId, { txHashHint = null } = {}) {
  await expireAwaitingOrders();
  const row = await getOrderRow(orderId);
  if (SLOT_STATUSES.includes(row.status) || row.status === 'fulfilled' || row.status === 'refunded') {
    return mapOrder(row);
  }
  if (row.status !== 'awaiting_payment') {
    return mapOrder(row);
  }
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    await db.getQuery()(
      `UPDATE store_orders SET status = 'expired', updated_at = NOW()
       WHERE id = $1 AND status = 'awaiting_payment'`,
      [row.id]
    );
    return mapOrder({ ...row, status: 'expired' });
  }

  const provider = await getProvider(row.chain_id);
  const currentBlock = await provider.getBlockNumber();
  const lookback = Math.max(currentBlock - 8000, 0);
  const filter = {
    address: row.pay_token_address,
    fromBlock: lookback,
    toBlock: currentBlock,
    topics: [TRANSFER_TOPIC, null, transferToTopic(row.treasury_address)],
  };
  if (txHashHint) {
    // hint ускоряет UX; всё равно валидируем лог
  }
  const logs = await provider.getLogs(filter);
  const want = BigInt(row.amount_unique_units || row.sticker_units);
  const buyer = String(row.buyer).toLowerCase();
  const treasury = String(row.treasury_address).toLowerCase();

  const { rows: usedOrderTx } = await db.getQuery()(
    `SELECT lower(tx_hash) AS h FROM store_orders
     WHERE chain_id = $1 AND lower(pay_token_address) = lower($2) AND tx_hash IS NOT NULL`,
    [row.chain_id, row.pay_token_address]
  );
  let usedCheckoutTx = [];
  try {
    const r = await db.getQuery()(
      `SELECT lower(tx_hash) AS h FROM store_checkouts
       WHERE chain_id = $1 AND lower(pay_token_address) = lower($2) AND tx_hash IS NOT NULL`,
      [row.chain_id, row.pay_token_address]
    );
    usedCheckoutTx = r.rows || [];
  } catch (_) {
    usedCheckoutTx = [];
  }
  const usedTx = new Set([
    ...usedOrderTx.map((x) => x.h).filter(Boolean),
    ...usedCheckoutTx.map((x) => x.h).filter(Boolean),
  ]);

  const { rows: olderRows } = await db.getQuery()(
    `SELECT COUNT(*)::int AS c FROM store_orders
     WHERE status = 'awaiting_payment'
       AND checkout_id IS NULL
       AND lower(buyer) = lower($1)
       AND lower(pay_token_address) = lower($2)
       AND chain_id = $3
       AND amount_unique_units = $4::numeric
       AND created_at < $5
       AND id <> $6`,
    [row.buyer, row.pay_token_address, row.chain_id, want.toString(), row.created_at, row.id]
  );
  const older = Number(olderRows[0]?.c || 0);

  const candidates = [];
  for (const log of logs) {
    if (txHashHint && String(log.transactionHash).toLowerCase() !== String(txHashHint).toLowerCase()) {
      continue;
    }
    const parsed = parseTransferFrom(log);
    if (!parsed || parsed.value !== want) continue;
    if (String(parsed.to || '').toLowerCase() !== treasury) continue;
    if (String(parsed.from || '').toLowerCase() !== buyer) continue;
    const h = String(parsed.txHash || '').toLowerCase();
    if (h && usedTx.has(h)) continue;
    candidates.push(parsed);
  }
  candidates.sort((a, b) => {
    const ba = Number(a.blockNumber || 0) - Number(b.blockNumber || 0);
    if (ba !== 0) return ba;
    return Number(a.logIndex || 0) - Number(b.logIndex || 0);
  });
  const matched = candidates[older] || null;

  if (!matched) {
    return mapOrder(row);
  }

  await tryRefreshBalance(row.treasury_address, row.pay_token_address, row.chain_id);
  return markPaidAtomic(row.id, matched);
}

function buildTransferPrefill(row, { mode }) {
  const isRefund = mode === 'refund';
  const token = isRefund ? row.pay_token_address : row.license_token_address;
  const decimals = isRefund ? row.pay_token_decimals : row.license_token_decimals;
  // license_amount_units на заказе уже = unit × qty
  const amountUnits = isRefund ? row.amount_unique_units : row.license_amount_units;
  const amountHuman = fromUnits(amountUnits, decimals);
  const proposalRef = orderProposalRef(row.id);
  const description = isRefund
    ? `Store refund order ${row.id} buyer ${row.buyer} ${row.product_title}`
    : `Store fulfill order ${row.id} buyer ${row.buyer} ${row.product_title}`;

  return {
    op: 'transferFunds',
    moduleType: 'treasury',
    address: null, // filled by caller with settings
    chainId: row.chain_id,
    token,
    decimals,
    recipient: row.buyer,
    amount: amountHuman,
    proposalRef,
    description,
    orderId: row.id,
  };
}

function normalizeTokenIdList(raw) {
  if (raw == null) return [];
  const list = Array.isArray(raw)
    ? raw
    : String(raw).split(/[\s,;]+/).filter(Boolean);
  return list.map((v) => {
    try {
      return BigInt(String(v).trim()).toString();
    } catch {
      const err = new Error(`Некорректный tokenId: ${v}`);
      err.status = 400;
      err.code = 'INVALID_TOKEN_ID';
      throw err;
    }
  });
}

function buildNftPrefills(row, { tokenIds, erc1155TokenId }) {
  const proposalRef = orderProposalRef(row.id);
  const qty = Math.max(1, Number(row.qty || 1));
  const standard = String(row.receipt_standard || '').toLowerCase();
  const base = {
    moduleType: 'treasury',
    address: null,
    chainId: row.chain_id,
    token: row.license_token_address,
    recipient: row.buyer,
    proposalRef,
    orderId: row.id,
    receipt_standard: standard,
  };

  if (standard === 'erc721') {
    const ids = normalizeTokenIdList(tokenIds);
    if (ids.length !== qty) {
      const err = new Error(
        `Для ERC-721 нужно ${qty} tokenId (по числу штук), получено ${ids.length}`
      );
      err.status = 400;
      err.code = 'NFT_TOKEN_IDS_REQUIRED';
      throw err;
    }
    return ids.map((tokenId, index) => ({
      ...base,
      op: 'transferERC721',
      tokenId,
      amount: '1',
      description:
        `Store fulfill NFT721 order ${row.id} #${index + 1}/${qty} tokenId ${tokenId} buyer ${row.buyer}`,
    }));
  }

  if (standard === 'erc1155') {
    const tid = erc1155TokenId != null && String(erc1155TokenId) !== ''
      ? String(erc1155TokenId)
      : (row.receipt_erc1155_token_id != null
        ? unitsToString(row.receipt_erc1155_token_id)
        : null);
    if (tid == null || tid === '') {
      const err = new Error('Для ERC-1155 нужен token id (карточка или CRM)');
      err.status = 400;
      err.code = 'ERC1155_TOKEN_ID_REQUIRED';
      throw err;
    }
    const unit = BigInt(row.license_amount_units || '1');
    const amount = unit.toString(); // уже unit×qty на заказе
    return [{
      ...base,
      op: 'transferERC1155',
      tokenId: BigInt(tid).toString(),
      amount,
      description:
        `Store fulfill NFT1155 order ${row.id} tokenId ${tid} amount ${amount} buyer ${row.buyer}`,
    }];
  }

  const err = new Error(`Неизвестный стандарт токен-чека: ${standard}`);
  err.status = 400;
  throw err;
}

async function prepareFulfillment(orderId, options = {}) {
  const settings = await getSettings();
  const row = await getOrderRow(orderId);
  if (row.status !== 'paid') {
    const err = new Error('Выдачу можно создать только для статуса paid');
    err.status = 400;
    throw err;
  }
  if (!row.license_token_address) {
    const err = new Error('У заказа нет токен-чека — on-chain выдача не требуется');
    err.status = 400;
    err.code = 'NO_RECEIPT';
    throw err;
  }
  const standard = String(row.receipt_standard || 'erc20').toLowerCase();
  const proposalRef = orderProposalRef(row.id);

  let prefills;
  if (standard === 'erc721' || standard === 'erc1155') {
    prefills = buildNftPrefills(row, {
      tokenIds: options.tokenIds ?? options.token_ids,
      erc1155TokenId: options.erc1155TokenId ?? options.receipt_erc1155_token_id,
    });
  } else {
    await tryRefreshBalance(row.treasury_address, row.license_token_address, row.chain_id);
    prefills = [buildTransferPrefill(row, { mode: 'fulfill' })];
  }

  await db.getQuery()(
    `UPDATE store_orders
     SET status = 'fulfillment_proposed', fulfillment_calldata_proposal_ref = $2, updated_at = NOW()
     WHERE id = $1 AND status = 'paid'`,
    [orderId, proposalRef]
  );

  for (const p of prefills) {
    p.address = settings.primary_dle_address;
  }
  const prefill = prefills[0];
  return {
    order: await getOrder(orderId),
    prefill,
    prefills,
    query: prefill,
  };
}

async function pullTreasuryFromModule() {
  const settings = await getSettings();
  if (!settings.primary_dle_address || !settings.primary_chain_id) {
    const err = new Error('Сначала укажите адрес главной книги и сеть');
    err.status = 400;
    err.code = 'STORE_DLE_REQUIRED';
    throw err;
  }
  const { resolveBookSlot } = require('../utils/bookModuleSlot');
  const provider = await getProvider(settings.primary_chain_id);
  const dle = new ethers.Contract(
    settings.primary_dle_address,
    ['function getModuleAddress(bytes32) view returns (address)'],
    provider
  );
  const slot = await resolveBookSlot(dle, 'treasury');
  const addr = slot?.moduleAddress;
  if (!addr || addr === ethers.ZeroAddress) {
    const err = new Error('В книге нет активного модуля казны');
    err.status = 404;
    err.code = 'TREASURY_NOT_IN_BOOK';
    throw err;
  }
  return {
    treasury_address: ethers.getAddress(addr),
    module_id: slot.moduleId || null,
    primary_dle_address: settings.primary_dle_address,
    primary_chain_id: settings.primary_chain_id,
  };
}

async function prepareRefund(orderId) {
  const settings = await getSettings();
  const row = await getOrderRow(orderId);
  if (!['paid', 'fulfillment_proposed'].includes(row.status)) {
    const err = new Error('Возврат доступен из paid / fulfillment_proposed');
    err.status = 400;
    throw err;
  }
  await tryRefreshBalance(row.treasury_address, row.pay_token_address, row.chain_id);
  const proposalRef = orderProposalRef(row.id);
  await db.getQuery()(
    `UPDATE store_orders
     SET status = 'refund_proposed', refund_calldata_proposal_ref = $2, updated_at = NOW()
     WHERE id = $1 AND status = ANY($3::text[])`,
    [orderId, proposalRef, ['paid', 'fulfillment_proposed']]
  );
  const prefill = buildTransferPrefill(row, { mode: 'refund' });
  prefill.address = settings.primary_dle_address;
  return { order: await getOrder(orderId), prefill, query: prefill };
}

async function markFulfillmentProposed(orderId, proposalId) {
  const { rows } = await db.getQuery()(
    `UPDATE store_orders
     SET fulfillment_proposal_id = $2, status = 'fulfillment_proposed', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [orderId, String(proposalId)]
  );
  return mapOrder(rows[0]);
}

async function markRefundProposed(orderId, proposalId) {
  const { rows } = await db.getQuery()(
    `UPDATE store_orders
     SET refund_proposal_id = $2, status = 'refund_proposed', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [orderId, String(proposalId)]
  );
  return mapOrder(rows[0]);
}

module.exports = {
  SLOT_STATUSES,
  normalizeAddress,
  isNativeTokenAddress,
  assertPayTokenErc20,
  orderProposalRef,
  getSettings,
  saveSettings,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  setProductMedia,
  setProductSections,
  createOrder,
  getOrder,
  listOrdersCrm,
  listOrdersMine,
  listOrdersForUserId,
  cancelOrder,
  expireAwaitingOrders,
  checkOrderPayment,
  prepareFulfillment,
  prepareRefund,
  markFulfillmentProposed,
  markRefundProposed,
  markOrderFulfilled,
  markOrderRefunded,
  importProducts,
  pullTreasuryFromModule,
  mapOrder,
  mapProduct,
  countWalletSlots,
  listTreasuryTokens,
  discoverBook,
  resolveToken,
  enrichOrderTreasuryBalances,
};
