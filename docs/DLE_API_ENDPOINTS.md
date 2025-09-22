<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

# API Endpoints для обновленного смарт контракта DLE

## Обзор

Данный документ содержит полный список всех API endpoints, созданных для работы с обновленным смарт контрактом DLE (Digital Legal Entity). Все endpoints находятся в файле `backend/routes/blockchain.js` и обеспечивают полное покрытие функциональности смарт контракта.

## Структура ответов

Все API endpoints возвращают ответы в следующем формате:

```javascript
// Успешный ответ
{
  "success": true,
  "data": {
    // Данные ответа
  }
}

// Ошибка
{
  "success": false,
  "error": "Описание ошибки"
}
```

---

## 📋 Основные функции DLE

### 1. Чтение данных DLE из блокчейна
```http
POST /blockchain/read-dle-info
```

**Описание:** Получение основной информации о DLE из блокчейна.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "name": "Название DLE",
    "symbol": "DLE",
    "totalSupply": "1000000000000000000000000",
    "quorumPercentage": 51,
    "currentChainId": 11155111,
    "isActive": true
  }
}
```

### 2. Получение параметров управления
```http
POST /blockchain/get-governance-params
```

**Описание:** Получение параметров управления DLE.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "quorumPercentage": 51,
    "chainId": 11155111,
    "supportedCount": 3
  }
}
```

### 3. Проверка активности DLE
```http
POST /blockchain/is-active
```

**Описание:** Проверка активности DLE контракта.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "isActive": true
  }
}
```

---

## 🗳️ Управление предложениями

### 4. Получение списка предложений
```http
POST /blockchain/get-proposals
```

**Описание:** Получение списка всех предложений DLE.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "proposals": [
      {
        "id": 1,
        "description": "Описание предложения",
        "state": 1,
        "forVotes": "1000000000000000000000",
        "againstVotes": "0",
        "totalVotes": "1000000000000000000000"
      }
    ]
  }
}
```

### 5. Получение информации о предложении
```http
POST /blockchain/get-proposal-info
```

**Описание:** Получение детальной информации о конкретном предложении.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `proposalId` (number) - ID предложения

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "proposalId": 1,
    "description": "Описание предложения",
    "duration": 86400,
    "operation": "0x...",
    "governanceChainId": 11155111,
    "targetChains": [11155111, 137],
    "state": 1,
    "forVotes": "1000000000000000000000",
    "againstVotes": "0",
    "totalVotes": "1000000000000000000000",
    "quorumRequired": "510000000000000000000"
  }
}
```

### 6. Получение данных для создания предложения
```http
POST /blockchain/create-proposal
```

**Описание:** Получение данных для создания нового предложения. Фактическое создание выполняется через frontend с MetaMask.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `description` (string) - Описание предложения
- `duration` (number) - Продолжительность голосования в секундах
- `operation` (string) - Операция в формате bytes
- `governanceChainId` (number) - ID сети управления
- `targetChains` (array) - Массив целевых сетей
- `userAddress` (string) - Адрес пользователя

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "proposalData": {
      "dleAddress": "0x...",
      "description": "Новое предложение",
      "duration": 86400,
      "operation": "0x...",
      "governanceChainId": 11155111,
      "targetChains": [11155111, 137],
      "userAddress": "0x...",
      "timelockDelay": 0
    },
    "message": "Используйте функцию createProposal из dle-contract.js для создания предложения через MetaMask"
  }
}
```

### 7. Голосование за предложение
```http
POST /blockchain/vote-proposal
```

**Описание:** Голосование за предложение.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `proposalId` (number) - ID предложения
- `support` (boolean) - Поддержка (true/false)
- `userAddress` (string) - Адрес пользователя

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "transactionHash": "0x..."
  }
}
```

### 8. Исполнение предложения
```http
POST /blockchain/execute-proposal
```

**Описание:** Исполнение предложения.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `proposalId` (number) - ID предложения
- `userAddress` (string) - Адрес пользователя

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "transactionHash": "0x..."
  }
}
```

### 9. Отмена предложения
```http
POST /blockchain/cancel-proposal
```

