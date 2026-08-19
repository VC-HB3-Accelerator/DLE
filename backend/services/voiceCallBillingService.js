/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const crypto = require('crypto');
const { ethers } = require('ethers');
const db = require('../db');
const logger = require('../utils/logger');
const rpcProviderService = require('./rpcProviderService');
const settingsService = require('./voiceCallSettingsService');
const { ensureVoiceCallSchema } = require('./voiceCallSchema');
const { ownerKey } = require('./voiceCallOwner');
const {
  TRANSFER_TOPIC,
  TAIL_WINDOW_MS,
  toUnits,
  fromUnits,
  pickTail,
  computeAmountUnique,
  buildEip681,
  transferToTopic,
  parseTransferLog
} = require('./voiceCallAmount');

function mapInvoice(row, settings) {
  if (!row) return null;
  const decimals = Number(row.token_decimals);
  return {
    id: row.id,
    status: row.status,
    package_id: row.package_id,
    minutes: Number(row.minutes),
    token_symbol: row.token_symbol,
    token_address: row.token_address,
    token_decimals: decimals,
    chain_id: Number(row.chain_id),
    pay_to_address: row.pay_to_address,
    sticker: fromUnits(row.sticker_units, decimals),
    amount_unique: fromUnits(row.amount_unique_units, decimals),
    amount_unique_units: String(row.amount_unique_units),
    tx_hash: row.tx_hash || null,
    expires_at: row.expires_at,
    paid_at: row.paid_at,
    eip681: row.token_address && row.pay_to_address
      ? buildEip681({
        tokenAddress: row.token_address,
        chainId: row.chain_id,
        payTo: row.pay_to_address,
        amountUnits: row.amount_unique_units
      })
      : null,
    confirmations: settings?.confirmations || 3
  };
}

async function usedTails({ chainId, tokenAddress, payTo, createdAfter }) {
  const { rows } = await db.getQuery()(
    `SELECT tail_units
     FROM ai_call_invoices
     WHERE chain_id = $1
       AND lower(token_address) = lower($2)
       AND lower(pay_to_address) = lower($3)
       AND status IN ('pending', 'confirming')
       AND created_at >= $4`,
    [chainId, tokenAddress, payTo, createdAfter]
  );
  return rows.map((r) => BigInt(r.tail_units));
}

async function createInvoice(owner, packageId) {
  await ensureVoiceCallSchema();
  const settings = await settingsService.getSettings();
  if (!settings.enabled) {
    const err = new Error('Звонки выключены');
    err.status = 403;
    err.code = 'CALLS_DISABLED';
    throw err;
  }
  const pkg = settingsService.findPackage(settings, packageId);
  if (!pkg) {
    const err = new Error('Пакет не найден');
    err.status = 400;
    err.code = 'PACKAGE_NOT_FOUND';
    throw err;
  }
  if (!settingsService.packageNeedsPayment(settings, pkg)) {
    const err = new Error('Этот пакет бесплатный, оплата не нужна');
    err.status = 400;
    err.code = 'PACKAGE_FREE';
    throw err;
  }

  const stickerUnits = toUnits(pkg.price, settings.token_decimals);
  if (stickerUnits <= 0n) {
    const err = new Error('У пакета нулевая цена');
    err.status = 400;
    err.code = 'PACKAGE_FREE';
    throw err;
  }

  const windowStart = new Date(Date.now() - TAIL_WINDOW_MS);
  const ttlMin = Math.max(settings.invoice_ttl_minutes, 15);
  let lastErr = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const tailsNow = await usedTails({
      chainId: settings.chain_id,
      tokenAddress: settings.token_address,
      payTo: settings.pay_to_address,
      createdAfter: windowStart
    });
    const tail = pickTail(stickerUnits, tailsNow);
    const amountUnique = computeAmountUnique(stickerUnits, tail);
    const id = crypto.randomUUID();
    try {
      const { rows } = await db.getQuery()(
        `INSERT INTO ai_call_invoices (
           id, owner_type, owner_user_id, owner_guest_id,
           package_id, minutes, sticker_units, amount_unique_units, tail_units,
           token_symbol, token_address, token_decimals, chain_id, pay_to_address,
           status, expires_at
         ) VALUES (
           $1, $2, $3, $4,
           $5, $6, $7, $8, $9,
           $10, $11, $12, $13, $14,
           'pending', NOW() + ($15 || ' minutes')::interval
         )
         RETURNING *`,
        [
          id,
          owner.ownerType,
          owner.ownerUserId,
          owner.ownerGuestId,
          pkg.id,
          pkg.minutes,
          stickerUnits.toString(),
          amountUnique.toString(),
          tail.toString(),
          settings.token_symbol,
          settings.token_address,
          settings.token_decimals,
          settings.chain_id,
          settings.pay_to_address,
          String(ttlMin)
        ]
      );
      return mapInvoice(rows[0], settings);
    } catch (error) {
      lastErr = error;
      if (!String(error.message || '').includes('ai_call_invoices_amount_window_uidx')) throw error;
    }
  }
  throw lastErr;
}

