/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const { ethers } = require('ethers');
const encryptedDb = require('./encryptedDatabaseService');
const rpcProviderService = require('./rpcProviderService');

/** Пишем только network_id из rpc_providers, не сырой chainId вроде «1». */
async function resolveStoredNetworkId(rawNetwork, address) {
  const key = String(rawNetwork || '').trim();
  const list = (await rpcProviderService.getAllRpcProviders()) || [];
  const norm = (id) => rpcProviderService.normalizeNetworkId(String(id || ''));

  if (key) {
    const byName = list.find((p) => p.network_id && norm(p.network_id) === norm(key));
    if (byName?.network_id) return String(byName.network_id).trim();
    const asNum = Number(key);
    if (Number.isInteger(asNum) && asNum > 0) {
      const byChain = list.find((p) => Number(p.chain_id) === asNum);
      if (byChain?.network_id) return String(byChain.network_id).trim();
    }
  }

  const addr = String(address || '').trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    for (const p of list) {
      if (!p.rpc_url || !p.network_id) continue;
      try {
        const provider = new ethers.JsonRpcProvider(p.rpc_url);
        const code = await provider.getCode(addr);
        if (code && code !== '0x') return String(p.network_id).trim();
      } catch (_) {
        // следующий провайдер из БД
      }
    }
  }
  return null;
}

function canonicalizeAddress(address) {
  const raw = String(address || '').trim();
  try {
    return ethers.getAddress(raw);
  } catch {
    return raw;
  }
}

function addressesEqual(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

async function findAuthTokenRow(address, network) {
  const net = String(network || '').trim();
  const tokens = await encryptedDb.getData('auth_tokens', {});
  return (tokens || []).find(
    (t) => addressesEqual(t.address, address) && String(t.network || '').trim() === net
  ) || null;
}

async function getAllAuthTokens() {
  const tokens = await encryptedDb.getData('auth_tokens', {}, null, 'id');
  return tokens;
}

async function saveAllAuthTokens(authTokens) {
  // Удаляем все существующие токены
  await encryptedDb.deleteData('auth_tokens', {});
  
  // Сохраняем новые токены
  for (const token of authTokens) {
    const address = canonicalizeAddress(token.address);
    const network = await resolveStoredNetworkId(token.network, address);
    if (!network) {
      throw new Error('Сеть токена должна совпадать с RPC в настройках');
    }
    await encryptedDb.saveData('auth_tokens', {
      name: token.name,
      address,
      network,
      min_balance: token.minBalance == null ? 0 : Number(token.minBalance),
      readonly_threshold: token.readonlyThreshold == null ? null : Number(token.readonlyThreshold),
      editor_threshold: token.editorThreshold == null ? null : Number(token.editorThreshold)
    });
  }

  try {
    require('./updatesEntitlementService').clearEntitlementCache();
  } catch {
    // entitlement service optional at boot
  }
}

async function upsertAuthToken(token) {
  console.log('[AuthTokenService] Получены данные токена:', token);
  console.log('[AuthTokenService] token.readonlyThreshold:', token.readonlyThreshold, 'тип:', typeof token.readonlyThreshold);
  console.log('[AuthTokenService] token.editorThreshold:', token.editorThreshold, 'тип:', typeof token.editorThreshold);
  
  const address = canonicalizeAddress(token.address);
  const network = await resolveStoredNetworkId(token.network, address);
  if (!network) {
    throw new Error('Сеть токена должна совпадать с RPC в настройках (network_id или chain_id из rpc_providers)');
  }
  const minBalance = token.minBalance == null ? 0 : Number(token.minBalance);
  const readonlyThreshold = (token.readonlyThreshold === null || token.readonlyThreshold === undefined || token.readonlyThreshold === '') ? null : Number(token.readonlyThreshold);
  const editorThreshold = (token.editorThreshold === null || token.editorThreshold === undefined || token.editorThreshold === '') ? null : Number(token.editorThreshold);
  
  // Пороги двери: равенство разрешено (дефолт 1/1 → один токен = editor)
  if (
    readonlyThreshold != null &&
    editorThreshold != null &&
    Number.isFinite(readonlyThreshold) &&
    Number.isFinite(editorThreshold) &&
    readonlyThreshold > editorThreshold
  ) {
    throw new Error('Минимум токенов для Read-Only доступа не должен быть больше минимума для Editor доступа');
  }
  
  console.log('[AuthTokenService] Вычисленные значения:');
  console.log('[AuthTokenService] readonlyThreshold:', readonlyThreshold);
  console.log('[AuthTokenService] editorThreshold:', editorThreshold);
  
  const all = await getAllAuthTokens();
  const existing =
    (await findAuthTokenRow(address, network))
    || (all || []).find((t) => addressesEqual(t.address, address))
    || null;

  if (existing) {
    const sameNetwork = String(existing.network || '').trim() === network;
    if (!sameNetwork) {
      await encryptedDb.deleteData('auth_tokens', {
        address: existing.address,
        network: existing.network,
      });
      await encryptedDb.saveData('auth_tokens', {
        name: token.name,
        address,
        network,
        min_balance: minBalance,
        readonly_threshold: readonlyThreshold,
        editor_threshold: editorThreshold
      });
    } else {
      await encryptedDb.saveData('auth_tokens', {
        name: token.name,
        min_balance: minBalance,
        readonly_threshold: readonlyThreshold,
        editor_threshold: editorThreshold
      }, {
        address: existing.address,
        network: existing.network
      });
    }
  } else {
    await encryptedDb.saveData('auth_tokens', {
      name: token.name,
      address,
      network,
      min_balance: minBalance,
      readonly_threshold: readonlyThreshold,
      editor_threshold: editorThreshold
    });
  }

  try {
    require('./updatesEntitlementService').clearEntitlementCache();
  } catch {
    // ignore
  }
}

async function deleteAuthToken(address, network) {
  console.log(`[AuthTokenService] deleteAuthToken: address=${address}, network=${network}`);
  try {
    const existing = await findAuthTokenRow(address, network);
    if (existing) {
      await encryptedDb.deleteData('auth_tokens', {
        address: existing.address,
        network: existing.network,
      });
    } else {
      await encryptedDb.deleteData('auth_tokens', { address, network });
    }
    console.log(`[AuthTokenService] Токен успешно удален`);
    try {
      require('./updatesEntitlementService').clearEntitlementCache();
    } catch {
      // ignore
    }
    try {
      await require('./dleAttachService').detachIfNoAuthToken(address);
    } catch (detachError) {
      console.error(`[AuthTokenService] Каскад deploy_params:`, detachError.message);
    }
  } catch (error) {
    console.error(`[AuthTokenService] Ошибка при удалении токена:`, error);
    throw error;
  }
}

module.exports = {
  getAllAuthTokens,
  saveAllAuthTokens,
  upsertAuthToken,
  deleteAuthToken,
  resolveStoredNetworkId,
}; 