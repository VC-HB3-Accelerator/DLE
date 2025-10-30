/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

require('@nomicfoundation/hardhat-toolbox');
require('@nomicfoundation/hardhat-verify');
require('hardhat-contract-sizer');
require('dotenv').config();

function getNetworks() {
  // Синхронная загрузка сетей из переменных окружения
  // Hardhat не поддерживает асинхронную инициализацию конфигурации
  
  // Получаем supported_chain_ids из переменных окружения
  const supportedChainIdsEnv = process.env.SUPPORTED_CHAIN_IDS;
  const supportedChainIds = supportedChainIdsEnv ? JSON.parse(supportedChainIdsEnv) : [];
  
  // Получаем RPC URLs из переменных окружения
  const rpcUrlsEnv = process.env.RPC_URLS;
  const rpcUrls = rpcUrlsEnv ? JSON.parse(rpcUrlsEnv) : {};
  
  // console.log удален - может мешать flatten
  
  // Базовые сети - УБРАНО, используем только базу данных
  const baseNetworks = {}; // Пустой объект - никаких хардкод цепочек
  
  // Если есть supported_chain_ids, фильтруем только нужные сети
  if (supportedChainIds.length > 0) {
    const networks = {};
    const supportedChainIdsNumbers = supportedChainIds.map(id => Number(id));
    
    for (const [networkName, networkConfig] of Object.entries(baseNetworks)) {
      if (supportedChainIdsNumbers.includes(networkConfig.chainId)) {
        // Используем RPC URL из переменных окружения если есть
        const customRpcUrl = rpcUrls[networkConfig.chainId] || rpcUrls[networkConfig.chainId.toString()];
        if (customRpcUrl) {
          networkConfig.url = customRpcUrl;
          // console.log удален - может мешать flatten
        }
        networks[networkName] = networkConfig;
      }
    }
    
    // console.log удален - может мешать flatten
    return networks;
  } else {
    // Если нет supported_chain_ids, используем все базовые сети
    // console.log удален - может мешать flatten
    return baseNetworks;
  }
}

// Функция для получения базовых сетей (fallback) - УБРАНО, используем только базу данных
function getBaseNetworks() {
  return {}; // Пустой объект - никаких хардкод цепочек
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
    // Единый API ключ для всех сетей (V2 API)
    apiKey: process.env.ETHERSCAN_API_KEY || '',
    customChains: [
      {
        network: "sepolia",
        chainId: 11155111,
        urls: {
          apiURL: "https://api-sepolia.etherscan.io/api",
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
          apiURL: "https://api.etherscan.io/v2/api?chainid=421614",
          browserURL: "https://sepolia.arbiscan.io"
        }
      },
      {
        network: "bsc",
        chainId: 56,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=56",
          browserURL: "https://bscscan.com"
        }
      },
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=8453",
          browserURL: "https://basescan.org"
        }
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=84532",
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
