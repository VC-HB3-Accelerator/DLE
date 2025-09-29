/**
 * Конфигурации сетей блокчейна для DLE
 * 
 * Author: HB3 Accelerator
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/HB3-ACCELERATOR
 */

export const SUPPORTED_NETWORKS = {
  1: {
    chainId: '0x1',
    chainName: 'Ethereum Mainnet',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://mainnet.infura.io/v3/'],
    blockExplorerUrls: ['https://etherscan.io'],
  },
  11155111: {
    chainId: '0xaa36a7',
    chainName: 'Sepolia',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://sepolia.infura.io/v3/', 'https://1rpc.io/sepolia'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
  17000: {
    chainId: '0x4268',
    chainName: 'Holesky',
    nativeCurrency: {
      name: 'Holesky Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://ethereum-holesky.publicnode.com'],
    blockExplorerUrls: ['https://holesky.etherscan.io'],
  },
  421614: {
    chainId: '0x66eee',
    chainName: 'Arbitrum Sepolia',
    nativeCurrency: {
      name: 'Arbitrum Sepolia Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://sepolia.arbiscan.io'],
  },
  84532: {
    chainId: '0x14a34',
    chainName: 'Base Sepolia',
    nativeCurrency: {
      name: 'Base Sepolia Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://sepolia.base.org'],
    blockExplorerUrls: ['https://sepolia.basescan.org'],
  },
  8453: {
    chainId: '0x2105',
    chainName: 'Base',
    nativeCurrency: {
      name: 'Base Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org'],
  },
};

/**
 * Получить конфигурацию сети по chainId
 * @param {number|string} chainId - ID сети
 * @returns {Object|null} - Конфигурация сети или null
 */
export function getNetworkConfig(chainId) {
  const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 16) : chainId;
  return SUPPORTED_NETWORKS[numericChainId] || null;
}

/**
 * Получить hex представление chainId
 * @param {number} chainId - ID сети
 * @returns {string} - Hex представление
 */
export function getHexChainId(chainId) {
  return `0x${chainId.toString(16)}`;
}

/**
 * Проверить, поддерживается ли сеть
 * @param {number|string} chainId - ID сети
 * @returns {boolean} - Поддерживается ли сеть
 */
export function isNetworkSupported(chainId) {
  return getNetworkConfig(chainId) !== null;
}
