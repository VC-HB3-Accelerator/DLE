/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Привязка существующей книги к ОС: auth_tokens → хвост deploy_params (без private_key).
 * См. docs.ru/back-docs/TZ_DLE_ATTACH_EXISTING_TREASURY_GAS.ru.md §4
 */

const { ethers } = require('ethers');
const logger = require('../utils/logger');
const rpcProviderService = require('./rpcProviderService');
const encryptedDb = require('./encryptedDatabaseService');
const deployParamsService = require('./deployParamsService');
const {
  DLE_GET_DLE_INFO,
} = require('../constants/dleReadAbi');

/** Совпадает с frontend/src/composables/useBlockchainNetworks.js — если RPC-строки ещё нет в БД. */
const NETWORK_CHAIN_FALLBACK = {
  ethereum: 1,
  bsc: 56,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  avalanche: 43114,
  gnosis: 100,
  celo: 42220,
  fantom: 250,
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

function normalizeAddress(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidAddress(value) {
  return /^0x[a-f0-9]{40}$/.test(normalizeAddress(value));
}

async function resolveChainId(network) {
  const key = String(network || '').trim();
  if (!key) return null;

  const providers = await rpcProviderService.getAllRpcProviders();
  const keyNorm = rpcProviderService.normalizeNetworkId(key);
  const keyAsNum = Number(key);
  for (const provider of providers || []) {
    if (provider.chain_id == null) continue;
    if (String(provider.network_id || '').trim() === key) {
      return Number(provider.chain_id);
    }
    if (rpcProviderService.normalizeNetworkId(provider.network_id) === keyNorm) {
      return Number(provider.chain_id);
    }
    if (Number.isInteger(keyAsNum) && Number(provider.chain_id) === keyAsNum) {
      return Number(provider.chain_id);
    }
  }

  if (NETWORK_CHAIN_FALLBACK[key] != null) {
    return NETWORK_CHAIN_FALLBACK[key];
  }
  if (NETWORK_CHAIN_FALLBACK[keyNorm] != null) {
    return NETWORK_CHAIN_FALLBACK[keyNorm];
  }
  const asNum = Number(key);
  if (Number.isInteger(asNum) && asNum > 0) {
    return asNum;
  }
  return null;
}

async function findDeployRowByDleAddress(dleAddress) {
  const needle = normalizeAddress(dleAddress);
  const rows = await encryptedDb.getData('deploy_params', {});
  return (rows || []).find((row) => normalizeAddress(row.dle_address) === needle) || null;
}

async function listAttachedDleAddresses() {
  const rows = await encryptedDb.getData('deploy_params', {});
  const set = new Set();
  for (const row of rows || []) {
    const addr = normalizeAddress(row.dle_address);
    if (isValidAddress(addr)) {
      set.add(addr);
    }
  }
  return set;
}

async function probeDle(dleAddress, chainId) {
  const rpcUrl = await rpcProviderService.getRpcUrlByChainId(Number(chainId));
  if (!rpcUrl) {
    const err = new Error(`RPC URL для сети ${chainId} не найден`);
    err.code = 'no_rpc';
    throw err;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const code = await provider.getCode(dleAddress);
  if (!code || code === '0x') {
    const err = new Error(`По адресу нет контракта в сети ${chainId}`);
    err.code = 'no_code';
    throw err;
  }

  const dle = new ethers.Contract(
    dleAddress,
    [
      DLE_GET_DLE_INFO,
      'function quorumPercentage() view returns (uint256)',
      'function logoURI() view returns (string)',
      'function getMultichainAddresses() view returns (uint256[] memory, address[] memory)',
    ],
    provider
  );

  const dleInfo = await dle.getDLEInfo();
  let quorumPercentage = 0;
  try {
    quorumPercentage = Number(await dle.quorumPercentage());
  } catch {
    quorumPercentage = 0;
  }
  let logoURI = '';
  try {
    logoURI = await dle.logoURI();
  } catch {
    logoURI = '';
  }

  let networks = [{ chainId: Number(chainId), address: dleAddress }];
  let supportedChainIds = [Number(chainId)];
  try {
    const [chainIds, addrs] = await dle.getMultichainAddresses();
    if (Array.isArray(chainIds) && chainIds.length > 0) {
      networks = chainIds.map((cid, i) => ({
        chainId: Number(cid),
        address: addrs[i] && addrs[i] !== ethers.ZeroAddress ? addrs[i] : dleAddress,
      }));
      supportedChainIds = chainIds.map((cid) => Number(cid));
    }
  } catch {
    // односетевая книга
  }

  return {
    name: dleInfo.name,
    symbol: dleInfo.symbol,
    location: dleInfo.location,
    coordinates: dleInfo.coordinates,
    jurisdiction: Number(dleInfo.jurisdiction),
    okvedCodes: Array.from(dleInfo.okvedCodes || []),
    kpp: Number(dleInfo.kpp),
    creationTimestamp: Number(dleInfo.creationTimestamp),
    quorumPercentage,
    logoURI,
    networks,
    supportedChainIds,
  };
}

async function upsertAttachedTail({ address, network, chainId, info }) {
  const dleAddress = ethers.getAddress(address);
  const existing = await findDeployRowByDleAddress(dleAddress);
  if (existing) {
    const status = String(existing.deployment_status || '').toLowerCase();
    if (status && status !== 'attached') {
      logger.info(
        `[dleAttach] хвост ${existing.deployment_id} уже есть (status=${status}), не перезаписываем`
      );
      return { deploymentId: existing.deployment_id, dleAddress, keptExisting: true };
    }
  }
  const deploymentId = existing?.deployment_id || `attached-${chainId}-${normalizeAddress(dleAddress)}`;

  const dataToSave = {
    deployment_id: deploymentId,
    name: info.name,
    symbol: info.symbol,
    location: info.location,
    coordinates: info.coordinates,
    jurisdiction: info.jurisdiction,
    okved_codes: JSON.stringify(info.okvedCodes || []),
    kpp: info.kpp,
    quorum_percentage: info.quorumPercentage,
    initial_partners: JSON.stringify([]),
    initial_amounts: JSON.stringify([]),
    supported_chain_ids: JSON.stringify(info.supportedChainIds || [chainId]),
    current_chain_id: chainId,
    logo_uri: info.logoURI || '',
    dle_address: dleAddress,
    modules_to_deploy: JSON.stringify([]),
    deployment_status: 'attached',
    deploy_result: JSON.stringify({
      networks: info.networks,
      attachedFrom: { network, chainId },
    }),
  };

  if (existing) {
    await encryptedDb.saveData('deploy_params', dataToSave, { deployment_id: deploymentId });
  } else {
    await encryptedDb.saveData('deploy_params', dataToSave);
  }

  logger.info(`[dleAttach] хвост deploy_params ${existing ? 'обновлён' : 'создан'}: ${deploymentId}`);
  return { deploymentId, dleAddress };
}

/**
 * После Add auth: если адрес — DLE с кодом и getDLEInfo, пишем хвост attached без pk.
 * Если это обычный ERC-20 двери — не ошибка, карточки нет.
 */
async function tryAttachFromAuthToken({ name, address, network }) {
  if (!isValidAddress(address)) {
    return { attached: false, reason: 'bad_address' };
  }
  const chainId = await resolveChainId(network);
  if (!chainId) {
    logger.warn(`[dleAttach] неизвестная сеть auth_token: ${network}`);
    return { attached: false, reason: 'unknown_network' };
  }

  try {
    const info = await probeDle(address, chainId);
    if (!info.name) {
      return { attached: false, reason: 'not_dle' };
    }
    const tail = await upsertAttachedTail({ address, network, chainId, info });
    return { attached: true, reason: 'ok', ...tail, name: info.name || name };
  } catch (error) {
    const reason = error.code || 'probe_failed';
    logger.info(`[dleAttach] не DLE или RPC: ${reason} ${error.message}`);
    return { attached: false, reason, error: error.message };
  }
}

async function remainingAuthTokensForAddress(address) {
  const needle = normalizeAddress(address);
  const tokens = await encryptedDb.getData('auth_tokens', {});
  return (tokens || []).filter((t) => normalizeAddress(t.address) === needle);
}

/**
 * После completed-деплоя: адрес книги → auth_tokens (дверь узла), пороги 1/1 если строки ещё нет.
 * Уже заданные пороги не затираем. ТЗ §4 · §6.1
 */
async function syncAuthDoorFromDeployment({ address, chainId, name }) {
  if (!isValidAddress(address)) {
    return { synced: false, reason: 'bad_address' };
  }
  const authTokenService = require('./authTokenService');
  let network;
  try {
    network = await authTokenService.resolveStoredNetworkId(chainId, address);
  } catch (error) {
    logger.warn(`[dleAttach] сеть для auth door: ${error.message}`);
  }
  if (!network) {
    return { synced: false, reason: 'unknown_network' };
  }
  const existing = (await authTokenService.getAllAuthTokens()).find(
    (t) =>
      normalizeAddress(t.address) === normalizeAddress(address)
      && String(t.network || '').trim() === network
  );

  await authTokenService.upsertAuthToken({
    name: name || existing?.name || 'DLE',
    address,
    network,
    minBalance: existing?.min_balance == null ? 0 : existing.min_balance,
    readonlyThreshold: existing
      ? (existing.readonly_threshold == null ? 1 : existing.readonly_threshold)
      : 1,
    editorThreshold: existing
      ? (existing.editor_threshold == null ? 1 : existing.editor_threshold)
      : 1,
  });

  logger.info(`[dleAttach] дверь auth после деплоя: ${normalizeAddress(address)} @ ${network}`);
  return { synced: true, network, existed: Boolean(existing) };
}

/**
 * Delete auth: снимаем только хвост `attached`.
 * Запись собственного деплоя (completed/failed/…) не удаляем — там ключ деплоя.
 */
async function detachIfNoAuthToken(address) {
  const remaining = await remainingAuthTokensForAddress(address);
  if (remaining.length > 0) {
    logger.info(`[dleAttach] auth_tokens ещё есть для ${normalizeAddress(address)}, хвост не снимаем`);
    return { detached: false, reason: 'auth_token_remains' };
  }
  const row = await findDeployRowByDleAddress(address);
  if (!row) {
    return { detached: false, reason: 'no_tail' };
  }
  const status = String(row.deployment_status || '').toLowerCase();
  if (status && status !== 'attached') {
    logger.info(
      `[dleAttach] auth снят, хвост ${row.deployment_id} status=${status} оставляем (не attached)`
    );
    return { detached: false, reason: 'local_deploy_kept', deploymentId: row.deployment_id };
  }
  return detachByDleAddress(address);
}

async function detachByDleAddress(address) {
  const row = await findDeployRowByDleAddress(address);
  if (!row) {
    return { detached: false, reason: 'no_tail' };
  }
  await deployParamsService.deleteDeployParams(row.deployment_id);
  logger.info(`[dleAttach] хвост снят: ${row.deployment_id}`);
  return { detached: true, deploymentId: row.deployment_id };
}

/**
 * Снять книгу с этой ОС после on-chain isActive=false (вариант B delist).
 * Удаляет хвост deploy_params (в т.ч. локальный completed), JSON contracts-data/dles, футер.
 */
async function delistFromOs(address, { requireInactive = true, chainId = null } = {}) {
  const { ethers } = require('ethers');
  const fs = require('fs');
  const path = require('path');
  const footerDleService = require('./footerDleService');

  if (!isValidAddress(address)) {
    const err = new Error('invalid_address');
    err.code = 'invalid_address';
    throw err;
  }
  const normalized = normalizeAddress(address);

  let resolvedChainId = chainId != null ? Number(chainId) : null;
  let rpcUrl = null;
  if (resolvedChainId) {
    rpcUrl = await rpcProviderService.getRpcUrlByChainId(resolvedChainId);
    if (rpcUrl) {
      try {
        const code = await new ethers.JsonRpcProvider(rpcUrl, resolvedChainId).getCode(normalized);
        if (!code || code === '0x') {
          rpcUrl = null;
          resolvedChainId = chainId != null ? Number(chainId) : null;
        }
      } catch {
        rpcUrl = null;
      }
    }
  }
  if (!rpcUrl) {
    resolvedChainId = null;
    const providers = await rpcProviderService.getAllRpcProviders();
    for (const p of providers || []) {
      const cid = Number(p.chain_id);
      if (!cid) continue;
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const code = await new ethers.JsonRpcProvider(url).getCode(normalized);
        if (code && code !== '0x') {
          rpcUrl = url;
          resolvedChainId = cid;
          break;
        }
      } catch {
        /* next */
      }
    }
  }
  if (!rpcUrl) {
    const err = new Error('contract_not_found');
    err.code = 'contract_not_found';
    throw err;
  }

  const dle = new ethers.Contract(
    normalized,
    ['function isActive() view returns (bool)'],
    new ethers.JsonRpcProvider(rpcUrl, resolvedChainId)
  );
  let active = true;
  try {
    active = await dle.isActive();
  } catch (e) {
    const err = new Error(`isActive_read_failed: ${e.message}`);
    err.code = 'isActive_read_failed';
    throw err;
  }
  if (requireInactive && active) {
    const err = new Error('still_active');
    err.code = 'still_active';
    err.isActive = true;
    err.chainId = resolvedChainId;
    throw err;
  }

  const row = await findDeployRowByDleAddress(normalized);
  let deploymentId = null;
  let removedDeploy = false;
  if (row) {
    deploymentId = row.deployment_id;
    await deployParamsService.deleteDeployParams(row.deployment_id);
    removedDeploy = true;
  }

  const authTokenService = require('./authTokenService');
  const authRows = await remainingAuthTokensForAddress(normalized);
  let removedAuthTokens = 0;
  for (const t of authRows) {
    try {
      await authTokenService.deleteAuthToken(t.address, t.network);
      removedAuthTokens += 1;
    } catch (e) {
      logger.warn(`[dleAttach] delist auth_token: ${e.message}`);
    }
  }

  const dlesDir = path.join(__dirname, '../contracts-data/dles');
  const removedFiles = [];
  if (fs.existsSync(dlesDir)) {
    for (const file of fs.readdirSync(dlesDir)) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(dlesDir, file);
      try {
        if (!fs.statSync(filePath).isFile()) continue;
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const addrs = [];
        if (data.dleAddress) addrs.push(normalizeAddress(data.dleAddress));
        for (const n of data.networks || data.deployedNetworks || []) {
          if (n?.address) addrs.push(normalizeAddress(n.address));
        }
        if (addrs.includes(normalized)) {
          fs.unlinkSync(filePath);
          removedFiles.push(file);
        }
      } catch (e) {
        logger.warn(`[dleAttach] delist: skip file ${file}: ${e.message}`);
      }
    }
  }

  let footerCleared = false;
  try {
    const footer = await footerDleService.getFooterSelection();
    const footerAddr = normalizeAddress(footer?.address || '');
    if (footerAddr && footerAddr === normalized) {
      await footerDleService.clearFooterSelection();
      footerCleared = true;
    }
  } catch (e) {
    logger.warn(`[dleAttach] delist footer: ${e.message}`);
  }

  logger.info(
    `[dleAttach] delistFromOs ${normalized} chain=${resolvedChainId} deploy=${removedDeploy} auth=${removedAuthTokens} files=${removedFiles.length} footer=${footerCleared}`
  );
  return {
    delisted: true,
    dleAddress: normalized,
    chainId: resolvedChainId,
    wasActive: active,
    deploymentId,
    removedDeploy,
    removedAuthTokens,
    removedFiles,
    footerCleared,
  };
}

function stripDeploymentSecrets(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  delete out.privateKey;
  delete out.private_key;
  delete out.etherscanApiKey;
  delete out.etherscan_api_key;
  const stripNested = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const copy = { ...obj };
    delete copy.privateKey;
    delete copy.private_key;
    delete copy.etherscanApiKey;
    delete copy.etherscan_api_key;
    return copy;
  };
  if (out.deployResult && typeof out.deployResult === 'object') {
    out.deployResult = stripNested(out.deployResult);
  } else if (typeof out.deployResult === 'string') {
    try {
      out.deployResult = stripNested(JSON.parse(out.deployResult));
    } catch {
      // текст output без ключа — оставляем
    }
  }
  return out;
}

