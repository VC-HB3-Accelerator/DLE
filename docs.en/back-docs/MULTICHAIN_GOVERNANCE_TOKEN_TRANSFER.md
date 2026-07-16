**English** | [Русский](../../docs.ru/back-docs/MULTICHAIN_GOVERNANCE_TOKEN_TRANSFER.md)

# Multichain governance for DLE token transfers

## System overview

The DLE multichain governance system lets token holders create proposals to transfer tokens from their wallet to another address (or to the treasury) through a voting process across all networks where the DLE contract is deployed. Each network has an independent quorum, but proposals are coordinated and displayed as a single whole.

## Architecture

### Multichain DLE contracts
- One DLE can be deployed in multiple blockchain networks (for example, Sepolia, Arbitrum Sepolia, Base Sepolia)
- Each DLE contract in each network operates independently
- Proposals are created, voted on, and executed in each network separately
- Proposal IDs are unique per network (a proposal with ID=1 on Sepolia and a proposal with ID=1 on Arbitrum Sepolia are different proposals)

### Proposal grouping
- Proposals with the same description and initiator are grouped into one card
- The card shows the proposal status across all DLE networks
- Each network in the card has its own proposal ID, state, and voting results

## Token transfer process

### Stage 1: Creating a proposal

#### Process description
1. The user fills in the token transfer form:
   - **Proposal description** - a text description of the transfer purpose
   - **Recipient address** - wallet or treasury address to which tokens will be transferred
   - **Token amount** - number of DLE tokens to transfer
   - **Voting duration** - period during which voting is allowed
   - **Your connected wallet** - automatically filled with the connected wallet address (tokens will be sent from this address)

2. The system discovers all networks where the DLE contract is deployed

3. **Sequential proposal creation in each network:**
   - For each DLE network:
     - Switch MetaMask to the corresponding network
     - 1 second delay after switching
     - Create a proposal in that network’s DLE contract
     - Obtain a unique proposal ID for that network
     - 3 second delay after transaction confirmation (5 seconds for Base Sepolia)
   - On RPC errors, automatic retry with exponential backoff is performed (up to 3 attempts)

4. **Signatures in MetaMask:**
   - The user must sign the proposal creation transaction in each DLE network
   - Number of signatures = number of DLE networks
   - Each signature creates a separate proposal in the corresponding network

#### Technical details
- **Contract function:** `createProposal(description, duration, operation, targetChains, timelockDelay)`
  - **Parameter order:** `description`, `duration`, `operation`, `targetChains` (array), `timelockDelay`
  - **targetChains:** Array of network IDs where the operation will be executed (usually `[chainId]` for the current network)
- **Operation:** `_transferTokens(sender, recipient, amount)` - where `sender` = proposal initiator address
  - **Signature:** `_transferTokens(address,address,uint256)` - **all three parameters are required!**
  - `sender` is obtained automatically from `signer.getAddress()` when creating the proposal
- **Proposal ID:** Generated automatically by the contract in each network (starts at 0, increments)
- **Grouping:** Proposals with the same `description` and `initiator` are grouped into one card

#### Operation encoding

The operation to execute must be encoded in ABI (Application Binary Interface) format before being passed to `createProposal`.

**For the token transfer operation `_transferTokens(address,address,uint256)`:**
1. **Function signature:** `_transferTokens(address,address,uint256)`
2. **Function selector:** First 4 bytes of `keccak256(signature)`
3. **Parameters:**
   - `sender` - sender address (proposal initiator)
   - `recipient` - token recipient address
   - `amount` - token amount (in wei, i.e. amount * 10^18)

**Encoding example (JavaScript/ethers.js):**
```javascript
// Method 1: Using Interface (recommended)
const functionSignature = '_transferTokens(address,address,uint256)';
const iface = new ethers.Interface([`function ${functionSignature}`]);
const encodedOperation = iface.encodeFunctionData('_transferTokens', [
  senderAddress,      // initiator address
  recipientAddress,   // recipient address
  ethers.parseUnits(amount.toString(), 18) // amount in wei
]);

// Method 2: Manual encoding
const functionSignature = '_transferTokens(address,address,uint256)';
const selectorBytes = ethers.keccak256(ethers.toUtf8Bytes(functionSignature));
const selector = '0x' + selectorBytes.slice(2, 10); // first 4 bytes

const abiCoder = ethers.AbiCoder.defaultAbiCoder();
const encodedParams = abiCoder.encode(
  ['address', 'address', 'uint256'],
  [senderAddress, recipientAddress, ethers.parseUnits(amount.toString(), 18)]
);

const encodedOperation = ethers.concat([selector, encodedParams]);
```

