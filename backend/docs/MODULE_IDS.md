# ID Модулей DLE

## Обзор

В системе DLE каждый модуль имеет уникальный идентификатор (ID), который используется для:
- Идентификации модуля в смарт-контракте
- Создания governance предложений
- Проверки статуса модуля

## Формат ID

ID модулей представляют собой 32-байтные хеши в формате:
```
0x[32 байта в hex формате]
```

### Стандартные модули

Стандартные модули используют ASCII-коды названий, дополненные нулями до 32 байт:

| Модуль | ID | Описание |
|--------|----|---------| 
| **Treasury** | `0x7472656173757279000000000000000000000000000000000000000000000000` | Модуль управления казной |
| **Timelock** | `0x74696d656c6f636b000000000000000000000000000000000000000000000000` | Модуль задержки выполнения |
| **Reader** | `0x7265616465720000000000000000000000000000000000000000000000000000` | Модуль чтения данных |

### Дополнительные модули

Дополнительные модули могут использовать другие форматы ID:

| Модуль | ID | Описание |
|--------|----|---------|
| **Multisig** | `0x6d756c7469736967000000000000000000000000000000000000000000000000` | Мультиподписный модуль |
| **Deactivation** | `0x646561637469766174696f6e0000000000000000000000000000000000000000` | Модуль деактивации |
| **Analytics** | `0x616e616c79746963730000000000000000000000000000000000000000000000` | Модуль аналитики |
| **Notifications** | `0x6e6f74696669636174696f6e7300000000000000000000000000000000000000` | Модуль уведомлений |

## Использование в коде

### Константы

Все ID модулей определены в файле `backend/constants/moduleIds.js`:

```javascript
const { MODULE_IDS, MODULE_TYPE_TO_ID, MODULE_ID_TO_TYPE } = require('../constants/moduleIds');

// Использование
const treasuryId = MODULE_IDS.TREASURY;
const moduleType = MODULE_ID_TO_TYPE[moduleId];
const moduleId = MODULE_TYPE_TO_ID['treasury'];
```

### API Endpoints

ID модулей используются в следующих API endpoints:

- `POST /api/dle-modules/initialize-modules` - инициализация модулей
- `POST /api/dle-modules/deploy-module` - деплой модуля
- `GET /api/dle-modules/check-module-status` - проверка статуса модуля
- `POST /api/dle-history/get-extended-history` - получение истории

### Смарт-контракт

В смарт-контракте DLE ID модулей используются в:

```solidity
// Добавление модуля
function createAddModuleProposal(
    string memory _description,
    uint256 _duration,
    bytes32 _moduleId,  // <-- ID модуля
    address _moduleAddress,
    uint256 _chainId
) external returns (uint256);

// Проверка модуля
function isModuleActive(bytes32 _moduleId) external view returns (bool);
function getModuleAddress(bytes32 _moduleId) external view returns (address);
```

## Добавление новых модулей

### 1. Определить ID модуля

```javascript
// В backend/constants/moduleIds.js
const MODULE_IDS = {
  // ... существующие модули
  NEW_MODULE: '0x6e65776d6f64756c650000000000000000000000000000000000000000000000'
};
```

### 2. Обновить маппинги

```javascript
const MODULE_TYPE_TO_ID = {
  // ... существующие модули
  newModule: MODULE_IDS.NEW_MODULE
};

const MODULE_ID_TO_TYPE = {
  // ... существующие модули
  [MODULE_IDS.NEW_MODULE]: 'newModule'
};

const MODULE_NAMES = {
  // ... существующие модули
  newModule: 'New Module'
};
```

### 3. Обновить функцию getModuleName

```javascript
// В backend/routes/dleHistory.js
function getModuleName(moduleId) {
  if (MODULE_ID_TO_TYPE[moduleId]) {
    const moduleType = MODULE_ID_TO_TYPE[moduleId];
    return MODULE_NAMES[moduleType] || moduleType;
  }
  
  const additionalModuleNames = {
    // ... существующие модули
    '0x6e65776d6f64756c650000000000000000000000000000000000000000000000': 'New Module'
  };
  
  return additionalModuleNames[moduleId] || `Module ${moduleId}`;
}
```

## Безопасность

- ID модулей должны быть уникальными
- Не используйте предсказуемые ID для критических модулей
- Все изменения ID должны проходить через governance

## Миграция

При изменении ID модуля:

1. Создать governance предложение для удаления старого модуля
2. Создать governance предложение для добавления нового модуля с новым ID
3. Обновить константы в коде
4. Обновить базу данных (если необходимо)

## Примеры

### Создание предложения для добавления модуля

```javascript
const moduleId = MODULE_TYPE_TO_ID['treasury'];
const moduleAddress = '0x1234567890123456789012345678901234567890';

// Создание предложения через governance
const proposalId = await dleContract.createAddModuleProposal(
  'Добавить Treasury модуль',
  86400, // 1 день
  moduleId,
  moduleAddress,
  1 // Ethereum mainnet
);
```

### Проверка статуса модуля

```javascript
const moduleId = MODULE_TYPE_TO_ID['treasury'];
const isActive = await dleContract.isModuleActive(moduleId);
const moduleAddress = await dleContract.getModuleAddress(moduleId);

console.log(`Treasury модуль: ${isActive ? 'активен' : 'неактивен'}`);
console.log(`Адрес: ${moduleAddress}`);
```
