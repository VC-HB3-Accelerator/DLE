<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

# Руководство по деплою DLE v2

## Обзор

DLE v2 (Digital Legal Entity) - это система для создания цифровых юридических лиц с мульти-чейн поддержкой. Основная особенность - использование CREATE2 для обеспечения одинакового адреса смарт-контракта во всех поддерживаемых сетях.

## Архитектура

### Компоненты системы

1. **DLE.sol** - Основной смарт-контракт с ERC-20 токенами управления
2. **Детерминированный деплой** - через CREATE с выровненным nonce для одинаковых адресов
3. **Модули** - Дополнительная функциональность (Treasury, Timelock, etc.)

### Мульти-чейн поддержка

- **CREATE2** - Одинаковый адрес во всех EVM-совместимых сетях
- **Single-Chain Governance** - Голосование происходит в одной сети
- **Multi-Chain Execution** - Исполнение в целевых сетях по подписям

## Процесс деплоя

### 1. Подготовка

1. Убедитесь, что у вас есть:
   - Приватный ключ с достаточным балансом в выбранных сетях
   - RPC URLs для всех целевых сетей
   - API ключ Etherscan (опционально, для верификации)

2. Настройте RPC провайдеры в веб-интерфейсе:
   - Откройте страницу настроек: `http://localhost:5173/settings/security`
   - Перейдите в раздел "RPC Провайдеры"
   - Добавьте RPC URLs для нужных сетей:
     - **Ethereum Mainnet**: Chain ID 1
     - **Polygon**: Chain ID 137  
     - **BSC**: Chain ID 56
     - **Arbitrum**: Chain ID 42161
     - **Sepolia Testnet**: Chain ID 11155111
     - И другие нужные сети

3. Приватные ключи вводятся непосредственно в форме деплоя для безопасности

### 2. Деплой через веб-интерфейс

1. Откройте страницу: `http://localhost:5173/settings/dle-v2-deploy`

2. Заполните форму:
   - **Основная информация**: Название, символ токена
   - **Юридическая информация**: Страна, ОКВЭД, адрес
   - **Партнеры**: Адреса и доли токенов
   - **Сети**: Выберите целевые блокчейн-сети
   - **Приватный ключ**: Для деплоя контрактов

3. Нажмите "Развернуть DLE"

### 3. Процесс деплоя

Система автоматически:

1. **Проверяет балансы** во всех выбранных сетях
2. **Компилирует контракты** через Hardhat
3. **Проверяет Factory адреса** в базе данных
4. **Выравнивает nonce** для детерминированного деплоя
5. **Вычисляет адрес DLE** через CREATE с выровненным nonce
6. **Деплоит DLE** с одинаковым адресом во всех сетях
8. **Деплоит базовые модули** (Treasury, Timelock, Reader) в каждой сети
9. **Инициализирует модули** в DLE контракте
10. **Верифицирует контракты** в Etherscan (опционально)

### 4. Результат

После успешного деплоя вы получите:

- **Одинаковый адрес DLE** во всех выбранных сетях
- **Одинаковый адрес Factory** во всех выбранных сетях
- **Базовые модули** (Treasury, Timelock, Reader) в каждой сети
- **Инициализированные модули** в DLE контракте
- **ERC-20 токены управления** распределенные между партнерами
- **Настроенный кворум** для принятия решений
- **Поддержку мульти-чейн операций**

### 5. Управление Factory адресами

Система автоматически управляет Factory адресами:

#### API Endpoints:
- `GET /api/factory` - Получить все Factory адреса
- `GET /api/factory/:chainId` - Получить Factory адрес для сети
- `POST /api/factory` - Сохранить Factory адрес
- `POST /api/factory/bulk` - Сохранить адреса для нескольких сетей
- `DELETE /api/factory/:chainId` - Удалить Factory адрес
- `POST /api/factory/check` - Проверить наличие адресов

#### Автоматическое управление:
- **Кэширование** - Factory адреса сохраняются в базе данных
- **Переиспользование** - Существующие Factory используются повторно
- **Валидация** - Проверка существования Factory в блокчейне
- **Автодеплой** - Новые Factory деплоятся при необходимости

### 6. Проверка одинаковости адресов

Система автоматически проверяет, что все адреса одинаковые:

```javascript
// Проверка адресов DLE
const addresses = results.filter(r => r.success).map(r => r.address);
const uniqueAddresses = [...new Set(addresses)];

if (uniqueAddresses.length === 1) {
  console.log("✅ Все адреса DLE одинаковые:", uniqueAddresses[0]);
} else {
  throw new Error("CREATE2 не обеспечил одинаковые адреса");
}
```

