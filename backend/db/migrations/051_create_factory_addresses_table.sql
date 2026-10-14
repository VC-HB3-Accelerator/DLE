-- Create factory addresses table
-- Stores factory contract addresses for each chain

CREATE TABLE IF NOT EXISTS factory_addresses (
  id SERIAL PRIMARY KEY,
  chain_id INTEGER NOT NULL UNIQUE,
  factory_address VARCHAR(42) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_factory_addresses_chain_id ON factory_addresses(chain_id);

-- Add comment
COMMENT ON TABLE factory_addresses IS 'Factory contract addresses for deterministic DLE deployment across chains';
COMMENT ON COLUMN factory_addresses.chain_id IS 'Ethereum chain ID (e.g., 1 for mainnet, 11155111 for Sepolia)';
COMMENT ON COLUMN factory_addresses.factory_address IS 'Factory contract address on this chain';
