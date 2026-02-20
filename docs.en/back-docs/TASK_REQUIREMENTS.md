**English** | [Русский](../../docs.ru/back-docs/TASK_REQUIREMENTS.md)

# Task: Multichain Governance System for DLE

## Status

- ✅ Transfer proposal form works
- ✅ Proposals created in all DLE chains
- ✅ Voting in each chain separately
- ✅ Quorum per chain
- ✅ Personal transfer from proposal initiator
- ✅ Proposals grouped by description + initiator
- ✅ Server coordination with cryptographic proofs
- ✅ No hardcoded chains — deployedNetworks from API

## Context

DLE (Digital Legal Entity) is a decentralized legal entity with contracts in multiple blockchain networks. The task is to implement token governance via multichain governance: token holders can transfer tokens through voting with quorum.

## Architecture

- **Frontend:** Vue.js with Web3
- **Backend:** Node.js for coordination and API
- **Smart contracts:** DLE contracts in each supported network
- **Database:** PostgreSQL for metadata
- **WebSocket:** Real-time sync across networks

## Supported networks

- Ethereum Sepolia (chainId: 11155111)
- Arbitrum Sepolia (chainId: 421614)
- Base Sepolia (chainId: 84532)

## Functional requirements

### 1. Transfer tokens proposal form

**URL:** `/management/transfer-tokens?address=<DLE_ADDRESS>`

**Fields:** Recipient address (required), Amount (tokens, required), Description (optional), Voting duration (days, required).

### 2. Proposal creation

1. Get `deployedNetworks` from API `/dle-v2`
2. Create proposals in all DLE networks (sequentially with MetaMask; one proposal per chain)
3. Encode operation: `_transferTokens(sender, recipient, amount)` — sender = initiator

### 3. Voting

1. Voting is per chain
2. Quorum per chain: `(forVotes / totalSupply) >= quorumPercentage`
3. Vote weight = voter’s token balance

### 4. Execution

1. Each contract checks its local quorum
2. Backend aggregates quorum results and can sign global status
3. Execution with global quorum proof or per-chain execution

## Technical spec (summary)

- **Proposal:** id, description, forVotes, againstVotes, executed, canceled, deadline, initiator, operation, targetChains, snapshotTimepoint, hasVoted
- **_transferTokens(sender, recipient, amount)** internal; emits TokensTransferredByGovernance
- **Backend:** QuorumCoordinator (collect results, generate global proof)
- **API:** GET /dle-v2, POST create/vote/execute proposal endpoints
- **Frontend:** TransferTokensFormView (validation, encode operation, create in all chains), DleProposalsView (grouped list, status per chain, vote/execute)

## Security

On-chain checks (balance, deadlines, quorum), cryptographic proofs for global quorum, validation, graceful degradation if a chain is down.

## Testing

Acceptance: form works; proposals in all chains; voting per chain; quorum per chain; transfer from initiator; server coordination; grouping; error handling. Cases: create in multichain; vote when one chain down; execute with global quorum; execute with partial quorum (must fail); sufficient/insufficient initiator balance.

## Deployment

Backend with RPC to all networks, DB, SSL, monitoring. Env: RPC URLs, DATABASE_URL, SERVER_PRIVATE_KEY for signing.

---

Fully functional multichain governance for DLE tokens is implemented, with decentralized decisions and optional trusted-server coordination with cryptographic proofs.