async function getInvoice(id, owner) {
  await ensureVoiceCallSchema();
  const { rows } = await db.getQuery()(`SELECT * FROM ai_call_invoices WHERE id = $1`, [id]);
  const row = rows[0];
  if (!row) {
    const err = new Error('Счёт не найден');
    err.status = 404;
    err.code = 'INVOICE_NOT_FOUND';
    throw err;
  }
  if (owner && row.owner_type === 'user' && Number(row.owner_user_id) !== Number(owner.ownerUserId)) {
    const err = new Error('Нет доступа к счёту');
    err.status = 403;
    err.code = 'INVOICE_FORBIDDEN';
    throw err;
  }
  if (owner && row.owner_type === 'guest' && String(row.owner_guest_id) !== String(owner.ownerGuestId || '')) {
    const err = new Error('Нет доступа к счёту');
    err.status = 403;
    err.code = 'INVOICE_FORBIDDEN';
    throw err;
  }
  const settings = await settingsService.getSettings();
  return { row, invoice: mapInvoice(row, settings), settings };
}

async function getProvider(chainId) {
  const url = await rpcProviderService.getRpcUrlByChainId(Number(chainId));
  if (!url) {
    const err = new Error('Для этой сети нет RPC. Добавьте его в таблицу провайдеров.');
    err.status = 400;
    err.code = 'RPC_MISSING';
    throw err;
  }
  return new ethers.JsonRpcProvider(url, Number(chainId));
}

async function markPaid(row, txHash) {
  const { rows } = await db.getQuery()(
    `UPDATE ai_call_invoices
     SET status = 'paid', tx_hash = $2, paid_at = COALESCE(paid_at, NOW()), updated_at = NOW()
     WHERE id = $1 AND status IN ('pending', 'confirming')
       AND (tx_hash IS NULL OR tx_hash = $2)
     RETURNING *`,
    [row.id, txHash]
  );
  if (!rows[0]) return row;
  await addCreditSeconds({
    ownerType: rows[0].owner_type,
    ownerUserId: rows[0].owner_user_id,
    ownerGuestId: rows[0].owner_guest_id
  }, Number(rows[0].minutes) * 60);
  return rows[0];
}

async function checkInvoice(id, owner) {
  const { row, settings } = await getInvoice(id, owner);
  if (row.status === 'paid') {
    return mapInvoice(row, settings);
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.getQuery()(
      `UPDATE ai_call_invoices SET status = 'expired', updated_at = NOW()
       WHERE id = $1 AND status IN ('pending', 'confirming')`,
      [row.id]
    );
    return mapInvoice({ ...row, status: 'expired' }, settings);
  }

  const provider = await getProvider(row.chain_id);
  const currentBlock = await provider.getBlockNumber();
  const lookback = Math.max(currentBlock - 5000, 0);
  const logs = await provider.getLogs({
    address: row.token_address,
    fromBlock: lookback,
    toBlock: currentBlock,
    topics: [TRANSFER_TOPIC, null, transferToTopic(row.pay_to_address)]
  });

  const want = BigInt(row.amount_unique_units);
  let matched = null;
  for (const log of logs) {
    const parsed = parseTransferLog(log);
    if (!parsed || parsed.value !== want) continue;
    if (String(parsed.to).toLowerCase() !== String(row.pay_to_address).toLowerCase()) continue;
    matched = parsed;
    break;
  }

  if (!matched) {
    return mapInvoice(row, settings);
  }

  const { rows: replay } = await db.getQuery()(
    `SELECT id FROM ai_call_invoices WHERE tx_hash = $1 AND id <> $2`,
    [matched.txHash, row.id]
  );
  if (replay.length) {
    await db.getQuery()(
      `UPDATE ai_call_invoices SET status = 'mismatched', updated_at = NOW() WHERE id = $1 AND status IN ('pending','confirming')`,
      [row.id]
    );
    const err = new Error('Эта транзакция уже привязана к другому счёту');
    err.status = 409;
    err.code = 'TX_REPLAY';
    throw err;
  }

  const conf = currentBlock - Number(matched.blockNumber || 0);
  if (conf < Number(settings.confirmations || 3)) {
    await db.getQuery()(
      `UPDATE ai_call_invoices
       SET status = 'confirming', tx_hash = $2, updated_at = NOW()
       WHERE id = $1 AND status IN ('pending', 'confirming')`,
      [row.id, matched.txHash]
    );
    return mapInvoice({ ...row, status: 'confirming', tx_hash: matched.txHash }, settings);
  }

  const paid = await markPaid(row, matched.txHash);
  return mapInvoice(paid, settings);
}