**Important points:**
- `sender` must match the proposal initiator address (checked in the contract on execution)
- `amount` **MUST** be passed in wei (1 token = 10^18 wei) - use `ethers.parseUnits(amount.toString(), 18)`
- **CRITICALLY IMPORTANT:** `sender` must be resolved from `signer.getAddress()` when creating the proposal in each network separately, not once before the loop
- The operation is encoded for each network separately with the current signer address for that network
- The contract decodes the operation on execution and checks that `sender` matches `initiator`

**CRITICALLY IMPORTANT - Correct implementation:**
```javascript
// ✅ CORRECT: Encoding inside the loop with the current signer address for each network
async function createProposalsInAllChains(allChains, formData) {
  const results = [];
  
  for (let index = 0; index < allChains.length; index++) {
    const chainId = allChains[index];
    
    // 1. Switch to the required network
    await switchToVotingNetwork(chainId.toString());
    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay after switch
    
    // 2. CRITICALLY IMPORTANT: Get the signer address for the current network
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const senderAddress = await signer.getAddress(); // Initiator address from signer!
    
    // 3. Encode the operation with the current signer address for this network
    const transferCallData = encodeTransferTokensCall(
      senderAddress,        // initiator address from signer (required!)
      formData.recipient,   // recipient address
      formData.amount       // amount (will be converted to wei)
    );
    
    // 4. Create the proposal
    const proposalData = {
      description: formData.description,
      duration: formData.duration,
      operation: transferCallData,
      targetChains: [chainId],
      timelockDelay: 0
    };
    
    await createProposal(contractAddress, proposalData);
  }
}

function encodeTransferTokensCall(sender, recipient, amount) {
  const functionSignature = '_transferTokens(address,address,uint256)';
  const iface = new ethers.Interface([`function ${functionSignature}`]);
  
  // CRITICALLY IMPORTANT: convert amount to wei
  const amountInWei = ethers.parseUnits(amount.toString(), 18);
  
  const encodedCall = iface.encodeFunctionData('_transferTokens', [
    sender,        // initiator address (required! must come from signer.getAddress())
    recipient,     // recipient address
    amountInWei   // amount in wei (required!)
  ]);
  
  return encodedCall;
}

// ❌ INCORRECT: Encoding once before the loop
// const transferCallData = encodeTransferTokensCall(formData.sender, ...); // INCORRECT!
// for (const chainId of allChains) {
//   await createProposal(contractAddress, { operation: transferCallData, ... }); // sender may not match!
// }

// ❌ INCORRECT: Missing sender or amount not in wei
// const transferFunctionSelector = ethers.id("_transferTokens(address,uint256)"); // INCORRECT!
// const amount = transferData.amount; // INCORRECT! Conversion to wei is required
```

**Other supported operations:**
- `_addModule(bytes32,address)` - add a module
- `_removeModule(bytes32)` - remove a module
- `_addSupportedChain(uint256)` - add a supported network
- `_removeSupportedChain(uint256)` - remove a supported network
- `_updateVotingDurations(uint256,uint256)` - update voting duration
- `_updateQuorumPercentage(uint256)` - update quorum percentage
- `_updateDLEInfo(...)` - update DLE information
- `_setLogoURI(string)` - update logo URI

#### Result
- N proposals created (one in each DLE network)
- Each proposal has a unique ID in its network
- All proposals are displayed as one card in the UI
- The card shows the proposal status in each network

---

### Stage 2: Voting

#### Process description
1. The user sees a proposal card with information about all DLE networks

2. The user chooses a vote "For" or "Against"

3. **Sequential voting across all active networks:**
   - The system identifies all active chains (state === 0 or 'active', not executed, not canceled)
   - For each active network:
     - Switch MetaMask to the corresponding network
     - 1 second delay after switching
     - **Check token balance in this network** (balances may differ across networks)
       - If there is no balance, the network is skipped with a warning
       - Voting continues in other networks
     - Vote using the **unique proposal ID for this network**
     - 3 second delay after transaction confirmation (5 seconds for Base Sepolia)

