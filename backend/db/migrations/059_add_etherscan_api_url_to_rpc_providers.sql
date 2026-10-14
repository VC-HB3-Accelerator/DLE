-- Миграция: добавление поля etherscan_api_url в таблицу rpc_providers

-- Добавляем поле для Etherscan API URL
ALTER TABLE rpc_providers 
ADD COLUMN IF NOT EXISTS etherscan_api_url TEXT;

-- Добавляем комментарий к полю
COMMENT ON COLUMN rpc_providers.etherscan_api_url IS 'URL для Etherscan API верификации контрактов';

-- Создаем индекс для быстрого поиска по chain_id
CREATE INDEX IF NOT EXISTS idx_rpc_providers_chain_id ON rpc_providers (chain_id);

-- Обновляем существующие записи с известными Etherscan API URLs
UPDATE rpc_providers SET etherscan_api_url = 'https://api.etherscan.io/api' WHERE chain_id = 1;
UPDATE rpc_providers SET etherscan_api_url = 'https://api-sepolia.etherscan.io/api' WHERE chain_id = 11155111;
UPDATE rpc_providers SET etherscan_api_url = 'https://api-holesky.etherscan.io/api' WHERE chain_id = 17000;
UPDATE rpc_providers SET etherscan_api_url = 'https://api-sepolia.arbiscan.io/api' WHERE chain_id = 421614;
UPDATE rpc_providers SET etherscan_api_url = 'https://api-sepolia.basescan.org/api' WHERE chain_id = 84532;
UPDATE rpc_providers SET etherscan_api_url = 'https://api.bscscan.com/api' WHERE chain_id = 56;
UPDATE rpc_providers SET etherscan_api_url = 'https://api-testnet.bscscan.com/api' WHERE chain_id = 97;
UPDATE rpc_providers SET etherscan_api_url = 'https://api.polygonscan.com/api' WHERE chain_id = 137;
UPDATE rpc_providers SET etherscan_api_url = 'https://api-testnet.polygonscan.com/api' WHERE chain_id = 80001;
UPDATE rpc_providers SET etherscan_api_url = 'https://api-optimistic.etherscan.io/api' WHERE chain_id = 10;
UPDATE rpc_providers SET etherscan_api_url = 'https://api-goerli-optimism.etherscan.io/api' WHERE chain_id = 420;
UPDATE rpc_providers SET etherscan_api_url = 'https://api.ftmscan.com/api' WHERE chain_id = 250;
UPDATE rpc_providers SET etherscan_api_url = 'https://api-testnet.ftmscan.com/api' WHERE chain_id = 4002;
UPDATE rpc_providers SET etherscan_api_url = 'https://api.snowtrace.io/api' WHERE chain_id = 43114;
UPDATE rpc_providers SET etherscan_api_url = 'https://api-testnet.snowtrace.io/api' WHERE chain_id = 43113;
UPDATE rpc_providers SET etherscan_api_url = 'https://api.cronoscan.com/api' WHERE chain_id = 25;
UPDATE rpc_providers SET etherscan_api_url = 'https://api-testnet.cronoscan.com/api' WHERE chain_id = 338;
