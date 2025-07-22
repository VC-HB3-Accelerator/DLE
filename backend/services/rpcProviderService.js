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

const db = require('../db');

async function getAllRpcProviders() {
  const { rows } = await db.getQuery()('SELECT * FROM rpc_providers ORDER BY id');
  return rows;
}

async function saveAllRpcProviders(rpcConfigs) {
  await db.getQuery()('DELETE FROM rpc_providers');
  for (const cfg of rpcConfigs) {
    await db.query(
      'INSERT INTO rpc_providers (network_id, rpc_url, chain_id) VALUES ($1, $2, $3)',
      [cfg.networkId, cfg.rpcUrl, cfg.chainId || null]
    );
  }
}

async function upsertRpcProvider(cfg) {
  await db.query(
    `INSERT INTO rpc_providers (network_id, rpc_url, chain_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (network_id) DO UPDATE SET rpc_url=EXCLUDED.rpc_url, chain_id=EXCLUDED.chain_id`,
    [cfg.networkId, cfg.rpcUrl, cfg.chainId || null]
  );
}

async function deleteRpcProvider(networkId) {
  await db.getQuery()('DELETE FROM rpc_providers WHERE network_id = $1', [networkId]);
}

async function getRpcUrlByNetworkId(networkId) {
  const { rows } = await db.getQuery()('SELECT rpc_url FROM rpc_providers WHERE network_id = $1', [networkId]);
  return rows[0]?.rpc_url || null;
}

module.exports = { getAllRpcProviders, saveAllRpcProviders, upsertRpcProvider, deleteRpcProvider, getRpcUrlByNetworkId }; 