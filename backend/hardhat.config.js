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
require('dotenv').config();

function getNetworks() {
  const supported = [
    { id: 'bsc', envUrl: 'BSC_RPC_URL', envKey: 'BSC_PRIVATE_KEY' },
    { id: 'ethereum', envUrl: 'ETHEREUM_RPC_URL', envKey: 'ETHEREUM_PRIVATE_KEY' },
    { id: 'arbitrum', envUrl: 'ARBITRUM_RPC_URL', envKey: 'ARBITRUM_PRIVATE_KEY' },
    { id: 'polygon', envUrl: 'POLYGON_RPC_URL', envKey: 'POLYGON_PRIVATE_KEY' },
    { id: 'sepolia', envUrl: 'SEPOLIA_RPC_URL', envKey: 'SEPOLIA_PRIVATE_KEY' },
  ];
  const networks = {};
  for (const net of supported) {
    if (process.env[net.envUrl] && process.env[net.envKey]) {
      networks[net.id] = {
        url: process.env[net.envUrl],
        accounts: [process.env[net.envKey]],
      };
    }
  }
  return networks;
}

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: getNetworks(),
};