**Описание:** Отмена предложения.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `proposalId` (number) - ID предложения
- `reason` (string) - Причина отмены
- `userAddress` (string) - Адрес пользователя

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "transactionHash": "0x..."
  }
}
```

### 10. Получение состояния предложения
```http
POST /blockchain/get-proposal-state
```

**Описание:** Получение текущего состояния предложения.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `proposalId` (number) - ID предложения

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "proposalId": 1,
    "state": 1
  }
}
```

### 11. Получение голосов по предложению
```http
POST /blockchain/get-proposal-votes
```

**Описание:** Получение статистики голосования по предложению.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `proposalId` (number) - ID предложения

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "proposalId": 1,
    "forVotes": "1000000000000000000000",
    "againstVotes": "0",
    "totalVotes": "1000000000000000000000",
    "quorumRequired": "510000000000000000000"
  }
}
```

### 12. Проверка результата предложения
```http
POST /blockchain/check-proposal-result
```

**Описание:** Проверка результата голосования по предложению.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `proposalId` (number) - ID предложения

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "proposalId": 1,
    "passed": true,
    "quorumReached": true
  }
}
```

### 13. Получение количества предложений
```http
POST /blockchain/get-proposals-count
```

**Описание:** Получение общего количества предложений.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "count": 5
  }
}
```

### 14. Получение списка предложений с пагинацией
```http
POST /blockchain/list-proposals
```

**Описание:** Получение списка предложений с поддержкой пагинации.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `offset` (number) - Смещение
- `limit` (number) - Лимит

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "proposals": [1, 2, 3],
    "offset": 0,
    "limit": 10
  }
}
```

---

## 🔧 Управление модулями

### 15. Создание предложения добавления модуля
```http
POST /blockchain/create-add-module-proposal
```

**Описание:** Создание предложения для добавления нового модуля.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `moduleId` (string) - ID модуля
- `moduleAddress` (string) - Адрес модуля
- `userAddress` (string) - Адрес пользователя

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "proposalId": 1,
    "transactionHash": "0x..."
  }
}
```

### 16. Создание предложения удаления модуля
```http
POST /blockchain/create-remove-module-proposal
```

**Описание:** Создание предложения для удаления модуля.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `moduleId` (string) - ID модуля
- `userAddress` (string) - Адрес пользователя

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "proposalId": 1,
    "transactionHash": "0x..."
  }
}
```

### 17. Проверка активности модуля
```http
POST /blockchain/is-module-active
```

**Описание:** Проверка активности модуля.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `moduleId` (string) - ID модуля

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "moduleId": "0x...",
    "isActive": true
  }
}
```

### 18. Получение адреса модуля
```http
POST /blockchain/get-module-address
```

**Описание:** Получение адреса модуля по его ID.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `moduleId` (string) - ID модуля

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "moduleId": "0x...",
    "moduleAddress": "0x..."
  }
}
```

---

## 🌐 Мульти-чейн функциональность

### 19. Получение поддерживаемых сетей
```http
POST /blockchain/get-supported-chains
```

**Описание:** Получение списка поддерживаемых сетей.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "supportedChains": [11155111, 137, 1]
  }
}
```

### 20. Проверка поддержки сети
```http
POST /blockchain/is-chain-supported
```

**Описание:** Проверка поддержки конкретной сети.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `chainId` (number) - ID сети

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "chainId": 11155111,
    "isSupported": true
  }
}
```

### 21. Получение текущей сети
```http
POST /blockchain/get-current-chain-id
```

**Описание:** Получение ID текущей сети.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "currentChainId": 11155111
  }
}
```

### 22. Исполнение предложения по подписям
```http
POST /blockchain/execute-proposal-by-signatures
```

**Описание:** Исполнение предложения с использованием подписей.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `proposalId` (number) - ID предложения
- `signers` (array) - Массив адресов подписантов
- `signatures` (array) - Массив подписей
- `userAddress` (string) - Адрес пользователя

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "transactionHash": "0x..."
  }
}
```

### 23. Проверка подключения к сети
```http
POST /blockchain/check-chain-connection
```

