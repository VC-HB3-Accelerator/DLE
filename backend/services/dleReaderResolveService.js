/**
 * Резолв адреса DLEReader: файлы модулей (карточка) → ончейн слот reader
 * (канонический ID и legacy padded-ASCII).
 * Governance/chains: Reader, если есть; иначе те же поля с самой книги DLE.
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { resolveBookSlot } = require('../utils/bookModuleSlot');
const {
  DLE_GET_MODULE_ADDRESS,
  DLE_GET_CURRENT_CHAIN_ID,
  DLE_GET_PROPOSALS_COUNT,
  DLE_QUORUM_PERCENTAGE,
  DLE_GET_SUPPORTED_CHAIN_COUNT,
  DLE_GET_SUPPORTED_CHAIN_ID,
  DLE_TOTAL_SUPPLY,
  READER_GET_GOVERNANCE_PARAMS,
  READER_LIST_SUPPORTED_CHAINS,
} = require('../constants/dleReadAbi');

const ZERO = ethers.ZeroAddress;

const DLE_CHAIN_ABI = [
  DLE_GET_CURRENT_CHAIN_ID,
  DLE_GET_PROPOSALS_COUNT,
  DLE_QUORUM_PERCENTAGE,
  DLE_GET_SUPPORTED_CHAIN_COUNT,
  DLE_GET_SUPPORTED_CHAIN_ID,
  DLE_TOTAL_SUPPLY,
  DLE_GET_MODULE_ADDRESS,
];

class ReaderNotFoundError extends Error {
  constructor(dleAddress) {
    super(
      `DLEReader не найден для DLE ${dleAddress}. `
      + 'Сначала задеплойте модуль reader и зарегистрируйте его через getModuleAddress.'
    );
    this.name = 'ReaderNotFoundError';
    this.code = 'READER_NOT_FOUND';
    this.dleAddress = dleAddress;
    this.statusCode = 404;
  }
}

function lookupReaderFromModulesFiles(dleAddress, chainId) {
  const modulesDir = path.join(__dirname, '../scripts/contracts-data/modules');
  if (!fs.existsSync(modulesDir)) return null;

  const needle = String(dleAddress).toLowerCase();
  const files = fs.readdirSync(modulesDir).filter(
    (f) => f.endsWith('.json') && f.toLowerCase().includes(needle)
  );

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(modulesDir, file), 'utf8'));
      if (String(data.moduleType || '').toLowerCase() !== 'reader') continue;

      const networks = Array.isArray(data.networks) ? data.networks : [];
      if (chainId != null) {
        const hit = networks.find(
          (n) => Number(n.chainId) === Number(chainId) && n.address && n.address !== ZERO
        );
        if (hit) return hit.address;
      }
      const any = networks.find((n) => n.address && n.address !== ZERO);
      if (any) return any.address;
      if (data.moduleAddress && data.moduleAddress !== ZERO) return data.moduleAddress;
    } catch (_) {
      /* skip broken file */
    }
  }
  return null;
}

async function isContract(provider, address) {
  if (!address || address === ZERO) return false;
  try {
    const code = await provider.getCode(address);
    return Boolean(code && code !== '0x');
  } catch (_) {
    return false;
  }
}

async function resolveReaderAddress({ dleAddress, provider, chainId }) {
  if (!dleAddress || !provider) {
    throw new Error('dleAddress и provider обязательны для resolveReaderAddress');
  }

  const fromFiles = lookupReaderFromModulesFiles(dleAddress, chainId);
  if (fromFiles && (await isContract(provider, fromFiles))) {
    return ethers.getAddress(fromFiles);
  }

  const dle = new ethers.Contract(dleAddress, [DLE_GET_MODULE_ADDRESS], provider);
  const slot = await resolveBookSlot(dle, 'reader');
  if (!(await isContract(provider, slot.moduleAddress))) {
    throw new ReaderNotFoundError(dleAddress);
  }
  return ethers.getAddress(slot.moduleAddress);
}

async function getReaderContract({ dleAddress, provider, chainId }) {
  const readerAddress = await resolveReaderAddress({ dleAddress, provider, chainId });
  const reader = new ethers.Contract(
    readerAddress,
    [READER_GET_GOVERNANCE_PARAMS, READER_LIST_SUPPORTED_CHAINS],
    provider
  );
  return { readerAddress, reader };
}

async function listSupportedChainsFromDle(dleAddress, provider) {
  const dle = new ethers.Contract(dleAddress, DLE_CHAIN_ABI, provider);
  const n = Number(await dle.getSupportedChainCount());
  const chains = [];
  for (let i = 0; i < n; i++) {
    chains.push(Number(await dle.getSupportedChainId(i)));
  }
  return chains;
}

async function fetchGovernanceParamsFromDle(dleAddress, provider) {
  const dle = new ethers.Contract(dleAddress, DLE_CHAIN_ABI, provider);
  const chains = await listSupportedChainsFromDle(dleAddress, provider);
  return {
    readerAddress: null,
    source: 'dle',
    quorumPct: Number(await dle.quorumPercentage()),
    chainId: Number(await dle.getCurrentChainId()),
    supportedCount: chains.length,
    totalSupply: await dle.totalSupply(),
    proposalsCount: Number(await dle.getProposalsCount()),
  };
}

async function fetchGovernanceParams({ dleAddress, provider, chainId }) {
  try {
    const { readerAddress, reader } = await getReaderContract({ dleAddress, provider, chainId });
    const params = await reader.getGovernanceParams();
    return {
      readerAddress,
      source: 'reader',
      quorumPct: Number(params.quorumPct),
      chainId: Number(params.chainId),
      supportedCount: Number(params.supportedCount),
      totalSupply: params.totalSupply,
      proposalsCount: Number(params.proposalsCount),
    };
  } catch (e) {
    if (e instanceof ReaderNotFoundError || e.code === 'READER_NOT_FOUND') {
      console.log(`[ReaderResolve] governance с книги DLE (reader нет): ${e.message}`);
      return fetchGovernanceParamsFromDle(dleAddress, provider);
    }
    throw e;
  }
}

async function fetchSupportedChains({ dleAddress, provider, chainId }) {
  try {
    const { readerAddress, reader } = await getReaderContract({ dleAddress, provider, chainId });
    const chains = await reader.listSupportedChains();
    return {
      readerAddress,
      source: 'reader',
      chains: chains.map((c) => Number(c)),
    };
  } catch (e) {
    if (e instanceof ReaderNotFoundError || e.code === 'READER_NOT_FOUND') {
      console.log(`[ReaderResolve] сети с книги DLE (reader нет): ${e.message}`);
      const chains = await listSupportedChainsFromDle(dleAddress, provider);
      return { readerAddress: null, source: 'dle', chains };
    }
    throw e;
  }
}

module.exports = {
  ReaderNotFoundError,
  lookupReaderFromModulesFiles,
  resolveReaderAddress,
  getReaderContract,
  fetchGovernanceParams,
  fetchSupportedChains,
  listSupportedChainsFromDle,
};
