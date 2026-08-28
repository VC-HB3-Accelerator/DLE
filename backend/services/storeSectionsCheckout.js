/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Store V2: разделы каталога + checkout (корзина, один pay_token).
 */

const { ethers } = require('ethers');
const db = require('../db');
const { getPool } = db;
const {
  normalizeAddress,
  getSettings,
  getProduct,
  countWalletSlots,
} = require('./storeService');
const {
  TRANSFER_TOPIC,
  transferToTopic,
  parseTransferLog,
  fromUnits,
} = require('./voiceCallAmount');
const rpcProviderService = require('./rpcProviderService');

/** Хвосты unique-amount в магазине не используем: матч по buyer + сумме прайса. */
const PAY_TAIL_UNITS = '0';

async function listUsedPayTxHashes({ chainId, payTokenAddress }) {
  const { rows: orderTx } = await db.getQuery()(
    `SELECT lower(tx_hash) AS h FROM store_orders
     WHERE chain_id = $1 AND lower(pay_token_address) = lower($2)
       AND tx_hash IS NOT NULL`,
    [chainId, payTokenAddress]
  );
  const { rows: checkoutTx } = await db.getQuery()(
    `SELECT lower(tx_hash) AS h FROM store_checkouts
     WHERE chain_id = $1 AND lower(pay_token_address) = lower($2)
       AND tx_hash IS NOT NULL`,
    [chainId, payTokenAddress]
  );
  return new Set([
    ...orderTx.map((r) => r.h).filter(Boolean),
    ...checkoutTx.map((r) => r.h).filter(Boolean),
  ]);
}

/**
 * Сколько более ранних awaiting с тем же buyer+token+суммой —
 * чтобы N-й платёж закрывал N-ю по времени заявку.
 */
async function countOlderAwaitingSameAmount({
  table,
  id,
  buyer,
  payTokenAddress,
  chainId,
  amountUnits,
  createdAt,
}) {
  const allowed = table === 'store_checkouts' ? 'store_checkouts' : null;
  if (!allowed) {
    throw new Error('invalid table');
  }
  const { rows } = await db.getQuery()(
    `SELECT COUNT(*)::int AS c FROM store_checkouts
     WHERE status = 'awaiting_payment'
       AND lower(buyer) = lower($1)
       AND lower(pay_token_address) = lower($2)
       AND chain_id = $3
       AND amount_unique_units = $4::numeric
       AND created_at < $5
       AND id <> $6`,
    [buyer, payTokenAddress, chainId, String(amountUnits), createdAt, id]
  );
  return Number(rows[0]?.c || 0);
}

function slugify(title) {
  const base = String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || `section-${Date.now().toString(36)}`;
}