4. **Signatures in MetaMask:**
   - The user must sign the voting transaction in each active DLE network
   - Number of signatures = number of active DLE networks
   - Each signature registers a vote in the corresponding network

#### Technical details
- **Contract function:** `vote(proposalId, support)` - where `proposalId` is unique per network
- **ID check:** The system uses `chain.id` (proposal ID from the specific network), not the shared group ID
- **Balance check:** Token balance is checked **in each network separately** before voting
  - In a multichain system, balances may differ across networks
  - If a network has no tokens, voting in that network is skipped
  - The contract also checks the balance via `getPastVotes()` and will return an error if there are no tokens
- **Vote weight:** Depends on the voter’s token balance in the corresponding network
- **Independent quorums:** Each network has its own quorum

#### Result
- The vote is registered in all active DLE networks
- Each network updates its vote counters (forVotes, againstVotes)
- The proposal card is updated with the new voting data

---

### Stage 3: Executing the proposal

#### Execution conditions
**CRITICALLY IMPORTANT:** A proposal can be executed only if quorum is reached **in all DLE networks** where the proposal is active.

Conditions for each network:
- Proposal state: `ReadyForExecution` (state === 5)
- Quorum reached: `forVotes >= quorumRequired`
- Majority "For": `forVotes > againstVotes`
- Proposal not executed: `executed === false`
- Proposal not canceled: `canceled === false`
- Voting period has ended (if applicable)
- Timelock period has ended (if applicable)

#### Process description
1. The system checks that the proposal is ready for execution in all active DLE networks

2. **Sequential execution across all ready networks:**
   - For each network where the proposal is ready for execution:
     - Switch MetaMask to the corresponding network
     - 1 second delay after switching
     - Execute the proposal using the **unique proposal ID for this network**
     - 3 second delay after transaction confirmation (5 seconds for Base Sepolia)

3. **Signatures in MetaMask:**
   - The user must sign the execution transaction in each ready DLE network
   - Number of signatures = number of ready DLE networks
   - Each signature executes the token transfer in the corresponding network

#### Technical details
- **Contract function:** `executeProposal(proposalId)` - where `proposalId` is unique per network
- **Transfer operation:** `_transferTokens(sender, recipient, amount)`
  - `sender` = proposal initiator address (checked in the contract)
  - `recipient` = recipient address from the proposal
  - `amount` = token amount from the proposal
- **Security check:** The contract verifies that `sender` matches the proposal `initiator`
- **Token transfer:** Tokens are transferred from the initiator’s wallet, not from the contract balance

#### Result
- Token transfer is executed in all ready DLE networks
- Each network independently executes the transfer from the initiator’s wallet
- The proposal card is updated showing "Executed" status in all networks

---

## Canceling a proposal

### Cancellation conditions
- Only the proposal initiator can cancel it
- The proposal must be active (not executed, not canceled)
- Cancellation is possible at any time before execution

### Cancellation process
1. **Sequential cancellation across all active networks:**
   - For each active network:
     - Switch MetaMask to the corresponding network
     - 1 second delay after switching
     - Cancel the proposal using the **unique proposal ID for this network**
     - 3 second delay after transaction confirmation

2. **Signatures in MetaMask:**
   - The user must sign the cancellation transaction in each active DLE network
   - Number of signatures = number of active DLE networks

### Technical details
- **Contract function:** `cancelProposal(proposalId, reason)`
- **Permission check:** The contract verifies that the caller is the proposal initiator

---

## Important system features

### 1. Uniqueness of proposal IDs
- **Each network has its own proposal counter**
- A proposal with ID=1 on Sepolia and a proposal with ID=1 on Arbitrum Sepolia are **different proposals**
- When grouping, the system stores the ID from each network separately
- When voting/executing/canceling, the correct ID is used for each network

### 2. Proposal grouping
- Proposals are grouped by key: `${description}_${initiator}`
- One card = one logical proposal across all networks
- The card displays:
  - Shared description
  - Initiator
  - List of networks with their statuses
  - Voting results per network
  - Overall status (active/executed/canceled)

