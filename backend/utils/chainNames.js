/**
 * Человекочитаемые имена сетей по chainId.
 * Это не бизнес-данные с контракта — только UI-лейблы для известных EVM id.
 */

const CHAIN_NAMES = {
  1: 'Ethereum Mainnet',
  56: 'BSC',
  97: 'BSC Testnet',
  137: 'Polygon',
  80001: 'Polygon Mumbai',
  42161: 'Arbitrum One',
  11155111: 'Sepolia Testnet',
  17000: 'Holesky Testnet',
  421614: 'Arbitrum Sepolia',
  84532: 'Base Sepolia',
};

/**
 * @param {number|string|bigint} chainId
 * @returns {string}
 */
function getChainName(chainId) {
  const id = Number(chainId);
  if (!Number.isFinite(id)) return `Chain ${chainId}`;
  return CHAIN_NAMES[id] || `Chain ID: ${id}`;
}

module.exports = {
  CHAIN_NAMES,
  getChainName,
};
