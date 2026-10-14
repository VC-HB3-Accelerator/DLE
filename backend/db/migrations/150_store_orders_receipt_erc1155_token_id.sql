-- UP Migration
-- Snapshot ERC-1155 token id on orders for NFT fulfill governance prefill

ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS receipt_erc1155_token_id NUMERIC(78, 0);

-- DOWN Migration
-- ALTER TABLE store_orders DROP COLUMN IF EXISTS receipt_erc1155_token_id;