**Описание:** Проверка доступности подключения к сети.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `chainId` (number) - ID сети

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "chainId": 11155111,
    "isAvailable": true
  }
}
```

### 24. Синхронизация во все сети
```http
POST /blockchain/sync-to-all-chains
```

**Описание:** Синхронизация предложения во все поддерживаемые сети.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `proposalId` (number) - ID предложения
- `userAddress` (string) - Адрес пользователя

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "transactionHash": "0x..."
  }
}
```

### 25. Получение количества поддерживаемых сетей
```http
POST /blockchain/get-supported-chain-count
```

**Описание:** Получение количества поддерживаемых сетей.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "count": 3
  }
}
```

### 26. Получение ID поддерживаемой сети по индексу
```http
POST /blockchain/get-supported-chain-id
```

**Описание:** Получение ID поддерживаемой сети по индексу.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `index` (number) - Индекс сети

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "index": 0,
    "chainId": 11155111
  }
}
```

---

## 📊 Аналитика и пагинация

### 27. Получение голосующей силы на момент времени
```http
POST /blockchain/get-voting-power-at
```

**Описание:** Получение голосующей силы пользователя на определенный момент времени.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `voter` (string) - Адрес голосующего
- `timepoint` (number) - Момент времени

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "voter": "0x...",
    "timepoint": 1234567890,
    "votingPower": "1000000000000000000000"
  }
}
```

### 28. Получение требуемого кворума на момент времени
```http
POST /blockchain/get-quorum-at
```

**Описание:** Получение требуемого кворума на определенный момент времени.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `timepoint` (number) - Момент времени

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "timepoint": 1234567890,
    "quorum": "510000000000000000000"
  }
}
```

---

## 🪙 Токены и балансы

### 29. Получение баланса токенов
```http
POST /blockchain/get-token-balance
```

**Описание:** Получение баланса токенов пользователя.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта
- `account` (string) - Адрес аккаунта

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "account": "0x...",
    "balance": "1000.0"
  }
}
```

### 30. Получение общего предложения токенов
```http
POST /blockchain/get-total-supply
```

**Описание:** Получение общего предложения токенов DLE.

**Параметры:**
- `dleAddress` (string) - Адрес DLE контракта

**Ответ:**
```javascript
{
  "success": true,
  "data": {
    "totalSupply": "1000000.0"
  }
}
```

---

## 🔗 Frontend сервисы

Для работы с API endpoints созданы следующие сервисы в frontend:

### 1. dleV2Service.js
Основной сервис для работы с DLE, содержащий все функции для взаимодействия с API.

### 2. tokens.js
Сервис для работы с токенами и балансами.

### 3. proposalsService.js
Сервис для работы с предложениями и голосованием.

### 4. modulesService.js
Сервис для работы с модулями DLE.

### 5. analyticsService.js
Сервис для работы с аналитикой и статистикой.

### 6. multichainService.js
Сервис для работы с мульти-чейн функциональностью.

## 🔐 Выполнение транзакций через MetaMask

Для выполнения транзакций (создание предложений, голосование, исполнение) используется файл `frontend/src/utils/dle-contract.js` с функциями:

### Основные функции для транзакций:

```javascript
// Создание предложения
import { createProposal } from '@/utils/dle-contract.js';
const result = await createProposal(dleAddress, proposalData);

// Голосование за предложение
import { voteForProposal } from '@/utils/dle-contract.js';
const result = await voteForProposal(dleAddress, proposalId, support);

// Исполнение предложения
import { executeProposal } from '@/utils/dle-contract.js';
const result = await executeProposal(dleAddress, proposalId);

// Проверка подключения к кошельку
import { checkWalletConnection } from '@/utils/dle-contract.js';
const walletInfo = await checkWalletConnection();
```

### Пример использования:

```javascript
// 1. Получаем данные для создания предложения от backend
const response = await fetch('/api/blockchain/create-proposal', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    dleAddress: '0x...',
    description: 'Новое предложение',
    duration: 86400,
    operation: '0x...',
    governanceChainId: 11155111,
    targetChains: [11155111, 137],
    userAddress: '0x...'
  })
});

const { proposalData } = response.data;

