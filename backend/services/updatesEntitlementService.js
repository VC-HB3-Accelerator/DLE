/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Entitlement обновлений ОС (hub HB3):
 * license ERC-20 из auth_tokens на балансе TreasuryModule клиентского DLE.
 * См. docs.ru/tz-updates-license-check.ru.md
 */

const { ethers } = require('ethers');
const logger = require('../utils/logger');
const authTokenService = require('./authTokenService');
const rpcProviderService = require('./rpcProviderService');
const updatesHubSettingsService = require('./updatesHubSettingsService');
const updatesEntitlementAuditService = require('./updatesEntitlementAuditService');
const { MODULE_IDS } = require('../constants/moduleIds');

const ZERO = ethers.ZeroAddress;
const TOKEN_DECIMALS = 18;
const RPC_TIMEOUT_MS = Number(process.env.UPDATES_ENTITLEMENT_RPC_TIMEOUT_MS || 10000);
const RPC_RETRIES = Math.max(1, Number(process.env.UPDATES_ENTITLEMENT_RPC_RETRIES || 2));
const CACHE_TTL_MS = Number(process.env.UPDATES_ENTITLEMENT_CACHE_TTL_MS || 45000);

const DLE_ABI = [
  'function getModuleAddress(bytes32 _moduleId) external view returns (address)',
];
const ERC20_ABI = ['function balanceOf(address owner) view returns (uint256)'];

/** @type {Map<string, { expiresAt: number, value: object }>} */
const entitlementCache = new Map();

function normalizeDleContract(dleContract) {
  return String(dleContract || '').trim().toLowerCase();
}

function isValidAddress(value) {
  return /^0x[a-f0-9]{40}$/.test(String(value || '').trim().toLowerCase());
}

function deny(reason, details = {}) {
  logger.warn('updates.entitlement.deny', { reason, ...details });
  const err = new Error('Not entitled to updates');
  err.status = 403;
  err.code = reason;
  err.details = details;
  return err;
}

function withTimeout(promise, ms, label = 'RPC') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function withRetries(fn, retries = RPC_RETRIES) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      logger.warn(
        `[updates/entitlement] RPC attempt ${attempt}/${retries} failed: ${error.message}`
      );
    }
  }
  throw lastError;
}

function createProvider(rpcUrl) {
  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
    polling: false,
    staticNetwork: true,
  });
  try {
    provider._getConnection().timeout = RPC_TIMEOUT_MS;
  } catch {
    // ignore — не все версии ethers дают _getConnection
  }
  return provider;
}

async function buildNetworkMap() {
  const providers = await rpcProviderService.getAllRpcProviders();
  const networkToChainId = {};
  for (const provider of providers) {
    if (provider.network_id != null && provider.chain_id != null) {
      networkToChainId[String(provider.network_id)] = Number(provider.chain_id);
    }
  }
  return networkToChainId;
}

async function resolveTreasuryAddress(dleContract, chainId) {
  const rpcUrl = await rpcProviderService.getRpcUrlByChainId(chainId);
  if (!rpcUrl) {
    const err = new Error(`RPC URL missing for chainId ${chainId}`);
    err.code = 'rpc_error';
    throw err;
  }

  return withRetries(async () => {
    const provider = createProvider(rpcUrl);
    const dle = new ethers.Contract(dleContract, DLE_ABI, provider);
    const treasury = await withTimeout(
      dle.getModuleAddress(MODULE_IDS.TREASURY),
      RPC_TIMEOUT_MS,
      'getModuleAddress'
    );
    return String(treasury);
  });
}

function parseMinBalanceWei(minBalance) {
  const raw = minBalance == null || minBalance === '' ? '0' : String(minBalance);
  try {
    return ethers.parseUnits(raw, TOKEN_DECIMALS);
  } catch {
    // уже целое wei без точки
    return BigInt(raw.split('.')[0] || '0');
  }
}