Если адреса не совпадают, это указывает на проблему с:
- Разными Factory адресами в сетях
- Разными salt значениями
- Разными bytecode контрактов

## Технические детали

### База данных Factory адресов

Система использует таблицу `factory_addresses` для хранения адресов:

```sql
CREATE TABLE factory_addresses (
  id SERIAL PRIMARY KEY,
  chain_id INTEGER NOT NULL UNIQUE,
  factory_address VARCHAR(42) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### CREATE2 Механизм

Система использует двухуровневый CREATE2 для обеспечения одинаковых адресов:

#### 1. Factory Deployer
```solidity
// Предсказуемый адрес Factory через CREATE
address factoryAddress = getCreateAddress(
    from: deployerAddress,
    nonce: deployerNonce
);
```

#### 2. DLE Contract
```solidity
// Вычисление адреса DLE через CREATE2
address predictedAddress = factoryDeployer.computeAddress(
    salt, 
    keccak256(creationCode)
);

// Деплой DLE с одинаковым адресом
factoryDeployer.deploy(salt, creationCode);
```

#### Ключевые принципы:
- **Factory Deployer** деплоится с одинаковым адресом во всех сетях
- **DLE Contract** деплоится через Factory с одинаковым salt
- **Результат**: Одинаковый адрес DLE во всех EVM-совместимых сетях

### Структура DLE

```solidity
contract DLE is ERC20, ERC20Permit, ERC20Votes, ReentrancyGuard {
    // Основная информация
    DLEInfo public dleInfo;
    
    // Настройки управления
    uint256 public quorumPercentage;
    
    // Мульти-чейн поддержка
    uint256[] public supportedChainIds;
    uint256 public governanceChainId;
    
    // Система предложений
    mapping(uint256 => Proposal) public proposals;
}
```

### Базовые модули (автоматически деплоятся)

При деплое DLE автоматически развертываются и инициализируются:

- **TreasuryModule** - Управление финансами, депозиты, выводы, дивиденды
- **TimelockModule** - Задержки исполнения критических операций
- **DLEReader** - API для чтения данных DLE

### Дополнительные модули (через голосование)

DLE поддерживает модульную архитектуру:

- **CommunicationModule** - Внешние коммуникации
- **BurnModule** - Сжигание токенов
- **MintModule** - Выпуск новых токенов
- **OracleModule** - Внешние данные
- **CustomModule** - Пользовательские модули

## Управление DLE

### Создание предложений

```solidity
// Создать предложение
uint256 proposalId = dle.createProposal(
    "Описание предложения",
    governanceChainId,
    targetChains,
    timelockHours,
    operationCalldata
);
```

### Голосование

```solidity
// Голосовать за предложение
dle.vote(proposalId, true); // За
dle.vote(proposalId, false); // Против
```

### Исполнение

```solidity
// Исполнить предложение
dle.executeProposalBySignatures(proposalId, signatures);
```

## Безопасность

### Ключевые принципы

1. **Только токен-холдеры** участвуют в управлении
2. **Прямые переводы токенов заблокированы**
3. **Все операции через кворум**
4. **CREATE2 обеспечивает детерминистические адреса**
5. **EIP-712 подписи для мульти-чейн исполнения**

### Проверки

- Валидация приватных ключей
- Проверка балансов перед деплоем
- Верификация CREATE2 адресов
- Контроль кворума при голосовании

## Устранение неполадок

### Частые проблемы

1. **Недостаточно средств**
   - Проверьте балансы во всех сетях
   - Убедитесь в правильности RPC URLs в настройках

2. **Ошибки компиляции**
   - Проверьте версию Solidity (0.8.20)
   - Убедитесь в корректности импортов OpenZeppelin

3. **Разные адреса в сетях**
   - Проверьте, что Factory контракты имеют одинаковые адреса
   - Проверьте CREATE2 salt для DLE
   - Убедитесь в одинаковом bytecode контрактов
   - Проверьте nonce кошелька деплоера

4. **Ошибки верификации**
   - Проверьте API ключ Etherscan в форме деплоя
   - Убедитесь в корректности constructor arguments

5. **RPC URL не найден**
   - Проверьте настройки RPC провайдеров в `/settings/security`
   - Убедитесь, что Chain ID указан правильно
   - Протестируйте RPC URL через кнопку "Тест" в настройках

### Логи

Логи деплоя доступны в:
- Backend: `backend/logs/`
- Hardhat: `backend/artifacts/`
- Результаты: `backend/contracts-data/dles/`

## Поддержка

Для получения поддержки:
- Email: info@hb3-accelerator.com
- Website: https://hb3-accelerator.com
- GitHub: https://github.com/HB3-ACCELERATOR
