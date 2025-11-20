# Digital Legal Entity (DLE) Blockchain Integration

## 📋 Table of Contents

1. [Introduction](#introduction)
2. [Smart Contract Architecture](#smart-contract-architecture)
3. [Main DLE Contract](#main-dle-contract)
4. [Modular System](#modular-system)
5. [Multichain Architecture](#multichain-architecture)
6. [Voting System (Governance)](#voting-system-governance)
7. [Smart Contract Deployment](#smart-contract-deployment)
8. [Wallet Authentication](#wallet-authentication)
9. [Frontend Integration](#frontend-integration)
10. [Security](#security)
11. [Practical Examples](#practical-examples)

---

## Introduction

Digital Legal Entity (DLE) uses blockchain technologies to provide **tokenized governance** (similar to a joint-stock company on blockchain) and **transparent decision-making** through smart contracts.

### Why Blockchain in DLE?

1. **🗳️ Governance Like Joint-Stock Company** - decisions made by token holders through blockchain voting
2. **🔒 Transparency** - all votes and operations recorded on blockchain
3. **🛡️ Censorship Resistance** - smart contract guarantees token holder rights
4. **📜 Immutability** - decision history is unchangeable
5. **🌐 Multichain Support** - work in multiple blockchains simultaneously

### DLE Governance Model

DLE uses a **hybrid governance model**:

| Aspect | Implementation |
|--------|----------------|
| **Voting** | Token holders (like shareholders) |
| **Quorum** | 51%+ tokens for decision making |
| **Asset Distribution** | Through voting (like in JSC) |
| **Parameter Changes** | Through token holder voting |
| **Application Code** | Proprietary (author) |
| **Updates** | Author develops, token holders vote on priorities |

This is a **tokenized joint-stock company on blockchain**, where:
- ✅ Parameter management - through token holder voting (like shareholders)
- ✅ Asset distribution - through voting (like in JSC)
- ⚠️ Code development - centralized (author)
- ⚠️ Update releases - author (based on voting priorities)

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
│  │  • Governance Tokens (ERC20)                        │   │
│  │  • Voting (ERC20Votes)                              │   │
│  │  • Signatures (ERC20Permit)                         │   │
│  │  • Proposals                                        │   │
│  │  • Multichain Support                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                         ↕                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Modules (Extensions)                    │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ • HierarchicalVotingModule                          │  │
│  │   - Voting in other DLEs                            │  │
│  │   - Owning tokens of other DLEs                     │  │
│  │                                                      │  │
│  │ • TreasuryModule                                    │  │
│  │   - Treasury Management                             │  │
│  │   - Token Storage                                   │  │
│  │                                                      │  │
│  │ • TimelockModule                                    │  │
│  │   - Delayed Execution                               │  │
│  │   - Protection from Instant Changes                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                         ↕                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         DLEReader (Data Reader)                      │  │
│  │  • Batch Data Reading                               │  │
│  │  • RPC Query Optimization                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Standards and Libraries

DLE uses proven **OpenZeppelin** standards:

| Standard | Purpose |
|----------|---------|
| **ERC20** | Basic token functionality |
| **ERC20Votes** | Voting with snapshots |
| **ERC20Permit** | Signatures without gas (meta-transactions) |
| **ReentrancyGuard** | Reentrancy protection |
| **ECDSA** | Signature verification |

---

## Main DLE Contract

### Contract Structure

File: `backend/contracts/DLE.sol`

```solidity
contract DLE is ERC20, ERC20Permit, ERC20Votes, ReentrancyGuard, IMultichainMetadata {
    // Main DLE Data
    struct DLEInfo {
        string name;              // Organization name
        string symbol;            // Token symbol
        string location;          // Location
        string coordinates;       // GPS coordinates
        uint256 jurisdiction;     // Jurisdiction
        string[] okvedCodes;      // OKVED codes
        uint256 kpp;              // KPP (for Russia)
        uint256 creationTimestamp;
        bool isActive;
    }

    // Voting Proposal
    struct Proposal {
        uint256 id;
        string description;
        uint256 forVotes;         // "For" votes
        uint256 againstVotes;     // "Against" votes
        bool executed;
        bool canceled;
        uint256 deadline;
        address initiator;
        bytes operation;          // Operation to execute
        uint256 governanceChainId; // Voting network
        uint256[] targetChains;   // Target networks for execution
        uint256 snapshotTimepoint;
        mapping(address => bool) hasVoted;
    }
}
```

### Key Capabilities

#### 1. Governance Tokens (ERC20)

DLE tokens represent **voting rights** in governance:
- 1 token = 1 vote
- Tokens **NOT transferable** by normal methods (only through governance)
- EIP-712 signatures for meta-transactions

```solidity
// Token Transfers BLOCKED
function transfer(address, uint256) public pure override returns (bool) {
    revert ErrTransfersDisabled();
}

// Approvals BLOCKED
function approve(address, uint256) public pure override returns (bool) {
    revert ErrApprovalsDisabled();
}
```

#### 2. Voting (ERC20Votes)

Uses **snapshots** of votes:
- Flash-loan protection
- Votes taken from past block
- Delegation (optional)

```solidity
function getPastVotes(address account, uint256 timepoint) public view returns (uint256)
```

#### 3. Multichain Support

DLE can be deployed in **multiple networks simultaneously**:
- One address in all networks (deterministic deployment)
- Voting in one network (governance chain)
- Execution in any target networks

```solidity
// Supported Networks
mapping(uint256 => bool) public supportedChains;
uint256[] public supportedChainIds;

// Add Network (only through voting)
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
// Modules
mapping(bytes32 => address) public modules;
mapping(bytes32 => bool) public activeModules;

// Add Module (only through voting)
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
| `_addModule` | Add new module |
| `_removeModule` | Remove module |
| `_addSupportedChain` | Add blockchain |
| `_removeSupportedChain` | Remove blockchain |
| `_transferTokens` | Transfer tokens |
| `_updateDLEInfo` | Update DLE information |
| `_updateQuorumPercentage` | Change quorum |
| `_updateVotingDurations` | Change voting duration |

---

## Modular System

### 1. HierarchicalVotingModule

**Purpose**: Hierarchical Voting - DLE can vote in other DLEs.

**File**: `backend/contracts/HierarchicalVotingModule.sol`

**Capabilities**:
- ✅ DLE can own tokens of other DLEs
- ✅ Vote in other DLEs on its behalf
- ✅ Create proposals in other DLEs
- ✅ Track voting chain

```solidity
struct ExternalDLEInfo {
    address dleAddress;
    string name;
    string symbol;
    uint256 tokenBalance;  // Balance of tokens of this DLE
    bool isActive;
    uint256 addedAt;
}

// Add External DLE
function addExternalDLE(
    address dleAddress,
    string memory name,
    string memory symbol
) external onlyDLE;

// Create Proposal in External DLE
function createProposalInExternalDLE(
    address externalDLE,
    string calldata description,
    uint256 duration,
    bytes calldata operation,
    uint256 chainId
) external onlyDLE returns (uint256);
```

**Usage Example**:
```javascript
// DLE-A owns tokens of DLE-B
// DLE-A can vote in DLE-B automatically
const hierarchicalModule = await ethers.getContractAt('HierarchicalVotingModule', moduleAddress);
await hierarchicalModule.voteInExternalDLE(dleBAddress, proposalId, true);
```

### 2. TreasuryModule

**Purpose**: Treasury and asset management for DLE.

**File**: `backend/contracts/TreasuryModule.sol`

**Capabilities**:
- ✅ Token and asset storage
- ✅ Management through token holder voting
- ✅ Payment sending
- ✅ Income accumulation

```solidity
// Transfer Tokens from Treasury (only through DLE voting)
function transferTokens(
    address token,
    address recipient,
    uint256 amount
) external onlyDLE;

// Get Token Balance in Treasury
function getTokenBalance(address token) external view returns (uint256);
```

**Usage Example**:
```javascript
// Create Proposal for Treasury Payment
const operation = treasuryModule.interface.encodeFunctionData('transferTokens', [
    tokenAddress,
    recipientAddress,
    ethers.parseEther('100')
]);

await dleContract.createProposal(
    'Pay 100 tokens for marketing',
    86400, // 24 hours
    operation,
    chainId,
    [chainId]
);
```

### 3. TimelockModule

**Purpose**: Delayed operation execution for security.

**File**: `backend/contracts/TimelockModule.sol`

**Capabilities**:
- ✅ Delay before execution (timelock)
- ✅ Cancellation possibility before execution
- ✅ Protection from instant changes

```solidity
struct TimelockProposal {
    uint256 proposalId;
    uint256 executionTime;  // Time when can execute
    bytes32 operationHash;
    bool executed;
    bool canceled;
}

// Create Timelock Proposal
function scheduleProposal(
    uint256 proposalId,
    bytes calldata operation,
    uint256 delay
) external onlyDLE returns (bytes32);

// Execute After Timelock Expires
function executeTimelockProposal(bytes32 operationHash) external;
```

### 4. DLEReader

**Purpose**: Optimized data reading from contracts.

**File**: `backend/contracts/DLEReader.sol`

**Capabilities**:
- ✅ Batch reading of multiple data in one RPC query
- ✅ Get detailed DLE information
- ✅ List all proposals with details
- ✅ Gas optimization for reading

```solidity
// Get Full DLE Information in One Query
function getDLEFullInfo(address dleAddress) external view returns (
    string memory name,
    string memory symbol,
    uint256 totalSupply,
    DLEInfo memory info,
    uint256 proposalCount,
    // ... and other data
);

// Get All Proposals (batch read)
function getAllProposals(address dleAddress) external view returns (ProposalInfo[] memory);
```

---

## Multichain Architecture

### Concept

DLE supports **deterministic deployment** - one address in all networks:

```
Ethereum:  0x742d35Cc6634C0532925a3b844Bc9377F91cAB6C
Polygon:   0x742d35Cc6634C0532925a3b844Bc9377F91cAB6C  ← Same address!
Arbitrum:  0x742d35Cc6634C0532925a3b844Bc9377F91cAB6C
BSC:       0x742d35Cc6634C0532925a3b844Bc9377F91cAB6C
```

### How It Works?

1. **Init Code Generation** - same bytecode for all networks
2. **Fixed Nonce** - deployment from same nonce
3. **CREATE Opcode** - address = keccak256(deployerAddress, nonce)
4. **Result** - same address in all networks

### Voting in One Network

**Voting** happens in **one network** (governance chain), and **execution** - in any target networks:

```
┌─────────────────────────────────────────────────────────┐
│             Ethereum (Governance Chain)                 │
│  1. Proposal Creation                                   │
│  2. Voting                                              │
│  3. Vote Counting                                       │
│  4. Signature Generation for Execution                  │
└─────────────────────────────────────────────────────────┘
                        ↓
        ┌───────────────┴───────────────┐
        ↓                               ↓
┌───────────────────┐         ┌───────────────────┐
│  Polygon          │         │  Arbitrum         │
│  (Target Chain)   │         │  (Target Chain)   │
│  5. Execution     │         │  5. Execution     │
│     with Signature│         │     with Signature│
└───────────────────┘         └───────────────────┘
```

### Multichain Execution

Execution through **signatures** (off-chain coordination):

```solidity
function executeWithSignatures(
    uint256 proposalId,
    bytes32 operationHash,
    address[] calldata signers,
    bytes[] calldata signatures
) external nonReentrant;
```

**Process**:
1. Proposal approved in governance network
2. Token holder signatures generated
3. Signatures passed to target networks
4. Contract verifies signatures and executes operation

---

## Voting System (Governance)

### Creating Proposal

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

// Operation: add module
const operation = dleContract.interface.encodeFunctionData('_addModule', [
    ethers.id('TIMELOCK_MODULE'), // moduleId
    timelockModuleAddress
]);

// Create Proposal
const tx = await dleContract.createProposal(
    'Add Timelock Module for Protection',
    86400 * 3, // 3 days
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
// Connect to Contract
const dleContract = new ethers.Contract(dleAddress, dleAbi, signer);

// Vote "For"
await dleContract.vote(proposalId, true);

// Vote "Against"
await dleContract.vote(proposalId, false);
```

### Proposal Execution

```solidity
function execute(uint256 _proposalId) external nonReentrant;
```

**Execution Conditions**:
1. ✅ Voting completed (deadline passed)
2. ✅ Quorum reached (e.g., 10% of tokens voted)
3. ✅ More "For" votes than "Against"
4. ✅ Proposal not yet executed

**Example**:
```javascript
// Check if Can Execute
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

Quorum determines **minimum number of votes** for decision making:

```solidity
uint256 public quorumPercentage; // Percentage of totalSupply (e.g., 10%)

function _hasQuorum(uint256 _forVotes, uint256 _againstVotes) internal view returns (bool) {
    uint256 totalVotes = _forVotes + _againstVotes;
    uint256 requiredVotes = (totalSupply() * quorumPercentage) / 100;
    return totalVotes >= requiredVotes;
}
```

**Changing Quorum** (only through voting):
```javascript
const operation = dleContract.interface.encodeFunctionData('_updateQuorumPercentage', [
    15 // New quorum 15%
]);

await dleContract.createProposal(
    'Increase Quorum to 15%',
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
- ✅ Deployment to multiple networks simultaneously (parallel)
- ✅ Deterministic address (one address in all networks)
- ✅ Automatic contract verification
- ✅ Retry logic on errors
- ✅ Nonce management for synchronization

**Run**:
```bash
cd backend
yarn deploy:multichain
```

**Configuration** (database):
Deployment parameters stored in `settings` table:
- `supported_chain_ids` - list of network IDs for deployment
- `rpc_providers` - RPC URLs for each network
- `dle_config` - DLE configuration (name, symbol, partners, etc.)

**Configuration Example**:
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
1. Load DLE address from database
2. Parallel deployment of all modules in all networks
3. CREATE2 deployment for deterministic addresses
4. Automatic verification
5. Save module addresses to database

### Contract Verification

**Automatic Verification** via Etherscan API:

```javascript
async function verifyDLEAfterDeploy(chainId, contractAddress, constructorArgs, apiKey, params) {
    await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: constructorArgs,
        contract: "contracts/DLE.sol:DLE"
    });
}
```

**Supported Scanners**:
- Etherscan (Ethereum, Sepolia, Holesky)
- Polygonscan
- Arbiscan
- BSCScan
- Basescan

---

## Wallet Authentication

### SIWE (Sign-In with Ethereum)

DLE uses **SIWE** standard for authentication:

**File**: `backend/routes/auth.js`

**Authentication Process**:

```
┌──────────────┐                    ┌──────────────┐
│   Frontend   │                    │   Backend    │
└──────┬───────┘                    └──────┬───────┘
       │                                   │
       │ 1. Request nonce                 │
       ├──────────────────────────────────>│
       │                                   │
       │ 2. Return nonce                  │
       │<──────────────────────────────────┤
       │                                   │
       │ 3. Sign Message in Wallet        │
       │   (Private Key NOT Transferred!) │
       │                                   │
       │ 4. Send Signature                │
       ├──────────────────────────────────>│
       │                                   │
       │                  5. Verify Signature
       │                  6. Check Tokens
       │                  7. Create Session
       │                                   │
       │ 8. Successful Authentication     │
       │<──────────────────────────────────┤
       │                                   │
```

### Request Nonce

```javascript
// POST /api/auth/nonce
app.post('/api/auth/nonce', async (req, res) => {
    const { address } = req.body;
    
    // Generate Random Nonce
    const nonce = crypto.randomBytes(32).toString('hex');
    
    // Save to DB with Encryption
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
    
    // Form SIWE Message
    const message = new SiweMessage({
        domain: req.get('host'),
        address: ethers.getAddress(address),
        statement: 'Sign in with Ethereum to the app.',
        uri: req.get('origin'),
        version: '1',
        chainId: 1,
        nonce: nonce
    });
    
    // Verify Signature
    const isValid = await verifySignature(
        message.prepareMessage(),
        signature,
        address
    );
    
    if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Check Tokens in Smart Contract
    const userAccessLevel = await getUserAccessLevel(address);
    
    // Create Session
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
    // Get DLE Contract Address from Settings
    const dleAddress = await getSettingValue('contract_address');
    if (!dleAddress) {
        return { level: 'user', tokenCount: 0, hasAccess: false };
    }
    
    // Connect to Contract
    const dleContract = new ethers.Contract(dleAddress, dleAbi, provider);
    
    // Get Token Balance
    const tokenCount = await dleContract.balanceOf(address);
    
    // Access Thresholds from Settings
    const editorThreshold = await getSettingValue('editor_token_threshold') || 100;
    const readonlyThreshold = await getSettingValue('readonly_token_threshold') || 1;
    
    // Determine Access Level
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

### Wallet Connection

**File**: `frontend/src/services/web3Service.js`

```javascript
import { ethers } from 'ethers';

export async function connectWallet() {
    if (!window.ethereum) {
        throw new Error('MetaMask not installed');
    }
    
    // Request Wallet Access
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    
    // Create Provider
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    
    return { provider, signer, address };
}
```

### Message Signing

```javascript
export async function signMessage(signer, message) {
    try {
        const signature = await signer.signMessage(message);
        return signature;
    } catch (error) {
        throw new Error('User rejected signature');
    }
}
```

### Authentication

```javascript
import axios from 'axios';

export async function authenticateWithWallet(address, signer) {
    // 1. Get Nonce
    const { data } = await axios.post('/api/auth/nonce', { address });
    const { nonce } = data;
    
    // 2. Form SIWE Message
    const message = `Sign in with Ethereum to the app.\n\nNonce: ${nonce}`;
    
    // 3. Sign
    const signature = await signMessage(signer, message);
    
    // 4. Send for Verification
    const response = await axios.post('/api/auth/verify', {
        address,
        signature,
        nonce,
        issuedAt: new Date().toISOString()
    });
    
    return response.data;
}
```

### Contract Interaction

```javascript
import { ethers } from 'ethers';
import dleAbi from '@/contracts/DLE.json';

export async function getDLEContract(address, signerOrProvider) {
    return new ethers.Contract(address, dleAbi.abi, signerOrProvider);
}

// Create Proposal
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

// Vote
export async function voteOnProposal(contract, proposalId, support) {
    const tx = await contract.vote(proposalId, support);
    await tx.wait();
}

// Get Proposal Information
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
      <div>For: {{ proposal.forVotes }}</div>
      <div>Against: {{ proposal.againstVotes }}</div>
    </div>
    <div class="actions" v-if="!proposal.executed">
      <button @click="vote(true)">Vote "For"</button>
      <button @click="vote(false)">Vote "Against"</button>
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
        
        this.$message.success('Vote Recorded!');
        this.$emit('refresh');
      } catch (error) {
        this.$message.error('Voting Error: ' + error.message);
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

> 💡 **Detailed Information**: See [DLE Security](./security.md) - detailed description of all protection levels, attack scenarios, and security recommendations.

### Brief Technical Overview

**Key Smart Contract Security Principles:**
- 🔒 **ReentrancyGuard** - reentrancy protection
- 🚫 **Transfer Blocking** - tokens transfer only through governance
- 📸 **Vote Snapshots** - flash-loan attack protection
- ✍️ **EIP-712 Signatures** - contract wallet support
- ✅ **Parameter Validation** - all input data validation
- 💰 **Custom Errors** - gas savings on errors

**Implementation Examples:**

```solidity
// Reentrancy Protection
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract DLE is ReentrancyGuard {
    function execute(uint256 _proposalId) external nonReentrant {
        // Operation protected from reentrancy
    }
}

// Token Transfer Blocking
function transfer(address, uint256) public pure override returns (bool) {
    revert ErrTransfersDisabled();
}

// Vote Snapshots
uint256 public snapshotTimepoint = block.number - 1;

function vote(uint256 _proposalId, bool _support) external {
    uint256 votingPower = getPastVotes(msg.sender, snapshotTimepoint);
    require(votingPower > 0, "No voting power");
}
```

---

## Practical Examples

> 💡 **Detailed Examples and Cases**: See [Blockchain for Business](./blockchain-for-business.md) - detailed description of real business cases, economic calculations, and practical DLE usage examples.

### Brief Technical Overview

**Main Usage Scenarios:**

1. **Multichain Deployment** - DLE deployment in multiple networks simultaneously
2. **Module Addition** - functionality extension through voting
3. **Hierarchical Voting** - DLE can vote in other DLEs
4. **Treasury Management** - fund distribution through token holder voting
---

## Conclusion

Blockchain integration in DLE provides:
- ✅ **Governance Like Joint-Stock Company** - token holders vote on decisions
- ✅ **Transparency** of all decisions on blockchain
- ✅ **Multichain Support** for work in multiple networks
- ✅ **Modular Architecture** for functionality extension
- ✅ **Security** through proven OpenZeppelin standards

### Additional Resources

- 📖 [Main README](../README.md)
- 📋 [FAQ](./FAQ.md)
- 🔧 [Installation Instructions](./setup-instruction.md)
- 📝 [Terms of Service](./service-terms.md)
- ⚖️ [Legal Documentation](../legal/README.md)

### Contacts and Support

- 🌐 **Portal**: https://hb3-accelerator.com/
- 📧 **Email**: info@hb3-accelerator.com
- 🐙 **GitHub**: https://github.com/VC-HB3-Accelerator

---

**© 2024-2025 Tarabanov Alexander Viktorovich. All rights reserved.**

**Last Updated**: October 2025

