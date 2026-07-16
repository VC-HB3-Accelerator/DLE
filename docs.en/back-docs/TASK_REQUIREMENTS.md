**English** | [Русский](../../docs.ru/back-docs/TASK_REQUIREMENTS.md)

# Task: Implementing a multi-chain governance system for DLE

## Completion status
- ✅ Proposal creation form works
- ✅ Proposal is created in all DLE chains
- ✅ Voting happens separately in each chain
- ✅ Quorum is counted separately for each chain
- ✅ Personal token transfer from the proposal initiator
- ✅ Proposal grouping by description + initiator
- ✅ Server coordination with cryptographic proofs
- ✅ Hardcoded chains removed — `deployedNetworks` from the API are used

## Context
DLE (Digital Legal Entity) is a decentralized legal entity with contracts in multiple blockchain networks. A token management system via multi-chain governance must be implemented, where token holders can transfer tokens through quorum voting.

## System architecture

### Multi-chain components
- **Frontend**: Vue.js application with Web3 integration
- **Backend**: Node.js server for coordination and API
- **Smart Contracts**: DLE contracts in each supported network
- **Database**: PostgreSQL for metadata storage
- **WebSocket**: Real-time synchronization between networks

### Supported networks
- Ethereum Sepolia (chainId: 11155111)
- Arbitrum Sepolia (chainId: 421614)
- Base Sepolia (chainId: 84532)

## Functional requirements

### 1. Token transfer proposal creation form
**URL:** `/management/transfer-tokens?address=<DLE_ADDRESS>`

**Form fields:**
- Recipient address (required, address)
- Transfer amount (required, number in tokens)
- Proposal description (optional, string)
- Voting time (required, number in days)

### 2. Proposal creation logic
1. **Network discovery:** Get the `deployedNetworks` list via API `/dle-v2`
2. **Parallel creation:** Proposals are created simultaneously in ALL DLE networks
3. **Operation encoding:** `_transferTokens(address,uint256)` for transferring tokens from the initiator

### 3. Voting logic
1. **Independent voting:** Each network votes separately
2. **Local quorum:** Quorum is calculated by `(forVotes / totalSupply) >= quorumPercentage`
3. **Token voting:** Vote weight = voter token balance

### 4. Execution logic
1. **Local execution:** Each contract checks its own local quorum
2. **Server coordination:** Backend collects quorum results from all networks
3. **Cryptographic proofs:** The server signs the global quorum status
4. **Global execution:** The contract verifies the signature and executes the operation

## Technical specification

### Smart Contract (DLE.sol)

#### Proposal structure
```solidity
struct Proposal {
    uint256 id;
    string description;
    uint256 forVotes;
    uint256 againstVotes;
    bool executed;
    bool canceled;
    uint256 deadline;
    address initiator;           // Proposal creator
    bytes operation;             // Encoded operation
    uint256[] targetChains;      // Target networks for execution
    uint256 snapshotTimepoint;   // Snapshot point for voting
    mapping(address => bool) hasVoted;
}
```

#### _transferTokens function
```solidity
function _transferTokens(address _sender, address _recipient, uint256 _amount) internal {
    require(balanceOf(_sender) >= _amount, "Insufficient balance");
    _transfer(_sender, _recipient, _amount);
    emit TokensTransferredByGovernance(_recipient, _amount);
}
```

#### Events
```solidity
event ProposalCreated(uint256 proposalId, address initiator, string description);
event QuorumReached(uint256 proposalId, uint256 chainId);
event ProposalExecuted(uint256 proposalId, bytes operation);
```

### Backend (Node.js)

#### Quorum coordination service
```javascript
class QuorumCoordinator {
    // Collect voting results from all networks
    async collectQuorumResults(proposalId) {
        // Listen for QuorumReached events from all networks
        // Store in the database
    }

    // Generate cryptographic proofs
    async generateGlobalQuorumProof(proposalId) {
        // Sign the global quorum status
        // Return the signature for contracts
    }
}
```

#### API Endpoints
- `GET /dle-v2` - get DLE and network information
- `POST /api/dle-proposals/get-proposals` - get proposal list
- `POST /api/dle-proposals/create-proposal` - create proposal
- `POST /api/dle-proposals/vote-proposal` - vote
- `POST /api/dle-proposals/execute-proposal` - execute

### Frontend (Vue.js)

#### TransferTokensFormView component
- Form validation
- Transfer operation encoding
- Parallel proposal creation in all networks
- Error handling and result display

#### DleProposalsView component
- Proposal grouping by `description + initiator`
- Status display per network
- Voting buttons for each active network
- Execute button when global quorum is reached

## Workflow algorithm

### Usage scenario

1. **User opens the form** `/management/transfer-tokens?address=0xdD27...9386`
2. **Enters data:**
   - Recipient: `0x123...abc`
   - Amount: `1000` tokens
   - Description: `"Transfer funds to contractor"`
   - Time: `7` days
3. **Clicks "Create"**
4. **System:**
   - Resolves networks: Sepolia, Arbitrum Sepolia, Base Sepolia
   - Creates proposals in each network in parallel
   - Encodes `_transferTokens(initiator, recipient, amount)`

5. **On the proposals page** one card appears with status per network
6. **Users vote** in each network separately
7. **On local quorum** the contract emits `QuorumReached`
8. **Backend collects** results from all networks
9. **On global quorum** the server signs the proof
10. **User calls** `executeWithGlobalQuorum()` with the signature
11. **Contract verifies** the signature and executes the transfer

## Security

### Protection layers
1. **On-chain checks:** Token balance, voting deadlines, quorum
2. **Cryptographic proofs:** Server signature for global quorum
3. **Multi-level validation:** Local + global quorum
4. **Fault tolerance:** Graceful degradation when networks are unavailable

### Risks and mitigation
- **Server compromised:** Signature verification prevents forgery
- **Network unavailable:** Local voting works independently
- **Replay attacks:** Proposal ID and chainId checks
- **Front-running:** Commit-reveal scheme if needed

## Testing

### Acceptance criteria
- [x] Proposal creation form works
- [x] Proposal is created in all DLE chains
- [x] Voting happens separately in each chain
- [x] Quorum is counted separately for each chain
- [x] Token transfer happens from the proposal initiator
- [x] Server coordination with cryptographic proofs
- [x] Proposal grouping in the UI
- [x] Error handling and edge cases

### Test cases
1. Creating a proposal in a multi-chain environment
2. Voting in one network when others are unavailable
3. Execution on global quorum
4. Execution on partial quorum (must fail)
5. Token transfer from initiator with sufficient balance
6. Transfer attempt with insufficient balance (must fail)

## Deployment

### Infrastructure requirements
- **Backend server** with access to RPC of all networks
- **Database** for storing proposal metadata
- **SSL certificates** for secure communication
- **Monitoring** for tracking network state

### Environment variables
```bash
# RPC URLs
SEPOLIA_RPC_URL=https://1rpc.io/sepolia
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/dle

# Server keys for signing
SERVER_PRIVATE_KEY=0x...
```

## Conclusion

A full-featured multi-chain governance system for DLE token management has been implemented. The system provides decentralized decision-making with coordination through a trusted server with cryptographic proofs, balancing usability and security.
