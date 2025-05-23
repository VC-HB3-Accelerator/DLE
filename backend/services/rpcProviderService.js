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

module.exports = { getAllRpcProviders, saveAllRpcProviders, upsertRpcProvider, deleteRpcProvider }; 