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

function providersForChain(all, chainId) {
  const cid = Number(chainId);
  if (!Number.isInteger(cid) || cid <= 0) return [];
  return (all || []).filter((p) => Number(p.chain_id) === cid && p.rpc_url);
}

async function getRpcUrlByChainId(chainId) {
  const cid = Number(chainId);
  const all = (await getAllRpcProviders()) || [];
  const matched = providersForChain(all, cid);
  console.log(
    `[RPC Service] Поиск RPC URL для chain_id: ${chainId}; в БД провайдеров: ${all.length}, для этой сети: ${matched.length}`
  );
  if (!Number.isInteger(cid) || cid <= 0) {
    return null;
  }
  if (matched.length > 0) {
    console.log(`[RPC Service] Берём RPC URL #1 из ${matched.length} для chain_id ${cid}`);
    return matched[0].rpc_url;
  }
  console.log(`[RPC Service] RPC URL для chain_id ${cid} не найден`);
  return null;
}

/** Совпадает с useBlockchainNetworks.js / dleAttachService NETWORK_CHAIN_FALLBACK. */
const EXPECTED_CHAIN_BY_NETWORK_ID = {
  ethereum: 1,
  bsc: 56,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  avalanche: 43114,
  gnosis: 100,
  celo: 42220,
  fantom: 250,
  harmony: 1666600000,
  metis: 1088,
  aurora: 1313161554,
  cronos: 25,
  sepolia: 11155111,
  goerli: 5,
  holesky: 17000,
  'bsc-testnet': 97,
  mumbai: 80001,
  'polygon-amoy': 80002,
  'arbitrum-goerli': 421613,
  'arbitrum-sepolia': 421614,
  'optimism-goerli': 420,
  'fantom-testnet': 4002,
  'base-sepolia': 84532,
  localhost: 31337,
  ganache: 1337,
};

function expectedChainIdForNetworkId(networkId) {
  const key = normalizeNetworkId(String(networkId || ''));
  if (!key || key === 'custom') return null;
  const mapped = EXPECTED_CHAIN_BY_NETWORK_ID[key];
  return mapped != null ? Number(mapped) : null;
}

class RpcChainMismatchError extends Error {
  constructor(expected, actual) {
    super(
      `RPC для сети ${expected} отвечает сетью ${actual}. Проверьте URL в настройках RPC.`
    );
    this.name = 'RpcChainMismatchError';
    this.code = 'RPC_CHAIN_MISMATCH';
    this.expected = Number(expected);
    this.actual = Number(actual);
  }
}

async function readNodeChainId(rpcUrl) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      signal: ctrl.signal,
    });
    const json = await res.json();
    if (!json.result) {
      throw new Error(json.error?.message || 'eth_chainId пустой');
    }
    return parseInt(json.result, 16);
  } finally {
    clearTimeout(timer);
  }
}

/** URL из БД только если узел eth_chainId совпадает с запрошенной сетью. */
async function getVerifiedRpcUrlByChainId(chainId) {
  const url = await getRpcUrlByChainId(chainId);
  if (!url) return null;
  const actual = await readNodeChainId(url);
  if (actual !== Number(chainId)) {
    console.error(
      `[RPC Service] Несовпадение chain_id: в БД ${chainId}, узел ${actual}`
    );
    throw new RpcChainMismatchError(chainId, actual);
  }
  return url;
}

async function getEtherscanApiUrlByChainId(chainId) {
  const cid = Number(chainId);
  const all = (await getAllRpcProviders()) || [];
  const matched = (all || []).filter((p) => Number(p.chain_id) === cid);
  console.log(
    `[RPC Service] Поиск Etherscan API URL для chain_id: ${chainId}; в БД провайдеров: ${all.length}, для этой сети: ${matched.length}`
  );
  if (matched.length > 0) {
    console.log(`[RPC Service] Найден Etherscan API URL: ${matched[0].etherscan_api_url || 'НЕТ'}`);
  } else {
    console.log(`[RPC Service] Etherscan API URL для chain_id ${cid} не найден`);
  }
  return matched[0]?.etherscan_api_url || null;
}

module.exports = {
  getAllRpcProviders,
  saveAllRpcProviders,
  upsertRpcProvider,
  deleteRpcProvider,
  getRpcUrlByNetworkId,
  getRpcUrlByChainId,
  getVerifiedRpcUrlByChainId,
  expectedChainIdForNetworkId,
  RpcChainMismatchError,
  resolveRpcForNetwork,
  getEtherscanApiUrlByChainId,
  normalizeNetworkId,
}; 