function mapSection(row) {
  if (!row) return null;
  return {
    id: row.id,
    parent_id: row.parent_id || null,
    title: row.title,
    slug: row.slug,
    description: row.description || '',
    sort_order: Number(row.sort_order || 0),
    active: Boolean(row.active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listSections({ activeOnly = false } = {}) {
  const { rows } = await db.getQuery()(
    activeOnly
      ? `SELECT * FROM store_sections WHERE active = TRUE ORDER BY sort_order ASC, title ASC`
      : `SELECT * FROM store_sections ORDER BY sort_order ASC, title ASC`
  );
  return rows.map(mapSection);
}

async function getSectionBySlug(slug) {
  const { rows } = await db.getQuery()(
    `SELECT * FROM store_sections WHERE slug = $1 LIMIT 1`,
    [String(slug)]
  );
  if (!rows[0] || !rows[0].active) {
    const err = new Error('Раздел не найден');
    err.status = 404;
    throw err;
  }
  return mapSection(rows[0]);
}

async function createSection(payload) {
  const title = String(payload.title || '').trim();
  if (!title) {
    const err = new Error('Укажите название раздела');
    err.status = 400;
    throw err;
  }
  let slug = String(payload.slug || '').trim() || slugify(title);
  slug = slugify(slug);
  const parent_id = payload.parent_id || null;
  const { rows } = await db.getQuery()(
    `INSERT INTO store_sections (parent_id, title, slug, description, sort_order, active)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      parent_id,
      title,
      slug,
      String(payload.description || ''),
      Number(payload.sort_order || 0) || 0,
      payload.active === false ? false : true,
    ]
  );
  return mapSection(rows[0]);
}

async function updateSection(id, payload) {
  const title = String(payload.title || '').trim();
  if (!title) {
    const err = new Error('Укажите название раздела');
    err.status = 400;
    throw err;
  }
  let slug = String(payload.slug || '').trim() || slugify(title);
  slug = slugify(slug);
  const { rows } = await db.getQuery()(
    `UPDATE store_sections SET
       parent_id = $2, title = $3, slug = $4, description = $5,
       sort_order = $6, active = $7, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [
      id,
      payload.parent_id || null,
      title,
      slug,
      String(payload.description || ''),
      Number(payload.sort_order || 0) || 0,
      payload.active === false ? false : true,
    ]
  );
  if (!rows[0]) {
    const err = new Error('Раздел не найден');
    err.status = 404;
    throw err;
  }
  return mapSection(rows[0]);
}

async function deleteSection(id) {
  await db.getQuery()(`DELETE FROM store_sections WHERE id = $1`, [id]);
  return { ok: true };
}

function mapCheckout(row, items = []) {
  if (!row) return null;
  return {
    id: row.id,
    buyer: row.buyer,
    user_id: row.user_id || null,
    status: row.status,
    pay_token_address: row.pay_token_address,
    pay_token_decimals: Number(row.pay_token_decimals),
    pay_token_symbol: row.pay_token_symbol || '',
    treasury_address: row.treasury_address,
    chain_id: Number(row.chain_id),
    sticker_units: String(row.sticker_units),
    amount_unique_units: String(row.amount_unique_units),
    amount_unique_human: fromUnits(row.amount_unique_units, row.pay_token_decimals),
    tail_units: String(row.tail_units),
    tx_hash: row.tx_hash || null,
    paid_at: row.paid_at || null,
    expires_at: row.expires_at || null,
    created_at: row.created_at,
    items,
  };
}

/**
 * items: [{ productId, qty }]
 * Один pay_token на весь checkout.
 */
async function createCheckout({ items, buyerAddress, userId }) {
  const settings = await getSettings();
  if (!settings.treasury_address || !settings.primary_chain_id || !settings.primary_dle_address) {
    const err = new Error('Магазин не настроен');
    err.status = 400;
    err.code = 'STORE_NOT_CONFIGURED';
    throw err;
  }
  const buyer = normalizeAddress(buyerAddress);
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    const err = new Error('Корзина пуста');
    err.status = 400;
    throw err;
  }

  const resolved = [];
  let payToken = null;
  let sticker = 0n;

  for (const raw of list) {
    const product = await getProduct(raw.productId || raw.product_id);
    if (!product.published) {
      const err = new Error(`Товар не опубликован: ${product.title}`);
      err.status = 400;
      throw err;
    }
    let qty = Math.max(1, Number(raw.qty || 1));
    if (qty > Number(product.max_qty || 1)) {
      const err = new Error(`Максимум ${product.max_qty} шт. для «${product.title}»`);
      err.status = 400;
      throw err;
    }
    const usedSlots = await countWalletSlots(null, product.id, buyer);
    if (usedSlots >= product.max_payments_per_wallet) {
      const err = new Error(`Лимит покупок для «${product.title}»`);
      err.status = 409;
      err.code = 'WALLET_LIMIT';
      throw err;
    }
    if (!payToken) payToken = product.pay_token_address;
    if (String(product.pay_token_address).toLowerCase() !== String(payToken).toLowerCase()) {
      const err = new Error('В одной оплате только один pay-токен. Разделите корзину.');
      err.status = 400;
      err.code = 'MIXED_PAY_TOKEN';
      throw err;
    }
    const unit = BigInt(product.price_units);
    const line = unit * BigInt(qty);
    sticker += line;
    const receiptEnabled = Boolean(product.receipt_enabled && product.license_token_address);
    resolved.push({
      product,
      qty,
      unit,
      line,
      receiptEnabled,
      licenseAmount: receiptEnabled
        ? (BigInt(product.license_amount_units || '0') * BigInt(qty)).toString()
        : null,
    });
  }

  const sample = resolved[0].product;
  const amountPay = sticker; // без хвоста: сумма = прайс корзины
  const ttl = Number(settings.order_ttl_minutes || 60);

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows: checkoutRows } = await client.query(
      `INSERT INTO store_checkouts (
         buyer, user_id, status,
         pay_token_address, pay_token_decimals, pay_token_symbol,
         treasury_address, chain_id,
         sticker_units, amount_unique_units, tail_units, expires_at
       ) VALUES (
         $1,$2,'awaiting_payment',
         $3,$4,$5,
         $6,$7,
         $8,$9,$10, NOW() + ($11 || ' minutes')::interval
       ) RETURNING *`,
      [
        buyer, userId || null,
        sample.pay_token_address, sample.pay_token_decimals, sample.pay_token_symbol,
        settings.treasury_address, settings.primary_chain_id,
        sticker.toString(), amountPay.toString(), PAY_TAIL_UNITS, String(ttl),
      ]
    );
    const checkout = checkoutRows[0];
    const itemMaps = [];

    for (let i = 0; i < resolved.length; i += 1) {
      const r = resolved[i];
      const { rows: orderRows } = await client.query(
        `INSERT INTO store_orders (
           product_id, buyer, user_id, status, product_title,
           price_units, pay_token_address, pay_token_decimals, pay_token_symbol,
           license_token_address, license_token_decimals, license_token_symbol, license_amount_units,
           qty, receipt_standard, receipt_erc1155_token_id, checkout_id,
           treasury_address, chain_id,
           sticker_units, amount_unique_units, tail_units, expires_at
         ) VALUES (
           $1,$2,$3,'awaiting_payment',$4,
           $5,$6,$7,$8,
           $9,$10,$11,$12,
           $13,$14,$15,$16,
           $17,$18,
           $19,$20,$21, $22
         ) RETURNING *`,
        [
          r.product.id, buyer, userId || null, r.product.title,
          r.line.toString(), r.product.pay_token_address, r.product.pay_token_decimals, r.product.pay_token_symbol,
          r.receiptEnabled ? r.product.license_token_address : null,
          r.receiptEnabled ? r.product.license_token_decimals : null,
          r.receiptEnabled ? r.product.license_token_symbol : '',
          r.licenseAmount,
          r.qty,
          r.receiptEnabled ? (r.product.receipt_standard || 'erc20') : null,
          r.receiptEnabled && String(r.product.receipt_standard || '').toLowerCase() === 'erc1155'
            ? (r.product.receipt_erc1155_token_id ?? null)
            : null,
          checkout.id,
          settings.treasury_address, settings.primary_chain_id,
          r.line.toString(), r.line.toString(), PAY_TAIL_UNITS, checkout.expires_at,
        ]
      );
      const order = orderRows[0];
      await client.query(
        `INSERT INTO store_checkout_items (
           checkout_id, product_id, order_id, qty, product_title,
           unit_price_units, line_price_units, pay_token_address,
           receipt_enabled, receipt_standard,
           license_token_address, license_token_decimals, license_token_symbol, license_amount_units,
           sort_order
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          checkout.id, r.product.id, order.id, r.qty, r.product.title,
          r.unit.toString(), r.line.toString(), r.product.pay_token_address,
          r.receiptEnabled, r.receiptEnabled ? (r.product.receipt_standard || 'erc20') : null,
          r.receiptEnabled ? r.product.license_token_address : null,
          r.receiptEnabled ? r.product.license_token_decimals : null,
          r.receiptEnabled ? r.product.license_token_symbol : '',
          r.licenseAmount,
          i,
        ]
      );
      itemMaps.push({
        product_id: r.product.id,
        order_id: order.id,
        qty: r.qty,
        product_title: r.product.title,
        line_price_units: r.line.toString(),
      });
    }

    await client.query('COMMIT');
    return mapCheckout(checkout, itemMaps);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw error;
  } finally {
    client.release();
  }
}

async function getCheckout(id) {
  const { rows } = await db.getQuery()(`SELECT * FROM store_checkouts WHERE id = $1`, [id]);
  if (!rows[0]) {
    const err = new Error('Checkout не найден');
    err.status = 404;
    throw err;
  }
  const { rows: items } = await db.getQuery()(
    `SELECT * FROM store_checkout_items WHERE checkout_id = $1 ORDER BY sort_order ASC`,
    [id]
  );
  return mapCheckout(rows[0], items.map((it) => ({
    id: it.id,
    product_id: it.product_id,
    order_id: it.order_id,
    qty: Number(it.qty),
    product_title: it.product_title,
    line_price_units: String(it.line_price_units),
    receipt_enabled: Boolean(it.receipt_enabled),
  })));
}

async function listCheckoutsCrm() {
  const { rows } = await db.getQuery()(
    `SELECT * FROM store_checkouts ORDER BY created_at DESC LIMIT 200`
  );
  const out = [];
  for (const row of rows) {
    out.push(await getCheckout(row.id));
  }
  return out;
}

function parseTransferFrom(log) {
  const base = parseTransferLog(log);
  if (!base) return null;
  const from = log.topics && log.topics[1]
    ? ethers.getAddress(ethers.dataSlice(log.topics[1], 12))
    : null;
  return { ...base, from, logIndex: log.index != null ? Number(log.index) : null };
}

async function checkCheckoutPayment(checkoutId, { txHashHint = null } = {}) {
  const checkout = await getCheckout(checkoutId);
  if (checkout.status === 'paid') return checkout;
  if (checkout.status !== 'awaiting_payment') return checkout;

  const url = await rpcProviderService.getRpcUrlByChainId(Number(checkout.chain_id));
  if (!url) {
    const err = new Error('Нет RPC');
    err.status = 400;
    throw err;
  }
  const provider = new ethers.JsonRpcProvider(url, Number(checkout.chain_id));
  const currentBlock = await provider.getBlockNumber();
  const logs = await provider.getLogs({
    address: checkout.pay_token_address,
    fromBlock: Math.max(currentBlock - 8000, 0),
    toBlock: currentBlock,
    topics: [TRANSFER_TOPIC, null, transferToTopic(checkout.treasury_address)],
  });
  const want = BigInt(checkout.amount_unique_units || checkout.sticker_units);
  const buyer = String(checkout.buyer).toLowerCase();
  const treasury = String(checkout.treasury_address).toLowerCase();
  const usedTx = await listUsedPayTxHashes({
    chainId: checkout.chain_id,
    payTokenAddress: checkout.pay_token_address,
  });
  const older = await countOlderAwaitingSameAmount({
    table: 'store_checkouts',
    id: checkout.id,
    buyer: checkout.buyer,
    payTokenAddress: checkout.pay_token_address,
    chainId: checkout.chain_id,
    amountUnits: want.toString(),
    createdAt: checkout.created_at,
  });

  const candidates = [];
  for (const log of logs) {
    if (txHashHint && String(log.transactionHash).toLowerCase() !== String(txHashHint).toLowerCase()) continue;
    const parsed = parseTransferFrom(log);
    if (!parsed || parsed.value !== want) continue;
    if (String(parsed.to || '').toLowerCase() !== treasury) continue;
    if (String(parsed.from || '').toLowerCase() !== buyer) continue;
    const h = String(parsed.txHash || '').toLowerCase();
    if (h && usedTx.has(h)) continue;
    candidates.push(parsed);
  }
  // старейшие логи → старейшие заявки
  candidates.sort((a, b) => {
    const ba = Number(a.blockNumber || 0) - Number(b.blockNumber || 0);
    if (ba !== 0) return ba;
    return Number(a.logIndex || 0) - Number(b.logIndex || 0);
  });
  const matched = candidates[older] || null;
  if (!matched) return checkout;

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows: locked } = await client.query(
      `SELECT * FROM store_checkouts WHERE id = $1 FOR UPDATE`,
      [checkoutId]
    );
    if (!locked[0] || locked[0].status !== 'awaiting_payment') {
      await client.query('COMMIT');
      return getCheckout(checkoutId);
    }
    const { rows: replay } = await client.query(
      `SELECT id FROM store_checkouts WHERE lower(tx_hash) = lower($1) AND id <> $2
       UNION ALL
       SELECT id FROM store_orders WHERE lower(tx_hash) = lower($1)`,
      [matched.txHash, checkoutId]
    );
    if (replay.length) {
      await client.query('COMMIT');
      return checkout;
    }
    await client.query(
      `UPDATE store_checkouts
       SET status = 'paid', tx_hash = $2, tx_log_index = $3, paid_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [checkoutId, matched.txHash, matched.logIndex]
    );
    await client.query(
      `UPDATE store_orders
       SET status = 'paid', tx_hash = $2, tx_log_index = $3, paid_at = NOW(), updated_at = NOW()
       WHERE checkout_id = $1 AND status = 'awaiting_payment'`,
      [checkoutId, matched.txHash, matched.logIndex]
    );
    await client.query('COMMIT');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
  return getCheckout(checkoutId);
}

module.exports = {
  listSections,
  getSectionBySlug,
  createSection,
  updateSection,
  deleteSection,
  createCheckout,
  getCheckout,
  listCheckoutsCrm,
  checkCheckoutPayment,
  mapSection,
};