### 3. Independent quorums
- **Each network has its own quorum**
- Quorum is calculated based on the total token supply in the corresponding network
- Voting in one network does not affect quorum in another network
- To execute a proposal, quorum must be reached **in all networks**

### 4. Sequential operation execution
- All operations (create, vote, execute, cancel) are performed **sequentially**, not in parallel
- This is required because MetaMask can work with only one network at a time
- There are delays between operations to stabilize MetaMask
- **CRITICALLY IMPORTANT:** Using `Promise.all` for parallel execution is not allowed and will cause errors

### 5. Error handling
- **Retry for temporary RPC errors:**
  - Automatic retry up to 3 attempts
  - Exponential backoff (2s, 4s, 8s)
  - Only for retryable errors (Internal JSON-RPC error, rate limiting)
- **Errors in individual networks:**
  - If an operation fails in one network, the process continues for other networks
  - The user receives a summary of successful and failed operations
- **Missing balance handling:**
  - Before voting in each network, token balance is checked
  - If a network has no tokens, voting in that network is skipped with a warning
  - Voting continues in other networks where balance exists
  - The contract also checks the balance and will return `ErrNoPower` if there are no tokens

### 6. Security
- **Initiator check:** On execution the contract verifies that `sender` matches `initiator`
- **Balance check:** Before voting, token presence is checked **in each network separately**
  - Balances may differ across networks
  - If a network has no tokens, voting in that network is skipped
  - The contract also checks the balance via `getPastVotes()` and will return `ErrNoPower` if there are no tokens
- **State check:** Before each operation the current proposal state is checked
- **Data validation:** All proposal data is validated before being sent to the contract

### 7. Token transfer
- **Token source:** Tokens are transferred from the proposal initiator’s wallet, not from the contract balance
- **Recipient:** Can be any address (wallet or treasury)
- **Amount:** Specified by the initiator when creating the proposal
- **Balance check:** The contract checks that the initiator has sufficient balance before execution

---

## User interface

### Proposal card
- **Title:** Proposal description
- **Initiator:** Proposal creator address
- **Network list:**
  - Network name
  - Status (Active/Executed/Canceled/Expired)
  - Proposal ID in this network
  - Voting results (For/Against)
  - Quorum (reached/not reached)
- **Actions:**
  - Vote "For" / "Against" (if active)
  - Execute (if ready for execution)
  - Cancel (if initiator)

### Status indicators
- **Active:** Proposal is open for voting
- **Ready for execution:** Quorum reached in all networks
- **Executed:** Token transfer completed in all networks
- **Canceled:** Proposal canceled by the initiator
- **Expired:** Voting period has ended

---

## Implementation technical details

### Operation encoding

