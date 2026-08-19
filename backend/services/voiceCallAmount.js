/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Уникальная сумма инвойса без memo: amount_unique = sticker - tail.
 * Токен и decimals приходят из настроек узла, не зашиты как USDT.
 */

const { ethers } = require('ethers');

const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const TAIL_WINDOW_MS = 15 * 60 * 1000;
const MIN_TAIL = 1n;

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return n;
}

function normalizeDecimals(decimals) {
  const n = parsePositiveInt(decimals, 6);
  if (n < 0 || n > 18) {
    const err = new Error('Некорректное число знаков токена');
    err.code = 'INVALID_TOKEN_DECIMALS';
    throw err;
  }
  return n;
}

function toUnits(amount, decimals) {
  const dec = normalizeDecimals(decimals);
  try {
    const units = ethers.parseUnits(String(amount ?? '0').trim() || '0', dec);
    if (units < 0n) {
      const err = new Error('Сумма не может быть отрицательной');
      err.code = 'INVALID_AMOUNT';
      throw err;
    }
    return units;
  } catch (error) {
    if (error.code) throw error;
    const err = new Error('Некорректная сумма тарифа');
    err.code = 'INVALID_AMOUNT';
    throw err;
  }
}

function fromUnits(units, decimals) {
  return ethers.formatUnits(BigInt(units), normalizeDecimals(decimals));
}

function maxTail(stickerUnits) {
  const sticker = BigInt(stickerUnits);
  if (sticker <= 0n) return 0n;
  const tenPercent = sticker / 10n;
  const cap = tenPercent > 0n ? tenPercent : 1n;
  const sixDigits = 999999n;
  return cap < sixDigits ? cap : sixDigits;
}

function pickTail(stickerUnits, usedTails, randomFn = Math.random) {
  const sticker = BigInt(stickerUnits);
  const max = maxTail(sticker);
  if (sticker <= 0n || max < MIN_TAIL) return MIN_TAIL;
  const used = new Set((usedTails || []).map((v) => BigInt(v).toString()));
  for (let i = 0; i < 80; i += 1) {
    const span = Number(max);
    const raw = Math.floor(randomFn() * span) + 1;
    const tail = BigInt(Math.min(Math.max(raw, 1), span));
    if (!used.has(tail.toString())) return tail;
  }
  for (let tail = MIN_TAIL; tail <= max; tail += 1n) {
    if (!used.has(tail.toString())) return tail;
  }
  const err = new Error('Не удалось подобрать уникальную сумму');
  err.code = 'TAIL_EXHAUSTED';
  throw err;
}

function computeAmountUnique(stickerUnits, tail) {
  const sticker = BigInt(stickerUnits);
  const t = BigInt(tail);
  if (t < MIN_TAIL) {
    const err = new Error('Хвост суммы должен быть больше нуля');
    err.code = 'INVALID_TAIL';
    throw err;
  }
  if (t >= sticker) {
    const err = new Error('Хвост не может быть больше тарифа');
    err.code = 'INVALID_TAIL';
    throw err;
  }
  const unique = sticker - t;
  if (unique * 10n < sticker * 9n) {
    const err = new Error('Уникальная сумма слишком далеко от тарифа');
    err.code = 'AMOUNT_TOO_LOW';
    throw err;
  }
  if (unique > sticker) {
    const err = new Error('Клиент не должен платить больше тарифа');
    err.code = 'AMOUNT_ABOVE_STICKER';
    throw err;
  }
  return unique;
}

function buildEip681({ tokenAddress, chainId, payTo, amountUnits }) {
  const token = ethers.getAddress(tokenAddress);
  const to = ethers.getAddress(payTo);
  const chain = parsePositiveInt(chainId, 0);
  if (!chain) {
    const err = new Error('Не указана сеть оплаты');
    err.code = 'CHAIN_REQUIRED';
    throw err;
  }
  return `ethereum:${token}@${chain}/transfer?address=${to}&uint256=${BigInt(amountUnits).toString()}`;
}

function transferToTopic(payTo) {
  return ethers.zeroPadValue(ethers.getAddress(payTo), 32);
}

function parseTransferLog(log) {
  if (!log) return null;
  const to = log.topics && log.topics[2]
    ? ethers.getAddress(ethers.dataSlice(log.topics[2], 12))
    : null;
  const value = log.data ? BigInt(log.data) : 0n;
  return {
    txHash: log.transactionHash || null,
    to,
    value,
    blockNumber: log.blockNumber != null ? Number(log.blockNumber) : null
  };
}

module.exports = {
  TRANSFER_TOPIC,
  TAIL_WINDOW_MS,
  toUnits,
  fromUnits,
  normalizeDecimals,
  maxTail,
  pickTail,
  computeAmountUnique,
  buildEip681,
  transferToTopic,
  parseTransferLog
};
