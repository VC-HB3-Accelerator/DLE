/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * ERC-20 transfer с кошелька покупателя на казну (оплата магазина).
 * Нативная монета (address(0)) для оплаты магазина не поддерживается (ТЗ: pay = ERC-20).
 */

import { ethers } from 'ethers';
import { switchNetwork } from './networkSwitcher';

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
];

export function isNativePayToken(tokenAddress) {
  if (!tokenAddress) return true;
  try {
    return ethers.getAddress(tokenAddress) === ethers.ZeroAddress;
  } catch {
    return false;
  }
}

function checksumAddr(value) {
  try {
    const s = String(value || '').trim();
    if (!s) return '';
    return ethers.getAddress(s);
  } catch {
    return '';
  }
}

/** Адреса кошелька: сессия SIWE и/или привязанный идентификатор. */
export function collectWalletAddresses(sessionAddress, identities = []) {
  const out = [];
  const add = (value) => {
    const addr = checksumAddr(value);
    if (addr && !out.includes(addr)) out.push(addr);
  };
  add(sessionAddress);
  for (const row of identities || []) {
    if (String(row?.provider || '').toLowerCase() !== 'wallet') continue;
    add(row.provider_id || row.value || row.providerId);
  }
  return out;
}

/** Кнопка оплаты: есть кошелёк, и он совпадает с buyer заявки (если buyer уже известен). */
export function hasWalletForPay({ sessionAddress, identities, buyer } = {}) {
  const wallets = collectWalletAddresses(sessionAddress, identities);
  if (!wallets.length) return false;
  const buyerAddr = checksumAddr(buyer);
  if (!buyerAddr) return true;
  return wallets.includes(buyerAddr);
}

/**
 * @param {{
 *   tokenAddress: string,
 *   to: string,
 *   amountUnits: string|bigint,
 *   expectedFrom?: string,
 *   chainId?: number|null,
 * }} opts
 * @returns {Promise<{ hash: string }>}
 */
export async function transferErc20FromWallet({
  tokenAddress,
  to,
  amountUnits,
  expectedFrom = null,
  chainId = null,
}) {
  if (typeof window === 'undefined' || !window.ethereum) {
    const err = new Error('Кошелёк не найден. Откройте MetaMask или другой web3-кошелёк.');
    err.code = 'NO_WALLET';
    throw err;
  }
  if (isNativePayToken(tokenAddress)) {
    const err = new Error(
      'Оплата магазина только ERC-20. В заявке указана нативная монета (адрес 0x0) — исправьте токен оплаты в карточке товара и создайте оплату заново.'
    );
    err.code = 'NATIVE_PAY_UNSUPPORTED';
    throw err;
  }
  if (!ethers.isAddress(to) || to === ethers.ZeroAddress) {
    const err = new Error('Некорректный адрес казны для оплаты');
    err.code = 'BAD_TREASURY';
    throw err;
  }

  const wantChain = chainId != null && Number(chainId) > 0 ? Number(chainId) : null;
  if (wantChain) {
    const switched = await switchNetwork(wantChain);
    if (!switched?.success) {
      const err = new Error(switched?.message || `Не удалось переключить сеть на ${wantChain}`);
      err.code = 'CHAIN_SWITCH_FAILED';
      throw err;
    }
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send('eth_requestAccounts', []);
  const signer = await provider.getSigner();
  const from = await signer.getAddress();
  if (expectedFrom && String(from).toLowerCase() !== String(expectedFrom).toLowerCase()) {
    const err = new Error(
      `В кошельке другой адрес (${from}). Нужен ${expectedFrom}`
    );
    err.code = 'WALLET_MISMATCH';
    throw err;
  }

  if (wantChain) {
    const net = await provider.getNetwork();
    if (Number(net.chainId) !== wantChain) {
      const err = new Error(`Кошелёк не в сети ${wantChain}. Переключите сеть и повторите.`);
      err.code = 'WRONG_CHAIN';
      throw err;
    }
  }

  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const amount = BigInt(String(amountUnits));
  if (amount <= 0n) {
    const err = new Error('Сумма оплаты должна быть больше нуля');
    err.code = 'BAD_AMOUNT';
    throw err;
  }
  let balance;
  try {
    balance = await token.balanceOf(from);
  } catch (e) {
    const err = new Error(
      `Не удалось прочитать баланс токена оплаты (${tokenAddress}). Проверьте, что это ERC-20 в нужной сети.`
    );
    err.code = 'TOKEN_READ_FAIL';
    err.cause = e;
    throw err;
  }
  if (balance < amount) {
    const err = new Error('Недостаточно токенов на кошельке для оплаты');
    err.code = 'INSUFFICIENT_BALANCE';
    throw err;
  }
  const tx = await token.transfer(to, amount);
  const receipt = await tx.wait();
  return { hash: receipt?.hash || tx.hash };
}

export function formatStoreAmount(units, decimals) {
  try {
    return ethers.formatUnits(String(units || '0'), Number(decimals || 0));
  } catch {
    return String(units || '0');
  }
}
