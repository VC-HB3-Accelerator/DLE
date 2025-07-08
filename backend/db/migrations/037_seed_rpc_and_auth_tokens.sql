-- Миграция: наполнение таблиц rpc_providers и auth_tokens начальными значениями

-- Добавление RPC-провайдеров
INSERT INTO rpc_providers (network_id, rpc_url, chain_id)
VALUES
  ('bsc', 'https://bsc-mainnet.nodereal.io/v1/56dec8028bae4f26b76099a42dae2b52', 56),
  ('ethereum', 'https://eth-mainnet.nodereal.io/v1/56dec8028bae4f26b76099a42dae2b52', 1),
  ('arbitrum', 'https://arb1.arbitrum.io/rpc', 42161),
  ('polygon', 'https://polygon.drpc.org', 137),
  ('sepolia', 'https://eth-sepolia.nodereal.io/v1/56dec8028bae4f26b76099a42dae2b52', 11155111)
ON CONFLICT (network_id) DO NOTHING;

-- Добавление токенов для аутентификации админа
INSERT INTO auth_tokens (name, address, network, min_balance)
VALUES
  ('HB3A',  '0x4b294265720b09ca39bfba18c7e368413c0f68eb', 'bsc',      10.0),
  ('HB3A',  '0xd95a45fc46a7300e6022885afec3d618d7d3f27c', 'ethereum', 10.0),
  ('test2', '0xef49261169B454f191678D2aFC5E91Ad2e85dfD8', 'sepolia',  50.0),
  ('HB3A',  '0x351f59de4fedbdf7601f5592b93db3b9330c1c1d', 'polygon',  10.0),
  ('HB3A',  '0xdCe769b847a0a697239777D0B1C7dd33b6012ba0', 'arbitrum', 100.0)
ON CONFLICT (address, network) DO NOTHING; 