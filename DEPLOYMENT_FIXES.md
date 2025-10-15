# Исправления ошибок деплоя DLE

## Проблема
Ошибки `Cannot access 'chainId' before initialization` в скриптах деплоя из-за неправильного использования переменных.

## Источник данных
**База данных `deploy_params`:**
- `supported_chain_ids`: `[421614, 84532, 11155111, 17000]` (числовые chainId)
- `rpc_urls`: `["https://sepolia-rollup.arbitrum.io/rpc", ...]` (строки URL)

## Исправления

### 1. deploy-multichain.js
- **Функция `deployInNetwork(chainId, ...)`**
- **Было:** `const networkChainId = Number(net.chainId)` + использование `networkChainId`
- **Стало:** Использование параметра `chainId` напрямую
- **Причина:** `chainId` уже приходит как числовой параметр из `supportedChainIds` базы данных

### 2. deploy-modules.js
- **Функция `deployModuleInNetwork(rpcUrl, ...)`**
- **Было:** `createRPCConnection(rpcUrl, ...)` - неправильно
- **Стало:** Получение `chainId` из RPC URL + `createRPCConnection(chainId, ...)`
- **Функция `deployAllModulesInNetwork(chainId, ...)`**
- **Было:** Создание `networkChainId` + использование его
- **Стало:** Использование параметра `chainId` напрямую

### 3. DleDeployFormView.vue
- **Было:** `adminTokenCheck` использовался в watcher до объявления
- **Стало:** Объявление `adminTokenCheck` перед watcher'ом

## Логика работы
1. База данных → `params.supportedChainIds` (числовые chainId)
2. `createMultipleRPCConnections(supportedChainIds, ...)` 
3. `connection.network.chainId` возвращает тот же числовой chainId
4. `deployInNetwork(chainId, ...)` получает числовой chainId как параметр
5. **Внутри функций используем `chainId` (параметр), НЕ создаем `networkChainId`**

## Результат
✅ Все ошибки инициализации переменных исправлены
✅ Система готова к работе без ошибок `Cannot access before initialization`
