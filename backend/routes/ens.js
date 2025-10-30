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

/**
 * ENS utilities: resolve avatar URL for a given ENS name
 */
const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');

async function getMainnetProvider() {
  try {
    // Получаем RPC URL из базы данных для mainnet (chain_id = 1)
    const rpcService = require('../services/rpcProviderService');
    const rpcUrl = await rpcService.getRpcUrlByChainId(1);
    
    if (!rpcUrl) {
      throw new Error('RPC URL для mainnet не найден в базе данных');
    }
    
    console.log(`[ENS] Используем RPC из базы данных: ${rpcUrl}`);
    return new ethers.JsonRpcProvider(await rpcService.getRpcUrlByChainId(1));
    
  } catch (error) {
    console.error(`[ENS] Ошибка получения RPC из базы данных:`, error);
    throw new Error(`Не удалось получить RPC провайдер: ${error.message}`);
  }
}

// GET /api/ens/avatar?name=vc-hb3-accelerator.eth
router.get('/avatar', async (req, res) => {
  try {
    const name = String(req.query.name || '').trim();
    if (!name || !name.endsWith('.eth')) {
      return res.status(400).json({ success: false, message: 'ENS name is required (e.g., example.eth)' });
    }
    const provider = await getMainnetProvider();
    const url = await provider.getAvatar(name);
    return res.json({ success: true, data: { url: url || null } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;


