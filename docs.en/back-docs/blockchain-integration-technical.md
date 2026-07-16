**English** | [Русский](../../docs.ru/back-docs/blockchain-integration-technical.md)

# Digital Legal Entity (DLE) Blockchain Integration

## 📋 Table of Contents

1. [Introduction](#introduction)
2. [Smart Contract Architecture](#smart-contract-architecture)
3. [DLE Core Contract](#dle-core-contract)
4. [Module System](#module-system)
5. [Multichain Architecture](#multichain-architecture)
6. [Voting (Governance) System](#voting-governance-system)
7. [Smart Contract Deployment](#smart-contract-deployment)
8. [Wallet Authentication](#wallet-authentication)
9. [Frontend Integration](#frontend-integration)
10. [Security](#security)
11. [Practical Examples](#practical-examples)

---

## Introduction

Digital Legal Entity (DLE) uses blockchain technologies to provide **tokenized governance** (similar to a joint-stock company on the blockchain) and **transparent decision-making** through smart contracts.

### Why Blockchain in DLE?

1. **🗳️ Governance like a joint-stock company** - decisions are made by token holders through on-chain voting
2. **🔒 Transparency** - all votes and operations are recorded on the blockchain
3. **🛡️ Censorship resistance** - the smart contract guarantees token holder rights
4. **📜 Immutability** - decision history cannot be altered
5. **🌐 Multichain support** - operation across multiple blockchains at the same time

### DLE Governance Model

DLE uses a **hybrid governance model**:

| Aspect | Implementation |
|--------|----------------|
| **Voting** | Token holders (as shareholders) |
| **Quorum** | 51%+ of tokens to pass decisions |
| **Asset distribution** | Via voting (as in a JSC) |
| **Parameter changes** | Via token holder voting |
| **Application code** | Proprietary (author) |
| **Updates** | Author develops; token holders vote on priorities |

This is a **tokenized joint-stock company on the blockchain**, where:
- ✅ Parameter governance - via token holder voting (as shareholders)
- ✅ Asset distribution - via voting (as in a JSC)
- ⚠️ Code development - centralized (author)
- ⚠️ Release of updates - author (according to voting priorities)

### Supported Blockchains

DLE works with any **EVM-compatible** networks:
- ✅ Ethereum (mainnet & testnets: Sepolia, Holesky)
- ✅ Polygon (mainnet & testnets)
- ✅ Arbitrum (One & Sepolia)
- ✅ Binance Smart Chain (BSC)
- ✅ Base (mainnet & Sepolia)
- ✅ And any other EVM networks

---

## Smart Contract Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      DLE Ecosystem                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │        DLE Core Contract (ERC20Votes)               │   │
│  │  • Governance tokens (ERC20)                        │   │
│  │  • Voting (ERC20Votes)                              │   │
│  │  • Signatures (ERC20Permit)                         │   │
│  │  • Proposals                                        │   │
│  │  • Multichain support                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                         ↕                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Modules (Extensions)                    │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ • HierarchicalVotingModule                           │  │
│  │   - Voting in other DLEs                             │  │
│  │   - Holding tokens of other DLEs                     │  │
│  │                                                      │  │
│  │ • TreasuryModule                                     │  │
│  │   - Treasury management                              │  │
│  │   - Token storage                                    │  │
│  │                                                      │  │
│  │ • TimelockModule                                     │  │
│  │   - Delayed execution                                │  │
│  │   - Protection against instant changes               │  │
│  └──────────────────────────────────────────────────────┘  │
│                         ↕                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         DLEReader (Data Reader)                      │  │
│  │  • Batch data reading                                │  │
│  │  • RPC request optimization                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Standards and Libraries

DLE uses proven **OpenZeppelin** standards:

| Standard | Purpose |
|----------|---------|
| **ERC20** | Base token functionality |
| **ERC20Votes** | Voting with snapshots |
| **ERC20Permit** | Gasless signatures (meta-transactions) |
| **ReentrancyGuard** | Reentrancy protection |
| **ECDSA** | Signature verification |

---

## DLE Core Contract

### Contract Structure

File: `backend/contracts/DLE.sol`

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

### Key Capabilities

#### 1. Governance Tokens (ERC20)

DLE tokens represent **voting rights** in governance:
- 1 token = 1 vote
- Tokens are **NOT transferred** by ordinary methods (only through governance)
- EIP-712 signatures for meta-transactions

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

#### 2. Voting (ERC20Votes)

Uses vote **snapshots**:
- Protection against flash-loans
- Votes are taken from a past block
- Delegation (optional)

```solidity
function getPastVotes(address account, uint256 timepoint) public view returns (uint256)
```

#### 3. Multichain Support

DLE can be deployed on **multiple networks at the same time**:
- One address across all networks (deterministic deployment)
- Voting on one network (governance chain)
- Execution on any target networks

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

#### 4. Modular Architecture

DLE supports **extensions through modules**:

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

### Operations Available Through Voting

| Operation | Description |
|-----------|-------------|
| `_addModule` | Add a new module |
| `_removeModule` | Remove a module |
| `_addSupportedChain` | Add a blockchain |
| `_removeSupportedChain` | Remove a blockchain |
| `_transferTokens` | Transfer tokens |
| `_updateDLEInfo` | Update DLE information |
| `_updateQuorumPercentage` | Change the quorum |
| `_updateVotingDurations` | Change voting duration |

---

## Module System

### 1. HierarchicalVotingModule

**Purpose**: Hierarchical voting — a DLE can vote in other DLEs.

**File**: `backend/contracts/HierarchicalVotingModule.sol`

**Capabilities**:
- ✅ A DLE can hold tokens of other DLEs
- ✅ Vote in other DLEs on its own behalf
- ✅ Create proposals in other DLEs
- ✅ Track voting chains

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

**Usage example**:
```javascript
// DLE-A владеет токенами DLE-B
// DLE-A может голосовать в DLE-B автоматически
const hierarchicalModule = await ethers.getContractAt('HierarchicalVotingModule', moduleAddress);
await hierarchicalModule.voteInExternalDLE(dleBAddress, proposalId, true);
```

### 2. TreasuryModule

**Purpose**: Management of the treasury and DLE assets.

**File**: `backend/contracts/TreasuryModule.sol`

**Capabilities**:
- ✅ Storage of tokens and assets
- ✅ Management via token holder voting
- ✅ Sending payments
- ✅ Accumulation of income

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

**Usage example**:
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

**Purpose**: Delayed execution of operations for security.

**File**: `backend/contracts/TimelockModule.sol`

**Capabilities**:
- ✅ Delay before execution (timelock)
- ✅ Ability to cancel before execution
- ✅ Protection against instant changes

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

**Purpose**: Optimized reading of data from contracts.

**File**: `backend/contracts/DLEReader.sol`

**Capabilities**:
- ✅ Batch reading of multiple data items in one RPC request
- ✅ Retrieving detailed DLE information
- ✅ List of all proposals with details
- ✅ Gas optimization for reads

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

## Multichain Architecture

### Concept

DLE supports **deterministic deployment** — one address across all networks:

```
Ethereum:  0x742d35Cc6634C0532925a3b844Bc9377F91cAB6C
Polygon:   0x742d35Cc6634C0532925a3b844Bc9377F91cAB6C  ← Тот же адрес!
Arbitrum:  0x742d35Cc6634C0532925a3b844Bc9377F91cAB6C
BSC:       0x742d35Cc6634C0532925a3b844Bc9377F91cAB6C
```

### How Does It Work?

1. **Init code generation** - identical bytecode for all networks
2. **Fixed nonce** - deploy with the same nonce
3. **CREATE opcode** - address = keccak256(deployerAddress, nonce)
4. **Result** - the same address on all networks

### Voting on One Network

**Voting** happens on **one network** (the governance chain), while **execution** happens on any target networks:

```
┌─────────────────────────────────────────────────────────┐
│             Ethereum (Governance Chain)                 │
│  1. Proposal creation                                   │
│  2. Voting                                              │
│  3. Vote tally                                          │
│  4. Signature generation for execution                  │
└─────────────────────────────────────────────────────────┘
                        ↓
        ┌───────────────┴───────────────┐
        ↓                               ↓
┌───────────────────┐         ┌───────────────────┐
│  Polygon          │         │  Arbitrum         │
│  (Target Chain)   │         │  (Target Chain)   │
│  5. Execution     │         │  5. Execution     │
│     with signature│         │     with signature│
└───────────────────┘         └───────────────────┘
```

### Multichain Execution

Execution via **signatures** (off-chain coordination):

```solidity
function executeWithSignatures(
    uint256 proposalId,
    bytes32 operationHash,
    address[] calldata signers,
    bytes[] calldata signatures
) external nonReentrant;
```

**Process**:
1. The proposal is approved on the governance chain
2. Token holder signatures are generated
3. Signatures are submitted to the target networks
4. The contract verifies the signatures and executes the operation

---

## Voting (Governance) System

### Creating a Proposal

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

**Parameters**:
- `_description` - proposal description
- `_duration` - voting duration (in seconds)
- `_operation` - operation to execute (encoded function call)
- `_chainId` - network ID for voting
- `_targetChains` - target networks for execution
- `_initiator` - initiator address

**Example** (backend):
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

### Voting

```solidity
function vote(uint256 _proposalId, bool _support) external;
```

**Parameters**:
- `_proposalId` - proposal ID
- `_support` - true = "For", false = "Against"

**Example** (frontend):
```javascript
// Подключение к контракту
const dleContract = new ethers.Contract(dleAddress, dleAbi, signer);

// Голосование "За"
await dleContract.vote(proposalId, true);

// Голосование "Против"
await dleContract.vote(proposalId, false);
```

### Executing a Proposal

```solidity
function execute(uint256 _proposalId) external nonReentrant;
```

**Execution conditions**:
1. ✅ Voting is finished (deadline has passed)
2. ✅ Quorum is reached (for example, 10% of tokens voted)
3. ✅ More "For" votes than "Against"
4. ✅ The proposal has not been executed yet

**Example**:
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

### Quorum

Quorum defines the **minimum number of votes** required to pass a decision:

```solidity
uint256 public quorumPercentage; // Процент от totalSupply (например, 10%)

function _hasQuorum(uint256 _forVotes, uint256 _againstVotes) internal view returns (bool) {
    uint256 totalVotes = _forVotes + _againstVotes;
    uint256 requiredVotes = (totalSupply() * quorumPercentage) / 100;
    return totalVotes >= requiredVotes;
}
```

**Changing the quorum** (only through voting):
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

## Smart Contract Deployment

### Multichain Deployment

**Script**: `backend/scripts/deploy/deploy-multichain.js`

**Capabilities**:
- ✅ Deploy to multiple networks at once (parallel)
- ✅ Deterministic address (one address across all networks)
- ✅ Automatic contract verification
- ✅ Retry logic on errors
- ✅ Nonce management for synchronization

**Run**:
```bash
cd backend
yarn deploy:multichain
```

**Configuration** (database):
Deployment parameters are stored in the `settings` table:
- `supported_chain_ids` - list of network IDs for deployment
- `rpc_providers` - RPC URLs for each network
- `dle_config` - DLE configuration (name, symbol, partners, etc.)

**Configuration example**:
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

### Module Deployment

**Script**: `backend/scripts/deploy/deploy-modules.js`

**Run**:
```bash
cd backend
yarn deploy:modules
```

**Process**:
1. Load the DLE address from the database
2. Parallel deployment of all modules on all networks
3. CREATE2 deployment for deterministic addresses
4. Automatic verification
5. Save module addresses to the database

### Contract Verification

**Automatic verification** via the Etherscan API:

```javascript
async function verifyDLEAfterDeploy(chainId, contractAddress, constructorArgs, apiKey, params) {
    await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: constructorArgs,
        contract: "contracts/DLE.sol:DLE"
    });
}
```

**Supported explorers**:
- Etherscan (Ethereum, Sepolia, Holesky)
- Polygonscan
- Arbiscan
- BSCScan
- Basescan

---

## Wallet Authentication

### SIWE (Sign-In with Ethereum)

DLE uses the **SIWE** standard for authentication:

**File**: `backend/routes/auth.js`

**Authentication process**:

```
┌──────────────┐                    ┌──────────────┐
│   Frontend   │                    │   Backend    │
└──────┬───────┘                    └──────┬───────┘
       │                                   │
       │ 1. Request nonce                  │
       ├──────────────────────────────────>│
       │                                   │
       │ 2. Return nonce                   │
       │<──────────────────────────────────┤
       │                                   │
       │ 3. Sign message in wallet         │
       │   (private key is NEVER sent!)    │
       │                                   │
       │ 4. Submit signature               │
       ├──────────────────────────────────>│
       │                                   │
       │                  5. Verify signature
       │                  6. Check tokens
       │                  7. Create session
       │                                   │
       │ 8. Successful authentication      │
       │<──────────────────────────────────┤
       │                                   │
```

### Requesting a Nonce

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

### Signature Verification

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

### Access Level Check

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

## Frontend Integration

### Connecting a Wallet

**File**: `frontend/src/services/web3Service.js`

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

### Signing a Message

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

### Authentication

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

### Interacting with the Contract

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

### Vue Component for Voting

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

## Security

> 💡 **Detailed information**: See [DLE Security](../security.md) — all protection layers, attack scenarios, and security recommendations are described there in detail.

### Brief Overview of Technical Aspects

**Key smart contract security principles:**
- 🔒 **ReentrancyGuard** - reentrancy protection
- 🚫 **Transfer lock** - tokens are transferred only through governance
- 📸 **Vote snapshots** - protection against flash-loan attacks
- ✍️ **EIP-712 signatures** - support for contract wallets
- ✅ **Parameter validation** - validation of all input data
- 💰 **Custom errors** - gas savings on errors

**Implementation examples:**

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

## Practical Examples

> 💡 **Detailed examples and cases**: See [Blockchain for Business](../blockchain-for-business.md) — real business cases, economic calculations, and practical DLE usage examples are described there in detail.

### Brief Overview of Technical Examples

**Main usage scenarios:**

1. **Multichain deploy** - deploying DLE on multiple networks at once
2. **Adding modules** - extending functionality through voting
3. **Hierarchical voting** - a DLE can vote in other DLEs
4. **Treasury management** - distributing funds through token holder voting
---

## Conclusion

Blockchain integration in DLE provides:
- ✅ **Governance like a joint-stock company** - token holders vote on decisions
- ✅ **Transparency** of all decisions on the blockchain
- ✅ **Multichain support** for operation across multiple networks
- ✅ **Modular architecture** for extending functionality
- ✅ **Security** through proven OpenZeppelin standards

### Additional Resources

- 📖 [Main README](../../README.md)
- 📋 [FAQ](https://github.com/VC-HB3-Accelerator/.github/blob/main/en/FAQ.md)
- 🔧 [Setup Instructions](./setup-instruction.md)
- 📝 [Service Terms](../../legal.en/service-terms.md)
- ⚖️ [Legal Documentation](../../legal.en/README.md)

### Contacts and Support

- 🌐 **Portal**: https://hb3-accelerator.com/
- 📧 **Email**: info@hb3-accelerator.com
- 🐙 **GitHub**: https://github.com/VC-HB3-Accelerator

---

**© 2024-2026 Alexander Viktorovich Tarabanov. All rights reserved.**

**Last updated**: February 2026
