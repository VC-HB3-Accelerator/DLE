/**
 * Resolve RPC provider + chainId for a DLE contract address.
 * Prefer networkLoader supported chains (incl. Sepolia fallback), then optional req/deploy hints.
 */
const { ethers } = require('ethers');
const rpcProviderService = require('./rpcProviderService');
const { getSupportedChainIds } = require('../utils/networkLoader');

/**
 * @param {string} dleAddress
 * @param {{ preferChainId?: number|null, extraChainIds?: number[] }} [opts]
 * @returns {Promise<{ provider: import('ethers').JsonRpcProvider, rpcUrl: string, chainId: number }>}
 */
async function resolveDleProvider(dleAddress, opts = {}) {
  const address = String(dleAddress || '').trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    const err = new Error('Invalid dleAddress');
    err.code = 'INVALID_DLE_ADDRESS';
    throw err;
  }

  const supported = await getSupportedChainIds().catch(() => [11155111, 421614, 84532, 17000]);
  const ordered = [];
  const push = (id) => {
    const n = Number(id);
    if (!Number.isFinite(n) || n <= 0) return;
    if (!ordered.includes(n)) ordered.push(n);
  };

  if (opts.preferChainId != null) push(opts.preferChainId);
  for (const id of opts.extraChainIds || []) push(id);
  for (const id of supported) push(id);
  // always try Sepolia for local HV / public test deployments
  push(11155111);

  let lastError = null;
  for (const cid of ordered) {
    try {
      const url = await rpcProviderService.getRpcUrlByChainId(cid);
      if (!url) continue;
      const provider = new ethers.JsonRpcProvider(url);
      const code = await provider.getCode(address);
      if (code && code !== '0x') {
        return { provider, rpcUrl: url, chainId: cid };
      }
    } catch (e) {
      lastError = e;
    }
  }

  const err = new Error(
    lastError
      ? `Не удалось найти сеть, где по адресу есть контракт (${lastError.message})`
      : 'Не удалось найти сеть, где по адресу есть контракт'
  );
  err.code = 'DLE_NETWORK_NOT_FOUND';
  throw err;
}

module.exports = {
  resolveDleProvider,
};