For a detailed description of the operation encoding process for proposal creation, see the section [Operation encoding](#operation-encoding) (Stage 1: Creating a proposal).

### Proposal data structure
```javascript
{
  id: number,                    // Group ID (from the first network)
  description: string,           // Proposal description
  initiator: address,            // Initiator address
  deadline: number,              // Voting deadline
  chains: [                      // Array of data per network
    {
      id: number,                // UNIQUE ID for this network
      chainId: number,            // Network ID (11155111, 421614, 84532)
      networkName: string,        // Network name
      contractAddress: address,   // DLE contract address in this network
      state: number,              // State (0=Active, 3=Executed, 4=Canceled, 5=ReadyForExecution)
      forVotes: bigint,          // Votes "For"
      againstVotes: bigint,      // Votes "Against"
      quorumRequired: bigint,    // Required quorum
      executed: boolean,         // Executed
      canceled: boolean,          // Canceled
      transactionHash: string     // Creation transaction hash
    }
  ],
  createdAt: number,             // Creation time
  uniqueId: string              // Unique grouping key
}
```

### DLE contract functions

#### createProposal
```solidity
function createProposal(
    string memory _description,
    uint256 _duration,
    bytes memory _operation,
    uint256[] memory _targetChains,
    uint256 _timelockDelay
) public returns (uint256 proposalId)
```

#### vote
```solidity
function vote(uint256 _proposalId, bool _support) public
```

#### executeProposal
```solidity
function executeProposal(uint256 _proposalId) public
```

#### cancelProposal
```solidity
function cancelProposal(uint256 _proposalId, string memory _reason) public
```

#### _transferTokens (internal)
```solidity
function _transferTokens(
    address _sender,
    address _recipient,
    uint256 _amount
) internal
```

---

## Usage examples

### Example 0: Encoding a token transfer operation

Before creating a proposal, the operation must be encoded. **CRITICALLY IMPORTANT:** Use the correct signature and convert amount to wei.

```javascript
import { ethers } from 'ethers';

// Get the initiator address from signer
const signer = await provider.getSigner();
const sender = await signer.getAddress(); // Initiator address (required!)

// Transfer parameters
const recipient = '0x1234567890123456789012345678901234567890'; // Recipient
const amount = 100; // 100 tokens (in regular units, not wei)

// Encode the operation
const functionSignature = '_transferTokens(address,address,uint256)';
const iface = new ethers.Interface([`function ${functionSignature}`]);

// CRITICALLY IMPORTANT: convert amount to wei
const amountInWei = ethers.parseUnits(amount.toString(), 18); // 100 * 10^18 wei

const encodedOperation = iface.encodeFunctionData('_transferTokens', [
  sender,        // initiator address (required!)
  recipient,     // recipient address
  amountInWei    // amount in wei (required!)
]);

// encodedOperation can now be used in createProposal
// Result: 0x... (function selector + encoded parameters)

// Create a proposal with the correct parameter order
const tx = await dle.createProposal(
  "Transfer 100 tokens to treasury",  // description
  86400,                          // duration (1 day in seconds)
  encodedOperation,               // operation
  [chainId],                      // targetChains (array!)
  0                               // timelockDelay
);
```

**Result:** Encoded operation in bytes format, ready to pass to `createProposal`.

**Common mistakes:**
- ❌ Using `_transferTokens(address,uint256)` - incorrect signature
- ❌ Missing `sender` parameter - the contract cannot verify the initiator
- ❌ Passing `amount` without conversion to wei - incorrect token amount
- ❌ Incorrect parameter order in `createProposal` - contract call error

### Example 1: Creating a proposal in 3 networks
1. User creates a proposal "Transfer 100 tokens to treasury"
2. System discovers 3 networks: Sepolia, Arbitrum Sepolia, Base Sepolia
3. 3 proposals are created:
   - Sepolia: ID=5
   - Arbitrum Sepolia: ID=3
   - Base Sepolia: ID=7
4. All 3 proposals are displayed as one card

### Example 2: Voting
1. User votes "For" on the proposal
2. System votes in 3 networks:
   - Sepolia: vote(5, true)
   - Arbitrum Sepolia: vote(3, true)
   - Base Sepolia: vote(7, true)
3. Each vote requires a separate signature in MetaMask

### Example 3: Execution
1. Quorum is reached in all 3 networks
2. System executes the proposal in 3 networks:
   - Sepolia: executeProposal(5)
   - Arbitrum Sepolia: executeProposal(3)
   - Base Sepolia: executeProposal(7)
3. In each network tokens are transferred from the initiator’s wallet to the recipient address

---

## Limitations and peculiarities

### Limitations
- MetaMask can work with only one network at a time
- Operations are executed sequentially, which may take time with many networks
- RPC errors may require manual retry

### Peculiarities
- If a proposal was not created in one of the networks (due to an error), it can still be created in other networks
- Voting is possible only in networks where the proposal is active
- Execution is possible only if quorum is reached in all active networks

---

## Security

### Attack protection
- Initiator check on execution
- Balance check before transfer
- Independent quorums in each network
- Validation of all input data

### Recommendations
- Always verify the recipient address before creating a proposal
- Make sure you have enough tokens for the transfer
- Check proposal status before voting/execution
- Monitor transactions in each network

---

## Known issues and fixes

### Fixed critical bugs

#### 1. Missing amount conversion to wei
**Problem:** The `amount` parameter was passed without conversion to wei, which led to an incorrect token amount on execution.

**Fix:** Mandatory conversion via `ethers.parseUnits(amount.toString(), 18)` was added before encoding the operation.

**File:** `frontend/src/views/smartcontracts/TransferTokensFormView.vue`

**Status:** ✅ Fixed

#### 2. Incorrect _transferTokens function signature
**Problem:** The incorrect signature `_transferTokens(address,uint256)` was used instead of `_transferTokens(address,address,uint256)`, which caused decoding errors in the contract.

**Fix:** The function signature was corrected and the required `sender` parameter (initiator address) was added.

**File:** `frontend/src/utils/dle-contract.js` (function `createTransferTokensProposal`)

**Status:** ✅ Fixed

#### 3. Incorrect parameter order in createProposal
**Problem:** `governanceChainId` was passed to `createProposal` instead of `targetChains` as the 4th parameter, which violated the contract signature.

**Fix:** Parameter order was corrected according to the contract signature: `description`, `duration`, `operation`, `targetChains`, `timelockDelay`.

**File:** `frontend/src/utils/dle-contract.js` (function `createTransferTokensProposal`)

**Status:** ✅ Fixed

#### 4. Incorrect operation encoding when creating proposals (CRITICAL)
**Problem:** The token transfer operation was encoded once before the network loop, using the address from `formData.value.sender`. Per documentation, `sender` must be resolved from `signer.getAddress()` when creating the proposal in each network, which guarantees a match with the proposal initiator.

**Fix:** 
- Operation encoding moved inside the network loop
- Added obtaining the signer address for each network via `await signer.getAddress()`
- Added a check that the signer address matches the form address
- The operation is now encoded with the current signer address for each network separately

**File:** `frontend/src/views/smartcontracts/TransferTokensFormView.vue` (function `submitForm`)

**Status:** ✅ Fixed (2025-01-XX)

#### 5. Parallel execution in executeMultichainProposal (CRITICAL)
**Problem:** The `executeMultichainProposal` function used `Promise.all` to execute operations in all networks in parallel. This does not work with MetaMask, which can work with only one network at a time.

**Fix:**
- Replaced `Promise.all` with a sequential `for` loop
- Added network switching via `switchToVotingNetwork` for each network
- Added delays after network switches (1 second) and after transaction confirmations (3 seconds, 5 seconds for Base Sepolia)
- Added filtering to only chains ready for execution

**File:** `frontend/src/composables/useProposals.js` (function `executeMultichainProposal`)

**Status:** ✅ Fixed (2025-01-XX)

#### 6. Missing network switching in voteOnMultichainProposal
**Problem:** The `voteOnMultichainProposal` function did not use network switching and token balance checks, which were required by documentation for correct multichain operation.

**Fix:**
- Added network switching via `switchToVotingNetwork` for each network
- Added token balance check before voting in each network via `checkTokenBalance`
- Added delays after network switches (1 second) and after transaction confirmations (3 seconds, 5 seconds for Base Sepolia)
- Added filtering to only active chains
- Added error handling with skipping networks when balance is missing

**File:** `frontend/src/composables/useProposals.js` (function `voteOnMultichainProposal`)

**Status:** ✅ Fixed (2025-01-XX)

### Current correct implementation

All operation encoding functions and multichain operations now use:
- ✅ Correct signature: `_transferTokens(address,address,uint256)`
- ✅ All three parameters: `sender`, `recipient`, `amount`
- ✅ Amount conversion to wei: `ethers.parseUnits(amount.toString(), 18)`
- ✅ Correct parameter order in `createProposal`
- ✅ Resolving `sender` from `signer.getAddress()` when creating the proposal in each network
- ✅ Sequential operation execution in all multichain functions (not parallel)
- ✅ Network switching before each operation in multichain functions
- ✅ Token balance check before voting in each network

### Correctness checklist

Before deployment, ensure that:
1. The `_transferTokens` function is encoded with **three** parameters (sender, recipient, amount)
2. `amount` is always converted to wei before encoding
3. `sender` is obtained from `signer.getAddress()` when creating the proposal in each network and matches the proposal initiator
4. Parameter order in `createProposal` matches the contract signature
5. All multichain operations (create, vote, execute) use sequential execution with network switching
6. When voting, token balance is checked in each network separately

---

## Conclusion

The DLE multichain governance system provides decentralized control of token transfers through independent quorums in each network, while offering a unified interface for managing proposals across all networks at once.

**Important:** All critical bugs in operation encoding have been fixed. The code matches the documentation and the contract.
