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

import api from '../api/axios';

// Получение балансов токенов
export const fetchTokenBalances = async (address = null) => {
  try {
    let url = '/tokens/balances';
    if (address) {
      url += `?address=${encodeURIComponent(address)}`;
      // console.log(`Fetching token balances for specific address: ${address}`);
    } else {
              // console.log('Fetching token balances for session user');
    }
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    // console.error('Error fetching token balances:', error);
    return {
      eth: '0',
      bsc: '0',
      arbitrum: '0',
      polygon: '0',
      sepolia: '0',
    };
  }
};
