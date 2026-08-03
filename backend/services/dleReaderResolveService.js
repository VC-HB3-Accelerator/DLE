/**
 * Резолв адреса DLEReader: файлы модулей (карточка) → ончейн getModuleAddress(READER).
 * getGovernanceParams / listSupportedChains живут только на Reader, не на DLE.
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { MODULE_IDS } = require('../constants/moduleIds');
const {
  DLE_GET_MODULE_ADDRESS,
  READER_GET_GOVERNANCE_PARAMS,
  READER_LIST_SUPPORTED_CHAINS,
} = require('../constants/dleReadAbi');

const ZERO = ethers.ZeroAddress;

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

/**
 * Адрес reader из contracts-data/modules (если модуль деплоили через нашу систему).
 */
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

/**
 * @param {{ dleAddress: string, provider: import('ethers').Provider, chainId?: number }} opts
 * @returns {Promise<string>} checksum address Reader
 */
async function resolveReaderAddress({ dleAddress, provider, chainId }) {
  if (!dleAddress || !provider) {
    throw new Error('dleAddress и provider обязательны для resolveReaderAddress');
  }

  const fromFiles = lookupReaderFromModulesFiles(dleAddress, chainId);
  if (fromFiles && (await isContract(provider, fromFiles))) {
    return ethers.getAddress(fromFiles);
  }

  const dle = new ethers.Contract(dleAddress, [DLE_GET_MODULE_ADDRESS], provider);
  const onchain = await dle.getModuleAddress(MODULE_IDS.READER);
  if (!(await isContract(provider, onchain))) {
    throw new ReaderNotFoundError(dleAddress);
  }
  return ethers.getAddress(onchain);
}

/**
 * Контракт Reader с ABI governance/chains.
 */
async function getReaderContract({ dleAddress, provider, chainId }) {
  const readerAddress = await resolveReaderAddress({ dleAddress, provider, chainId });
  const reader = new ethers.Contract(
    readerAddress,
    [READER_GET_GOVERNANCE_PARAMS, READER_LIST_SUPPORTED_CHAINS],
    provider
  );
  return { readerAddress, reader };
}

/**
 * Параметры governance через Reader.
 */
async function fetchGovernanceParams({ dleAddress, provider, chainId }) {
  const { readerAddress, reader } = await getReaderContract({ dleAddress, provider, chainId });
  const params = await reader.getGovernanceParams();
  return {
    readerAddress,
    quorumPct: Number(params.quorumPct),
    chainId: Number(params.chainId),
    supportedCount: Number(params.supportedCount),
    totalSupply: params.totalSupply,
    proposalsCount: Number(params.proposalsCount),
  };
}

/**
 * Список chainId через Reader.
 */
async function fetchSupportedChains({ dleAddress, provider, chainId }) {
  const { readerAddress, reader } = await getReaderContract({ dleAddress, provider, chainId });
  const chains = await reader.listSupportedChains();
  return {
    readerAddress,
    chains: chains.map((c) => Number(c)),
  };
}

module.exports = {
  ReaderNotFoundError,
  lookupReaderFromModulesFiles,
  resolveReaderAddress,
  getReaderContract,
  fetchGovernanceParams,
  fetchSupportedChains,
};
