/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/HB3-ACCELERATOR
 */

require('@nomicfoundation/hardhat-toolbox');
require('@nomicfoundation/hardhat-verify');
require('hardhat-contract-sizer');
require('dotenv').config();

function getNetworks() {
  // Базовая конфигурация сетей для верификации
  return {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || 'https://1rpc.io/sepolia',
      chainId: 11155111,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    holesky: {
      url: process.env.HOLESKY_RPC_URL || 'https://ethereum-holesky.publicnode.com',
      chainId: 17000,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || 'https://eth-mainnet.nodereal.io/v1/YOUR_NODEREAL_KEY',
      chainId: 1,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    arbitrumSepolia: {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
      chainId: 421614,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
      chainId: 84532,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  };
}

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 0  // Максимальная оптимизация размера
      },
      viaIR: true,
      evmVersion: "paris"
    }
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
  
  // Автокомпиляция при изменениях
  watch: {
    compilation: {
      tasks: ["compile"],
      files: ["./contracts/**/*.sol"],
      verbose: true
    }
  },
  networks: getNetworks(),
  etherscan: {
    // Единый API ключ для V2 API
    apiKey: process.env.ETHERSCAN_API_KEY || '',
    customChains: [
      {
        network: "sepolia",
        chainId: 11155111,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://sepolia.etherscan.io"
        }
      },
      {
        network: "holesky", 
        chainId: 17000,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://holesky.etherscan.io"
        }
      },
      {
        network: "polygon",
        chainId: 137,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://polygonscan.com"
        }
      },
      {
        network: "arbitrumOne",
        chainId: 42161,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://arbiscan.io"
        }
      },
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://sepolia.arbiscan.io"
        }
      },
      {
        network: "bsc",
        chainId: 56,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://bscscan.com"
        }
      },
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://basescan.org"
        }
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://sepolia.basescan.org"
        }
      }
    ]
  },
  sourcify: {
    enabled: true  // Включаем Sourcify для децентрализованной верификации
  },
  solidityCoverage: {
    excludeContracts: [],
    skipFiles: [],
    // Исключаем строки с revert функциями из покрытия
    excludeLines: [
      '// coverage:ignore-line',
      'revert ErrTransfersDisabled();',
      'revert ErrApprovalsDisabled();'
    ]
  }
};
