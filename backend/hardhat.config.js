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
require('hardhat-contract-sizer');
require('dotenv').config();

function getNetworks() {
  // Возвращаем пустой объект, чтобы Hardhat не зависел от переменных окружения
  // Сети будут настраиваться динамически в deploy-multichain.js
  return {};
}

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1  // Максимальная оптимизация размера для mainnet
      },
      viaIR: true
    }
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
  networks: getNetworks(),
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || '',
      mainnet: process.env.ETHERSCAN_API_KEY || '',
      polygon: process.env.POLYGONSCAN_API_KEY || '',
      arbitrumOne: process.env.ARBISCAN_API_KEY || '',
      bsc: process.env.BSCSCAN_API_KEY || '',
      base: process.env.BASESCAN_API_KEY || '',
      baseSepolia: process.env.BASESCAN_API_KEY || '',
      arbitrumSepolia: process.env.ARBISCAN_API_KEY || '',
    }
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
