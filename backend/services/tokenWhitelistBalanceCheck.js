/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Общий helper проверки holderAddress по whitelist токенов.
 * Пороги auth_tokens (min_balance, readonly_threshold, editor_threshold) обязательны.
 */

const { ethers } = require('ethers');
const authTokenService = require('./authTokenService');
const rpcProviderService = require('./rpcProviderService');

const ERC20_ABI = ['function balanceOf(address owner) view returns (uint256)'];
const RPC_TIMEOUT_MS = Number(process.env.DLE_LICENSE_RPC_TIMEOUT_MS || 10000);
const RPC_RETRIES = Math.max(1, Number(process.env.DLE_LICENSE_RPC_RETRIES || 2));
const TOKEN_DECIMALS = 18;

function isValidAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim());
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
    // ignore
  }
  return provider;
}

/**
 * Порог из auth_tokens задаётся в человеческих единицах токена (18 decimals).
 * Нельзя трактовать целое как wei: это занижает порог.
 */
function parseTokenAmountWei(amount) {
  if (amount == null || amount === '') {
    return 0n;
  }
  const raw = String(amount).trim();
  if (!raw || raw === 'NaN') {
    return 0n;
  }
  try {
    return ethers.parseUnits(raw, TOKEN_DECIMALS);
  } catch {
    const integerPart = raw.split('.')[0] || '0';
    if (!/^\d+$/.test(integerPart)) {
      return 0n;
    }
    try {
      return ethers.parseUnits(integerPart, TOKEN_DECIMALS);
    } catch {
      return 0n;
    }
  }
}

function resolveAccessThresholdWei(token, requiredLevel) {
  const minBalanceWei = parseTokenAmountWei(token.min_balance);
  if (requiredLevel === 'min_balance') {
    return minBalanceWei;
  }

  const thresholdRaw =
    requiredLevel === 'readonly' ? token.readonly_threshold : token.editor_threshold;
  const accessThresholdWei = parseTokenAmountWei(thresholdRaw);
  // Если порог доступа не задан, остаётся min_balance — «нулевой порог» не открывает gate.
  return accessThresholdWei > 0n ? accessThresholdWei : minBalanceWei;
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

async function readTokenBalance(tokenAddress, holderAddress, chainId) {
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
      token.balanceOf(holderAddress),
      RPC_TIMEOUT_MS,
      'balanceOf'
    );
    return BigInt(balance.toString());
  });
}

/**
 * @param {string} holderAddress
 * @param {{ requiredLevel?: 'min_balance' | 'readonly' | 'editor' }} [options]
 */
async function checkHolderAgainstWhitelist(holderAddress, options = {}) {
  const requiredLevel = options.requiredLevel || 'min_balance';

  if (!isValidAddress(holderAddress)) {
    return { allowed: false, reason: 'wallet_not_connected' };
  }

  const authTokens = await authTokenService.getAllAuthTokens();
  if (!Array.isArray(authTokens) || authTokens.length === 0) {
    return { allowed: false, reason: 'no_auth_tokens' };
  }

  const networkMap = await buildNetworkMap();
  let sawRpcError = false;
  let validTokenSumWei = 0n;
  let requiredThresholdWei = null;
  let matchedToken = null;
  let matchedBalanceWei = 0n;
  let matchedMinBalanceWei = 0n;

  for (const token of authTokens) {
    const network = String(token.network || '').trim();
    const chainId = networkMap[network];
    if (!chainId) {
      continue;
    }

    const tokenAddress = String(token.address || '').trim();
    if (!isValidAddress(tokenAddress)) {
      continue;
    }

    const minBalanceWei = parseTokenAmountWei(token.min_balance);
    const tokenRequiredWei = resolveAccessThresholdWei(token, requiredLevel);
    if (requiredThresholdWei == null || tokenRequiredWei < requiredThresholdWei) {
      requiredThresholdWei = tokenRequiredWei;
    }

    try {
      const balanceWei = await readTokenBalance(tokenAddress, holderAddress, chainId);

      // Как в getUserAccessLevel: в сумму допуска входят только токены с балансом >= min_balance.
      if (balanceWei >= minBalanceWei) {
        validTokenSumWei += balanceWei;
        if (!matchedToken || balanceWei > matchedBalanceWei) {
          matchedToken = {
            address: tokenAddress,
            network,
            name: token.name || tokenAddress,
            chainId,
          };
          matchedBalanceWei = balanceWei;
          matchedMinBalanceWei = minBalanceWei;
        }
      }

      // Для min_balance (контур updates) достаточно первого подходящего токена.
      if (requiredLevel === 'min_balance' && balanceWei >= minBalanceWei) {
        return {
          allowed: true,
          reason: 'ok',
          matchedToken: {
            address: tokenAddress,
            network,
            name: token.name || tokenAddress,
            chainId,
          },
          balanceWei: balanceWei.toString(),
          minBalanceWei: minBalanceWei.toString(),
          requiredThresholdWei: minBalanceWei.toString(),
        };
      }
    } catch (error) {
      sawRpcError = true;
    }
  }

  if (requiredLevel !== 'min_balance') {
    const requiredWei = requiredThresholdWei == null ? 0n : requiredThresholdWei;
    if (validTokenSumWei >= requiredWei && matchedToken) {
      return {
        allowed: true,
        reason: 'ok',
        matchedToken,
        balanceWei: matchedBalanceWei.toString(),
        minBalanceWei: matchedMinBalanceWei.toString(),
        requiredThresholdWei: requiredWei.toString(),
      };
    }
  }

  return {
    allowed: false,
    reason: sawRpcError && validTokenSumWei === 0n ? 'rpc_error' : 'insufficient_license_balance',
    requiredThresholdWei: requiredThresholdWei == null ? undefined : requiredThresholdWei.toString(),
    balanceWei: matchedBalanceWei.toString(),
  };
}

module.exports = {
  checkHolderAgainstWhitelist,
  parseTokenAmountWei,
};