function parseRpcUrlMap(raw) {
  if (!raw) return {};
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  const map = {};
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (typeof item === 'string' && item) {
        map[`arr${index}`] = item;
      }
    });
    return map;
  }
  if (typeof value === 'object') {
    for (const [key, url] of Object.entries(value)) {
      if (url) map[String(key)] = String(url);
    }
  }
  return map;
}

function generateCreate2Salt() {
  return `0x${[...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
}

function chainIdToNetworkId(chainId) {
  const id = Number(chainId);
  for (const [networkId, cid] of Object.entries(NETWORK_CHAIN_FALLBACK)) {
    if (Number(cid) === id) return networkId;
  }
  return `chain-${id}`;
}

async function getModuleDeployerStatus(row) {
  if (!row) {
    return {
      configured: false,
      hasPrivateKey: false,
      hasRpcUrl: false,
      hasEtherscanKey: false,
      rpcUrl: '',
      rpcUrls: [],
      walletAddress: null,
    };
  }
  const pk = row.private_key || row.privateKey;
  const scanKey = row.etherscan_api_key || row.etherscanApiKey;
  const rpcMap = parseRpcUrlMap(row.rpc_urls || row.rpcUrls);
  const rpcList = Array.isArray(row.rpc_urls) ? row.rpc_urls : (Array.isArray(row.rpcUrls) ? row.rpcUrls : []);
  const rpcUrlsFromMap = Object.entries(rpcMap)
    .filter(([key, u]) => u && !String(key).startsWith('arr') && /^https?:\/\//i.test(String(u)))
    .map(([, u]) => String(u));
  const rpcUrlsFromList = rpcList
    .map((u) => String(u || '').trim())
    .filter((u) => /^https?:\/\//i.test(u));
  let rpcUrls = [...new Set(rpcUrlsFromMap.length ? rpcUrlsFromMap : rpcUrlsFromList)];
  let rpcUrl = rpcUrls[0] || '';
  const chainId = Number(row.current_chain_id);
  if (!rpcUrl && chainId) {
    try {
      rpcUrl = (await require('./rpcProviderService').getRpcUrlByChainId(chainId)) || '';
    } catch {
      rpcUrl = '';
    }
  }
  if (rpcUrl && !rpcUrls.includes(rpcUrl)) {
    rpcUrls = [rpcUrl, ...rpcUrls];
  }
  let walletAddress = null;
  if (pk) {
    try {
      walletAddress = new ethers.Wallet(pk.startsWith('0x') ? pk : `0x${pk}`).address;
    } catch {
      walletAddress = null;
    }
  }
  return {
    configured: Boolean(pk && rpcUrl && scanKey),
    hasPrivateKey: Boolean(pk),
    hasRpcUrl: Boolean(rpcUrl),
    hasEtherscanKey: Boolean(scanKey),
    rpcUrl,
    rpcUrls,
    walletAddress,
  };
}

/**
 * PRIVATE_KEY — в запись книги (deploy_params).
 * RPC_URL — в rpc_providers, та же таблица что /settings/security/rpc.
 */
function collectRpcUrls({ rpcUrl, rpcUrls }) {
  const raw = [];
  if (Array.isArray(rpcUrls)) raw.push(...rpcUrls);
  if (rpcUrl) raw.push(rpcUrl);
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const url = String(item || '').trim();
    if (!url) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

async function saveModuleDeployerCredentials({ dleAddress, rpcUrl, rpcUrls, privateKey, etherscanApiKey }) {
  const row = await findDeployRowByDleAddress(dleAddress);
  if (!row) {
    const err = new Error('Сначала привяжите книгу (auth) или задеплойте её на этой ОС');
    err.code = 'no_tail';
    throw err;
  }

  const cleanKey = String(privateKey || '').trim();
  const urls = collectRpcUrls({ rpcUrl, rpcUrls });
  const scanKey = String(etherscanApiKey || '').trim();
  if (!cleanKey && !urls.length && !scanKey) {
    const err = new Error('Укажите хотя бы RPC_URL, PRIVATE_KEY или ETHERSCAN_API_KEY');
    err.code = 'missing_fields';
    throw err;
  }
  for (const url of urls) {
    if (!/^https?:\/\//i.test(url)) {
      const err = new Error('RPC_URL должен быть http(s)');
      err.code = 'bad_rpc';
      throw err;
    }
  }

  let wallet = null;
  if (cleanKey) {
    try {
      const pk = cleanKey.startsWith('0x') ? cleanKey : `0x${cleanKey}`;
      wallet = new ethers.Wallet(pk);
    } catch {
      const err = new Error('Некорректный PRIVATE_KEY');
      err.code = 'bad_key';
      throw err;
    }
  }

  const existingMap = parseRpcUrlMap(row.rpc_urls || row.rpcUrls);
  let chainIds = row.supported_chain_ids || row.supportedChainIds || [];
  if (typeof chainIds === 'string') {
    try {
      chainIds = JSON.parse(chainIds);
    } catch {
      chainIds = [];
    }
  }
  if (!Array.isArray(chainIds)) chainIds = [];

  const rpcProviderService = require('./rpcProviderService');
  const allRpc = await rpcProviderService.getAllRpcProviders();
  const saved = [];

  for (const url of urls) {
    const provider = new ethers.JsonRpcProvider(url);
    const chainId = Number((await provider.getNetwork()).chainId);
    existingMap[String(chainId)] = url;
    if (!chainIds.map(Number).includes(chainId)) {
      chainIds = [...chainIds, chainId];
    }
    const existingRpc = (allRpc || []).find((p) => Number(p.chain_id) === chainId);
    const networkId = existingRpc?.network_id || chainIdToNetworkId(chainId);
    await rpcProviderService.upsertRpcProvider({
      networkId,
      rpcUrl: url,
      chainId,
    });
    saved.push({ chainId, rpcUrl: url, networkId });
  }

  const salt = row.create2_salt || row.CREATE2_SALT || generateCreate2Salt();
  const first = saved[0];
  const patch = { create2_salt: salt };
  if (wallet) patch.private_key = wallet.privateKey;
  if (scanKey) patch.etherscan_api_key = scanKey;
  if (saved.length) {
    patch.rpc_urls = JSON.stringify(existingMap);
    patch.supported_chain_ids = JSON.stringify(chainIds);
    patch.current_chain_id = row.current_chain_id || first.chainId;
  }

  await encryptedDb.saveData('deploy_params', patch, { deployment_id: row.deployment_id });

  let walletAddress = wallet ? wallet.address : null;
  if (!walletAddress) {
    const pk = row.private_key || row.privateKey;
    if (pk) {
      try {
        walletAddress = new ethers.Wallet(pk.startsWith('0x') ? pk : `0x${pk}`).address;
      } catch {
        walletAddress = null;
      }
    }
  }

  logger.info(
    `[dleAttach] деплой модулей: book=${normalizeAddress(dleAddress)} wallet=${walletAddress || 'unchanged'} rpc=${saved.map((s) => s.chainId).join(',') || 'unchanged'}`
  );
  return {
    walletAddress,
    chainId: first?.chainId || row.current_chain_id,
    rpcUrl: first?.rpcUrl,
    rpcUrls: saved.length ? saved.map((s) => s.rpcUrl) : undefined,
    networkId: first?.networkId,
    deploymentId: row.deployment_id,
  };
}

module.exports = {
  tryAttachFromAuthToken,
  detachIfNoAuthToken,
  detachByDleAddress,
  delistFromOs,
  listAttachedDleAddresses,
  resolveChainId,
  stripDeploymentSecrets,
  syncAuthDoorFromDeployment,
  saveModuleDeployerCredentials,
  getModuleDeployerStatus,
  parseRpcUrlMap,
  findDeployRowByDleAddress,
  normalizeAddress,
  isValidAddress,
};