async function addCreditSeconds(owner, seconds) {
  await ensureVoiceCallSchema();
  const key = ownerKey(owner);
  const add = Math.max(0, Number(seconds) || 0);
  if (!key || !add) return getCredits(owner);
  await db.getQuery()(
    `INSERT INTO ai_call_credits (owner_key, owner_type, owner_user_id, owner_guest_id, seconds_remaining, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (owner_key) DO UPDATE SET
       seconds_remaining = ai_call_credits.seconds_remaining + EXCLUDED.seconds_remaining,
       updated_at = NOW()`,
    [key, owner.ownerType || owner.owner_type, owner.ownerUserId || owner.owner_user_id || null, owner.ownerGuestId || owner.owner_guest_id || null, add]
  );
  return getCredits(owner);
}

async function getCredits(owner) {
  await ensureVoiceCallSchema();
  const key = ownerKey(owner);
  if (!key) return { seconds_remaining: 0 };
  const { rows } = await db.getQuery()(
    `SELECT seconds_remaining FROM ai_call_credits WHERE owner_key = $1`,
    [key]
  );
  return { seconds_remaining: Number(rows[0]?.seconds_remaining || 0) };
}

async function debitCredit(owner, seconds) {
  await ensureVoiceCallSchema();
  const key = ownerKey(owner);
  const need = Math.max(0, Number(seconds) || 0);
  if (!key || !need) {
    const err = new Error('Нечего списывать');
    err.status = 400;
    throw err;
  }
  const { rows } = await db.getQuery()(
    `UPDATE ai_call_credits
     SET seconds_remaining = seconds_remaining - $2, updated_at = NOW()
     WHERE owner_key = $1 AND seconds_remaining >= $2
     RETURNING seconds_remaining`,
    [key, need]
  );
  if (!rows[0]) {
    const err = new Error('Недостаточно оплаченных минут');
    err.status = 403;
    err.code = 'CALL_PAYMENT_REQUIRED';
    throw err;
  }
  return { seconds_remaining: Number(rows[0].seconds_remaining) };
}

async function grantFreePackage(owner, minutes) {
  return addCreditSeconds(owner, Number(minutes) * 60);
}

async function mergeGuestToUser(guestId, userId) {
  if (!guestId || !userId) return;
  await ensureVoiceCallSchema();
  const guestKey = ownerKey({ ownerType: 'guest', ownerGuestId: guestId });
  const userKey = ownerKey({ ownerType: 'user', ownerUserId: userId });
  const client = await db.getQuery();
  await client(
    `UPDATE ai_call_invoices
     SET owner_type = 'user', owner_user_id = $2, owner_guest_id = NULL, updated_at = NOW()
     WHERE owner_type = 'guest' AND owner_guest_id = $1`,
    [String(guestId), Number(userId)]
  );
  const { rows } = await client(
    `SELECT seconds_remaining FROM ai_call_credits WHERE owner_key = $1`,
    [guestKey]
  );
  const seconds = Number(rows[0]?.seconds_remaining || 0);
  if (seconds > 0) {
    await addCreditSeconds({ ownerType: 'user', ownerUserId: userId }, seconds);
    await client(`DELETE FROM ai_call_credits WHERE owner_key = $1`, [guestKey]);
  }
  await client(
    `UPDATE ai_call_sessions
     SET owner_type = 'user', owner_user_id = $2, owner_guest_id = NULL, updated_at = NOW()
     WHERE owner_type = 'guest' AND owner_guest_id = $1 AND status IN ('ready','connecting','live')`,
    [String(guestId), Number(userId)]
  );
  logger.info(`[voiceCall] merged guest ${guestId} -> user ${userId}`);
}

module.exports = {
  createInvoice,
  getInvoice,
  checkInvoice,
  mapInvoice,
  addCreditSeconds,
  getCredits,
  debitCredit,
  grantFreePackage,
  mergeGuestToUser
};
