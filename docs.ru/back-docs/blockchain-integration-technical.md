[English](../../docs.en/back-docs/blockchain-integration-technical.md) | **Русский**

# Блокчейн интеграция Digital Legal Entity (DLE)

## 📋 Содержание

1. [Введение](#введение)
2. [Архитектура смарт-контрактов](#архитектура-смарт-контрактов)
3. [Основной контракт DLE](#основной-контракт-dle)
4. [Модульная система](#модульная-система)
5. [Мультичейн архитектура](#мультичейн-архитектура)
6. [Система голосования (Управление)](#система-голосования-управление)
7. [Деплой смарт-контрактов](#деплой-смарт-контрактов)
8. [Аутентификация через кошелек](#аутентификация-через-кошелек)
9. [Интеграция с frontend](#интеграция-с-frontend)
10. [Безопасность](#безопасность)
11. [Практические примеры](#практические-примеры)

---

## Введение

Digital Legal Entity (DLE) использует блокчейн-технологии для обеспечения **токенизированного управления** (аналогично акционерному обществу на блокчейне) и **прозрачного принятия решений** через смарт-контракты.

### Зачем блокчейн в DLE?

1. **🗳️ Управление как в акционерном обществе** - решения принимаются токен-холдерами через голосование на блокчейне
2. **🔒 Прозрачность** - все голосования и операции записаны на блокчейне
3. **🛡️ Защита от цензуры** - смарт-контракт гарантирует права токен-холдеров
4. **📜 Иммутабельность** - история решений неизменна
5. **🌐 Мультичейн поддержка** - работа в нескольких блокчейнах одновременно

### Модель управления DLE

DLE использует **гибридную модель управления**:

| Аспект | Реализация |
|--------|------------|
| **Голосование** | Токен-холдеры (как акционеры) |
| **Кворум** | 51%+ токенов для принятия решений |
| **Распределение активов** | Через голосование (как в АО) |
| **Изменение параметров** | Через голосование токен-холдеров |
| **Код приложения** | Проприетарный (автор) |
| **Обновления** | Автор разрабатывает, токен-холдеры голосуют за приоритеты |

Это **токенизированное акционерное общество на блокчейне**, где:
- ✅ Управление параметрами - через голосование токен-холдеров (как акционеров)
- ✅ Распределение активов - через голосование (как в АО)
- ⚠️ Разработка кода - централизована (автор)
- ⚠️ Выпуск обновлений - автор (по приоритетам голосования)

### Поддерживаемые блокчейны

DLE работает с любыми **EVM-совместимыми** сетями:
- ✅ Ethereum (mainnet & testnets: Sepolia, Holesky)
- ✅ Polygon (mainnet & testnets)
- ✅ Arbitrum (One & Sepolia)
- ✅ Binance Smart Chain (BSC)
- ✅ Base (mainnet & Sepolia)
- ✅ И любые другие EVM-сети

---

## Архитектура смарт-контрактов

### Обзор системы

```
┌─────────────────────────────────────────────────────────────┐
│                      DLE Ecosystem                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │        DLE Core Contract (ERC20Votes)               │   │
│  │  • Токены управления (ERC20)                        │   │
│  │  • Голосование (ERC20Votes)                         │   │
│  │  • Подписи (ERC20Permit)                            │   │
│  │  • Proposals (предложения)                          │   │
│  │  • Мультичейн поддержка                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                         ↕                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Модули (Расширения)                     │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ • HierarchicalVotingModule                           │  │
│  │   - Голосование в других DLE                         │  │
│  │   - Владение токенами других DLE                     │  │
│  │                                                      │  │
│  │ • TreasuryModule                                     │  │
│  │   - Управление казной                                │  │
│  │   - Хранение токенов                                 │  │
│  │                                                      │  │
│  │ • TimelockModule                                     │  │
│  │   - Отложенное исполнение                            │  │
│  │   - Защита от мгновенных изменений                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                         ↕                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         DLEReader (Читатель данных)                  │  │
│  │  • Batch чтение данных                               │  │
│  │  • Оптимизация RPC запросов                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Стандарты и библиотеки

DLE использует проверенные стандарты **OpenZeppelin**:

| Стандарт | Назначение |
|----------|------------|
| **ERC20** | Базовый функционал токена |
| **ERC20Votes** | Голосование с снапшотами |
| **ERC20Permit** | Подписи без gas (meta-transactions) |
| **ReentrancyGuard** | Защита от реентерабельности |
| **ECDSA** | Проверка подписей |

---

## Основной контракт DLE

### Структура контракта

Файл: `backend/contracts/DLE.sol`

```solidity
contract DLE is ERC20, ERC20Permit, ERC20Votes, ReentrancyGuard, IMultichainMetadata {
    // Основные данные DLE
    struct DLEInfo {
        string name;              // Название организации
        string symbol;            // Символ токена
        string location;          // Местоположение
        string coordinates;       // Координаты GPS
        uint256 jurisdiction;     // Юрисдикция
        string[] okvedCodes;      // Коды ОКВЭД
        uint256 kpp;              // КПП (для РФ)
        uint256 creationTimestamp;
        bool isActive;
    }

    // Предложение для голосования
    struct Proposal {
        uint256 id;
        string description;
        uint256 forVotes;         // Голоса "За"
        uint256 againstVotes;     // Голоса "Против"
        bool executed;
        bool canceled;
        uint256 deadline;
        address initiator;
        bytes operation;          // Операция для исполнения
        uint256 governanceChainId; // Сеть голосования
        uint256[] targetChains;   // Целевые сети для исполнения
        uint256 snapshotTimepoint;
        mapping(address => bool) hasVoted;
    }
}
```

### Ключевые возможности

#### 1. Токены управления (ERC20)

DLE токены представляют **право голоса** в управлении:
- 1 токен = 1 голос
- Токены **НЕ передаются** обычными методами (только через governance)
- Подписи EIP-712 для meta-transactions

```solidity
// Переводы токенов ЗАБЛОКИРОВАНЫ
function transfer(address, uint256) public pure override returns (bool) {
    revert ErrTransfersDisabled();
}

// Одобрения ЗАБЛОКИРОВАНЫ
function approve(address, uint256) public pure override returns (bool) {
    revert ErrApprovalsDisabled();
}
```

#### 2. Голосование (ERC20Votes)

Использует **снапшоты** голосов:
- Защита от flash-loans
- Голоса берутся из прошлого блока
- Делегирование (опционально)

```solidity
function getPastVotes(address account, uint256 timepoint) public view returns (uint256)
```

#### 3. Мультичейн поддержка

DLE может быть развернут в **нескольких сетях одновременно**:
- Один адрес во всех сетях (детерминированный деплой)
- Голосование в одной сети (governance chain)
- Исполнение в любых целевых сетях

```solidity
// Поддерживаемые сети
mapping(uint256 => bool) public supportedChains;
uint256[] public supportedChainIds;

// Добавление сети (только через голосование)
function _addSupportedChain(uint256 _chainId) internal {
    require(!supportedChains[_chainId], "Chain already supported");
    supportedChains[_chainId] = true;
    supportedChainIds.push(_chainId);
    emit ChainAdded(_chainId);
}
```

#### 4. Модульная архитектура

DLE поддерживает **расширения через модули**:

```solidity
// Модули
mapping(bytes32 => address) public modules;
mapping(bytes32 => bool) public activeModules;

// Добавление модуля (только через голосование)
function _addModule(bytes32 _moduleId, address _moduleAddress) internal {
    if (_moduleAddress == address(0)) revert ErrZeroAddress();
    if (activeModules[_moduleId]) revert ErrProposalExecuted();
    
    modules[_moduleId] = _moduleAddress;
    activeModules[_moduleId] = true;
    
    emit ModuleAdded(_moduleId, _moduleAddress);
}
```

### Операции доступные через голосование

| Операция | Описание |
|----------|----------|
| `_addModule` | Добавить новый модуль |
| `_removeModule` | Удалить модуль |
| `_addSupportedChain` | Добавить блокчейн |
| `_removeSupportedChain` | Удалить блокчейн |
| `_transferTokens` | Перевести токены |
| `_updateDLEInfo` | Обновить информацию DLE |
| `_updateQuorumPercentage` | Изменить кворум |
| `_updateVotingDurations` | Изменить длительность голосования |

---

## Модульная система

### 1. HierarchicalVotingModule

**Назначение**: Иерархическое голосование - DLE может голосовать в других DLE.

**Файл**: `backend/contracts/HierarchicalVotingModule.sol`

**Возможности**:
- ✅ DLE может владеть токенами других DLE
- ✅ Голосовать в других DLE от своего имени
- ✅ Создавать предложения в других DLE
- ✅ Отслеживать цепочку голосований

```solidity
struct ExternalDLEInfo {
    address dleAddress;
    string name;
    string symbol;
    uint256 tokenBalance;  // Баланс токенов этого DLE
    bool isActive;
    uint256 addedAt;
}

// Добавить внешний DLE
function addExternalDLE(
    address dleAddress,
    string memory name,
    string memory symbol
) external onlyDLE;

// Создать предложение в внешнем DLE
function createProposalInExternalDLE(
    address externalDLE,
    string calldata description,
    uint256 duration,
    bytes calldata operation,
    uint256 chainId
) external onlyDLE returns (uint256);
```

**Пример использования**:
```javascript
// DLE-A владеет токенами DLE-B
// DLE-A может голосовать в DLE-B автоматически
const hierarchicalModule = await ethers.getContractAt('HierarchicalVotingModule', moduleAddress);
await hierarchicalModule.voteInExternalDLE(dleBAddress, proposalId, true);
```

### 2. TreasuryModule

**Назначение**: Управление казной (treasury) и активами DLE.

**Файл**: `backend/contracts/TreasuryModule.sol`

**Возможности**:
- ✅ Хранение токенов и активов
- ✅ Управление через голосование токен-холдеров
- ✅ Отправка платежей
- ✅ Аккумуляция доходов

```solidity
// Перевести токены из казны (только через голосование в DLE)
function transferTokens(
    address token,
    address recipient,
    uint256 amount
) external onlyDLE;

// Получить баланс токена в казне
function getTokenBalance(address token) external view returns (uint256);
```

**Пример использования**:
```javascript
// Создать предложение на выплату из казны
const operation = treasuryModule.interface.encodeFunctionData('transferTokens', [
    tokenAddress,
    recipientAddress,
    ethers.parseEther('100')
]);

await dleContract.createProposal(
    'Выплата 100 токенов для маркетинга',
    86400, // 24 часа
    operation,
    chainId,
    [chainId]
);
```

### 3. TimelockModule

**Назначение**: Отложенное исполнение операций для безопасности.

**Файл**: `backend/contracts/TimelockModule.sol`

**Возможности**:
- ✅ Задержка перед исполнением (timelock)
- ✅ Возможность отмены до исполнения
- ✅ Защита от мгновенных изменений

```solidity
struct TimelockProposal {
    uint256 proposalId;
    uint256 executionTime;  // Время когда можно исполнить
    bytes32 operationHash;
    bool executed;
    bool canceled;
}

// Создать timelock предложение
function scheduleProposal(
    uint256 proposalId,
    bytes calldata operation,
    uint256 delay
) external onlyDLE returns (bytes32);

// Исполнить по истечении таймлока
function executeTimelockProposal(bytes32 operationHash) external;
```

### 4. DLEReader

**Назначение**: Оптимизированное чтение данных из контрактов.

**Файл**: `backend/contracts/DLEReader.sol`

**Возможности**:
- ✅ Batch чтение нескольких данных за один RPC запрос
- ✅ Получение детальной информации о DLE
- ✅ Список всех предложений с деталями
- ✅ Оптимизация gas для чтения

```solidity
// Получить полную информацию о DLE за один запрос
function getDLEFullInfo(address dleAddress) external view returns (
    string memory name,
    string memory symbol,
    uint256 totalSupply,
    DLEInfo memory info,
    uint256 proposalCount,
    // ... и другие данные
);

// Получить все предложения (batch read)
function getAllProposals(address dleAddress) external view returns (ProposalInfo[] memory);
```

---

## Мультичейн архитектура

### Концепция

DLE поддерживает **детерминированный деплой** - один адрес во всех сетях:

```
Ethereum:  0x742d35Cc6634C0532925a3b844Bc9377F91cAB6C
Polygon:   0x742d35Cc6634C0532925a3b844Bc9377F91cAB6C  ← Тот же адрес!
Arbitrum:  0x742d35Cc6634C0532925a3b844Bc9377F91cAB6C
BSC:       0x742d35Cc6634C0532925a3b844Bc9377F91cAB6C
```

### Как это работает?

1. **Генерация init code** - одинаковый bytecode для всех сетей
2. **Фиксированный nonce** - деплой с одного и того же nonce
3. **CREATE opcode** - адрес = keccak256(deployerAddress, nonce)
4. **Результат** - одинаковый адрес во всех сетях

### Голосование в одной сети

**Голосование** происходит в **одной сети** (сеть голосования), а **исполнение** - в любых целевых сетях:

```
┌─────────────────────────────────────────────────────────┐
│             Ethereum (Сеть голосования)                 │
│  1. Создание предложения                                │
│  2. Голосование                                         │
│  3. Подсчет голосов                                     │
│  4. Генерация подписи для исполнения                    │
└─────────────────────────────────────────────────────────┘
                        ↓
        ┌───────────────┴───────────────┐
        ↓                               ↓
┌───────────────────┐         ┌───────────────────┐
│  Polygon          │         │  Arbitrum         │
│  (Target Chain)   │         │  (Target Chain)   │
│  5. Исполнение    │         │  5. Исполнение    │
│     с подписью    │         │     с подписью    │
└───────────────────┘         └───────────────────┘
```

### Мультичейн исполнение

Исполнение через **подписи** (off-chain coordination):

```solidity
function executeWithSignatures(
    uint256 proposalId,
    bytes32 operationHash,
    address[] calldata signers,
    bytes[] calldata signatures
) external nonReentrant;
```

**Процесс**:
1. Предложение одобрено в сети голосования
2. Генерируются подписи токен-холдеров
3. Подписи передаются в целевые сети
4. Контракт проверяет подписи и исполняет операцию

---

## Система голосования (Управление)

### Создание предложения

```solidity
function createProposal(
    string calldata _description,
    uint256 _duration,
    bytes calldata _operation,
    uint256 _chainId,
    uint256[] calldata _targetChains,
    address _initiator
) external returns (uint256);
```

**Параметры**:
- `_description` - описание предложения
- `_duration` - длительность голосования (в секундах)
- `_operation` - операция для исполнения (encoded function call)
- `_chainId` - ID сети для голосования
- `_targetChains` - целевые сети для исполнения
- `_initiator` - адрес инициатора

**Пример** (backend):
```javascript
const { ethers } = require('ethers');

// Операция: добавить модуль
const operation = dleContract.interface.encodeFunctionData('_addModule', [
    ethers.id('TIMELOCK_MODULE'), // moduleId
    timelockModuleAddress
]);

// Создать предложение
const tx = await dleContract.createProposal(
    'Добавить Timelock Module для защиты',
    86400 * 3, // 3 дня
    operation,
    1, // Ethereum mainnet
    [1, 137, 42161], // Ethereum, Polygon, Arbitrum
    walletAddress
);

const receipt = await tx.wait();
const proposalId = receipt.events[0].args.proposalId;
```

### Голосование

```solidity
function vote(uint256 _proposalId, bool _support) external;
```

**Параметры**:
- `_proposalId` - ID предложения
- `_support` - true = "За", false = "Против"

**Пример** (frontend):
```javascript
// Подключение к контракту
const dleContract = new ethers.Contract(dleAddress, dleAbi, signer);

// Голосование "За"
await dleContract.vote(proposalId, true);

// Голосование "Против"
await dleContract.vote(proposalId, false);
```

### Исполнение предложения

```solidity
function execute(uint256 _proposalId) external nonReentrant;
```

**Условия исполнения**:
1. ✅ Голосование завершено (прошел deadline)
2. ✅ Кворум достигнут (например, 10% токенов проголосовало)
3. ✅ Больше голосов "За", чем "Против"
4. ✅ Предложение еще не исполнено

**Пример**:
```javascript
// Проверить, можно ли исполнить
const proposal = await dleContract.proposals(proposalId);
const canExecute = (
    proposal.deadline < Date.now() / 1000 &&
    !proposal.executed &&
    proposal.forVotes > proposal.againstVotes
);

if (canExecute) {
    await dleContract.execute(proposalId);
}
```

### Кворум

Кворум определяет **минимальное количество голосов** для принятия решения:

```solidity
uint256 public quorumPercentage; // Процент от totalSupply (например, 10%)

function _hasQuorum(uint256 _forVotes, uint256 _againstVotes) internal view returns (bool) {
    uint256 totalVotes = _forVotes + _againstVotes;
    uint256 requiredVotes = (totalSupply() * quorumPercentage) / 100;
    return totalVotes >= requiredVotes;
}
```

**Изменение кворума** (только через голосование):
```javascript
const operation = dleContract.interface.encodeFunctionData('_updateQuorumPercentage', [
    15 // Новый кворум 15%
]);

await dleContract.createProposal(
    'Увеличить кворум до 15%',
    86400 * 7,
    operation,
    chainId,
    [chainId]
);
```

---

## Деплой смарт-контрактов

### Мультичейн деплой

**Скрипт**: `backend/scripts/deploy/deploy-multichain.js`

**Возможности**:
- ✅ Деплой в несколько сетей одновременно (parallel)
- ✅ Детерминированный адрес (один адрес во всех сетях)
- ✅ Автоматическая верификация контрактов
- ✅ Retry логика при ошибках
- ✅ Nonce management для синхронизации

**Запуск**:
```bash
cd backend
yarn deploy:multichain
```

**Конфигурация** (база данных):
Параметры деплоя хранятся в таблице `settings`:
- `supported_chain_ids` - список ID сетей для деплоя
- `rpc_providers` - RPC URLs для каждой сети
- `dle_config` - конфигурация DLE (название, символ, партнеры и т.д.)

**Пример конфигурации**:
```json
{
  "name": "My Company DLE",
  "symbol": "MYCO",
  "location": "Moscow, Russia",
  "coordinates": "55.7558,37.6173",
  "jurisdiction": 643,
  "okvedCodes": ["62.01", "62.02"],
  "kpp": 770401001,
  "quorumPercentage": 10,
  "initialPartners": ["0x742d35..."],
  "initialAmounts": [1000000],
  "supportedChainIds": [1, 137, 42161]
}
```

### Деплой модулей

**Скрипт**: `backend/scripts/deploy/deploy-modules.js`

**Запуск**:
```bash
cd backend
yarn deploy:modules
```

**Процесс**:
1. Загрузка адреса DLE из базы
2. Параллельный деплой всех модулей во всех сетях
3. CREATE2 деплой для детерминированных адресов
4. Автоматическая верификация
5. Сохранение адресов модулей в базу данных

### Верификация контрактов

**Автоматическая верификация** через Etherscan API:

```javascript
async function verifyDLEAfterDeploy(chainId, contractAddress, constructorArgs, apiKey, params) {
    await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: constructorArgs,
        contract: "contracts/DLE.sol:DLE"
    });
}
```

**Поддерживаемые сканеры**:
- Etherscan (Ethereum, Sepolia, Holesky)
- Polygonscan
- Arbiscan
- BSCScan
- Basescan

---

## Аутентификация через кошелек

### SIWE (Sign-In with Ethereum)

DLE использует стандарт **SIWE** для аутентификации:

**Файл**: `backend/routes/auth.js`

**Процесс аутентификации**:

```
┌──────────────┐                    ┌──────────────┐
│   Frontend   │                    │   Backend    │
└──────┬───────┘                    └──────┬───────┘
       │                                   │
       │ 1. Запрос nonce                   │
       ├──────────────────────────────────>│
       │                                   │
       │ 2. Возврат nonce                  │
       │<──────────────────────────────────┤
       │                                   │
       │ 3. Подпись сообщения в кошельке   │
       │   (приватный ключ НЕ передается!) │
       │                                   │
       │ 4. Отправка подписи               │
       ├──────────────────────────────────>│
       │                                   │
       │                  5. Проверка подписи
       │                  6. Проверка токенов
       │                  7. Создание сессии
       │                                   │
       │ 8. Успешная аутентификация        │
       │<──────────────────────────────────┤
       │                                   │
```

### Запрос nonce

```javascript
// POST /api/auth/nonce
app.post('/api/auth/nonce', async (req, res) => {
    const { address } = req.body;
    
    // Генерируем случайный nonce
    const nonce = crypto.randomBytes(32).toString('hex');
    
    // Сохраняем в БД с шифрованием
    await db.query(
        'INSERT INTO nonces (identity_value_encrypted, nonce_encrypted, expires_at) VALUES ($1, $2, $3)',
        [encrypt(address.toLowerCase()), encrypt(nonce), expiresAt]
    );
    
    res.json({ nonce });
});
```

### Верификация подписи

```javascript
// POST /api/auth/verify
app.post('/api/auth/verify', async (req, res) => {
    const { address, signature, nonce } = req.body;
    
    // Формируем SIWE сообщение
    const message = new SiweMessage({
        domain: req.get('host'),
        address: ethers.getAddress(address),
        statement: 'Sign in with Ethereum to the app.',
        uri: req.get('origin'),
        version: '1',
        chainId: 1,
        nonce: nonce
    });
    
    // Проверяем подпись
    const isValid = await verifySignature(
        message.prepareMessage(),
        signature,
        address
    );
    
    if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Проверяем токены в смарт-контракте
    const userAccessLevel = await getUserAccessLevel(address);
    
    // Создаем сессию
    req.session.userId = userId;
    req.session.address = address;
    req.session.authenticated = true;
    req.session.userAccessLevel = userAccessLevel;
    
    res.json({ success: true, userAccessLevel });
});
```

### Проверка уровня доступа

```javascript
async function getUserAccessLevel(address) {
    // Получаем адрес DLE контракта из настроек
    const dleAddress = await getSettingValue('contract_address');
    if (!dleAddress) {
        return { level: 'user', tokenCount: 0, hasAccess: false };
    }
    
    // Подключаемся к контракту
    const dleContract = new ethers.Contract(dleAddress, dleAbi, provider);
    
    // Получаем баланс токенов
    const tokenCount = await dleContract.balanceOf(address);
    
    // Пороги доступа из настроек
    const editorThreshold = await getSettingValue('editor_token_threshold') || 100;
    const readonlyThreshold = await getSettingValue('readonly_token_threshold') || 1;
    
    // Определяем уровень доступа
    if (tokenCount >= editorThreshold) {
        return { level: 'editor', tokenCount, hasAccess: true };
    } else if (tokenCount >= readonlyThreshold) {
        return { level: 'readonly', tokenCount, hasAccess: true };
    } else {
        return { level: 'user', tokenCount: 0, hasAccess: false };
    }
}
```

---

## Интеграция с frontend

### Подключение кошелька

**Файл**: `frontend/src/services/web3Service.js`

```javascript
import { ethers } from 'ethers';

export async function connectWallet() {
    if (!window.ethereum) {
        throw new Error('MetaMask не установлен');
    }
    
    // Запрашиваем доступ к кошельку
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    
    // Создаем provider
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    
    return { provider, signer, address };
}
```

### Подпись сообщения

```javascript
export async function signMessage(signer, message) {
    try {
        const signature = await signer.signMessage(message);
        return signature;
    } catch (error) {
        throw new Error('Пользователь отклонил подпись');
    }
}
```

### Аутентификация

```javascript
import axios from 'axios';

export async function authenticateWithWallet(address, signer) {
    // 1. Получаем nonce
    const { data } = await axios.post('/api/auth/nonce', { address });
    const { nonce } = data;
    
    // 2. Формируем сообщение SIWE
    const message = `Sign in with Ethereum to the app.\n\nNonce: ${nonce}`;
    
    // 3. Подписываем
    const signature = await signMessage(signer, message);
    
    // 4. Отправляем на верификацию
    const response = await axios.post('/api/auth/verify', {
        address,
        signature,
        nonce,
        issuedAt: new Date().toISOString()
    });
    
    return response.data;
}
```

### Взаимодействие с контрактом

```javascript
import { ethers } from 'ethers';
import dleAbi from '@/contracts/DLE.json';

export async function getDLEContract(address, signerOrProvider) {
    return new ethers.Contract(address, dleAbi.abi, signerOrProvider);
}

// Создать предложение
export async function createProposal(contract, description, duration, operation, chainId) {
    const tx = await contract.createProposal(
        description,
        duration,
        operation,
        chainId,
        [chainId]
    );
    
    const receipt = await tx.wait();
    return receipt;
}

// Голосовать
export async function voteOnProposal(contract, proposalId, support) {
    const tx = await contract.vote(proposalId, support);
    await tx.wait();
}

// Получить информацию о предложении
export async function getProposal(contract, proposalId) {
    const proposal = await contract.proposals(proposalId);
    return {
        id: proposal.id.toString(),
        description: proposal.description,
        forVotes: ethers.formatEther(proposal.forVotes),
        againstVotes: ethers.formatEther(proposal.againstVotes),
        executed: proposal.executed,
        deadline: new Date(proposal.deadline * 1000)
    };
}
```

### Vue компонент для голосования

```vue
<template>
  <div class="proposal-card">
    <h3>{{ proposal.description }}</h3>
    <div class="votes">
      <div>За: {{ proposal.forVotes }}</div>
      <div>Против: {{ proposal.againstVotes }}</div>
    </div>
    <div class="actions" v-if="!proposal.executed">
      <button @click="vote(true)">Голосовать "За"</button>
      <button @click="vote(false)">Голосовать "Против"</button>
    </div>
  </div>
</template>

<script>
import { voteOnProposal, getDLEContract } from '@/services/web3Service';

export default {
  props: ['proposal', 'dleAddress'],
  methods: {
    async vote(support) {
      try {
        const { signer } = await this.$store.dispatch('web3/connectWallet');
        const contract = await getDLEContract(this.dleAddress, signer);
        
        await voteOnProposal(contract, this.proposal.id, support);
        
        this.$message.success('Голос учтен!');
        this.$emit('refresh');
      } catch (error) {
        this.$message.error('Ошибка голосования: ' + error.message);
      }
    }
  }
};
</script>

<style scoped>
.proposal-card {
  border: 1px solid #ddd;
  padding: 20px;
  margin: 10px 0;
  border-radius: 8px;
}
</style>
```

---

## Безопасность

> 💡 **Подробная информация**: См. [Безопасность DLE](../security.md) - там детально описаны все уровни защиты, сценарии атак и рекомендации по безопасности.

### Краткий обзор технических аспектов

**Ключевые принципы безопасности смарт-контрактов:**
- 🔒 **ReentrancyGuard** - защита от реентерабельности
- 🚫 **Блокировка переводов** - токены передаются только через governance
- 📸 **Снапшоты голосов** - защита от flash-loan атак
- ✍️ **EIP-712 подписи** - поддержка контрактных кошельков
- ✅ **Валидация параметров** - проверка всех входных данных
- 💰 **Custom errors** - экономия gas при ошибках

**Примеры реализации:**

```solidity
// Защита от реентерабельности
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract DLE is ReentrancyGuard {
    function execute(uint256 _proposalId) external nonReentrant {
        // Операция защищена от реентерабельности
    }
}

// Блокировка переводов токенов
function transfer(address, uint256) public pure override returns (bool) {
    revert ErrTransfersDisabled();
}

// Снапшоты голосов
uint256 public snapshotTimepoint = block.number - 1;

function vote(uint256 _proposalId, bool _support) external {
    uint256 votingPower = getPastVotes(msg.sender, snapshotTimepoint);
    require(votingPower > 0, "No voting power");
}
```

---

## Практические примеры

> 💡 **Подробные примеры и кейсы**: См. [Блокчейн для бизнеса](../blockchain-for-business.md) - там детально описаны реальные бизнес-кейсы, экономические расчеты и практические примеры использования DLE.

### Краткий обзор технических примеров

**Основные сценарии использования:**

1. **Мультичейн деплой** - развертывание DLE в нескольких сетях одновременно
2. **Добавление модулей** - расширение функциональности через голосование
3. **Иерархическое голосование** - DLE может голосовать в других DLE
4. **Управление казной** - распределение средств через голосование токен-холдеров
---

## Заключение

Блокчейн-интеграция в DLE обеспечивает:
- ✅ **Управление как в акционерном обществе** - токен-холдеры голосуют за решения
- ✅ **Прозрачность** всех решений на блокчейне
- ✅ **Мультичейн поддержка** для работы в нескольких сетях
- ✅ **Модульная архитектура** для расширения функциональности
- ✅ **Безопасность** через проверенные стандарты OpenZeppelin

### Дополнительные ресурсы

- 📖 [Основной README](../../README.md)
- 📋 [FAQ](../FAQ.md)
- 🔧 [Инструкция по установке](./setup-instruction.md)
- 📝 [Условия обслуживания](../service-terms.md)
- ⚖️ [Юридическая документация](../../legal.ru/README.md)

### Контакты и поддержка

- 🌐 **Портал**: https://hb3-accelerator.com/
- 📧 **Email**: info@hb3-accelerator.com
- 🐙 **GitHub**: https://github.com/VC-HB3-Accelerator

---

**© 2024-2025 Тарабанов Александр Викторович. Все права защищены.**

**Последнее обновление**: October 2025