// 2. Создаем предложение через MetaMask
import { createProposal } from '@/utils/dle-contract.js';
const result = await createProposal(proposalData.dleAddress, proposalData);
console.log('Предложение создано:', result.txHash);
```

**Важно:** Все транзакции выполняются через MetaMask или другой Web3 кошелек для обеспечения безопасности пользователей.

---

## 📋 Состояния предложений

Справочник состояний предложений:

- `0` - Pending (Ожидает)
- `1` - Active (Активно)
- `2` - Canceled (Отменено)
- `3` - Defeated (Отклонено)
- `4` - Succeeded (Успешно)
- `5` - Queued (В очереди)
- `6` - Expired (Истекло)
- `7` - Executed (Исполнено)

---

## 🚀 Использование

Все API endpoints используют:
- **Сеть:** Sepolia (Chain ID: 11155111)
- **Формат:** JSON
- **Метод:** POST
- **Базовый URL:** `http://localhost:8000` (backend) или `/api` (через frontend proxy)

### Пример использования:

```javascript
// Создание предложения (через frontend proxy)
const response = await fetch('/api/blockchain/create-proposal', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    dleAddress: '0x...',
    description: 'Новое предложение',
    duration: 86400,
    operation: '0x...',
    governanceChainId: 11155111,
    targetChains: [11155111, 137],
    userAddress: '0x...'
  })
});

const result = await response.json();

// Или напрямую к backend
const response = await fetch('http://localhost:8000/blockchain/create-proposal', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    dleAddress: '0x...',
    description: 'Новое предложение',
    duration: 86400,
    operation: '0x...',
    governanceChainId: 11155111,
    targetChains: [11155111, 137],
    userAddress: '0x...'
  })
});

const result = await response.json();
```

---

## ✅ Покрытие функций смарт контракта

Все функции смарт контракта `DLE.sol` имеют соответствующие API endpoints:

| Функция смарт контракта | API Endpoint | Статус |
|-------------------------|--------------|--------|
| `getDLEInfo()` | `read-dle-info` | ✅ |
| `getGovernanceParams()` | `get-governance-params` | ✅ |
| `isActive()` | `is-active` | ✅ |
| `createProposal()` | `create-proposal` | ✅ |
| `vote()` | `vote-proposal` | ✅ |
| `executeProposal()` | `execute-proposal` | ✅ |
| `cancelProposal()` | `cancel-proposal` | ✅ |
| `getProposalSummary()` | `get-proposal-info` | ✅ |
| `getProposalState()` | `get-proposal-state` | ✅ |
| `getProposalVotes()` | `get-proposal-votes` | ✅ |
| `checkProposalResult()` | `check-proposal-result` | ✅ |
| `getProposalsCount()` | `get-proposals-count` | ✅ |
| `listProposals()` | `list-proposals` | ✅ |
| `getVotingPowerAt()` | `get-voting-power-at` | ✅ |
| `getQuorumAt()` | `get-quorum-at` | ✅ |
| `createAddModuleProposal()` | `create-add-module-proposal` | ✅ |
| `createRemoveModuleProposal()` | `create-remove-module-proposal` | ✅ |
| `isModuleActive()` | `is-module-active` | ✅ |
| `getModuleAddress()` | `get-module-address` | ✅ |
| `listSupportedChains()` | `get-supported-chains` | ✅ |
| `isChainSupported()` | `is-chain-supported` | ✅ |
| `getCurrentChainId()` | `get-current-chain-id` | ✅ |
| `executeProposalBySignatures()` | `execute-proposal-by-signatures` | ✅ |
| `checkChainConnection()` | `check-chain-connection` | ✅ |
| `syncToAllChains()` | `sync-to-all-chains` | ✅ |
| `getSupportedChainCount()` | `get-supported-chain-count` | ✅ |
| `getSupportedChainId()` | `get-supported-chain-id` | ✅ |
| `balanceOf()` | `get-token-balance` | ✅ |
| `totalSupply()` | `get-total-supply` | ✅ |

---

## 🎯 Итог

**Полное покрытие функциональности смарт контракта DLE достигнуто!**

- ✅ **30 API endpoints** создано
- ✅ **6 frontend сервисов** создано
- ✅ **100% покрытие** функций смарт контракта
- ✅ **Готово к использованию** в интерфейсе управления

Система полностью готова для работы с обновленным функционалом смарт контракта DLE! 🚀