async function readTokenBalance(tokenAddress, holder, chainId) {
  const rpcUrl = await rpcProviderService.getRpcUrlByChainId(chainId);
  if (!rpcUrl) {
    const err = new Error(`RPC URL missing for chainId ${chainId}`);
    err.code = 'rpc_error';
    throw err;
  }

  return withRetries(async () => {
    const provider = createProvider(rpcUrl);
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await withTimeout(
      token.balanceOf(holder),
      RPC_TIMEOUT_MS,
      'balanceOf'
    );
    return BigInt(balance.toString());
  });
}

function cacheGet(key) {
  const hit = entitlementCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    entitlementCache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  if (!CACHE_TTL_MS || CACHE_TTL_MS <= 0) return;
  entitlementCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function clearEntitlementCache() {
  entitlementCache.clear();
}

function shouldCacheDeny(reason) {
  // rpc_error часто транзиентный — не кэшируем отказ
  return reason && reason !== 'rpc_error';
}

async function writeAudit(entry, deps) {
  const record = deps.recordAudit || updatesEntitlementAuditService.recordEntitlementAudit;
  try {
    await record(entry);
  } catch (error) {
    logger.warn(`[updates/entitlement] audit skipped: ${error.message}`);
  }
}

/**
 * Проверка права на скачивание update-pack.
 * @param {object} params
 * @param {object} [deps] — инъекции для тестов
 * @returns {{ stub?: boolean, ok?: boolean, dleContract: string, treasury?: string, token?: string, network?: string, balance?: string, minBalance?: string }}
 */
async function assertEntitled(
  { dleContract, userId = null, walletAddress = null, requestId = null },
  deps = {}
) {
  const getSettings = deps.getSettings || (() => updatesHubSettingsService.getSettings());
  const getAllAuthTokens = deps.getAllAuthTokens || (() => authTokenService.getAllAuthTokens());
  const getNetworkMap = deps.buildNetworkMap || buildNetworkMap;
  const resolveTreasury = deps.resolveTreasuryAddress || resolveTreasuryAddress;
  const readBalance = deps.readTokenBalance || readTokenBalance;

  const contract = normalizeDleContract(dleContract);
  if (!isValidAddress(contract)) {
    const err = new Error('Invalid dleContract');
    err.status = 400;
    err.code = 'invalid_dle';
    logger.warn('updates.entitlement.deny', { reason: 'invalid_dle', dleContract });
    await writeAudit({
      dleContract: contract || String(dleContract || ''),
      result: 'deny',
      reason: 'invalid_dle',
      userId,
      walletAddress,
      requestId,
    }, deps);
    throw err;
  }

  const hubSettings = await getSettings();
  if (hubSettings.stub_mode) {
    logger.warn('updates.entitlement.stub', {
      dleContract: contract,
      userId,
      walletAddress,
    });
    await writeAudit({
      dleContract: contract,
      result: 'stub',
      reason: 'stub_mode',
      userId,
      walletAddress,
      requestId,
    }, deps);
    return { stub: true, dleContract: contract, userId, walletAddress };
  }

  const cacheKey = `entitled:${contract}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    if (cached.ok) {
      await writeAudit({
        dleContract: contract,
        result: 'ok',
        reason: 'cache_hit',
        tokenAddress: cached.token,
        treasuryAddress: cached.treasury,
        chainId: cached.chainId,
        network: cached.network,
        balance: cached.balance,
        minBalance: cached.minBalance,
        userId,
        walletAddress,
        requestId,
      }, deps);
      return cached;
    }
    await writeAudit({
      dleContract: contract,
      result: 'deny',
      reason: cached.reason || 'below_min',
      userId,
      walletAddress,
      requestId,
    }, deps);
    throw deny(cached.reason || 'below_min', {
      dleContract: contract,
      cached: true,
    });
  }

  const tokens = await getAllAuthTokens();
  if (!tokens.length) {
    cacheSet(cacheKey, { ok: false, reason: 'no_auth_tokens' });
    await writeAudit({
      dleContract: contract,
      result: 'deny',
      reason: 'no_auth_tokens',
      userId,
      walletAddress,
      requestId,
    }, deps);
    throw deny('no_auth_tokens', { dleContract: contract });
  }

  const networkToChainId = await getNetworkMap();
  let sawRpcError = false;
  let sawNoTreasury = false;
  let sawBelowMin = false;
  let lastToken = null;
  let lastTreasury = null;
  let lastChainId = null;
  let lastNetwork = null;
  let lastBalance = null;
  let lastMin = null;

  for (const token of tokens) {
    const tokenAddress = String(token.address || '').trim().toLowerCase();
    const network = String(token.network || '').trim();
    if (!isValidAddress(tokenAddress) || !network) {
      continue;
    }

    const chainId = networkToChainId[network];
    if (!chainId) {
      logger.warn(`[updates/entitlement] unknown network for auth_token: ${network}`);
      sawRpcError = true;
      continue;
    }

    let treasury;
    try {
      treasury = await resolveTreasury(contract, chainId);
    } catch (error) {
      sawRpcError = true;
      logger.warn(
        `[updates/entitlement] treasury resolve failed dle=${contract} chain=${chainId}: ${error.message}`
      );
      continue;
    }

    if (!treasury || treasury === ZERO || /^0x0{40}$/i.test(treasury)) {
      sawNoTreasury = true;
      lastToken = tokenAddress;
      lastTreasury = treasury || ZERO;
      lastChainId = chainId;
      lastNetwork = network;
      logger.warn('updates.entitlement.deny', {
        reason: 'no_treasury',
        dleContract: contract,
        chainId,
        network,
        token: tokenAddress,
      });
      continue;
    }

    const minWei = parseMinBalanceWei(token.min_balance);
    let balanceWei;
    try {
      balanceWei = await readBalance(tokenAddress, treasury, chainId);
    } catch (error) {
      sawRpcError = true;
      logger.warn(
        `[updates/entitlement] balanceOf failed token=${tokenAddress} treasury=${treasury}: ${error.message}`
      );
      continue;
    }

    const balanceHuman = ethers.formatUnits(balanceWei, TOKEN_DECIMALS);
    const minHuman = ethers.formatUnits(minWei, TOKEN_DECIMALS);
    lastToken = tokenAddress;
    lastTreasury = treasury;
    lastChainId = chainId;
    lastNetwork = network;
    lastBalance = balanceHuman;
    lastMin = minHuman;

    if (balanceWei >= minWei) {
      const ok = {
        ok: true,
        dleContract: contract,
        treasury,
        token: tokenAddress,
        tokenName: token.name || null,
        network,
        chainId,
        balance: balanceHuman,
        minBalance: minHuman,
        userId,
        walletAddress,
      };
      logger.info('updates.entitlement.ok', {
        dle: contract,
        treasury,
        token: tokenAddress,
        network,
        balance: balanceHuman,
        min_balance: minHuman,
      });
      cacheSet(cacheKey, ok);
      await writeAudit({
        dleContract: contract,
        result: 'ok',
        reason: null,
        tokenAddress,
        treasuryAddress: treasury,
        chainId,
        network,
        balance: balanceHuman,
        minBalance: minHuman,
        userId,
        walletAddress,
        requestId,
      }, deps);
      return ok;
    }

    sawBelowMin = true;
    logger.warn('updates.entitlement.deny', {
      reason: 'below_min',
      dleContract: contract,
      treasury,
      token: tokenAddress,
      network,
      balance: balanceHuman,
      min_balance: minHuman,
    });
  }

  const reason = sawNoTreasury && !sawBelowMin && !sawRpcError
    ? 'no_treasury'
    : sawRpcError && !sawBelowMin && !sawNoTreasury
      ? 'rpc_error'
      : 'below_min';

  if (shouldCacheDeny(reason)) {
    cacheSet(cacheKey, { ok: false, reason });
  }

  await writeAudit({
    dleContract: contract,
    result: 'deny',
    reason,
    tokenAddress: lastToken,
    treasuryAddress: lastTreasury,
    chainId: lastChainId,
    network: lastNetwork,
    balance: lastBalance,
    minBalance: lastMin,
    userId,
    walletAddress,
    requestId,
  }, deps);

  throw deny(reason, { dleContract: contract });
}

module.exports = {
  assertEntitled,
  clearEntitlementCache,
  normalizeDleContract,
  parseMinBalanceWei,
  MODULE_TREASURY_ID: MODULE_IDS.TREASURY,
};
