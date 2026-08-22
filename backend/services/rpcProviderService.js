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

const encryptedDb = require('./encryptedDatabaseService');

function normalizeNetworkId(networkId) {
  if (!networkId || typeof networkId !== 'string') return networkId;
  const v = networkId.trim().toLowerCase();
  // Common normalizations
  if (v === 'base sepolia testnet' || v === 'base sepolia') return 'base-sepolia';
  return v.replace(/\s+/g, '-');
}

async function getAllRpcProviders() {
  const providers = await encryptedDb.getData('rpc_providers', {}, null, 'id');
  return providers;
}

async function saveAllRpcProviders(rpcConfigs) {
  // Удаляем все существующие провайдеры
  await encryptedDb.deleteData('rpc_providers', {});
  
  // Сохраняем новые провайдеры
  for (const cfg of rpcConfigs) {
    await encryptedDb.saveData('rpc_providers', {
      network_id: normalizeNetworkId(cfg.networkId),
      rpc_url: cfg.rpcUrl,
      chain_id: cfg.chainId || null
    });
  }
}

async function upsertRpcProvider(cfg) {
  // Проверяем, существует ли провайдер
  const existing = await encryptedDb.getData('rpc_providers', { network_id: cfg.networkId }, 1);
  
  if (existing.length > 0) {
    // Обновляем существующий провайдер
    await encryptedDb.saveData('rpc_providers', {
      rpc_url: cfg.rpcUrl,
      chain_id: cfg.chainId || null
    }, {
      network_id: normalizeNetworkId(cfg.networkId)
    });
  } else {
    // Создаем новый провайдер
    await encryptedDb.saveData('rpc_providers', {
      network_id: normalizeNetworkId(cfg.networkId),
      rpc_url: cfg.rpcUrl,
      chain_id: cfg.chainId || null
    });
  }
}

async function deleteRpcProvider(networkId) {
  await encryptedDb.deleteData('rpc_providers', { network_id: networkId });
}

async function resolveRpcForNetwork(network) {
  const key = String(network || '').trim();
  const list = (await getAllRpcProviders()) || [];
  const pick = (p) =>
    p && p.rpc_url
      ? { rpcUrl: p.rpc_url, chainId: Number(p.chain_id) || null, networkId: p.network_id }
      : null;

  if (!key) {
    return { rpcUrl: null, chainId: null, networkId: null };
  }

  const byNetworkId = list.find(
    (p) => p.network_id && normalizeNetworkId(p.network_id) === normalizeNetworkId(key)
  );
  if (byNetworkId) return pick(byNetworkId);

  const asNum = Number(key);
  if (Number.isInteger(asNum) && asNum > 0) {
    const byChain = list.find((p) => Number(p.chain_id) === asNum);
    if (byChain) return pick(byChain);
  }

  const namedUrl = await getRpcUrlByNetworkId(key);
  if (namedUrl) {
    const named = list.find((p) => p.rpc_url === namedUrl);
    return pick(named) || { rpcUrl: namedUrl, chainId: null, networkId: key };
  }

  return { rpcUrl: null, chainId: null, networkId: key };
}

async function getRpcUrlByNetworkId(networkId) {
  // Сначала пробуем точное совпадение (для обратной совместимости)
  let providers = await encryptedDb.getData('rpc_providers', { network_id: networkId }, 1);
  if (providers.length > 0) return providers[0].rpc_url || null;
  // Затем ищем по нормализованному ключу среди всех записей
  const all = await encryptedDb.getData('rpc_providers', {}, null, 'id');
  const norm = normalizeNetworkId(networkId);
  const found = all.find(p => normalizeNetworkId(p.network_id) === norm);
  return found ? found.rpc_url : null;
}

async function getRpcUrlByChainId(chainId) {
  const cid = Number(chainId);
  console.log(`[RPC Service] Поиск RPC URL для chain_id: ${chainId}`);
  if (!Number.isInteger(cid) || cid <= 0) {
    return null;
  }
  let providers = [];
  try {
    providers = await encryptedDb.getData('rpc_providers', { chain_id: cid }, 1);
  } catch (_) {
    providers = [];
  }
  if (!providers.length) {
    const all = await getAllRpcProviders();
    providers = (all || []).filter((p) => Number(p.chain_id) === cid).slice(0, 1);
  }
  console.log(`[RPC Service] Найдено провайдеров: ${providers.length}`);
  if (providers.length > 0) {
    console.log(`[RPC Service] Найден RPC URL: ${providers[0].rpc_url}`);
  } else {
    console.log(`[RPC Service] RPC URL для chain_id ${cid} не найден`);
  }
  return providers[0]?.rpc_url || null;
}

async function getEtherscanApiUrlByChainId(chainId) {
  console.log(`[RPC Service] Поиск Etherscan API URL для chain_id: ${chainId}`);
  const providers = await encryptedDb.getData('rpc_providers', { chain_id: chainId }, 1);
  console.log(`[RPC Service] Найдено провайдеров: ${providers.length}`);
  if (providers.length > 0) {
    console.log(`[RPC Service] Найден Etherscan API URL: ${providers[0].etherscan_api_url || 'НЕТ'}`);
  } else {
    console.log(`[RPC Service] Etherscan API URL для chain_id ${chainId} не найден`);
  }
  return providers[0]?.etherscan_api_url || null;
}

module.exports = {
  getAllRpcProviders,
  saveAllRpcProviders,
  upsertRpcProvider,
  deleteRpcProvider,
  getRpcUrlByNetworkId,
  getRpcUrlByChainId,
  resolveRpcForNetwork,
  getEtherscanApiUrlByChainId,
  normalizeNetworkId,
}; 